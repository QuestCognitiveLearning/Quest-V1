// deno-lint-ignore-file no-explicit-any
//
// Pure OneRoster → Quest mapping and normalization. No I/O — everything in
// this file is unit-tested by rosterSync.test.ts. The engine (engine.ts)
// owns all database access.
//
// Field policy comes from docs/classlink-roster-server-profile.md: only
// Required/Supported fields are read here; _shared/oneroster.ts has already
// dropped everything else at the parse boundary.

import { mapRole } from '../_shared/classlinkRole.ts';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// OneRoster v1.1 GUIDRefs appear either flattened ("classSourcedId") or as
// objects ({class: {sourcedId}}). Accept both.
export function ref(raw: any, flatKey: string, objKey: string): string {
  const flat = raw?.[flatKey];
  if (typeof flat === 'string' && flat) return flat;
  const obj = raw?.[objKey];
  if (obj && typeof obj === 'object' && obj.sourcedId) return String(obj.sourcedId);
  return '';
}

export function refList(raw: any, flatKey: string, objKey: string): string[] {
  const flat = raw?.[flatKey];
  if (Array.isArray(flat)) return flat.filter(Boolean).map(String);
  if (typeof flat === 'string' && flat) return flat.split(',').map((s) => s.trim()).filter(Boolean);
  const objs = raw?.[objKey];
  if (Array.isArray(objs)) {
    return objs.map((o) => o?.sourcedId).filter(Boolean).map(String);
  }
  return [];
}

export function isDeleted(raw: any): boolean {
  return String(raw?.status ?? '').toLowerCase() === 'tobedeleted';
}

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return String(v ?? '').toLowerCase() === 'true';
}

// ---------------------------------------------------------------------------
// grades — normalize into the vocabulary established by migration 0047
// (single-char and two-digit codes, plus Undergraduate/Graduate).
// ---------------------------------------------------------------------------

export function normalizeGrade(g: unknown): string | null {
  const s = String(g ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'KG' || s === 'K') return 'K';
  if (s === 'PK' || s === 'PR' || s === 'PS' || s === 'TK') return 'PK';
  if (s === 'UG' || s === 'UNDERGRADUATE') return 'Undergraduate';
  if (s === 'GR' || s === 'GRADUATE') return 'Graduate';
  if (/^\d{1,2}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 13) return String(n); // strip leading zero: "01" -> "1"
  }
  return null; // 'Other', 'IT', etc. — outside Quest's vocabulary, drop
}

export function normalizeGrades(list: unknown): string[] | null {
  const arr = Array.isArray(list)
    ? list
    : typeof list === 'string' && list
      ? list.split(',')
      : [];
  const out = [...new Set(arr.map(normalizeGrade).filter(Boolean))] as string[];
  return out.length ? out : null;
}

// ---------------------------------------------------------------------------
// orgs
// ---------------------------------------------------------------------------

export interface MappedOrg {
  sourcedId: string;
  name: string;
  type: 'district' | 'school' | 'department';
  parentSourcedId: string | null;
  deleted: boolean;
}

export function mapOrg(raw: any): MappedOrg | null {
  const sourcedId = String(raw?.sourcedId ?? '').trim();
  const name = String(raw?.name ?? '').trim();
  if (!sourcedId || !name) return null;
  const t = String(raw?.type ?? '').toLowerCase();
  const type = t === 'district' ? 'district' : t === 'school' ? 'school' : 'department';
  return {
    sourcedId,
    name,
    type,
    parentSourcedId: ref(raw, 'parentSourcedId', 'parent') || null,
    deleted: isDeleted(raw),
  };
}

// ---------------------------------------------------------------------------
// academic sessions
// ---------------------------------------------------------------------------

export interface MappedSession {
  sourcedId: string;
  type: string | null;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  schoolYear: string | null;
  parentSourcedId: string | null;
  deleted: boolean;
}

function asDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

export function mapSession(raw: any): MappedSession | null {
  const sourcedId = String(raw?.sourcedId ?? '').trim();
  if (!sourcedId) return null;
  return {
    sourcedId,
    type: String(raw?.type ?? '').trim() || null,
    title: String(raw?.title ?? '').trim() || null,
    startDate: asDate(raw?.startDate),
    endDate: asDate(raw?.endDate),
    schoolYear: String(raw?.schoolYear ?? '').trim() || null,
    parentSourcedId: ref(raw, 'parentSourcedId', 'parent') || null,
    deleted: isDeleted(raw),
  };
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export interface MappedUser {
  sourcedId: string;
  email: string;
  username: string;
  givenName: string;
  familyName: string;
  fullName: string;
  accountType: 'teacher' | 'student' | 'district_admin';
  orgSourcedIds: string[];
  enabled: boolean;
  deleted: boolean;
}

// Returns null when the user should be SKIPPED (unmappable role — guardians,
// parents, aides, proctors are never provisioned) and the string reason for
// observability. Users with a mappable role but missing email are also
// skipped: email is the account key (profile doc marks it Required).
export function mapUser(raw: any): { user: MappedUser | null; skip?: string } {
  const sourcedId = String(raw?.sourcedId ?? '').trim();
  if (!sourcedId) return { user: null, skip: 'missing_sourced_id' };
  const accountType = mapRole(raw?.role);
  if (!accountType) return { user: null, skip: 'unmapped_role' };
  const email = String(raw?.email ?? '').toLowerCase().trim();
  const deleted = isDeleted(raw);
  if (!email && !deleted) return { user: null, skip: 'missing_email' };
  const givenName = String(raw?.givenName ?? '').trim();
  const familyName = String(raw?.familyName ?? '').trim();
  return {
    user: {
      sourcedId,
      email,
      username: String(raw?.username ?? '').trim(),
      givenName,
      familyName,
      fullName: [givenName, familyName].filter(Boolean).join(' '),
      accountType,
      orgSourcedIds: refList(raw, 'orgSourcedIds', 'orgs'),
      enabled: raw?.enabledUser === undefined ? true : asBool(raw.enabledUser),
      deleted,
    },
  };
}

// ---------------------------------------------------------------------------
// classes
// ---------------------------------------------------------------------------

export interface MappedClass {
  sourcedId: string;
  title: string;
  classType: string;
  schoolSourcedId: string;
  termSourcedIds: string[];
  grades: string[] | null;
  location: string | null;
  periods: string | null;
  deleted: boolean;
}

export function mapClass(raw: any): { cls: MappedClass | null; skip?: string } {
  const sourcedId = String(raw?.sourcedId ?? '').trim();
  const title = String(raw?.title ?? '').trim();
  if (!sourcedId) return { cls: null, skip: 'missing_sourced_id' };
  const classType = String(raw?.classType ?? 'scheduled').toLowerCase();
  // Profile doc: Quest rosters scheduled classes; homerooms are filtered.
  if (classType === 'homeroom') return { cls: null, skip: 'homeroom' };
  const deleted = isDeleted(raw);
  if (!title && !deleted) return { cls: null, skip: 'missing_title' };
  const periodsRaw = raw?.periods;
  const periods = Array.isArray(periodsRaw)
    ? periodsRaw.filter(Boolean).join('/')
    : String(periodsRaw ?? '').trim();
  return {
    cls: {
      sourcedId,
      title,
      classType,
      schoolSourcedId: ref(raw, 'schoolSourcedId', 'school'),
      termSourcedIds: refList(raw, 'termSourcedIds', 'terms'),
      grades: normalizeGrades(raw?.grades),
      location: String(raw?.location ?? '').trim() || null,
      periods: periods || null,
      deleted,
    },
  };
}

// The display label for a roster-managed class: "Biology 1 — Rm 204 — P3".
// Profile doc: location and periods are Supported purely so multi-section
// teachers can tell their classes apart.
export function composeClassLabel(
  title: string,
  location: string | null,
  periods: string | null,
): string {
  let label = title;
  if (location) label += ` — ${location}`;
  if (periods) label += ` — P${periods}`;
  return label;
}

// ---------------------------------------------------------------------------
// enrollments
// ---------------------------------------------------------------------------

export interface MappedEnrollment {
  sourcedId: string;
  classSourcedId: string;
  userSourcedId: string;
  schoolSourcedId: string;
  kind: 'student' | 'teacher';
  primary: boolean;
  deleted: boolean;
}

export function mapEnrollment(raw: any): { enr: MappedEnrollment | null; skip?: string } {
  const sourcedId = String(raw?.sourcedId ?? '').trim();
  if (!sourcedId) return { enr: null, skip: 'missing_sourced_id' };
  const role = String(raw?.role ?? '').toLowerCase();
  // Only student/teacher enrollments materialize; aides, proctors, etc. are
  // skipped (Quest has no seat for them — profile doc, Define Roles).
  const kind = role === 'student' ? 'student' : role === 'teacher' ? 'teacher' : null;
  if (!kind) return { enr: null, skip: 'unmapped_enrollment_role' };
  const classSourcedId = ref(raw, 'classSourcedId', 'class');
  const userSourcedId = ref(raw, 'userSourcedId', 'user');
  if (!classSourcedId || !userSourcedId) return { enr: null, skip: 'missing_refs' };
  return {
    enr: {
      sourcedId,
      classSourcedId,
      userSourcedId,
      schoolSourcedId: ref(raw, 'schoolSourcedId', 'school'),
      kind,
      primary: asBool(raw?.primary),
      deleted: isDeleted(raw),
    },
  };
}

// ---------------------------------------------------------------------------
// join codes — same alphabet/length as the manual class-create flow
// (src/pages/TeacherClasses.jsx generateJoinCode), so roster classes are
// joinable through every existing UI path.
// ---------------------------------------------------------------------------

export function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
