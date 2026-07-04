// deno-lint-ignore-file no-explicit-any
//
// rosterSync engine — pulls OneRoster v1.1 data through the ClassLink proxy
// and upserts it into Quest's tables, per tenant, in dependency order:
//
//   orgs → academicSessions → users → classes → enrollments
//
// Everything here is idempotent: running the same feed twice produces zero
// changes. Delta cursors (per-entity dateLastModified high-water marks) only
// advance after that entity's pass completes, and are set to run-start minus
// a 15-minute overlap window — re-processing an overlap is harmless because
// upserts compare before writing.
//
// PII discipline: this module never logs names, emails, or tokens — only
// sourcedIds and counts.
//
// User provisioning strategy (the subtle part — see handle_new_auth_user in
// migration 0003 and the matching logic in classlinkSso/index.ts):
//   - We match existing Quest users with the SAME precedence as SSO:
//     (tenant+sourcedId) → (tenant+username) → email.
//   - New users are created through the auth admin API (same path SSO uses),
//     which fires handle_new_auth_user to seed public.users; we then backfill
//     the ClassLink identifiers + account_type onto that row. A later SSO
//     login therefore resolves to this exact row on its first precedence
//     check — no duplicate accounts.
//   - Deactivation = a ban on the auth user (blocks OTP/magic-link and thus
//     SSO) + users.classlink_disabled so re-enabling is cheap.

import {
  composeClassLabel,
  generateJoinCode,
  mapClass,
  mapEnrollment,
  mapOrg,
  mapSession,
  mapUser,
  MappedUser,
} from './mapping.ts';
import { OneRosterClient } from '../_shared/oneroster.ts';

const BAN_FOREVER = '876000h'; // ~100 years; lifted with 'none'
const CURSOR_OVERLAP_MS = 15 * 60 * 1000;

export interface TenantRow {
  id: string;
  oneroster_application_id: string;
  classlink_tenant_id: string | null;
  data_base_url: string | null;
  delta_cursors: Record<string, string>;
}

export interface EngineOpts {
  admin: any; // service-role SupabaseClient
  client: OneRosterClient;
  log?: (msg: string) => void;
}

type Counts = Record<string, { fetched: number; created: number; updated: number; archived: number; skipped: number }>;

function newCounts(): Counts {
  const mk = () => ({ fetched: 0, created: 0, updated: 0, archived: 0, skipped: 0 });
  return { orgs: mk(), academicSessions: mk(), users: mk(), classes: mk(), enrollments: mk() };
}

function chunk<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function throwing<T>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message ?? String(error));
  return data;
}

// ---------------------------------------------------------------------------

export async function syncTenant(
  opts: EngineOpts,
  tenant: TenantRow,
  mode: 'full' | 'delta',
): Promise<Counts> {
  const { admin, client } = opts;
  const log = opts.log ?? ((m: string) => console.log(`[rosterSync] ${m}`));
  const counts = newCounts();
  const runStart = Date.now();
  const tenantKey = tenant.classlink_tenant_id ?? tenant.oneroster_application_id;

  // Resolve (and persist) the data base URL once per tenant.
  let baseUrl = tenant.data_base_url;
  if (!baseUrl) {
    baseUrl = await client.resolveDataBaseUrl(tenant.oneroster_application_id);
    await throwing(
      admin.from('classlink_sync_tenants').update({ data_base_url: baseUrl }).eq('id', tenant.id),
    );
  }

  const cursors: Record<string, string> = mode === 'delta' ? { ...(tenant.delta_cursors ?? {}) } : {};
  const since = (entity: string) => (mode === 'delta' ? cursors[entity] ?? null : null);
  const advanceCursor = async (entity: string) => {
    cursors[entity] = new Date(runStart - CURSOR_OVERLAP_MS).toISOString();
    await throwing(
      admin.from('classlink_sync_tenants').update({ delta_cursors: cursors }).eq('id', tenant.id),
    );
  };

  // ------------------------------------------------------------------
  // 1. orgs
  // ------------------------------------------------------------------
  {
    const raw = await client.fetchAll(baseUrl, 'orgs', since('orgs'));
    counts.orgs.fetched = raw.length;
    const orgs = raw.map(mapOrg).filter(Boolean) as NonNullable<ReturnType<typeof mapOrg>>[];
    counts.orgs.skipped = raw.length - orgs.length;

    for (const batch of chunk(orgs)) {
      const ids = batch.map((o) => o.sourcedId);
      const existing = await throwing<any[]>(
        admin.from('organizations')
          .select('id, classlink_org_sourced_id, name, type, status, parent_org_id')
          .eq('classlink_tenant_id', tenantKey)
          .in('classlink_org_sourced_id', ids),
      );
      const byId = new Map(existing.map((r) => [r.classlink_org_sourced_id, r]));

      for (const o of batch) {
        const row = byId.get(o.sourcedId);
        const status = o.deleted ? 'archived' : 'active';
        if (!row) {
          if (o.deleted) { counts.orgs.skipped++; continue; }
          await throwing(admin.from('organizations').insert({
            classlink_tenant_id: tenantKey,
            classlink_org_sourced_id: o.sourcedId,
            name: o.name,
            type: o.type,
            status,
          }));
          counts.orgs.created++;
        } else if (row.name !== o.name || row.type !== o.type || row.status !== status) {
          await throwing(admin.from('organizations')
            .update({ name: o.name, type: o.type, status }).eq('id', row.id));
          o.deleted ? counts.orgs.archived++ : counts.orgs.updated++;
        }
      }
    }

    // Second pass: resolve parent pointers (parents may arrive after
    // children in the feed, or already exist in the DB on delta runs).
    const withParent = orgs.filter((o) => o.parentSourcedId && !o.deleted);
    for (const batch of chunk(withParent)) {
      const parentIds = [...new Set(batch.map((o) => o.parentSourcedId!))];
      const parents = await throwing<any[]>(
        admin.from('organizations').select('id, classlink_org_sourced_id')
          .eq('classlink_tenant_id', tenantKey)
          .in('classlink_org_sourced_id', parentIds),
      );
      const parentMap = new Map(parents.map((p) => [p.classlink_org_sourced_id, p.id]));
      for (const o of batch) {
        const parentId = parentMap.get(o.parentSourcedId!);
        if (!parentId) continue;
        // NB: no .neq() guard here — `parent_org_id != x` is NULL (not true)
        // for rows whose parent is still NULL, which silently excludes
        // exactly the rows that need linking. The write is idempotent.
        await throwing(admin.from('organizations')
          .update({ parent_org_id: parentId })
          .eq('classlink_tenant_id', tenantKey)
          .eq('classlink_org_sourced_id', o.sourcedId));
      }
    }
    await advanceCursor('orgs');
    log(`orgs: ${JSON.stringify(counts.orgs)}`);
  }

  // ------------------------------------------------------------------
  // 2. academic sessions
  // ------------------------------------------------------------------
  {
    const raw = await client.fetchAll(baseUrl, 'academicSessions', since('academicSessions'));
    counts.academicSessions.fetched = raw.length;
    const sessions = raw.map(mapSession).filter(Boolean) as NonNullable<ReturnType<typeof mapSession>>[];
    counts.academicSessions.skipped = raw.length - sessions.length;

    for (const batch of chunk(sessions)) {
      const ids = batch.map((s) => s.sourcedId);
      const existing = await throwing<any[]>(
        admin.from('academic_sessions').select('*')
          .eq('classlink_tenant_id', tenantKey)
          .in('classlink_sourced_id', ids),
      );
      const byId = new Map(existing.map((r) => [r.classlink_sourced_id, r]));
      for (const s of batch) {
        const row = byId.get(s.sourcedId);
        const patch = {
          type: s.type, title: s.title, start_date: s.startDate, end_date: s.endDate,
          school_year: s.schoolYear, parent_sourced_id: s.parentSourcedId,
          status: s.deleted ? 'archived' : 'active',
        };
        if (!row) {
          if (s.deleted) { counts.academicSessions.skipped++; continue; }
          await throwing(admin.from('academic_sessions').insert({
            classlink_tenant_id: tenantKey, classlink_sourced_id: s.sourcedId, ...patch,
          }));
          counts.academicSessions.created++;
        } else {
          const changed = Object.entries(patch).some(([k, v]) => (row[k] ?? null) !== (v ?? null));
          if (changed) {
            await throwing(admin.from('academic_sessions').update(patch).eq('id', row.id));
            s.deleted ? counts.academicSessions.archived++ : counts.academicSessions.updated++;
          }
        }
      }
    }
    await advanceCursor('academicSessions');
    log(`academicSessions: ${JSON.stringify(counts.academicSessions)}`);
  }

  // ------------------------------------------------------------------
  // 3. users
  // ------------------------------------------------------------------
  {
    const raw = await client.fetchAll(baseUrl, 'users', since('users'));
    counts.users.fetched = raw.length;

    for (const r of raw) {
      const { user, skip } = mapUser(r);
      if (!user) { counts.users.skipped++; if (skip !== 'unmapped_role') log(`user skipped: ${skip} (${String(r?.sourcedId ?? '?')})`); continue; }
      try {
        const outcome = await upsertUser(admin, tenantKey, user);
        counts.users[outcome]++;
      } catch (e) {
        counts.users.skipped++;
        log(`user upsert failed for sourcedId=${user.sourcedId}: ${(e as Error).message}`);
      }
    }
    await advanceCursor('users');
    log(`users: ${JSON.stringify(counts.users)}`);
  }

  // ------------------------------------------------------------------
  // 4. classes
  // ------------------------------------------------------------------
  {
    const raw = await client.fetchAll(baseUrl, 'classes', since('classes'));
    counts.classes.fetched = raw.length;

    for (const r of raw) {
      const { cls, skip } = mapClass(r);
      if (!cls) { counts.classes.skipped++; if (skip !== 'homeroom') log(`class skipped: ${skip}`); continue; }

      const existing = await throwing<any[]>(
        admin.from('classes')
          .select('id, class_name, status, org_id, roster_title, roster_location, roster_periods, grade_levels, term_sourced_ids')
          .eq('classlink_tenant_id', tenantKey)
          .eq('classlink_sourced_id', cls.sourcedId).limit(1),
      );
      const row = existing[0];

      let orgId: string | null = null;
      if (cls.schoolSourcedId) {
        const orgRows = await throwing<any[]>(
          admin.from('organizations').select('id')
            .eq('classlink_tenant_id', tenantKey)
            .eq('classlink_org_sourced_id', cls.schoolSourcedId).limit(1),
        );
        orgId = orgRows[0]?.id ?? null;
      }

      const newLabel = composeClassLabel(cls.title, cls.location, cls.periods);

      if (!row) {
        if (cls.deleted) { counts.classes.skipped++; continue; }
        // join_code collides ~never (36^6 space), but retry to be safe.
        let inserted = false;
        for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
          const { error } = await admin.from('classes').insert({
            classlink_tenant_id: tenantKey,
            classlink_sourced_id: cls.sourcedId,
            class_name: newLabel,
            roster_title: cls.title,
            roster_location: cls.location,
            roster_periods: cls.periods,
            managed_by: 'classlink',
            status: 'pending_instructor',
            join_code: generateJoinCode(),
            org_id: orgId,
            grade_levels: cls.grades,
            term_sourced_ids: cls.termSourcedIds.length ? cls.termSourcedIds : null,
            teacher_id: null,
            curriculum_id: null,
          });
          if (!error) inserted = true;
          else if (!/join_code|duplicate/i.test(error.message ?? '')) throw new Error(error.message);
        }
        if (!inserted) throw new Error('join_code collision retries exhausted');
        counts.classes.created++;
      } else {
        const patch: any = {
          roster_title: cls.title,
          roster_location: cls.location,
          roster_periods: cls.periods,
          org_id: orgId ?? row.org_id,
          grade_levels: cls.grades ?? row.grade_levels,
          term_sourced_ids: cls.termSourcedIds.length ? cls.termSourcedIds : row.term_sourced_ids,
        };
        // Only rewrite the display name if the teacher hasn't renamed it:
        // i.e. class_name still equals the label composed from the OLD
        // roster fields.
        const oldLabel = composeClassLabel(
          row.roster_title ?? '', row.roster_location, row.roster_periods,
        );
        if (row.class_name === oldLabel && newLabel !== row.class_name) {
          patch.class_name = newLabel;
        }
        if (cls.deleted && row.status !== 'archived') patch.status = 'archived';
        // Write (and count) only when something actually differs — re-running
        // an identical feed must report zero updates.
        const changed = Object.entries(patch).some(
          ([k, v]) => JSON.stringify(row[k] ?? null) !== JSON.stringify(v ?? null),
        );
        if (changed) {
          await throwing(admin.from('classes').update(patch).eq('id', row.id));
          cls.deleted ? counts.classes.archived++ : counts.classes.updated++;
        } else {
          counts.classes.skipped++;
        }
      }
    }
    await advanceCursor('classes');
    log(`classes: ${JSON.stringify(counts.classes)}`);
  }

  // ------------------------------------------------------------------
  // 5. enrollments
  // ------------------------------------------------------------------
  {
    const raw = await client.fetchAll(baseUrl, 'enrollments', since('enrollments'));
    counts.enrollments.fetched = raw.length;

    for (const r of raw) {
      const { enr, skip } = mapEnrollment(r);
      if (!enr) { counts.enrollments.skipped++; if (skip !== 'unmapped_enrollment_role') log(`enrollment skipped: ${skip}`); continue; }
      try {
        const outcome = await upsertEnrollment(admin, tenantKey, enr);
        counts.enrollments[outcome]++;
      } catch (e) {
        counts.enrollments.skipped++;
        log(`enrollment upsert failed for sourcedId=${enr.sourcedId}: ${(e as Error).message}`);
      }
    }
    await advanceCursor('enrollments');
    log(`enrollments: ${JSON.stringify(counts.enrollments)}`);
  }

  // ------------------------------------------------------------------
  // 6. term-end archival (full runs): archive classlink-managed active
  // classes whose every term has ended.
  // ------------------------------------------------------------------
  if (mode === 'full') {
    const today = new Date(runStart).toISOString().slice(0, 10);
    const sessions = await throwing<any[]>(
      admin.from('academic_sessions').select('classlink_sourced_id, end_date')
        .eq('classlink_tenant_id', tenantKey),
    );
    const endBy = new Map(sessions.map((s) => [s.classlink_sourced_id, s.end_date]));
    const active = await throwing<any[]>(
      admin.from('classes').select('id, term_sourced_ids')
        .eq('classlink_tenant_id', tenantKey)
        .eq('managed_by', 'classlink')
        .neq('status', 'archived')
        .not('term_sourced_ids', 'is', null),
    );
    for (const c of active) {
      const ends = (c.term_sourced_ids as string[]).map((t) => endBy.get(t)).filter(Boolean) as string[];
      if (ends.length && ends.every((d) => d < today)) {
        await throwing(admin.from('classes').update({ status: 'archived' }).eq('id', c.id));
        counts.classes.archived++;
      }
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// user upsert — SSO-compatible matching + provisioning
// ---------------------------------------------------------------------------

const USER_SELECT =
  'id, email, auth_user_id, account_type, full_name, classlink_tenant_id, classlink_sourced_id, classlink_login_id, classlink_disabled';

async function findUser(admin: any, tenantKey: string, u: MappedUser): Promise<any | null> {
  // Same precedence as classlinkSso: (tenant+sourcedId) → (tenant+username) → email.
  let rows = await throwing<any[]>(
    admin.from('users').select(USER_SELECT)
      .eq('classlink_tenant_id', tenantKey)
      .eq('classlink_sourced_id', u.sourcedId).limit(1),
  );
  if (rows[0]) return rows[0];
  if (u.username) {
    rows = await throwing<any[]>(
      admin.from('users').select(USER_SELECT)
        .eq('classlink_tenant_id', tenantKey)
        .eq('classlink_login_id', u.username).limit(1),
    );
    if (rows[0]) return rows[0];
  }
  if (u.email) {
    rows = await throwing<any[]>(
      admin.from('users').select(USER_SELECT).eq('email', u.email).limit(1),
    );
    if (rows[0]) return rows[0];
  }
  return null;
}

async function setBanned(admin: any, authUserId: string, banned: boolean) {
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    ban_duration: banned ? BAN_FOREVER : 'none',
  });
  if (error) throw new Error(error.message);
}

async function upsertUser(
  admin: any,
  tenantKey: string,
  u: MappedUser,
): Promise<'created' | 'updated' | 'archived' | 'skipped'> {
  let existing = await findUser(admin, tenantKey, u);

  // Deactivations: ban the auth account; nothing else changes. Unknown
  // deleted users are ignored (nothing to deactivate).
  if (u.deleted || !u.enabled) {
    if (!existing) return 'skipped';
    if (!existing.classlink_disabled) {
      if (existing.auth_user_id) await setBanned(admin, existing.auth_user_id, true);
      await throwing(admin.from('users').update({ classlink_disabled: true }).eq('id', existing.id));
      return 'archived';
    }
    return 'skipped';
  }

  if (!existing) {
    // Provision through the auth admin API so handle_new_auth_user seeds
    // public.users — the same creation path SSO uses.
    const { error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      email_confirm: true,
      user_metadata: {
        full_name: u.fullName,
        sso_provider: 'classlink',
        classlink_login_id: u.username || undefined,
        classlink_tenant_id: tenantKey,
        classlink_sourced_id: u.sourcedId,
      },
    });
    if (createErr && !/already/i.test(createErr.message ?? '')) {
      throw new Error(createErr.message);
    }
    const rows = await throwing<any[]>(
      admin.from('users').select(USER_SELECT).eq('email', u.email).limit(1),
    );
    existing = rows[0];
    if (!existing) throw new Error('provisioned auth user but public.users row not found');

    await throwing(admin.from('users').update({
      classlink_tenant_id: tenantKey,
      classlink_sourced_id: u.sourcedId,
      classlink_login_id: u.username || null,
      account_type: existing.account_type ?? u.accountType,
      full_name: existing.full_name || u.fullName,
    }).eq('id', existing.id));

    await syncMemberships(admin, tenantKey, existing.id, u);
    return 'created';
  }

  // Existing user: backfill identifiers, never override choices made in
  // Quest (mirrors the SSO backfill rules), lift roster bans if re-enabled.
  const patch: Record<string, unknown> = {};
  if (!existing.classlink_tenant_id) patch.classlink_tenant_id = tenantKey;
  if (!existing.classlink_sourced_id) patch.classlink_sourced_id = u.sourcedId;
  if (!existing.classlink_login_id && u.username) patch.classlink_login_id = u.username;
  if (!existing.account_type) patch.account_type = u.accountType;
  if (!existing.full_name && u.fullName) patch.full_name = u.fullName;
  if (existing.classlink_disabled) {
    patch.classlink_disabled = false;
    if (existing.auth_user_id) await setBanned(admin, existing.auth_user_id, false);
  }
  const changed = Object.keys(patch).length > 0;
  if (changed) {
    await throwing(admin.from('users').update(patch).eq('id', existing.id));
  }
  const membershipsChanged = await syncMemberships(admin, tenantKey, existing.id, u);
  return changed || membershipsChanged ? 'updated' : 'skipped';
}

async function syncMemberships(
  admin: any,
  tenantKey: string,
  userId: string,
  u: MappedUser,
): Promise<boolean> {
  if (!u.orgSourcedIds.length) return false;
  const orgs = await throwing<any[]>(
    admin.from('organizations').select('id')
      .eq('classlink_tenant_id', tenantKey)
      .in('classlink_org_sourced_id', u.orgSourcedIds),
  );
  if (!orgs.length) return false;
  const existing = await throwing<any[]>(
    admin.from('user_org_memberships').select('org_id, primary_org').eq('user_id', userId),
  );
  const have = new Set(existing.map((m) => m.org_id));
  const hasPrimary = existing.some((m) => m.primary_org);
  let changed = false;
  for (let i = 0; i < orgs.length; i++) {
    if (have.has(orgs[i].id)) continue;
    await throwing(admin.from('user_org_memberships').insert({
      user_id: userId,
      org_id: orgs[i].id,
      role: u.accountType,
      primary_org: !hasPrimary && i === 0,
    }));
    changed = true;
  }
  return changed;
}

// ---------------------------------------------------------------------------
// enrollment upsert
// ---------------------------------------------------------------------------

async function lookupClass(admin: any, tenantKey: string, sourcedId: string) {
  const rows = await throwing<any[]>(
    admin.from('classes').select('id, status, teacher_id, managed_by')
      .eq('classlink_tenant_id', tenantKey)
      .eq('classlink_sourced_id', sourcedId).limit(1),
  );
  return rows[0] ?? null;
}

async function lookupUser(admin: any, tenantKey: string, sourcedId: string) {
  const rows = await throwing<any[]>(
    admin.from('users').select('id, full_name, email')
      .eq('classlink_tenant_id', tenantKey)
      .eq('classlink_sourced_id', sourcedId).limit(1),
  );
  return rows[0] ?? null;
}

async function upsertEnrollment(
  admin: any,
  tenantKey: string,
  enr: import('./mapping.ts').MappedEnrollment,
): Promise<'created' | 'updated' | 'archived' | 'skipped'> {
  if (enr.kind === 'student') {
    if (enr.deleted) {
      const { data, error } = await admin.from('student_enrollments').delete()
        .eq('classlink_tenant_id', tenantKey)
        .eq('classlink_sourced_id', enr.sourcedId)
        .select('id');
      if (error) throw new Error(error.message);
      return data?.length ? 'archived' : 'skipped';
    }
    const existing = await throwing<any[]>(
      admin.from('student_enrollments').select('id')
        .eq('classlink_tenant_id', tenantKey)
        .eq('classlink_sourced_id', enr.sourcedId).limit(1),
    );
    if (existing[0]) return 'skipped'; // student+class are immutable per sourcedId
    const cls = await lookupClass(admin, tenantKey, enr.classSourcedId);
    const user = await lookupUser(admin, tenantKey, enr.userSourcedId);
    if (!cls || !user) throw new Error('enrollment references unknown class or user');
    // unique (student_id, class_id) also guards against a manually-joined
    // student re-arriving via roster: attach roster identity to that row.
    const { error } = await admin.from('student_enrollments').insert({
      student_id: user.id,
      class_id: cls.id,
      student_full_name: user.full_name,
      student_email: user.email,
      classlink_tenant_id: tenantKey,
      classlink_sourced_id: enr.sourcedId,
    });
    if (error) {
      if (/duplicate|unique/i.test(error.message ?? '')) {
        await throwing(admin.from('student_enrollments').update({
          classlink_tenant_id: tenantKey,
          classlink_sourced_id: enr.sourcedId,
        }).eq('student_id', user.id).eq('class_id', cls.id));
        return 'updated';
      }
      throw new Error(error.message);
    }
    return 'created';
  }

  // ---- teacher enrollments → class_teachers -------------------------------
  if (enr.deleted) {
    const { data, error } = await admin.from('class_teachers').delete()
      .eq('classlink_tenant_id', tenantKey)
      .eq('classlink_sourced_id', enr.sourcedId)
      .select('class_id, teacher_id');
    if (error) throw new Error(error.message);
    const removed = data?.[0];
    if (!removed) return 'skipped';
    // If the removed teacher was the denormalized primary, promote another
    // teacher; with none left, roster-managed classes go back to pending.
    const cls = await throwing<any[]>(
      admin.from('classes').select('id, teacher_id, managed_by, status')
        .eq('id', removed.class_id).limit(1),
    );
    if (cls[0]?.teacher_id === removed.teacher_id) {
      const remaining = await throwing<any[]>(
        admin.from('class_teachers').select('teacher_id, role')
          .eq('class_id', removed.class_id).order('role'),
      );
      const next = remaining[0]?.teacher_id ?? null;
      const patch: any = { teacher_id: next };
      if (!next && cls[0].managed_by === 'classlink') patch.status = 'pending_instructor';
      await throwing(admin.from('classes').update(patch).eq('id', removed.class_id));
    }
    return 'archived';
  }

  const cls = await lookupClass(admin, tenantKey, enr.classSourcedId);
  const user = await lookupUser(admin, tenantKey, enr.userSourcedId);
  if (!cls || !user) throw new Error('enrollment references unknown class or user');

  const role = enr.primary ? 'primary' : 'co_teacher';
  const existing = await throwing<any[]>(
    admin.from('class_teachers').select('role')
      .eq('classlink_tenant_id', tenantKey)
      .eq('classlink_sourced_id', enr.sourcedId).limit(1),
  );
  const already = existing[0];
  if (!already || already.role !== role) {
    const { error } = await admin.from('class_teachers').upsert({
      class_id: cls.id,
      teacher_id: user.id,
      role,
      classlink_tenant_id: tenantKey,
      classlink_sourced_id: enr.sourcedId,
    }, { onConflict: 'class_id,teacher_id' });
    if (error) throw new Error(error.message);
  }

  // Denormalized pointer + lifecycle: any teacher arriving on a pending
  // class activates it; the primary flag wins the teacher_id pointer.
  const patch: any = {};
  if ((enr.primary || !cls.teacher_id) && cls.teacher_id !== user.id) patch.teacher_id = user.id;
  if (cls.status === 'pending_instructor') patch.status = 'active';
  if (Object.keys(patch).length) {
    await throwing(admin.from('classes').update(patch).eq('id', cls.id));
  }
  return already ? (already.role !== role ? 'updated' : 'skipped') : 'created';
}
