import { useState, useEffect } from 'react';

export default function SymptomChecklistField({
  field,
  value,
  onChange,
  error,
  className = ''
}) {
  // Extract configuration from field.config
  const symptoms = field.config?.symptoms || ['Pain', 'Nausea', 'Fatigue', 'Weakness', 'Dizziness'];
  const severityLevels = field.config?.severityLevels || ['Mild', 'Moderate', 'Severe'];
  const allowMultiple = field.config?.allowMultiple !== false; // default true
  const showSeverity = field.config?.showSeverity !== false; // default true

  // Value format: { symptom: severity } or [symptom1, symptom2] if !showSeverity
  const [selectedSymptoms, setSelectedSymptoms] = useState(value || {});

  useEffect(() => {
    setSelectedSymptoms(value || {});
  }, [value]);

  const handleSymptomToggle = (symptom) => {
    if (!showSeverity) {
      // Simple toggle for array format
      const current = Array.isArray(selectedSymptoms) ? selectedSymptoms : [];
      const updated = current.includes(symptom)
        ? current.filter(s => s !== symptom)
        : [...current, symptom];
      setSelectedSymptoms(updated);
      onChange(updated);
      return;
    }

    // With severity - object format
    const updated = { ...selectedSymptoms };
    if (updated[symptom]) {
      // Remove symptom
      delete updated[symptom];
    } else {
      // Add symptom with default severity
      updated[symptom] = severityLevels[0];
    }
    setSelectedSymptoms(updated);
    onChange(updated);
  };

  const handleSeverityChange = (symptom, severity) => {
    const updated = { ...selectedSymptoms, [symptom]: severity };
    setSelectedSymptoms(updated);
    onChange(updated);
  };

  const isSymptomSelected = (symptom) => {
    if (!showSeverity && Array.isArray(selectedSymptoms)) {
      return selectedSymptoms.includes(symptom);
    }
    return symptom in selectedSymptoms;
  };

  const getSeverityColor = (severity) => {
    const severityIndex = severityLevels.indexOf(severity);
    const colors = ['#eab308', '#f59e0b', '#ef4444']; // yellow, orange, red
    return colors[severityIndex] || colors[0];
  };

  return (
    <div className={`symptom-checklist-field ${className}`}>
      <div className="space-y-3">
        {symptoms.map((symptom) => {
          const selected = isSymptomSelected(symptom);
          const currentSeverity = showSeverity ? selectedSymptoms[symptom] : null;

          return (
            <div
              key={symptom}
              className={`border rounded-lg p-3 transition-all ${
                selected
                  ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-500/20'
                  : 'border-border hover:border-border/80'
              }`}
            >
              {/* Symptom checkbox */}
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => handleSymptomToggle(symptom)}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className={`ml-3 font-medium ${selected ? 'text-primary-900 dark:text-primary-100' : 'text-foreground'}`}>
                  {symptom}
                </span>
              </label>

              {/* Severity selector (if enabled and symptom selected) */}
              {showSeverity && selected && (
                <div className="mt-3 ml-7">
                  <div className="flex gap-2">
                    {severityLevels.map((severity) => {
                      const isActive = currentSeverity === severity;
                      const bgColor = getSeverityColor(severity);

                      return (
                        <button
                          key={severity}
                          type="button"
                          onClick={() => handleSeverityChange(symptom, severity)}
                          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-all ${
                            isActive
                              ? 'text-white shadow-md scale-105'
                              : 'bg-secondary text-foreground hover:bg-secondary/80'
                          }`}
                          style={isActive ? { backgroundColor: bgColor } : {}}
                        >
                          {severity}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {Object.keys(selectedSymptoms).length > 0 && showSeverity && (
        <div className="mt-4 p-3 bg-secondary rounded border border-border">
          <div className="text-sm font-medium text-muted-foreground mb-2">Selected Symptoms:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedSymptoms).map(([symptom, severity]) => (
              <span
                key={symptom}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${getSeverityColor(severity)}20`,
                  color: getSeverityColor(severity)
                }}
              >
                {symptom}: {severity}
              </span>
            ))}
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
