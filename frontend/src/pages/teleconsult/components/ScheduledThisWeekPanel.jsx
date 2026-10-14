/**
 * ScheduledThisWeekPanel — top section of the Teleconsult page.
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Button, Stack, IconButton, CircularProgress,
} from '@mui/material';
import {
  Videocam, Phone, CalendarToday, AccessTime, Person, Refresh,
  CallReceived, CallMade, Cancel,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import teleconsultApi from '../../../api/teleconsult';
import SessionStatusBadge from './SessionStatusBadge';

const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const ScheduledThisWeekPanel = ({ refreshKey, onChange }) => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await teleconsultApi.thisWeek();
      setSessions(list);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const handleCancel = async (sessionId) => {
    if (!window.confirm('Cancel this teleconsult? The patient and provider will be notified.')) return;
    setCancelling(sessionId);
    try {
      await teleconsultApi.cancelSession(sessionId, 'Cancelled from Teleconsult page');
      await load();
      onChange?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setCancelling(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          This Week ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
        </Typography>
        <IconButton size="small" onClick={load} disabled={loading}>
          <Refresh fontSize="small" />
        </IconButton>
      </Stack>

      {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>}

      {!loading && error && (
        <Typography color="error" variant="body2">{error}</Typography>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Box sx={{
          py: 3, textAlign: 'center', border: '1px dashed',
          borderColor: 'divider', borderRadius: 2,
        }}>
          <Typography color="text.secondary" variant="body2">
            No teleconsults scheduled this week.
          </Typography>
        </Box>
      )}

      <Stack spacing={1}>
        {sessions.map(s => {
          const Icon = s.channel === 'video' ? Videocam : Phone;
          const DirIcon = s.direction === 'inbound' ? CallReceived : CallMade;
          const isLive = !['completed', 'cancelled', 'failed', 'missed'].includes(s.status);
          return (
            <Paper
              key={s.id}
              variant="outlined"
              sx={{
                p: 1.5, borderRadius: 2,
                display: 'flex', alignItems: 'center', gap: 1.5,
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <Box sx={{
                width: 36, height: 36, borderRadius: 1.5,
                bgcolor: s.channel === 'video' ? 'primary.light' : 'success.light',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon fontSize="small" sx={{ color: 'white' }} />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <DirIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {(s.direction || 'outbound').toUpperCase()} · {formatWhen(s.scheduled_at)}
                  </Typography>
                  <SessionStatusBadge status={s.status} />
                </Stack>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                  Patient {s.patient_id?.slice(0, 8)}…
                  {s.provider_id && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      · with provider {s.provider_id.slice(0, 8)}…
                    </Typography>
                  )}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                {s.channel === 'video' && isLive && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => navigate(`/teleconsult/sessions/${s.id}`)}
                    sx={{ textTransform: 'none' }}
                  >
                    Join
                  </Button>
                )}
                {isLive && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Cancel sx={{ fontSize: 16 }} />}
                    onClick={() => handleCancel(s.id)}
                    disabled={cancelling === s.id}
                    sx={{ textTransform: 'none' }}
                  >
                    {cancelling === s.id ? '…' : 'Cancel'}
                  </Button>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Paper>
  );
};

export default ScheduledThisWeekPanel;
