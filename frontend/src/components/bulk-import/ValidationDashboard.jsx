import React from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';

const ValidationDashboard = ({ statistics, validationResults, onValidate, onNext, onBack }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>Validation Dashboard</Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography>Total: {statistics?.total || 0}</Typography>
        <Typography>Valid: {statistics?.valid || 0}</Typography>
        <Typography color="error">Invalid: {statistics?.invalid || 0}</Typography>
        <Typography color="warning.main">Conflicts: {statistics?.conflicts || 0}</Typography>
        <Typography color="info.main">Services Mapped: {validationResults?.validation_summary?.service_statistics?.services_matched || 0}</Typography>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button onClick={onBack}>Back</Button>
        <Button onClick={onValidate} variant="outlined">Run Validation</Button>
        <Button onClick={onNext} variant="contained" disabled={!validationResults}>Next: Conflicts</Button>
      </Box>
    </Box>
  );
};

export default ValidationDashboard;
