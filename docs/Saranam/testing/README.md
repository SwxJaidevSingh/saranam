# Saranam India Health Care — Manual Testing Pack (Go-Live)

**Platform:** Saranam India Health Care — https://saranam.fieldintel.ai
**Type:** Manual functional / UI / API / permission testing
**Version:** 1.0  •  **Prepared:** 2026-06-01
**Total test cases:** **686** across **8 modules**

This pack is the single source of truth the testing team uses to validate the platform before go-live. Each module has its **own** fillable Excel workbook plus a readable Markdown test plan. Testers record results in the Excel files; the **master workbook auto-rolls up** the pass/fail numbers.

---

## 1. What's in this pack

| File | Purpose |
|------|---------|
| `README.md` | This index — start here |
| `00-Test-Environment-Setup.md` | Environment, test accounts/roles, browsers, defect severity, status definitions, entry/exit criteria, defect-report template |
| `KNOWN-ISSUES-PRE-FLAGGED.md` | Defects already found in code while authoring this pack — read before execution so known issues aren't re-investigated |
| `xlsx/00_Saranam_Master_Test_Plan.xlsx` | **Master tracker** — Dashboard + one sheet per module, auto-calculated pass/fail rollup |
| `xlsx/01..08_<Module>_Test_Cases.xlsx` | One fillable workbook per module (hand to a tester per module) |
| `<NN>-<module>/<Module>_Test_Plan.md` | Readable Markdown test plan per module (scope, screens, APIs, full case table) |
| `<NN>-<module>/<module>_test_cases.json` | Machine-readable source of truth for each module's cases |
| `build_workbooks.py` | Regenerates all Excel files from the JSON (run after editing JSON) |

## 2. Modules & coverage

| # | Module | Code | Cases | High | Medium | Low | Excel file |
|---|--------|------|------:|-----:|-------:|----:|-----------|
| 1 | Patient Management | `PAT` | 145 | 55 | 53 | 37 | `xlsx/01_Patient_Management_Test_Cases.xlsx` |
| 2 | Scheduling | `SCH` | 118 | 48 | 49 | 21 | `xlsx/02_Scheduling_Test_Cases.xlsx` |
| 3 | Providers | `PRV` | 77 | 30 | 29 | 18 | `xlsx/03_Providers_Test_Cases.xlsx` |
| 4 | Inventory | `INV` | 120 | 48 | 44 | 28 | `xlsx/04_Inventory_Test_Cases.xlsx` |
| 5 | Analytics | `ANL` | 57 | 20 | 31 | 6 | `xlsx/05_Analytics_Test_Cases.xlsx` |
| 6 | Call Logs | `CL` | 84 | 27 | 36 | 21 | `xlsx/06_Call_Logs_Test_Cases.xlsx` |
| 7 | Users | `USR` | 52 | 27 | 20 | 5 | `xlsx/07_Users_Test_Cases.xlsx` |
| 8 | Settings | `SET` | 33 | 15 | 14 | 4 | `xlsx/08_Settings_Test_Cases.xlsx` |
| | **Total** | | **686** | **270** | **276** | **140** | |

> **Modules deliberately excluded** (per client scope for this round): Forms, Submissions, Service, IPD, OPD, Physiotherapy, Home Care, Appointments. Where these intersect a tested module (e.g. Form Analytics under Analytics), the boundary is noted as out-of-scope in that module's plan.

## 3. How the testing team uses it

1. **Read first:** `00-Test-Environment-Setup.md` (accounts, roles, URLs) and `KNOWN-ISSUES-PRE-FLAGGED.md`.
2. **Assign per module:** give each tester the relevant `xlsx/<NN>_<Module>_Test_Cases.xlsx`.
3. **Execute each case** following the **Test Steps** and compare against the **Expected Result**.
4. **Fill the amber columns only:**
   - **Actual Result** — what actually happened.
   - **Status** — dropdown: `Pass` / `Fail` / `Blocked` / `N/A` / `Not Executed` (default). Cell auto-colours.
   - **Severity** — dropdown (`Critical`/`High`/`Medium`/`Low`); fill only when Status = Fail.
   - **Tested By**, **Date Tested**, **Remarks / Defect ID**.
5. **Roll-up:** the **Module Info** sheet in each workbook and the **Dashboard** in the master workbook update pass/fail %s automatically (open the master and refresh if your editor caches formulas).
6. **Log defects** using the template in the environment-setup doc; put the defect ID in **Remarks / Defect ID**.

### Each module Excel workbook contains
- **Module Info** sheet — scope, roles & access, screens & routes, API endpoints, test data, severity legend, and a live execution summary.
- **Test Cases** sheet — 16 columns: `ID | Section | Title | Priority | Type | Preconditions | Steps | Test Data | Expected Result | API Reference | Actual Result | Status | Severity | Tested By | Date Tested | Remarks`. Header frozen, ID + Section frozen, auto-filter on, Status colour-coded.

## 4. Test types covered

Functional · UI/UX · Validation · Negative · API · Permission/Role · Edge Case · Data Integrity. Every screen's load/empty/loading states, every button/field/filter/sort/pagination/modal, every API endpoint (derived from the actual frontend API layer + backend routes — none invented), role-based access, and cross-module data integrity are covered.

## 5. Regenerating the Excel files

The JSON files are the source of truth. If you edit a JSON, rebuild the Excel pack:

```bash
python3 docs/Saranam/testing/build_workbooks.py
```

Requires Python with `openpyxl` (already available in this repo's environment).
