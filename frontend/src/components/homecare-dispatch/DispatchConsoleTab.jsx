/**
 * Dispatch Console — execute a locked vehicle run: share route links, mark visits
 * Complete or Fail/Absent, swap failed or deceased stops, add extra visits, and
 * record the daily vehicle log once every stop is processed.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Paper, Select, TextField, Typography,
} from '@mui/material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';
import { countHomecareDays } from './draft';

const STATUS_LABELS = { pending: '⏳ Pending', active: '🚛 Active Run', completed: '✅ Completed', failed: '❌ Unavailable' };

function buildRouteUrls(vehicle, slots) {
  const stops = slots.filter(s => s.lat != null && s.lon != null).map(s => `${s.lat},${s.lon}`);
  if (!vehicle || !stops.length) return {};
  const origin = `${vehicle.depot_lat},${vehicle.depot_lon}`;
  const base = 'https://www.google.com/maps/dir/?api=1';
  const enc = encodeURIComponent;
  return {
    round_trip_url: `${base}&origin=${enc(origin)}&destination=${enc(origin)}&waypoints=${enc(stops.join('|'))}&travelmode=driving`,
    one_way_url: stops.length > 1
      ? `${base}&origin=${enc(origin)}&destination=${enc(stops[stops.length - 1])}&waypoints=${enc(stops.slice(0, -1).join('|'))}&travelmode=driving`
      : `${base}&origin=${enc(origin)}&destination=${enc(stops[0])}&travelmode=driving`,
  };
}

export function ShareRouteLinks({ vehicle, slots, stored }) {
  const links = stored?.round_trip_url ? stored : buildRouteUrls(vehicle, slots);
  if (!links.round_trip_url) return null;
  const rtShort = stored?.round_trip_short_url;
  const owShort = stored?.one_way_short_url;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Button fullWidth variant="outlined" href={rtShort || links.round_trip_url} target="_blank" rel="noreferrer" title="Starts and ends at base hospital">🗺️ Open Round Trip Route</Button>
        {rtShort && <Typography variant="caption" color="text.secondary">Short link: <code>{rtShort}</code></Typography>}
      </div>
      <div>
        <Button fullWidth variant="outlined" href={owShort || links.one_way_url} target="_blank" rel="noreferrer" title="Ends at the last patient visit">🏁 Open One-Way Route</Button>
        {owShort && <Typography variant="caption" color="text.secondary">Short link: <code>{owShort}</code></Typography>}
      </div>
    </div>
  );
}

function SwapSection({ dateStr, slot, isDisabled, onDone, onError }) {
  const [candidates, setCandidates] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    homecareDispatchApi.getReplacements(dateStr, slot.id)
      .then(list => { setCandidates(list); if (list.length) setChoice(list[0].id); })
      .catch(err => onError(`Error loading replacements: ${apiError(err)}`));
  }, [dateStr, slot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (c) => (c.visit_type === 'bereavement'
    ? `🕊️ [Bereavement] ${c.name} (DOD: ${c.date_of_death || 'N/A'}, Caregiver: ${c.primary_caregiver_phone || 'N/A'})`
    : `${c.name} (UHID: ${c.uhid}) [Priority: ${c.priority}, Gaps: ${c.gap} days, Urgency: ${Number(c.urgency_score).toFixed(2)}]`);

  const confirm = async () => {
    try {
      setBusy(true);
      const res = await homecareDispatchApi.swapPatient(dateStr, slot.id, choice);
      await onDone(res.message);
    } catch (err) {
      onError(`Error during swap: ${apiError(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Divider />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>🔄 Swap Replacement Patient</Typography>
      <Typography variant="caption" color="text.secondary">Replace this failed or unavailable patient with an eligible unassigned candidate to maintain capacity.</Typography>
      {candidates === null ? null : candidates.length === 0 ? (
        <Alert severity="info">No eligible unassigned patients in this vehicle&apos;s service zones.</Alert>
      ) : (
        <div className="flex flex-col md:flex-row gap-2">
          <Select size="small" fullWidth value={choice} onChange={e => setChoice(e.target.value)}>
            {candidates.map(c => <MenuItem key={c.id} value={c.id}>{label(c)}</MenuItem>)}
          </Select>
          <Button variant="outlined" disabled={isDisabled || busy || !choice} onClick={confirm} sx={{ whiteSpace: 'nowrap' }}>Confirm Swap</Button>
        </div>
      )}
    </div>
  );
}

function ExtraVisitSection({ dateStr, vehicleId, disabled, onDone, onError }) {
  const [candidates, setCandidates] = useState(null);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (disabled) return;
    homecareDispatchApi.getExtraCandidates(dateStr, vehicleId)
      .then(list => { setCandidates(list); setChoice(list[0]?.id || ''); })
      .catch(err => onError(`Error loading patients: ${apiError(err)}`));
  }, [dateStr, vehicleId, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    try {
      setBusy(true);
      const res = await homecareDispatchApi.addExtraVisit(dateStr, vehicleId, choice);
      await onDone(res.message);
    } catch (err) {
      onError(`Error adding patient to run: ${apiError(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper className="p-4 space-y-2">
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>➕ Add Extra Visit to Active Run</Typography>
      {disabled ? (
        <Alert severity="info">Adding extra visits is disabled for this run (schedule is completed, closed, or expired).</Alert>
      ) : candidates === null ? null : candidates.length === 0 ? (
        <Alert severity="info">No eligible unassigned patients available in this vehicle&apos;s service zones.</Alert>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary">Route an extra unassigned patient to this vehicle&apos;s run dynamically.</Typography>
          <div className="flex flex-col md:flex-row gap-2">
            <FormControl size="small" fullWidth>
              <InputLabel>Select Patient to Add</InputLabel>
              <Select label="Select Patient to Add" value={choice} onChange={e => setChoice(e.target.value)}>
                {candidates.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} (Zone: {c.zone} | Gaps: {c.gap} days | Urgency: {Number(c.urgency_score).toFixed(2)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" disabled={busy || !choice} onClick={add} sx={{ whiteSpace: 'nowrap' }}>Add Patient to Run</Button>
          </div>
        </>
      )}
    </Paper>
  );
}

function VehicleLogSection({ dateStr, vehicle, totalDist, existingLog, onDone, onError }) {
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existingLog) return;
    homecareDispatchApi.getLastOdometer(dateStr, vehicle.id).then(last => setForm({
      driver_name: '', opening_kms: last, closing_kms: Number((last + totalDist).toFixed(1)),
      start_point: vehicle.base_hospital || 'Depot', destination_point: vehicle.base_hospital || 'Depot', mileage: 10,
    })).catch(err => onError(`Error loading odometer: ${apiError(err)}`));
  }, [dateStr, vehicle.id, existingLog]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setFormError(null);
    if (!String(form.driver_name).trim()) { setFormError('Driver Name is required.'); return; }
    if (Number(form.closing_kms) < Number(form.opening_kms)) { setFormError('Closing Odometer must be greater than or equal to Opening Odometer.'); return; }
    try {
      setBusy(true);
      const res = await homecareDispatchApi.submitVehicleLog(dateStr, vehicle.id, form);
      await onDone(res.message);
    } catch (err) {
      onError(`Error submitting vehicle log: ${apiError(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper className="p-4 space-y-3">
      <Typography variant="h6" sx={{ fontWeight: 700 }}>📝 Daily Vehicle Log</Typography>
      <Typography variant="caption" color="text.secondary">All visits are processed. Please fill in the daily log metrics for this vehicle run.</Typography>
      {existingLog ? (
        <>
          <Alert severity="info">Daily vehicle log for this run has already been recorded.</Alert>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Driver Name', existingLog.driver_name],
              ['Odometer Range', `${Number(existingLog.opening_kms).toFixed(1)} - ${Number(existingLog.closing_kms).toFixed(1)} km`],
              ['Fuel Used', `${Number(existingLog.fuel_liters || 0).toFixed(1)} L`],
              ['Calculated Mileage', Number(existingLog.mileage || 0) > 0 ? `${Number(existingLog.mileage).toFixed(2)} km/L` : 'N/A']].map(([l, v]) => (
              <div key={l}><Typography variant="caption" color="text.secondary">{l}</Typography><Typography sx={{ fontWeight: 700 }}>{v}</Typography></div>
            ))}
          </div>
        </>
      ) : form && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField size="small" label="Driver Name *" placeholder="Enter driver's name" value={form.driver_name} onChange={set('driver_name')} />
            <TextField size="small" label="Start Point" value={form.start_point} onChange={set('start_point')} />
            <TextField size="small" type="number" label="Opening Odometer (km) *" value={form.opening_kms} onChange={set('opening_kms')} slotProps={{ htmlInput: { min: 0, step: 1 } }} />
            <TextField size="small" label="Destination Point" value={form.destination_point} onChange={set('destination_point')} />
            <TextField size="small" type="number" label="Closing Odometer (km) *" value={form.closing_kms} onChange={set('closing_kms')} slotProps={{ htmlInput: { min: form.opening_kms, step: 1 } }} />
            <TextField size="small" type="number" label="Mileage (km/L) *" value={form.mileage} onChange={set('mileage')} helperText="Average mileage of the vehicle run." slotProps={{ htmlInput: { min: 0, step: 0.5 } }} />
          </div>
          {formError && <Alert severity="error">{formError}</Alert>}
          <Button fullWidth variant="contained" disabled={busy} onClick={submit}>Submit Vehicle Log</Button>
        </>
      )}
    </Paper>
  );
}

export default function DispatchConsoleTab({ dateStr, schedule, candidates, isDisabled, onFlash, onError, reload }) {
  const runVehicles = useMemo(
    () => schedule.vehicles.filter(v => schedule.slots.some(s => s.vehicle_id === v.id)),
    [schedule],
  );
  const [vehicleId, setVehicleId] = useState(runVehicles[0]?.id || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (runVehicles.length && !runVehicles.some(v => v.id === vehicleId)) setVehicleId(runVehicles[0].id);
  }, [runVehicles, vehicleId]);

  const vehicle = runVehicles.find(v => v.id === vehicleId);
  const vSlots = schedule.slots.filter(s => s.vehicle_id === vehicleId).sort((a, b) => a.slot_order - b.slot_order);
  const existingLog = schedule.vehicle_logs[vehicleId];
  const totalDist = vSlots.reduce((t, s) => t + (s.drive_distance_km || 0), 0);
  const totalDur = vSlots.reduce((t, s) => t + (s.drive_duration_min || 0), 0);
  const allProcessed = vSlots.length > 0 && vSlots.every(s => s.status === 'completed' || s.status === 'failed');
  const candidatesById = useMemo(() => new Map(candidates.patients.map(p => [String(p.id), p])), [candidates]);

  const done = async (msg, kind = 'success') => { onFlash(msg, kind); await reload(); };

  const setStatus = async (slot, status) => {
    try {
      setBusy(true);
      const res = await homecareDispatchApi.setVisitStatus(dateStr, slot.id, status);
      await done(res.message, status === 'failed' ? 'warning' : 'success');
    } catch (err) {
      onError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Paper className="p-4 space-y-3">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Live Dispatch Controller</Typography>
        <Typography variant="caption" color="text.secondary">Execute itineraries, log completions, and manage patient replacements in real time.</Typography>
        {runVehicles.length === 0 ? (
          <Alert severity="info">No active vehicle runs available for dispatch.</Alert>
        ) : (
          <FormControl size="small" fullWidth>
            <InputLabel>Select Vehicle Run to Execute</InputLabel>
            <Select label="Select Vehicle Run to Execute" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              {runVehicles.map(v => <MenuItem key={v.id} value={v.id}>{v.name} ({v.registration_number || 'No Reg'})</MenuItem>)}
            </Select>
          </FormControl>
        )}
      </Paper>

      {vehicle && (
        <>
          <Paper className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[['Vehicle', vehicle.name], ['Total Route Distance', `${totalDist.toFixed(2)} km`], ['Est. Driving Time', `${totalDur.toFixed(1)} mins`]].map(([l, v]) => (
                <div key={l}><Typography variant="caption" color="text.secondary">{l}</Typography><Typography variant="h6" sx={{ fontWeight: 700 }}>{v}</Typography></div>
              ))}
            </div>
            <Divider />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>🔗 Share Route Map (Google Maps):</Typography>
            <ShareRouteLinks vehicle={vehicle} slots={vSlots} stored={schedule.routes[vehicleId]} />
          </Paper>

          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Stop Itinerary</Typography>
          {vSlots.map(s => {
            const isBereav = s.visit_type === 'bereavement';
            const processed = s.status === 'completed' || s.status === 'failed';
            const actionDisabled = processed || schedule.is_past_date || schedule.has_vehicle_log || busy;
            const prev = candidatesById.get(s.patient_id)?.latest_earlier_booking;
            const contacts = [s.alternative_phone && `Alt: ${s.alternative_phone}`, s.primary_caregiver_phone && `Caregiver: ${s.primary_caregiver_phone}`,
              s.decision_maker_phone && `Decision Maker: ${s.decision_maker_phone}`].filter(Boolean);
            const needsSwap = s.status === 'failed' || (s.is_deceased && !isBereav);
            return (
              <Paper key={s.id} className="p-4 space-y-2">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    {isBereav ? (
                      <>
                        <Typography sx={{ fontWeight: 700 }}>Stop #{s.slot_order}: 🕊️ {s.patient_name} (Bereavement Visit | UHID: {s.uhid})</Typography>
                        <Alert severity="info" sx={{ py: 0 }}>🕊️ <strong>Bereavement Support Visit</strong>{s.date_of_death ? ` — Passed away: ${s.date_of_death}` : ''}. Family &amp; caregiver contact details:</Alert>
                      </>
                    ) : (
                      <>
                        <Typography sx={{ fontWeight: 700 }}>
                          Stop #{s.slot_order}: {s.patient_name} ({s.patient_type_at_visit === 'new' ? '🆕 Initial' : '🟢 Follow-up'} | UHID: {s.uhid} | 📞 {s.phone || 'N/A'})
                        </Typography>
                        {s.is_deceased && (
                          <Alert severity="error" sx={{ py: 0 }}>
                            🚨 <strong>Patient Marked Deceased</strong>: <strong>{s.patient_name}</strong> is marked as deceased in the database! Please swap this patient with an eligible replacement below or mark their visit as Failed/Absent.
                          </Alert>
                        )}
                      </>
                    )}
                    {contacts.length > 0 && <Typography variant="caption" sx={{ display: 'block' }}>📞 {contacts.join(' | ')}</Typography>}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Zone: {s.zone} | Address: {s.address || 'N/A'}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Urgency score: {s.urgency_score_at_visit} | Gaps: {s.gap_days_at_visit} days</Typography>
                    {s.drive_distance_km != null && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        🛣️ +{s.drive_distance_km.toFixed(2)} km (+{Number(s.drive_duration_min || 0).toFixed(1)} mins) from previous stop
                      </Typography>
                    )}
                    {prev && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'warning.dark' }}>
                        ⚠️ <strong>Timeline Note</strong>: Patient was also scheduled earlier on {new Date(`${prev}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. Gap since earlier visit is {countHomecareDays(prev, dateStr, schedule.config.homecare_weekdays)} days (SLA: {s.sla_days_at_visit || schedule.config.sla_days?.[s.priority_at_visit || 'Medium'] || 4} days).
                      </Typography>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <Chip label={STATUS_LABELS[s.status] || s.status} variant="outlined" />
                    <Button variant="contained" size="small" disabled={actionDisabled} onClick={() => setStatus(s, 'completed')}>✓ Complete</Button>
                    <Button variant="outlined" size="small" disabled={actionDisabled} onClick={() => setStatus(s, 'failed')}>✕ Fail/Absent</Button>
                  </div>
                </div>
                {needsSwap && !existingLog && (
                  <SwapSection dateStr={dateStr} slot={s} isDisabled={isDisabled} onDone={done} onError={onError} />
                )}
                {s.status === 'failed' && existingLog && (
                  <>
                    <Divider />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>🔄 Swap Replacement Patient</Typography>
                    <Alert severity="info">Swapping is disabled for this completed/closed run.</Alert>
                  </>
                )}
              </Paper>
            );
          })}

          <ExtraVisitSection dateStr={dateStr} vehicleId={vehicleId} disabled={!!existingLog || isDisabled} onDone={done} onError={onError} />

          {allProcessed && (
            <VehicleLogSection dateStr={dateStr} vehicle={vehicle} totalDist={totalDist} existingLog={existingLog} onDone={done} onError={onError} />
          )}
        </>
      )}
    </div>
  );
}
