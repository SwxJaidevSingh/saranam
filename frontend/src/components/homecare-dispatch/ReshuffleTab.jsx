/**
 * Reshuffle Patients — move scheduled patients between vehicles (zone matching is
 * not enforced here), with recommendations for patients near another zone's boundary.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Button, MenuItem, Paper, Select, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import homecareDispatchApi from '../../api/homecareDispatch';
import { reindexByVehicle } from './draft';

const UNASSIGN = '__unassign__';

export default function ReshuffleTab({
  dateStr, schedule, candidates, draft, setDraft, deceased, isDisabled, saving, onSave, onFlash,
}) {
  const vehicles = schedule.vehicles;
  const vehiclesById = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v])), [vehicles]);
  const patientsById = useMemo(() => {
    const m = new Map();
    candidates.patients.forEach(p => m.set(String(p.id), p));
    candidates.deceased_patients.forEach(p => { if (!m.has(String(p.id))) m.set(String(p.id), p); });
    return m;
  }, [candidates]);
  const [suggestions, setSuggestions] = useState([]);

  const draftKey = draft.map(s => `${s.patient_id}:${s.vehicle_id}`).join(',');
  useEffect(() => {
    if (!draft.length) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      homecareDispatchApi.getBoundarySuggestions(dateStr, draft.map(s => ({ patient_id: s.patient_id, vehicle_id: s.vehicle_id })))
        .then(res => !cancelled && setSuggestions(res))
        .catch(() => !cancelled && setSuggestions([]));
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [dateStr, draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveTo = (patientId, target) => {
    const updated = [];
    draft.forEach(s => {
      if (s.patient_id !== patientId) updated.push(s);
      else if (target !== UNASSIGN) updated.push({ ...s, vehicle_id: target });
    });
    setDraft(reindexByVehicle(updated));
  };

  const deadNames = deceased.map(d => `${d.name} (UHID: ${d.uhid || 'N/A'})`).join(', ');
  const disabledLabel = schedule.has_vehicle_log ? 'Completed'
    : schedule.draft.is_date_surpassed_expired ? 'Closed - Schedule Date Surpassed'
      : schedule.is_past_date ? 'Closed' : schedule.draft.is_draft_expired ? 'Draft Expired' : 'Disabled';

  return (
    <div className="space-y-4">
      <div>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>🔄 Reshuffle Patients among Vehicles</Typography>
        <Typography variant="body2" color="text.secondary">
          Change vehicle assignments for currently scheduled patients directly. Patient and vehicle zone-matching constraints will not be enforced here.
        </Typography>
      </div>

      {deceased.length > 0 && (
        <Alert severity="error">
          <strong>⚠️ Deceased Patient Warning</strong>: {deadNames} is marked as <strong>deceased</strong> in the database. Please unassign or remove them before saving reshuffled routes.
        </Alert>
      )}

      {draft.length === 0 ? (
        <Alert severity="info">No patients are currently assigned to any vehicle run for this date. Please assign them on the Planning Board first.</Alert>
      ) : (
        <>
          {draft.length > 0 && suggestions.length > 0 && (
            <Accordion defaultExpanded disableGutters>
              <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 600 }}>💡 Smart Reassignment Recommendations</Typography></AccordionSummary>
              <AccordionDetails className="space-y-3">
                <Typography variant="caption" color="text.secondary">
                  The system has detected that some patients lie near boundaries of other zones and would be physically closer to another vehicle&apos;s route stops.
                </Typography>
                {suggestions.map((sug, idx) => (
                  <div key={`${sug.patient_id}-${sug.suggested_vehicle_id}-${idx}`} className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <Typography variant="body2">
                      <strong>{sug.patient_name}</strong> (Current: <em>{sug.current_vehicle_name}</em> | Zone: <em>{sug.nearby_zone}</em> Boundary @ {Math.round(sug.boundary_distance_m)}m):
                      Transferring to <strong>{sug.suggested_vehicle_name}</strong> is recommended. Its nearest stop (<em>{sug.closest_cand_stop}</em>) is only <strong>{Number(sug.cand_min_distance_km).toFixed(1)} km</strong> away,
                      whereas their current vehicle&apos;s nearest stop is <strong>{Number(sug.curr_min_distance_km).toFixed(1)} km</strong> away.
                    </Typography>
                    <Button size="small" variant="outlined" disabled={isDisabled} sx={{ whiteSpace: 'nowrap' }}
                      onClick={() => { moveTo(sug.patient_id, sug.suggested_vehicle_id); onFlash(`Transferred ${sug.patient_name} to ${sug.suggested_vehicle_name}!`); }}>
                      Execute Transfer
                    </Button>
                  </div>
                ))}
              </AccordionDetails>
            </Accordion>
          )}

          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1000 }}>
              <TableHead>
                <TableRow>
                  {['Visit Type', 'Patient Name', 'UHID', 'Address', 'Patient Zone', 'Boundary Alert', 'Priority', 'Assigned Vehicle'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {draft.map(s => {
                  const p = patientsById.get(s.patient_id);
                  const vType = s.visit_type === 'bereavement' ? '🕊️ Bereavement' : (s.visit_type === 'initial' || s.type === 'new') ? '🆕 Initial' : '🟢 Follow-up';
                  return (
                    <TableRow key={s.patient_id} hover>
                      <TableCell>{vType}</TableCell>
                      <TableCell>{s.patient_name || p?.name}</TableCell>
                      <TableCell>{s.uhid || p?.uhid || 'N/A'}</TableCell>
                      <TableCell>{s.address || p?.address || 'N/A'}</TableCell>
                      <TableCell>{s.zone || p?.zone || 'N/A'}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{p?.boundary_alert || 'None'}</TableCell>
                      <TableCell>{s.priority}</TableCell>
                      <TableCell>
                        <Select size="small" value={vehiclesById[s.vehicle_id] ? s.vehicle_id : UNASSIGN} disabled={isDisabled}
                          onChange={e => moveTo(s.patient_id, e.target.value)} sx={{ minWidth: 180 }}>
                          <MenuItem value={UNASSIGN}>Unassign</MenuItem>
                          {vehicles.map(v => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Button variant="contained" onClick={onSave} disabled={isDisabled || saving}>
            💾 Save Reshuffle Changes{isDisabled ? ` (${disabledLabel})` : ''}
          </Button>
        </>
      )}
    </div>
  );
}
