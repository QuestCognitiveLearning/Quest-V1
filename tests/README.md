# `/tests`

Unit, integration, and end-to-end tests live here. **The codebase currently
has zero tests.** This directory exists as scaffolding + intent — every new
feature added going forward should land with at least one test.

## Layout

```
/tests
├── unit/             # Pure-function tests (services, utils, hooks)
├── integration/      # Multi-module tests (auth flow, checkout flow)
├── e2e/              # Browser-driven user-journey tests (Playwright)
└── fixtures/         # Shared test data + mocks
```

## Recommended stack (not yet installed)

| Layer | Tool | Why |
|---|---|---|
| Unit + integration | **Vitest** | Native Vite integration, Jest-compatible API, fast |
| Component | **@testing-library/react** | Tests what the user sees, not implementation details |
| DOM mocking | **jsdom** | Lets Vitest exercise React components without a browser |
| E2E | **Playwright** | One tool covers Chromium / Firefox / WebKit |
| Mocking HTTP | **msw** (Mock Service Worker) | Intercepts `fetch` without monkey-patching |

## Install (when ready)

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8
```

Add to `package.json`:
```json
"scripts": {
  "test":       "vitest run",
  "test:watch": "vitest",
  "coverage":   "vitest run --coverage"
}
```

Add `vitest.config.js` at repo root pointing `test.environment` to `jsdom`
and `test.setupFiles` to `tests/setup.js` (which imports
`@testing-library/jest-dom`).

## What to test first (priority order)

1. **`src/services/auth-service.js`** — auth helpers are critical-path and
   pure-ish (mock `quest.auth.me()`). Cheapest test for highest payoff.
2. **`src/services/subscription-service.js`** — checkout URL handling.
3. **`src/lib/sessionResume.js`** — the localStorage logic is brittle; tests
   pin down the TTL + cleanup behavior.
4. **`src/lib/llmModels.js`** — guard against a typo regression (e.g. accidentally
   routing all calls to gpt-4 instead of gpt-5-mini).
5. **Pricing.jsx → Layout.jsx interaction** — the new-teacher signup flow
   has been re-broken twice. An integration test prevents a third regression.

## What NOT to test

- Pure passthrough components (just renders props).
- Tailwind classes (visual — use Playwright + screenshot diffs if you care).
- Anything that's a wrapper around supabase-js — that library is already
  tested by Supabase.

## Naming convention

```
foo.js               → tests/unit/foo.test.js
foo-bar.service.js   → tests/unit/foo-bar.service.test.js
SignIn.jsx           → tests/integration/sign-in.test.jsx
[user flow]          → tests/e2e/teacher-signup-flow.spec.js
```

## TODO

- [ ] Install Vitest + jsdom + Testing Library
- [ ] Add `vitest.config.js` with `jsdom` environment + path alias support
- [ ] Write the first 5 tests listed above
- [ ] Add CI hook so failing tests block deploys
