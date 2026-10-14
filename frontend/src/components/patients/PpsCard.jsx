/**
 * PpsCard — Universal PPS (Palliative Performance Scale) entry + display.
 *
 * Meeting §2.1 (2026-04-14) made PPS a patient-level concept: updates from
 * anywhere (this card, the initial assessment accordion, any future follow-up
 * form) flow through the same priority-sync hook on the backend. The card
 * shows the patient's current PPS and the derived priority bucket.
 *
 * Writes here go through POST /patients/:id/pps (visit_id=NULL — standalone).
 */
import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, CircularProgress, TextField, IconButton,
} from '@mui/material';
import { Close, Edit, TrendingDown, TrendingFlat, TrendingUp, Info } from '@mui/icons-material';
import patientsApi from '../../api/patients';
import { defaultPpsForPriority } from '../../utils/ppsPriorityMap';

const PPS_TABLE = [
  { score: 100, ambulation: 'Full',           activity: 'Normal, No Disease',                 selfCare: 'Full',                    intake: 'Normal',            consciousness: 'Full' },
  { score: 90,  ambulation: 'Full',           activity: 'Normal, Some Disease',               selfCare: 'Full',                    intake: 'Normal',            consciousness: 'Full' },
  { score: 80,  ambulation: 'Full',           activity: 'Normal with Effort, Some Disease',   selfCare: 'Full',                    intake: 'Normal or Reduced', consciousness: 'Full' },
  { score: 70,  ambulation: 'Reduced',        activity: "Can't do normal job/work",           selfCare: 'Full',                    intake: 'Normal or Reduced', consciousness: 'Full' },
  { score: 60,  ambulation: 'Reduced',        activity: "Can't do hobbies/housework",         selfCare: 'Occasional Assistance',   intake: 'Normal or Reduced', consciousness: 'Full or Confusion' },
  { score: 50,  ambulation: 'Mainly Sit/Lie', activity: "Can't do any work",                  selfCare: 'Considerable Assistance', intake: 'Normal or Reduced', consciousness: 'Full or Confusion' },
  { score: 40,  ambulation: 'Mainly in Bed',  activity: 'As above',                           selfCare: 'Mainly Assistance',       intake: 'Normal or Reduced', consciousness: 'Full or Drowsy/Confusion' },
  { score: 30,  ambulation: 'Bed Bound',      activity: 'As above',                           selfCare: 'Total Care',              intake: 'Reduced',           consciousness: 'Full or Drowsy/Confusion' },
  { score: 20,  ambulation: 'Bed Bound',      activity: 'As above',                           selfCare: 'As above',                intake: 'Minimal',           consciousness: 'As above' },
  { score: 10,  ambulation: 'Bed Bound',      activity: 'As above',                           selfCare: 'As above',                intake: 'Mouth Care Only',   consciousness: 'Drowsy or Coma' },
  { score: 0,   ambulation: 'Death',          activity: '—',                                  selfCare: '—',                       intake: '—',                 consciousness: '—' },
];

function derivePriorityLabel(score) {
  if (score === null || score === undefined) return { label: 'Not Yet Determined', color: 'default' };
  if (score <= 40) return { label: 'High', color: 'error' };
  if (score <= 70) return { label: 'Medium', color: 'warning' };
  return { label: 'Low', color: 'success' };
}

function priorityColorForChip(bucket) {
  if (bucket === 'high') return 'error';
  if (bucket === 'medium') return 'warning';
  if (bucket === 'low') return 'success';
  return 'default';
}

function rowBg(score, isSelected) {
  const base = score >= 70 ? 'success.50' : score >= 40 ? 'warning.50' : 'error.50';
  if (isSelected) return base;
  return 'transparent';
}

export default function PpsCard({ patient, onSaved }) {
  const [open, setOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const currentScore = patient?.latest_pps_score ?? null;
  const currentBucket = patient?.clinical_complexity || null;
  const derived = derivePriorityLabel(currentScore);

  const openDialog = () => {
    // Priority-based default: if no PPS saved yet but the patient has a
    // priority set, pre-select the top of that priority band (high→40,
    // medium→70, low→100). User can still pick any row.
    const initial = currentScore ?? defaultPpsForPriority(currentBucket);
    setSelectedScore(initial);
    setNotes('');
    setOpen(true);
  };

  const usedPriorityDefault = currentScore === null
    && selectedScore !== null
    && defaultPpsForPriority(currentBucket) === selectedScore;

  const closeDialog = () => {
    if (saving) return;
    setOpen(false);
  };

  const handleSave = async () => {
    if (selectedScore === null || selectedScore === undefined) {
      alert('Please select a PPS score');
      return;
    }
    setSaving(true);
    try {
      const row = PPS_TABLE.find(r => r.score === selectedScore);
      await patientsApi.recordPatientPps(patient.id, {
        pps_score: selectedScore,
        ambulation: row?.ambulation || '',
        activity_level: row?.activity || '',
        self_care: row?.selfCare || '',
        intake: row?.intake || '',
        consciousness_level: row?.consciousness || '',
        notes: notes || null,
      });
      setOpen(false);
      if (onSaved) await onSaved();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to record PPS');
    } finally {
      setSaving(false);
    }
  };

  const trendIcon = currentScore === null ? <TrendingFlat fontSize="small" /> :
    currentScore <= 40 ? <TrendingDown fontSize="small" color="error" /> :
    currentScore >= 80 ? <TrendingUp fontSize="small" color="success" /> :
    <TrendingFlat fontSize="small" color="warning" />;

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            PPS (Palliative Performance Scale)
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<Edit fontSize="small" />}
            onClick={openDialog}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {currentScore === null ? 'Record PPS' : 'Update PPS'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Patient-level score. Drives scheduling priority. Updates from here, the
          Initial Assessment, or any follow-up flow reflect everywhere.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
              Current PPS
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: currentScore === null ? 'text.disabled' : 'primary.main', fontFamily: 'monospace' }}>
                {currentScore === null ? '—' : `${currentScore}%`}
              </Typography>
              {trendIcon}
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
              Derived Priority
            </Typography>
            <Chip
              label={derived.label}
              color={derived.color}
              size="medium"
              sx={{ fontWeight: 700, mt: 0.5 }}
            />
          </Box>
          {currentScore !== null && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                Mapping
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontFamily: 'monospace', mt: 0.5 }}>
                0-40 High &nbsp;|&nbsp; 50-70 Medium &nbsp;|&nbsp; 80-100 Low
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Update dialog — reuses the canonical PPS clickable table */}
      <Dialog open={open} onClose={closeDialog} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Record PPS for {patient?.full_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click a row to choose a PPS score. Priority will be derived automatically.
            </Typography>
          </Box>
          <IconButton onClick={closeDialog} disabled={saving}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedScore !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                PPS {selectedScore}%
              </Typography>
              <Chip
                label={`Priority: ${derivePriorityLabel(selectedScore).label}`}
                color={derivePriorityLabel(selectedScore).color}
                size="small"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          )}
          {usedPriorityDefault && (
            <Box sx={{
              display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2,
              p: 1.5, borderRadius: 1,
              bgcolor: 'info.50', border: 1, borderColor: 'info.main',
            }}>
              <Info fontSize="small" sx={{ color: 'info.main', mt: 0.25 }} />
              <Typography variant="caption" sx={{ color: 'info.main' }}>
                Pre-selected <strong>PPS {selectedScore}%</strong> based on the patient's
                priority ({currentBucket}). Click any row below to adjust, or save to confirm.
              </Typography>
            </Box>
          )}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 2fr 1.5fr 1.5fr 1.5fr', bgcolor: 'action.hover', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>%</Box>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>Ambulation</Box>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>Activity Level</Box>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>Self-Care</Box>
              <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>Intake</Box>
              <Box sx={{ p: 1 }}>Consciousness</Box>
            </Box>
            {/* Rows */}
            {PPS_TABLE.map(row => {
              const selected = selectedScore === row.score;
              return (
                <Box
                  key={row.score}
                  onClick={() => setSelectedScore(row.score)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 2fr 1.5fr 1.5fr 1.5fr',
                    cursor: 'pointer',
                    borderTop: 1,
                    borderColor: 'divider',
                    bgcolor: rowBg(row.score, selected),
                    borderLeft: selected ? 4 : 0,
                    borderLeftColor: row.score >= 70 ? 'success.main' : row.score >= 40 ? 'warning.main' : 'error.main',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: row.score >= 70 ? 'success.50' : row.score >= 40 ? 'warning.50' : 'error.50' },
                    fontSize: '0.8rem',
                  }}
                >
                  <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider', fontWeight: 700 }}>{row.score}</Box>
                  <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>{row.ambulation}</Box>
                  <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>{row.activity}</Box>
                  <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>{row.selfCare}</Box>
                  <Box sx={{ p: 1, borderRight: 1, borderColor: 'divider' }}>{row.intake}</Box>
                  <Box sx={{ p: 1 }}>{row.consciousness}</Box>
                </Box>
              );
            })}
          </Box>

          <TextField
            fullWidth multiline rows={2} size="small"
            label="Notes (optional)"
            placeholder="Context for this PPS entry..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSave}
            disabled={saving || selectedScore === null}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}
          >
            {saving ? 'Saving...' : 'Save PPS'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
