# Task 4 report: setup/settings SchoolInfo field preservation

## Scope

- Added regression coverage only in `test/profile-views.test.mjs`.
- Inspected `src/views/setup.mjs` and `src/views/settings.mjs`; no production change was needed because `selectSchool`, `createProfileCandidate`, and `persistSettingsProfile` already retain the selected school object unchanged.

## TDD evidence

- Added the behavioral regression tests before making any production change.
- Mutation check: temporarily removed `schoolInfoId` and `schoolInfoUrl` during profile creation, then ran `npm.cmd test -- test/profile-views.test.mjs`; the two new regressions failed specifically because those fields were absent (15 passed, 2 failed). The temporary mutation was restored.
- The restored focused run passed, demonstrating the existing implementation already met the new preservation contract; therefore no production implementation step was required.
- The setup test verifies selection and profile completion retain literal `schoolInfoId` and `schoolInfoUrl`, while selecting a different school still clears the grade/class setting.
- The settings test verifies an unrelated allergy edit saves the exact enriched school object and does not treat the school as changed.

## Commands and results

| Command | Result |
| --- | --- |
| `npm.cmd test -- test/profile-views.test.mjs` | 17 passed, 0 failed, 0 skipped |
| `npm.cmd test` | 111 passed, 0 failed, 3 skipped (114 total) |

## Compatibility checks covered

- Grade/class reset on a genuine school change remains covered and passing.
- Settings persistence keeps the school unchanged when only allergies change.
- Existing settings-search and validation tests remain green in the focused and full suites.
