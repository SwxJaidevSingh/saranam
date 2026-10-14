import { Star } from 'lucide-react';

/**
 * Linear Scale Field Component
 * Renders a rating scale (like 1-5 stars or 1-10 scale)
 */
export default function LinearScaleField({
  field,
  value,
  onChange,
  error,
  className = ''
}) {
  const min = field.config?.min || 1;
  const max = field.config?.max || 5;
  const step = field.config?.step || 1;
  const minLabel = field.config?.minLabel || 'Low';
  const maxLabel = field.config?.maxLabel || 'High';
  const showAsStars = field.config?.showAsStars || false;

  // Generate scale options
  const options = [];
  for (let i = min; i <= max; i += step) {
    options.push(i);
  }

  const handleSelect = (val) => {
    onChange(val);
  };

  if (showAsStars) {
    // Star rating display
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={`p-2 rounded transition-colors ${
                value >= option
                  ? 'text-warning-500 dark:text-warning-400'
                  : 'text-muted-foreground/40 hover:text-warning-400'
              }`}
              aria-label={`Rate ${option} out of ${max}`}
            >
              <Star
                className="w-8 h-8"
                fill={value >= option ? 'currentColor' : 'none'}
              />
            </button>
          ))}
        </div>
        {value && (
          <p className="text-sm text-muted-foreground mt-2">
            {value} out of {max}
          </p>
        )}
      </div>
    );
  }

  // Number scale display
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleSelect(option)}
            className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
              value === option
                ? 'border-primary-600 bg-primary-500/10 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300'
                : 'border-border bg-card text-foreground hover:border-primary-400 hover:bg-secondary'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {error && <p className="form-error mt-2">{error}</p>}
    </div>
  );
}
