# QUEST LEARNING — CLASSLINK ROSTER SERVER APP PROFILE

**Saved selections for OneRoster 1.1, OneRoster 1.2, and DataGuard**
Recorded: July 3, 2026 · Legend: R = Required, S = Supported, NS = Not Supported

## DELIVERY METHODS (both 1.1 and 1.2)

API only. All CSV/SFTP/FTPS options unchecked.
Note: Quest syncs rosters nightly via the OneRoster REST API (delta sync on dateLastModified); no file-based delivery is consumed.

## GUIDE CUSTOMERS TOGGLES

OneRoster 1.2: Orgs ON · Courses OFF · Classes ON · Users ON · Roles ON · Enrollments ON · Academic Sessions ON
OneRoster 1.1: Orgs ON · Courses OFF · Classes ON · Users ON · Enrollments ON · Academic Sessions ON

---

# SECTION 1 — ONEROSTER 1.2

## 1.2 ORGS

- sourcedId — R — Stable org identity; used as the upsert key for Quest's nightly roster sync.
- dateLastModified — R — Drives delta sync; only changed org records are re-processed.
- type — R — Mapped to district / school / department; builds the org hierarchy and scopes district-admin visibility.
- status — R — Records marked tobedeleted archive the org and its memberships in Quest.
- name — R — Displayed throughout teacher and admin dashboards.
- identifier — NS — Ignored; Quest keys orgs on sourcedId only.
- parentSourcedId — S — Builds the district-to-school hierarchy when present; top-level districts have none.
- All metadata rows (NCESid, mdrid, orgStateid, gradeRange, address1, address2, city, state, postCode, phone, principal, principalEmail) — NS — Not stored; Quest consumes only org name, type, and hierarchy.

## 1.2 COURSES

Toggle OFF ("No, do not guide customers"). Quest does not consume the courses endpoint; class title, grades, and subjects are read directly from the class record, and all instructional content is teacher-authored curriculum.

## 1.2 CLASSES

- sourcedId — R — Upsert key for class sync.
- dateLastModified — R — Drives delta sync for class records.
- courseSourcedId — S — Accepted on the class record but not resolved; Quest does not consume course records.
- schoolSourcedId — R — Sets the class's home school; drives dashboard filtering and admin scoping.
- status — R — Drives class lifecycle; classes appear and archive as the SIS adds or removes them; classes without a teacher stay hidden as pending.
- title — R — Class display name shown to teachers and students.
- classType — R — Quest rosters scheduled classes; homerooms are filtered at ingest.
- termSourcedIds — R — Combined with academic session dates to activate and archive classes at term boundaries.
- grades — S — Stored per class; powers standards import, content difficulty, and parent-report tone.
- location — S — Appended to the class display label (e.g. "Biology 1 — Rm 204") so multi-section teachers can tell classes apart. Not used for scheduling.
- subjectCodes — NS — SCED codes are not used.
- classCode — NS — Title, room, and period already disambiguate sections.
- subjects — S — Used to help match the class to a Quest curriculum subject.
- periods — S — Shown in the class label (e.g. "P3") to disambiguate multiple sections. Not used for scheduling.
- All metadata rows (SessionStartTime, SessionEndTime, classStateId, schoolYear) — NS — Not stored.

## 1.2 USERS

- sourcedId — R — Primary identity; tenant plus sourcedId is the first-precedence match key for SSO sign-in and roster sync.
- dateLastModified — R — Drives delta sync for user records.
- orgSourcedIds — R — Populates org memberships; supports teachers and students in multiple schools.
- username — R — Second-precedence SSO match key (tenant plus username) for accounts provisioned before sourcedId was available.
- familyName — R — Combined with givenName into the user's display name.
- status — R — Records marked tobedeleted deactivate the account.
- enabledUser — R — Sign-in is denied while false.
- role — R — Mapped to the Quest account type (student, teacher, or district admin).
- givenName — R — Combined with familyName into the user's display name.
- email — R — Quest accounts and ClassLink SSO sign-in are keyed on email; provisioning cannot complete without it. (Required even though 1.2 lists it as optional.)
- userIds — NS — Not consumed.
- identifier — NS — Not consumed.
- sms — NS — Not requested; Quest stores no phone data.
- agentSourcedIds — NS — Guardian linkage is not rostered; parent communication is configured in-app by teachers.
- password — NS — Never received or stored; authentication is via ClassLink SSO.
- middleName — NS — Display name uses given and family name only.
- phone — NS — Not requested; Quest stores no phone data.
- grades — NS — Grade level is taken from class data, not the user record.
- preferredGivenName — NS — Not currently displayed.
- preferredFamilyName — NS — Not currently displayed.
- preferredMiddleName — NS — Not currently displayed.
- primaryOrgSourcedId — S — Sets the user's home org for dashboard defaults.
- pronouns — NS — Not stored.
- userMasterIdentifier — NS — Identity is keyed on tenant plus sourcedId.
- Metadata row (userStateId) — NS — Not stored.

## 1.2 ROLES

- sourcedId — R — Upsert key for role records.
- dateLastModified — R — Drives delta sync for role records.
- roleType — R — The primary role determines the Quest account type; secondary roles feed per-org membership roles.
- orgSourcedId — R — The role is applied to the user's membership in that org.
- status — R — Removed roles revoke the corresponding access in Quest.
- userSourcedId — R — Links the role to the user.
- role — R — Mapped to the Quest account type (see role definitions).
- beginDate — NS — Roles are not date-gated; status controls activation.
- endDate — NS — Roles are not date-gated; status controls activation.
- userProfileSourcedId — NS — User profiles are not ingested.

### 1.2 DEFINE ROLES

- aide — Not auto-mapped; may appear as an assistant on class enrollments. User selects their role at first sign-in.
- counselor — Not auto-provisioned; user selects their role at first sign-in.
- districtAdministrator — Provisioned as a District Admin with district-wide dashboards across child schools.
- guardian — Not provisioned; Quest does not roster guardian accounts; parent reports are configured in-app by teachers.
- parent — Not provisioned; Quest does not roster parent accounts; parent reports are configured in-app by teachers.
- principal — Not auto-mapped; user selects Teacher or Admin at first sign-in.
- proctor — Not auto-provisioned; user selects their role at first sign-in.
- relative — Not provisioned; Quest does not roster relative accounts; parent reports are configured in-app by teachers.
- student — Provisioned as a Student account with learner dashboard and class enrollments.
- systemAdministrator — Treated as a District Admin account.
- teacher — Provisioned as a Teacher account with class ownership, live sessions, and reports.

## 1.2 ENROLLMENTS

- sourcedId — R — Upsert key for enrollment records.
- dateLastModified — R — Drives delta sync for enrollments.
- schoolSourcedId — R — Scopes the enrollment to the school org.
- role — R — Student enrollments build the class roster; teacher enrollments build the instructor list (primary, co-teacher, assistant, substitute all kept).
- status — R — Dropped enrollments remove the student from the class; a removed teacher can return the class to pending.
- classSourcedId — R — Links the enrollment to the class.
- userSourcedId — R — Links the enrollment to the user.
- primary — S — Marks the primary teacher, which drives class ownership defaults; co-teachers are kept either way.
- beginDate — NS — Enrollment activity is driven by status, not dates.
- endDate — NS — Enrollment activity is driven by status, not dates.

## 1.2 ACADEMIC SESSIONS

- sourcedId — R — Referenced by each class's termSourcedIds.
- dateLastModified — R — Drives delta sync for session records.
- type — R — Terms, semesters, and school years are distinguished so classes attach at the right session level.
- endDate — R — Classes auto-archive after their term ends.
- status — R — Removed sessions detach cleanly from classes.
- title — R — Term label shown in class context.
- startDate — R — Classes activate at term start.
- schoolYear — R — Anchors classes and reporting to the correct school year.
- parentSourcedId — S — Lets grading periods roll up to their parent term when districts publish nested sessions.

---

# SECTION 2 — ONEROSTER 1.1

## 1.1 ORGS

- sourcedId — R — Stable org identity; used as the upsert key for Quest's nightly roster sync.
- status — R — Records marked tobedeleted archive the org and its memberships in Quest.
- dateLastModified — R — Drives delta sync; only changed org records are re-processed.
- name — R — Displayed throughout teacher and admin dashboards.
- type — R — Mapped to district / school / department; builds the org hierarchy and scopes district-admin visibility.
- identifier — NS — Ignored; Quest keys orgs on sourcedId only.
- parentSourcedId — S — Builds the district-to-school hierarchy when present.
- All metadata rows — NS — Not stored; no address or contact data is requested.

## 1.1 COURSES

Toggle OFF ("No, do not guide customers"). Same rationale as 1.2.

## 1.1 CLASSES

- sourcedId — R — Upsert key for class sync.
- status — R — Drives class lifecycle; classes without a teacher stay hidden as pending.
- dateLastModified — R — Drives delta sync for class records.
- title — R — Class display name shown to teachers and students.
- classType — R — Quest rosters scheduled classes; homerooms are filtered at ingest.
- courseSourcedId — S — Accepted but not resolved; Quest does not consume course records.
- schoolSourcedId — R — Sets the class's home school; drives dashboard filtering and admin scoping.
- termSourcedIds — R — Combined with academic session dates to activate and archive classes at term boundaries.
- grades — S — Stored per class; powers standards import, content difficulty, and parent-report tone.
- classCode — NS — Title, room, and period already disambiguate sections.
- location — S — Appended to the class display label so multi-section teachers can tell classes apart.
- subjects — S — Used to help match the class to a Quest curriculum subject.
- subjectCodes — NS — SCED codes are not used.
- periods — S — Shown in the class label to disambiguate multiple sections.
- All metadata rows — NS — Not stored.

## 1.1 USERS

- sourcedId — R — Primary identity; tenant plus sourcedId is the first-precedence SSO and sync match key.
- status — R — Records marked tobedeleted deactivate the account.
- dateLastModified — R — Drives delta sync for user records.
- enabledUser — R — Sign-in is denied while false.
- orgSourcedIds — R — Populates org memberships; supports multi-school users.
- role — R — Sole role source in 1.1; mapped to the Quest account type.
- username — R — Second-precedence SSO match key (tenant plus username).
- givenName — R — Combined with familyName into the display name.
- familyName — R — Combined with givenName into the display name.
- email — R — Quest accounts and ClassLink SSO sign-in are keyed on email; provisioning cannot complete without it.
- userIds — NS — Not consumed.
- identifier — NS — Not consumed.
- middleName — NS — Display name uses given and family name only.
- sms — NS — Not requested.
- phone — NS — Not requested.
- agentSourcedIds — NS — Guardian linkage is not rostered.
- grades — NS — Grade level is taken from class data.
- password — NS — Never received or stored; authentication is via ClassLink SSO.
- All metadata rows — NS — Not stored.

### 1.1 DEFINE ROLES

- administrator — Provisioned as a District Admin with district-wide dashboards across child schools.
- aide — Not auto-mapped; may appear as an assistant on class enrollments. User selects their role at first sign-in.
- guardian — Not provisioned; parent reports are configured in-app by teachers.
- parent — Not provisioned; parent reports are configured in-app by teachers.
- proctor — Not auto-provisioned; user selects their role at first sign-in.
- relative — Not provisioned; parent reports are configured in-app by teachers.
- student — Provisioned as a Student account with learner dashboard and class enrollments.
- teacher — Provisioned as a Teacher account with class ownership, live sessions, and reports.

## 1.1 ENROLLMENTS

- sourcedId — R — Upsert key for enrollment records.
- status — R — Dropped enrollments remove the student from the class; a removed teacher can return the class to pending.
- dateLastModified — R — Drives delta sync for enrollments.
- classSourcedId — R — Links the enrollment to the class.
- schoolSourcedId — R — Scopes the enrollment to the school org.
- userSourcedId — R — Links the enrollment to the user.
- role — R — Student enrollments build the class roster; teacher enrollments build the instructor list.
- primary — S — Marks the primary teacher; co-teachers are kept either way.
- beginDate — NS — Enrollment activity is driven by status, not dates.
- endDate — NS — Enrollment activity is driven by status, not dates.

## 1.1 ACADEMIC SESSIONS

- sourcedId — R — Referenced by each class's termSourcedIds.
- status — R — Removed sessions detach cleanly from classes.
- dateLastModified — R — Drives delta sync for session records.
- title — R — Term label shown in class context.
- type — R — Terms, semesters, and school years distinguished so classes attach at the right level.
- startDate — R — Classes activate at term start.
- endDate — R — Classes auto-archive after their term ends.
- schoolYear — R — Anchors classes and reporting to the correct school year.
- parentSourcedId — S — Lets grading periods roll up to their parent term.

---

# SECTION 3 — DATAGUARD (both versions)

Meaning: Required = real value must be sent (no obfuscation). Supported = obfuscated data is acceptable. Not Supported = field not consumed.

## DataGuard — OneRoster 1.1

- Classes: title — S — Obfuscated class titles are acceptable; rostering and enrollments are unaffected.
- Users: familyName — R — Real value required; rosters, live sessions, and parent reports display student names.
- Users: givenName — R — Real value required; same reason.
- Users: middleName — NS — Not consumed.
- Users: email — R — Real value required; accounts and SSO sign-in are keyed on email.
- Users: identifier — NS — Not consumed.

## DataGuard — OneRoster 1.2

- Classes: title — S — Obfuscated class titles are acceptable.
- Users: familyName — R — Real value required.
- Users: givenName — R — Real value required.
- Users: preferredGivenName — NS — Not consumed.
- Users: preferredFamilyName — NS — Not consumed.
- Users: middleName — NS — Not consumed.
- Users: preferredMiddleName — NS — Not consumed.
- Users: email — R — Real value required.
- Users: identifier — NS — Not consumed.

---

# SECTION 4 — NOTE TO DISTRICTS (same text on every tab)

Quest Learning consumes rostering read-only via the OneRoster REST API with a nightly delta sync. We follow a data-minimization policy: only the fields marked Required or Supported are stored — no addresses, phone numbers, passwords, or guardian records are requested. Student email is required because Quest accounts and ClassLink SSO sign-in are keyed on email. Classes appear to teachers and students only once both the class and its teacher enrollment have arrived from your SIS.

---

# NEXT STEPS IN CLASSLINK CERTIFICATION (as of July 3, 2026)

1. Request sandbox access — get a test tenant in the ClassLink Developer Portal; ClassLink issues OneRoster API credentials (client ID/secret + endpoint).
2. Build and test the roster ingest against the sandbox — pull /orgs, /users, /classes, /enrollments, /academicSessions; verify pagination (limit/offset), delta filtering on dateLastModified, and tobedeleted handling. (Schema is ready — migrations 0043–0048 — but the ingest edge function still needs to be written.)
3. Test SSO end-to-end from LaunchPad — ClassLink-initiated and SP-initiated, confirming identifier precedence (tenant+sourcedId → tenant+loginId → email) resolves rostered users.
4. Submit for certification review — ClassLink verifies API usage, SSO flow, and DataGuard handling against this profile.
5. App Library listing — once certified, districts can request the connection; the "guide customers" grids above are what they see when configuring.
