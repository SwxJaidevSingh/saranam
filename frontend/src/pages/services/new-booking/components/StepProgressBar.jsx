import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const StepProgressBar = ({ currentStep, totalSteps, onStepClick }) => {
  const steps = [
    { number: 1, title: 'Patient' },
    { number: 2, title: 'Service Type' },
    { number: 3, title: 'Provider' },
    { number: 4, title: 'Schedule' },
    { number: 5, title: 'Details' },
    { number: 6, title: 'Confirm' }
  ];

  const handleStepClick = (stepNumber) => {
    if (onStepClick && stepNumber <= currentStep) {
      onStepClick(stepNumber);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border">
          <div
            className="h-full bg-primary-600 dark:bg-primary-500 transition-all duration-500"
            style={{
              width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`
            }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isClickable = step.number <= currentStep;

          return (
            <div
              key={step.number}
              className="relative flex flex-col items-center"
              style={{ zIndex: 10 }}
            >
              <button
                onClick={() => handleStepClick(step.number)}
                disabled={!isClickable}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 mb-2',
                  isCompleted && 'bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600',
                  isActive && 'bg-primary-600 dark:bg-primary-500 text-white ring-4 ring-primary-100 dark:ring-primary-900',
                  !isCompleted && !isActive && 'bg-card border-2 border-border text-muted-foreground',
                  isClickable && !isActive && 'cursor-pointer hover:border-primary-400 dark:hover:border-primary-600',
                  !isClickable && 'cursor-not-allowed'
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{step.number}</span>
                )}
              </button>

              <span
                className={cn(
                  'text-xs font-medium absolute top-12 whitespace-nowrap',
                  isActive && 'text-primary-600 dark:text-primary-400',
                  isCompleted && 'text-foreground',
                  !isCompleted && !isActive && 'text-muted-foreground'
                )}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepProgressBar;