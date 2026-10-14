export default function FunctionalStatusField({
  field,
  value,
  onChange,
  error,
  className = ''
}) {
  // Extract configuration from field.config
  const scale = field.config?.scale || 'ECOG'; // 'ECOG', 'Karnofsky', or 'ADL'
  const showDescriptions = field.config?.showDescriptions !== false; // default true

  // ECOG Performance Status (0-5)
  const ecogLevels = [
    {
      value: 0,
      label: 'Grade 0',
      description: 'Fully active, able to carry on all pre-disease activities without restriction',
      color: '#22c55e'
    },
    {
      value: 1,
      label: 'Grade 1',
      description: 'Restricted in physically strenuous activity but ambulatory and able to carry out light work',
      color: '#84cc16'
    },
    {
      value: 2,
      label: 'Grade 2',
      description: 'Ambulatory and capable of all self-care but unable to carry out any work activities',
      color: '#eab308'
    },
    {
      value: 3,
      label: 'Grade 3',
      description: 'Capable of only limited self-care, confined to bed or chair >50% of waking hours',
      color: '#f59e0b'
    },
    {
      value: 4,
      label: 'Grade 4',
      description: 'Completely disabled, cannot carry on any self-care, totally confined to bed or chair',
      color: '#ef4444'
    },
    {
      value: 5,
      label: 'Grade 5',
      description: 'Dead',
      color: '#991b1b'
    }
  ];

  // Karnofsky Performance Scale (0-100 in increments of 10)
  const karnofskyLevels = [
    { value: 100, label: '100%', description: 'Normal, no complaints, no evidence of disease', color: '#22c55e' },
    { value: 90, label: '90%', description: 'Able to carry on normal activity, minor symptoms', color: '#84cc16' },
    { value: 80, label: '80%', description: 'Normal activity with effort, some symptoms', color: '#a3e635' },
    { value: 70, label: '70%', description: 'Cares for self, unable to carry on normal activity', color: '#eab308' },
    { value: 60, label: '60%', description: 'Requires occasional assistance', color: '#f59e0b' },
    { value: 50, label: '50%', description: 'Requires considerable assistance and frequent care', color: '#fb923c' },
    { value: 40, label: '40%', description: 'Disabled, requires special care and assistance', color: '#f97316' },
    { value: 30, label: '30%', description: 'Severely disabled, hospitalization indicated', color: '#ef4444' },
    { value: 20, label: '20%', description: 'Very sick, hospitalization necessary', color: '#dc2626' },
    { value: 10, label: '10%', description: 'Moribund, fatal processes progressing rapidly', color: '#991b1b' },
    { value: 0, label: '0%', description: 'Dead', color: '#7f1d1d' }
  ];

  // ADL Independence Scale (0-10)
  const adlLevels = [
    { value: 0, label: '0', description: 'Fully dependent in all activities', color: '#991b1b' },
    { value: 2, label: '2', description: 'Requires extensive assistance', color: '#ef4444' },
    { value: 4, label: '4', description: 'Requires moderate assistance', color: '#f59e0b' },
    { value: 6, label: '6', description: 'Requires minimal assistance', color: '#eab308' },
    { value: 8, label: '8', description: 'Mostly independent', color: '#84cc16' },
    { value: 10, label: '10', description: 'Fully independent in all activities', color: '#22c55e' }
  ];

  // Select appropriate scale
  let levels;
  if (scale === 'Karnofsky') {
    levels = karnofskyLevels;
  } else if (scale === 'ADL') {
    levels = adlLevels;
  } else {
    levels = ecogLevels;
  }

  const handleSelect = (val) => {
    onChange(val);
  };

  const isSelected = (val) => value === val;

  const getTextColor = (color) => {
    // If color is dark, use white text
    if (color.includes('991b1b') || color.includes('ef4444') || color.includes('dc2626') || color.includes('7f1d1d')) {
      return 'text-white';
    }
    return 'text-foreground';
  };

  return (
    <div className={`functional-status-field ${className}`}>
      {/* Scale title */}
      <div className="mb-4">
        <div className="font-semibold text-foreground">
          {scale === 'ECOG' && 'ECOG Performance Status'}
          {scale === 'Karnofsky' && 'Karnofsky Performance Scale'}
          {scale === 'ADL' && 'Activities of Daily Living (ADL) Independence'}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Select the level that best describes the patient's functional status
        </div>
      </div>

      {/* Status options */}
      <div className="space-y-2">
        {levels.map((level) => {
          const selected = isSelected(level.value);
          const textColor = getTextColor(level.color);

          return (
            <button
              key={level.value}
              type="button"
              onClick={() => handleSelect(level.value)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selected
                  ? `${textColor} shadow-lg scale-[1.02]`
                  : 'border-border hover:border-border/80 bg-card hover:bg-secondary'
              }`}
              style={selected ? { backgroundColor: level.color, borderColor: level.color } : {}}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selected
                    ? `${textColor.replace('text-', 'border-')} bg-white bg-opacity-30`
                    : 'border-border bg-card'
                }`}>
                  {selected && (
                    <svg className={textColor} fill="currentColor" viewBox="0 0 20 20" style={{ width: '14px', height: '14px' }}>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className={`font-semibold ${selected ? textColor : 'text-foreground'}`}>
                    {level.label}
                  </div>
                  {showDescriptions && level.description && (
                    <div className={`text-sm mt-1 ${selected ? `${textColor} opacity-90` : 'text-muted-foreground'}`}>
                      {level.description}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected value display */}
      {value !== null && value !== undefined && (
        <div className="mt-4 p-3 bg-secondary rounded border border-border">
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Selected: </span>
            <span className="font-semibold text-foreground">
              {levels.find(l => l.value === value)?.label || value}
            </span>
          </div>
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
