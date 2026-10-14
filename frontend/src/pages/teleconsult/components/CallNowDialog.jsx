/**
 * CallNowDialog — ad-hoc voice/video call: pick provider, optional record + notes.
 * Submits to teleconsultApi.initiateNow and (for video) navigates to the call room.
 */
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Switch, FormControlLabel, Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ProviderSelect from './ProviderSelect';
import VoiceCallStatus from './VoiceCallStatus';
import teleconsultApi from '../../../api/teleconsult';

const CallNowDialog = ({ open, onClose, patient, channel = 'video', onStarted }) => {
  const navigate = useNavigate();
  const [providerId, setProviderId] = useState(null);
  const [recordCall, setRecordCall] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [voiceSessionId, setVoiceSessionId] = useState(null);

  const reset = () => {
    setProviderId(null);
    setRecordCall(false);
    setNotes('');
    setError(null);
    setSubmitting(false);
    setVoiceSessionId(null);
  };

  const handleClose = () => { reset(); onClose(); };
  const handleVoiceClose = () => { setVoiceSessionId(null); handleClose(); };

  const handleStart = async () => {
    if (!providerId) {
      setError('Please pick a provider.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await teleconsultApi.initiateNow({
        patient_id: patient.id,
        provider_id: providerId,
        channel,
        record_call: channel === 'video' ? recordCall : false,
        notes: notes || null,
      });
      onStarted?.(session);
      if (channel === 'video') {
        reset();
        onClose();
        navigate(`/teleconsult/sessions/${session.id}`);
      } else {
        // Voice — keep dialog state, swap to status modal
        setVoiceSessionId(session.id);
        setSubmitting(false);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      setSubmitting(false);
    }
  };

  const channelLabel = channel === 'video' ? 'Video Call' : 'Voice Call';

  // Voice path: form is hidden, status modal takes over
  if (voiceSessionId) {
    return (
      <VoiceCallStatus
        open
        sessionId={voiceSessionId}
        patient={patient}
        onClose={handleVoiceClose}
      />
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Start {channelLabel}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {patient && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Patient: <strong>{patient.full_name || patient.name}</strong>
              {patient.uhid ? ` · UHID ${patient.uhid}` : ''}
            </Alert>
          )}

          <ProviderSelect value={providerId} onChange={setProviderId} required />

          {channel === 'video' && (
            <FormControlLabel
              control={<Switch checked={recordCall} onChange={(e) => setRecordCall(e.target.checked)} />}
              label="Record this call"
            />
          )}

          <TextField
            label="Notes (optional)"
            multiline
            rows={2}
            size="small"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={submitting || !providerId}
          sx={{ textTransform: 'none' }}
        >
          {submitting ? 'Starting...' : `Start ${channelLabel}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallNowDialog;
