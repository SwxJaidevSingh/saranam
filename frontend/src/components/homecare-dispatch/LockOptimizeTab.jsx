/**
 * Lock & Optimize — locks the SAVED schedule and sequences each vehicle's stops
 * (Google Routes API, then Distance Matrix + nearest neighbour, then straight line).
 */
import React, { useState } from 'react';
import {
  Alert, Button, FormControlLabel, Checkbox, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography,
} from '@mui/material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';
import { hasUnsavedChanges } from './draft';

const METHOD_TEXT = {
  routes_api: (n) => `Successfully optimized route for ${n} using Google Routes API!`,
  distance_matrix: (n) => `Successfully fetched road distances from Google Maps for ${n}!`,
  haversine: (n) => `No Google Maps road data for ${n}; sequenced by straight-line (Haversine) distance.`,
};

export default function LockOptimizeTab({
  dateStr, schedule, draft, deceased, isDisabled, saving, onSave, onFlash, onError, reload,
}) {
  const [roundTrip, setRoundTrip] = useState(true);
  const [locking, setLocking] = useState(false);
  const [abnormal, setAbnormal] = useState(null);
  const savedSlots = schedule.slots;
  const vehicles = schedule.vehicles;

  if (isDisabled) {
    if (schedule.has_vehicle_log) return <Alert severity="info">ℹ️ This schedule date is completed (vehicle log recorded) and cannot be modified.</Alert>;
    if (schedule.draft.is_date_surpassed_expired) return <Alert severity="error">⏱️ This schedule date has passed without being locked. The draft has expired and reservations have been released.</Alert>;
    if (schedule.is_past_date) return <Alert severity="info">ℹ️ This schedule date has passed and cannot be locked or modified.</Alert>;
    return <Alert severity="error">⏱️ This draft reservation has expired. Please re-assign patients on the Planning Board before locking.</Alert>;
  }

  const unsaved = hasUnsavedChanges(draft, savedSlots);

  if (!savedSlots.length) {
    return unsaved ? (
      <Alert severity="warning" action={<Button color="inherit" size="small" variant="outlined" disabled={saving} onClick={onSave}>💾 Save Schedule Changes to Database Now</Button>}>
        <strong>⚠️ Unsaved Changes Detected</strong>: You have selected patient assignments on the Planning Board, but have not saved them to the database yet. Locking requires saving these assignments first.
      </Alert>
    ) : (
      <Alert severity="info">Ensure you select patients in the Planning Board and click Save Schedule Changes before locking.</Alert>
    );
  }

  const doLock = async () => {
    try {
      setLocking(true);
      setAbnormal(null);
      const res = await homecareDispatchApi.lockSchedule(dateStr, roundTrip);
      const names = Object.fromEntries(vehicles.map(v => [v.id, v.name]));
      const details = Object.entries(res.methods || {}).map(([vid, m]) => (METHOD_TEXT[m] || (() => m))(names[vid] || 'Vehicle'));
      onFlash([res.message, ...details].join(' '));
      await reload();
    } catch (err) {
      onError(`Error locking schedule: ${apiError(err)}`);
    } finally {
      setLocking(false);
    }
  };

  const startLock = async () => {
    try {
      setLocking(true);
      const list = await homecareDispatchApi.checkAbnormal(dateStr);
      if (list.length) { setAbnormal(list); setLocking(false); return; }
      await doLock();
    } catch (err) {
      onError(`Error locking schedule: ${apiError(err)}`);
      setLocking(false);
    }
  };

  if (abnormal) {
    return (
      <Paper className="p-4 space-y-3">
        <Typography variant="h6" color="error" sx={{ fontWeight: 700 }}>⚠️ Abnormality Flagged: High-Distance Patients Detected</Typography>
        <Typography variant="body2">
          The following patient(s) are located <strong>more than 40 km</strong> away from their assigned vehicle&apos;s base depot. Please verify if their coordinates or assigned vehicle/zone is correct.
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>{['Vehicle', 'Patient Name', 'UHID', 'Hospital UHID', 'Distance'].map(h => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {abnormal.map(a => (
                <TableRow key={a.patient_id}>
                  <TableCell>{a.vehicle_name}</TableCell><TableCell>{a.patient_name}</TableCell><TableCell>{a.uhid}</TableCell>
                  <TableCell>{a.hospital_uhid}</TableCell><TableCell>{a.distance_km} km</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="contained" color="warning" disabled={locking} onClick={doLock}>⚠️ Ignore Warning & Lock Anyway</Button>
          <Button variant="outlined" onClick={() => setAbnormal(null)}>❌ Cancel & Edit Assignments</Button>
        </div>
      </Paper>
    );
  }

  const inspect = unsaved && draft.length ? draft : savedSlots;
  const missing = inspect.filter(s => s.lat == null || s.lon == null);
  const deadNames = deceased.map(d => `${d.name} (UHID: ${d.uhid || 'N/A'})`).join(', ');

  return (
    <div className="space-y-4">
      <div>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Lock Itinerary & Route Optimization</Typography>
        <Typography variant="body2" color="text.secondary">Lock assignments and run distance-based route optimization using Google Maps API.</Typography>
      </div>

      {unsaved && (
        <Alert severity="warning" action={<Button color="inherit" size="small" variant="outlined" disabled={saving} onClick={onSave}>💾 Save Latest Changes to Database Now</Button>}>
          <strong>⚠️ Unsaved Changes Detected</strong>: You have modifications on the <strong>Planning Board</strong> or <strong>Reshuffle</strong> tab that differ from what is currently saved in the database. Locking now will only optimize the <strong>previously saved</strong> database schedule. To include your latest patient selections or reshuffle changes, please save them to the database first.
        </Alert>
      )}
      {deceased.length > 0 && (
        <Alert severity="warning"><strong>⚠️ Deceased Patient Notice</strong>: Patient {deadNames} is marked as deceased in the database. Please review before locking.</Alert>
      )}
      {missing.length > 0 && (
        <Alert severity="warning">
          <strong>⚠️ Missing GPS Coordinates</strong>: Patient(s) {missing.map(s => `${s.patient_name || 'Unknown'} (UHID: ${s.uhid || 'N/A'})`).join(', ')} do not have valid GPS coordinates. Routing optimization will default their location to the vehicle depot. Please update their address or coordinates in Patient Management if possible.
        </Alert>
      )}

      {vehicles.map(v => {
        const vSlots = savedSlots.filter(s => s.vehicle_id === v.id).sort((a, b) => (a.slot_order || 0) - (b.slot_order || 0));
        return (
          <Paper key={v.id} className="p-4 space-y-2">
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>🚛 {v.name} (Selected: <strong>{vSlots.length}</strong> Patient(s))</Typography>
            {vSlots.length > v.capacity && (
              <Alert severity="warning">
                <strong>⚠️ Capacity Notice</strong>: Assigned patient count ({vSlots.length}) exceeds vehicle capacity ({v.capacity}). Emergency overcapacity is permitted, but please verify patient load before locking.
              </Alert>
            )}
            {vSlots.length === 0 ? (
              <Alert severity="info">No assignments selected for this vehicle.</Alert>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>{['Stop', 'Patient Name', 'UHID', 'Address', 'Zone', 'Priority'].map(h => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {vSlots.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell>#{i + 1}</TableCell><TableCell>{s.patient_name}</TableCell><TableCell>{s.uhid || 'N/A'}</TableCell>
                        <TableCell>{s.address || 'N/A'}</TableCell><TableCell>{s.zone || 'N/A'}</TableCell><TableCell>{s.priority_at_visit || 'Medium'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        );
      })}

      <FormControlLabel
        control={<Checkbox checked={roundTrip} onChange={e => setRoundTrip(e.target.checked)} />}
        label="Optimize as Round Trip (Return to Depot at end)"
        title="If checked, Google will optimize the route to start and end at the Depot. If unchecked, the route ends at the furthest patient stop."
      />
      <Alert severity="warning">⚠️ Locking a schedule will freeze planning and optimize route sequences. This cannot be undone.</Alert>
      <Button fullWidth variant="contained" size="large" disabled={locking} onClick={startLock}>
        {locking ? 'Optimizing schedules and route paths…' : '🔐 Lock Route & Optimize'}
      </Button>
    </div>
  );
}
