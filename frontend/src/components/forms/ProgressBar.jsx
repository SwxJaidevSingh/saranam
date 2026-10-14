import { Check } from 'lucide-react';

/**
 * Progress Bar Component
 * Shows progress through multi-page forms
 */
export default function ProgressBar({
  currentPage,
  totalPages,
  pages = [],
  onPageClick
}) {
  const progress = ((currentPage + 1) / totalPages) * 100;

  return (
    <div className="w-full mb-8">
      {/* Progress bar */}
      <div className="relative">
        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-secondary">
          <div
            style={{ width: `${progress}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
          />
        </div>

        {/* Step indicators */}
        <div className="flex justify-between">
          {pages.map((page, index) => {
            const isCompleted = index < currentPage;
            const isCurrent = index === currentPage;
            const isClickable = index <= currentPage;

            return (
              <button
                key={page.id}
                onClick={() => isClickable && onPageClick?.(index)}
                disabled={!isClickable}
                className={`flex flex-col items-center ${
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                {/* Circle indicator */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isCompleted
                      ? 'bg-success-600 text-white'
                      : isCurrent
                      ? 'bg-primary text-white ring-4 ring-primary-200'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="font-semibold">{index + 1}</span>
                  )}
                </div>

                {/* Page title */}
                <span
                  className={`text-sm font-medium max-w-[100px] truncate ${
                    isCurrent
                      ? 'text-primary'
                      : isCompleted
                      ? 'text-success-700'
                      : 'text-muted-foreground'
                  }`}
                >
                  {page.title || `Page ${index + 1}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current step text */}
      <div className="text-center mt-4 text-sm text-muted-foreground">
        Step {currentPage + 1} of {totalPages}
        {pages[currentPage]?.description && (
          <p className="text-muted-foreground mt-1">{pages[currentPage].description}</p>
        )}
      </div>
    </div>
  );
}
