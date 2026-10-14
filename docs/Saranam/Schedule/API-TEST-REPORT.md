# Scheduling System API Test Report

**Date**: 2026-03-26
**Tester**: Automated curl tests
**Server**: Flask dev server on port 5002
**Auth**: Admin user (JWT)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 35 |
| Passed | 35 |
| Failed | 0 |
| Fixed During Testing | 1 |

---

## Test Results

### Config & Settings (2/2 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 1 | `/scheduling/config` | GET | 200 | Returns default config with all fields |
| 2 | `/scheduling/config` | PUT | 200 | Updates config fields correctly |

### Clusters (2/2 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 3 | `/scheduling/clusters` | POST | 201 | Creates cluster with name, color, pin_codes |
| 4 | `/scheduling/clusters` | GET | 200 | Lists active clusters |

### Vehicles (2/2 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 5 | `/scheduling/vehicles` | POST | 201 | Creates vehicle with name, registration |
| 6 | `/scheduling/vehicles` | GET | 200 | Lists active vehicles |

### Schedules CRUD (3/3 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 7 | `/scheduling/schedules` | POST | 201 | Creates schedule with auto-generated days (Mon,Tue,Thu,Fri) |
| 8 | `/scheduling/schedules/:id` | GET | 200 | Returns full schedule with days, slots, team |
| 9 | `/scheduling/schedules` | GET | 200 | Lists schedules with pagination |

### Patient Pool (3/3 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 10 | `/patient-pool/ensure/:id` | POST | 200 | Creates scheduling meta for patient |
| 11 | `/patient-pool` | GET | 200 | Returns pool with summary stats |
| 35 | `/patient-pool/:id/flag` | POST | 200 | Flags patient with reason |

### Slots (3/3 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 12 | `/days/:id/slots` | POST | 201 | Adds patient to day, computes cluster efficiency |
| 13 | `/slots/:id` | PUT | 200 | Updates exception note |
| 20 | `/slots/:id` | PUT | 200 | Updates status to completed with timestamp |

### Days & Team (2/2 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 14 | `/days/:id` | PUT | 200 | Updates day note |
| 15 | `/days/:id/team` | PUT | 200 | Sets team assignments |

### State Transitions (7/7 PASS) - Full Lifecycle
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 16 | `/schedules/:id/validate` | GET | 200 | Returns warnings and summary |
| 17 | `/schedules/:id/submit` | POST | 200 | DRAFT → SUBMITTED |
| 18 | `/schedules/:id/approve` | POST | 200 | SUBMITTED → APPROVED → COMMUNICATED |
| 19 | `/schedules/:id/activate` | POST | 200 | COMMUNICATED → IN_PROGRESS |
| 21 | `/schedules/:id/review-ready` | POST | 200 | IN_PROGRESS → REVIEW_READY (computes metrics) |
| 22 | `/schedules/:id/review` | GET | 200 | Returns computed review metrics |
| 23 | `/schedules/:id/complete-review` | POST | 200 | REVIEW_READY → ARCHIVED |

### Audit Log (1/1 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 24 | `/schedules/:id/audit-log` | GET | 200 | Returns 11 audit entries for full lifecycle |

### My Schedule (2/2 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 25 | `/my-schedule` | GET | 404 | Correct - schedule is archived, no active for this user |
| 26 | `/my-schedule/today` | GET | 404 | Correct - no visits today |

### Notifications & Acknowledgments (3/3 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 27 | `/notifications` | GET | 200 | Returns notification list |
| 28 | `/schedules/:id/acknowledgments` | GET | 200 | Returns team acknowledgment status |
| 29 | `/schedules/:id/acknowledge` | POST | 200 | Marks user as acknowledged |

### On-Call (2/2 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 30 | `/on-call` | POST | 201 | Creates on-call roster entry |
| 31 | `/on-call` | GET | 200 | Lists roster entries |

### Alerts & Team (3/3 PASS)
| # | Endpoint | Method | Status | Result |
|---|----------|--------|--------|--------|
| 32 | `/alerts/unscheduled` | GET | 200 | Returns unscheduled patient alerts |
| 33 | `/available-team` | GET | 200 | Returns available team members |
| 34 | `/patient-pool/recalculate-priorities` | POST | 200 | Recalculates all priority scores |

---

## Issues Found & Fixed

### Issue 1: `/alerts/unscheduled` returning 500
- **Root Cause**: `db` was imported from `app.extensions` AFTER it was used in `db.session.query()` within the function. The inline import was placed after the first usage.
- **Fix**: Moved `from app.extensions import db` to the top-level imports of the scheduling routes module.
- **Commit**: `fix alerts/unscheduled endpoint db import order`

---

## State Machine Verification

The full lifecycle was tested end-to-end:
```
DRAFT → SUBMITTED → APPROVED → COMMUNICATED → IN_PROGRESS → REVIEW_READY → ARCHIVED
```

Each transition:
- Correctly validates the current state
- Updates timestamps (submitted_at, approved_at, etc.)
- Creates audit log entries (11 total for full lifecycle)
- Computes review metrics when entering REVIEW_READY

---

## Audit Trail Verification

11 audit entries were created during the full lifecycle test:
1. schedule_created
2. patient_added (slot)
3. day_note_updated
4. team_changed
5. schedule_submitted
6. schedule_approved
7. schedule_communicated
8. schedule_activated
9. slot_status_changed (completed)
10. schedule_review_ready
11. schedule_archived
