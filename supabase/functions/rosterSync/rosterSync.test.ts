// deno-lint-ignore-file no-explicit-any
//
// Unit tests for the roster sync's pure logic (mapping.ts) and the
// OneRoster proxy client's pagination/retry behavior (_shared/oneroster.ts).
// Run from the repo root:
//
//   deno test supabase/functions/rosterSync/rosterSync.test.ts
//
// The full-pipeline fixture mode (index.ts, body {"fixtures":"full"}) covers
// the DB-touching path against a local/sandbox Supabase; these tests cover
// everything that doesn't need a database.

import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  composeClassLabel,
  mapClass,
  mapEnrollment,
  mapOrg,
  mapUser,
  normalizeGrade,
  normalizeGrades,
} from './mapping.ts';
import { mapRole } from '../_shared/classlinkRole.ts';
import { OneRosterClient } from '../_shared/oneroster.ts';

// ---------------------------------------------------------------------------
// grades
// ---------------------------------------------------------------------------

Deno.test('normalizeGrade maps OneRoster codes into the 0047 vocabulary', () => {
  assertEquals(normalizeGrade('KG'), 'K');
  assertEquals(normalizeGrade('K'), 'K');
  assertEquals(normalizeGrade('PK'), 'PK');
  assertEquals(normalizeGrade('01'), '1');
  assertEquals(normalizeGrade('09'), '9');
  assertEquals(normalizeGrade('10'), '10');
  assertEquals(normalizeGrade('12'), '12');
  assertEquals(normalizeGrade('UG'), 'Undergraduate');
  assertEquals(normalizeGrade('Other'), null);
  assertEquals(normalizeGrade(''), null);
});

Deno.test('normalizeGrades dedupes, drops unknowns, handles CSV strings', () => {
  assertEquals(normalizeGrades(['09', '9', '10', 'Other']), ['9', '10']);
  assertEquals(normalizeGrades('09,10'), ['9', '10']);
  assertEquals(normalizeGrades([]), null);
});

// ---------------------------------------------------------------------------
// class label
// ---------------------------------------------------------------------------

Deno.test('composeClassLabel folds location and periods into the display name', () => {
  assertEquals(composeClassLabel('Biology 1', 'Rm 204', '3'), 'Biology 1 — Rm 204 — P3');
  assertEquals(composeClassLabel('Biology 1', null, null), 'Biology 1');
  assertEquals(composeClassLabel('Biology 1', 'Rm 204', null), 'Biology 1 — Rm 204');
  assertEquals(composeClassLabel('Biology 1', null, '3/4'), 'Biology 1 — P3/4');
});

// ---------------------------------------------------------------------------
// role mapping (shared with SSO)
// ---------------------------------------------------------------------------

Deno.test('mapRole matches the SSO semantics', () => {
  assertEquals(mapRole('student'), 'student');
  assertEquals(mapRole('teacher'), 'teacher');
  assertEquals(mapRole('administrator'), 'district_admin');
  assertEquals(mapRole('districtAdministrator'), 'district_admin');
  assertEquals(mapRole('guardian'), null);
  assertEquals(mapRole('parent'), null);
  assertEquals(mapRole('aide'), null);
  assertEquals(mapRole('proctor'), null);
});

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

Deno.test('mapUser provisions students/teachers and skips guardians + missing email', () => {
  const ok = mapUser({
    sourcedId: 'u1', status: 'active', enabledUser: 'true', role: 'teacher',
    username: 'jdoe', givenName: 'Jane', familyName: 'Doe',
    email: 'JDoe@School.EDU', orgSourcedIds: ['o1'],
  });
  assert(ok.user);
  assertEquals(ok.user!.email, 'jdoe@school.edu'); // lowercased
  assertEquals(ok.user!.fullName, 'Jane Doe');
  assertEquals(ok.user!.accountType, 'teacher');
  assertEquals(ok.user!.orgSourcedIds, ['o1']);
  assertEquals(ok.user!.enabled, true);

  assertEquals(mapUser({ sourcedId: 'u2', role: 'guardian', email: 'x@y.z' }).skip, 'unmapped_role');
  assertEquals(mapUser({ sourcedId: 'u3', role: 'student' }).skip, 'missing_email');
});

Deno.test('mapUser: tobedeleted users pass through even without email (for deactivation)', () => {
  const del = mapUser({ sourcedId: 'u4', role: 'student', status: 'tobedeleted' });
  assert(del.user);
  assertEquals(del.user!.deleted, true);
});

Deno.test('mapUser reads enabledUser=false', () => {
  const u = mapUser({
    sourcedId: 'u5', role: 'student', email: 'a@b.c', enabledUser: 'false',
  });
  assertEquals(u.user!.enabled, false);
});

// ---------------------------------------------------------------------------
// classes
// ---------------------------------------------------------------------------

Deno.test('mapClass: scheduled classes map, homerooms are skipped', () => {
  const { cls } = mapClass({
    sourcedId: 'c1', status: 'active', title: 'Biology 1', classType: 'scheduled',
    schoolSourcedId: 'o1', termSourcedIds: ['t1', 't2'],
    grades: ['09', '10'], location: 'Rm 204', periods: ['3'],
  });
  assert(cls);
  assertEquals(cls!.grades, ['9', '10']);
  assertEquals(cls!.periods, '3');
  assertEquals(cls!.termSourcedIds, ['t1', 't2']);

  assertEquals(mapClass({ sourcedId: 'c2', title: 'HR', classType: 'homeroom' }).skip, 'homeroom');
});

Deno.test('mapClass accepts GUIDRef object shapes (school/terms)', () => {
  const { cls } = mapClass({
    sourcedId: 'c3', status: 'active', title: 'Algebra', classType: 'scheduled',
    school: { sourcedId: 'o1' }, terms: [{ sourcedId: 't1' }],
  });
  assertEquals(cls!.schoolSourcedId, 'o1');
  assertEquals(cls!.termSourcedIds, ['t1']);
});

// ---------------------------------------------------------------------------
// enrollments
// ---------------------------------------------------------------------------

Deno.test('mapEnrollment: student/teacher pass, aides skip, primary parses', () => {
  const s = mapEnrollment({
    sourcedId: 'e1', status: 'active', role: 'student',
    classSourcedId: 'c1', userSourcedId: 'u1', schoolSourcedId: 'o1',
  });
  assertEquals(s.enr!.kind, 'student');

  const t = mapEnrollment({
    sourcedId: 'e2', status: 'active', role: 'teacher', primary: 'true',
    class: { sourcedId: 'c1' }, user: { sourcedId: 'u9' },
  });
  assertEquals(t.enr!.kind, 'teacher');
  assertEquals(t.enr!.primary, true);
  assertEquals(t.enr!.classSourcedId, 'c1');

  assertEquals(mapEnrollment({
    sourcedId: 'e3', role: 'aide', classSourcedId: 'c1', userSourcedId: 'u1',
  }).skip, 'unmapped_enrollment_role');
});

// ---------------------------------------------------------------------------
// orgs
// ---------------------------------------------------------------------------

Deno.test('mapOrg maps types and flags deletions', () => {
  assertEquals(mapOrg({ sourcedId: 'o1', name: 'D', type: 'district' })!.type, 'district');
  assertEquals(mapOrg({ sourcedId: 'o2', name: 'S', type: 'school' })!.type, 'school');
  assertEquals(mapOrg({ sourcedId: 'o3', name: 'X', type: 'local' })!.type, 'department');
  assertEquals(mapOrg({ sourcedId: 'o4', name: 'S', type: 'school', status: 'tobedeleted' })!.deleted, true);
  assertEquals(mapOrg({ name: 'nameless' }), null);
});

// ---------------------------------------------------------------------------
// OneRosterClient — pagination, minimization, retry
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...headers },
  });
}

Deno.test('pages() walks limit/offset until a short page and minimizes fields', async () => {
  const usersDb = [
    { sourcedId: 'u1', role: 'student', email: 'a@b.c', password: 'DROP-ME' },
    { sourcedId: 'u2', role: 'student', email: 'd@e.f', sms: 'DROP-ME' },
    { sourcedId: 'u3', role: 'student', email: 'g@h.i' },
  ];
  const seen: string[] = [];
  const client = new OneRosterClient({
    apiKey: 'k',
    pageSize: 2,
    fetchImpl: (url) => {
      const u = new URL(url);
      seen.push(`${u.searchParams.get('limit')}@${u.searchParams.get('offset')}`);
      const off = Number(u.searchParams.get('offset'));
      const lim = Number(u.searchParams.get('limit'));
      return Promise.resolve(jsonResponse({ users: usersDb.slice(off, off + lim) }));
    },
  });
  const all = await client.fetchAll('https://x/base', 'users');
  assertEquals(all.length, 3);
  assertEquals(seen, ['2@0', '2@2']);
  // minimization: Not Supported fields never leave the client
  assert(!('password' in all[0]));
  assert(!('sms' in all[1]));
  assert('email' in all[0]);
});

Deno.test('delta walks include the dateLastModified filter', async () => {
  let captured = '';
  const client = new OneRosterClient({
    apiKey: 'k',
    fetchImpl: (url) => {
      captured = url;
      return Promise.resolve(jsonResponse({ orgs: [] }));
    },
  });
  await client.fetchAll('https://x/base', 'orgs', '2026-07-01T00:00:00.000Z');
  assert(decodeURIComponent(captured).includes("filter=dateLastModified>'2026-07-01T00:00:00.000Z'"));
});

Deno.test('429 retries honoring Retry-After, then succeeds', async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const client = new OneRosterClient({
    apiKey: 'k',
    sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); },
    fetchImpl: () => {
      calls++;
      if (calls === 1) return Promise.resolve(jsonResponse({}, 429, { 'Retry-After': '2' }));
      return Promise.resolve(jsonResponse({ orgs: [{ sourcedId: 'o1', name: 'D', type: 'district' }] }));
    },
  });
  const all = await client.fetchAll('https://x/base', 'orgs');
  assertEquals(all.length, 1);
  assertEquals(calls, 2);
  assertEquals(sleeps, [2000]);
});

Deno.test('502 shrinks the page size and retries', async () => {
  let calls = 0;
  const limits: number[] = [];
  const client = new OneRosterClient({
    apiKey: 'k',
    pageSize: 400,
    sleep: () => Promise.resolve(),
    fetchImpl: (url) => {
      calls++;
      limits.push(Number(new URL(url).searchParams.get('limit')));
      if (calls === 1) return Promise.resolve(jsonResponse({}, 502));
      return Promise.resolve(jsonResponse({ orgs: [] }));
    },
  });
  await client.fetchAll('https://x/base', 'orgs');
  assertEquals(limits[0], 400);
  assertEquals(limits[1], 200); // halved after the 502
});

Deno.test('request budget throws instead of hammering the API', async () => {
  const client = new OneRosterClient({
    apiKey: 'k',
    requestBudget: 3,
    pageSize: 1,
    fetchImpl: () =>
      Promise.resolve(jsonResponse({ users: [{ sourcedId: 'u', role: 'student', email: 'a@b.c' }] })),
  });
  let threw = false;
  try {
    await client.fetchAll('https://x/base', 'users');
  } catch (e) {
    threw = true;
    assert(String(e).includes('budget'));
  }
  assert(threw);
});
