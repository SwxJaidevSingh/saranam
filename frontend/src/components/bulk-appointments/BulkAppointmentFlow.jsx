/**
 * Bulk Appointment Flow - Main wizard component
 * Multi-step flow for uploading, reviewing, and creating bulk appointments
 */
import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { Progress } from '../ui/progress';
import { X, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import UploadStep from './UploadStep';
import ReviewStep from './ReviewStep';
import MissingProvidersStep from './MissingProvidersStep';
import ConfirmStep from './ConfirmStep';
import ResultsStep from './ResultsStep';

const STEPS = [
  { id: 'upload', label: 'Upload File', component: UploadStep },
  { id: 'review', label: 'Review & Resolve', component: ReviewStep },
  { id: 'providers', label: 'Missing Providers', component: MissingProvidersStep },
  { id: 'confirm', label: 'Confirm', component: ConfirmStep },
  { id: 'results', label: 'Results', component: ResultsStep }
];

const BulkAppointmentFlow = ({ onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionData, setSessionData] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [error, setError] = useState(null);
  const [missingProviders, setMissingProviders] = useState([]);

  const currentStepData = STEPS[currentStep];
  const StepComponent = currentStepData.component;

  // Calculate progress percentage
  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  // Skip providers step if no missing providers
  const shouldSkipProvidersStep = () => {
    return statistics && statistics.missing_provider_count === 0;
  };

  const handleNext = (data) => {
    // Update session data
    if (data?.session) {
      setSessionData(data.session);
    }
    if (data?.statistics) {
      setStatistics(data.statistics);
    }
    if (data?.missingProviders) {
      setMissingProviders(data.missingProviders);
    }

    // Handle appointment creation results
    if (data?.results) {
      setSessionData(prevData => ({
        ...prevData,
        results: data.results
      }));
    }

    // Move to next step
    let nextStep = currentStep + 1;

    // Skip providers step if no missing providers
    if (nextStep === 2 && shouldSkipProvidersStep()) {
      nextStep = 3;
    }

    if (nextStep < STEPS.length) {
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    let prevStep = currentStep - 1;

    // Skip providers step when going back if no missing providers
    if (prevStep === 2 && shouldSkipProvidersStep()) {
      prevStep = 1;
    }

    if (prevStep >= 0) {
      setCurrentStep(prevStep);
    }
  };

  const handleError = (errorMessage) => {
    setError(errorMessage);
  };

  const handleComplete = (results) => {
    if (onComplete) {
      onComplete(results);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-auto mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Bulk Appointment Upload</h2>
              <p className="text-muted-foreground mt-1">
                Step {currentStep + 1} of {STEPS.length}: {currentStepData.label}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between mt-2">
              {STEPS.map((step, index) => {
                // Skip providers step label if no missing providers
                if (step.id === 'providers' && shouldSkipProvidersStep()) {
                  return null;
                }

                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center text-xs ${
                      isCompleted
                        ? 'text-green-600'
                        : isCurrent
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : isCurrent ? (
                      <div className="h-3 w-3 mr-1 rounded-full bg-primary" />
                    ) : (
                      <div className="h-3 w-3 mr-1 rounded-full border border-muted-foreground" />
                    )}
                    {step.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </Alert>
          )}

          {/* Statistics Summary (shown after upload) */}
          {statistics && currentStep > 0 && currentStep < 4 && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Card className="p-4 border-green-200 bg-green-50">
                <div className="text-2xl font-bold text-green-700">
                  {statistics.auto_approved_count || 0}
                </div>
                <div className="text-xs text-green-600">Auto-Approved</div>
              </Card>
              <Card className="p-4 border-yellow-200 bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">
                  {statistics.needs_review_count || 0}
                </div>
                <div className="text-xs text-yellow-600">Needs Review</div>
              </Card>
              {statistics.missing_provider_count > 0 && (
                <Card className="p-4 border-orange-200 bg-orange-50">
                  <div className="text-2xl font-bold text-orange-700">
                    {statistics.missing_provider_count}
                  </div>
                  <div className="text-xs text-orange-600">Missing Providers</div>
                </Card>
              )}
              <Card className="p-4 border-red-200 bg-red-50">
                <div className="text-2xl font-bold text-red-700">
                  {statistics.rejected_count || 0}
                </div>
                <div className="text-xs text-red-600">Rejected</div>
              </Card>
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[400px]">
            <StepComponent
              sessionData={sessionData}
              statistics={statistics}
              missingProviders={missingProviders}
              onNext={handleNext}
              onBack={handleBack}
              onError={handleError}
              onComplete={handleComplete}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BulkAppointmentFlow;
