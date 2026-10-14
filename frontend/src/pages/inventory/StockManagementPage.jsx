/**
 * Stock Management — current stock by source, reorder levels per source, receiving
 * stock (Saranam procurement or a partner organisation's indent), movement log.
 * No batch numbers and no expiry dates.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import inventoryApi, { apiError } from '../../api/inventory';
import { DataTable, Md, PageHeader } from '../../components/inventory/shared';

const STOCK_COLUMNS = ['Medicine', 'Category', 'Strength', 'Qty', '🟢 Saranam', '🟢 Reorder Lvl', '🔵 Partner',
  '🔵 By Partner (reorder lvl)', '⚪ Unattributed', 'Location', 'Status'];

function CurrentStockTab({ onMessage, onError }) {
  const [data, setData] = useState(null);
  const [source, setSource] = useState('All');
  const [location, setLocation] = useState('');
  const [stockId, setStockId] = useState('');
  const [levelSource, setLevelSource] = useState('saranam');
  const [levelEdits, setLevelEdits] = useState({});

  const load = useCallback(() => inventoryApi.getStock().then(setData).catch(err => onError(apiError(err))), [onError]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.rows || []).filter(r =>
    (source === 'All' || r[`${source}_qty`] > 0)
    && (!location || r.Location.toLowerCase().includes(location.toLowerCase()))), [data, source, location]);

  const selected = data?.rows.find(r => r.stock_id === stockId) || data?.rows[0];
  const current = selected?.levels?.[levelSource];
  const levelKey = `${selected?.stock_id}|${levelSource}`;
  const level = levelEdits[levelKey] ?? (current ?? 10);

  if (!data) return null;
  const sourceNames = data.source_names;

  const update = async () => {
    try {
      const res = await inventoryApi.setReorderLevel(selected.stock_id, levelSource, Number(level));
      onMessage(res.message);
      setLevelEdits(e => { const n = { ...e }; delete n[levelKey]; return n; });
      await load();
    } catch (err) {
      onError(apiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormControl size="small">
          <InputLabel>Source</InputLabel>
          <Select label="Source" value={source} onChange={e => setSource(e.target.value)}>
            <MenuItem value="All">All</MenuItem>
            {Object.entries(data.source_labels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="Location" placeholder="All locations" value={location} onChange={e => setLocation(e.target.value)} />
      </div>
      {rows.length ? <DataTable rows={rows} columns={STOCK_COLUMNS} minWidth={1300} /> : <Alert severity="info">No stock records found.</Alert>}

      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Set Reorder Level by Source</Typography>
      {selected && (
        <Paper className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormControl size="small" className="md:col-span-2">
              <InputLabel>Select stock item</InputLabel>
              <Select label="Select stock item" value={selected.stock_id} onChange={e => setStockId(e.target.value)}>
                {data.rows.map(r => <MenuItem key={r.stock_id} value={r.stock_id}>{r.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel>Indent Source</InputLabel>
              <Select label="Indent Source" value={levelSource} onChange={e => setLevelSource(e.target.value)}>
                {Object.entries(sourceNames).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </div>
          <Typography variant="caption" color="text.secondary">
            Current levels — {Object.entries(sourceNames).map(([k, v]) =>
              `${k === 'saranam' ? '🟢' : '🔵'} ${v}: ${selected.levels[k] ?? 'not set'}`).join(' · ')}
          </Typography>
          <TextField size="small" type="number" label="New reorder level" value={level}
            onChange={e => setLevelEdits(x => ({ ...x, [levelKey]: e.target.value }))} slotProps={{ htmlInput: { min: 0 } }} />
          <div><Button variant="contained" onClick={update}>Update Reorder Level</Button></div>
        </Paper>
      )}
    </div>
  );
}

function ReceiveStockTab({ onMessage, onError }) {
  const [opts, setOpts] = useState(null);
  const [source, setSource] = useState('saranam');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = (o) => setForm({
    medicine_id: o.medicines[0]?.id || '', quantity: 1, partner_org_id: '', supplier: '',
    location_id: o.default_location_id || '', reorder_level: 10,
  });
  useEffect(() => {
    inventoryApi.getReceiveOptions().then(o => { setOpts(o); reset(o); }).catch(err => onError(apiError(err)));
  }, [onError]);

  if (!opts || !form) return null;
  if (!opts.medicines.length) return <Alert severity="warning">Add medicines to the catalog first.</Alert>;
  if (!opts.locations.length) return <Alert severity="warning">No stock locations that can receive stock. Add one in the EHR.</Alert>;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const partnerValue = form.partner_org_id || opts.partners[0]?.id || '';

  const submit = async () => {
    if (source === 'partner' && !partnerValue) { onError('Select the partner organisation.'); return; }
    try {
      setBusy(true);
      const res = await inventoryApi.receiveStock({
        ...form, source, quantity: Number(form.quantity), reorder_level: Number(form.reorder_level),
        partner_org_id: source === 'partner' ? partnerValue : null, supplier: source === 'saranam' ? form.supplier : null,
      });
      onMessage(res.message);
      reset(opts);
    } catch (err) {
      onError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper className="p-4 space-y-3">
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Receive New Stock</Typography>
      <FormControl size="small" fullWidth>
        <InputLabel>Source</InputLabel>
        <Select label="Source" value={source} onChange={e => setSource(e.target.value)}>
          {Object.entries(opts.sources).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
        </Select>
      </FormControl>
      {source === 'partner' && !opts.partners.length && <Alert severity="warning">No partner organisations found. Add them in the EHR.</Alert>}
      <FormControl size="small" fullWidth>
        <InputLabel>Medicine</InputLabel>
        <Select label="Medicine" value={form.medicine_id} onChange={set('medicine_id')}>
          {opts.medicines.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
        </Select>
      </FormControl>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TextField size="small" type="number" label="Quantity *" value={form.quantity} onChange={set('quantity')} slotProps={{ htmlInput: { min: 1 } }} />
        <FormControl size="small">
          <InputLabel>Storage Location</InputLabel>
          <Select label="Storage Location" value={form.location_id} onChange={set('location_id')}>
            {opts.locations.map(l => <MenuItem key={l.id} value={l.id}>{l.location_name}</MenuItem>)}
          </Select>
        </FormControl>
        {source === 'partner' ? (
          <FormControl size="small">
            <InputLabel>Partner Organisation *</InputLabel>
            <Select label="Partner Organisation *" value={partnerValue} onChange={set('partner_org_id')}>
              {opts.partners.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
        ) : (
          <TextField size="small" label="Supplier" value={form.supplier} onChange={set('supplier')} />
        )}
        <TextField size="small" type="number" label="Reorder Level for this source (if not set yet)" value={form.reorder_level}
          onChange={set('reorder_level')} slotProps={{ htmlInput: { min: 0 } }} />
      </div>
      <Button fullWidth variant="contained" disabled={busy} onClick={submit}>Receive Stock</Button>
    </Paper>
  );
}

function MovementLogTab({ onError }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    inventoryApi.getMovements().then(r => setRows(r.movements)).catch(err => onError(apiError(err)));
  }, [onError]);
  if (!rows) return null;
  return (
    <div className="space-y-2">
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Stock Movement History</Typography>
      {rows.length ? <DataTable rows={rows} minWidth={1100} /> : <Alert severity="info">No stock movements recorded yet.</Alert>}
    </div>
  );
}

export default function StockManagementPage() {
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const onMessage = useCallback((m) => { setMessage(m); setError(null); }, []);
  const onError = useCallback((e) => { setError(e); setMessage(null); }, []);

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader title="📦 Stock Management" />
      {message && <Alert severity="success" onClose={() => setMessage(null)}><Md>{message}</Md></Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Current Stock" sx={{ textTransform: 'none' }} />
        <Tab label="Receive Stock" sx={{ textTransform: 'none' }} />
        <Tab label="Movement Log" sx={{ textTransform: 'none' }} />
      </Tabs>
      {tab === 0 && <CurrentStockTab onMessage={onMessage} onError={onError} />}
      {tab === 1 && <ReceiveStockTab onMessage={onMessage} onError={onError} />}
      {tab === 2 && <MovementLogTab onError={onError} />}
    </Box>
  );
}
