/**
 * Administration — users (read-only, from the EHR), patient drug allergies, emergency meds.
 * Users and patients are created in the EHR, not here. Admin role only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import inventoryApi, { apiError } from '../../api/inventory';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Md, PageHeader } from '../../components/inventory/shared';

function UsersTab({ onError }) {
  const [users, setUsers] = useState(null);
  useEffect(() => { inventoryApi.getUsers().then(r => setUsers(r.users)).catch(err => onError(apiError(err))); }, [onError]);
  return (
    <div className="space-y-2">
      <Typography variant="h6" sx={{ fontWeight: 700 }}>User Accounts</Typography>
      <Typography variant="caption" color="text.secondary">Accounts are shared with the Saranam EHR — create, approve and deactivate users there.</Typography>
      {users?.length > 0 && <DataTable rows={users} />}
    </div>
  );
}

function PatientsTab({ onMessage, onError }) {
  const [patients, setPatients] = useState(null);
  const [patientId, setPatientId] = useState('');
  const [edits, setEdits] = useState({});

  const load = useCallback(() => inventoryApi.getAdminPatients().then(r => setPatients(r.patients)).catch(err => onError(apiError(err))), [onError]);
  useEffect(() => { load(); }, [load]);

  const living = (patients || []).filter(p => !p.is_deceased);
  const patient = living.find(p => p.id === patientId) || living[0];

  if (!patients) return null;
  const allergies = patient ? (edits[patient.id] ?? patient.allergies ?? '') : '';
  const save = async () => {
    try {
      const res = await inventoryApi.saveAllergies(patient.id, allergies);
      onMessage(res.message);
      setEdits(e => { const n = { ...e }; delete n[patient.id]; return n; });
      await load();
    } catch (err) {
      onError(apiError(err));
    }
  };

  return (
    <div className="space-y-3">
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Saranam Patients</Typography>
      <Typography variant="caption" color="text.secondary">Patients are registered in the Saranam EHR. Drug allergies are recorded here.</Typography>
      {patients.length
        ? <DataTable rows={patients} columns={['uhid', 'full_name', 'gender', 'age', 'care_status', 'is_deceased', 'allergies']} maxHeight={400} />
        : <Alert severity="info">No Saranam patients found.</Alert>}
      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Record Drug Allergies</Typography>
      {patient && (
        <Paper className="p-4 space-y-3">
          <FormControl size="small" fullWidth>
            <InputLabel>Patient</InputLabel>
            <Select label="Patient" value={patient.id} onChange={e => setPatientId(e.target.value)}>
              {living.map(p => <MenuItem key={p.id} value={p.id}>{`${p.full_name} (${p.uhid})`}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Known Drug Allergies" placeholder="Comma-separated, e.g. Penicillin, Aspirin"
            value={allergies} onChange={e => setEdits(x => ({ ...x, [patient.id]: e.target.value }))} />
          <Button fullWidth variant="contained" onClick={save}>Save Allergies</Button>
        </Paper>
      )}
    </div>
  );
}

function EmergencyMedsTab({ onMessage, onError }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ medicine_id: '', location: '', quantity: 0 });

  const load = useCallback(() => inventoryApi.getEmergencyMeds().then(setData).catch(err => onError(apiError(err))), [onError]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const medicineId = form.medicine_id || data.medicines[0]?.id || '';
  const add = async () => {
    if (!form.location) { onError('Location is required.'); return; }
    try {
      const res = await inventoryApi.addEmergencyMed({ ...form, medicine_id: medicineId, quantity: Number(form.quantity) });
      onMessage(res.message);
      setForm({ medicine_id: '', location: '', quantity: 0 });
      await load();
    } catch (err) {
      onError(apiError(err));
    }
  };

  return (
    <div className="space-y-3">
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Emergency Medication Locations</Typography>
      {data.emergency_meds.length > 0 && <DataTable rows={data.emergency_meds} />}
      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Add Emergency Med Entry</Typography>
      {!data.medicines.length ? <Alert severity="warning">Add medicines to the catalog first.</Alert> : (
        <Paper className="p-4 space-y-3">
          <FormControl size="small" fullWidth>
            <InputLabel>Emergency Medicine</InputLabel>
            <Select label="Emergency Medicine" value={medicineId} onChange={e => setForm(f => ({ ...f, medicine_id: e.target.value }))}>
              {data.medicines.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Location *" placeholder="e.g. Home Kit A, KMIO ICU" value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <TextField fullWidth size="small" type="number" label="Quantity" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} slotProps={{ htmlInput: { min: 0 } }} />
          <Button fullWidth variant="contained" onClick={add}>Add Entry</Button>
        </Paper>
      )}
    </div>
  );
}

export default function InventoryAdminPage() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const onMessage = useCallback((m) => { setMessage(m); setError(null); }, []);
  const onError = useCallback((e) => { setError(e); setMessage(null); }, []);

  if (!hasRole('admin')) {
    return <Box className="p-3 sm:p-6 max-w-7xl mx-auto"><Alert severity="error">You don&apos;t have permission to view this page.</Alert></Box>;
  }

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader title="⚙️ Administration" />
      {message && <Alert severity="success" onClose={() => setMessage(null)}><Md>{message}</Md></Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Users" sx={{ textTransform: 'none' }} />
        <Tab label="Patients" sx={{ textTransform: 'none' }} />
        <Tab label="Emergency Meds" sx={{ textTransform: 'none' }} />
      </Tabs>
      {tab === 0 && <UsersTab onError={onError} />}
      {tab === 1 && <PatientsTab onMessage={onMessage} onError={onError} />}
      {tab === 2 && <EmergencyMedsTab onMessage={onMessage} onError={onError} />}
    </Box>
  );
}
