/**
 * Generate a PDF of the AI-generated patient summary — clinician quick-view.
 *
 * Layout mirrors AiPatientSummaryCard:
 *   Header (clinic branding + generation date)
 *   Basic Patient Details (deterministic from form data)
 *   Clinical Details (Diagnosis + Present Complaints — verbatim from doctor form)
 *   Functional Assessment (ESAS row + PPS row — raw scores)
 *   Nursing / Psychosocial / Physiotherapy narrative blocks (AI-summarised)
 *   Homecare Visit Details table
 *   Footer (model + page numbers)
 */
import jsPDF from 'jspdf';

const CLINIC_NAME = 'Saranam India Health Care';
const CLINIC_TAGLINE = 'Palliative & Home Based Care';

const ESAS_FIELDS = [
  ['pain', 'Pain'],
  ['tiredness', 'Tired'],
  ['nausea', 'Nausea'],
  ['depression', 'Depr'],
  ['anxiety', 'Anx'],
  ['drowsiness', 'Drows'],
  ['appetite', 'Appet'],
  ['wellbeing', 'Well'],
  ['shortness_of_breath', 'SOB'],
];

const BLOCKS = [
  ['nursing', 'Nursing Assessment'],
  ['psychosocial', 'Psychosocial Assessment'],
  ['physiotherapy', 'Physiotherapy Assessment'],
];

const COLORS = {
  primary: [37, 99, 235],
  dark: [30, 30, 30],
  gray: [107, 114, 128],
  white: [255, 255, 255],
  rule: [220, 220, 220],
  rowAlt: [245, 247, 250],
};


function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age -= 1;
  return age;
}

function teamText(members) {
  if (!members) return '—';
  if (Array.isArray(members)) {
    return members
      .map(m => (typeof m === 'string' ? m : (m.name || m.role || '')))
      .filter(Boolean).join(', ') || '—';
  }
  return String(members);
}


export default function generatePatientSummaryPDF({ patient, summary, chart = {} }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let y = 40;

  function newPage() {
    doc.addPage();
    drawHeader();
    y = 40;
  }

  function ensureSpace(needed) {
    if (y + needed > pageHeight - 18) newPage();
  }

  function drawHeader() {
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(CLINIC_NAME, margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(CLINIC_TAGLINE, margin, 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Patient Clinical Summary', pageWidth - margin, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated: ${formatDate(summary?.generated_at || new Date().toISOString())}`,
      pageWidth - margin, 21, { align: 'right' });
  }

  function sectionTitle(label) {
    ensureSpace(10);
    doc.setTextColor(...COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(label, margin, y);
    y += 2;
    doc.setDrawColor(...COLORS.rule);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  }

  function kvRow(rows) {
    // rows: array of [label, value]; renders as a 2-column grid
    const colWidth = contentWidth / 2 - 2;
    for (let i = 0; i < rows.length; i += 2) {
      ensureSpace(10);
      const left = rows[i];
      const right = rows[i + 1];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.gray);
      doc.text(left[0], margin, y);
      if (right) doc.text(right[0], margin + colWidth + 4, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.dark);

      const lW = doc.splitTextToSize(String(left[1] || '—'), colWidth);
      const rW = right ? doc.splitTextToSize(String(right[1] || '—'), colWidth) : [];
      const rows1 = lW.length;
      const rows2 = rW.length;
      const startY = y + 4;
      lW.forEach((ln, idx) => doc.text(ln, margin, startY + idx * 4.5));
      rW.forEach((ln, idx) => doc.text(ln, margin + colWidth + 4, startY + idx * 4.5));
      y = startY + Math.max(rows1, rows2) * 4.5 + 2;
    }
  }

  function paragraph(text, opts = {}) {
    const body = (text || '').trim();
    if (!body) {
      doc.setTextColor(...COLORS.gray);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      ensureSpace(6);
      doc.text(opts.empty || '—', margin, y);
      y += 6;
      return;
    }
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(body, contentWidth);
    for (const ln of lines) {
      ensureSpace(5);
      doc.text(ln, margin, y);
      y += 5;
    }
    y += 1;
  }

  function esasTable(esas) {
    if (!esas) {
      paragraph('', { empty: 'No ESAS recorded.' });
      return;
    }
    const colCount = ESAS_FIELDS.length + 1;
    const colW = contentWidth / colCount;
    ensureSpace(14);
    // Header
    doc.setFillColor(...COLORS.rowAlt);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.dark);
    ESAS_FIELDS.forEach(([, label], i) => {
      doc.text(label, margin + colW * i + 1.5, y + 4);
    });
    doc.text('Total', margin + colW * ESAS_FIELDS.length + 1.5, y + 4);
    y += 6;
    // Values
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    ESAS_FIELDS.forEach(([key], i) => {
      const v = esas[key];
      doc.text(String(v ?? '—'), margin + colW * i + 1.5, y + 4);
    });
    doc.setFont('helvetica', 'bold');
    doc.text(String(esas.total_score ?? '—'), margin + colW * ESAS_FIELDS.length + 1.5, y + 4);
    y += 8;
  }

  function ppsBlock(pps) {
    if (!pps) {
      paragraph('', { empty: 'No PPS recorded.' });
      return;
    }
    kvRow([
      ['PPS Score',    pps.pps_score != null ? `${pps.pps_score}%` : '—'],
      ['Ambulation',   pps.ambulation],
      ['Activity',     pps.activity_level],
      ['Self-care',    pps.self_care],
      ['Intake',       pps.intake],
      ['Consciousness', pps.consciousness_level],
    ]);
  }

  function visitsTable(visits, plansByVisit) {
    if (!visits || visits.length === 0) {
      paragraph('', { empty: 'No visits recorded.' });
      return;
    }
    const colW = [22, 30, 50, 50, 28];
    const total = colW.reduce((a, b) => a + b, 0);
    const scale = contentWidth / total;
    const widths = colW.map(w => w * scale);
    const headers = ['Date', 'Team', 'Findings', 'Interventions', 'Plan'];

    ensureSpace(10);
    doc.setFillColor(...COLORS.rowAlt);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.dark);
    let xc = margin;
    headers.forEach((h, i) => {
      doc.text(h, xc + 1.5, y + 4);
      xc += widths[i];
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    visits.forEach(v => {
      const plan = plansByVisit?.[v.id];
      const cells = [
        `${formatDate(v.visit_date)}\n${v.visit_type === 'initial' ? 'Initial' : `#${v.visit_number}`}`,
        teamText(v.team_members),
        v.visit_summary || '—',
        plan?.intervention_pharmacological || plan?.intervention_non_pharmacological
          || v.advice_pharmacological || v.advice_non_pharmacological || '—',
        v.follow_up_advice || plan?.intervention_non_pharmacological || '—',
      ];
      // Compute per-cell wrapped lines
      const wrapped = cells.map((c, i) => doc.splitTextToSize(String(c), widths[i] - 3));
      const rowHeight = Math.max(...wrapped.map(w => w.length)) * 3.8 + 2;
      ensureSpace(rowHeight + 1);
      let cx = margin;
      wrapped.forEach((lines, i) => {
        lines.forEach((ln, li) => {
          doc.text(ln, cx + 1.5, y + 3.5 + li * 3.8);
        });
        cx += widths[i];
      });
      doc.setDrawColor(...COLORS.rule);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      y += rowHeight;
    });
  }

  // ─── Render ─────────────────────────────────────────────────────
  drawHeader();

  // Basic Patient Details
  const age = calcAge(patient?.date_of_birth);
  const ageSex = [age != null ? `${age}y` : null, patient?.gender].filter(Boolean).join(' / ') || '—';
  const phone = patient?.phone || patient?.primary_caregiver_phone || patient?.alternative_phone || '—';
  const caregiver = patient?.primary_caregiver_name
    ? `${patient.primary_caregiver_name}${patient.primary_caregiver_relationship ? ` (${patient.primary_caregiver_relationship})` : ''}${patient.primary_caregiver_phone ? ` — ${patient.primary_caregiver_phone}` : ''}`
    : '—';
  const homecareCode = [patient?.homecare_code, patient?.uhid].filter(Boolean).join(' / ');

  sectionTitle('Basic Patient Details');
  kvRow([
    ['Patient Name', patient?.full_name || '—'],
    ['UHID', patient?.uhid || '—'],
    ['Homecare ID', homecareCode || '—'],
    ['Age / Sex', ageSex],
    ['Address', patient?.address || '—'],
    ['Phone Number', phone],
    ['Primary Caregiver', caregiver],
    ['Date of Registration', formatDate(patient?.created_at)],
  ]);

  // Clinical Details
  sectionTitle('Clinical Details');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  ensureSpace(6);
  doc.text('Diagnosis', margin, y);
  y += 4;
  paragraph(chart.diagnosis || patient?.diagnosis, { empty: '—' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  ensureSpace(6);
  doc.text('Present Complaints', margin, y);
  y += 4;
  paragraph(chart.chief_complaints, { empty: '—' });

  // Functional Assessment
  sectionTitle('Functional Assessment (ESAS & PPS)');
  esasTable(chart.esas);
  ppsBlock(chart.pps);

  // Narrative blocks
  const blocksDict = summary?.summary_blocks
    || (summary?.summary_text ? { nursing: summary.summary_text } : {});
  BLOCKS.forEach(([key, label]) => {
    sectionTitle(label);
    paragraph(blocksDict[key]);
  });

  // Visits
  sectionTitle('Homecare Visit Details');
  visitsTable(chart.visits, chart.plansByVisit);

  // Footer on every page
  const totalPages = doc.internal.getNumberOfPages();
  const modelLine = summary?.model_used
    ? `AI-assisted summary (${summary.model_used}). Reviewed and approved by the care team.`
    : 'AI-assisted summary. Reviewed and approved by the care team.';
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    const fy = pageHeight - 12;
    doc.setDrawColor(...COLORS.rule);
    doc.line(margin, fy - 5, pageWidth - margin, fy - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(modelLine, margin, fy);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, fy, { align: 'right' });
  }

  const fname = (patient?.full_name || 'patient')
    .replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  doc.save(`patient_summary_${fname}_${formatDate(new Date().toISOString())}.pdf`);
}
