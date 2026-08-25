# Quest Learning — Security Architecture & Cybersecurity Stack

> **Scope.** This document is an in-depth inventory of every security feature in the Quest Learning codebase and the full cybersecurity stack around it — from the network edge down to individual database columns.
>
> **Sources.** Repository state as of commit `7078e80` (2026-07-07, `QuestCognitiveLearning/Quest-V1`, branch `main`) plus **live verification against the production Supabase project `lgymrkodypbqghyjocxg` on 2026-07-09** (see [Appendix A](#appendix-a--live-production-verification-2026-07-09)). Where a control exists only in the live database and not in repo migrations, it is explicitly flagged (see [§10](#10-repo-vs-live-database-drift)).

---

## Table of Contents

1. [Architecture & Trust Boundaries](#1-architecture--trust-boundaries)
2. [Network & Platform Edge (Cloudflare + Vercel)](#2-network--platform-edge-cloudflare--vercel)
3. [Frontend / Client Security](#3-frontend--client-security)
4. [Authentication & Identity](#4-authentication--identity)
5. [Edge Function (API) Security](#5-edge-function-api-security)
6. [LLM Abuse & Spend Protection](#6-llm-abuse--spend-protection)
7. [Payment (Stripe) Security](#7-payment-stripe-security)
8. [Database Security (Postgres / RLS)](#8-database-security-postgres--rls)
9. [Secrets Management](#9-secrets-management)
10. [Repo vs Live-Database Drift](#10-repo-vs-live-database-drift)
11. [Audit Logging & Monitoring](#11-audit-logging--monitoring)
12. [Supply Chain & CI](#12-supply-chain--ci)
13. [Known Gaps & Accepted Risks](#13-known-gaps--accepted-risks)
14. [Appendix A — Live Production Verification](#appendix-a--live-production-verification-2026-07-09)

---

## 1. Architecture & Trust Boundaries

```
Browser (React SPA, anon key + user JWT only)
   │  HTTPS
   ▼
Cloudflare (DNS + proxy: TLS termination, DDoS absorption, caching)
   │
   ▼
Vercel (static hosting: security headers, CSP, rewrites)
   │
   ▼
Supabase Edge Functions (Deno) ──► OpenAI (LLM)      — server-held key
   │        │        │        └──► Resend (email)     — server-held key
   │        │        └───────────► Stripe (billing)   — server-held key + webhook signature
   │        └────────────────────► ClassLink (SSO/OneRoster) — server-held secret
   ▼
Supabase Postgres (RLS on every table) + Supabase Auth (JWT, PKCE)
```

Trust model:

- **The browser is untrusted.** It holds only the publishable anon key and the user's own JWT. Every privileged operation happens server-side (Edge Functions with service-role key) or is enforced at the database by Row-Level Security.
- **Client-side gating (routes, tier checks, role menus) is UX only.** Actual authorization lives in RLS policies, column-protection triggers, and Edge Function guards.
- **Edge Functions authenticate first, then escalate.** The universal pattern is: verify caller (JWT / Stripe signature / internal token / cron secret) → only then use the RLS-bypassing service-role client.

---

## 2. Network & Platform Edge (Cloudflare + Vercel)

### 2.1 Cloudflare

DNS is hosted at Cloudflare with the proxy enabled, so all production traffic (`questlearning.co`) passes through Cloudflare before reaching Vercel. This provides TLS termination, network-level DDoS absorption, and edge caching in front of the application. (Operational note: after a Vercel deploy, Cloudflare can briefly serve stale assets — purge cache or hard-refresh.)

### 2.2 Vercel security headers (`vercel.json`)

Applied globally to `/(.*)` (`vercel.json:13-42`):

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for a year, all subdomains, preload-eligible |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking defense |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()` | Disables camera/mic/geolocation, permits payment for self, opts out of FLoC |
| `Content-Security-Policy` | see below | Primary XSS / injection containment |

**Content-Security-Policy** (`vercel.json:38-39`), key directives:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` + Stripe, Navattic, YouTube script hosts *(the `unsafe-*` allowances are a known weakness — see §13)*
- `connect-src` restricted to self, `*.supabase.co` (HTTPS + WSS), Stripe API, YouTube, Navattic, FluxFM, MyMemory translate
- `frame-src` limited to YouTube, Stripe, Navattic; **`frame-ancestors 'none'`** (belt-and-braces with `X-Frame-Options: DENY`)
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self' https://*.stripe.com`
- `upgrade-insecure-requests`

### 2.3 Caching & routing hygiene

- `index.html` and all non-asset routes: `Cache-Control: no-store, must-revalidate` (`vercel.json:56-64`) — no stale or shared-cache exposure of app HTML.
- Hashed build assets: `immutable` long-lived cache (`vercel.json:44-46`).
- `/auth/classlink` is rewritten server-side to the `classlinkSso` Edge Function (`vercel.json:7-10`) and excluded from the SPA catch-all — the SSO entry point never executes client code.

---

## 3. Frontend / Client Security

### 3.1 XSS posture

- **React JSX auto-escaping** is the baseline everywhere.
- **Exactly one `dangerouslySetInnerHTML`** in the codebase (`src/components/ui/chart.jsx:61-77`) — injects a `<style>` block from developer-controlled chart theme constants, never user input.
- **No active markdown→HTML rendering path**: `react-markdown` is in `package.json` but unused (verified by grep); no `rehype-raw` / `allowDangerousHtml` anywhere.
- Math rendering goes through **KaTeX** (`react-katex`, `src/components/utils/MathRenderer.jsx`) which produces safe DOM output.
- CSP (§2.2) is the containment layer for anything that slips through.

### 3.2 Route & role gating (UX layer)

- `RequireAuth` (`src/App.jsx:88-95`) redirects unauthenticated users to `/SignIn?next=…` unless the page is on the `PUBLIC_PAGES` allowlist (`App.jsx:32-56`).
- `Layout.jsx:86-135` enforces role-scoped page allowlists: students confined to `studentPages` (redirected to KnowledgeMap otherwise), free-tier teachers restricted to a page subset.
- Tier/capability logic centralized in `src/lib/tier.js` (`getUserTier`, `getLimits`, `isFeatureEnabled`, `canCreateClass`, `canStudentGenerate`); `SubscriptionCheck.jsx:39-41` gates premium UI to `['premium','trial','grace_period']`.
- These are **deliberately duplicated** server-side: real enforcement is RLS (§8) and the users-table privilege trigger (§8.3). A student editing client JS gains nothing durable.

### 3.3 Client → API call hygiene

- Edge Functions invoked via `supabase.functions.invoke` (`src/api/custom-sdk.jsx:316-320`) — supabase-js attaches the session bearer token automatically.
- The one manual REST call (`me()`, `custom-sdk.jsx:218-226`) sets `apikey` + `Authorization: Bearer <access_token>` explicitly, URL-encodes the email query parameter, and bounds the request with a 5-second `AbortController` timeout.
- Form validation uses **zod** + `@hookform/resolvers` (client convenience; server revalidates — §5.5).

### 3.4 Payment UI

- **No prices or amounts ever originate in the client.** Checkout flows (`DownloadGate.jsx:49-58`, `Pricing.jsx:96-123`, `TeacherSettings.jsx:69-93`) pass only a server-provided `priceId` to `createCheckout` and redirect to the Stripe-hosted URL Stripe returns.
- After checkout, the client only reads `?checkout=success` to *trigger a server-side sync* (`Layout.jsx:46-48`) — entitlement is never trusted from the client.

---

## 4. Authentication & Identity

### 4.1 Supabase Auth configuration

- Client configured with **`flowType: 'pkce'`** (`src/components/lib/supabase-client.jsx:12-18`) — authorization-code interception resistance for OAuth flows; plus `persistSession`, `autoRefreshToken`, `detectSessionInUrl`. The client factory throws at boot if env vars are missing.
- Sessions are short-lived JWTs with auto-refresh; sign-out clears app state then calls `supabase.auth.signOut()` (`AuthContext.jsx:128-134`). Only an explicit `SIGNED_OUT` event tears down the session — transient network errors deliberately do not (availability without weakening auth).
- **Known tradeoff:** tokens live in `localStorage`, not HttpOnly cookies — self-documented `TODO [SECURITY]` (`AuthContext.jsx:8-11`, `custom-sdk.jsx:9-13`), accepted to avoid a supabase-js auth-lock deadlock. Mitigated by the strict CSP and near-zero raw-HTML rendering surface (§3.1).

### 4.2 Server-side identity resolution

- Every JWT-gated Edge Function funnels through one shared primitive, `getMe(req)` (`supabase/functions/_shared/auth.ts:7-29`): it **cryptographically verifies** the JWT via `supabase.auth.getUser()` against Supabase Auth, then resolves the `public.users` row by `auth_user_id` (email fallback). No function parses JWTs by hand.
- In the database, all identity flows from `auth.uid()` through the `SECURITY DEFINER` helper `my_user_id()` — RLS policies never trust client-supplied user IDs.
- New auth users get their `public.users` mirror row via the `handle_new_auth_user()` DEFINER trigger (`0003_signup_flow.sql`), idempotent (`on conflict do nothing`).

### 4.3 ClassLink SSO (district single sign-on)

`classlinkSso` Edge Function — confidential-client OAuth2, entirely server-side:

- Authorization-code exchange uses the server-held `CLASSLINK_CLIENT_SECRET` (`classlinkSso/index.ts:80-90`); failures redirect with a generic reason — no token or error detail leaks to the browser.
- The ClassLink access token is used **only server-side** to fetch `/my/info`; identity resolution follows a strict precedence chain scoped by `TenantId` (TenantId+SourcedId → TenantId+LoginId → LoginId → email, `classlinkSso:130-155`) so one district's identifiers can never collide with another's.
- Role mapping via shared `_shared/classlinkRole.ts` (single source for SSO + roster sync, so they can't drift); **unclassifiable roles are never auto-provisioned as privileged** — user lands on RoleSelection.
- Provisioning uses `admin.auth.admin.createUser` with `email_confirm: true`; existing `account_type` / `full_name` are never overwritten by SSO (`classlinkSso:186-198`).
- Session hand-off uses a **one-time magic-link `hashed_token`** forwarded to `/AuthCallback` (`classlinkSso:203-217`) — no raw session token ever appears in a redirect URL.
- Deactivated rostered users are banned at the auth layer and flagged via `users.classlink_disabled` (migration `0049`).

---

## 5. Edge Function (API) Security

All 24 functions live in `supabase/functions/`; shared controls in `_shared/`.

### 5.1 CORS allowlist (`_shared/cors.ts`)

- Hard `ALLOWED_ORIGINS` Set (`cors.ts:26-34`): production domains, the Vercel preview domain, legacy domain, and localhost dev ports. **No wildcard.**
- `corsHeadersFor(req)` echoes the origin only if allowlisted; otherwise returns the canonical origin so the browser's CORS check fails (`cors.ts:43-53`). Sets `Vary: Origin`, methods restricted to `GET, POST, OPTIONS`, fixed allow-headers list.
- `safeErrorResponse()` (`cors.ts:95-104`) masks internal errors from clients and logs server-side with a `crypto.randomUUID()` correlation ID — no stack traces or internals over the wire.

### 5.2 Authentication matrix

**JWT required (401 via `getMe`)**: `createCheckout`, `stripePortal`, `syncStripeSubscription`, `sendWelcomeEmail`, `extractDataFromUploadedFile`, `fetchStandards`, `fetchTranscript`, `fireUserEvent`, `generateAttentionChecks`, `generateImage`, `invokeLLM`, `youtubeSearch`, `claimLeadHandouts` (and `stripeWebhook`'s GET diagnostic path).

**Alternative auth (not JWT)**:

- `stripeWebhook` — Stripe **signature verification** (§7.2).
- `classlinkSso` — the OAuth2 code exchange itself is the credential (§4.3).
- `rosterSync`, `handleEventTrigger`, `processTimeTriggers` — `X-Quest-Internal-Token` shared-secret header, compared against `QUEST_INTERNAL_TOKEN` env (with Supabase **Vault** fallback via a service-role-only `get_vault_secret` RPC for rosterSync); empty presented tokens rejected.
- `checkDueReviews` — cron shared secret (`CRON_SHARED_SECRET`).

**Intentionally public (rate-limit-gated only)**: `captureLead`, `publicTryFunnel`, `contactForm`, `getStripePrices` (returns only non-secret price IDs), `joinLiveSession` (JWT optional; anonymous participants allowed), `liveSessionSocratic` (gated on a valid open live-session code — "stops this from being a free LLM proxy").

### 5.3 Rate limiting (`_shared/rateLimit.ts`)

Dual-layer in-memory limiter (per-IP and per-user Maps); both caps must pass; 429 responses carry `X-RateLimit-*` and `Retry-After` headers. IP taken as the first hop of `x-forwarded-for`.

| Function | Per-IP / min | Per-user / min |
|---|---|---|
| `createCheckout` | 100 | 10 |
| `stripePortal` | 100 | 30 |
| `syncStripeSubscription` | 100 | 30 (+ 2 s cooldown cache) |
| `stripeWebhook` | 600 | — |
| `getStripePrices` | 60 | — |
| `invokeLLM` | 100 | 30 |
| `generateImage` | 60 | 10 |
| `generateAttentionChecks` | 100 | 30 |
| `extractDataFromUploadedFile` | 60 | 10 |
| `fetchStandards` / `fetchTranscript` / `youtubeSearch` | 100 | 30 |
| `fireUserEvent` | 60 | 20 |
| `sendWelcomeEmail` | 60 | 10 |
| `claimLeadHandouts` | 30 | — |
| `captureLead` / `publicTryFunnel` | 20 | — |
| `joinLiveSession` | 30 | — |
| `liveSessionSocratic` | 60 | — |
| `contactForm` | 3 per 5 min **and** 10 per hour | — |
| `checkDueReviews` | 5 | — |

*Limitation:* buckets are in-memory per Deno isolate — they reset on cold start and don't aggregate across instances (§13). The durable backstop for the expensive (LLM) paths is the DB-backed daily quota in §6.

### 5.4 Service-role discipline

- `_shared/client.ts` exposes two clients: `userClient(req)` (anon key + forwarded caller JWT, **RLS enforced**) and `adminClient()` (service-role, RLS bypass, "admin operations only").
- Verified pattern across all functions: **authenticate/authorize first** (JWT, Stripe signature, internal token, or cron secret) **then** touch `adminClient()`. No unauthenticated write path reaches the service-role client.

### 5.5 Input validation & sanitization

- `_shared/validator.ts` — OWASP-aligned schema validator: **strict by default** (unknown keys dropped → no mass assignment), type/length/range/enum enforcement, emails normalized + capped at 254 chars, URLs restricted to `http:`/`https:` and 2048 chars, array `maxItems` caps. Used by `createCheckout`, `captureLead`, `generateImage`, `joinLiveSession`, `youtubeSearch`.
- Manual validation elsewhere: prompt length caps (`invokeLLM` 200k chars, `publicTryFunnel` 6k, file extraction truncated at 12k), YouTube IDs matched against a strict regex allowlist, `fireUserEvent` restricted to a two-event allowlist Set.
- User text interpolated into **emails is HTML-escaped** (`captureLead`, `contactForm` escape helpers).
- `contactForm` anti-spam: honeypot field (silent success), dual-window rate limit, URL-count heuristic (>3 links rejected).
- PostgREST `.or()` filters: `joinLiveSession` constrains the session code (`validate()` maxLength 16 + uppercase) before interpolation; `liveSessionSocratic` only trims/uppercases — the least-constrained filter interpolation in the codebase (§13).

### 5.6 Outbound/API-client hardening

- `_shared/llm.ts` — 120 s `AbortController` timeout on OpenAI calls; bounded worker time.
- `_shared/oneroster.ts` (ClassLink OneRoster client) — hard **request budget** per run (default 2000 requests, throws on exhaustion), honors `Retry-After` on 429, exponential backoff + jitter + page-size shrink on 5xx, never logs tokenized URLs or bodies, and **field-allowlists** (`ENTITY_FIELDS` + `pickFields()`) strip everything not needed before data touches the DB — data minimization at the parse boundary.
- `_shared/email.ts` — no-ops to console when `RESEND_API_KEY` unset; no accidental sends from misconfigured environments.
- `_shared/fireEvent.ts` — in-cluster function-to-function calls authenticated with the internal token header; skips silently if secrets are missing.

---

## 6. LLM Abuse & Spend Protection

Defense-in-depth around the OpenAI key — the single most abusable resource. `guardLLMRequest()` runs before **every** authenticated upstream call (`invokeLLM`, `generateImage`, `generateAttentionChecks`); `logLLMUsage()` records after success.

Layers (`_shared/llmGuard.ts`):

1. **JWT auth** — anonymous callers never reach the guarded paths.
2. **Per-IP + per-user rate limits** (§5.3).
3. **Model allowlist** — `gpt-5-mini`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-image-1`; unknown model → 400. Blocks "model-upgrade" attacks requesting expensive models.
4. **Tier gate** — heavy actions (e.g. `gpt-5-mini`, image generation) require `premium` / `trial` / `grace_period`; else 403.
5. **Per-user daily quota** — 200 calls/day, counted from the DB `llm_audit_log` (survives cold starts); exceed → 429 with `Retry-After` to UTC midnight. Caps a stolen JWT at roughly $2/day.
6. **Global daily circuit breaker** — 10,000,000 tokens/day summed across all users; exceed → 503. Caps the worst-case daily OpenAI bill at roughly $100.
7. **Prompt-size caps** (§5.5) bound cost per call.
8. **System-prompt lockdown** — only `role === 'admin'` may override the system prompt in `invokeLLM`; everyone else gets the forced default. Blocks prompt-extraction and jailbreak-by-system-prompt.
9. **Audit trail** — every successful call logged with user + token counts (§11); `total_tokens` is a Postgres `GENERATED ALWAYS ... STORED` column (tamper-resistant).
10. **Output filtering** — attention-check generation filters model output to valid A–D choices before storage.

Design note: the quota checks **fail open** if the audit-log query itself errors (logged, then allowed) — an explicit availability choice, safe because layers 1–4 still hold.

**Anonymous LLM paths** (`publicTryFunnel`, `liveSessionSocratic`) cannot use per-user quotas; they rely on IP limits, prompt caps, and (for Socratic) a valid open-session code. These bypass `guardLLMRequest`, so they sit outside the global token breaker — a tracked gap (§13).

---

## 7. Payment (Stripe) Security

### 7.1 `createCheckout`

- Client supplies **only a `priceId`**, strictly validated against `^price_[A-Za-z0-9]+$` (max 64 chars). Amounts, currency, trial length are derived server-side from env-configured price IDs. Price manipulation is structurally impossible.
- Stripe customer resolved by the **JWT-verified email** (`stripe.customers.list({email})`) — never a client-supplied customer ID.
- `app_user_id` stamped into Stripe customer + subscription metadata for unambiguous reconciliation.

### 7.2 `stripeWebhook`

- **Cryptographic signature verification**: `stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET)`; missing or invalid signature → 400. Raw body read as text before parsing (signature integrity).
- Extracted `userId` type/length validated (≤255) before any DB write; writes go through the admin client only after the signature gate.
- Entitlement (tier, subscription status, trial/grace dates) is written **only** by this signature-verified path or `syncStripeSubscription` — and the users-table trigger (§8.3) blocks every client-side write to those columns at the DB.

### 7.3 `stripePortal` / `syncStripeSubscription` / `getStripePrices`

- Portal + sync resolve the customer by JWT email; a user can only ever open *their own* billing portal or sync *their own* subscription.
- Sync has a 2-second per-user cooldown cache against hammering.
- `getStripePrices` exposes only public price identifiers (documented non-secret), IP-limited.

---

## 8. Database Security (Postgres / RLS)

**Live-verified 2026-07-09**: 72 of 72 tables in `public` have RLS enabled (zero disabled), 120 policies, 44 `SECURITY DEFINER` functions, privilege-guard trigger enabled, 28 `strip_created_by` triggers. See Appendix A.

### 8.1 RLS lockdown history

`0001_init.sql` enabled RLS on every table with permissive dev-only policies; `0002_rls.sql` **drops every permissive policy** via a `pg_policies` loop and re-creates scoped ones. Nothing permissive survives.

### 8.2 Policy patterns

| Pattern | Mechanism | Representative tables |
|---|---|---|
| **Owner-scoped** | `my_user_id()` / `exists(... auth_user_id = auth.uid())` | `users` (self), `curricula`, `classes`, `notifications`, lesson bundles, handouts, bookings, test assignments |
| **Public-read content** | `using(true)` read for authenticated; writes traverse `subunit→unit→curriculum.teacher_id = my_user_id()` | `curricula`, `units`, `subunits`, `videos`, `articles`, `quizzes`, `questions`, `attention_checks`, … |
| **Class/teacher scoping** | `is_enrolled(class_id)` for students, `is_my_class(class_id)` for teachers | `assignments`, `live_sessions`, `student_enrollments` |
| **Personal student records** | Student full-CRUD-own; teacher **read-only** via `my_account_type()='teacher' AND is_my_student(student_id)` — applied uniformly by loop to **15 tables** | `student_progress`, `quiz_results`, `question_responses`, `learning_sessions`, `achievements`, … |
| **Org membership** | Read requires a `user_org_memberships` link; district admins additionally see child orgs; writes service-role only | `organizations`, `user_org_memberships` (`0044`) |
| **Fail-closed (zero-policy)** | RLS on, no policies → nobody but service role | `llm_audit_log`, `classlink_sync_tenants`, `classlink_sync_runs`, analytics rollups, `cagecard_*` (15 tables live) |
| **Explicit deny** | `for all to authenticated using(false) with check(false)` | `leads`, `email_log` |

### 8.3 Users-table privilege-escalation guard *(live-DB; not in repo — §10)*

`trg_enforce_users_privileged_columns` (BEFORE UPDATE on `users`, function `enforce_users_privileged_columns`, `search_path` pinned) — closes the classic "RLS checks the row, not the columns" hole in `users_update_self`:

- **Bypass for service role**: returns early when `my_user_id()` is null (service role has no `auth.uid()`), so Stripe sync and admin jobs work untouched.
- **Hard-blocked columns for authenticated users** (17): `role`, `subscription_status`, `subscription_tier`, `subscription_id`, `tier`, `tier_started_at`, `trial_end_date`, `grace_period_end_date`, `last_subscription_update`, `founding_member`, `classlink_tenant_id`, `classlink_login_id`, `classlink_sourced_id`, `classlink_disabled`, `student_generations_used`.
- **Conditionally allowed**: `account_type` may only transition NULL→(`teacher`|`student`) once (onboarding); `new_role` only to `teacher`|`tutor`.
- Violations raise `42501 permission denied: cannot modify protected column <name>` — live-tested with a real authenticated JWT (self-upgrade to premium fails at the DB).
- Backed in-repo by CHECK constraints on `account_type` / `new_role` / `tier` (`0007`, `0046`).

### 8.4 PII-leak prevention: `strip_created_by` *(live-DB; not in repo — §10)*

Legacy `created_by` columns held author **emails** on world-readable content tables. A `strip_created_by()` trigger on all 28 tables with the column (live-verified) nulls it on insert/update; historical values were nulled. Ownership uses `created_by_id` only.

### 8.5 `SECURITY DEFINER` helper functions (44 live)

All are `SET search_path` pinned (search-path-hijack defense) and **self-gating** — each internally re-derives identity from `auth.uid()`, so calling them via `/rest/v1/rpc/` with arbitrary arguments returns nothing you don't own. (This is why Supabase advisor WARNs about anon/authenticated-executable DEFINER functions are lint noise here, not exploitable — each was reviewed in the 2026-07-08 re-audit.)

- Identity: `my_user_id()`, `my_account_type()`.
- Ownership gates: `is_my_curriculum`, `is_my_class`, `is_enrolled`, `is_my_student`, `teacher_owns_assignment`, `teacher_owns_test_assignment`, `student_can_view_bundle`.
- Org scope: `my_membership_org_ids()`, `my_admin_org_ids()`, `is_admin_for_org`, `class_org_id` *(live-DB)*.
- Live sessions (recursion breakers): `live_session_is_teachers`, `live_session_has_participant`.
- Guarded mutators: `join_class_by_code` *(live)*; `seed_student_progress` raises unless caller is service role **or** seeding their own rows (`0050`).
- Newer helpers follow the hardened grant idiom: `revoke all ... from public;` then narrow `grant execute to authenticated` (`0030`, `0031`, `0038`, `0050`).

### 8.6 RLS recursion fixes (correctness = security)

Mutual cross-table policies caused Postgres `42P17` (infinite recursion) — fixed without widening access by routing one side through opaque DEFINER helpers: `0020` (live_sessions ↔ participants), `0030` (lesson_bundles ↔ assignments), same pattern in `0031`/`0038`; org policies (`0044`) keep membership subqueries self-scoped to avoid re-entry.

### 8.7 pg_cron posture

- Extensions (`pg_cron`, `pg_net`) installed in the `extensions` schema, not `public` (`0014`).
- **No `cron.schedule` command is ever committed** — schedules are created out-of-band via psql so the `X-Quest-Internal-Token` shared secret never lands in git (`0014`, `0026`, `0049`). Cron jobs call Edge Functions via `net.http_post` with the internal token header rather than embedding the service-role key in SQL.

### 8.8 Structural / data-integrity defenses

- **Non-enumerable IDs**: `gen_id()` produces 32-char random hex primary keys (`0001`) — no sequential-ID scraping.
- **Unique codes**: `classes.join_code UNIQUE NOT NULL`, `referral_codes.code UNIQUE`, `users.auth_user_id UNIQUE`, `users.email UNIQUE`.
- **Composite uniqueness** prevents duplicate/replayed rows (`student_enrollments(student_id, class_id)`, `test_completions(student_id, assignment_id)`, etc.); **partial-unique roster keys** make ClassLink sync idempotent per tenant (`0044`, `0049`).
- **CHECK constraints** as domain guards throughout (roles, tiers, statuses, booking time sanity).
- **Soft-delete/archive** over hard delete (`organizations.status`, `lesson_bundles.is_archived`, `email_log.cancelled_at`).
- `set_updated_date()` triggers give tamper-evident modification timestamps.

### 8.9 Shared-database caveat

The Supabase project also hosts an unrelated legacy app's tables (`cagecard_cards`, `cagecard_experiments` — lab cage-card data). They were world-readable until 2026-07-05; now RLS-enabled with zero policies (**fail-closed**). Any legacy client of that app using the anon key is intentionally broken.

---

## 9. Secrets Management

- **Zero hardcoded secrets** in the repo — greps for `sk-…`, `whsec_…`, `AIza…` across functions return nothing. The only literals are documented non-secret Stripe price/product IDs (fallbacks in `getStripePrices`).
- All server secrets via `Deno.env` (Supabase function secrets): `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `QUEST_INTERNAL_TOKEN`, `CRON_SHARED_SECRET`, `CLASSLINK_CLIENT_SECRET`, `CLASSLINK_ROSTER_API_KEY`, `YOUTUBE_API_KEY`, `TRANSCRIPTAPI_KEY`, `COMMON_STANDARDS_API_KEY`.
- **Supabase Vault** used as fallback storage for the roster-sync internal token (service-role-only `get_vault_secret` RPC).
- Client bundle exposure limited by Vite's `VITE_` prefix to exactly: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable, RLS-protected by design), `VITE_APP_URL`.
- `.gitignore` covers `.env`, `.env.*`, `*.pem/key/p12/pfx`, `.vercel`, `.claude/`; `.env.example` documents which keys are client-safe vs server-only, rotation guidance, and test-vs-live Stripe key hygiene.
- The one server script (`server/scripts/import.js`) runs locally with `--env-file=.env` and is the only non-edge consumer of `DATABASE_URL` / service-role key.

---

## 10. Repo vs Live-Database Drift

⚠️ **Important for disaster recovery and environment rebuilds.** Several production security controls (applied 2026-07-05 via the Management API) exist **only in the live database** and are absent from `supabase/migrations/`:

| Live-only object | Purpose | Live-verified |
|---|---|---|
| `trg_enforce_users_privileged_columns` + `enforce_users_privileged_columns()` | Blocks client-side privilege/tier escalation (§8.3) | ✅ 2026-07-09 |
| `strip_created_by()` + 28 `trg_strip_created_by*` triggers | Nulls author emails on content tables (§8.4) | ✅ 2026-07-09 |
| `my_membership_org_ids()`, `my_admin_org_ids()`, `get_admin_*`, `get_sync_*`, `join_class_by_code`, `ensure_student_progress`, `class_org_id`, org RLS rewrites | Org scoping + recursion-safe helpers | ✅ (44 DEFINER fns live vs ~15 in repo) |
| RLS enablement on `cagecard_*` tables | Fail-closed lockdown of foreign app data | ✅ (advisor INFO: zero-policy) |

**Consequence:** replaying repo migrations onto a fresh database would produce a schema **missing the privilege-escalation guard and the PII-strip triggers** — i.e., it would resurrect the two most serious fixed vulnerabilities. **Recommended action: export these live objects into a new committed migration** so git is the single source of truth. (Precedent exists: `0038`'s header already notes "applied to prod via the Management API; recorded here for parity".)

---

## 11. Audit Logging & Monitoring

- **`llm_audit_log`** (`0004`) — append-only, service-role-write-only (zero user policies). Backs both the per-user daily quota and the global token circuit breaker; `total_tokens` is a stored generated column; indexed for the daily-window queries.
- **`email_log`** (`0013`) — full drip/transactional email audit (delivery IDs, opens, bounces, soft-cancels); deny-all to authenticated.
- **`classlink_sync_runs`** (`0049`) — per-tenant roster-sync observability (entity counts, errors truncated to 2000 chars); fail-closed; per-tenant isolation so one district's failure doesn't block others.
- **Correlation IDs** — `safeErrorResponse()` logs every masked error with a `crypto.randomUUID()` so server logs can be joined to user reports without leaking internals.
- **Supabase advisors** — security lints reviewed 2026-07-09: no ERROR-level findings; WARNs are the reviewed DEFINER-function lints (self-gating, §8.5) plus leaked-password protection (§13); INFO items are the intentional fail-closed zero-policy tables.

---

## 12. Supply Chain & CI

- **Dependabot** (`.github/dependabot.yml`) — weekly grouped npm updates, immediate processing of security advisories, plus `github-actions` ecosystem updates.
- ESLint + typecheck + Vitest scripts in `package.json`; unit tests cover class-list/progress-seeding logic.
- Gaps: no SAST/secret-scanning CI workflow, no dedicated security tests (§13).

---

## 13. Known Gaps & Accepted Risks

Tracked open items (2026-07-08 re-audit, re-confirmed against this scan). These are the honest edges of the stack:

**High**
- `publicTryFunnel` — unauthenticated LLM path bypasses `guardLLMRequest`/`logLLMUsage`: no per-user quota (impossible anonymously) and **outside the global 10M-token/day breaker**. Mitigations present: 20/min per-IP limit, 6000-char prompt cap, cheap model only. Residual risk: in-memory limiter resets on cold start and doesn't aggregate across IPs — OpenAI bill-drain surface. *Fix direction: DB-backed IP quota + include in global breaker.*

**Medium**
- `liveSessionSocratic` — session `code` interpolated into a PostgREST `.or()` filter with only trim/uppercase (no length/charset cap) (`liveSessionSocratic/index.ts:214-223`); also an anonymous LLM path outside the global breaker (gated by needing a valid open session code).
- Rate limiting is in-memory per isolate (cold-start reset, no cross-instance aggregation) — adequate as friction, not as a hard guarantee; the DB-backed LLM quotas are the durable layer.

**Low / accepted**
- CSP `script-src` retains `'unsafe-inline'` and `'unsafe-eval'` (Vite/Stripe/Navattic compatibility).
- JWTs in `localStorage` instead of HttpOnly cookies (documented tradeoff, §4.1).
- Production source maps enabled (`vite.config.js:15-18`) — deliberate, for readable production stack traces; exposes readable source (not secrets).
- Supabase Auth **leaked-password protection (HaveIBeenPwned check) disabled** — one-toggle fix in the dashboard (advisor WARN, still open 2026-07-09).
- `stripePortal` return URL derived from request origin (constrained by the CORS allowlist); `captureLead` stores unvalidated `quizPayload` jsonb (size-capped).
- `sendWelcomeEmail` can address arbitrary recipient emails (JWT + 10/min/user limited).
- No `stripe_webhook_events` idempotency table — webhook replay dedup relies on Stripe-side semantics + idempotent handlers.
- No SAST/secret-scanning in CI; no security-focused automated tests.
- **Repo/live drift (§10)** — highest-leverage housekeeping item.

**Dead code worth removing (not live vulnerabilities):** client-side `subscription_tier='premium'` write in `TeacherDashboard.jsx` — now dead (DB trigger rejects it); flagged in re-audit as false-alarm-but-cleanup.

---

## Appendix A — Live Production Verification (2026-07-09)

Queried directly against production Supabase `lgymrkodypbqghyjocxg`:

| Check | Result |
|---|---|
| `trg_enforce_users_privileged_columns` present & enabled | ✅ 1 (BEFORE UPDATE on `users`) |
| `trg_strip_created_by*` triggers enabled | ✅ 28 tables |
| Tables in `public` with RLS **enabled** | ✅ 72 / 72 (zero disabled) |
| RLS policies in `public` | 120 |
| `SECURITY DEFINER` functions | 44 (all reviewed as self-gating) |
| `enforce_users_privileged_columns()` definition | Confirmed: `search_path` pinned; service-role bypass via `my_user_id() IS NULL`; 17 columns hard-blocked; `account_type`/`new_role` conditionally constrained |
| Supabase security advisors | 0 ERROR; WARNs = 45 reviewed DEFINER-function lints + leaked-password protection off; 15 INFO = intentional fail-closed zero-policy tables |

Prior live exploit test (2026-07-08 re-audit): authenticated-JWT `UPDATE users SET subscription_tier='premium'` → `permission denied: cannot modify protected column subscription_tier`. Self-upgrade is dead at the database layer.

---

*Document generated 2026-07-09 from repo commit `7078e80` + live production verification. Update after any security-relevant migration, Edge Function change, or header change in `vercel.json`.*
