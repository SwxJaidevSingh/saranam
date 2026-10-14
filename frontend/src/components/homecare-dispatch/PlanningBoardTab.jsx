/**
 * Planning Board — pick a vehicle, then check patients to assign them.
 *
 * Alive view: patients in the vehicle's zones who are due (urgency > 0) and not on
 * another vehicle today, most urgent first. Deceased view: families for bereavement
 * visits, not-yet-visited first by date of death.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Radio, RadioGroup,
  Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';
import {
  aliveAssignment, aliveCandidatesForVehicle, bereavementAssignment, deceasedCandidatesForVehicle,
  enrichAssignments, haversineKm, replaceVehicleStops,
} from './draft';
import DraftRouteMap from './DraftRouteMap';

const visitBadge = (s) => (s.visit_type === 'bereavement' ? '🕊️ Bereavement'
  : (s.visit_type === 'initial' || s.type === 'new') ? '🆕 Initial' : '🟢 Follow-up');

function CheckTable({ columns, rows, checked, onToggle, disabled }) {
  return (
    <TableContainer sx={{ maxHeight: 460, overflowX: 'auto' }}>
      <Table size="small" stickyHeader sx={{ minWidth: 1400 }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ fontWeight: 600 }}>Assign</TableCell>
            {columns.map(([, label]) => <TableCell key={label} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id} hover selected={checked.has(String(r.id))}>
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={checked.has(String(r.id))} disabled={disabled} onChange={() => onToggle(String(r.id))} />
              </TableCell>
              {columns.map(([get, label]) => <TableCell key={label} sx={{ whiteSpace: 'nowrap' }}>{get(r)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const ALIVE_COLUMNS = [
  [p => p.name, 'Name'], [p => p.uhid || 'N/A', 'UHID'], [p => p.hospital_uhid || 'N/A', 'Hospital UHID'],
  [p => p.phone || 'N/A', 'Phone Number'], [p => p.alternative_phone || 'N/A', 'Alternative Phone'],
  [p => p.primary_caregiver_phone || 'N/A', 'Caregiver Phone'], [p => p.decision_maker_phone || 'N/A', 'Decision Maker Phone'],
  [p => p.address || 'N/A', 'Address'], [p => p.zone || '', 'Zone'], [p => p.boundary_alert, 'Boundary Alert'],
  [p => p.priority, 'Priority'], [p => p.gap_days, 'Gaps (Days)'], [p => Number(p.urgency_score || 0).toFixed(2), 'Urgency Score'],
  [p => (p.type === 'new' ? 'New' : 'Existing'), 'Type'], [p => p.timeline_note, 'Timeline Notes'],
];
const DECEASED_COLUMNS = [
  [p => p.bereavement_status, 'Bereavement Status'], [p => p.name, 'Name'], [p => p.uhid || 'N/A', 'UHID'],
  [p => p.hospital_uhid || 'N/A', 'Hospital UHID'], [p => p.date_of_death || 'N/A', 'Date of Death'],
  [p => (p.days_since_death ?? 'N/A'), 'Days Since Death'], [p => p.primary_caregiver_phone || 'N/A', 'Caregiver Phone'],
  [p => p.decision_maker_phone || 'N/A', 'Decision Maker Phone'], [p => p.address || 'N/A', 'Address'],
  [p => p.zone || '', 'Zone'], [p => p.boundary_alert, 'Boundary Alert'],
];

export default function PlanningBoardTab({
  dateStr, schedule, candidates, draft, setDraft, deceased, isDisabled, saving, onSave, onDeleteDraft, onError,
}) {
  const vehicles = schedule.vehicles;
  const config = schedule.config;
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [view, setView] = useState('alive');
  const [autoDrafting, setAutoDrafting] = useState(false);

  useEffect(() => {
    if (vehicles.length && !vehicles.some(v => v.id === vehicleId)) setVehicleId(vehicles[0].id);
  }, [vehicles, vehicleId]);

  const vehicle = vehicles.find(v => v.id === vehicleId);
  const patientsById = useMemo(() => {
    const m = new Map();
    candidates.patients.forEach(p => m.set(String(p.id), p));
    candidates.deceased_patients.forEach(p => { if (!m.has(String(p.id))) m.set(String(p.id), p); });
    return m;
  }, [candidates]);

  const vehicleStops = useMemo(
    () => draft.filter(s => s.vehicle_id === vehicleId).sort((a, b) => (a.slot_order || 0) - (b.slot_order || 0)),
    [draft, vehicleId],
  );
  const aliveRows = useMemo(() => aliveCandidatesForVehicle(candidates.patients, vehicle, draft), [candidates, vehicle, draft]);
  const deceasedRows = useMemo(() => deceasedCandidatesForVehicle(candidates.deceased_patients, vehicle, draft), [candidates, vehicle, draft]);
  const aliveChecked = new Set(vehicleStops.filter(s => s.visit_type !== 'bereavement').map(s => s.patient_id));
  const bereavChecked = new Set(vehicleStops.filter(s => s.visit_type === 'bereavement').map(s => s.patient_id));

  // Rebuild this vehicle's alive stops in table (urgency) order; stops no longer in the table stay last.
  const setAlive = (ids) => {
    const rowIds = new Set(aliveRows.map(p => String(p.id)));
    const ordered = aliveRows.filter(p => ids.has(String(p.id))).map(p => aliveAssignment(p, vehicleId, config));
    const stale = vehicleStops.filter(s => s.visit_type !== 'bereavement' && !rowIds.has(s.patient_id) && ids.has(s.patient_id));
    setDraft(replaceVehicleStops(draft, vehicleId, 'alive', [...ordered, ...stale]));
  };
  const setBereavement = (ids) => {
    setDraft(replaceVehicleStops(draft, vehicleId, 'bereavement',
      deceasedRows.filter(p => ids.has(String(p.id))).map(p => bereavementAssignment(p, vehicleId, config))));
  };
  const toggle = (set, apply) => (id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    apply(next);
  };
  const removeFromDraft = (patientId) => {
    const others = draft.filter(s => s.vehicle_id !== vehicleId);
    const run = vehicleStops.filter(s => s.patient_id !== patientId).map((s, i) => ({ ...s, slot_order: i + 1 }));
    setDraft([...others, ...run]);
  };

  const handleAutoDraft = async () => {
    try {
      setAutoDrafting(true);
      setDraft(enrichAssignments(await homecareDispatchApi.autoDraft(dateStr, draft), patientsById));
    } catch (err) {
      onError(`Auto-draft failed: ${apiError(err)}`);
    } finally {
      setAutoDrafting(false);
    }
  };

  const summary = useMemo(() => {
    if (!vehicle) return { rows: [], total: 0 };
    let prevLat = Number(vehicle.depot_lat);
    let prevLon = Number(vehicle.depot_lon);
    let total = 0;
    const rows = vehicleStops.map((s, idx) => {
      let leg = 0;
      if (s.lat != null && s.lon != null) {
        leg = haversineKm(prevLat, prevLon, s.lat, s.lon);
        prevLat = Number(s.lat);
        prevLon = Number(s.lon);
      }
      total += leg;
      return { ...s, stop: idx + 1, leg };
    });
    return { rows, total };
  }, [vehicle, vehicleStops]);

  const timelineNotes = vehicleStops
    .map(s => ({ s, p: patientsById.get(s.patient_id) }))
    .filter(({ p }) => p?.latest_earlier_booking)
    .map(({ s, p }) => {
      const day = new Date(`${p.latest_earlier_booking}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' });
      return { id: s.patient_id, name: s.patient_name || p.name, day, gap: s.gap ?? 0, sla: config.sla_days?.[s.priority || 'Medium'] ?? 4 };
    });

  const deadHere = deceased.filter(d => vehicleStops.some(s => s.patient_id === d.id && s.visit_type !== 'bereavement'));

  const disabledLabel = schedule.has_vehicle_log ? 'Completed - Vehicle Log Recorded'
    : schedule.draft.is_date_surpassed_expired ? 'Closed - Schedule Date Surpassed'
      : schedule.is_past_date ? 'Closed - Past Date'
        : schedule.draft.is_draft_expired ? 'Draft Expired - Purged' : 'Disabled';

  if (!vehicle) return <Alert severity="info">No active vehicles. Register a vehicle in the Vehicles Module first.</Alert>;

  return (
    <div className="space-y-4">
      <div>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Draft Route Planning</Typography>
        <Typography variant="body2" color="text.secondary">
          Select a vehicle to configure, check/uncheck patients in the Master List to assign them, then click &apos;Save Schedule Changes&apos;.
        </Typography>
      </div>

      <Paper className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Select Vehicle to Configure</InputLabel>
          <Select value={vehicleId} label="Select Vehicle to Configure" onChange={e => setVehicleId(e.target.value)}>
            {vehicles.map(v => <MenuItem key={v.id} value={v.id}>{v.name} ({v.registration_number || 'No Reg'})</MenuItem>)}
          </Select>
        </FormControl>
        <div className="text-right">
          <Typography variant="caption" color="text.secondary">Homecare Capacity Per Vehicle</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{vehicleStops.length} / {vehicle.capacity} patients</Typography>
        </div>
      </Paper>

      {deadHere.map(d => (
        <Alert key={d.id} severity="error" action={(
          <Button color="inherit" size="small" variant="outlined" onClick={() => removeFromDraft(d.id)}>🗑️ Remove from Draft</Button>
        )}>
          <strong>🚨 Patient Marked Deceased in Draft</strong>: <strong>{d.name}</strong> (UHID: {d.uhid || 'N/A'}) is marked as deceased and must be removed from this vehicle run.
        </Alert>
      ))}

      <RadioGroup row value={view} onChange={e => setView(e.target.value)}>
        <Typography variant="body2" sx={{ mr: 2, alignSelf: 'center', fontWeight: 600 }}>Candidate Directory View:</Typography>
        <FormControlLabel value="alive" control={<Radio size="small" />} label="Alive Patients (Initial / Follow-up Visits)" />
        <FormControlLabel value="deceased" control={<Radio size="small" />} label="Deceased Patients (Bereavement Visits)" />
      </RadioGroup>

      <Paper className="p-4 space-y-3">
        {view === 'alive' ? (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>📋 Master Patient Directory (Alive Patients)</Typography>
            <Typography variant="caption" color="text.secondary">
              Check or uncheck boxes to manage assignments for this vehicle. Both living and bereavement visits can be scheduled concurrently on the same vehicle run.
            </Typography>
            {aliveRows.length === 0 ? (
              <Alert severity="info">No unassigned alive patients available for this vehicle.</Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button size="small" variant="outlined" disabled={isDisabled} onClick={() => setAlive(new Set(aliveRows.map(p => String(p.id))))}>☑️ Select All</Button>
                  <Button size="small" variant="outlined" disabled={isDisabled} onClick={() => setAlive(new Set())}>☐ Clear All</Button>
                  <Button size="small" variant="contained" disabled={isDisabled || autoDrafting} onClick={handleAutoDraft}
                    title="Automatically draft vehicle assignments for high-urgency patients based on zones">
                    {autoDrafting ? 'Drafting…' : '✨ Auto-Draft Suggestions'}
                  </Button>
                </div>
                <CheckTable columns={ALIVE_COLUMNS} rows={aliveRows} checked={aliveChecked} disabled={isDisabled} onToggle={toggle(aliveChecked, setAlive)} />
              </>
            )}
          </>
        ) : (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>🕊️ Deceased Patient Directory (Bereavement Visits)</Typography>
            <Typography variant="caption" color="text.secondary">
              Schedule bereavement visits to support families of deceased patients. Unvisited patients are prioritized at the top sorted by earliest death date. Visited patients appear at the bottom.
            </Typography>
            {deceasedRows.length === 0 ? (
              <Alert severity="info">No deceased patients available in this vehicle&apos;s service zones.</Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button size="small" variant="outlined" disabled={isDisabled} onClick={() => setBereavement(new Set(deceasedRows.map(p => String(p.id))))}>☑️ Select All Deceased</Button>
                  <Button size="small" variant="outlined" disabled={isDisabled} onClick={() => setBereavement(new Set())}>☐ Clear All Deceased</Button>
                </div>
                <CheckTable columns={DECEASED_COLUMNS} rows={deceasedRows} checked={bereavChecked} disabled={isDisabled} onToggle={toggle(bereavChecked, setBereavement)} />
              </>
            )}
          </>
        )}
      </Paper>

      <Paper className="p-4 space-y-2">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>🗺️ Draft Route Map</Typography>
        <Typography variant="caption" color="text.secondary">
          ⚠️ <strong>Disclaimer:</strong> The draft map and summaries below use straight-line (geodesic) distances, which differ from actual road-based driving distances. Actual road-routing is optimized dynamically when finalize/lock schedule is executed.
        </Typography>
        <DraftRouteMap vehicle={vehicle} stops={vehicleStops} />
      </Paper>

      <Paper className="p-4 space-y-3">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>🎯 Run Summary: {vehicle.name}</Typography>
        {vehicleStops.length === 0 ? (
          <Alert severity="info">No patients assigned to this vehicle run.</Alert>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary"><strong>{vehicleStops.length} Patient(s) Selected</strong></Typography>
            <div>
              <Typography variant="caption" color="text.secondary">Total Est. Straight-Line Distance</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{summary.total.toFixed(2)} km</Typography>
            </div>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Stop', 'Visit Type', 'Name', 'Address', 'Zone', 'Priority', 'Distance from Prev (Straight Line)'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.rows.map(s => (
                    <TableRow key={s.patient_id}>
                      <TableCell>{s.stop}</TableCell>
                      <TableCell>{visitBadge(s)}</TableCell>
                      <TableCell>{s.patient_name}</TableCell>
                      <TableCell>{s.address || 'N/A'}</TableCell>
                      <TableCell>{s.zone || ''}</TableCell>
                      <TableCell>{s.priority}</TableCell>
                      <TableCell>{s.leg.toFixed(2)} km</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {timelineNotes.map(n => (
              <Alert key={n.id} severity="info">
                <strong>Timeline Note:</strong> <strong>{n.name}</strong> was also scheduled earlier on <strong>{n.day}</strong> (Gap: {n.gap} day(s), SLA: {n.sla} days). You can still schedule them, or you can choose another patient who is overdue or on highest priority.
              </Alert>
            ))}
          </>
        )}
        {vehicleStops.length > vehicle.capacity && (
          <Alert severity="warning">⚠️ Assigned count ({vehicleStops.length}) exceeds vehicle capacity ({vehicle.capacity})!</Alert>
        )}
      </Paper>

      {isDisabled ? (
        <Button fullWidth variant="contained" disabled>💾 Save Schedule Changes ({disabledLabel})</Button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <Button className="col-span-3" variant="contained" onClick={onSave} disabled={saving}>💾 Save Schedule Changes</Button>
          {schedule.slots.length > 0 ? (
            <Button variant="outlined" color="error" onClick={onDeleteDraft}
              title="Delete this draft schedule from the database and release all patients">🗑️ Discard Draft</Button>
          ) : (
            <Button variant="outlined" onClick={() => setDraft([])} title="Reset all selected patient checkboxes to empty">🔄 Reset Selections</Button>
          )}
        </div>
      )}
    </div>
  );
}
