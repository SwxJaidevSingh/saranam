/** Vehicles Management — view the fleet, register vehicles, update or delete them. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControl, FormControlLabel, InputLabel, MenuItem,
  OutlinedInput, Paper, Radio, RadioGroup, Select, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';

const emptyForm = (options) => ({
  name: '', registration_number: '', vehicle_type: 'ambulance', capacity: 5,
  base_hospital: options?.hospitals?.[0] || 'KMIO', is_active: true, zones: [], notes: '',
});

function VehicleForm({ value, onChange, options }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-3">
        <TextField fullWidth size="small" label="Vehicle Name *" placeholder="e.g. Ambulance 3" value={value.name} onChange={set('name')} />
        <TextField fullWidth size="small" label="Registration Number" placeholder="e.g. KA-51-MM-8899" value={value.registration_number || ''} onChange={set('registration_number')} />
        <FormControl fullWidth size="small">
          <InputLabel>Vehicle Type</InputLabel>
          <Select label="Vehicle Type" value={value.vehicle_type || 'ambulance'} onChange={set('vehicle_type')}>
            {(options?.vehicle_types || ['ambulance', 'car', 'van']).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField fullWidth size="small" type="number" label="Capacity (Patients per day) *" value={value.capacity}
          onChange={set('capacity')} slotProps={{ htmlInput: { min: 1, max: 20 } }} />
      </div>
      <div className="space-y-3">
        <FormControl fullWidth size="small">
          <InputLabel>Base Hospital Depot *</InputLabel>
          <Select label="Base Hospital Depot *" value={value.base_hospital} onChange={set('base_hospital')}>
            {(options?.hospitals || []).map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControlLabel control={<Checkbox checked={!!value.is_active} onChange={e => onChange({ ...value, is_active: e.target.checked })} />} label="Active Status" />
        <FormControl fullWidth size="small">
          <InputLabel>Service Zone Coverage *</InputLabel>
          <Select multiple value={value.zones} onChange={set('zones')} input={<OutlinedInput label="Service Zone Coverage *" />}
            renderValue={v => v.join(', ')}>
            {(options?.zones || []).map(z => <MenuItem key={z} value={z}>{z}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField fullWidth size="small" multiline rows={3} label="Notes" placeholder="Special staff or equipment details..." value={value.notes || ''} onChange={set('notes')} />
      </div>
    </div>
  );
}

const validate = (v) => (!String(v.name).trim() ? 'Vehicle Name is required.'
  : !v.zones.length ? 'At least one Service Zone must be selected.' : null);

export default function VehiclesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [addForm, setAddForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [editId, setEditId] = useState('');
  const [action, setAction] = useState('update');
  const [editForm, setEditForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await homecareDispatchApi.getVehicles();
      setData(res);
      setAddForm(f => f || emptyForm(res.options));
    } catch (err) {
      setError(`Failed to fetch vehicles list: ${apiError(err)}`);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const vehicles = useMemo(() => data?.vehicles || [], [data]);
  const options = data?.options;

  useEffect(() => {
    if (!vehicles.length) return;
    const target = vehicles.find(v => v.id === editId) || vehicles[0];
    if (target.id !== editId) setEditId(target.id);
    const hospitals = options?.hospitals || [];
    setEditForm({
      name: target.name, registration_number: target.registration_number || '', vehicle_type: target.vehicle_type || 'ambulance',
      capacity: target.capacity, base_hospital: hospitals.includes(target.base_hospital) ? target.base_hospital : hospitals[0],
      is_active: target.is_active, zones: (target.zones || []).filter(z => (options?.zones || []).includes(z)), notes: target.notes || '',
    });
    setConfirmDelete(false);
    setFormError(null);
  }, [editId, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const types = useMemo(() => ['All Types', ...new Set(vehicles.map(v => v.vehicle_type || 'N/A'))], [vehicles]);
  const filtered = vehicles.filter(v => {
    const q = search.trim().toLowerCase();
    if (q && !`${v.name} ${v.registration_number || ''}`.toLowerCase().includes(q)) return false;
    return typeFilter === 'All Types' || (v.vehicle_type || 'N/A') === typeFilter;
  });

  const run = async (fn, okMsg) => {
    try {
      setBusy(true);
      setFormError(null);
      const res = await fn();
      setSuccess(res.message || okMsg);
      await load();
      return true;
    } catch (err) {
      setFormError(apiError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    const msg = validate(addForm);
    if (msg) { setFormError(msg); return; }
    if (await run(() => homecareDispatchApi.createVehicle(addForm))) setAddForm(emptyForm(options));
  };
  const saveEdit = async () => {
    const msg = validate(editForm);
    if (msg) { setFormError(msg); return; }
    await run(() => homecareDispatchApi.updateVehicle(editId, editForm));
  };
  const remove = async () => {
    if (await run(() => homecareDispatchApi.deleteVehicle(editId))) setEditId('');
  };

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>🚛 Vehicles Management</Typography>
        <Typography variant="body2" color="text.secondary">Register, configure, and monitor your transport vehicles and service zone coverage.</Typography>
      </div>
      {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <Box className="flex justify-center p-10"><CircularProgress /></Box>}

      {data && (
        <>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setFormError(null); }} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="📋 View Vehicles" sx={{ textTransform: 'none' }} />
            <Tab label="➕ Register Vehicle" sx={{ textTransform: 'none' }} />
            <Tab label="🔧 Update / Delete" sx={{ textTransform: 'none' }} />
          </Tabs>

          {tab === 0 && (vehicles.length === 0 ? <Alert severity="info">No vehicles registered in the database.</Alert> : (
            <div className="space-y-3">
              <Paper className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[['Total Fleet Size', vehicles.length], ['Active Vehicles', vehicles.filter(v => v.is_active).length],
                  ['Total Daily Capacity', `${vehicles.reduce((t, v) => t + (v.capacity || 0), 0)} patients`]].map(([l, v]) => (
                  <div key={l}><Typography variant="caption" color="text.secondary">{l}</Typography><Typography variant="h5" sx={{ fontWeight: 700 }}>{v}</Typography></div>
                ))}
              </Paper>
              <Paper className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <TextField className="md:col-span-2" size="small" label="Search Fleet" placeholder="Search by vehicle name or registration number..." value={search} onChange={e => setSearch(e.target.value)} />
                <FormControl size="small">
                  <InputLabel>Vehicle Type</InputLabel>
                  <Select label="Vehicle Type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    {types.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Paper>
              <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>{['Name', 'Reg Number', 'Type', 'Capacity', 'Base Hospital', 'Assigned Zones', 'Status', 'Notes'].map(h => <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>)}</TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(v => (
                      <TableRow key={v.id} hover>
                        <TableCell>{v.name}</TableCell><TableCell>{v.registration_number || 'N/A'}</TableCell><TableCell>{v.vehicle_type || 'N/A'}</TableCell>
                        <TableCell>{v.capacity} patients/day</TableCell><TableCell>{v.base_hospital || 'N/A'}</TableCell>
                        <TableCell>{v.zones?.length ? v.zones.join(', ') : 'None'}</TableCell>
                        <TableCell>{v.is_active ? '🟢 Active' : '🔴 Inactive'}</TableCell><TableCell>{v.notes || ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          ))}

          {tab === 1 && addForm && (
            <Paper className="p-4 space-y-3">
              <Typography variant="h6" sx={{ fontWeight: 700 }}>➕ Add New Vehicle</Typography>
              <Typography variant="caption" color="text.secondary">Fill in the details below to register a new transport vehicle to the fleet.</Typography>
              <VehicleForm value={addForm} onChange={setAddForm} options={options} />
              {formError && <Alert severity="error">{formError}</Alert>}
              <Button fullWidth variant="contained" disabled={busy} onClick={register}>Register Vehicle</Button>
            </Paper>
          )}

          {tab === 2 && (vehicles.length === 0 ? <Alert severity="info">No vehicles available to edit.</Alert> : (
            <div className="space-y-3">
              <Paper className="p-4 space-y-3">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>🔧 Modify Existing Vehicle</Typography>
                <Typography variant="caption" color="text.secondary">Select a vehicle to modify its configurations or delete it from the system.</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Vehicle</InputLabel>
                  <Select label="Select Vehicle" value={editId} onChange={e => setEditId(e.target.value)}>
                    {vehicles.map(v => <MenuItem key={v.id} value={v.id}>{v.name} ({v.registration_number || 'No Reg'})</MenuItem>)}
                  </Select>
                </FormControl>
                <RadioGroup row value={action} onChange={e => { setAction(e.target.value); setFormError(null); }}>
                  <FormControlLabel value="update" control={<Radio size="small" />} label="Update Details" />
                  <FormControlLabel value="delete" control={<Radio size="small" />} label="Delete Vehicle" />
                </RadioGroup>
              </Paper>
              {action === 'update' && editForm && (
                <Paper className="p-4 space-y-3">
                  <VehicleForm value={editForm} onChange={setEditForm} options={options} />
                  {formError && <Alert severity="error">{formError}</Alert>}
                  <Button fullWidth variant="contained" disabled={busy} onClick={saveEdit}>Save Changes</Button>
                </Paper>
              )}
              {action === 'delete' && (
                <Paper className="p-4 space-y-3">
                  <Alert severity="warning">
                    Are you sure you want to permanently delete vehicle <strong>&apos;{vehicles.find(v => v.id === editId)?.name}&apos;</strong>?
                    Its scheduled visits and vehicle logs are deleted with it. To stop using a vehicle but keep its history, untick Active Status instead.
                  </Alert>
                  <FormControlLabel control={<Checkbox checked={confirmDelete} onChange={e => setConfirmDelete(e.target.checked)} />} label="Yes, I confirm I want to delete this vehicle." />
                  {formError && <Alert severity="error">{formError}</Alert>}
                  <Button fullWidth variant="contained" color="error" disabled={!confirmDelete || busy} onClick={remove}>Delete Permanently</Button>
                </Paper>
              )}
            </div>
          ))}
        </>
      )}
    </Box>
  );
}
