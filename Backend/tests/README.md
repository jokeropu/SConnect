# Tests

```bash
npm test                 # all 13 suites
npm test quiz            # only suites whose name contains "quiz"
npm test marks ownership # several
```

`tests/run.js` starts the API itself on port 4010, runs each suite as its own
process, and shuts the server down again. Nothing needs to be running first.

## They never touch the working database

`helpers.js` rewrites the database name in `DB_CONNECT_STRING` to
`sconnect_test`, so the suites use the same cluster but their own schema, and
`connect()` refuses to proceed if it finds itself anywhere else. Every suite
tags its fixtures and removes them in a `finally` block, so the test database
is empty when a run finishes.

Two things that caused real leaks and are worth remembering:

- The `User` model lowercases email, so teardown has to match
  case-insensitively. Getting that wrong once left 76 accounts behind while the
  cleanup happily reported nothing remaining.
- A suite that throws part-way still has to clean up, which is why the
  fixtures are removed in `finally` and never at the end of the happy path.

## What each suite covers

| Suite | Covers |
|---|---|
| `quiz` | Grading across all four question types, negative marking, skipped questions, double submit, review gating, role scoping |
| `quizHttp` | The same through the real HTTP stack, including auth and role middleware |
| `quizSetter` | Only the section's subject teacher, or the class head, may set a quiz |
| `quizResult` | Quiz marks reaching the report card at reduced weight, and the weighting arithmetic |
| `quizCsv` | Export escaping, spreadsheet formula injection, the UTF-8 BOM, authorisation |
| `ownership` | Creator-only editing of exams, lessons, events and quizzes |
| `classHead` | A class head managing all sections of their grade, and nobody else's |
| `marks` | Setting a paper and marking it are separate rights |
| `massAssign` | Field allow-lists, and the `createLesson` privilege escalation |
| `attendance` | Absence and low-attendance notices firing once rather than on every read |
| `contacts` | Messaging permissions, and that the contact list does not scale its query count with the user base |
| `timetable` | A teacher cannot be booked into two rooms in one period |
| `memberId` | Member id format, immutability, and no duplicates under concurrent creation |

## Adding one

Copy the shape of an existing suite: take `check`, `hit` and `connect` from
`../helpers`, build fixtures with a `tag()` prefix, assert, and delete
everything in `finally`. Then add the filename to `SUITES` in `run.js`.
