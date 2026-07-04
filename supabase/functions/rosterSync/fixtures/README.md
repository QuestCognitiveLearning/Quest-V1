# rosterSync fixtures

Canned OneRoster responses for fixture mode (`{"fixtures":"full"}` /
`{"fixtures":"delta1"}` in the request body). They exercise the entire
engine + database path with no ClassLink connectivity — DB writes are real.

**These JSON files are the single source of truth.** They are imported as
JSON modules by `index.ts` (never read from disk at runtime — the compiled
bundle has no data files). Editing a fixture means editing the JSON here
and nothing else; adding a new file means adding a matching import to the
`FIXTURES` map in `index.ts`.

## Permanent invariant: the APPFIX1 tenant guard

Fixture runs are restricted to the fixture tenant — `index.ts` filters the
tenant query with `oneroster_application_id = 'APPFIX1'` whenever fixture
mode is active. This is what makes a fixture run safe to fire against any
environment, including production: it can never pull fixture data into a
real district's tenant. **Do not remove this guard, and do not reuse
`APPFIX1` / tenant `999001` for anything real.** All fixture people live in
Springfield USD with `@example.edu` emails, so a fixture run's residue is
identifiable and deletable via `classlink_tenant_id = '999001'`.
