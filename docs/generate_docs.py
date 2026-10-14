#!/usr/bin/env python3
"""Generate DOCX and PDF versions of the requirements document."""

from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from fpdf import FPDF
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── Content Data ───────────────────────────────────────────────────────────

TITLE = "Saranam Home Care - Client Meeting Requirements"
SUBTITLE = "Date: 30 March 2026"
ATTENDEES = "Attendees: Anish, Dr. Ashwini, Dr. Anvita, Dr. Amrita, Dr. Ram, Arnav, Farzan, Ayush"

SECTIONS = [
    {
        "number": "1",
        "title": "Patient Registration",
        "items": [
            {
                "number": "1.1",
                "title": "Date of Birth Flexibility",
                "bullets": [
                    "Patients may not know their exact date of birth.",
                    "Allow entering an approximate age (e.g., \"50\" or \"45\").",
                    "System should auto-calculate DOB as 1st January of (current year - age), same logic as OBLS.",
                ],
            },
            {
                "number": "1.2",
                "title": "Patient Category (New Field)",
                "bullets": [
                    "Replace or extend existing category system with 4 categories:",
                    "  1. BSC-Onco (Best Supportive Care - Oncology)",
                    "  2. Non-BSC-Onco (Non-Best Supportive Care - Oncology)",
                    "  3. BSC-Non-Onco (Best Supportive Care - Non-Oncology)",
                    "  4. Non-BSC-Non-Onco (Non-Best Supportive Care - Non-Oncology)",
                ],
            },
            {
                "number": "1.3",
                "title": "Referred From (New Field)",
                "bullets": [
                    "Add a \"Referred From\" field during registration.",
                    "Options: KC General Hospital, Kidwai Memorial Institute of Oncology, Doctor outside (external referral).",
                    "Allow the team to add/manage referral sources from UI.",
                ],
            },
            {
                "number": "1.4",
                "title": "Diagnosis (New Mandatory Field)",
                "bullets": [
                    "Add diagnosis as a mandatory field during patient registration.",
                    "Implement as a dropdown (not free text) for data standardization.",
                    "Dropdown values: Breast cancer, Oral cancer, Cervical cancer, Lung cancer, Colorectal cancers, Stomach cancer, GEJ carcinoma, ALL, Neuroblastoma, Ewings sarcoma, Renal Cell Carcinoma, Prostate cancer, Melanoma, Liver cancer, Gallbladder cancer, Bladder cancer, Penile cancer, Pancreatic cancer.",
                    "Allow an \"Other\" option with free-text entry.",
                    "The team should be able to add new diagnoses to the dropdown list over time.",
                ],
            },
            {
                "number": "1.5",
                "title": "Location & Geocoding Enhancements",
                "bullets": [
                    "Implement geocoding search: typing \"Kidwai Hospital\" should navigate the map directly to that location.",
                    "Address labels can be renamed to more intuitive labels (e.g., \"Landmark\") per team preference.",
                    "All patient location data should be editable after registration.",
                ],
            },
            {
                "number": "1.6",
                "title": "Patient Priority",
                "bullets": [
                    "Priority may not be known at registration - only after the first visit/assessment.",
                    "Allow the field to remain blank initially.",
                    "Priority gets populated after first visit based on PPS and clinical assessment scores.",
                ],
            },
        ],
    },
    {
        "number": "2",
        "title": "Location & Map Features",
        "items": [
            {
                "number": "2.1",
                "title": "Kidwai as Base Location",
                "bullets": [
                    "Set Kidwai Memorial Institute of Oncology as the base/home location on the map.",
                    "Show a configurable radius from Kidwai (e.g., 15 km).",
                ],
            },
            {
                "number": "2.2",
                "title": "Distance Display",
                "bullets": [
                    "When registering a patient, show the distance from Kidwai to the patient's location.",
                    "Example: \"This patient is approximately 6 km from Kidwai\".",
                    "Indicate whether the patient is within or outside the configured service radius.",
                ],
            },
            {
                "number": "2.3",
                "title": "Map in Scheduling",
                "bullets": [
                    "Show a map interface during scheduling that displays:",
                    "  - All patients scheduled for a day plotted on the map",
                    "  - Distance between each patient (patient-to-patient)",
                    "  - Zone overlap visualization",
                    "  - Proximity clustering (patients within 3-5-7 km of each other)",
                    "This helps schedulers assess route feasibility and cluster efficiency.",
                ],
            },
        ],
    },
    {
        "number": "3",
        "title": "Scheduling System",
        "items": [
            {
                "number": "3.1",
                "title": "Multiple Vehicles per Day",
                "bullets": [
                    "Allow 2 or more vehicles to be scheduled on the same day.",
                    "Each vehicle should have its own patient allocation and route.",
                ],
            },
            {
                "number": "3.2",
                "title": "First-Visit Patient Prioritization",
                "bullets": [
                    "Newly registered patients (who have not had their initial assessment) must be prioritized in scheduling.",
                    "Minimize the gap between record creation and the first visit.",
                    "Rationale: delays in first visit have led to patients passing away without receiving care.",
                ],
            },
            {
                "number": "3.3",
                "title": "Scheduling Algorithm Variables",
                "bullets": [
                    "Scenario 1 (New patient, pre-first-visit): Use 2 variables - Geographic location/clustering, Patient category.",
                    "Scenario 2 (After first visit): Use 3 variables - Geographic location/clustering, Patient category, Clinical complexity (High/Medium/Low).",
                ],
            },
            {
                "number": "3.4",
                "title": "Time Capture for Visits",
                "bullets": [
                    "Allow the scheduler to assign time slots to each patient in the schedule.",
                    "Example: Patient A from 9:00-10:00, Patient B from 10:00-11:00.",
                    "Enables informing patients of approximate arrival time and better route planning.",
                ],
            },
            {
                "number": "3.5",
                "title": "Deviation Report",
                "bullets": [
                    "Track deviations between the planned schedule and actual visits.",
                    "Deviations include: Emergency patients added mid-route, Scheduled patients not home/not seen, Order changes.",
                    "Generate an exception/deviation report weekly or monthly.",
                    "Report should capture: what the deviation was and why it occurred.",
                ],
            },
        ],
    },
    {
        "number": "4",
        "title": "Team Assignment",
        "items": [
            {
                "number": "4.1",
                "title": "Updated Team Roles",
                "bullets": [
                    "The multidisciplinary team should include: Physician, Nurse, Counsellor, Physiotherapist, Social Worker, Driver.",
                ],
            },
            {
                "number": "4.2",
                "title": "Role-Based Filtering",
                "bullets": [
                    "When assigning team members, filter by role/specialization.",
                    "Example: when selecting a physiotherapist, only show physiotherapists in the dropdown.",
                ],
            },
            {
                "number": "4.3",
                "title": "Flexible Team Composition",
                "bullets": [
                    "Not all roles are mandatory for every visit.",
                    "Allow assigning multiple members of the same role (e.g., 2 nurses).",
                    "Team can vary day by day within the same weekly schedule.",
                ],
            },
        ],
    },
    {
        "number": "5",
        "title": "Prescription & Medication",
        "items": [
            {
                "number": "5.1",
                "title": "Half / Full Tablet Dosage",
                "bullets": [
                    "Add ability to specify half tablet vs full tablet.",
                    "Dosage can vary throughout the day (e.g., half in morning, half in afternoon, full at night).",
                ],
            },
            {
                "number": "5.2",
                "title": "Instructions Dropdown",
                "bullets": [
                    "Change the instructions field from free text to a dropdown.",
                    "Include options like: Before food, After food, With food, Empty stomach, etc.",
                ],
            },
            {
                "number": "5.3",
                "title": "Type of Medicine",
                "bullets": [
                    "Add a field for medicine type: Immediate Release, Sustained Release.",
                ],
            },
            {
                "number": "5.4",
                "title": "Medicine Form (Dosage Form)",
                "bullets": [
                    "Add a dropdown for dosage form: Tablet, Syrup, Capsule, Injection, etc.",
                ],
            },
            {
                "number": "5.5",
                "title": "Frequency Enhancement",
                "bullets": [
                    "Add SOS (as-needed/emergency dose) as a secondary frequency.",
                    "Example: Paracetamol TDS + SOS (3 times daily, and one extra if needed).",
                ],
            },
            {
                "number": "5.6",
                "title": "Warning Signs",
                "bullets": [
                    "Add a warning signs / instructions field to prescriptions.",
                    "Example: \"If patient is too drowsy, stop this medicine\".",
                    "Implementation approach TBD - Anish wants to discuss regarding liability implications before finalizing.",
                ],
            },
            {
                "number": "5.7",
                "title": "Prescription PDF Enhancements",
                "bullets": [
                    "Add doctor's name, designation, and NCA registration number in the signature area.",
                    "Add diagnosis to the prescription PDF.",
                    "Add distance information to the prescription PDF (for approval purposes).",
                ],
            },
        ],
    },
    {
        "number": "6",
        "title": "Schedule PDF Enhancements",
        "items": [
            {
                "number": "6.1",
                "title": "Additional Data in PDF",
                "bullets": [
                    "Add diagnosis for each patient in the schedule PDF.",
                    "Add distance between patients (patient-to-patient) in the PDF.",
                    "This is for the visiting team AND the approval workflow.",
                ],
            },
        ],
    },
    {
        "number": "7",
        "title": "Clinical Assessment",
        "items": [
            {
                "number": "7.1",
                "title": "Procedures (New Section)",
                "bullets": [
                    "Add a Procedures section to patient assessment forms (initial and follow-up).",
                    "Dr. Ashwini will share a predetermined list of: Nursing procedures, Physiotherapy procedures, Counseling procedures.",
                ],
            },
            {
                "number": "7.2",
                "title": "Body Map Simplification",
                "bullets": [
                    "Replace the current body map with a simple front and back outline.",
                    "No need for detailed body divisions - just a basic body outline for marking pain/issue areas.",
                ],
            },
        ],
    },
    {
        "number": "8",
        "title": "Analytics & Tracking",
        "items": [
            {
                "number": "8.1",
                "title": "Vitals Tracking",
                "bullets": [
                    "Track vitals analytically across visits.",
                    "Enable trend visualization for vitals over time.",
                ],
            },
            {
                "number": "8.2",
                "title": "Across Forms",
                "bullets": [
                    "Ensure analytics can pull and correlate data across all form types (initial assessment, follow-up, prescriptions, vitals, etc.).",
                ],
            },
        ],
    },
    {
        "number": "9",
        "title": "Workflow & Notifications",
        "items": [
            {
                "number": "9.1",
                "title": "Approval Workflow",
                "bullets": [
                    "Maker-Checker pattern: one user creates the schedule, a different user (lead physician) approves.",
                    "Different roles/permissions for schedule creator vs approver.",
                    "If the approver is on leave, another authorized person can approve.",
                ],
            },
            {
                "number": "9.2",
                "title": "Notifications on Approval",
                "bullets": [
                    "Once a schedule is approved, all assigned team members should receive an email notification with their schedule details.",
                    "Each team member should know which days they are assigned.",
                ],
            },
            {
                "number": "9.3",
                "title": "Patient Notifications (Future)",
                "bullets": [
                    "SMS notifications to patients about upcoming visits (deferred due to SMS costs).",
                    "For now, the scheduler will manually call patients after schedule finalization.",
                    "Message format: \"The Saranam home care team will be at your residence approximately between [time range]\".",
                ],
            },
        ],
    },
    {
        "number": "10",
        "title": "Recurring Meetings",
        "items": [
            {
                "number": "10.1",
                "title": "Weekly Standup",
                "bullets": [
                    "Weekly standup scheduled for every Thursday starting next week.",
                    "Attendees: Saranam team (Anish, Dr. Ashwini, Dr. Anvita, Dr. Amrita, Dr. Ram) + Dev team (Arnav, Farzan, Ayush).",
                ],
            },
        ],
    },
]

PRIORITY_TABLE = [
    ("High", "First-visit patient prioritization (3.2)", "Patient safety - delays can be fatal"),
    ("High", "Diagnosis field - mandatory dropdown (1.4)", "Needed for scheduling, PDF, and team preparation"),
    ("High", "Patient category - 4 types (1.2)", "Core to scheduling algorithm"),
    ("High", "Multiple vehicles per day (3.1)", "Operational necessity"),
    ("Medium", "Map & distance in scheduling (2.3)", "Core scheduling intelligence"),
    ("Medium", "Referred From field (1.3)", "Registration completeness"),
    ("Medium", "Prescription enhancements (5.1-5.6)", "Clinical accuracy"),
    ("Medium", "Schedule PDF - diagnosis & distance (6.1)", "Team preparedness"),
    ("Medium", "Team role filtering (4.2)", "UX improvement"),
    ("Medium", "Procedures section (7.1)", "Clinical documentation"),
    ("Medium", "Deviation report (3.5)", "Operational insights"),
    ("Medium", "Time capture in scheduling (3.4)", "Route planning"),
    ("Low", "Geocoding search (1.5)", "UX improvement"),
    ("Low", "Body map simplification (7.2)", "UX improvement"),
    ("Low", "Warning signs in prescription (5.6)", "Pending team discussion"),
    ("Low", "Analytics across forms (8.2)", "Reporting enhancement"),
    ("Future", "SMS notifications to patients (9.3)", "Requires third-party integration & cost"),
]


# ─── DOCX Generation ────────────────────────────────────────────────────────

def set_cell_shading(cell, color):
    """Set background color of a table cell."""
    shading = cell._element.get_or_add_tcPr()
    shading_elem = shading.makeelement(qn('w:shd'), {
        qn('w:fill'): color,
        qn('w:val'): 'clear',
    })
    shading.append(shading_elem)


def generate_docx():
    doc = Document()

    # Adjust margins
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    # Styles
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(11)
    style.paragraph_format.space_after = Pt(4)

    # Title
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_para.add_run(TITLE)
    title_run.bold = True
    title_run.font.size = Pt(20)
    title_run.font.color.rgb = RGBColor(0x1A, 0x56, 0xDB)

    # Subtitle
    for text in [SUBTITLE, ATTENDEES]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(text)
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    doc.add_paragraph()  # spacer

    # Sections
    for section in SECTIONS:
        # Section heading
        h = doc.add_heading(f"{section['number']}. {section['title']}", level=1)
        for run in h.runs:
            run.font.color.rgb = RGBColor(0x1A, 0x56, 0xDB)

        for item in section["items"]:
            # Sub heading
            h2 = doc.add_heading(f"{item['number']} {item['title']}", level=2)
            for run in h2.runs:
                run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

            for bullet in item["bullets"]:
                if bullet.startswith("  "):
                    # Sub-bullet
                    p = doc.add_paragraph(bullet.strip(), style='List Bullet 2')
                else:
                    p = doc.add_paragraph(bullet, style='List Bullet')
                p.paragraph_format.space_after = Pt(2)

    # Priority Matrix
    doc.add_page_break()
    h = doc.add_heading("Priority Matrix", level=1)
    for run in h.runs:
        run.font.color.rgb = RGBColor(0x1A, 0x56, 0xDB)

    table = doc.add_table(rows=1, cols=3)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Header row
    hdr = table.rows[0].cells
    for i, text in enumerate(["Priority", "Requirement", "Rationale"]):
        hdr[i].text = text
        for paragraph in hdr[i].paragraphs:
            for run in paragraph.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.size = Pt(10)
        set_cell_shading(hdr[i], "1A56DB")

    priority_colors = {
        "High": "FDECEA",
        "Medium": "FFF8E1",
        "Low": "E8F5E9",
        "Future": "E3F2FD",
    }

    for priority, req, rationale in PRIORITY_TABLE:
        row = table.add_row().cells
        row[0].text = priority
        row[1].text = req
        row[2].text = rationale
        for cell in row:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(9)
        color = priority_colors.get(priority, "FFFFFF")
        set_cell_shading(row[0], color)

    # Set column widths
    for row in table.rows:
        row.cells[0].width = Inches(0.9)
        row.cells[1].width = Inches(3.5)
        row.cells[2].width = Inches(2.1)

    path = os.path.join(OUTPUT_DIR, "requirements-2026-03-30.docx")
    doc.save(path)
    print(f"DOCX saved: {path}")
    return path


# ─── PDF Generation ──────────────────────────────────────────────────────────

class RequirementsPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(150, 150, 150)
            self.cell(0, 10, "Saranam Home Care - Requirements Document - 30 March 2026", align="C")
            self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_heading(self, number, title):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(26, 86, 219)
        self.ln(4)
        self.cell(0, 8, f"{number}. {title}")
        self.ln(9)
        # Underline
        self.set_draw_color(26, 86, 219)
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def sub_heading(self, number, title):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(51, 51, 51)
        self.ln(2)
        self.cell(0, 7, f"{number}  {title}")
        self.ln(8)

    def bullet_point(self, text, indent=False):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(33, 33, 33)
        x = self.l_margin + (10 if indent else 5)
        bullet = "-" if indent else ">"
        self.set_x(x)
        # Use multi_cell for wrapping
        self.cell(5, 5, bullet)
        self.set_x(x + 5)
        w = self.w - self.r_margin - x - 5
        self.multi_cell(w, 5, text)
        self.ln(1)


def generate_pdf():
    pdf = RequirementsPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(26, 86, 219)
    pdf.ln(10)
    pdf.multi_cell(0, 10, TITLE, align="C")
    pdf.ln(5)

    # Subtitle
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 7, SUBTITLE, align="C")
    pdf.ln(7)
    pdf.cell(0, 7, ATTENDEES, align="C")
    pdf.ln(15)

    # Divider
    pdf.set_draw_color(200, 200, 200)
    pdf.set_line_width(0.3)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(8)

    # Sections
    for section in SECTIONS:
        # Check if we need a new page
        if pdf.get_y() > 250:
            pdf.add_page()

        pdf.section_heading(section["number"], section["title"])

        for item in section["items"]:
            if pdf.get_y() > 260:
                pdf.add_page()

            pdf.sub_heading(item["number"], item["title"])

            for bullet in item["bullets"]:
                if pdf.get_y() > 270:
                    pdf.add_page()
                is_indent = bullet.startswith("  ")
                pdf.bullet_point(bullet.strip(), indent=is_indent)

    # Priority Matrix
    pdf.add_page()
    pdf.section_heading("", "Priority Matrix")
    pdf.ln(2)

    # Table header
    col_widths = [22, 95, 73]
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(26, 86, 219)
    pdf.set_text_color(255, 255, 255)
    headers = ["Priority", "Requirement", "Rationale"]
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, border=1, fill=True, align="C")
    pdf.ln()

    priority_fills = {
        "High": (253, 236, 234),
        "Medium": (255, 248, 225),
        "Low": (232, 245, 233),
        "Future": (227, 242, 253),
    }

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(33, 33, 33)

    for priority, req, rationale in PRIORITY_TABLE:
        row_h = 7
        # Check if req text needs more height
        if len(req) > 45:
            row_h = 10

        fill = priority_fills.get(priority, (255, 255, 255))

        # Priority cell
        pdf.set_fill_color(*fill)
        pdf.cell(col_widths[0], row_h, priority, border=1, fill=True, align="C")
        pdf.cell(col_widths[1], row_h, req, border=1, fill=False)
        pdf.cell(col_widths[2], row_h, rationale, border=1, fill=False)
        pdf.ln()

    path = os.path.join(OUTPUT_DIR, "requirements-2026-03-30.pdf")
    pdf.output(path)
    print(f"PDF saved: {path}")
    return path


if __name__ == "__main__":
    generate_docx()
    generate_pdf()
    print("\nDone! Both files generated.")
