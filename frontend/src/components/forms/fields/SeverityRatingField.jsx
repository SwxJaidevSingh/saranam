export default function SeverityRatingField({
  field,
  value,
  onChange,
  error,
  className = ''
}) {
  // Extract configuration from field.config
  const levels = field.config?.levels || ['None', 'Mild', 'Moderate', 'Severe', 'Critical'];
  const colors = field.config?.colors || ['#22c55e', '#eab308', '#f59e0b', '#ef4444', '#991b1b'];
  const scores = field.config?.scores || levels.map((_, idx) => idx);
  const layout = field.config?.layout || 'horizontal'; // 'horizontal' or 'vertical'

  // Map text colors for better readability
  const getTextColor = (color) => {
    // If color is dark (red variants), use white text
    if (color.includes('991b1b') || color.includes('ef4444') || color.includes('dc2626')) {
      return 'text-white';
    }
    return 'text-foreground';
  };

  const handleSelect = (selectedLevel) => {
    onChange(selectedLevel);
  };

  const isSelected = (level) => value === level;

  return (
    <div className={`severity-rating-field ${className}`}>
      {/* Severity buttons */}
      <div className={`flex ${layout === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'} gap-2`}>
        {levels.map((level, index) => {
          const selected = isSelected(level);
          const bgColor = colors[index] || colors[colors.length - 1];
          const textColor = getTextColor(bgColor);

          return (
            <button
              key={level}
              type="button"
              onClick={() => handleSelect(level)}
              className={`flex-1 min-w-[100px] px-4 py-3 rounded-lg font-medium transition-all ${
                selected
                  ? `${textColor} shadow-lg scale-105`
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
              style={selected ? { backgroundColor: bgColor } : {}}
            >
              <div className="flex flex-col items-center">
                <span className="text-sm font-semibold">{level}</span>
                {scores[index] !== undefined && (
                  <span className={`text-xs mt-1 ${selected ? 'opacity-90' : 'text-muted-foreground'}`}>
                    Score: {scores[index]}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected value display */}
      {value && (
        <div className="mt-3 text-sm text-muted-foreground">
          Selected: <span className="font-semibold">{value}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-danger-600 dark:text-danger-400">
          {error}
        </div>
      )}
    </div>
  );
}
