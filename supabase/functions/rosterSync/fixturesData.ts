// Inlined copy of the fixtures/ JSON files for deployed bundles (the edge
// bundler only ships TS modules, so Deno.readTextFile can't reach the JSON
// files in production; local runs still prefer the JSON files on disk).
// Regenerate after editing fixtures/*.json:
//   python3 - <see git log for this file's generator> or hand-sync.
// Fixture district: tenant 999001 "Springfield USD" — all emails @example.edu,
// cleanly deletable by classlink_tenant_id = '999001'.

export const FIXTURES: Record<string, any> = {
  "applications": {
    "applications": [
      {
        "oneroster_applications_id": "APPFIX1",
        "tenant_id": "999001",
        "tenant_name": "Springfield USD (fixture)"
      }
    ]
  },
  "full": {
    "academicSessions": {
      "academicSessions": [
        {
          "sourcedId": "sy-2526",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "title": "School Year 2025-2026",
          "type": "schoolYear",
          "startDate": "2025-08-15",
          "endDate": "2026-12-20",
          "schoolYear": "2026"
        },
        {
          "sourcedId": "term-fall",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "title": "Fall Semester",
          "type": "semester",
          "startDate": "2025-08-15",
          "endDate": "2025-12-20",
          "schoolYear": "2026",
          "parentSourcedId": "sy-2526"
        },
        {
          "sourcedId": "term-spring",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "title": "Spring Semester",
          "type": "semester",
          "startDate": "2026-01-06",
          "endDate": "2026-12-20",
          "schoolYear": "2026",
          "parentSourcedId": "sy-2526"
        }
      ]
    },
    "classes": {
      "classes": [
        {
          "sourcedId": "cls-bio1",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "title": "Biology 1",
          "classType": "scheduled",
          "courseSourcedId": "crs-bio",
          "schoolSourcedId": "org-sch1",
          "termSourcedIds": [
            "term-fall",
            "term-spring"
          ],
          "grades": [
            "09",
            "10"
          ],
          "location": "Rm 204",
          "periods": [
            "3"
          ],
          "subjects": [
            "science"
          ]
        },
        {
          "sourcedId": "cls-alg1",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "title": "Algebra 1",
          "classType": "scheduled",
          "courseSourcedId": "crs-alg",
          "schoolSourcedId": "org-sch1",
          "termSourcedIds": [
            "term-fall",
            "term-spring"
          ],
          "grades": [
            "09"
          ],
          "periods": [
            "1"
          ]
        },
        {
          "sourcedId": "cls-homeroom",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "title": "Homeroom 9A",
          "classType": "homeroom",
          "schoolSourcedId": "org-sch1"
        }
      ]
    },
    "enrollments": {
      "enrollments": [
        {
          "sourcedId": "enr-t1-bio",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-t1",
          "role": "teacher",
          "primary": "true"
        },
        {
          "sourcedId": "enr-t2-bio",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-t2",
          "role": "teacher",
          "primary": "false"
        },
        {
          "sourcedId": "enr-s1-bio",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-s1",
          "role": "student"
        },
        {
          "sourcedId": "enr-s2-bio",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-s2",
          "role": "student"
        },
        {
          "sourcedId": "enr-s3-bio",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-s3",
          "role": "student"
        },
        {
          "sourcedId": "enr-s1-alg",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "classSourcedId": "cls-alg1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-s1",
          "role": "student"
        },
        {
          "sourcedId": "enr-aide-bio",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-guardian1",
          "role": "aide"
        }
      ]
    },
    "orgs": {
      "orgs": [
        {
          "sourcedId": "org-dist",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "name": "Springfield Unified School District",
          "type": "district",
          "identifier": "SHOULD-BE-DROPPED-AT-PARSE",
          "metadata": {
            "address1": "SHOULD-BE-DROPPED"
          }
        },
        {
          "sourcedId": "org-sch1",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "name": "Springfield High School",
          "type": "school",
          "parentSourcedId": "org-dist"
        }
      ]
    },
    "users": {
      "users": [
        {
          "sourcedId": "usr-t1",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "enabledUser": "true",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "teacher",
          "username": "ekrabappel",
          "givenName": "Edna",
          "familyName": "Krabappel",
          "email": "fixture-teacher1@example.edu",
          "password": "SHOULD-BE-DROPPED-AT-PARSE",
          "phone": "SHOULD-BE-DROPPED"
        },
        {
          "sourcedId": "usr-t2",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "enabledUser": "true",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "teacher",
          "username": "dhoover",
          "givenName": "Elizabeth",
          "familyName": "Hoover",
          "email": "fixture-teacher2@example.edu"
        },
        {
          "sourcedId": "usr-s1",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "enabledUser": "true",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "student",
          "username": "bsimpson",
          "givenName": "Bart",
          "familyName": "Simpson",
          "email": "fixture-student1@example.edu"
        },
        {
          "sourcedId": "usr-s2",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "enabledUser": "true",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "student",
          "username": "mvanhouten",
          "givenName": "Milhouse",
          "familyName": "Van Houten",
          "email": "fixture-student2@example.edu"
        },
        {
          "sourcedId": "usr-s3",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "enabledUser": "true",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "student",
          "username": "lsimpson",
          "givenName": "Lisa",
          "familyName": "Simpson",
          "email": "fixture-student3@example.edu"
        },
        {
          "sourcedId": "usr-guardian1",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "enabledUser": "true",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "guardian",
          "username": "hsimpson",
          "givenName": "Homer",
          "familyName": "Simpson",
          "email": "fixture-guardian@example.edu"
        },
        {
          "sourcedId": "usr-s-noemail",
          "status": "active",
          "dateLastModified": "2026-06-01T00:00:00.000Z",
          "enabledUser": "true",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "student",
          "username": "noemail",
          "givenName": "No",
          "familyName": "Email"
        }
      ]
    }
  },
  "delta1": {
    "classes": {
      "classes": [
        {
          "sourcedId": "cls-bio1",
          "status": "active",
          "dateLastModified": "2026-06-02T00:00:00.000Z",
          "title": "Biology 1",
          "classType": "scheduled",
          "courseSourcedId": "crs-bio",
          "schoolSourcedId": "org-sch1",
          "termSourcedIds": [
            "term-fall",
            "term-spring"
          ],
          "grades": [
            "09",
            "10"
          ],
          "location": "Rm 310",
          "periods": [
            "3"
          ],
          "subjects": [
            "science"
          ]
        }
      ]
    },
    "enrollments": {
      "enrollments": [
        {
          "sourcedId": "enr-s2-bio",
          "status": "tobedeleted",
          "dateLastModified": "2026-06-02T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-s2",
          "role": "student"
        },
        {
          "sourcedId": "enr-t1-bio",
          "status": "tobedeleted",
          "dateLastModified": "2026-06-02T00:00:00.000Z",
          "classSourcedId": "cls-bio1",
          "schoolSourcedId": "org-sch1",
          "userSourcedId": "usr-t1",
          "role": "teacher",
          "primary": "true"
        }
      ]
    },
    "users": {
      "users": [
        {
          "sourcedId": "usr-s2",
          "status": "tobedeleted",
          "dateLastModified": "2026-06-02T00:00:00.000Z",
          "enabledUser": "false",
          "orgSourcedIds": [
            "org-sch1"
          ],
          "role": "student",
          "username": "mvanhouten",
          "givenName": "Milhouse",
          "familyName": "Van Houten",
          "email": "fixture-student2@example.edu"
        }
      ]
    }
  }
};
