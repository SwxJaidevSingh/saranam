import React from 'react';
import { Chip } from '@mui/material';

const COLORS = {
  scheduled: 'info',
  ringing: 'warning',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'default',
  failed: 'error',
  missed: 'error',
};

const LABELS = {
  scheduled: 'Scheduled',
  ringing: 'Ringing',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
  missed: 'Missed',
};

const SessionStatusBadge = ({ status }) => (
  <Chip
    size="small"
    label={LABELS[status] || status}
    color={COLORS[status] || 'default'}
    sx={{ fontWeight: 600, fontSize: '0.7rem' }}
  />
);

export default SessionStatusBadge;
