/**
 * Generate a professional PDF consultation report for a completed visit.
 * Works for OPD, Physiotherapy, and Home Care visits.
 */
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDosageForm } from '../constants/prescription';

const CLINIC_NAME = 'Saranam India Health Care';
const CLINIC_TAGLINE = 'Palliative & Home Based Care';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatAge(dob) {
  if (!dob) return '—';
  const d = new Date(dob);
  return Math.floor((Date.now() - d) / (365.25 * 24 * 3600 * 1000)) + ' years';
}

export default function generateVisitPDF(visit, visitType = 'OPD') {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const colors = {
    primary: [37, 99, 235],    // blue
    success: [5, 150, 105],    // green
    dark: [30, 30, 30],
    gray: [107, 114, 128],
    lightGray: [243, 244, 246],
    white: [255, 255, 255],
  };

  // ─── Header ──────────────────────────────────────────────────────
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(...colors.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(CLINIC_NAME, margin, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(CLINIC_TAGLINE, margin, 21);

  const typeLabel = visitType === 'HOME_CARE' ? 'Home Care' : visitType === 'PHYSIOTHERAPY' ? 'Physiotherapy' : 'OPD';
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${typeLabel} Consultation Report`, pageWidth - margin, 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(visit.start_time)}`, pageWidth - margin, 21, { align: 'right' });

  y = 38;

  // ─── Helper: Section title ──────────────────────────────────────
  function sectionTitle(title) {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFillColor(...colors.lightGray);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(...colors.dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, y + 5);
    y += 10;
  }

  function addField(label, value, indent = 0) {
    if (!value || value === '—') return;
    if (y > 280) { doc.addPage(); y = margin; }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray);
    doc.text(label + ':', margin + 3 + indent, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.dark);
    const labelWidth = doc.getTextWidth(label + ': ');
    const maxWidth = contentWidth - labelWidth - 6 - indent;
    const lines = doc.splitTextToSize(String(value), maxWidth);
    doc.text(lines, margin + 3 + indent + labelWidth, y);
    y += lines.length * 4.5;
  }

  function addFieldRow(fields) {
    if (y > 280) { doc.addPage(); y = margin; }
    const colWidth = contentWidth / fields.length;
    doc.setFontSize(9);
    fields.forEach((f, i) => {
      if (!f.value) return;
      const x = margin + 3 + i * colWidth;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.gray);
      doc.text(f.label + ':', x, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.dark);
      doc.text(String(f.value), x + doc.getTextWidth(f.label + ': '), y);
    });
    y += 5;
  }

  // ─── Patient Information ─────────────────────────────────────────
  sectionTitle('PATIENT INFORMATION');

  addFieldRow([
    { label: 'Name', value: visit.patient_name },
    { label: 'UHID', value: visit.patient_uhid || '—' },
    { label: 'Age', value: formatAge(visit.patient_dob) },
  ]);
  addFieldRow([
    { label: 'Gender', value: visit.patient_gender },
  ]);
  addFieldRow([
    { label: 'Visit Date', value: `${formatDate(visit.start_time)} ${formatTime(visit.start_time)}` },
    { label: 'Doctor', value: visit.provider_name },
    { label: 'Specialization', value: visit.provider_specialization },
  ]);
  if (visit.chief_complaint) {
    addField('Chief Complaint', visit.chief_complaint);
  }
  if (visit.encounter_number) {
    addField('Encounter #', visit.encounter_number);
  }
  // Distance info (for home care visits)
  const distanceMeters = visit.service_metadata?.gps_checkin?.distance_meters;
  if (distanceMeters != null) {
    addField('Distance', `${(distanceMeters / 1000).toFixed(1)} km from base`);
  }
  y += 2;

  // ─── Nursing Assessment ──────────────────────────────────────────
  const vitals = visit.vitals?.[0];
  if (vitals) {
    sectionTitle('NURSING ASSESSMENT');
    const vd = vitals.vitals_data || {};
    const ad = vitals.assessment_data || {};

    // General Physical Exam
    const gpe = ad.general_physical_exam || {};
    if (gpe.state_of_patient) {
      addField('General', `${gpe.state_of_patient}, ${gpe.orientation || ''}, ADL: ${gpe.adl || ''}, Built: ${gpe.built || ''}, Hygiene: ${gpe.hygiene || ''}`);
    }

    // Vitals
    const vParts = [];
    if (vd.blood_pressure_systolic && vd.blood_pressure_diastolic) vParts.push(`BP ${vd.blood_pressure_systolic}/${vd.blood_pressure_diastolic} mmHg`);
    if (vd.pulse) vParts.push(`PR ${vd.pulse} bpm`);
    if (vd.respiratory_rate) vParts.push(`RR ${vd.respiratory_rate}/min`);
    if (vd.temperature) vParts.push(`Temp ${vd.temperature}°F`);
    if (vd.oxygen_saturation) vParts.push(`SpO2 ${vd.oxygen_saturation}%`);
    if (vd.grbs) vParts.push(`GRBS ${vd.grbs} mg/dL`);
    if (vd.weight) vParts.push(`Wt ${vd.weight} kg`);
    if (vd.height) vParts.push(`Ht ${vd.height} cm`);
    if (vParts.length) addField('Vitals', vParts.join('  |  '));

    // Pain
    const pain = ad.pain_assessment || {};
    if (pain.score > 0) {
      addField('Pain Score', `${pain.score}/10${pain.description ? ' — ' + pain.description : ''}`);
    }

    // Symptoms
    const sym = ad.symptom_assessment || {};
    const activeSymptoms = [];
    if (sym.nausea_vomiting) activeSymptoms.push(`Nausea/Vomiting: ${sym.nausea_vomiting}`);
    if (sym.wound) activeSymptoms.push(`Wound: ${sym.wound}`);
    if (sym.dyspnea) activeSymptoms.push(`Dyspnea: ${sym.dyspnea}`);
    if (sym.feeding_tubes) activeSymptoms.push('Feeding Tubes');
    if (sym.urinary_catheter) activeSymptoms.push('Urinary Catheter');
    if (sym.tracheostomy) activeSymptoms.push('Tracheostomy');
    if (sym.lymphoedema) activeSymptoms.push('Lymphoedema');
    if (sym.bed_sore) activeSymptoms.push(`Bed Sore: ${sym.bed_sore}`);
    if (activeSymptoms.length) addField('Symptoms', activeSymptoms.join(', '));
    if (sym.remarks) addField('Remarks', sym.remarks);

    // Visit Summary
    if (vitals.visit_summary) {
      addField('Summary', vitals.visit_summary);
    }
    y += 2;
  }

  // ─── Clinical Assessment (Doctor/Physio/Home Care) ───────────────
  const doctorData = visit.service_metadata?.doctor_assessment || visit.service_metadata?.physio_assessment || visit.service_metadata?.homecare_assessment;
  if (doctorData) {
    const title = visitType === 'PHYSIOTHERAPY' ? 'PHYSIOTHERAPY ASSESSMENT' :
                  visitType === 'HOME_CARE' ? 'CARE TAKER ASSESSMENT' : "DOCTOR'S ASSESSMENT";
    sectionTitle(title);

    if (doctorData.chief_complaints) addField('Chief Complaints', doctorData.chief_complaints);
    if (doctorData.history_of_illness) addField('History of Illness', doctorData.history_of_illness);
    if (doctorData.comorbidities) addField('Comorbidities', doctorData.comorbidities);
    if (doctorData.medication_history) addField('Medication History', doctorData.medication_history);
    if (doctorData.previous_investigations) addField('Previous Investigations', doctorData.previous_investigations);
    if (doctorData.family_history) addField('Family History', doctorData.family_history);

    // Personal history
    const ph = doctorData.personal_history || {};
    const phParts = [ph.diet && `Diet: ${ph.diet}`, ph.appetite && `Appetite: ${ph.appetite}`, ph.bowel_bladder && `Bowel/Bladder: ${ph.bowel_bladder}`, ph.habits && `Habits: ${ph.habits}`].filter(Boolean);
    if (phParts.length) addField('Personal History', phParts.join(', '));

    // Systemic exam
    const se = doctorData.systemic_exam || {};
    if (se.respiratory) addField('Respiratory', se.respiratory);
    if (se.cardiovascular) addField('Cardiovascular', se.cardiovascular);
    if (se.per_abdomen) addField('Per Abdomen', se.per_abdomen);
    if (se.cns) addField('CNS', se.cns);

    // Physio specific
    if (doctorData.pain_assessment) {
      const pa = doctorData.pain_assessment;
      if (pa.vas_score) addField('VAS Score', `${pa.vas_score}/10`);
      if (pa.area_of_pain) addField('Area of Pain', pa.area_of_pain);
    }
    if (doctorData.on_observation) addField('On Observation', doctorData.on_observation);
    if (doctorData.on_palpation) addField('On Palpation', doctorData.on_palpation);
    if (doctorData.rom) addField('ROM', doctorData.rom);
    if (doctorData.mmt) addField('MMT', doctorData.mmt);

    // Home Care specific
    const homeEnv = doctorData.home_environment || {};
    if (homeEnv.accessibility) addField('Home Accessibility', homeEnv.accessibility);
    if (homeEnv.caregiver_present) addField('Caregiver', `${homeEnv.caregiver_name || 'Yes'} (${homeEnv.caregiver_relationship || ''})`);

    if (doctorData.doctor_notes) addField('Clinical Notes', doctorData.doctor_notes);
    y += 2;
  }

  // ─── Diagnoses ───────────────────────────────────────────────────
  if (visit.diagnoses?.length > 0) {
    sectionTitle('DIAGNOSIS');
    visit.diagnoses.forEach((d, i) => {
      const code = d.icd10_code || d.diagnosis_code || '';
      const name = d.diagnosis_text || d.diagnosis_name || '';
      const type = d.diagnosis_type || '';
      addField(`${i + 1}`, `${name}${code ? ' (' + code + ')' : ''} — ${type}${d.notes ? ' | ' + d.notes : ''}`);
    });
    y += 2;
  }

  // ─── Prescription ────────────────────────────────────────────────
  if (visit.prescription?.items?.length > 0) {
    sectionTitle('PRESCRIPTION');

    // Non-pharmacological
    const nonPharma = visit.service_metadata?.non_pharmacological;
    if (nonPharma) {
      addField('Non-Pharmacological', nonPharma);
      y += 2;
    }

    const tableData = visit.prescription.items.map((item, i) => {
      // Structured dosage: "½-0-1" or legacy free-text
      let dosageStr = item.dosage || '';
      if (item.dosage_morning || item.dosage_afternoon || item.dosage_night) {
        const m_ = item.dosage_morning || '0';
        const a_ = item.dosage_afternoon || '0';
        const n_ = item.dosage_night || '0';
        if (m_ !== '0' || a_ !== '0' || n_ !== '0') dosageStr = `${m_}-${a_}-${n_}`;
      }

      let freqStr = item.frequency || '';
      if (item.sos) freqStr = freqStr ? `${freqStr} + SOS` : 'SOS';

      return [
        i + 1,
        item.medicine_name || '',
        formatDosageForm(item.dosage_form) || '',
        dosageStr || '—',
        freqStr || '—',
        item.duration ? `${item.duration} ${item.duration_unit || 'days'}` : '',
        item.route || 'Oral',
        item.instructions || '',
        item.warning_signs || '',
      ];
    });

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Medicine', 'Form', 'Dosage', 'Frequency', 'Duration', 'Route', 'Instructions', 'Warning']],
      body: tableData,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: colors.primary, textColor: colors.white, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { cellWidth: 25 },
        2: { cellWidth: 14 },
        3: { cellWidth: 14 },
        4: { cellWidth: 18 },
        5: { cellWidth: 14 },
        6: { cellWidth: 13 },
        7: { cellWidth: 22 },
        8: { cellWidth: 'auto' },
      },
    });
    y = doc.lastAutoTable.finalY + 5;

    if (visit.prescription.notes) {
      addField('Rx Notes', visit.prescription.notes);
    }
    y += 2;
  }

  // ─── Lab Orders ──────────────────────────────────────────────────
  if (visit.lab_order?.items?.length > 0) {
    sectionTitle('LAB ORDERS');
    visit.lab_order.items.forEach((item, i) => {
      addField(`${i + 1}`, `${item.test_name}${item.urgency ? ' — ' + item.urgency : ''}${item.notes ? ' | ' + item.notes : ''}`);
    });
    y += 2;
  }

  // ─── Follow-up & Notes ──────────────────────────────────────────
  if (visit.follow_up_required || visit.post_appointment_notes) {
    sectionTitle('FOLLOW-UP & NOTES');
    if (visit.follow_up_scheduled_at) {
      addField('Follow-up Date', formatDate(visit.follow_up_scheduled_at));
    }
    if (visit.post_appointment_notes) {
      addField('Post-visit Notes', visit.post_appointment_notes);
    }
    y += 2;
  }

  // ─── Footer / Signature ──────────────────────────────────────────
  if (y > 250) { doc.addPage(); y = margin; }
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.dark);
  doc.text(visit.provider_name || 'Doctor', margin + 3, y);
  doc.text(formatDate(visit.start_time), pageWidth - margin, y, { align: 'right' });
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.gray);
  const qualLine = [visit.provider_specialization, visit.provider_qualification].filter(Boolean).join(' | ');
  doc.text(qualLine || '', margin + 3, y);
  doc.text(CLINIC_NAME, pageWidth - margin, y, { align: 'right' });
  if (visit.provider_license_number) {
    y += 4;
    doc.text(`Reg: ${visit.provider_license_number}`, margin + 3, y);
  }

  // ─── Page numbers ────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
  }

  // ─── Save ────────────────────────────────────────────────────────
  const patientName = (visit.patient_name || 'Patient').replace(/\s+/g, '_');
  const dateStr = formatDate(visit.start_time).replace(/\s+/g, '_');
  doc.save(`${typeLabel}_Report_${patientName}_${dateStr}.pdf`);
}
