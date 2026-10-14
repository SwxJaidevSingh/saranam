/** System Settings — SLA days, priority weights, homecare weekdays, boundary buffer and expiry timings. */
import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Divider, FormControl, InputLabel, MenuItem, OutlinedInput, Paper,
  Select, TextField, Typography,
} from '@mui/material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLA_FIELDS = [
  ['Emergency', 'Emergency SLA (Days)', 30, 'SLA days for emergency patients. Typically 1 day.'],
  ['Urgent', 'Urgent SLA (Days)', 30, 'SLA days for critical/urgent patients. Typically 1 day.'],
  ['High', 'High Priority SLA (Days)', 60, 'SLA days for High Priority existing patients.'],
  ['Medium', 'Medium Priority SLA (Days)', 90, 'SLA days for Medium Priority existing patients.'],
  ['Low', 'Low Priority SLA (Days)', 180, 'SLA days for Low Priority existing patients.'],
  ['New', 'New Patient SLA (Days)', 60, 'SLA days for standard New patients. Typically 4 days.'],
];
const WEIGHT_FIELDS = [
  ['weight_Emergency', 'Emergency Weight', 'Priority weight for Emergency patients.'],
  ['weight_Urgent', 'Urgent Weight', 'Priority weight for Urgent patients.'],
  ['weight_High', 'High Weight', 'Priority weight for High Priority patients.'],
  ['weight_New', 'New Patient Weight', 'Priority weight for standard New patients.'],
  ['weight_Medium', 'Medium Weight', 'Priority weight for Medium Priority patients.'],
  ['weight_Low', 'Low Weight', 'Priority weight for Low Priority patients.'],
];

const expiryText = (h) => {
  const hrs = Number(h) || 0;
  const mins = Math.round(hrs * 60);
  return mins < 60 ? `${mins} mins` : `${hrs} hr${hrs !== 1 ? 's' : ''}`;
};

function Metric({ label, value }) {
  return (
    <div>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{value}</Typography>
    </div>
  );
}

export default function SystemSettingsPage() {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    homecareDispatchApi.getSettings()
      .then(s => { setSaved(s); setForm(s); })
      .catch(err => setError(`Failed to load settings: ${apiError(err)}`));
  }, []);

  const num = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setError(null);
    setSuccess(null);
    if (!form.homecare_weekdays?.length) { setError('Please select at least one active weekday.'); return; }
    try {
      setSaving(true);
      const res = await homecareDispatchApi.saveSettings(form);
      setSaved(res.settings);
      setForm(res.settings);
      setSuccess('✅ Configurations saved successfully! Scheduling scores will use the new values.');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <Box className="p-6">{error ? <Alert severity="error">{error}</Alert> : <CircularProgress />}</Box>;
  }

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <Typography variant="h5" sx={{ fontWeight: 700 }}>⚙️ Configuration Settings</Typography>
      {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Paper className="p-4 space-y-4">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>⏱️ Homecare SLA Settings (Days)</Typography>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {SLA_FIELDS.map(([k, label, max, help]) => (
            <TextField key={k} size="small" type="number" label={label} value={form[k]} onChange={num(k)} helperText={help}
              slotProps={{ htmlInput: { min: 1, max, step: 1 } }} />
          ))}
        </div>

        <Divider />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>⚖️ Priority Urgency Weights</Typography>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {WEIGHT_FIELDS.map(([k, label, help]) => (
            <TextField key={k} size="small" type="number" label={label} value={form[k]} onChange={num(k)} helperText={help}
              slotProps={{ htmlInput: { min: 0, max: 500, step: 1 } }} />
          ))}
        </div>

        <Divider />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>📅 Homecare Operational Days</Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Active Homecare Weekdays</InputLabel>
          <Select multiple value={form.homecare_weekdays} onChange={e => setForm(f => ({ ...f, homecare_weekdays: e.target.value }))}
            input={<OutlinedInput label="Active Homecare Weekdays" />} renderValue={v => v.join(', ')}>
            {WEEKDAYS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">Unselected days will be excluded from gap day calculations.</Typography>

        <Divider />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>🌐 Geospatial Preferences</Typography>
        <TextField size="small" type="number" label="Boundary Buffer Distance (km)" value={form.boundary_buffer_km} onChange={num('boundary_buffer_km')}
          helperText="Distance threshold in kilometers to identify patients near neighboring zone boundaries."
          slotProps={{ htmlInput: { min: 0.5, max: 10, step: 0.5 } }} />

        <Divider />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>⏱️ Schedule Expiry Timing (Draft &amp; Locked)</Typography>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <TextField size="small" type="number" label="Draft Expiry (hours)" value={form.draft_expiry_hours} onChange={num('draft_expiry_hours')}
            helperText="Time in hours before an unfinalized pending draft automatically expires (e.g. 0.50 = 30 mins, 1.00 = 1 hour, 2.00 = 2 hours)."
            slotProps={{ htmlInput: { min: 0.25, max: 72, step: 0.25 } }} />
          <TextField size="small" type="number" label="Locked Schedule Expiry (hours)" value={form.locked_expiry_hours} onChange={num('locked_expiry_hours')}
            helperText="Time in hours before an unexecuted locked schedule (no vehicle log submitted) expires after the schedule date passes."
            slotProps={{ htmlInput: { min: 1, max: 168, step: 1 } }} />
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Draft Expiry" value={expiryText(form.draft_expiry_hours)} />
            <Metric label="Locked Run Expiry" value={`${Number(form.locked_expiry_hours) || 0} hrs`} />
          </div>
        </div>

        <Button fullWidth variant="contained" size="large" disabled={saving} onClick={save}>💾 Save Configurations</Button>
      </Paper>

      <Paper className="p-4 space-y-3">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>📋 Active System Configuration Summary</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>Target SLAs</Typography>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {['Emergency', 'Urgent', 'High', 'New', 'Medium', 'Low'].map(k => (
            <Metric key={k} label={`${k} SLA`} value={`${saved[k]} Day${saved[k] === 1 ? '' : 's'}`} />
          ))}
        </div>
        <Divider />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>Priority Weights</Typography>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[['Emergency', 'weight_Emergency'], ['Urgent', 'weight_Urgent'], ['High', 'weight_High'], ['New Patient', 'weight_New'], ['Medium', 'weight_Medium'], ['Low', 'weight_Low']].map(([l, k]) => (
            <Metric key={k} label={l} value={saved[k]} />
          ))}
        </div>
        <Divider />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Metric label="Active Homecare Days" value={saved.homecare_weekdays.join(', ')} />
          <Metric label="Boundary Buffer" value={`${saved.boundary_buffer_km} km`} />
          <Metric label="Draft Expiry" value={expiryText(saved.draft_expiry_hours)} />
          <Metric label="Locked Run Expiry" value={`${saved.locked_expiry_hours} hrs`} />
        </div>
      </Paper>
    </Box>
  );
}
