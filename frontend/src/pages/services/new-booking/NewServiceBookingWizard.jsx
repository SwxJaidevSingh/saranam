import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ServiceBookingProvider, useServiceBooking } from './ServiceBookingContext';
import { PatientProvider } from '@/context/PatientContext';
import PatientSelectionStep from './steps/PatientSelectionStep';
import ServiceTypeStep from './steps/ServiceTypeStep';
import ProviderSelectionStep from './steps/ProviderSelectionStep';
import ScheduleStep from './steps/ScheduleStep';
import DetailsStep from './steps/DetailsStep';
import ConfirmationStep from './steps/ConfirmationStep';
import StepProgressBar from './components/StepProgressBar';

const WizardContent = () => {
  const navigate = useNavigate();
  const {
    currentStep,
    bookingData,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    getStepTitle,
    validateCurrentStep,
    resetBooking
  } = useServiceBooking();

  const handleNext = () => {
    if (!goToNextStep()) {
      // Validation failed, you might want to show an error message
      console.log('Please complete all required fields before proceeding');
    }
  };

  const handlePrevious = () => {
    goToPreviousStep();
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this booking? All progress will be lost.')) {
      resetBooking();
      navigate('/services');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PatientSelectionStep />;
      case 2:
        return <ServiceTypeStep />;
      case 3:
        return <ProviderSelectionStep />;
      case 4:
        return <ScheduleStep />;
      case 5:
        return <DetailsStep />;
      case 6:
        return <ConfirmationStep />;
      default:
        return null;
    }
  };

  const isLastStep = currentStep === 6;
  const isFirstStep = currentStep === 1;

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(hsl(var(--muted))_1px,transparent_1px)] [background-size:20px_20px]">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Book a Service</h1>
              <p className="text-muted-foreground mt-1">Complete the steps below to schedule your healthcare service.</p>
            </div>
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="text-muted-foreground hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-950 transition-colors"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel Booking
            </Button>
          </div>

          {/* Progress Bar Container */}
          <div className="bg-card p-6 rounded-2xl shadow-sm border border-border mb-8">
            <StepProgressBar
              currentStep={currentStep}
              totalSteps={6}
              onStepClick={goToStep}
            />
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardContent className="p-0">
            {/* Step Title Header */}
            <div className="bg-foreground px-8 py-6 text-background flex justify-between items-center">
              <div>
                <span className="text-background/70 text-xs font-bold uppercase tracking-wider">Step {currentStep} of 6</span>
                <h2 className="text-xl font-semibold mt-1">
                  {getStepTitle(currentStep)}
                </h2>
              </div>
              <div className="bg-background/20 px-3 py-1 rounded-full text-xs font-medium">
                {Math.round((currentStep / 6) * 100)}% Complete
              </div>
            </div>

            {/* Step Content */}
            <div className="p-8 min-h-[450px]">
              {renderStep()}
            </div>

            {/* Navigation Buttons */}
            <div className="px-8 py-6 bg-accent border-t border-border flex justify-between items-center">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={isFirstStep}
                className="text-muted-foreground hover:bg-background hover:shadow-sm"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {!isLastStep ? (
                <Button
                  onClick={handleNext}
                  className="bg-foreground hover:bg-foreground/90 text-background px-8 shadow-lg shadow-muted"
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/appointments')}
                  className="bg-primary-600 dark:bg-primary-500 hover:bg-primary-700 dark:hover:bg-primary-600 text-white px-8 shadow-lg shadow-primary-100 dark:shadow-primary-950"
                >
                  Go to Dashboard
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const NewServiceBookingWizard = () => {
  return (
    <PatientProvider>
      <ServiceBookingProvider>
        <WizardContent />
      </ServiceBookingProvider>
    </PatientProvider>
  );
};

export default NewServiceBookingWizard;