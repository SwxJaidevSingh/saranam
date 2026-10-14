/**
 * Generate a pharmacy-ready prescription PDF.
 *
 * Updated for meeting §5 (2026-04-14):
 * - §5.1: explicit "Dosage" column showing the medicine's strength (e.g. "500 mg")
 *   alongside the separate "Timing" column.
 * - §5.2: schedule_mode-aware timing rendering — opioid (6/10/2/6/10), TDS
 *   (morning/afternoon/night), or custom (free-form time+dose pairs).
 *   Each row prefixes its timing with a small mode hint so a pharmacist reading
 *   "1-0-1" understands whether the slots are morning/afternoon/night or custom.
 * - §5.4: signature rendering now handles both data URLs (base64 fallback) and
 *   HTTPS URLs (Cloudinary). The function is async so it can fetch a remote URL
 *   and convert to a data URL before embedding.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDosageForm } from '../constants/prescription';

const CLINIC_NAME = 'Saranam India Health Care';
const CLINIC_TAGLINE = 'Palliative & Home Based Care';
const CLINIC_ADDRESS = 'Kidwai Memorial Institute of Oncology, Bangalore';

// Map a schedule_mode to a short human-readable prefix for the Timing column.
const SCHEDULE_MODE_LABELS = {
  opioid: '6-10-2-6-10',
  tds:    'M-A-N',
  custom: 'Custom',
};

// Try to extract an image format ('PNG'|'JPEG'|'WEBP') from a data URL or a
// URL path. jsPDF.addImage() needs the format explicitly.
function detectImageFormat(src) {
  if (!src) return 'PNG';
  const lower = src.toLowerCase();
  if (lower.startsWith('data:image/')) {
    const slash = lower.indexOf('/');
    const semi = lower.indexOf(';', slash);
    const mime = lower.slice(slash + 1, semi === -1 ? lower.length : semi);
    if (mime === 'jpg' || mime === 'jpeg') return 'JPEG';
    if (mime === 'webp') return 'WEBP';
    return 'PNG';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'JPEG';
  if (lower.endsWith('.webp')) return 'WEBP';
  return 'PNG';
}

// If the image is an HTTPS URL (Cloudinary etc), fetch it and convert to a
// data URL so jsPDF can embed it synchronously. Returns the src unchanged
// when it's already a data URL. Returns null on fetch failure.
async function resolveImageToDataUrl(src) {
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Prescription PDF: failed to load signature image', err);
    return null;
  }
}

// Build the timing-column string for a single medicine row, respecting the
// three §5.2 schedule modes. Returns { text, label } where `label` is a short
// mode hint rendered above the value.
function buildTimingCell(med) {
  // Infer mode from legacy data when schedule_mode wasn't saved (older rows).
  const mode = med.schedule_mode || (
    med.dosage_6am || med.dosage_10am || med.dosage_2pm || med.dosage_6pm || med.dosage_10pm
      ? 'opioid'
      : (med.dosage_morning || med.dosage_afternoon || med.dosage_night) ? 'tds' : null
  );

  if (mode === 'opioid') {
    const vals = [med.dosage_6am || '0', med.dosage_10am || '0', med.dosage_2pm || '0', med.dosage_6pm || '0', med.dosage_10pm || '0'];
    if (vals.some(v => v !== '0')) {
      return { text: vals.join('-'), label: SCHEDULE_MODE_LABELS.opioid };
    }
  }
  if (mode === 'tds') {
    const m_ = med.dosage_morning || '0';
    const a_ = med.dosage_afternoon || '0';
    const n_ = med.dosage_night || '0';
    if (m_ !== '0' || a_ !== '0' || n_ !== '0') {
      return { text: `${m_}-${a_}-${n_}`, label: SCHEDULE_MODE_LABELS.tds };
    }
  }
  if (mode === 'custom' && Array.isArray(med.custom_timings) && med.custom_timings.length) {
    const parts = med.custom_timings
      .filter(t => t && (t.time || t.dose) && t.dose !== '0')
      .map(t => `${t.time || '?'} ${t.dose || '0'}`);
    if (parts.length) return { text: parts.join(', '), label: SCHEDULE_MODE_LABELS.custom };
  }
  return { text: '—', label: '' };
}

export default async function generatePrescriptionPDF({
  patientName = 'Patient',
  patientId,
  patientUhid = null,
  patientHomecareCode = null,
  patientAge,
  patientGender,
  medications = [],
  pharmacological = '',
  nonPharmacological = '',
  followUpNotes = '',
  prescribedBy = '',
  prescribedDate = null,
  doctorName = '',
  doctorDesignation = '',
  doctorLicenseNumber = '',
  doctorSignatureImage = null,
  icd10Diagnosis = '',
  diagnosis = '',
  distance = null,
  // When true, return the PDF as a Blob instead of triggering a browser download
  // (used to upload the issued prescription to the backend / Cloudinary).
  returnBlob = false,
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const colors = {
    primary: [37, 99, 235],
    dark: [30, 30, 30],
    gray: [107, 114, 128],
    lightGray: [243, 244, 246],
    white: [255, 255, 255],
  };

  // ─── Header ──────────────────────────────────────────────────────
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(...colors.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(CLINIC_NAME, margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(CLINIC_TAGLINE, margin, 18);
  doc.text(CLINIC_ADDRESS, margin, 24);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESCRIPTION', pageWidth - margin, 14, { align: 'right' });

  // Rx symbol
  doc.setFontSize(22);
  doc.text('Rx', pageWidth - margin, 26, { align: 'right' });

  y = 36;

  // ─── Patient Info ────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.gray);

  doc.text('Patient Name:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.dark);
  doc.text(patientName, margin + 25, y);

  const dateStr = prescribedDate
    ? new Date(prescribedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.gray);
  doc.text('Date:', pageWidth - margin - 40, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.dark);
  doc.text(dateStr, pageWidth - margin - 28, y);
  y += 5;

  if (patientAge || patientGender) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text('Age/Gender:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text(`${patientAge || '—'} / ${patientGender || '—'}`, margin + 25, y);
    y += 5;
  }

  if (patientUhid) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text('UHID:', margin, y);
    doc.setFont('courier', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text(patientUhid, margin + 25, y);
    y += 5;
  }

  if (patientHomecareCode) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text('Homecare Code:', margin, y);
    doc.setFont('courier', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text(patientHomecareCode, margin + 32, y);
    y += 5;
  }

  if (prescribedBy) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text('Prescribed By:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text(prescribedBy, margin + 28, y);
    y += 5;
  }

  if (distance != null) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text('Distance:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text(`${typeof distance === 'number' ? distance.toFixed(1) : distance} km`, margin + 28, y);
    y += 5;
  }

  y += 3;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ─── ICD-10 Diagnosis ───────────────────────────────────────────
  if (icd10Diagnosis) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text('ICD-10 Diagnosis:', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const icdLines = doc.splitTextToSize(String(icd10Diagnosis), contentWidth);
    doc.text(icdLines, margin, y);
    y += icdLines.length * 4 + 4;
  }

  // ─── Diagnosis ──────────────────────────────────────────────────
  if (diagnosis) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text('Diagnosis:', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const diagText = Array.isArray(diagnosis) ? diagnosis.join(', ') : diagnosis;
    const diagLines = doc.splitTextToSize(diagText, contentWidth);
    doc.text(diagLines, margin, y);
    y += diagLines.length * 4 + 4;
  }

  // ─── Medications Table ───────────────────────────────────────────
  if (medications.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text('Medications', margin, y);
    y += 5;

    const tableBody = medications
      .filter(m => m.name)
      .map((med, idx) => {
        const timing = buildTimingCell(med);
        // Two-line timing cell: short mode hint on line 1, the values on line 2.
        // autoTable renders newlines inside a cell directly.
        const timingCell = timing.label
          ? `${timing.label}\n${timing.text}`
          : timing.text;

        let freqStr = med.frequency || '—';
        if (med.sos) freqStr = freqStr !== '—' ? `${freqStr} + SOS` : 'SOS';

        const duration = med.duration ? `${med.duration} ${med.duration_unit || 'days'}` : '—';

        return [
          idx + 1,
          med.name,
          med.strength || med.dosage || '—',   // full strength (combinations/concentrations)
          formatDosageForm(med.dosage_form) || '—',
          timingCell,                  // §5.2 — mode-aware timing
          freqStr,
          med.route || '—',
          duration,
          med.instructions || '—',
          med.warning_signs || '',
        ];
      });

    if (tableBody.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['#', 'Medicine', 'Strength', 'Form', 'Timing', 'Frequency', 'Route', 'Duration', 'Instructions', 'Warning']],
        body: tableBody,
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          lineColor: [220, 220, 220],
          lineWidth: 0.3,
          valign: 'middle',
        },
        headStyles: {
          fillColor: colors.primary,
          textColor: colors.white,
          fontStyle: 'bold',
          fontSize: 7,
        },
        columnStyles: {
          0: { cellWidth: 7 },   // #
          1: { cellWidth: 26 },  // Medicine
          2: { cellWidth: 14 },  // Dosage (strength)
          3: { cellWidth: 14 },  // Form
          4: { cellWidth: 20 },  // Timing (mode + values)
          5: { cellWidth: 16 },  // Frequency
          6: { cellWidth: 12 },  // Route
          7: { cellWidth: 14 },  // Duration
          8: { cellWidth: 20 },  // Instructions
          9: { cellWidth: 'auto' }, // Warning
        },
      });
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : y + 10;
    }
  }

  // ─── Pharmacological Notes ───────────────────────────────────────
  if (pharmacological) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text('Pharmacological Notes:', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(pharmacological, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 5;
  }

  // ─── Non-Pharmacological ─────────────────────────────────────────
  if (nonPharmacological) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text('Non-Pharmacological Advice:', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(nonPharmacological, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 5;
  }

  // ─── Follow-up Notes ─────────────────────────────────────────────
  if (followUpNotes) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text('Follow-up Notes:', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(followUpNotes, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 5;
  }

  // ─── Signature Line ─────────────────────────────────────────────
  y = Math.max(y + 15, 230);

  // §5.4: support both base64 data URLs (fallback) and Cloudinary HTTPS URLs.
  // resolveImageToDataUrl() fetches the remote URL into a data URL so jsPDF
  // can embed it synchronously. Detects PNG/JPEG/WEBP from the MIME prefix.
  const signatureDataUrl = await resolveImageToDataUrl(doctorSignatureImage);
  if (signatureDataUrl) {
    try {
      const fmt = detectImageFormat(signatureDataUrl);
      doc.addImage(signatureDataUrl, fmt, pageWidth - margin - 60, y - 18, 50, 18);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Prescription PDF: failed to embed signature', err);
    }
  }
  doc.setDrawColor(150, 150, 150);
  doc.line(pageWidth - margin - 70, y, pageWidth - margin, y);
  y += 5;

  if (doctorName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.dark);
    doc.text(doctorName, pageWidth - margin - 35, y, { align: 'center' });
    y += 4;
  }
  if (doctorDesignation) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text(doctorDesignation, pageWidth - margin - 35, y, { align: 'center' });
    y += 4;
  }
  if (doctorLicenseNumber) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text(`Reg: ${doctorLicenseNumber}`, pageWidth - margin - 35, y, { align: 'center' });
    y += 4;
  }
  if (!doctorName && !doctorDesignation && !doctorLicenseNumber) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text("Doctor's Signature", pageWidth - margin - 35, y, { align: 'center' });
  }

  // ─── Footer ──────────────────────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...colors.gray);
  doc.text(CLINIC_NAME, pageWidth / 2, pageHeight - 8, { align: 'center' });

  // Return the blob (for upload) or trigger a browser download.
  if (returnBlob) {
    return doc.output('blob');
  }
  const dateFile = new Date().toISOString().split('T')[0];
  doc.save(`Prescription_${patientName.replace(/\s+/g, '_')}_${dateFile}.pdf`);
  return null;
}
