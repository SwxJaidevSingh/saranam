import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Page Navigator Component
 * Provides navigation controls and page tabs for multi-page forms
 */
export default function PageNavigator({
  pages = [],
  currentPage = 0,
  onPageChange,
  variant = 'tabs' // 'tabs' or 'buttons'
}) {
  if (!pages || pages.length <= 1) {
    return null; // Don't show navigator for single-page forms
  }

  const goToPrevious = () => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  };

  const goToNext = () => {
    if (currentPage < pages.length - 1) {
      onPageChange(currentPage + 1);
    }
  };

  const goToPage = (index) => {
    onPageChange(index);
  };

  if (variant === 'buttons') {
    // Button-style navigation (for form submission)
    return (
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goToPrevious}
          disabled={currentPage === 0}
          className="btn-secondary flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {pages.length}
          </span>
          <div className="flex gap-1">
            {pages.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentPage ? 'bg-primary' : 'bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={goToNext}
          disabled={currentPage === pages.length - 1}
          className="btn-secondary flex items-center gap-2"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Tabs-style navigation (for form builder)
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {pages.map((page, index) => (
          <button
            key={page.id || index}
            onClick={() => goToPage(index)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              index === currentPage
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {page.title || `Page ${index + 1}`}
            {page.fields && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({page.fields.length} field{page.fields.length !== 1 ? 's' : ''})
              </span>
            )}
          </button>
        ))}

        {/* Optional: Add new page button */}
        {onPageChange.addPage && (
          <button
            onClick={onPageChange.addPage}
            className="px-4 py-2 text-sm font-medium text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            + Add Page
          </button>
        )}
      </div>
    </div>
  );
}
