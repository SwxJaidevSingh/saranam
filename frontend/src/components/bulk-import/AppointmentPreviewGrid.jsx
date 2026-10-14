import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Box, Button } from '@mui/material';
import { useTheme } from '../../context/ThemeContext';

const AppointmentPreviewGrid = ({ data, onNext, onBack }) => {
  const { isDark } = useTheme();
  const columnDefs = useMemo(() => [
    { field: 'patient_name', headerName: 'Patient' },
    { field: 'phone_number', headerName: 'Phone' },
    { field: 'date', headerName: 'Date' },
    { field: 'time', headerName: 'Time' },
    { field: 'provider_name', headerName: 'Provider' },
    { field: 'appointment_type', headerName: 'Type' },
    { field: 'service_type', headerName: 'Service Type' },
  ], []);

  const rowData = useMemo(() => data?.map(d => d.extracted_data) || [], [data]);

  return (
    <Box sx={{ height: 400, width: '100%', mb: 4 }}>
      <div className={isDark ? "ag-theme-alpine-dark" : "ag-theme-alpine"} style={{ height: '100%', width: '100%' }}>
        <AgGridReact rowData={rowData} columnDefs={columnDefs} />
      </div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button onClick={onBack}>Back</Button>
        <Button onClick={onNext} variant="contained">Next: Validate</Button>
      </Box>
    </Box>
  );
};

export default AppointmentPreviewGrid;
