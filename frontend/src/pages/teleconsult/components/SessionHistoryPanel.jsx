/**
 * SessionHistoryPanel — collapsible list of recent completed/cancelled sessions.
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Stack, CircularProgress, Accordion,
  AccordionSummary, AccordionDetails, Chip,
} from '@mui/material';
import { ExpandMore, Videocam, Phone } from '@mui/icons-material';
import teleconsultApi from '../../../api/teleconsult';
import SessionStatusBadge from './SessionStatusBadge';

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const fmtDuration = (s) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
};

const SessionHistoryPanel = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await teleconsultApi.listSessions({ status: 'completed', limit: 20 });
        setSessions(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Accordion variant="outlined" sx={{ borderRadius: 2 }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Recent Sessions ({sessions.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} /></Box>
        ) : sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No completed sessions yet.</Typography>
        ) : (
          <Stack spacing={1}>
            {sessions.map(s => {
              const Icon = s.channel === 'video' ? Videocam : Phone;
              return (
                <Paper key={s.id} variant="outlined" sx={{
                  p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                }}>
                  <Icon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatDate(s.ended_at || s.scheduled_at)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Patient {s.patient_id?.slice(0, 8)}… · {fmtDuration(s.duration_seconds)}
                    </Typography>
                  </Box>
                  <SessionStatusBadge status={s.status} />
                  {s.recording_url && (
                    <Chip
                      label="Recording"
                      component="a"
                      href={s.recording_url}
                      target="_blank"
                      clickable
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Paper>
              );
            })}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default SessionHistoryPanel;
