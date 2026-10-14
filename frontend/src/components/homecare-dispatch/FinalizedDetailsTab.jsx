/** Finalized Details — each vehicle's locked stops with contacts, scores and drive metrics. */
import React from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

const visitType = (s) => (s.visit_type === 'bereavement' ? '🕊️ Bereavement'
  : (s.visit_type === 'initial' || s.patient_type_at_visit === 'new') ? '🆕 Initial' : '🟢 Follow-up');

const COLUMNS = [
  ['Stop', s => s.slot_order], ['Visit Type', visitType], ['Patient Name', s => s.patient_name], ['UHID', s => s.uhid],
  ['Phone Number', s => s.phone || 'N/A'], ['Alternative Phone', s => s.alternative_phone || 'N/A'],
  ['Caregiver Phone', s => s.primary_caregiver_phone || 'N/A'], ['Decision Maker Phone', s => s.decision_maker_phone || 'N/A'],
  ['Zone', s => s.zone], ['Priority', s => s.priority_at_visit], ['Gaps (Days)', s => s.gap_days_at_visit],
  ['Urgency Score', s => s.urgency_score_at_visit], ['Distance', s => `${Number(s.drive_distance_km || 0).toFixed(2)} km`],
  ['Duration', s => `${Number(s.drive_duration_min || 0).toFixed(1)} mins`],
  ['Status', s => s.status.charAt(0).toUpperCase() + s.status.slice(1)],
];

export default function FinalizedDetailsTab({ schedule }) {
  return (
    <div className="space-y-4">
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Vehicle Assignments</Typography>
      {schedule.vehicles.map(v => {
        const vSlots = schedule.slots.filter(s => s.vehicle_id === v.id).sort((a, b) => a.slot_order - b.slot_order);
        return (
          <Paper key={v.id} className="p-4 space-y-2">
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              🚛 {v.name} ({v.registration_number || 'No Reg'}) — <strong>{vSlots.length} Stops</strong>
            </Typography>
            {vSlots.length === 0 ? (
              <Typography variant="caption" color="text.secondary">No visits assigned to this vehicle.</Typography>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 1500 }}>
                  <TableHead>
                    <TableRow>{COLUMNS.map(([h]) => <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {vSlots.map(s => (
                      <TableRow key={s.id}>
                        {COLUMNS.map(([h, get]) => <TableCell key={h} sx={{ whiteSpace: 'nowrap' }}>{get(s)}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        );
      })}
    </div>
  );
}
