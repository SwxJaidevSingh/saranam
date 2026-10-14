#!/usr/bin/env python3
"""Generate Patient Registration Implementation Plan as PDF."""

from fpdf import FPDF
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


class PlanPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(130, 130, 130)
            self.cell(0, 8, "Patient Registration - Implementation Plan", align="C")
            self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, text):
        if self.get_y() > 250:
            self.add_page()
        self.ln(3)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(26, 86, 219)
        self.cell(0, 8, text)
        self.ln(9)
        self.set_draw_color(26, 86, 219)
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(5)

    def subsection_title(self, text):
        if self.get_y() > 265:
            self.add_page()
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(51, 51, 51)
        self.cell(0, 7, text)
        self.ln(8)

    def body_text(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(33, 33, 33)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def bullet(self, text, indent=False):
        if self.get_y() > 275:
            self.add_page()
        self.set_font("Helvetica", "", 10)
        self.set_text_color(33, 33, 33)
        x = self.l_margin + (12 if indent else 5)
        marker = "-" if indent else ">"
        self.set_x(x)
        self.cell(5, 5, marker)
        self.set_x(x + 5)
        w = self.w - self.r_margin - x - 5
        self.multi_cell(w, 5, text)
        self.ln(1)

    def code_block(self, text):
        if self.get_y() > 260:
            self.add_page()
        self.set_font("Courier", "", 8)
        self.set_text_color(50, 50, 50)
        self.set_fill_color(245, 245, 245)
        x = self.l_margin + 5
        self.set_x(x)
        w = self.w - self.r_margin - x
        self.multi_cell(w, 4.5, text, fill=True)
        self.ln(3)

    def warning_box(self, text):
        if self.get_y() > 260:
            self.add_page()
        self.set_fill_color(255, 243, 224)
        self.set_draw_color(255, 152, 0)
        self.set_line_width(0.3)
        y_start = self.get_y()
        self.set_x(self.l_margin + 3)
        w = self.w - self.r_margin - self.l_margin - 6
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(200, 100, 0)
        self.cell(w, 6, "!! WARNING", ln=True)
        self.set_x(self.l_margin + 3)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 60, 0)
        self.multi_cell(w, 5, text, fill=True)
        y_end = self.get_y()
        self.rect(self.l_margin + 2, y_start - 1, w + 2, y_end - y_start + 2)
        self.ln(4)

    def info_box(self, text):
        if self.get_y() > 260:
            self.add_page()
        self.set_fill_color(227, 242, 253)
        self.set_draw_color(33, 150, 243)
        self.set_line_width(0.3)
        y_start = self.get_y()
        self.set_x(self.l_margin + 3)
        w = self.w - self.r_margin - self.l_margin - 6
        self.set_font("Helvetica", "", 9)
        self.set_text_color(13, 71, 161)
        self.multi_cell(w, 5, text, fill=True)
        y_end = self.get_y()
        self.rect(self.l_margin + 2, y_start - 1, w + 2, y_end - y_start + 2)
        self.ln(4)

    def task_item(self, number, text, file_path=""):
        if self.get_y() > 270:
            self.add_page()
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(26, 86, 219)
        self.set_x(self.l_margin + 3)
        self.cell(8, 5, f"{number}.")
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(33, 33, 33)
        self.multi_cell(0, 5, text)
        if file_path:
            self.set_font("Courier", "", 7.5)
            self.set_text_color(100, 100, 100)
            self.set_x(self.l_margin + 11)
            self.cell(0, 4, file_path)
            self.ln(5)
        else:
            self.ln(2)

    def table_row(self, cells, widths, bold=False, fill_color=None):
        if self.get_y() > 275:
            self.add_page()
        h = 7
        if fill_color:
            self.set_fill_color(*fill_color)
        self.set_font("Helvetica", "B" if bold else "", 8)
        if bold:
            self.set_text_color(255, 255, 255)
        else:
            self.set_text_color(33, 33, 33)
        for i, (cell, w) in enumerate(zip(cells, widths)):
            self.cell(w, h, cell, border=1, fill=bool(fill_color), align="C" if i == 0 else "L")
        self.ln()


def generate():
    pdf = PlanPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ─── TITLE PAGE ──────────────────────────────────────────────────────
    pdf.ln(30)
    pdf.set_font("Helvetica", "B", 26)
    pdf.set_text_color(26, 86, 219)
    pdf.multi_cell(0, 12, "Patient Registration\nImplementation Plan", align="C")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, "Saranam Home Care Platform", align="C")
    pdf.ln(10)
    pdf.cell(0, 7, "Prepared: 30 March 2026", align="C")
    pdf.ln(7)
    pdf.cell(0, 7, "Based on: Client Meeting - 30 March 2026", align="C")
    pdf.ln(20)

    # Scope box
    pdf.set_draw_color(200, 200, 200)
    pdf.set_line_width(0.3)
    pdf.line(pdf.l_margin + 20, pdf.get_y(), pdf.w - pdf.r_margin - 20, pdf.get_y())
    pdf.ln(8)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(51, 51, 51)
    pdf.cell(0, 7, "Scope of Changes", align="C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    scope_items = [
        "1. Patient Category: Boolean (BSC/N-BSC) --> 4-value enum system",
        "2. Diagnosis: New mandatory dropdown field (18 cancer types)",
        "3. Referred From: New field with predefined referral sources",
        "4. Patient Priority: Allow blank at registration",
        "5. Date of Birth: Approximate age support",
        "6. Geocoding: Search-based location lookup",
    ]
    for item in scope_items:
        pdf.cell(0, 6, item, align="C")
        pdf.ln(6)

    # ─── PAGE 2: CURRENT STATE ANALYSIS ──────────────────────────────────
    pdf.add_page()
    pdf.section_title("1. Current State Analysis")

    pdf.subsection_title("1.1 Patient Category - Current Implementation")
    pdf.body_text(
        "The patient category is currently stored as a BOOLEAN field 'bsc_status' in the patients table. "
        "True = BSC (Best Supportive Care), False = N-BSC. This boolean is then mirrored as a string "
        "'care_status' in the patient_scheduling_meta table ('bsc' or 'n_bsc')."
    )

    pdf.body_text("Files that directly reference bsc_status / care_status:")
    pdf.ln(2)

    files_table = [
        ("Backend", "patients/models.py", "Boolean column definition"),
        ("Backend", "patients/schemas.py", "Pydantic validation (5 schemas)"),
        ("Backend", "patients/routes.py", "API filter parameter"),
        ("Backend", "patients/services.py", "Response builder + search filter"),
        ("Backend", "saranam/models/patient_scheduling_meta.py", "care_status string field"),
        ("Backend", "saranam/services/patient_pool_service.py", "Priority scoring + pool filtering"),
        ("Backend", "saranam/services/schedule_service.py", "BSC statistics calculation"),
        ("Backend", "call_logs/service.py", "Call priority ordering"),
        ("Backend", "seed_demo_data.py", "Demo data seeding"),
        ("Frontend", "components/patients/PatientQuickAdd.jsx", "Registration form toggle"),
        ("Frontend", "pages/patients/PatientsList.jsx", "Filter: All/BSC/N-BSC"),
        ("Frontend", "api/patients.js", "API param: bsc_status"),
        ("Frontend", "context/PatientContext.jsx", "State mgmt: bscStatus param"),
        ("Frontend", "pages/saranam/scheduling/PatientPoolPage.jsx", "Care status filter"),
        ("Frontend", "pages/saranam/scheduling/WeeklyPlanningBoard.jsx", "BSC display/badges"),
        ("Frontend", "pages/saranam/scheduling/KitReadinessPage.jsx", "BSC reference"),
        ("Frontend", "pages/saranam/scheduling/AlertsPage.jsx", "BSC alerts"),
        ("Frontend", "pages/saranam/scheduling/MyVisitsPage.jsx", "BSC display"),
        ("Frontend", "pages/saranam/scheduling/ReviewDashboardPage.jsx", "BSC review stats"),
        ("Frontend", "pages/saranam/scheduling/DailyVisitPage.jsx", "BSC display"),
        ("Frontend", "utils/generateSchedulePDF.js", "PDF: BSC column + stats"),
    ]

    col_w = [20, 80, 90]
    pdf.table_row(["Layer", "File", "Usage"], col_w, bold=True, fill_color=(26, 86, 219))
    for layer, f, usage in files_table:
        pdf.table_row([layer, f, usage], col_w)

    pdf.ln(3)
    pdf.warning_box(
        "CRITICAL: Changing bsc_status from Boolean to a 4-value string field is a cross-cutting change "
        "that touches 21+ files. A database migration is required, and all existing data must be mapped. "
        "This is the highest-risk change in the patient registration scope."
    )

    # ─── 1.2 Priority Scoring Impact ─────────────────────────────────────
    pdf.subsection_title("1.2 Priority Scoring Algorithm - Current Logic")
    pdf.body_text("The scheduling priority score currently uses bsc_status as a major factor:")
    pdf.code_block(
        "if meta.care_status == 'bsc':      score += 50   # BSC gets +50\n"
        "complexity_scores = {'high': 30, 'medium': 20, 'low': 10}\n"
        "if meta.last_visit_date is None:    score += 25   # Never visited\n"
        "if meta.lead_flagged:               score += 40   # Flagged by lead\n"
        "if overdue_days > 0:               score += overdue_days * 5"
    )
    pdf.body_text(
        "With 4 categories, the scoring needs to be re-calibrated. Proposed new scoring "
        "is covered in Section 3 (Phase 1, Task 6)."
    )

    # ─── PHASE 0: QUESTIONS ──────────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("2. Questions Requiring Clarification")

    pdf.warning_box(
        "These questions MUST be answered before implementation begins. "
        "Answers will determine migration strategy and algorithm changes."
    )

    questions = [
        (
            "Q1: Data Migration - Existing Patients",
            "Current patients have bsc_status = true (BSC) or false (N-BSC). When we migrate to 4 categories, "
            "we don't know if an existing BSC patient is Onco or Non-Onco.\n\n"
            "Options:\n"
            "A) Map all existing BSC=true --> 'BSC-Onco' and BSC=false --> 'Non-BSC-Onco' (assume all are Onco)\n"
            "B) Map all to a temporary 'Unclassified-BSC' / 'Unclassified-Non-BSC' and require manual reclassification\n"
            "C) Map based on diagnosis data if available, otherwise default to Onco\n\n"
            "Recommendation: Option A (simplest, can be corrected later)"
        ),
        (
            "Q2: Priority Scoring for New Categories",
            "Currently BSC patients get +50 priority points. With 4 categories, what should the hierarchy be?\n\n"
            "Proposed scoring:\n"
            "  BSC-Onco:         +50 (highest priority - palliative oncology)\n"
            "  BSC-Non-Onco:     +40 (palliative non-oncology)\n"
            "  Non-BSC-Onco:     +30 (active treatment oncology)\n"
            "  Non-BSC-Non-Onco: +20 (active treatment non-oncology)\n\n"
            "Does this hierarchy match clinical priority? Please confirm or adjust."
        ),
        (
            "Q3: Scheduling Pool Filters",
            "Currently the patient pool can be filtered by 'bsc' or 'n_bsc'. With 4 categories:\n\n"
            "Option A) Show all 4 as individual filter options\n"
            "Option B) Group filters: 'All BSC' / 'All Non-BSC' / 'All Onco' / 'All Non-Onco' + individual 4\n"
            "Option C) Two separate filter dropdowns: one for BSC/Non-BSC, one for Onco/Non-Onco\n\n"
            "Recommendation: Option C (gives most flexibility with least UI clutter)"
        ),
        (
            "Q4: Diagnosis Dropdown - Editable by Admin?",
            "The client said 'we can add to this, if the access is given'. Should we:\n\n"
            "A) Hardcode the 18 cancer types + 'Other' in frontend (simpler, faster)\n"
            "B) Create a diagnosis_types table in DB with an admin UI to manage entries\n\n"
            "Recommendation: Option A for now, migrate to B in a later sprint"
        ),
        (
            "Q5: Referred From - Values",
            "Confirmed sources: KC General, Kidwai, Doctor Outside.\n"
            "Should we also include: Self-referral, NGO referral, PHC referral?\n"
            "Should this be a free-text + dropdown combo or strict dropdown only?"
        ),
        (
            "Q6: Approximate Age - How to store?",
            "When a patient gives approximate age (e.g., '50'), we calculate DOB as Jan 1, (current_year - age).\n"
            "Should we add an 'is_approximate_dob' boolean flag so the system knows the DOB was estimated?\n"
            "This matters for age-based analytics accuracy."
        ),
    ]

    for title, body in questions:
        pdf.subsection_title(title)
        pdf.body_text(body)

    # ─── PHASE 1: PATIENT CATEGORY MIGRATION ─────────────────────────────
    pdf.add_page()
    pdf.section_title("3. Phase 1 - Patient Category System (Boolean --> Enum)")

    pdf.info_box(
        "This is the highest-priority and highest-risk change. It must be done first because "
        "all other features (diagnosis display, PDF changes, scheduling) depend on the category system."
    )

    pdf.subsection_title("Step 1: Database Migration")
    pdf.task_item("1a", "Create new column 'patient_category' (String(20)) in patients table",
                  "backend/app/patients/models.py")
    pdf.bullet("Add column: patient_category = Column(String(20), nullable=False, default='BSC_ONCO')")
    pdf.bullet("Valid values: 'BSC_ONCO', 'NON_BSC_ONCO', 'BSC_NON_ONCO', 'NON_BSC_NON_ONCO'")
    pdf.ln(2)

    pdf.task_item("1b", "Write Alembic migration script",
                  "backend/migrations/versions/xxxx_patient_category_enum.py")
    pdf.bullet("Add patient_category column with server_default='BSC_ONCO'")
    pdf.bullet("Migrate existing data: bsc_status=True --> 'BSC_ONCO', bsc_status=False --> 'NON_BSC_ONCO'")
    pdf.bullet("Keep bsc_status column temporarily for rollback safety")
    pdf.bullet("Add index on patient_category for query performance")
    pdf.ln(2)

    pdf.code_block(
        "# Migration pseudo-code:\n"
        "op.add_column('patients', sa.Column('patient_category', sa.String(20),\n"
        "              server_default='BSC_ONCO', nullable=False))\n"
        "op.execute(\"UPDATE patients SET patient_category = \"\n"
        "           \"CASE WHEN bsc_status = true THEN 'BSC_ONCO' \"\n"
        "           \"ELSE 'NON_BSC_ONCO' END\")\n"
        "op.create_index('ix_patients_patient_category', 'patients', ['patient_category'])"
    )

    pdf.task_item("1c", "Update PatientSchedulingMeta.care_status to match new values",
                  "backend/app/saranam/models/patient_scheduling_meta.py")
    pdf.bullet("Change care_status from String(10) to String(20)")
    pdf.bullet("Migrate: 'bsc' --> 'BSC_ONCO', 'n_bsc' --> 'NON_BSC_ONCO'")
    pdf.ln(2)

    pdf.warning_box(
        "DO NOT drop the bsc_status column in this migration. Keep it for 1 sprint as a rollback safety net. "
        "Drop it in a follow-up migration after confirming everything works."
    )

    # Step 2
    pdf.subsection_title("Step 2: Backend Model & Schema Updates")
    pdf.task_item("2a", "Update Patient model - add patient_category, deprecate bsc_status",
                  "backend/app/patients/models.py")
    pdf.bullet("Add: patient_category = Column(String(20), nullable=False, default='BSC_ONCO')")
    pdf.bullet("Add helper property: is_bsc --> returns True if category starts with 'BSC_'")
    pdf.bullet("Add helper property: is_onco --> returns True if category ends with '_ONCO'")
    pdf.ln(2)

    pdf.task_item("2b", "Update ALL Pydantic schemas (5 schemas)",
                  "backend/app/patients/schemas.py")
    pdf.bullet("PatientCreateSchema: Replace bsc_status:bool with patient_category:str + validator")
    pdf.bullet("PatientUpdateSchema: Replace bsc_status:Optional[bool] with patient_category:Optional[str]")
    pdf.bullet("PatientResponseSchema: Replace bsc_status:bool with patient_category:str")
    pdf.bullet("PatientListItemSchema: Replace bsc_status:bool with patient_category:str")
    pdf.bullet("PatientSearchSchema: Replace bsc_status:Optional[bool] with patient_category:Optional[str]")
    pdf.bullet("Add validator: validate_patient_category with whitelist of 4 values")
    pdf.ln(2)

    pdf.code_block(
        "VALID_CATEGORIES = ['BSC_ONCO', 'NON_BSC_ONCO', 'BSC_NON_ONCO', 'NON_BSC_NON_ONCO']\n\n"
        "CATEGORY_LABELS = {\n"
        "    'BSC_ONCO': 'BSC Onco',\n"
        "    'NON_BSC_ONCO': 'Non-BSC Onco',\n"
        "    'BSC_NON_ONCO': 'BSC Non-Onco',\n"
        "    'NON_BSC_NON_ONCO': 'Non-BSC Non-Onco',\n"
        "}"
    )

    # Step 3
    pdf.subsection_title("Step 3: Backend Service & Route Updates")
    pdf.task_item("3a", "Update patient service layer",
                  "backend/app/patients/services.py")
    pdf.bullet("_prepare_patient_response: Return patient_category instead of bsc_status")
    pdf.bullet("search_patients: Update filter logic from boolean to string matching")
    pdf.bullet("Support filtering by: exact category, 'all_bsc' (both BSC_*), 'all_onco' (both *_ONCO)")
    pdf.ln(2)

    pdf.task_item("3b", "Update patient routes",
                  "backend/app/patients/routes.py")
    pdf.bullet("Change query param from 'bsc_status' (bool) to 'patient_category' (string)")
    pdf.bullet("Support comma-separated values for multi-filter: ?patient_category=BSC_ONCO,BSC_NON_ONCO")
    pdf.ln(2)

    pdf.task_item("3c", "Update call log service",
                  "backend/app/call_logs/service.py")
    pdf.bullet("Change: desc(Patient.bsc_status) --> custom ordering by patient_category")
    pdf.bullet("Order: BSC_ONCO > BSC_NON_ONCO > NON_BSC_ONCO > NON_BSC_NON_ONCO")
    pdf.ln(2)

    # Step 4
    pdf.subsection_title("Step 4: Scheduling System Updates")
    pdf.task_item("4a", "Update patient pool service - priority scoring",
                  "backend/app/saranam/services/patient_pool_service.py")
    pdf.bullet("Replace: if care_status == 'bsc': score += 50")
    pdf.bullet("With tiered scoring:")
    pdf.code_block(
        "CATEGORY_SCORES = {\n"
        "    'BSC_ONCO': 50,\n"
        "    'BSC_NON_ONCO': 40,\n"
        "    'NON_BSC_ONCO': 30,\n"
        "    'NON_BSC_NON_ONCO': 20,\n"
        "}\n"
        "score += CATEGORY_SCORES.get(meta.care_status, 20)"
    )
    pdf.ln(1)

    pdf.task_item("4b", "Update patient pool filtering",
                  "backend/app/saranam/services/patient_pool_service.py")
    pdf.bullet("Replace boolean filter with string-based category filter")
    pdf.bullet("Update _ensure_meta_for_patient to map patient_category --> care_status")
    pdf.ln(2)

    pdf.task_item("4c", "Update schedule service statistics",
                  "backend/app/saranam/services/schedule_service.py")
    pdf.bullet("Replace: bsc_patients count --> category breakdown dict")
    pdf.bullet("Track: {BSC_ONCO: 3, NON_BSC_ONCO: 2, ...} instead of single bsc count")
    pdf.ln(2)

    # Step 5
    pdf.subsection_title("Step 5: Frontend Updates")
    pdf.task_item("5a", "Update PatientQuickAdd registration form",
                  "frontend/src/components/patients/PatientQuickAdd.jsx")
    pdf.bullet("Replace BSC toggle (boolean) with a 4-option dropdown/radio group")
    pdf.bullet("Options: BSC Onco, Non-BSC Onco, BSC Non-Onco, Non-BSC Non-Onco")
    pdf.bullet("Default: none selected (force user to choose)")
    pdf.bullet("Update form state: bsc_status:bool --> patient_category:string")
    pdf.bullet("Update submission payload")
    pdf.ln(2)

    pdf.task_item("5b", "Update PatientsList page filters",
                  "frontend/src/pages/patients/PatientsList.jsx")
    pdf.bullet("Replace 3-state toggle (All/BSC/N-BSC) with dropdown")
    pdf.bullet("Options: All, BSC Onco, Non-BSC Onco, BSC Non-Onco, Non-BSC Non-Onco")
    pdf.bullet("Update badge colors: 4 distinct colors for 4 categories")
    pdf.ln(2)

    pdf.task_item("5c", "Update API client",
                  "frontend/src/api/patients.js")
    pdf.bullet("Change param name: bsc_status --> patient_category")
    pdf.bullet("Update search() function signature and callers")
    pdf.ln(2)

    pdf.task_item("5d", "Update PatientContext",
                  "frontend/src/context/PatientContext.jsx")
    pdf.bullet("Change: bscStatus param --> patientCategory in searchPatients()")
    pdf.ln(2)

    pdf.task_item("5e", "Update ALL scheduling pages (6 files)",
                  "frontend/src/pages/saranam/scheduling/*.jsx")
    pdf.bullet("PatientPoolPage.jsx - Update CARE_STATUS_OPTIONS from ['bsc','n_bsc'] to 4 values")
    pdf.bullet("WeeklyPlanningBoard.jsx - Update category badges and display")
    pdf.bullet("KitReadinessPage.jsx - Update BSC references")
    pdf.bullet("AlertsPage.jsx - Update BSC alert logic")
    pdf.bullet("MyVisitsPage.jsx - Update category display")
    pdf.bullet("ReviewDashboardPage.jsx - Update review stats")
    pdf.bullet("DailyVisitPage.jsx - Update category display")
    pdf.ln(2)

    pdf.task_item("5f", "Update Schedule PDF generation",
                  "frontend/src/utils/generateSchedulePDF.js")
    pdf.bullet("Replace 'BSC' column with 'Category' column")
    pdf.bullet("Show abbreviated labels: BSC-O, NB-O, BSC-NO, NB-NO")
    pdf.bullet("Update statistics section: show category breakdown instead of BSC count")
    pdf.bullet("Update cell coloring logic for 4 categories")
    pdf.ln(2)

    pdf.task_item("5g", "Update seed demo data",
                  "backend/seed_demo_data.py")
    pdf.bullet("Replace 'bsc': True/False with 'category': 'BSC_ONCO' etc.")
    pdf.bullet("Distribute demo patients across all 4 categories")
    pdf.ln(2)

    # Step 6
    pdf.subsection_title("Step 6: Create Shared Constants")
    pdf.body_text(
        "To avoid duplication and ensure consistency, create shared constant files:"
    )
    pdf.task_item("6a", "Backend constants",
                  "backend/app/constants.py (new file)")
    pdf.code_block(
        "PATIENT_CATEGORIES = ['BSC_ONCO','NON_BSC_ONCO','BSC_NON_ONCO','NON_BSC_NON_ONCO']\n"
        "CATEGORY_LABELS = {...}\n"
        "CATEGORY_PRIORITY_SCORES = {...}"
    )
    pdf.task_item("6b", "Frontend constants",
                  "frontend/src/constants/patientCategories.js (new file)")
    pdf.code_block(
        "export const PATIENT_CATEGORIES = [\n"
        "  { value: 'BSC_ONCO', label: 'BSC Onco', short: 'BSC-O', color: '#EF4444' },\n"
        "  { value: 'NON_BSC_ONCO', label: 'Non-BSC Onco', short: 'NB-O', color: '#F59E0B' },\n"
        "  { value: 'BSC_NON_ONCO', label: 'BSC Non-Onco', short: 'BSC-NO', color: '#3B82F6' },\n"
        "  { value: 'NON_BSC_NON_ONCO', label: 'Non-BSC Non-Onco', short:'NB-NO', color:'#10B981'},\n"
        "];"
    )

    # ─── PHASE 2: OTHER REGISTRATION FIELDS ──────────────────────────────
    pdf.add_page()
    pdf.section_title("4. Phase 2 - New Registration Fields")

    pdf.subsection_title("4.1 Diagnosis Field (Mandatory Dropdown)")

    pdf.task_item("1", "Add diagnosis column to patients table",
                  "backend/app/patients/models.py")
    pdf.bullet("diagnosis = Column(String(100), nullable=True)  # nullable for existing data")
    pdf.bullet("Make mandatory in schema validation (PatientCreateSchema) but nullable in DB for migration")
    pdf.ln(2)

    pdf.task_item("2", "Write migration: add diagnosis column",
                  "backend/migrations/versions/xxxx_add_diagnosis_field.py")
    pdf.bullet("Add column with nullable=True (existing patients won't have diagnosis)")
    pdf.bullet("Set default=NULL for existing records")
    pdf.ln(2)

    pdf.task_item("3", "Update schemas with diagnosis field + validator",
                  "backend/app/patients/schemas.py")
    pdf.bullet("PatientCreateSchema: diagnosis: str (required, validated against dropdown list)")
    pdf.bullet("PatientUpdateSchema: diagnosis: Optional[str]")
    pdf.bullet("PatientResponseSchema, PatientListItemSchema: include diagnosis")
    pdf.ln(2)

    pdf.task_item("4", "Add diagnosis dropdown to PatientQuickAdd form",
                  "frontend/src/components/patients/PatientQuickAdd.jsx")
    pdf.bullet("Searchable dropdown with 18 cancer types + 'Other' with free-text")
    pdf.bullet("Mark as required (red asterisk, validation)")
    pdf.ln(2)

    pdf.task_item("5", "Display diagnosis in PatientsList and PatientCard",
                  "frontend/src/pages/patients/PatientsList.jsx")
    pdf.bullet("Add diagnosis badge/tag to patient list items")
    pdf.bullet("Add diagnosis filter dropdown to list filters")
    pdf.ln(2)

    pdf.code_block(
        "DIAGNOSIS_OPTIONS = [\n"
        "  'Breast cancer', 'Oral cancer', 'Cervical cancer', 'Lung cancer',\n"
        "  'Colorectal cancers', 'Stomach cancer', 'GEJ carcinoma', 'ALL',\n"
        "  'Neuroblastoma', 'Ewings sarcoma', 'Renal Cell Carcinoma',\n"
        "  'Prostate cancer', 'Melanoma', 'Liver cancer', 'Gallbladder cancer',\n"
        "  'Bladder cancer', 'Penile cancer', 'Pancreatic cancer', 'Other'\n"
        "]"
    )

    # 4.2 Referred From
    pdf.subsection_title("4.2 Referred From (New Field)")

    pdf.task_item("1", "Add referred_from column to patients table",
                  "backend/app/patients/models.py")
    pdf.bullet("referred_from = Column(String(100), nullable=True)")
    pdf.ln(2)

    pdf.task_item("2", "Write migration + update schemas",
                  "backend/app/patients/schemas.py")
    pdf.bullet("Optional field in create/update schemas")
    pdf.bullet("Validator against predefined list + 'Other' option")
    pdf.ln(2)

    pdf.task_item("3", "Add dropdown in PatientQuickAdd",
                  "frontend/src/components/patients/PatientQuickAdd.jsx")
    pdf.bullet("Options: KC General Hospital, Kidwai Memorial Institute, Doctor Outside, Self-Referral, Other")
    pdf.bullet("'Other' shows a text input for custom entry")
    pdf.ln(2)

    # 4.3 Patient Priority
    pdf.subsection_title("4.3 Patient Priority (Allow Blank)")
    pdf.body_text(
        "clinical_complexity currently defaults to 'medium'. Change to allow NULL/blank at registration."
    )
    pdf.task_item("1", "Update schema default from 'medium' to None",
                  "backend/app/patients/schemas.py")
    pdf.task_item("2", "Update model default from 'medium' to None",
                  "backend/app/patients/models.py")
    pdf.task_item("3", "Update frontend to show 'Not Assessed' when blank",
                  "frontend/src/components/patients/PatientQuickAdd.jsx")
    pdf.bullet("Remove default selection in complexity dropdown")
    pdf.bullet("Add placeholder: 'Will be assessed after first visit'")
    pdf.ln(2)

    # 4.4 DOB Flexibility
    pdf.subsection_title("4.4 Date of Birth - Approximate Age Support")
    pdf.task_item("1", "Add is_approximate_dob flag to Patient model",
                  "backend/app/patients/models.py")
    pdf.bullet("is_approximate_dob = Column(Boolean, default=False)")
    pdf.ln(2)

    pdf.task_item("2", "Update PatientQuickAdd form",
                  "frontend/src/components/patients/PatientQuickAdd.jsx")
    pdf.bullet("Add toggle: 'Exact DOB' / 'Approximate Age'")
    pdf.bullet("When 'Approximate Age' selected: show number input for age")
    pdf.bullet("Auto-calculate: DOB = Jan 1, (current_year - entered_age)")
    pdf.bullet("Set is_approximate_dob = true in submission")
    pdf.ln(2)

    pdf.task_item("3", "Display indicator in patient views",
                  "frontend/src/pages/patients/PatientDetail.jsx")
    pdf.bullet("Show '~' prefix before age when is_approximate_dob is true (e.g., '~50 yrs')")
    pdf.ln(2)

    # 4.5 Geocoding
    pdf.subsection_title("4.5 Geocoding Search Enhancement")
    pdf.task_item("1", "Integrate geocoding API in map component",
                  "frontend/src/components/patients/PatientQuickAdd.jsx")
    pdf.bullet("Add search input above map")
    pdf.bullet("Use Google Maps Geocoding or OpenStreetMap Nominatim API")
    pdf.bullet("On search: move map pin to result location, auto-fill address fields")
    pdf.ln(2)

    pdf.task_item("2", "Show distance from Kidwai after location capture")
    pdf.bullet("Calculate haversine distance from patient location to Kidwai coordinates")
    pdf.bullet("Display: 'Approximately X.X km from Kidwai Memorial Hospital'")
    pdf.bullet("Show within/outside service radius indicator")
    pdf.ln(2)

    # ─── TASK CHECKLIST ──────────────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("5. Implementation Checklist & Order")

    pdf.info_box(
        "Execute in this exact order. Phase 1 (Category) must be fully complete before Phase 2 "
        "because diagnosis display, PDF generation, and scheduling all depend on the new category system."
    )

    pdf.subsection_title("Phase 1: Patient Category (Estimated: 2-3 days)")
    tasks_p1 = [
        ("1", "Create shared constants (backend + frontend)", "0.5h"),
        ("2", "Write Alembic migration for patient_category + care_status", "1h"),
        ("3", "Update Patient model (add patient_category, keep bsc_status)", "0.5h"),
        ("4", "Update all 5 Pydantic schemas + validators", "1h"),
        ("5", "Update patient services (response, search, filters)", "1h"),
        ("6", "Update patient routes (API param change)", "0.5h"),
        ("7", "Update patient_pool_service (priority scoring + filtering)", "1.5h"),
        ("8", "Update schedule_service (statistics)", "0.5h"),
        ("9", "Update call_logs service (ordering)", "0.5h"),
        ("10", "Update PatientQuickAdd form (toggle --> dropdown)", "1h"),
        ("11", "Update PatientsList (filters + badges)", "1h"),
        ("12", "Update API client + PatientContext", "0.5h"),
        ("13", "Update 6 scheduling pages", "2h"),
        ("14", "Update generateSchedulePDF.js", "1h"),
        ("15", "Update seed_demo_data.py", "0.5h"),
        ("16", "End-to-end testing", "2h"),
    ]
    col_w2 = [10, 130, 20]
    pdf.table_row(["#", "Task", "Est."], col_w2, bold=True, fill_color=(26, 86, 219))
    for num, task, est in tasks_p1:
        pdf.table_row([num, task, est], col_w2)

    pdf.ln(5)
    pdf.subsection_title("Phase 2: New Fields (Estimated: 1-2 days)")
    tasks_p2 = [
        ("1", "Migration: add diagnosis, referred_from, is_approximate_dob columns", "0.5h"),
        ("2", "Update Patient model with new columns", "0.5h"),
        ("3", "Update schemas + validators for new fields", "1h"),
        ("4", "Update patient service response builder", "0.5h"),
        ("5", "Frontend: Diagnosis dropdown in PatientQuickAdd", "1h"),
        ("6", "Frontend: Referred From dropdown in PatientQuickAdd", "0.5h"),
        ("7", "Frontend: Approximate age toggle + auto-DOB calculation", "1h"),
        ("8", "Frontend: Geocoding search in map component", "1.5h"),
        ("9", "Frontend: Distance from Kidwai display", "1h"),
        ("10", "Frontend: clinical_complexity allow blank + 'Not Assessed' display", "0.5h"),
        ("11", "Display new fields in PatientsList, PatientDetail, PatientCard", "1h"),
        ("12", "End-to-end testing", "1.5h"),
    ]
    pdf.table_row(["#", "Task", "Est."], col_w2, bold=True, fill_color=(26, 86, 219))
    for num, task, est in tasks_p2:
        pdf.table_row([num, task, est], col_w2)

    # ─── RISK MATRIX ─────────────────────────────────────────────────────
    pdf.add_page()
    pdf.section_title("6. Risk Assessment")

    risks = [
        ("HIGH", "Category migration breaks scheduling", "Run migration on staging first. Keep bsc_status for rollback."),
        ("HIGH", "Priority scoring imbalance", "Test with demo data. Get clinical team sign-off on scores."),
        ("MED", "Frontend filter state inconsistency", "Clear all cached filters on deploy. Version API responses."),
        ("MED", "PDF generation breaks", "Snapshot current PDFs. Compare before/after visually."),
        ("LOW", "Existing API consumers break", "Document API changes. Provide 1-sprint deprecation period."),
        ("LOW", "Geocoding API rate limits", "Cache results. Use free tier Nominatim with fallback."),
    ]

    col_w3 = [18, 68, 104]
    pdf.table_row(["Risk", "Description", "Mitigation"], col_w3, bold=True, fill_color=(26, 86, 219))
    for level, desc, mitigation in risks:
        pdf.table_row([level, desc, mitigation], col_w3)

    # ─── FILE IMPACT SUMMARY ─────────────────────────────────────────────
    pdf.ln(8)
    pdf.section_title("7. Complete File Impact Map")

    pdf.subsection_title("Backend Files (11 files)")
    backend_files = [
        "app/patients/models.py            -- Add patient_category, diagnosis, referred_from, is_approximate_dob",
        "app/patients/schemas.py           -- Update 5 schemas, add new field validators",
        "app/patients/routes.py            -- Change filter params",
        "app/patients/services.py          -- Update response builder, search filters",
        "app/saranam/models/patient_scheduling_meta.py -- Widen care_status to String(20)",
        "app/saranam/services/patient_pool_service.py  -- New priority scoring, new filters",
        "app/saranam/services/schedule_service.py      -- Category breakdown stats",
        "app/call_logs/service.py          -- Update ordering",
        "app/constants.py                  -- NEW: shared constants",
        "migrations/versions/xxxx_*.py     -- NEW: 2 migration files",
        "seed_demo_data.py                 -- Update demo data",
    ]
    for f in backend_files:
        pdf.bullet(f)

    pdf.subsection_title("Frontend Files (13 files)")
    frontend_files = [
        "src/constants/patientCategories.js             -- NEW: shared constants + colors",
        "src/components/patients/PatientQuickAdd.jsx     -- Category dropdown, diagnosis, referred_from, DOB toggle",
        "src/pages/patients/PatientsList.jsx             -- Filter updates, badge colors",
        "src/pages/patients/PatientDetail.jsx            -- Display new fields",
        "src/components/patients/PatientCard.jsx         -- Category badge update",
        "src/api/patients.js                             -- API param rename",
        "src/context/PatientContext.jsx                  -- State param rename",
        "src/pages/saranam/scheduling/PatientPoolPage.jsx      -- Category filter",
        "src/pages/saranam/scheduling/WeeklyPlanningBoard.jsx  -- Category display",
        "src/pages/saranam/scheduling/KitReadinessPage.jsx     -- Category reference",
        "src/pages/saranam/scheduling/AlertsPage.jsx           -- Category alerts",
        "src/pages/saranam/scheduling/MyVisitsPage.jsx         -- Category display",
        "src/pages/saranam/scheduling/ReviewDashboardPage.jsx  -- Category stats",
        "src/pages/saranam/scheduling/DailyVisitPage.jsx       -- Category display",
        "src/utils/generateSchedulePDF.js                      -- PDF category column",
    ]
    for f in frontend_files:
        pdf.bullet(f)

    pdf.ln(5)
    pdf.body_text("Total files impacted: 24 files (11 backend + 13 frontend) + 2 new files")

    # Save
    path = os.path.join(OUTPUT_DIR, "patient-registration-plan.pdf")
    pdf.output(path)
    print(f"PDF saved: {path}")
    return path


if __name__ == "__main__":
    generate()
