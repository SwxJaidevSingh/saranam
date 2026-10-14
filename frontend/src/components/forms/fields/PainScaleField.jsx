export default function PainScaleField({
  field,
  value,
  onChange,
  error,
  className = ''
}) {
  // Extract configuration from field.config
  const scaleSize = field.config?.scaleSize || 10; // 5, 6, or 10
  const showEmojis = field.config?.showEmojis !== false; // default true
  const showMainLabels = field.config?.showMainLabels !== false; // default true

  // 5-Level Pain Scale (with emoji buttons)
  const fiveLevelScale = [
    { value: 0, emoji: '😊', bgColor: 'bg-green-400', borderColor: 'border-green-600', label: 'No pain' },
    { value: 2, emoji: '😐', bgColor: 'bg-yellow-300', borderColor: 'border-yellow-600', label: 'Mild' },
    { value: 5, emoji: '☹️', bgColor: 'bg-orange-300', borderColor: 'border-orange-600', label: 'Moderate' },
    { value: 7, emoji: '😢', bgColor: 'bg-red-400', borderColor: 'border-red-600', label: 'Severe' },
    { value: 10, emoji: '😡', bgColor: 'bg-red-600', borderColor: 'border-red-800', label: 'Worst pain' },
  ];

  // 6-Level Pain Scale (with emoji buttons)
  const sixLevelScale = [
    { value: 0, emoji: '😊', bgColor: 'bg-green-400', borderColor: 'border-green-600', label: 'No pain' },
    { value: 2, emoji: '🙂', bgColor: 'bg-lime-300', borderColor: 'border-lime-600', label: 'Very mild' },
    { value: 4, emoji: '😐', bgColor: 'bg-yellow-300', borderColor: 'border-yellow-600', label: 'Discomforting' },
    { value: 6, emoji: '☹️', bgColor: 'bg-orange-400', borderColor: 'border-orange-600', label: 'Distressing' },
    { value: 8, emoji: '😭', bgColor: 'bg-red-400', borderColor: 'border-red-600', label: 'Intense' },
    { value: 10, emoji: '😡', bgColor: 'bg-red-600', borderColor: 'border-red-800', label: 'Worst pain' },
  ];

  // 10-Level Pain Scale (NO emojis - just numbers)
  const tenLevelScale = [
    { value: 0, label: 'No pain' },
    { value: 1, label: 'Very mild' },
    { value: 2, label: 'Mild' },
    { value: 3, label: 'Moderate' },
    { value: 4, label: 'Discomforting' },
    { value: 5, label: 'Distracting' },
    { value: 6, label: 'Distressing' },
    { value: 7, label: 'Severe' },
    { value: 8, label: 'Intense' },
    { value: 9, label: 'Excruciating' },
    { value: 10, label: 'Utterly horrible' },
];

  // Select the appropriate scale based on config
  let painLevels;
  let useEmojiButtons = false;

  if (scaleSize === 5) {
    painLevels = fiveLevelScale;
    useEmojiButtons = showEmojis;
  } else if (scaleSize === 6) {
    painLevels = sixLevelScale;
    useEmojiButtons = showEmojis;
  } else {
    painLevels = tenLevelScale;
    useEmojiButtons = false; // Never show emojis for 10-scale
  }

  const handleSelect = (val) => {
    onChange(val);
  };

  // Main labels to display (only key pain levels)
  const mainLabels = showMainLabels ? painLevels.filter(p => p.label) : [];

  return (
    <div className={`pain-scale-field ${className}`}>
      {/* Main labels row (if enabled and labels exist) */}
      {showMainLabels && mainLabels.length > 0 && (
        <div className="relative mb-3">
          <div className="flex justify-between items-start text-xs font-medium text-muted-foreground">
            {mainLabels.map((item) => {
              const maxValue = painLevels[painLevels.length - 1].value;
              return (
                <div
                  key={item.value}
                  className="text-center"
                  style={{
                    position: 'absolute',
                    left: `${(item.value / maxValue) * 100}%`,
                    transform: 'translateX(-50%)',
                    width: '80px'
                  }}
                >
                  {item.label}
                </div>
              );
            })}
          </div>
          <div style={{ height: '30px' }}></div>
        </div>
      )}

      {/* Responsive container with horizontal scroll for small screens */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-max">
          {/* Number scale buttons (with or without emojis) */}
          <div className={`flex items-center ${scaleSize === 10 ? 'gap-1' : 'gap-2'} ${scaleSize === 10 ? 'justify-between' : 'justify-center'}`}>
            {painLevels.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => handleSelect(level.value)}
                className={`
                  ${useEmojiButtons
                    ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-full text-3xl sm:text-4xl flex-shrink-0'
                    : scaleSize === 10
                      ? 'flex-1 h-12 min-w-[40px] rounded'
                      : 'w-14 h-14 rounded-lg flex-shrink-0'
                  }
                  transition-all border-2 font-semibold
                  ${value === level.value
                    ? useEmojiButtons
                      ? `${level.bgColor} ${level.borderColor} shadow-lg scale-110`
                      : 'bg-primary-600 border-primary-700 text-white shadow-lg scale-105'
                    : useEmojiButtons
                      ? `bg-card ${level.borderColor} hover:${level.bgColor} hover:scale-105`
                      : 'bg-card border-border text-foreground hover:border-primary-400 hover:bg-secondary'
                  }
                  ${useEmojiButtons ? 'flex flex-col items-center justify-center' : ''}
                `}
              >
                {useEmojiButtons ? (
                  <>
                    <span className="mb-1">{level.emoji}</span>
                    <span className="text-sm font-bold">{level.value}</span>
                  </>
                ) : (
                  <span className="text-base">{level.value}</span>
                )}
              </button>
            ))}
          </div>

          {/* Scale indicator line for non-emoji versions */}
          {!useEmojiButtons && scaleSize === 10 && (
            <div className="mt-2">
              <div className="h-1 bg-gradient-to-r from-green-400 via-yellow-400 via-orange-400 to-red-600 rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      {/* Scale type indicator */}
      <div className="text-xs text-muted-foreground text-center mt-2">
        {scaleSize === 5 && '5-point pain scale'}
        {scaleSize === 6 && '6-point pain scale'}
        {scaleSize === 10 && '0-10 numeric pain scale'}
      </div>

      {/* Error message */}
      {error && (
        <p className="form-error mt-2 text-sm text-danger-600 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
