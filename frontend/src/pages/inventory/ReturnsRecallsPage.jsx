/**
 * Returns & Recalls — log returns and recalls. A return with a quantity puts the units
 * back on the medicine's first stock row as unattributed stock; recalls don't change stock.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, Tab, Tabs, TextField,
} from '@mui/material';
import inventoryApi, { apiError } from '../../api/inventory';
import { DataTable, PageHeader } from '../../components/inventory/shared';

const emptyForm = { type: 'return', medicine_id: '', quantity: 0, reason: '', adverse_reaction: '' };

export default function ReturnsRecallsPage() {
  const [tab, setTab] = useState(0);
  const [typeFilter, setTypeFilter] = useState('All');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => inventoryApi.getReturns(typeFilter).then(setData).catch(err => setError(apiError(err))), [typeFilter]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const medicineId = form.medicine_id || data?.medicines[0]?.id || '';

  const submit = async () => {
    if (!form.reason) { setError('Reason is required.'); return; }
    try {
      setBusy(true);
      setError(null);
      const res = await inventoryApi.reportReturn({ ...form, medicine_id: medicineId, quantity: Number(form.quantity) });
      setMessage(res.message);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader title="🔄 Returns & Recalls" />
      {message && <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="View Log" sx={{ textTransform: 'none' }} />
        <Tab label="Report New" sx={{ textTransform: 'none' }} />
      </Tabs>

      {tab === 0 && (
        <div className="space-y-3">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by type</InputLabel>
            <Select label="Filter by type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              {['All', 'return', 'recall'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          {data && (data.records.length ? <DataTable rows={data.records} minWidth={1000} /> : <Alert severity="info">No return or recall records.</Alert>)}
        </div>
      )}

      {tab === 1 && data && (data.medicines.length === 0 ? <Alert severity="warning">Add medicines to the catalog first.</Alert> : (
        <Paper className="p-4 space-y-3">
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select label="Type" value={form.type} onChange={set('type')}>
              {['return', 'recall'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Medicine</InputLabel>
            <Select label="Medicine" value={medicineId} onChange={set('medicine_id')}>
              {data.medicines.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" type="number" label="Quantity" value={form.quantity} onChange={set('quantity')} slotProps={{ htmlInput: { min: 0 } }} />
          <TextField fullWidth size="small" multiline rows={3} label="Reason *" value={form.reason} onChange={set('reason')} />
          <TextField fullWidth size="small" label="Adverse Reaction (if any)" value={form.adverse_reaction} onChange={set('adverse_reaction')} />
          <Button fullWidth variant="contained" disabled={busy} onClick={submit}>Submit Report</Button>
        </Paper>
      ))}
    </Box>
  );
}
