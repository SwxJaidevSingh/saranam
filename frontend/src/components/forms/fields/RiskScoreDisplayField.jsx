import { useMemo } from 'react';

export default function RiskScoreDisplayField({
  field,
  value,  // Not used - this is a calculated field
  formData,  // All form data to calculate from
  riskRules,  // Risk rules for the form
  riskLevels, // Risk level thresholds
  className = ''
}) {
  // Extract configuration from field.config
  const display = field.config?.display || 'gauge'; // 'gauge', 'badge', or 'bar'
  const thresholds = field.config?.thresholds || { low: 3, moderate: 6, high: 9 };

  // Calculate risk score from form data and risk rules
  const riskScore = useMemo(() => {
    if (!formData || !riskRules || riskRules.length === 0) {
      return {
        total: 0,
        level: 'Not Assessed',
        fieldScores: {},
        color: '#6b7280'
      };
    }

    let total = 0;
    const fieldScores = {};

    // Calculate score for each field with a risk rule
    riskRules.forEach(rule => {
      const fieldValue = formData[rule.field_id];
      if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
        let score = 0;

        if (rule.rule_type === 'range') {
          // Range rule: find matching range
          const numValue = parseFloat(fieldValue);
          if (!isNaN(numValue)) {
            Object.entries(rule.condition).forEach(([key, range]) => {
              if (range.lower !== undefined && range.upper !== undefined) {
                if (numValue >= range.lower && numValue <= range.upper) {
                  score = parseFloat(range.score) || 0;
                }
              }
            });
          }
        } else if (rule.rule_type === 'categorical') {
          // Categorical rule: exact match
          const condition = rule.condition[fieldValue];
          if (condition) {
            score = parseFloat(condition.score) || 0;
          }
        }

        if (score > 0) {
          fieldScores[rule.field_id] = score;
          total += score;
        }
      }
    });

    // Determine risk level
    let level = 'Low';
    let color = '#22c55e'; // green

    if (riskLevels && riskLevels.length > 0) {
      // Use configured risk levels
      const sortedLevels = [...riskLevels].sort((a, b) => parseFloat(a.min_score) - parseFloat(b.min_score));
      for (const riskLevel of sortedLevels) {
        const minScore = parseFloat(riskLevel.min_score);
        const maxScore = parseFloat(riskLevel.max_score);
        if (total >= minScore && total <= maxScore) {
          level = riskLevel.level_name;
          color = riskLevel.color_code || color;
          break;
        }
      }
    } else {
      // Use default thresholds
      if (total === 0) {
        level = 'Not Assessed';
        color = '#6b7280'; // gray
      } else if (total <= thresholds.low) {
        level = 'Low';
        color = '#22c55e'; // green
      } else if (total <= thresholds.moderate) {
        level = 'Moderate';
        color = '#f59e0b'; // orange
      } else if (total <= thresholds.high) {
        level = 'High';
        color = '#ef4444'; // red
      } else {
        level = 'Critical';
        color = '#991b1b'; // dark red
      }
    }

    return {
      total,
      level,
      fieldScores,
      color
    };
  }, [formData, riskRules, riskLevels, thresholds]);

  // Render gauge display
  const renderGauge = () => {
    const maxScore = riskLevels && riskLevels.length > 0
      ? Math.max(...riskLevels.map(l => parseFloat(l.max_score)))
      : 20;
    const percentage = Math.min((riskScore.total / maxScore) * 100, 100);

    return (
      <div className="flex flex-col items-center p-6 bg-secondary rounded-lg">
        {/* Circular gauge */}
        <div className="relative w-48 h-48">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="hsl(var(--border))"
              strokeWidth="10"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke={riskScore.color}
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${percentage * 2.51} 251`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold" style={{ color: riskScore.color }}>
              {riskScore.total.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Risk Score</div>
          </div>
        </div>

        {/* Risk level badge */}
        <div className="mt-4">
          <div
            className="px-6 py-2 rounded-full text-white font-semibold text-lg"
            style={{ backgroundColor: riskScore.color }}
          >
            {riskScore.level}
          </div>
        </div>
      </div>
    );
  };

  // Render badge display
  const renderBadge = () => {
    return (
      <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
        <div>
          <div className="text-sm text-muted-foreground">Risk Score</div>
          <div className="text-3xl font-bold text-foreground mt-1">
            {riskScore.total.toFixed(1)}
          </div>
        </div>
        <div
          className="px-6 py-3 rounded-lg text-white font-semibold text-lg"
          style={{ backgroundColor: riskScore.color }}
        >
          {riskScore.level}
        </div>
      </div>
    );
  };

  // Render bar display
  const renderBar = () => {
    const maxScore = riskLevels && riskLevels.length > 0
      ? Math.max(...riskLevels.map(l => parseFloat(l.max_score)))
      : 20;
    const percentage = Math.min((riskScore.total / maxScore) * 100, 100);

    return (
      <div className="p-4 bg-secondary rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-muted-foreground">Risk Score</div>
          <div className="text-2xl font-bold" style={{ color: riskScore.color }}>
            {riskScore.total.toFixed(1)}
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-8 mb-2">
          <div
            className="h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor: riskScore.color
            }}
          >
            <span className="text-xs font-semibold text-white">
              {riskScore.level}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`risk-score-display-field ${className}`}>
      {/* Display based on config */}
      {display === 'gauge' && renderGauge()}
      {display === 'badge' && renderBadge()}
      {display === 'bar' && renderBar()}

      {/* Field breakdown (if scores exist) */}
      {Object.keys(riskScore.fieldScores).length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            View Score Breakdown
          </summary>
          <div className="mt-2 space-y-1">
            {Object.entries(riskScore.fieldScores).map(([fieldId, score]) => (
              <div key={fieldId} className="flex justify-between text-sm py-1 px-2 bg-card rounded">
                <span className="text-muted-foreground">{fieldId}</span>
                <span className="font-semibold text-foreground">+{score}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm py-2 px-2 bg-secondary rounded font-semibold border-t-2 border-border mt-2">
              <span>Total</span>
              <span>{riskScore.total.toFixed(1)}</span>
            </div>
          </div>
        </details>
      )}

      {/* Info message when no rules */}
      {(!riskRules || riskRules.length === 0) && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Configure risk rules in the form builder to enable risk scoring
        </div>
      )}
    </div>
  );
}
