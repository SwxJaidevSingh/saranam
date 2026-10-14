import React, { useState } from 'react';
import { Container, Stepper, Step, StepLabel, Button, Typography, Box } from '@mui/material';
import { useBulkImport } from '../../hooks/useBulkImport';
import FileUploader from '../../components/bulk-import/FileUploader';
import AppointmentPreviewGrid from '../../components/bulk-import/AppointmentPreviewGrid';
import ValidationDashboard from '../../components/bulk-import/ValidationDashboard';
import ConflictResolver from '../../components/bulk-import/ConflictResolver';
import ImportResults from '../../components/bulk-import/ImportResults';

const STEPS = ['Upload', 'Preview', 'Validate', 'Resolve Conflicts', 'Create', 'Results'];

const BulkAppointmentImport = () => {
  const [activeStep, setActiveStep] = useState(0);
  const {
    loading,
    error,
    currentSession,
    extractedData,
    validationResults,
    conflictSuggestions,
    creationResults,
    uploadFile,
    validateAppointments,
    resolveConflicts,
    createAppointments,
    exportResults,
    statistics
  } = useBulkImport();

  const handleFileUpload = async (file, llmProvider, apiKey, modelName) => {
    await uploadFile(file, llmProvider, apiKey, modelName);
    if (!error) setActiveStep(1);
  };

  const handleNext = () => {
    setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Bulk Appointment Import</Typography>
      
      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step content */}
      {activeStep === 0 && (
        <FileUploader onUpload={handleFileUpload} loading={loading} />
      )}

      {activeStep === 1 && (
        <AppointmentPreviewGrid
          data={extractedData}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}

      {activeStep === 2 && (
        <ValidationDashboard
          statistics={statistics}
          validationResults={validationResults}
          onValidate={() => validateAppointments(currentSession)}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}

      {activeStep === 3 && (
        <ConflictResolver
          suggestions={conflictSuggestions}
          onResolve={() => resolveConflicts(currentSession, true)}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}

      {activeStep === 4 && (
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Button variant="contained" color="primary" onClick={async () => {
            await createAppointments(currentSession);
            handleNext();
          }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Appointments'}
          </Button>
          <Button onClick={handleBack} sx={{ ml: 2 }} disabled={loading}>Back</Button>
        </Box>
      )}

      {activeStep === 5 && (
        <ImportResults
          results={creationResults}
          onExport={() => exportResults(currentSession)}
        />
      )}
    </Container>
  );
};

export default BulkAppointmentImport;
