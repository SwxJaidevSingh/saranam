# Test Environment & Execution Guide — Saranam India Health Care

**Version:** 1.0  •  **Date:** 2026-06-01
Read this before executing any test case. It defines the environment, accounts, conventions, and how to record results and raise defects.

---

## 1. Application under test

| Item | Value |
|------|-------|
| Application | Saranam India Health Care |
| URL (production / UAT) | https://saranam.fieldintel.ai |
| Frontend | React (Single Page App) |
| Backend | Python / FastAPI-style REST API (base path `/api/...`) |
| Auth | JWT (access + refresh token); token sent as `Authorization: Bearer <token>` |
| Locale / context | India — phone numbers `+91`, INR `₹`, dates `DD-MM-YYYY` unless UI states otherwise |

> Confirm with the project owner whether testing runs against **production** or a dedicated **UAT/staging** environment. **Do not create throwaway/junk data in production.** Prefer a staging environment with a refreshable database.

## 2. Roles & test accounts

The platform has **three roles** (from the backend `user_role` enum). Provision one test account per role before starting; user-gated modules require an **admin**.

| Role | Key permissions | Can access (tested modules) |
|------|-----------------|------------------------------|
| `admin` | All, incl. `manage_users`, `view_analytics` | Everything — Patients, Scheduling, Providers, Inventory, Analytics, **Call Logs (admin-only)**, **Users (admin-only)**, Settings |
| `data_entry` | `view_form`, `submit_form`, `view_submission` | Patients, Scheduling, Providers, Inventory, Settings. **No** Analytics, **No** Users, **No** Call Logs |
| `viewer` | `view_form`, `view_submission`, `view_analytics` | Patients (view), Analytics, Settings. **No** Users, **No** Call Logs |

**Accounts to create / obtain (fill in before execution):**

| Purpose | Username / Email | Password | Notes |
|---------|------------------|----------|-------|
| Admin | __________________ | ________ | Full access; needed for Users & Call Logs tests |
| Data entry | __________________ | ________ | For permission-denied checks |
| Viewer | __________________ | ________ | For analytics + permission-denied checks |

> New users self-register at `/register` and require **admin approval** before they can log in (there is no admin "create user" button — see Known Issues). Plan account provisioning accordingly.

## 3. Browsers & devices

Execute the **High**-priority suite on all primary browsers; Medium/Low on the primary browser at minimum.

| Browser | Versions | Priority |
|---------|----------|----------|
| Google Chrome | Latest | Primary (must) |
| Microsoft Edge | Latest | Secondary |
| Mozilla Firefox | Latest | Secondary |
| Safari (macOS/iOS) | Latest | If client uses Apple devices |

- Screen sizes: Desktop **1920×1080** (primary) and **1366×768**. Spot-check tablet/responsive where the UI is used on the move (e.g. clinician *My Visits*).
- Keep **DevTools → Network** and **Console** open during execution to capture API failures and JS errors for defect reports.

## 4. Status values (Excel `Status` column)

| Status | Meaning |
|--------|---------|
| **Pass** | Behaviour exactly matches the Expected Result. |
| **Fail** | Behaviour does not match Expected Result. Record **Severity** + **Remarks/Defect ID**. |
| **Blocked** | Cannot execute due to a dependency, environment issue, or another open defect. |
| **N/A** | Not applicable in this environment / configuration. |
| **Not Executed** | Default — not yet run. |

## 5. Defect severity

| Severity | Definition | Go-live impact |
|----------|------------|----------------|
| **Critical** | Core workflow blocked, data loss/corruption, security/privacy breach, or crash with no workaround. | **Blocker** — must fix before go-live. |
| **High** | Major feature broken or producing incorrect results; workaround difficult. | **Must fix** before go-live. |
| **Medium** | Feature works with a reasonable workaround, or a non-critical data/logic issue. | Fix soon; may ship with sign-off. |
| **Low** | Cosmetic, copy/wording, minor UI alignment. | Backlog. |

## 6. Defect reporting template

Log every Fail as a defect (tracker or sheet) and put its ID in the Excel **Remarks / Defect ID** column.

```
Defect ID      : SAR-<module>-<nnn>            (e.g. SAR-INV-014)
Linked Test ID : <e.g. INV-072>
Title          : <one-line summary>
Module / Screen: <module> / <screen>
Severity       : Critical | High | Medium | Low
Environment    : UAT / Prod   |  Browser + version  |  Role used
Preconditions  : <state before>
Steps to repro : 1) ... 2) ... 3) ...
Expected       : <from test case>
Actual         : <what happened>
Evidence       : <screenshot / screen recording / console error / failed API request+response>
Frequency      : Always | Intermittent
```

## 7. Entry criteria (before starting a cycle)

- [ ] UAT/test environment is up and the build/version under test is recorded.
- [ ] Admin, data_entry, and viewer test accounts exist and can log in.
- [ ] Baseline test data exists (see each module's *Test Data / Preconditions*).
- [ ] `KNOWN-ISSUES-PRE-FLAGGED.md` reviewed so known defects aren't re-raised.

## 8. Exit criteria (before go-live sign-off)

- [ ] 100% of **High**-priority cases executed.
- [ ] **0 Critical** and **0 High** defects open (or explicitly waived with written sign-off).
- [ ] All Medium/Low defects triaged with an owner and target date.
- [ ] Master Dashboard reviewed; overall pass-rate and open-defect summary signed off by QA lead + product owner.

## 9. General execution rules

- Follow steps **exactly**; if a step is ambiguous, mark **Blocked** and raise a query rather than guessing.
- Test the **negative/validation** cases as written — error handling is as important as the happy path for go-live.
- For **API** cases, use DevTools Network tab to confirm the request method/path/payload and the response status.
- Re-test (regression) any case whose related defect is fixed; note the build it was retested on.
- Don't overwrite another tester's rows; one workbook owner per module per cycle.

---

### Quick legend (also on each workbook's Module Info sheet)

`Status`: Pass / Fail / Blocked / N/A / Not Executed  •  `Severity`: Critical / High / Medium / Low
Amber columns = tester fills. Status cells auto-colour. Dashboard rolls up automatically.
