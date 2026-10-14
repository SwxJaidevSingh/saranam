/**
 * CareCircleCard — Primary Caregiver + Decision Maker capture at baseline.
 *
 * Captured per the meeting directive (§1.1, 2026-04-14) on the Initial
 * Assessment page, distinct from the registration-time alternative_phone
 * contact. Primary Caregiver = family member doing hands-on daily care.
 * Decision Maker = clinical authority (treating physician / oncologist /
 * palliative consultant) — NOT a family member in the typical case.
 *
 * Values persist directly on the patient record (not on a visit).
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid,
  CircularProgress, Divider, InputAdornment,
} from '@mui/material';
import { Save, People, LocalHospital } from '@mui/icons-material';
import { usePatient } from '../../context/PatientContext';

const FIELD_KEYS = [
  'primary_caregiver_name',
  'primary_caregiver_relationship',
  'primary_caregiver_phone',
  'decision_maker_name',
  'decision_maker_designation',
  'decision_maker_phone',
];

export default function CareCircleCard({ patient, onSaved }) {
  const { updatePatient } = usePatient();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // Hydrate from patient prop; re-hydrate when patient id changes or after save.
  useEffect(() => {
    const next = {};
    for (const k of FIELD_KEYS) next[k] = patient?.[k] || '';
    setForm(next);
    setDirty(false);
  }, [patient?.id, patient?.updated_at]);

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      const payload = {};
      for (const k of FIELD_KEYS) {
        // Always send the key so clearing a value also persists (backend
        // service trims + sets null when empty string arrives).
        payload[k] = (form[k] || '').trim();
      }
      await updatePatient(patient.id, payload);
      setDirty(false);
      setSavedAt(new Date());
      if (onSaved) onSaved();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save care circle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
          Care Circle
        </Typography>
        {savedAt && !dirty && (
          <Typography variant="caption" color="success.main">
            Saved {savedAt.toLocaleTimeString()}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Captured at baseline. Primary Caregiver is the family member doing hands-on care.
      </Typography>

      <Grid container spacing={3}>
        {/* ── Primary Caregiver ── */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <People fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Primary Caregiver
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (family / hands-on)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              fullWidth size="small"
              label="Name"
              value={form.primary_caregiver_name || ''}
              onChange={handleChange('primary_caregiver_name')}
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              fullWidth size="small"
              label="Relationship"
              placeholder="e.g. Daughter, Spouse, Paid Attendant"
              value={form.primary_caregiver_relationship || ''}
              onChange={handleChange('primary_caregiver_relationship')}
              inputProps={{ maxLength: 50 }}
            />
            <TextField
              fullWidth size="small"
              label="Phone"
              placeholder="9876543210"
              value={form.primary_caregiver_phone || ''}
              onChange={handleChange('primary_caregiver_phone')}
              inputProps={{ maxLength: 20, inputMode: 'tel' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mr: -0.5 }}>+91</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Grid>

        {/* Vertical divider on md+ */}
        <Grid item xs={12} md={0} sx={{ display: { xs: 'block', md: 'none' } }}>
          <Divider />
        </Grid>

        {/* ── Decision Maker ── */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LocalHospital fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Decision Maker
            </Typography>
            {/* <Typography variant="caption" color="text.secondary">
              (doctor / clinical authority)
            </Typography> */}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              fullWidth size="small"
              label="Name"
              placeholder="e.g. Ashwini"
              value={form.decision_maker_name || ''}
              onChange={handleChange('decision_maker_name')}
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              fullWidth size="small"
              label="Relationship"
              placeholder="e.g. Guidance"
              value={form.decision_maker_designation || ''}
              onChange={handleChange('decision_maker_designation')}
              inputProps={{ maxLength: 50 }}
            />
            <TextField
              fullWidth size="small"
              label="Phone"
              placeholder="9876543210"
              value={form.decision_maker_phone || ''}
              onChange={handleChange('decision_maker_phone')}
              inputProps={{ maxLength: 20, inputMode: 'tel' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mr: -0.5 }}>+91</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={saving || !dirty}
          sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}
        >
          {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </Button>
      </Box>
    </Paper>
  );
}
