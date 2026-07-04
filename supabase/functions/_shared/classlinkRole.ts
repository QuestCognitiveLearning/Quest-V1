// Shared ClassLink → Quest role mapping, used by both classlinkSso (SSO
// profile role) and rosterSync (OneRoster user.role). Extracted from
// classlinkSso so the two can never drift.
//
// Map a ClassLink role string onto Quest's three account types. Anything we
// can't classify returns null: the SSO flow sends those users through
// RoleSelection, and the roster sync skips provisioning them entirely
// (guardians/parents/relatives are never rostered — see
// docs/classlink-roster-server-profile.md).
//
// Order matters: check the more specific district/admin match before the
// generic teacher match, because ClassLink role strings often overlap
// (e.g. "district_admin" or "tenant_admin" contain both "admin" and no
// "teacher", but "school_admin" is more admin-ish than teacher-ish).
export function mapRole(raw: unknown): 'teacher' | 'student' | 'district_admin' | null {
  const r = String(raw ?? '').toLowerCase();
  if (!r) return null;
  if (r.includes('student')) return 'student';
  if (r.includes('admin') || r.includes('tenant') || r.includes('district')) {
    return 'district_admin';
  }
  if (r.includes('teacher') || r.includes('staff') || r.includes('faculty')) {
    return 'teacher';
  }
  return null;
}
