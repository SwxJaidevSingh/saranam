/**
 * VoiceCallStatus — modal shown after a voice call is initiated.
 *
 * Both the doctor's mobile and the patient's mobile ring on their actual
 * phones (EnableX bridges the two legs). This modal shows the live call
 * lifecycle (ringing → connected → ended) by polling the session every 3s.
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Stack, Chip, Alert,
} from '@mui/material';
import { CallEnd, Phone } from '@mui/icons-material';
import teleconsultApi from '../../../api/teleconsult';
import SessionStatusBadge from './SessionStatusBadge';

const STATUS_LABEL = {
  scheduled: 'Connecting…',
  ringing: 'Ringing both lines…',
  in_progress: 'Connected',
  completed: 'Call ended',
  failed: 'Call failed',
  cancelled: 'Cancelled',
  missed: 'Missed',
};

const isTerminal = (status) =>
  ['completed', 'failed', 'cancelled', 'missed'].includes(status);

const formatDuration = (s) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
};

const VoiceCallStatus = ({ open, onClose, sessionId, patient }) => {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) return undefined;
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      try {
        const data = await teleconsultApi.getSession(sessionId);
        if (cancelled) return;
        setSession(data);
        if (!isTerminal(data.status)) {
          timer = setTimeout(tick, 3000);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.error || e.message);
          timer = setTimeout(tick, 5000);
        }
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [open, sessionId]);

  const handleEnd = async () => {
    setEnding(true);
    try {
      await teleconsultApi.endSession(sessionId);
      // The next poll will see status=completed and stop polling.
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setEnding(false);
    }
  };

  const status = session?.status || 'scheduled';
  const terminal = isTerminal(status);

  return (
    <Dialog open={open} onClose={terminal ? onClose : undefined} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Phone fontSize="small" /> Voice Call
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1, alignItems: 'center', textAlign: 'center' }}>
          {patient && (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {patient.full_name || patient.name}
            </Typography>
          )}

          <Box sx={{
            width: 80, height: 80, borderRadius: '50%',
            bgcolor: terminal ? 'grey.300' : 'success.light',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: terminal ? 'text.secondary' : 'success.dark',
          }}>
            {!terminal && status !== 'in_progress'
              ? <CircularProgress size={36} sx={{ color: 'inherit' }} />
              : <Phone sx={{ fontSize: 36 }} />}
          </Box>

          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {STATUS_LABEL[status] || status}
          </Typography>
          <SessionStatusBadge status={status} />

          {session?.duration_seconds != null && (
            <Typography variant="caption" color="text.secondary">
              Duration: {formatDuration(session.duration_seconds)}
            </Typography>
          )}

          {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}

          {!terminal && status !== 'scheduled' && (
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280 }}>
              Both your mobile and the patient's mobile will ring. Pick up
              your phone to be bridged into the call.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        {terminal ? (
          <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', ml: 'auto' }}>
            Close
          </Button>
        ) : (
          <Button
            onClick={handleEnd}
            variant="contained"
            color="error"
            startIcon={<CallEnd />}
            disabled={ending}
            sx={{ textTransform: 'none' }}
          >
            {ending ? 'Ending…' : 'End call'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VoiceCallStatus;
