/**
 * MarkDeceasedDialog — captures Date of Death + Place of Death + Remarks.
 *
 * Meeting §3.2 (2026-04-14). Reused from:
 *  - Patient detail header "Mark as Deceased" button
 *  - VisitDetailView "Patient has passed away" follow-up section
 *  - PatientEdit admin corrections
 *
 * On save, PATCHes the patient record. The backend (patients.services
 * update_patient) auto-demotes care_status='inactive' when is_deceased=true,
 * so the patient is dropped from the scheduling pool immediately.
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, MenuItem, Button,
  CircularProgress, Alert, IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { usePatient } from '../../context/PatientContext';

const PLACE_OPTIONS = [
  { value: 'home',       label: 'Home' },
  { value: 'hospital',   label: 'Hospital' },
  { value: 'on_the_way', label: 'On the way to hospital' },
  { value: 'others',     label: 'Others' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MarkDeceasedDialog({ patient, open, onClose, onSaved }) {
  const { updatePatient } = usePatient();
  const [dateOfDeath, setDateOfDeath] = useState(todayIso());
  const [placeOfDeath, setPlaceOfDeath] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Reset / hydrate whenever the dialog opens. If the patient is already
  // deceased we're in "edit" mode — pre-fill with current values.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setDateOfDeath(patient?.date_of_death || todayIso());
    setPlaceOfDeath(patient?.place_of_death || '');
    setRemarks(patient?.place_of_death_remarks || '');
  }, [open, patient?.id]);

  const isEdit = !!patient?.is_deceased;
  const isOthers = placeOfDeath === 'others';

  const handleSave = async () => {
    if (!dateOfDeath) {
      setError('Date of death is required');
      return;
    }
    if (isOthers && !remarks.trim()) {
      setError('Please describe the place of death in Remarks');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePatient(patient.id, {
        is_deceased: true,
        date_of_death: dateOfDeath,
        place_of_death: placeOfDeath || null,
        place_of_death_remarks: isOthers ? remarks.trim() : null,
      });
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save death record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isEdit ? 'Edit Death Record' : 'Mark as Deceased'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {patient?.full_name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={saving}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth size="small"
            type="date"
            label="Date of Death"
            value={dateOfDeath}
            onChange={(e) => setDateOfDeath(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: todayIso() }}
            required
          />
          <TextField
            fullWidth size="small"
            select
            label="Place of Death"
            value={placeOfDeath}
            onChange={(e) => setPlaceOfDeath(e.target.value)}
          >
            <MenuItem value=""><em>Not specified</em></MenuItem>
            {PLACE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
          {isOthers && (
            <TextField
              fullWidth size="small"
              multiline
              minRows={2}
              label="Remarks"
              placeholder="Describe the place of death"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              required
            />
          )}
          <Alert severity="info" sx={{ borderRadius: 1 }}>
            Saving will mark the patient as <strong>Deceased</strong> and remove
            them from the scheduling pool. The death record can be edited or
            reverted later by an admin.
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSave}
          disabled={saving || !dateOfDeath}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}
        >
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Confirm Death'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
