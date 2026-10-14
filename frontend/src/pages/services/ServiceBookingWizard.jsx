/**
 * ServiceBookingWizard Component
 * Multi-step wizard for booking healthcare services
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  IndianRupee,
  Building,
  Activity,
  House,
  MapPin,
  Phone
} from 'lucide-react';
import { servicesApi } from '../../api/services';
import { providersApi } from '../../api/providers';
import { appointmentsApi } from '../../api/appointments';
import { formsApi } from '../../api/forms';
import { usePatient } from '../../context/PatientContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import PatientSelector from '../../components/patients/PatientSelector';

const ServiceBookingWizard = () => {
  const { type } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedPatient, selectPatient } = usePatient();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Initialize state from navigation state
  const initialService = location.state?.service;
  const initialPatient = location.state?.patient || selectedPatient;

  // Wizard steps
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Step 1: Patient Selection
  const [patient, setPatient] = useState(initialPatient);

  // Step 2: Service Selection
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(initialService);
  const [loadingServices, setLoadingServices] = useState(!initialService);

  // Step 3: Provider Selection
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Step 4: Date & Time Selection
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 5: Service Form & Details
  const [serviceForms, setServiceForms] = useState([]);
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

  const steps = [
    { number: 1, title: 'Patient', icon: User },
    { number: 2, title: 'Service', icon: Activity },
    { number: 3, title: 'Provider', icon: Stethoscope },
    { number: 4, title: 'Schedule', icon: Calendar },
    { number: 5, title: 'Details', icon: FileText },
    { number: 6, title: 'Confirmation', icon: CheckCircle }
  ];

  useEffect(() => {
    // Skip patient step if already selected
    if (initialPatient && currentStep === 1) {
      handlePatientSelect(initialPatient);
    }

    // Load services if not pre-selected
    if (!initialService && currentStep === 2) {
      loadServices();
    }
  }, []);

  useEffect(() => {
    if (selectedService && currentStep === 3) {
      loadProviders();
    }
  }, [selectedService, currentStep]);

  useEffect(() => {
    if (selectedProvider && selectedDate && currentStep === 4) {
      loadAvailableSlots();
    }
  }, [selectedProvider, selectedDate, currentStep]);

  useEffect(() => {
    if (selectedService && currentStep === 5) {
      loadServiceForms();
    }
  }, [selectedService, currentStep]);

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const serviceType = type?.toUpperCase().replace('-', '_');
      const response = await servicesApi.getByType(serviceType);
      setServices(response.services || []);
    } catch (error) {
      console.error('Error loading services:', error);
      showToast('Failed to load services', 'error');
    } finally {
      setLoadingServices(false);
    }
  };

  const loadProviders = async () => {
    try {
      setLoadingProviders(true);
      // Get providers assigned to this service
      const response = await servicesApi.getProviders(selectedService.id);

      // If no specific providers, get all providers
      if (response.providers && response.providers.length > 0) {
        setProviders(response.providers);
      } else {
        // Fallback to all providers
        const allProviders = await providersApi.search({ is_active: true });
        setProviders(allProviders.providers || []);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
      showToast('Failed to load providers', 'error');
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      const response = await servicesApi.getAvailability(
        selectedService.id,
        selectedDate,
        selectedService.default_duration_minutes
      );
      setAvailableSlots(response.slots || []);
    } catch (error) {
      console.error('Error loading slots:', error);
      // Fallback to appointment slots
      try {
        const appointmentSlots = await appointmentsApi.getAvailableSlots(
          selectedProvider.provider_id || selectedProvider.id,
          selectedDate,
          selectedService.default_duration_minutes || 30
        );
        setAvailableSlots(appointmentSlots.slots || []);
      } catch (fallbackError) {
        showToast('Failed to load available time slots', 'error');
      }
    } finally {
      setLoadingSlots(false);
    }
  };

  const loadServiceForms = async () => {
    try {
      const response = await servicesApi.getForms(selectedService.id, 'INITIAL');
      setServiceForms(response.forms || []);
    } catch (error) {
      console.error('Error loading service forms:', error);
      // Non-critical, forms are optional
    }
  };

  const handlePatientSelect = (selectedPatient) => {
    setPatient(selectedPatient);
    selectPatient(selectedPatient);

    // Pre-fill contact details if available
    if (selectedPatient.phone) {
      setContactNumber(selectedPatient.phone);
    }
    if (selectedPatient.address) {
      setHomeAddress(selectedPatient.address);
    }

    moveToNextStep();
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    moveToNextStep();
  };

  const handleProviderSelect = (provider) => {
    setSelectedProvider(provider);
    moveToNextStep();
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    moveToNextStep();
  };

  const moveToNextStep = () => {
    setCompletedSteps([...completedSteps, currentStep]);
    setCurrentStep(currentStep + 1);
  };

  const moveToPreviousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Prepare booking data
      const bookingData = {
        patient_id: patient.id,
        provider_id: selectedProvider.provider_id || selectedProvider.id,
        start_time: selectedSlot.start_time,
        duration: selectedService.default_duration_minutes,
        appointment_type: getAppointmentType(selectedService.service_type),
        chief_complaint: chiefComplaint,
        pre_appointment_notes: appointmentNotes,
        service_id: selectedService.id,
        booking_source: 'patient_portal'
      };

      // Add service-specific metadata
      const serviceMetadata = {};

      if (selectedService.service_type === 'HOME_CARE') {
        serviceMetadata.home_address = homeAddress;
        serviceMetadata.contact_number = contactNumber;
      }

      if (selectedService.service_type === 'IPD') {
        serviceMetadata.admission_requested = true;
        serviceMetadata.expected_duration_days = Math.ceil(
          selectedService.default_duration_minutes / 1440
        );
      }

      if (Object.keys(serviceMetadata).length > 0) {
        bookingData.service_metadata = serviceMetadata;
      }

      // Book the service
      const response = await servicesApi.book(selectedService.id, bookingData);

      setBookingResult(response);
      moveToNextStep();

      showToast('Service booked successfully!', 'success');

      // Redirect to appointments after 3 seconds
      setTimeout(() => {
        navigate('/appointments');
      }, 3000);

    } catch (error) {
      console.error('Error booking service:', error);
      showToast(error.response?.data?.error || 'Failed to book service', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getAppointmentType = (serviceType) => {
    switch (serviceType) {
      case 'IPD':
        return 'consultation';
      case 'OPD':
        return 'consultation';
      case 'PHYSIOTHERAPY':
        return 'therapy';
      case 'HOME_CARE':
        return 'procedure';
      default:
        return 'consultation';
    }
  };

  const formatTime = (datetime) => {
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getServiceIcon = () => {
    switch (selectedService?.service_type) {
      case 'IPD':
        return Building;
      case 'OPD':
        return Activity;
      case 'HOME_CARE':
        return House;
      default:
        return Activity;
    }
  };

  const ServiceIcon = getServiceIcon();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-foreground">Book Service</h1>
        <p className="text-muted-foreground mt-1">
          Follow the steps below to book your healthcare service
        </p>
      </div>

      {/* Enhanced Progress Steps */}
      <div className="bg-primary-50 dark:bg-primary-950 shadow-sm rounded-xl p-8 border border-primary-100 dark:border-primary-800">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = step.number === currentStep;
            const isCompleted = completedSteps.includes(step.number);

            return (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center relative">
                  <div
                    className={`
                      w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
                      ${isActive ? 'bg-primary-600 dark:bg-primary-500 text-white scale-110 ring-4 ring-primary-200 dark:ring-primary-800' : ''}
                      ${isCompleted ? 'bg-success-500 dark:bg-success-600 text-white' : ''}
                      ${!isActive && !isCompleted ? 'bg-card text-muted-foreground border-2 border-border' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-7 w-7" />
                    ) : (
                      <StepIcon className="h-7 w-7" />
                    )}
                  </div>
                  <span
                    className={`
                      text-sm mt-3 font-medium transition-all duration-300
                      ${isActive ? 'text-primary-700 dark:text-primary-300 font-bold' : ''}
                      ${isCompleted ? 'text-success-700 dark:text-success-300' : ''}
                      ${!isActive && !isCompleted ? 'text-muted-foreground' : ''}
                    `}
                  >
                    {step.title}
                  </span>
                  {isActive && (
                    <div className="absolute -bottom-2 w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-1 mx-4 rounded-full relative overflow-hidden bg-muted">
                    <div
                      className={`
                        absolute inset-0 transition-all duration-500 rounded-full
                        ${completedSteps.includes(step.number)
                          ? 'bg-success-500 dark:bg-success-600 w-full'
                          : 'w-0'}
                      `}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
        {/* Step 1: Patient Selection */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Select Patient</h2>
            <PatientSelector
              onSelect={handlePatientSelect}
              showCreateButton={true}
              selectedPatient={patient}
            />
          </div>
        )}

        {/* Step 2: Service Selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Select Service</h2>
              <p className="text-muted-foreground mt-1">Choose the healthcare service you need</p>
            </div>

            {loadingServices ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500 dark:text-primary-400" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className={`
                      p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 group
                      ${selectedService?.id === service.id
                        ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 shadow-lg scale-105'
                        : 'border-border hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md'
                      }
                    `}
                  >
                    <div className="flex items-start space-x-3">
                      <ServiceIcon className={`h-8 w-8 ${selectedService?.id === service.id ? 'text-primary-600 dark:text-primary-400' : 'text-muted-foreground'} group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors`} />
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground text-lg">{service.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                      </div>
                    </div>

                    {(service.requires_admission || service.requires_referral) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {service.requires_admission && (
                          <span className="inline-flex items-center text-xs font-semibold bg-warning-100 dark:bg-warning-900 text-warning-700 dark:text-warning-300 px-3 py-1 rounded-full border border-warning-200 dark:border-warning-700">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Requires Admission
                          </span>
                        )}
                        {service.requires_referral && (
                          <span className="inline-flex items-center text-xs font-semibold bg-warning-100 dark:bg-warning-900 text-warning-700 dark:text-warning-300 px-3 py-1 rounded-full border border-warning-200 dark:border-warning-700">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Requires Referral
                          </span>
                        )}
                      </div>
                    )}

                    {selectedService?.id === service.id && (
                      <div className="mt-3 flex items-center text-primary-600 dark:text-primary-400">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span className="text-sm font-medium">Selected</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={moveToPreviousStep}
                className="px-6 py-3 text-foreground bg-card border-2 border-border rounded-lg hover:bg-accent font-semibold transition-all duration-300 flex items-center shadow-sm hover:shadow-md"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </button>
              <button
                onClick={() => selectedService && moveToNextStep()}
                disabled={!selectedService}
                className="px-6 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-300 flex items-center shadow-md hover:shadow-lg"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Provider Selection */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Select Provider</h2>
              <p className="text-muted-foreground mt-1">Choose your healthcare provider</p>
            </div>

            {loadingProviders ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500 dark:text-primary-400" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((provider) => {
                  const providerData = provider.provider || provider;
                  return (
                    <div
                      key={provider.id}
                      onClick={() => handleProviderSelect(provider)}
                      className={`
                        p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 group
                        ${selectedProvider?.id === provider.id
                          ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-950 shadow-lg scale-105'
                          : 'border-border hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md'
                        }
                      `}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`p-3 rounded-full ${selectedProvider?.id === provider.id ? 'bg-primary-100 dark:bg-primary-900' : 'bg-muted'} group-hover:bg-primary-100 dark:group-hover:bg-primary-900 transition-colors`}>
                          <Stethoscope className={`h-8 w-8 ${selectedProvider?.id === provider.id ? 'text-primary-600 dark:text-primary-400' : 'text-muted-foreground'} group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-foreground text-lg">
                            Dr. {providerData.full_name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 font-medium">
                            {providerData.specialization}
                          </p>
                          {providerData.department && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {providerData.department}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {provider.is_primary && (
                          <span className="inline-flex items-center text-xs font-semibold bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-full border border-primary-200 dark:border-primary-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Primary Provider
                          </span>
                        )}
                        {selectedProvider?.id === provider.id && (
                          <span className="inline-flex items-center text-xs font-semibold bg-success-100 dark:bg-success-900 text-success-700 dark:text-success-300 px-3 py-1 rounded-full border border-success-200 dark:border-success-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={moveToPreviousStep}
                className="px-6 py-3 text-foreground bg-card border-2 border-border rounded-lg hover:bg-accent font-semibold transition-all duration-300 flex items-center shadow-sm hover:shadow-md"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </button>
              <button
                onClick={() => selectedProvider && moveToNextStep()}
                disabled={!selectedProvider}
                className="px-6 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-300 flex items-center shadow-md hover:shadow-lg"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Date & Time Selection */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Select Date & Time</h2>
              <p className="text-muted-foreground mt-1">Pick a convenient date and time slot</p>
            </div>

            <div className="bg-primary-50 dark:bg-primary-950 p-6 rounded-xl border border-primary-100 dark:border-primary-800">
              <label className="block text-sm font-semibold text-foreground mb-3 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg font-medium bg-card text-foreground"
              />
            </div>

            {loadingSlots ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary-500 dark:text-primary-400 mb-3" />
                <p className="text-muted-foreground">Loading available slots...</p>
              </div>
            ) : availableSlots.length > 0 ? (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                  Available Time Slots
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableSlots.map((slot, index) => {
                    const hour = new Date(slot.start_time).getHours();
                    const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
                    const isSelected = selectedSlot === slot;

                    return (
                      <button
                        key={index}
                        onClick={() => handleSlotSelect(slot)}
                        className={`
                          px-4 py-4 text-sm rounded-xl transition-all duration-300 font-medium border-2
                          ${isSelected
                            ? 'bg-primary-600 dark:bg-primary-500 text-white border-primary-600 dark:border-primary-500 shadow-lg scale-105'
                            : 'bg-card text-foreground border-border hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md hover:scale-102'
                          }
                        `}
                      >
                        <div className="flex flex-col items-center">
                          <Clock className={`h-5 w-5 mb-1 ${isSelected ? 'text-white' : 'text-muted-foreground'}`} />
                          <span className="text-base font-bold">{formatTime(slot.start_time)}</span>
                          <span className={`text-xs mt-1 ${isSelected ? 'text-primary-100 dark:text-primary-200' : 'text-muted-foreground'}`}>{period}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedSlot && (
                  <div className="mt-4 p-4 bg-success-50 dark:bg-success-950 border-2 border-success-200 dark:border-success-700 rounded-xl">
                    <div className="flex items-center text-success-800 dark:text-success-300">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      <span className="font-semibold">
                        Selected: {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-warning-50 dark:bg-warning-950 border-2 border-warning-200 dark:border-warning-700 rounded-xl p-6">
                <div className="flex items-start">
                  <AlertCircle className="h-6 w-6 text-warning-600 dark:text-warning-400 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-warning-900 dark:text-warning-200 mb-1">No Slots Available</h3>
                    <p className="text-sm text-warning-800 dark:text-warning-300">
                      No available time slots for the selected date. Please choose another date.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={moveToPreviousStep}
                className="px-6 py-3 text-foreground bg-card border-2 border-border rounded-lg hover:bg-accent font-semibold transition-all duration-300 flex items-center shadow-sm hover:shadow-md"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </button>
              <button
                onClick={() => selectedSlot && moveToNextStep()}
                disabled={!selectedSlot}
                className="px-6 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-300 flex items-center shadow-md hover:shadow-lg"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Additional Details */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Additional Details</h2>
              <p className="text-muted-foreground mt-1">Provide information about your visit</p>
            </div>

            <div className="bg-primary-50 dark:bg-primary-950 p-6 rounded-xl border border-primary-100 dark:border-primary-800">
              <label className="block text-sm font-semibold text-foreground mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                Chief Complaint / Reason for Visit
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-primary-200 dark:border-primary-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none bg-card text-foreground"
                placeholder="Please describe your symptoms or the reason for booking this service..."
              />
              <p className="text-xs text-muted-foreground mt-2">This helps the provider prepare for your visit</p>
            </div>

            {/* Home Care specific fields */}
            {selectedService?.service_type === 'HOME_CARE' && (
              <div className="space-y-4 bg-warning-50 dark:bg-warning-950 p-6 rounded-xl border border-warning-100 dark:border-warning-800">
                <h3 className="font-semibold text-foreground flex items-center">
                  <House className="h-5 w-5 mr-2 text-warning-600 dark:text-warning-400" />
                  Home Care Service Details
                </h3>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-3 flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-warning-600 dark:text-warning-400" />
                    Service Address *
                  </label>
                  <textarea
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    rows={3}
                    required
                    className="w-full px-4 py-3 border-2 border-warning-200 dark:border-warning-700 rounded-lg focus:ring-2 focus:ring-warning-500 focus:border-transparent resize-none bg-card text-foreground"
                    placeholder="Enter complete address where the service is required..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-3 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-warning-600 dark:text-warning-400" />
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-warning-200 dark:border-warning-700 rounded-lg focus:ring-2 focus:ring-warning-500 focus:border-transparent bg-card text-foreground"
                    placeholder="Contact number for service coordination"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-foreground mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400" />
                Additional Notes <span className="text-muted-foreground font-normal ml-1">(Optional)</span>
              </label>
              <textarea
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none bg-card text-foreground"
                placeholder="Any additional information you'd like to share with the provider..."
              />
            </div>

            {/* Service Forms Information */}
            {serviceForms.length > 0 && (
              <div className="bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-primary-900 dark:text-primary-200 mb-2">
                  Required Forms
                </h3>
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  The following forms will need to be filled during your visit:
                </p>
                <ul className="mt-2 space-y-1">
                  {serviceForms.map((form) => (
                    <li key={form.id} className="text-sm text-primary-600 dark:text-primary-400 flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      {form.form?.name || form.form_type}
                      {form.is_mandatory && (
                        <span className="ml-2 text-xs text-danger-600 dark:text-danger-400">(Required)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={moveToPreviousStep}
                className="px-6 py-3 text-foreground bg-card border-2 border-border rounded-lg hover:bg-accent font-semibold transition-all duration-300 flex items-center shadow-sm hover:shadow-md"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </button>
              <button
                onClick={moveToNextStep}
                className="px-6 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 font-semibold transition-all duration-300 flex items-center shadow-md hover:shadow-lg"
              >
                Review Booking
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Review & Confirm */}
        {currentStep === 6 && !bookingResult && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Review & Confirm</h2>
              <p className="text-muted-foreground mt-1">Please review your booking details before confirming</p>
            </div>

            <div className="bg-primary-50 dark:bg-primary-950 rounded-xl p-8 space-y-6 border-2 border-primary-100 dark:border-primary-800 shadow-lg">
              {/* Patient Info */}
              <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
                <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Patient Information
                </h3>
                <p className="text-lg font-bold text-foreground">{patient?.full_name}</p>
                {patient?.abha_id && (
                  <p className="text-sm text-muted-foreground mt-1">ABHA ID: {patient.abha_id}</p>
                )}
              </div>

              {/* Service Info */}
              <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
                <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3 flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Service Details
                </h3>
                <div className="flex items-center mb-2">
                  <ServiceIcon className="h-6 w-6 mr-3 text-primary-500 dark:text-primary-400" />
                  <p className="text-lg font-bold text-foreground">{selectedService?.name}</p>
                </div>
                <p className="text-sm text-muted-foreground">{selectedService?.department}</p>
              </div>

              {/* Provider Info */}
              <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
                <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3 flex items-center">
                  <Stethoscope className="h-4 w-4 mr-2" />
                  Healthcare Provider
                </h3>
                <p className="text-lg font-bold text-foreground">
                  Dr. {selectedProvider?.provider?.full_name || selectedProvider?.full_name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedProvider?.provider?.specialization || selectedProvider?.specialization}
                </p>
              </div>

              {/* Schedule Info */}
              <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
                <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Appointment Schedule
                </h3>
                <p className="text-lg font-bold text-foreground">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <div className="flex items-center mt-2">
                  <Clock className="h-4 w-4 mr-2 text-primary-500 dark:text-primary-400" />
                  <p className="text-base font-semibold text-foreground">
                    {formatTime(selectedSlot?.start_time)} - {formatTime(selectedSlot?.end_time)}
                  </p>
                </div>
              </div>

              {/* Chief Complaint */}
              {chiefComplaint && (
                <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
                  <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Chief Complaint
                  </h3>
                  <p className="text-foreground">{chiefComplaint}</p>
                </div>
              )}

              {/* Home Care Address */}
              {selectedService?.service_type === 'HOME_CARE' && homeAddress && (
                <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
                  <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3 flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Service Location
                  </h3>
                  <p className="text-foreground">{homeAddress}</p>
                  <p className="text-sm text-muted-foreground mt-2 flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Contact: {contactNumber}
                  </p>
                </div>
              )}

              {/* Special Requirements */}
              {(selectedService?.requires_admission || selectedService?.requires_referral) && (
                <div className="bg-warning-50 dark:bg-warning-950 border-2 border-warning-200 dark:border-warning-700 rounded-xl p-5">
                  <div className="flex items-start">
                    <AlertCircle className="h-6 w-6 text-warning-600 dark:text-warning-400 mr-3 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-warning-900 dark:text-warning-200 mb-2">Important Requirements</h3>
                      {selectedService.requires_admission && (
                        <p className="text-sm text-warning-800 dark:text-warning-300 mb-1">
                          • This service requires hospital admission
                        </p>
                      )}
                      {selectedService.requires_referral && (
                        <p className="text-sm text-warning-800 dark:text-warning-300">
                          • A referral from your primary care provider is required
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={moveToPreviousStep}
                disabled={submitting}
                className="px-6 py-3 text-foreground bg-card border-2 border-border rounded-lg hover:bg-accent font-semibold transition-all duration-300 flex items-center shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-4 bg-success-600 dark:bg-success-500 text-white rounded-xl hover:bg-success-700 dark:hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg transition-all duration-300 flex items-center shadow-lg hover:shadow-xl"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Confirm Booking
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Booking Success */}
        {bookingResult && (
          <div className="text-center py-12">
            {/* Success Animation */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-success-100 dark:bg-success-900 rounded-full animate-ping opacity-25"></div>
              </div>
              <div className="relative">
                <div className="w-32 h-32 bg-success-500 dark:bg-success-600 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                  <CheckCircle className="h-20 w-20 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            <h2 className="text-4xl font-bold text-foreground mb-3">
              Booking Confirmed!
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Your {selectedService?.name} appointment has been successfully booked.
            </p>

            {bookingResult.appointment && (
              <div className="bg-primary-50 dark:bg-primary-950 rounded-2xl p-8 text-left max-w-2xl mx-auto border-2 border-primary-100 dark:border-primary-800 shadow-xl mb-8">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center">
                  <Calendar className="h-6 w-6 mr-3 text-primary-600 dark:text-primary-400" />
                  Appointment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-card rounded-lg p-4 shadow-sm border border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Appointment ID</span>
                    <p className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-1">
                      #{bookingResult.appointment.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg p-4 shadow-sm border border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date & Time</span>
                    <p className="text-base font-bold text-foreground mt-1">
                      {new Date(bookingResult.appointment.start_time).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(bookingResult.appointment.start_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg p-4 shadow-sm border border-border md:col-span-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provider</span>
                    <p className="text-base font-bold text-foreground mt-1">
                      Dr. {bookingResult.appointment.provider_name}
                    </p>
                  </div>
                </div>

                {/* Success Tips */}
                <div className="mt-6 bg-success-50 dark:bg-success-950 border border-success-200 dark:border-success-700 rounded-lg p-4">
                  <h4 className="font-semibold text-success-900 dark:text-success-200 mb-2 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    What's Next?
                  </h4>
                  <ul className="text-sm text-success-800 dark:text-success-300 space-y-1 ml-7">
                    <li>• A confirmation has been sent to your registered contact</li>
                    <li>• Please arrive 15 minutes before your appointment</li>
                    <li>• Bring your ABHA card and any relevant medical records</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/appointments')}
                className="px-8 py-4 bg-primary-600 dark:bg-primary-500 text-white text-lg font-semibold rounded-xl hover:bg-primary-700 dark:hover:bg-primary-600 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                <Calendar className="h-5 w-5 mr-2" />
                View My Appointments
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-8 py-4 text-foreground bg-card border-2 border-border text-lg font-semibold rounded-xl hover:bg-accent transition-all duration-300 shadow-md hover:shadow-lg"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceBookingWizard;