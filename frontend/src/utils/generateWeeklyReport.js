/**
 * Generate a comprehensive Weekly Report PDF for a schedule.
 * Includes: schedule summary, per-day patient details with statuses,
 * team assignments, deviations, and compliance stats.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CLINIC_NAME = 'Saranam India Health Care';

function fmtTime(t) {
  if (!t) return '--';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h > 12 ? h - 12 : h || 12}:${(m || 0).toString().padStart(2, '0')} ${ap}`;
}

function fmtDateTime(dt) {
  if (!dt) return '--';
  const d = new Date(dt);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function generateWeeklyReport(schedule, deviations = []) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const colors = {
    primary: [25, 118, 210],
    dark: [30, 41, 59],
    gray: [100, 116, 139],
    lightGray: [241, 245, 249],
    white: [255, 255, 255],
    green: [5, 150, 105],
    red: [220, 38, 38],
    amber: [217, 119, 6],
  };

  function checkPage(needed = 25) {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  }

  function sectionTitle(title) {
    checkPage(15);
    doc.setFillColor(...colors.lightGray);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(...colors.dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
  }

  // ── HEADER ──
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(...colors.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(CLINIC_NAME, margin, 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Weekly Deviation & Visit Report', margin, 20);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin - 60, 20);
  y = 38;

  // ── SCHEDULE INFO ──
  const weekLabel = schedule.week_label || `${schedule.week_start_date} — ${schedule.week_end_date}`;
  doc.setTextColor(...colors.dark);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Week: ${weekLabel}`, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.gray);
  const infoLine = [
    schedule.vehicle_name && `Vehicle: ${schedule.vehicle_name}`,
    `Status: ${schedule.status}`,
  ].filter(Boolean).join('  |  ');
  doc.text(infoLine, margin, y);
  y += 10;

  // ── SUMMARY STATS ──
  const days = schedule.days || [];
  let totalVisits = 0, completed = 0, missed = 0, cancelled = 0, adhoc = 0, late = 0;
  for (const day of days) {
    for (const slot of day.slots || []) {
      totalVisits++;
      if (slot.status === 'completed') {
        completed++;
        if (slot.scheduled_time && slot.started_at) {
          const schedMin = parseInt(slot.scheduled_time.split(':')[0]) * 60 + parseInt(slot.scheduled_time.split(':')[1]);
          const startDate = new Date(slot.started_at);
          const actualMin = startDate.getHours() * 60 + startDate.getMinutes();
          if (actualMin - schedMin > 30) late++;
        }
      }
      if (slot.status === 'missed') missed++;
      if (slot.status === 'cancelled') cancelled++;
      if (slot.is_adhoc) adhoc++;
    }
  }
  const onTime = completed - late;
  const complianceRate = totalVisits > 0 ? Math.round((onTime / totalVisits) * 100) : 0;

  sectionTitle('Summary');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.dark);

  const statsData = [
    ['Total Visits', String(totalVisits)],
    ['Completed (On Time)', String(onTime)],
    ['Completed (Late)', String(late)],
    ['Missed', String(missed)],
    ['Cancelled', String(cancelled)],
    ['Ad-hoc Additions', String(adhoc)],
    ['Deviations Reported', String(deviations.length)],
    ['Compliance Rate', `${complianceRate}%`],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value']],
    body: statsData,
    theme: 'grid',
    headStyles: { fillColor: colors.primary, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40, halign: 'center', fontStyle: 'bold' } },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── PER-DAY BREAKDOWN ──
  for (const day of days) {
    const slots = day.slots || [];
    if (slots.length === 0) continue;

    checkPage(30);
    const dayDate = day.date || day.day_of_week || '';
    sectionTitle(`${day.day_of_week || ''} — ${dayDate}  (${slots.length} patients)`);

    const tableBody = slots.map((slot, idx) => {
      const actualTime = slot.started_at ? fmtDateTime(slot.started_at) : '--';
      const reason = slot.missed_reason || slot.cancelled_reason || (slot.is_adhoc ? `Ad-hoc: ${slot.adhoc_reason || ''}` : '');
      return [
        String(idx + 1),
        slot.patient_name || 'Patient',
        slot.vehicle_name || '',
        fmtTime(slot.scheduled_time),
        actualTime,
        slot.status || 'scheduled',
        reason,
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Patient', 'Vehicle', 'Scheduled', 'Actual', 'Status', 'Reason']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: colors.primary, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 18 },
        6: { cellWidth: contentWidth - 131 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const status = data.cell.text[0];
          if (status === 'completed') data.cell.styles.textColor = colors.green;
          else if (status === 'missed') data.cell.styles.textColor = colors.red;
          else if (status === 'cancelled') data.cell.styles.textColor = colors.gray;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 4;

    // Team for this day
    const team = day.team || day.team_assignments || [];
    if (team.length > 0) {
      checkPage(15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.gray);
      doc.text('Team:', margin, y);
      doc.setFont('helvetica', 'normal');
      const formatRole = (r) => (r || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const teamStr = team.map(t => `${formatRole(t.role)}: ${t.provider_name || 'Unassigned'}`).join('  |  ');
      doc.text(teamStr, margin + 15, y);
      y += 6;
    }

    // Day deviations
    const dayDevs = deviations.filter(d => d.schedule_day_id === day.id);
    if (dayDevs.length > 0) {
      checkPage(15);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.amber);
      doc.text(`Deviations (${dayDevs.length}):`, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.dark);
      for (const dev of dayDevs) {
        checkPage(12);
        doc.setFontSize(7);
        doc.text(`[${dev.deviation_type?.replace(/_/g, ' ')}] ${dev.description}`, margin + 4, y);
        y += 4;
        if (dev.time_impact) {
          doc.setTextColor(...colors.amber);
          doc.text(`Time impact: ${dev.time_impact}`, margin + 8, y);
          doc.setTextColor(...colors.dark);
          y += 4;
        }
        if (dev.emergency_patient_name) {
          doc.text(`Emergency: ${dev.emergency_patient_name} — ${dev.emergency_reason || ''}`, margin + 8, y);
          y += 4;
        }
        y += 2;
      }
    }
    y += 4;
  }

  // ── DEVIATIONS SUMMARY ──
  if (deviations.length > 0) {
    checkPage(20);
    sectionTitle(`All Deviations (${deviations.length})`);

    const devBody = deviations.map(d => [
      d.deviation_type?.replace(/_/g, ' ') || '',
      d.description || '',
      d.time_impact || '',
      d.reporter_name || '',
      d.created_at ? new Date(d.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Type', 'Description', 'Time Impact', 'Reported By', 'When']],
      body: devBody,
      theme: 'grid',
      headStyles: { fillColor: colors.amber, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
    });
  }

  // Save
  const filename = `weekly-report-${schedule.week_start_date || 'schedule'}.pdf`;
  doc.save(filename);
}
