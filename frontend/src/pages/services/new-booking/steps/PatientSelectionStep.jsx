import React, { useEffect } from 'react';
import { useServiceBooking } from '../ServiceBookingContext';
import { usePatient } from '@/context/PatientContext';
import PatientSelector from '@/components/patients/PatientSelector';
import { Alert, Button } from '@mui/material';
import { PersonRemove } from '@mui/icons-material';

const PatientSelectionStep = () => {
  const { updateBookingData, bookingData } = useServiceBooking();
  const { selectedPatient, clearSelectedPatient } = usePatient();

  // Update booking data when patient is selected
  useEffect(() => {
    if (selectedPatient) {
      updateBookingData('patient', selectedPatient);
    }
  }, [selectedPatient, updateBookingData]);

  const handlePatientChange = (patient) => {
    updateBookingData('patient', patient);
  };

  const handleDiscardPatient = () => {
    clearSelectedPatient();
    updateBookingData('patient', null);
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Alert severity="info">
          Select an existing patient or create a new one to proceed with the service booking.
        </Alert>
      </div>

      <PatientSelector
        value={bookingData.patient}
        onChange={handlePatientChange}
        required={true}
        showRecent={true}
        allowCreate={true}
      />

      {bookingData.patient && (
        <div className="mt-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center">
              <p className="text-sm text-green-700">
                Patient Selected: <strong>{bookingData.patient.full_name}</strong>
              </p>
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<PersonRemove />}
                onClick={handleDiscardPatient}
                sx={{
                  borderColor: '#ef4444',
                  color: '#ef4444',
                  '&:hover': {
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(239, 68, 68, 0.04)'
                  }
                }}
              >
                Discard Selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientSelectionStep;