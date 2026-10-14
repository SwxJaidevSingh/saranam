/**
 * generateAcuteVisitSheetPDF.js
 *
 * Generates a printable Acute Visit Sheet PDF for offline clinical use.
 *
 * Header/branding is identical to generatePrescriptionPDF.js.
 * Patient info (name, UHID, homecare code, diagnosis) and the last
 * prescription are pre-filled. All follow-up form sections are rendered
 * as blank ruled areas for manual completion.
 *
 * @param {Object} opts
 * @param {Object} opts.patient   - Patient object from /patients/:id
 * @param {Object} opts.lastRx    - Result of saranamApi.latestPrescription()
 *                                  { version: { data: { medications, icd10_diagnosis,
 *                                    diagnosis_text } } } or null
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Clinic constants (identical to generatePrescriptionPDF.js) ───────────────
const CLINIC_NAME    = 'Saranam India Health Care';
const CLINIC_TAGLINE = 'Palliative & Home Based Care';
const CLINIC_ADDRESS = 'Kidwai Memorial Institute of Oncology, Bangalore';

// ─── Colour palette (identical to generatePrescriptionPDF.js) ────────────────
const C = {
  primary:   [37, 99, 235],
  dark:      [30, 30, 30],
  gray:      [107, 114, 128],
  lightGray: [243, 244, 246],
  midGray:   [180, 180, 180],
  white:     [255, 255, 255],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute total beneficiary count based on genogram data or family chart fallback */
function getBeneficiaryCount(patient) {
  const genogram = patient.genogram;
  
  if (genogram && typeof genogram === 'object') {
    if (genogram.useUploadedImage) {
      if (genogram.manualBeneficiaryCount !== undefined && genogram.manualBeneficiaryCount !== null && genogram.manualBeneficiaryCount !== '') {
        const num = parseInt(genogram.manualBeneficiaryCount, 10);
        if (!isNaN(num)) return num;
      }
    } else if (Array.isArray(genogram.nodes) && genogram.nodes.length > 0) {
      if (genogram.customBeneficiaryCount !== undefined && genogram.customBeneficiaryCount !== null && genogram.customBeneficiaryCount !== '') {
        const num = parseInt(genogram.customBeneficiaryCount, 10);
        if (!isNaN(num)) return num;
      }

      const hasExplicit = genogram.nodes.some(node => node && node.isBeneficiary === true);
      let depCount = 0;
      genogram.nodes.forEach(node => {
        if (!node || node.isProband) return;
        if (hasExplicit && !node.isBeneficiary) return;
        depCount++;
      });
      return 1 + depCount;
    }
  }

  if (Array.isArray(patient.family_chart) && patient.family_chart.length > 0) {
    let depCount = 0;
    patient.family_chart.forEach(row => {
      if (row && typeof row === 'object') depCount++;
    });
    return 1 + depCount;
  }

  return '—';
}

/** Fetch image and convert to data URL for synchronous jsPDF inclusion */
async function resolveImageToDataUrl(src) {
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('resolveImageToDataUrl failed for ' + src, err);
    return null;
  }
}

/** Draw the blue header bar + clinic name/tagline/address + "ACUTE VISIT SHEET" title */
function drawHeader(doc, pageWidth, margin, logoDataUrl) {
  // Blue bar
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, pageWidth, 22, 'F');

  const textX = logoDataUrl ? 22 : margin;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 4, 3, 16, 16);
    } catch (e) {
      console.warn('drawHeader: failed to render logo image', e);
    }
  }

  // Clinic name
  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(CLINIC_NAME, textX, 8.5);

  // Tagline + address
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(CLINIC_TAGLINE, textX, 13.5);
  doc.text(CLINIC_ADDRESS, textX, 18.5);

  // Right-side title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ACUTE VISIT SHEET', pageWidth - margin, 13, { align: 'right' });
}

/** Draw a thin horizontal rule */
function hRule(doc, y, margin, pageWidth) {
  doc.setDrawColor(...C.midGray);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
}

/** Draw a bold section title with a subtle background band */
function sectionTitle(doc, title, y, margin, pageWidth) {
  doc.setFillColor(...C.lightGray);
  doc.rect(margin, y - 3.5, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text(title, margin + 2, y + 1.5);
  return y + 7;
}


/**
 * Guard: if the next block needs `neededMm` space and we're too close to the
 * bottom, add a new page and reset y to the top margin.
 */
function pageBreakIfNeeded(doc, y, pageHeight, margin, neededMm = 20) {
  if (y + neededMm > pageHeight - margin) {
    doc.addPage();
    return margin + 5;
  }
  return y;
}

// ─── Build timing cell (same logic as generatePrescriptionPDF) ───────────────
function buildTimingText(med) {
  const mode = med.schedule_mode || (
    med.dosage_6am || med.dosage_10am || med.dosage_2pm || med.dosage_6pm || med.dosage_10pm
      ? 'opioid'
      : (med.dosage_morning || med.dosage_afternoon || med.dosage_night) ? 'tds' : null
  );

  if (mode === 'opioid') {
    const vals = [med.dosage_6am || '0', med.dosage_10am || '0', med.dosage_2pm || '0', med.dosage_6pm || '0', med.dosage_10pm || '0'];
    if (vals.some(v => v !== '0')) return `6-10-2-6-10\n${vals.join('-')}`;
  }
  if (mode === 'tds') {
    const m = med.dosage_morning || '0', a = med.dosage_afternoon || '0', n = med.dosage_night || '0';
    if (m !== '0' || a !== '0' || n !== '0') return `M-A-N\n${m}-${a}-${n}`;
  }
  if (mode === 'custom' && Array.isArray(med.custom_timings) && med.custom_timings.length) {
    const parts = med.custom_timings
      .filter(t => t && (t.time || t.dose) && t.dose !== '0')
      .map(t => `${t.time || '?'} ${t.dose || '0'}`);
    if (parts.length) return `Custom\n${parts.join(', ')}`;
  }
  return '—';
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default async function generateAcuteVisitSheetPDF({ patient = {}, lastRx = null }) {
  const doc       = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin    = 15;
  const contentWidth = pageWidth - margin * 2;

  // ── 1. HEADER ──────────────────────────────────────────────────────────────
  const logoDataUrl = await resolveImageToDataUrl('/logo.png');
  drawHeader(doc, pageWidth, margin, logoDataUrl);
  let y = 28;

  // ── 2. PATIENT INFO ────────────────────────────────────────────────────────
  hRule(doc, y, margin, pageWidth);
  y += 5;

  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const patientName  = patient.full_name || '—';
  const uhid         = patient.uhid || '—';
  const homecare     = patient.homecare_code || '—';
  const hospitalUhid = patient.hospital_uhid || '—';

  const totalBeneficiaries = getBeneficiaryCount(patient);

  const bscText = patient.bsc_status === true
    ? 'BSC'
    : (patient.bsc_status === false ? 'Non-BSC' : '—');

  const priorityText = patient.clinical_complexity
    ? patient.clinical_complexity.charAt(0).toUpperCase() + patient.clinical_complexity.slice(1)
    : '—';

  // Derive diagnosis: patient.diagnosis first, then fallback to prescription snapshot
  const rxData    = lastRx?.version?.data || lastRx?.carry_forward || {};
  const diagnosis = patient.diagnosis
    || rxData.diagnosis_text
    || rxData.icd10_diagnosis
    || '—';

  // Row helper — label (gray) + value (bold dark) pairs
  const infoRow = (label, value, xLabel, xValue, rowY) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(label, xLabel, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(String(value), xValue, rowY);
  };

  const col2X = 90;
  const col3X = 140;

  // Row 1: Name | Date | Homecare Code
  infoRow('Patient Name:', patientName, margin, margin + 24, y);
  infoRow('Date:',         dateStr,     col2X,  col2X + 22,  y);
  infoRow('Homecare Code:', homecare,   col3X,  col3X + 25,  y);
  y += 4;

  // Row 2: UHID | Hospital UHID | BSC Status
  infoRow('UHID:', uhid, margin, margin + 24, y);
  infoRow('Hospital UHID:', hospitalUhid, col2X, col2X + 22, y);
  infoRow('BSC Status:', bscText, col3X, col3X + 25, y);
  y += 4;

  // Row 3: Priority
  infoRow('Priority:', priorityText, margin, margin + 24, y);
  y += 4;

  // Row 4: Diagnosis (may wrap)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray);
  doc.text('Diagnosis:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  const diagLines = doc.splitTextToSize(String(diagnosis), contentWidth - 24);
  doc.text(diagLines, margin + 24, y);
  y += diagLines.length * 3.5 + 2;

  y += 1;
  hRule(doc, y, margin, pageWidth);
  y += 4;

  // ── 3. LAST PRESCRIPTION (reference table) ─────────────────────────────────
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text('Last Prescription (for reference)', margin, y);
  y += 5;

  const medications = rxData.medications || [];

  if (medications.length > 0) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.dark);

    medications
      .filter(m => m.name)
      .forEach((med, idx) => {
        const freq = med.sos
          ? (med.frequency ? `${med.frequency} + SOS` : 'SOS')
          : (med.frequency || '—');
        const duration = med.duration
          ? `${med.duration} ${med.duration_unit || 'days'}`
          : '—';
        const strength = med.strength || med.dosage || '—';
        const timing = buildTimingText(med).replace(/\n/g, ' ');

        const textLine = `${idx + 1}.  ${med.name} (${strength})  —  Timing: ${timing}  —  Frequency: ${freq}  —  Duration: ${duration}`;
        
        y = pageBreakIfNeeded(doc, y, pageHeight, margin, 5);
        doc.text(textLine, margin + 2, y);
        y += 4.5;
      });
    y += 2;
  } else {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.gray);
    doc.text('No prior prescription recorded.', margin + 2, y);
    y += 6;
  }

  hRule(doc, y, margin, pageWidth);
  y += 4;

  // ── FOLLOW-UP SHEET divider ────────────────────────────────────────────────
  doc.setFillColor(...C.primary);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text('FOLLOW-UP SHEET', margin + 2, y + 4.2);
  y += 10;

  // ── Section renderer helpers ───────────────────────────────────────────────
  const SECTION_GAP   = 4;

  function writeSection(title, height) {
    y = pageBreakIfNeeded(doc, y, pageHeight, margin, height + 12);
    y = sectionTitle(doc, title, y, margin, pageWidth);
    y += height;
    y += SECTION_GAP;
  }

  // ── Total Beneficiary Field ────────────────────────────────────────────────
  y = pageBreakIfNeeded(doc, y, pageHeight, margin, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text('TOTAL BENEFICIARY (including patient):', margin, y);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text(String(totalBeneficiaries), margin + 66, y);

  doc.setDrawColor(...C.dark);
  doc.setLineWidth(0.4);
  doc.line(margin + 65, y + 1, margin + 85, y + 1);

  y += SECTION_GAP + 6;

  // ── 4. Chief Complaints ────────────────────────────────────────────────────
  writeSection('1.  CHIEF COMPLAINTS', 20);

  // ── 5. History of Presenting Illness ──────────────────────────────────────
  writeSection('2.  HISTORY OF PRESENTING ILLNESS', 25);

  // ── 6. Clinical Assessment ────────────────────────────────────────────────
  writeSection('3.  CLINICAL ASSESSMENT', 15);

  // ── 7. VITALS ─────────────────────────────────────────────────────────────
  y = pageBreakIfNeeded(doc, y, pageHeight, margin, 28);
  y = sectionTitle(doc, '4.  VITALS', y, margin, pageWidth);
  y += 4;

  const vitals = [
    { label: 'PR',   unit: 'bpm' },
    { label: 'BP',   unit: 'mmHg' },
    { label: 'RR',   unit: '/min' },
    { label: 'SpO2', unit: '%' },
    { label: 'Temp', unit: '°F' },
    { label: 'GRBS', unit: 'mg/dL' },
  ];

  const colWidth = 48;
  const colXs = [margin, 75, 135];

  vitals.forEach(({ label, unit }, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const rowY = y + row * 8;
    const vx = colXs[col];

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.dark);
    const labelText = `${label}:`;
    doc.text(labelText, vx, rowY);

    const labelW = doc.getTextWidth(labelText) + 2;

    // Unit
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    const unitW = doc.getTextWidth(unit);
    const unitX = vx + colWidth - unitW;
    doc.text(unit, unitX, rowY);

    // Underline
    doc.setDrawColor(...C.dark);
    doc.setLineWidth(0.4);
    doc.line(vx + labelW, rowY, unitX - 2, rowY);

    // BP helper note right below the line
    if (label === 'BP') {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...C.gray);
      doc.text('(BP format: Systolic / Diastolic)', vx + labelW, rowY + 3.5);
    }
  });

  y += 2 * 8 + SECTION_GAP;

  // ── 8. PPS SCORE, STATUS & PRIORITY ───────────────────────────────────────
  y = pageBreakIfNeeded(doc, y, pageHeight, margin, 14);
  y = sectionTitle(doc, '5.  PPS, STATUS & PRIORITY', y, margin, pageWidth);
  y += 4;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);

  // Column 1: PPS (Left)
  doc.text('PPS:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(...C.dark);
  doc.setLineWidth(0.4);
  doc.line(margin + 10, y, margin + 26, y);
  doc.text('%', margin + 28, y);

  // Column 2: BSC Status (Middle)
  doc.setFont('helvetica', 'bold');
  doc.text('BSC Status:', 72, y);
  doc.setFont('helvetica', 'normal');
  const bscopts = ['BSC', 'Non-BSC'];
  let bx = 72 + 22;
  bscopts.forEach(opt => {
    doc.rect(bx, y - 3.5, 3.5, 3.5);
    doc.text(opt, bx + 5, y);
    bx += doc.getTextWidth(opt) + 10;
  });

  // Column 3: Priority (Right)
  doc.setFont('helvetica', 'bold');
  doc.text('Priority:', 132, y);
  doc.setFont('helvetica', 'normal');
  const priopts = ['High', 'Medium', 'Low'];
  let px = 132 + 16;
  priopts.forEach(opt => {
    doc.rect(px, y - 3.5, 3.5, 3.5);
    doc.text(opt, px + 5, y);
    px += doc.getTextWidth(opt) + 10;
  });

  y += 3 + SECTION_GAP;

  // ── 9. & 10. Local & Systemic Examination (Side-by-side columns) ──────────
  y = pageBreakIfNeeded(doc, y, pageHeight, margin, 42);

  // Left Column: 6. LOCAL EXAMINATION
  doc.setFillColor(...C.lightGray);
  doc.rect(margin, y, 85, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text('6. LOCAL EXAMINATION', margin + 2, y + 4.2);

  // Right Column: 7. SYSTEMIC EXAMINATION
  doc.setFillColor(...C.lightGray);
  doc.rect(110, y, 85, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text('7. SYSTEMIC EXAMINATION', 110 + 2, y + 4.2);

  y += 6;
  y += 30; // 30mm height blank space for writing
  y += SECTION_GAP;

  // ── 11. Follow-up Advice ──────────────────────────────────────────────────
  y = pageBreakIfNeeded(doc, y, pageHeight, margin, 166);
  y = sectionTitle(doc, '8.  FOLLOW-UP ADVICE', y, margin, pageWidth);
  
  y += 4;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text('Pharmacological:', margin + 2, y);
  y += 75;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.dark);
  doc.text('Non-Pharmacological:', margin + 2, y);
  y += 75;
  y += SECTION_GAP;

  // ── 12. Follow-up Remarks ─────────────────────────────────────────────────
  writeSection('9.  FOLLOW-UP REMARKS', 5);
  // ── Doctor Signature (Aligned to the lower rightmost corner of the last page) ──
  const sigBlockHeight = 12;
  const sigY = pageHeight - margin - sigBlockHeight;

  if (y > sigY) {
    doc.addPage();
    y = sigY;
  } else {
    y = sigY;
  }

  doc.setFontSize(8.5);
  doc.setDrawColor(...C.dark);
  doc.setLineWidth(0.4);

  // 1. Render Signature Block (Far Right)
  const sigBoxW = 50;
  const sigBoxX = pageWidth - margin - sigBoxW;
  doc.line(sigBoxX, y, sigBoxX + sigBoxW, y);
  
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...C.gray);
  doc.setFontSize(7.5);
  doc.text("Doctor's Signature", sigBoxX + sigBoxW / 2, y + 4, { align: 'center' });

  // 2. Render Date (To the left of Signature)
  const dateBoxW = 30;
  const dateBoxX = sigBoxX - 10 - dateBoxW;
  doc.line(dateBoxX, y, dateBoxX + dateBoxW, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.gray);
  doc.setFontSize(8.5);
  const dateLabel = 'Date:';
  const labelW = doc.getTextWidth(dateLabel);
  doc.text(dateLabel, dateBoxX - labelW - 2, y);

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text(
      `${CLINIC_NAME}  —  Acute Visit Sheet  |  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' },
    );
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const safeName = (patient.full_name || 'Patient').replace(/\s+/g, '_');
  const dateFile = new Date().toISOString().split('T')[0];
  doc.save(`AcuteVisitSheet_${safeName}_${dateFile}.pdf`);
}
