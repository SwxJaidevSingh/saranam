import React, { createContext, useContext, useState, useCallback } from 'react';

const ServiceBookingContext = createContext(null);

export const useServiceBooking = () => {
  const context = useContext(ServiceBookingContext);
  if (!context) {
    throw new Error('useServiceBooking must be used within ServiceBookingProvider');
  }
  return context;
};

export const ServiceBookingProvider = ({ children }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingData, setBookingData] = useState({
    patient: null,
    serviceType: null,
    service: null,
    provider: null,
    schedule: {
      date: null,
      timeSlot: null,
      duration: null
    },
    details: {
      chiefComplaint: '',
      notes: '',
      homeAddress: '',
      contactNumber: '',
      insuranceInfo: null,
      preferredWard: null,
      specialRequirements: ''
    },
    booking: {
      status: 'draft',
      confirmationNumber: null,
      bookingId: null
    }
  });

  const [stepValidation, setStepValidation] = useState({
    1: false, // Patient selection
    2: false, // Service type selection
    3: false, // Provider selection
    4: false, // Schedule selection
    5: false, // Details
    6: false  // Confirmation
  });

  const updateBookingData = useCallback((field, value) => {
    console.log(`Updating ${field} to:`, value);
    setBookingData(prev => {
      if (field.includes('.')) {
        const keys = field.split('.');
        const newData = { ...prev };
        let current = newData;

        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        return newData;
      }

      const newState = {
        ...prev,
        [field]: value
      };
      console.log('New booking data state:', newState);
      return newState;
    });
  }, []);

  const validateCurrentStep = useCallback(() => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = bookingData.patient !== null;
        break;
      case 2:
        isValid = bookingData.serviceType !== null && bookingData.service !== null;
        break;
      case 3:
        isValid = bookingData.provider !== null;
        break;
      case 4:
        isValid = bookingData.schedule.date !== null &&
                 bookingData.schedule.timeSlot !== null;
        break;
      case 5:
        isValid = bookingData.details.chiefComplaint.trim() !== '' &&
                 bookingData.details.contactNumber.trim() !== '';
        // Additional validation for home care
        if (bookingData.serviceType === 'HOME_CARE') {
          isValid = isValid && bookingData.details.homeAddress.trim() !== '';
        }
        break;
      case 6:
        isValid = true; // Confirmation step is always valid if reached
        break;
      default:
        isValid = false;
    }

    setStepValidation(prev => ({
      ...prev,
      [currentStep]: isValid
    }));

    return isValid;
  }, [currentStep, bookingData]);

  const goToNextStep = useCallback(() => {
    if (validateCurrentStep() && currentStep < 6) {
      setCurrentStep(prev => prev + 1);
      return true;
    }
    return false;
  }, [currentStep, validateCurrentStep]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      return true;
    }
    return false;
  }, [currentStep]);

  const goToStep = useCallback((step) => {
    if (step >= 1 && step <= 6) {
      // Check if all previous steps are valid
      let canNavigate = true;
      for (let i = 1; i < step; i++) {
        if (!stepValidation[i]) {
          canNavigate = false;
          break;
        }
      }

      if (canNavigate || step < currentStep) {
        setCurrentStep(step);
        return true;
      }
    }
    return false;
  }, [currentStep, stepValidation]);

  const resetBooking = useCallback(() => {
    setCurrentStep(1);
    setBookingData({
      patient: null,
      serviceType: null,
      service: null,
      provider: null,
      schedule: {
        date: null,
        timeSlot: null,
        duration: null
      },
      details: {
        chiefComplaint: '',
        notes: '',
        homeAddress: '',
        contactNumber: '',
        insuranceInfo: null,
        preferredWard: null,
        specialRequirements: ''
      },
      booking: {
        status: 'draft',
        confirmationNumber: null,
        bookingId: null
      }
    });
    setStepValidation({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false
    });
  }, []);

  const getStepTitle = useCallback((step) => {
    const titles = {
      1: 'Patient Selection',
      2: 'Service Type',
      3: 'Provider Selection',
      4: 'Schedule',
      5: 'Details',
      6: 'Confirmation'
    };
    return titles[step] || '';
  }, []);

  const isStepAccessible = useCallback((step) => {
    if (step === 1) return true;

    // Check if all previous steps are valid
    for (let i = 1; i < step; i++) {
      if (!stepValidation[i]) {
        return false;
      }
    }
    return true;
  }, [stepValidation]);

  const value = {
    // State
    currentStep,
    bookingData,
    stepValidation,

    // Actions
    updateBookingData,
    validateCurrentStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    resetBooking,

    // Helpers
    getStepTitle,
    isStepAccessible
  };

  return (
    <ServiceBookingContext.Provider value={value}>
      {children}
    </ServiceBookingContext.Provider>
  );
};