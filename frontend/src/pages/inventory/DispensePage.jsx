/**
 * Dispense — build a list of medications for a patient, then dispense them together in
 * one transaction (nothing is dispensed if any line can't be filled). Safety checks:
 * non-formulary and allergy alerts, which must be acknowledged before dispensing.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider, FormControl, FormControlLabel, InputLabel, MenuItem,
  Paper, Select, TextField, Typography,
} from '@mui/material';
import inventoryApi, { apiError } from '../../api/inventory';
import { DataTable, Md, PageHeader } from '../../components/inventory/shared';

const bucketKey = (b) => `${b.stock_id}|${b.source}|${b.partner_org_id || ''}`;
const emptyLine = { quantity: 1, dosage: '', route: 'Oral', notes: '' };

export default function DispensePage() {
  const [params] = useSearchParams();
  const [patients, setPatients] = useState(null);
  const [patientId, setPatientId] = useState('');
  const [ctx, setCtx] = useState(null);
  const [carts, setCarts] = useState({});
  const [rev, setRev] = useState(0);
  const [ack, setAck] = useState(false);
  const [selKey, setSelKey] = useState('');
  const [line, setLine] = useState(emptyLine);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inventoryApi.getDispensePatients().then(r => {
      setPatients(r.patients);
      const wanted = params.get('patient_id');
      setPatientId(r.patients.some(p => String(p.id) === wanted) ? wanted : (r.patients[0]?.id || ''));
    }).catch(err => setError(apiError(err)));
  }, [params]);

  const loadCtx = useCallback(async (pid) => {
    if (!pid) return;
    try {
      setCtx(await inventoryApi.getDispenseContext(pid));
    } catch (err) {
      setError(apiError(err));
    }
  }, []);
  useEffect(() => { loadCtx(patientId); }, [patientId, loadCtx]);

  // Any change to a list resets its acknowledgment checkbox.
  const bump = () => { setRev(r => r + 1); setAck(false); };
  const cart = useMemo(() => carts[patientId] || [], [carts, patientId]);
  const setCart = (next) => { setCarts(c => ({ ...c, [patientId]: next })); bump(); };

  const buckets = ctx?.buckets || [];
  const selected = buckets.find(b => bucketKey(b) === selKey) || buckets[0];
  const inList = useMemo(() => (selected ? cart.filter(l => bucketKey(l) === bucketKey(selected))
    .reduce((t, l) => t + l.quantity, 0) : 0), [cart, selected]);
  const remaining = selected ? selected.available - inList : 0;

  if (error && !patients) return <Box className="p-6"><Alert severity="error">{error}</Alert></Box>;
  if (!patients || (patientId && !ctx)) return <Box className="flex justify-center p-10"><CircularProgress /></Box>;

  const header = (
    <>
      <PageHeader title="💉 Dispense Medication" />
      {flash && <Alert severity="success" onClose={() => setFlash(null)}>{flash}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
    </>
  );
  if (!patients.length) return <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">{header}<Alert severity="warning">No active Saranam patients found in the EHR.</Alert></Box>;
  if (!buckets.length) return <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">{header}<Alert severity="warning">No stock available to dispense.</Alert></Box>;

  const patient = ctx.patient;
  const addToList = () => {
    const qty = Number(line.quantity);
    if (!(qty >= 1 && qty <= remaining)) { setError(`Quantity to dispense must be between 1 and ${remaining}.`); return; }
    setCart([...cart, { ...selected, quantity: qty, dosage: line.dosage, route: line.route, notes: line.notes }]);
    setLine(emptyLine);
  };

  const flagged = cart.filter(l => l.alerts.length).map(l => l.medicine_name);

  const dispense = async () => {
    if (flagged.length && !ack) { setError('You must acknowledge the alerts before dispensing.'); return; }
    try {
      setBusy(true);
      setError(null);
      const res = await inventoryApi.dispense(patientId, cart.map(l => ({
        stock_id: l.stock_id, source: l.source, partner_org_id: l.partner_org_id,
        quantity: l.quantity, dosage: l.dosage, route: l.route, notes: l.notes,
      })), !!flagged.length && ack);
      setFlash(res.message);
      setCarts(c => { const n = { ...c }; delete n[patientId]; return n; });
      bump();
      await loadCtx(patientId);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      {header}
      <FormControl size="small" fullWidth>
        <InputLabel>Select Patient</InputLabel>
        <Select label="Select Patient" value={patientId} onChange={e => { setPatientId(e.target.value); setSelKey(''); setAck(false); }}>
          {patients.map(p => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
        </Select>
      </FormControl>
      {patient.allergies && <Alert severity="info"><Md>{`⚠️ Known allergies: **${patient.allergies}**`}</Md></Alert>}

      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Add Medication</Typography>
      <FormControl size="small" fullWidth>
        <InputLabel>Select Medication (from available stock)</InputLabel>
        <Select label="Select Medication (from available stock)" value={bucketKey(selected)} onChange={e => setSelKey(e.target.value)}>
          {buckets.map(b => <MenuItem key={bucketKey(b)} value={bucketKey(b)}>{b.label}</MenuItem>)}
        </Select>
      </FormControl>
      {selected.alerts.map(a => <Alert key={a} severity="warning"><Md>{a}</Md></Alert>)}
      {inList > 0 && (
        <Typography variant="caption" color="text.secondary">
          {inList} unit(s) of this stock already in the list — {Math.max(remaining, 0)} more can be added.
        </Typography>
      )}
      {remaining <= 0 ? (
        <Alert severity="info">All available units of this stock are already in the list.</Alert>
      ) : (
        <Paper className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField size="small" type="number" label="Quantity to dispense" value={line.quantity}
              onChange={e => setLine(l => ({ ...l, quantity: e.target.value }))} slotProps={{ htmlInput: { min: 1, max: remaining } }} />
            <FormControl size="small">
              <InputLabel>Route</InputLabel>
              <Select label="Route" value={line.route} onChange={e => setLine(l => ({ ...l, route: e.target.value }))}>
                {ctx.routes.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Dosage" placeholder="e.g. 500mg twice daily" value={line.dosage}
              onChange={e => setLine(l => ({ ...l, dosage: e.target.value }))} />
            <TextField size="small" label="Notes (optional)" value={line.notes}
              onChange={e => setLine(l => ({ ...l, notes: e.target.value }))} />
          </div>
          <Button fullWidth variant="outlined" onClick={addToList}>➕ Add to list</Button>
        </Paper>
      )}

      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Medications to Dispense ({cart.length})</Typography>
      {!cart.length ? <Alert severity="info">No medications added yet.</Alert> : (
        <div className="space-y-2">
          {cart.map((l, i) => (
            <Paper key={`${bucketKey(l)}-${i}`} variant="outlined" className="p-3 flex items-center justify-between gap-3">
              <Typography variant="body2">
                <strong>{i + 1}. {l.medicine_name} {l.strength || ''}</strong> × {l.quantity} — {l.dosage || 'no dosage given'} · {l.route} · {l.source_label} [{l.location_name}] {l.alerts.map(a => (a.includes('ALLERGY') ? '🚨' : '❌')).join(' ')}
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setCart(cart.filter((_, j) => j !== i))}>Remove</Button>
            </Paper>
          ))}
          {flagged.length > 0 && (
            <>
              <Alert severity="warning"><Md>{`Safety alerts on: **${flagged.join(', ')}**`}</Md></Alert>
              <FormControlLabel key={rev} control={<Checkbox checked={ack} onChange={e => setAck(e.target.checked)} />}
                label="I acknowledge the above alerts and confirm this dispensing is clinically appropriate." />
            </>
          )}
          <div className="grid grid-cols-4 gap-2">
            <Button className="col-span-3" variant="contained" disabled={busy} onClick={dispense}>Dispense {cart.length} medication(s)</Button>
            <Button variant="outlined" onClick={() => setCart([])}>Clear list</Button>
          </div>
        </div>
      )}

      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Patient Medication Administration Record (eMAR)</Typography>
      {ctx.emar.length ? <DataTable rows={ctx.emar} /> : <Alert severity="info">No medication records for this patient yet.</Alert>}
    </Box>
  );
}
