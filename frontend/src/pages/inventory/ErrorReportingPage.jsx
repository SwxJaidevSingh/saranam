/**
 * Medication Error Reporting — log errors, near misses, ADRs. (Like the Streamlit app,
 * this page has a route but no sidebar entry.)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import inventoryApi, { apiError } from '../../api/inventory';
import { DataTable, PageHeader } from '../../components/inventory/shared';

const emptyForm = { error_type: 'wrong_drug', severity: 'low', patient_id: '', medicine_id: '', description: '' };

export default function ErrorReportingPage() {
  const [tab, setTab] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [data, setData] = useState(null);
  const [selId, setSelId] = useState('');
  const [newStatus, setNewStatus] = useState('open');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => inventoryApi.getErrors(statusFilter).then(setData).catch(err => setError(apiError(err))), [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, after) => {
    try {
      setError(null);
      const res = await fn();
      setMessage(res.message);
      after?.();
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const records = data?.records || [];
  const selected = records.find(r => r.id === selId) || records[0];

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader title="⚠️ Medication Error Reporting" />
      {message && <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Error Log" sx={{ textTransform: 'none' }} />
        <Tab label="Report Error" sx={{ textTransform: 'none' }} />
      </Tabs>

      {tab === 0 && data && (
        <div className="space-y-3">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              {['All', ...data.statuses].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          {!records.length ? <Alert severity="success">No medication errors on record.</Alert> : (
            <>
              <DataTable rows={records} minWidth={1100} />
              <Divider />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Update Status</Typography>
              <Paper className="p-4 space-y-3">
                <FormControl size="small" fullWidth>
                  <InputLabel>Select error</InputLabel>
                  <Select label="Select error" value={selected.id} onChange={e => setSelId(e.target.value)}>
                    {records.map(r => <MenuItem key={r.id} value={r.id}>{`#${r.id} — ${r.error_type} (${r.status})`}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>New status</InputLabel>
                  <Select label="New status" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    {data.statuses.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button variant="contained" onClick={() => run(() => inventoryApi.updateErrorStatus(selected.id, newStatus))}>Update</Button>
              </Paper>
            </>
          )}
        </div>
      )}

      {tab === 1 && data && (
        <Paper className="p-4 space-y-3">
          <FormControl size="small" fullWidth>
            <InputLabel>Error Type</InputLabel>
            <Select label="Error Type" value={form.error_type} onChange={set('error_type')}>
              {data.error_types.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select label="Severity" value={form.severity} onChange={set('severity')}>
              {data.severities.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Patient (if applicable)</InputLabel>
            <Select label="Patient (if applicable)" value={form.patient_id} onChange={set('patient_id')}>
              <MenuItem value="">N/A</MenuItem>
              {data.patients.map(p => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Medicine (if applicable)</InputLabel>
            <Select label="Medicine (if applicable)" value={form.medicine_id} onChange={set('medicine_id')}>
              <MenuItem value="">N/A</MenuItem>
              {data.medicines.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" multiline rows={5} label="Description *" value={form.description} onChange={set('description')} />
          <Button fullWidth variant="contained" onClick={() => {
            if (!form.description) { setError('Description is required.'); return; }
            run(() => inventoryApi.reportError(form), () => setForm(emptyForm));
          }}>Submit Error Report</Button>
        </Paper>
      )}
    </Box>
  );
}
