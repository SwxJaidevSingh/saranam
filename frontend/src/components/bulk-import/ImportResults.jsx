import React from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';

const ImportResults = ({ results, onExport }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>Import Results</Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography color="success.main">Created: {results?.statistics?.created || 0}</Typography>
        <Typography color="error">Failed: {results?.statistics?.failed || 0}</Typography>
        <Typography color="info.main">New Patients Created: {results?.statistics?.patients_created || 0}</Typography>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button onClick={onExport} variant="contained" color="primary">Export Results CSV</Button>
      </Box>
    </Box>
  );
};

export default ImportResults;
