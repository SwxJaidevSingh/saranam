/**
 * TeleconsultPage — main hub.
 *   1. Scheduled This Week (auto-refresh)
 *   2. Patient Directory (search + Voice/Video buttons)
 *   3. Recent Sessions (collapsible)
 */
import React, { useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import ScheduledThisWeekPanel from './components/ScheduledThisWeekPanel';
import PatientDirectory from './components/PatientDirectory';
import SessionHistoryPanel from './components/SessionHistoryPanel';
import OnDutyToggle from './components/OnDutyToggle';

const TeleconsultPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Teleconsult
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Voice and video consultations with patients
          </Typography>
        </Box>
        <OnDutyToggle />
      </Stack>

      <Stack spacing={3}>
        <ScheduledThisWeekPanel refreshKey={refreshKey} onChange={refresh} />
        <PatientDirectory />
        <SessionHistoryPanel />
      </Stack>
    </Box>
  );
};

export default TeleconsultPage;
