/**
 * PatientSelector Component
 * Main UI for selecting or creating a patient
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Divider,
  Grid,
  Alert
} from '@mui/material';
import { Add, Person } from '@mui/icons-material';
import { usePatient } from '../../context/PatientContext';
import PatientSearch from './PatientSearch';
import PatientQuickAdd from './PatientQuickAdd';
import PatientCard from './PatientCard';

const PatientSelector = ({
  value,
  onChange,
  required = false,
  showRecent = true,
  allowCreate = true
}) => {
  const { selectedPatient, selectPatient, clearSelectedPatient, recentPatients, loadRecentPatients } = usePatient();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Load recent patients on mount
  useEffect(() => {
    if (showRecent) {
      loadRecentPatients(5);
    }
  }, [showRecent, loadRecentPatients]);

  // Sync with external value prop
  useEffect(() => {
    if (value && value !== selectedPatient) {
      selectPatient(value);
    }
  }, [value]);

  const handleSelect = (patient) => {
    selectPatient(patient);
    if (onChange) {
      onChange(patient);
    }
  };

  const handleClear = () => {
    clearSelectedPatient();
    if (onChange) {
      onChange(null);
    }
  };

  const handleQuickAddSuccess = (patient) => {
    handleSelect(patient);
    setShowQuickAdd(false);
  };

  // If patient is already selected, show selected state
  if (selectedPatient) {
    return (
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2" color="primary">
            <Person sx={{ verticalAlign: 'middle', mr: 1 }} />
            Selected Patient
          </Typography>
          {!required && (
            <Button size="small" onClick={handleClear}>
              Change Patient
            </Button>
          )}
        </Box>
        <PatientCard
          patient={selectedPatient}
          variant="compact"
          showActions={!required}
          onRemove={handleClear}
        />
      </Paper>
    );
  }

  // Patient selection UI
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {required ? 'Select Patient *' : 'Select Patient (Optional)'}
      </Typography>

      {/* Search */}
      <Box mb={3}>
        <PatientSearch
          onSelect={handleSelect}
          autoFocus={false}
        />
      </Box>

      {/* Create New Patient Button */}
      {allowCreate && (
        <Box mb={3}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setShowQuickAdd(true)}
          >
            Register New Patient
          </Button>
        </Box>
      )}

      {/* Recent Patients */}
      {showRecent && recentPatients.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Recently Accessed
          </Typography>
          <Grid container spacing={1}>
            {recentPatients.slice(0, 5).map((patient) => (
              <Grid item xs={12} key={patient.id}>
                <PatientCard
                  patient={patient}
                  variant="compact"
                  onClick={() => handleSelect(patient)}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {required && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Please select or create a patient to continue
        </Alert>
      )}

      {/* Quick Add Dialog */}
      <PatientQuickAdd
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAddSuccess}
      />
    </Paper>
  );
};

export default PatientSelector;
