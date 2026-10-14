"""Clinical summary prompts for Saranam palliative-care assessments.

Single unified prompt strategy:
- ONE system prompt for every per-form assessment summary (nursing, doctor,
  psychological, physiotherapy). The form type is passed as a label in the
  user message so the model has context but is not constrained to a fixed
  section structure.
- ONE system prompt for the holistic patient-level summary spanning the
  whole chart.

Output is always a single clinical paragraph. The model decides what is
salient based on which fields are present — we never enumerate sections.

A shared flattener `_format_record` filters out empty / null / false-boolean
values before sending data to the model, so missing fields naturally
disappear from the prompt with no per-form logic.
"""
from typing import Any, Dict, Optional


# ─── Shared base ──────────────────────────────────────────────────────────

_BASE_RULES = """You are a palliative-care clinician at Saranam Palliative Care, Bangalore, writing the clinical summary block of a home-care visit note.

Hard rules:
- Output ONE clinical paragraph. No preamble, no headings, no bullets, no markdown.
- Use Indian English clinical phrasing and natural shorthand (PPS, ESAS, ADL, ROM, GCS, BP, SpO2) where it improves brevity.
- Cover only fields that are present in the data below. If a field is missing or empty, do not mention it. Never write "not assessed", "not documented", or em-dashes for blanks.
- Quote numeric scores, sizes, and findings exactly as recorded. Never invent or round.
- If the data is essentially empty, output exactly: Insufficient data recorded for this assessment.
""".strip()


ASSESSMENT_SUMMARY_SYSTEM = _BASE_RULES + """

Write a short clinical paragraph summarising what was observed. Let the data guide the order and the length — read what is present and write it the way a clinician would write it. Do not enumerate sections.
"""


PATIENT_COMBINED_SYSTEM = _BASE_RULES + """

You are now writing a holistic chart summary spanning ALL assessments for this patient (latest of each form across all visits, plus demographics and recent visit notes).

Write a concise single paragraph. Cover patient identity, primary diagnosis, current trajectory, symptom burden, functional status, psychosocial picture, the active care plan, and open issues — but only those that are present in the data. Cite scores numerically wherever they exist (e.g. "PPS 40, ESAS pain 7/10, anxiety 5/10"). Do not enumerate sections.
"""


# Structured per-block variant — used by summarize_patient.
# Returns three short clinical paragraphs (nursing, psychosocial,
# physiotherapy) plus body_locations. Demographics, diagnosis, chief
# complaints, and raw ESAS/PPS scores are rendered deterministically by the
# UI from the underlying form data, so the prompt deliberately does NOT
# include or request them.
PATIENT_COMBINED_STRUCTURED_SYSTEM = _BASE_RULES + """

You are writing the three narrative blocks of a clinician quick-view chart for a palliative-care patient. The header (name, age, sex, UHID, diagnosis, complaints) and the score tables (ESAS, PPS) are rendered separately from raw form data — do NOT repeat them.

PART 1 — three narrative blocks (string fields). Each: 1–3 SHORT sentences, ≤40 words total. Aim for ~25 words. Pick the 2–3 most clinically salient points only — do not list everything. No headings, no bullets, no preamble. Drop secondary details, mild/incidental findings, and routine plan items unless they are the most notable thing in the block.

If a block has no data, return exactly: Insufficient data recorded.

  - nursing: 1 sentence on the dominant symptom/finding (pain, wound, bowel) with the key number; 1 sentence on the most important intervention or risk.
  - psychosocial: 1 sentence on patient mood / distress (with score if present); 1 sentence on caregiver state if notable.
  - physiotherapy: 1 sentence on pain/ROM/mobility status; 1 sentence on the headline physio plan.

PART 2 — body_locations (array field): body locations relevant to the patient's current physical findings (pain, wounds, edema, restricted motion, etc.).
- Each item: { slug: <one of the enum below>, label: <≤50-char description> }.
- Only include zones with clear clinical relevance from the data.
- DO NOT invent slugs not in the enum.
- If no localized physical findings, return an empty list.

If previous_locations are listed in the user message, re-evaluate them: keep zones still supported by the data, drop ones no longer supported, add newly relevant ones, and update labels where the finding has progressed.
"""


# ─── Generic field flattener ──────────────────────────────────────────────

# Internal / audit / non-clinical fields we never send to the LLM.
DROP_KEYS = frozenset({
    'id', 'patient_id', 'visit_id',
    'assessed_by', 'recorded_by', 'created_by', 'generated_by',
    'assessed_at', 'recorded_at', 'created_at', 'updated_at', 'generated_at',
    'ai_summary',
    # Doctor body-map artefacts — not text-summarisable.
    'body_map_front_url', 'body_map_back_url', 'body_map_annotations',
})


def _flatten_value(v: Any) -> Optional[str]:
    """Render a value as a short string; return None to indicate 'drop this field'."""
    if v is None:
        return None
    if isinstance(v, bool):
        # Booleans: only meaningful when True. False usually means "not present"
        # (e.g. wound_present=false), and a clinical paragraph naturally elides
        # negatives unless they're noteworthy.
        return 'yes' if v else None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        flat = [str(x) for x in v if x not in (None, '', False)]
        return ', '.join(flat) if flat else None
    if isinstance(v, dict):
        # Common JSONB shape in this app: {"present": bool, ...other notes}.
        # If explicitly not present, drop the whole field.
        if v.get('present') is False:
            return None
        bits = []
        for ik, iv in v.items():
            iv_s = _flatten_value(iv)
            if iv_s is not None:
                bits.append(f"{ik}={iv_s}")
        return '; '.join(bits) if bits else None
    return str(v)


def _format_record(record: Dict[str, Any]) -> str:
    """Render a record as `key: value` lines, silently dropping empty values."""
    lines = []
    for k, v in record.items():
        if k in DROP_KEYS:
            continue
        s = _flatten_value(v)
        if s is None:
            continue
        lines.append(f"{k}: {s}")
    return '\n'.join(lines) if lines else '(no data recorded)'


# ─── User-prompt builders ─────────────────────────────────────────────────

# Human-readable label so the model knows which form it is summarising.
FORM_LABELS = {
    'nursing':        'Nursing assessment',
    'doctor':         "Doctor's assessment",
    'psychological':  'Psychological assessment',
    'physiotherapy':  'Physiotherapy assessment',
}


def build_form_user_prompt(record: Dict[str, Any], form_type: str) -> str:
    label = FORM_LABELS.get(form_type, form_type.replace('_', ' ').title() + ' assessment')
    return (
        f"{label} data:\n\n"
        f"{_format_record(record)}\n\n"
        f"Write the clinical summary paragraph."
    )


def build_patient_combined_user_prompt(bundle: Dict[str, Any]) -> str:
    """`bundle` is built by summarize_patient(): demographics + latest per
    assessment type + recent visit summaries.

    We keep section LABELS here (Patient / Doctor / Nursing / ...) so the
    model can attribute findings to the right discipline; within each
    section, fields are still flat key:value pairs.
    """
    sections = []

    patient = bundle.get('patient') or {}
    if patient:
        body = _format_record(patient)
        if body != '(no data recorded)':
            sections.append(f"Patient:\n{body}")

    for key in ('doctor', 'nursing', 'psychological', 'physiotherapy',
                'esas', 'pps', 'care_plan', 'procedures'):
        section = bundle.get(key)
        if not section:
            continue
        body = _format_record(section)
        if body == '(no data recorded)':
            continue
        title = key.replace('_', ' ').title()
        sections.append(f"{title}:\n{body}")

    recent = bundle.get('recent_visits') or []
    recent_lines = []
    for v in recent:
        sumtxt = (v.get('visit_summary') or '').strip()
        if not sumtxt:
            continue
        date = v.get('visit_date') or ''
        vtype = v.get('visit_type') or ''
        recent_lines.append(f"  {date} ({vtype}): {sumtxt}")
    if recent_lines:
        sections.append('Recent visit summaries:\n' + '\n'.join(recent_lines))

    body = '\n\n'.join(sections) if sections else '(no data recorded)'
    return (
        "Patient chart bundle (latest per assessment type):\n\n"
        f"{body}\n\n"
        "Write the holistic patient summary paragraph."
    )


def build_patient_structured_user_prompt(
    bundle: Dict[str, Any],
    valid_slugs: list,
    previous_locations: list = None,
) -> str:
    """User prompt for the per-block structured call.

    Only passes the three assessment-form bodies the AI is asked to summarise
    (nursing, psychological, physiotherapy). Demographics, diagnosis, chief
    complaints, ESAS/PPS scores are intentionally omitted — the UI renders
    those deterministically from the underlying records.
    """
    sections = []
    for key in ('nursing', 'psychological', 'physiotherapy'):
        section = bundle.get(key)
        if not section:
            continue
        body = _format_record(section)
        if body == '(no data recorded)':
            continue
        title = key.replace('_', ' ').title()
        sections.append(f"{title} assessment:\n{body}")

    enum_text = ', '.join(valid_slugs)
    parts = [
        "Assessment data for narrative blocks:",
        '',
        '\n\n'.join(sections) if sections else '(no assessment data recorded)',
        '',
        f"Available zone slugs (use ONLY these): {enum_text}",
    ]
    if previous_locations:
        prev_lines = [f"  - {p.get('zoneSlug')}: {p.get('text')}" for p in previous_locations if p.get('zoneSlug')]
        if prev_lines:
            parts.append('')
            parts.append("Previously identified locations (re-evaluate against current data):")
            parts.extend(prev_lines)

    parts.append('')
    parts.append("Return the JSON object specified by the response schema.")
    return '\n'.join(parts)


# ─── Follow-up visit summary (2026-05-13 client meeting) ──────────────────

FOLLOWUP_VISIT_STRUCTURED_SYSTEM = _BASE_RULES + """

You are writing a FOLLOW-UP visit summary for a palliative-care patient who is already established on the programme. The clinician wants a short, change-focused note — not a comprehensive chart summary.

PART 1 — summary (string field): a concise single paragraph (≤180 words).
Anchor the note on WHAT CHANGED since the last contact. Reference the baseline and most recent prior follow-up summaries (provided in the user message) so the reader can see the trajectory. Cover:
  - symptom changes (better / worse / new / resolved), with numeric ESAS deltas where present
  - functional status change (PPS delta, ADL changes, mobility)
  - psychosocial / caregiver concerns raised this visit
  - active issues identified and plan-of-care updates
Only mention items that the data actually supports. If nothing material has changed, say so explicitly (e.g. "Status quo since last visit; pain controlled on current regimen.").

PART 2 — body_locations (array field): the body-map state AS OF THIS VISIT (not cumulative).
- Each item: { slug: <one of the enum below>, label: <≤50-char description> }.
- Take the previously identified locations as the starting state; for this visit add new findings, drop locations that have resolved, and update labels where severity changed (e.g. "Severe pain" → "Mild pain").
- Only include zones with clear clinical relevance from THIS visit's data.
- DO NOT invent slugs not in the enum.
- If there are no localized physical findings at this visit, return an empty list.
"""


def build_followup_visit_user_prompt(
    visit_bundle: Dict[str, Any],
    baseline_summary: Optional[str],
    previous_followups: list,
    valid_slugs: list,
    previous_locations: list = None,
) -> str:
    """User prompt for a follow-up visit summary.

    `visit_bundle` = data captured AT THIS VISIT (assessments, ESAS, PPS, vitals).
    `baseline_summary` = the patient-level PatientAiSummary text (if any).
    `previous_followups` = list of up to 3 prior follow-up summaries, oldest first,
        each a dict {visit_date, summary_text}.
    `previous_locations` = the most-recent visit's body_locations to diff against.
    """
    parts: list = []

    if baseline_summary:
        parts.append("Baseline patient summary (for context — do not repeat verbatim):")
        parts.append(baseline_summary.strip())
        parts.append('')
    else:
        parts.append("(No baseline patient summary available — summarise this visit on its own merits.)")
        parts.append('')

    if previous_followups:
        parts.append("Previous follow-up summaries (oldest first):")
        for fu in previous_followups:
            d = fu.get('visit_date') or ''
            txt = (fu.get('summary_text') or '').strip()
            if txt:
                parts.append(f"  [{d}] {txt}")
        parts.append('')

    # This visit's data
    sections = []
    for key in ('visit_meta', 'doctor', 'nursing', 'psychological',
                'physiotherapy', 'esas', 'pps', 'care_plan', 'procedures'):
        section = visit_bundle.get(key)
        if not section:
            continue
        body = _format_record(section)
        if body == '(no data recorded)':
            continue
        title = key.replace('_', ' ').title()
        sections.append(f"{title}:\n{body}")

    parts.append("This visit's data:")
    parts.append('\n\n'.join(sections) if sections else '(no data recorded for this visit)')
    parts.append('')

    enum_text = ', '.join(valid_slugs)
    parts.append(f"Available zone slugs (use ONLY these): {enum_text}")

    if previous_locations:
        prev_lines = [
            f"  - {p.get('zoneSlug')}: {p.get('text')}"
            for p in previous_locations if p.get('zoneSlug')
        ]
        if prev_lines:
            parts.append('')
            parts.append("Previously identified locations (starting state for this visit):")
            parts.extend(prev_lines)

    parts.append('')
    parts.append("Return the JSON object specified by the response schema.")
    return '\n'.join(parts)
