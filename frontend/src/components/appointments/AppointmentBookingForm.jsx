/**
 * AppointmentBookingForm Component
 * Multi-step wizard for booking appointments
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Combobox } from '../ui/combobox';
import { Alert } from '../ui/alert';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarIcon, Clock, User, Stethoscope, FileText, CheckCircle } from 'lucide-react';
import moment from 'moment';
import appointmentsApi from '../../api/appointments';
import providersApi from '../../api/providers';
import patientsApi from '../../api/patients';

const APPOINTMENT_TYPES = [
  { value: 'consultation', label: 'In-Person Consultation' },
  { value: 'teleconsultation', label: 'Teleconsultation' },
  { value: 'follow_up', label: 'Follow-up Visit' },
  { value: 'procedure', label: 'Procedure/Lab Test' },
  { value: 'emergency', label: 'Emergency' },
];

const DURATIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const AppointmentBookingForm = ({ open, onClose, onSuccess, preselectedSlot = null, preselectedProvider = null }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    patient_id: '',
    provider_id: preselectedProvider || '',
    appointment_type: 'consultation',
    date: preselectedSlot ? moment(preselectedSlot.start).format('YYYY-MM-DD') : '',
    time_slot: preselectedSlot ? moment(preselectedSlot.start).format('HH:mm:ss') : '',
    duration: 30,
    chief_complaint: '',
    notes: '',
  });

  // Dropdown data
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [providerWorksOnDate, setProviderWorksOnDate] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Load patients on mount
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await patientsApi.list({ limit: 100 });
        setPatients(response.patients || []);
      } catch (err) {
        console.error('Error fetching patients:', err);
      }
    };
    if (open) {
      fetchPatients();
    }
  }, [open]);

  // Load providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await providersApi.list({ limit: 100 });
        setProviders(response.providers || []);
      } catch (err) {
        console.error('Error fetching providers:', err);
      }
    };
    if (open) {
      fetchProviders();
    }
  }, [open]);

  // Load available slots when provider and date are selected
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!formData.provider_id || !formData.date) {
        setAvailableSlots([]);
        setProviderWorksOnDate(true);
        return;
      }

      try {
        setLoadingSlots(true);
        const response = await appointmentsApi.getAvailableSlots(
          formData.provider_id,
          formData.date,
          formData.duration
        );
        setAvailableSlots(response.slots || []);
        // Handle undefined case for backward compatibility
        if (response.provider_works_today !== undefined) {
          setProviderWorksOnDate(response.provider_works_today);
        } else {
          setProviderWorksOnDate(response.slots && response.slots.length > 0);
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
        setError('Failed to load available time slots');
      } finally {
        setLoadingSlots(false);
      }
    };

    if (step === 2) {
      fetchAvailableSlots();
    }
  }, [formData.provider_id, formData.date, formData.duration, step]);

  // Update form data when preselected slot or provider changes
  useEffect(() => {
    if (open) {
      if (preselectedSlot) {
        setFormData(prev => ({
          ...prev,
          date: moment(preselectedSlot.start).format('YYYY-MM-DD'),
          time_slot: moment(preselectedSlot.start).format('HH:mm:ss'),
        }));
      }
      if (preselectedProvider) {
        setFormData(prev => ({
          ...prev,
          provider_id: preselectedProvider,
        }));
      }
    }
  }, [open, preselectedSlot, preselectedProvider]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleNext = () => {
    // Validation for each step
    if (step === 1) {
      if (!formData.patient_id) {
        setError('Please select a patient');
        return;
      }
      if (!formData.provider_id) {
        setError('Please select a provider');
        return;
      }
      if (!formData.appointment_type) {
        setError('Please select an appointment type');
        return;
      }
    }

    if (step === 2) {
      if (!formData.date) {
        setError('Please select a date');
        return;
      }
      if (!formData.time_slot) {
        setError('Please select a time slot');
        return;
      }
    }

    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Combine date and time
      const startDateTime = moment(`${formData.date} ${formData.time_slot}`, 'YYYY-MM-DD HH:mm').toISOString();

      const bookingData = {
        patient_id: formData.patient_id,
        provider_id: formData.provider_id,
        appointment_type: formData.appointment_type,
        start_time: startDateTime,
        duration: formData.duration,
        chief_complaint: formData.chief_complaint || null,
        notes: formData.notes || null,
      };

      const response = await appointmentsApi.book(bookingData);

      setSuccess(true);

      // Show success for 2 seconds, then close
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(response.appointment);
        }
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Error booking appointment:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to book appointment. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFormData({
      patient_id: '',
      provider_id: preselectedProvider || '',
      appointment_type: 'consultation',
      date: '',
      time_slot: '',
      duration: 30,
      chief_complaint: '',
      notes: '',
    });
    setError(null);
    setSuccess(false);
    setAvailableSlots([]);
    setProviderWorksOnDate(true);
    onClose();
  };

  const selectedPatient = patients.find(p => p.id === formData.patient_id);
  const selectedProvider = providers.find(p => p.id === formData.provider_id);

  // Success state
  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 dark:text-green-400 mb-4" />
            <DialogTitle className="text-center text-2xl mb-2">
              Appointment Booked!
            </DialogTitle>
            <DialogDescription className="text-center">
              The appointment has been successfully scheduled.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book New Appointment</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 ? 'Patient & Provider' : step === 2 ? 'Date & Time' : 'Confirm Details'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}

        {/* Step 1: Patient, Provider, and Type Selection */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            {/* Patient Selection */}
            <div className="space-y-2">
              <Label htmlFor="patient">
                <User className="h-4 w-4 inline mr-2" />
                Patient *
              </Label>
              <Combobox
                value={formData.patient_id}
                onValueChange={(value) => handleInputChange('patient_id', value)}
                options={patients.map(patient => ({
                  value: patient.id,
                  label: patient.full_name,
                  sublabel: patient.medical_record_number,
                  searchValue: `${patient.full_name} ${patient.medical_record_number}`,
                }))}
                placeholder="Select a patient"
                searchPlaceholder="Search patients..."
                emptyText="No patients found."
              />
            </div>

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider">
                <Stethoscope className="h-4 w-4 inline mr-2" />
                Healthcare Provider *
              </Label>
              <Combobox
                value={formData.provider_id}
                onValueChange={(value) => handleInputChange('provider_id', value)}
                options={providers.map(provider => ({
                  value: provider.id,
                  label: provider.full_name,
                  sublabel: provider.specialization,
                  searchValue: `${provider.full_name} ${provider.specialization} ${provider.department || ''}`,
                }))}
                placeholder="Select a provider"
                searchPlaceholder="Search providers..."
                emptyText="No providers found."
              />
            </div>

            {/* Appointment Type */}
            <div className="space-y-2">
              <Label htmlFor="type">
                <FileText className="h-4 w-4 inline mr-2" />
                Appointment Type *
              </Label>
              <Select
                value={formData.appointment_type}
                onValueChange={(value) => handleInputChange('appointment_type', value)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">
                <Clock className="h-4 w-4 inline mr-2" />
                Duration *
              </Label>
              <Select
                value={formData.duration.toString()}
                onValueChange={(value) => handleInputChange('duration', parseInt(value))}
              >
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map(duration => (
                    <SelectItem key={duration.value} value={duration.value.toString()}>
                      {duration.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2: Date and Time Selection */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>
                <CalendarIcon className="h-4 w-4 inline mr-2" />
                Select Date *
              </Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                min={moment().format('YYYY-MM-DD')}
                className="w-full"
              />
            </div>

            {/* Time Slot Selection */}
            {formData.date && (
              <div className="space-y-2">
                <Label>
                  <Clock className="h-4 w-4 inline mr-2" />
                  Select Time Slot *
                </Label>
                {loadingSlots ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    Loading available time slots...
                  </div>
                ) : !providerWorksOnDate ? (
                  <Alert variant="warning" className="bg-amber-500/10 border-amber-500/20">
                    This provider does not have working hours scheduled for {moment(formData.date).format('MMMM D, YYYY')}. Please select a different date or provider.
                  </Alert>
                ) : availableSlots.filter(s => s.is_available).length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                    {availableSlots
                      .filter(slot => slot.is_available)
                      .map((slot, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant={formData.time_slot === slot.start_time ? "default" : "outline"}
                          className={`w-full justify-center ${formData.time_slot === slot.start_time ? "ring-2 ring-primary" : ""}`}
                          onClick={() => handleInputChange('time_slot', slot.start_time)}
                        >
                          {moment(slot.start_time, 'HH:mm:ss').format('h:mm A')}
                        </Button>
                      ))}
                  </div>
                ) : (
                  <Alert>
                    All time slots for this date are fully booked or have passed. Please select a different date.
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Additional Details and Confirmation */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            {/* Confirmation Summary */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Appointment Summary</h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <p><strong>Patient:</strong> {selectedPatient?.full_name}</p>
                <p><strong>Provider:</strong> {selectedProvider?.full_name} ({selectedProvider?.specialization})</p>
                <p><strong>Type:</strong> {APPOINTMENT_TYPES.find(t => t.value === formData.appointment_type)?.label}</p>
                <p><strong>Date:</strong> {moment(formData.date).format('MMMM D, YYYY')}</p>
                <p><strong>Time:</strong> {moment(formData.time_slot, 'HH:mm').format('h:mm A')}</p>
                <p><strong>Duration:</strong> {formData.duration} minutes</p>
              </div>
            </div>

            {/* Chief Complaint */}
            <div className="space-y-2">
              <Label htmlFor="complaint">Chief Complaint</Label>
              <Textarea
                id="complaint"
                placeholder="Enter the main reason for this visit..."
                value={formData.chief_complaint}
                onChange={(e) => handleInputChange('chief_complaint', e.target.value)}
                rows={3}
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information or special requests..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentBookingForm;
