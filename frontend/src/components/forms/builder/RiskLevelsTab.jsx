import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Save } from 'lucide-react';
import riskApi from '../../../api/risk';

// Default risk levels
const DEFAULT_RISK_LEVELS = [
  { level_name: 'Low', min_score: 0, max_score: 3, color_code: '#22c55e', description: 'Patient requires standard monitoring and treatment' },
  { level_name: 'Moderate', min_score: 3.1, max_score: 6, color_code: '#f59e0b', description: 'Patient requires enhanced monitoring and intervention' },
  { level_name: 'High', min_score: 6.1, max_score: 9, color_code: '#ef4444', description: 'Patient requires immediate attention and frequent follow-up' },
  { level_name: 'Critical', min_score: 9.1, max_score: 20, color_code: '#991b1b', description: 'Patient requires urgent medical intervention' }
];

export default function RiskLevelsTab({ formId }) {
  const [riskLevels, setRiskLevels] = useState(DEFAULT_RISK_LEVELS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (formId) {
      loadRiskLevels();
    }
  }, [formId]);

  const loadRiskLevels = async () => {
    try {
      setIsLoading(true);
      const response = await riskApi.getRiskLevels(formId);
      if (response.risk_levels && response.risk_levels.length > 0) {
        setRiskLevels(response.risk_levels.map(level => ({
          id: level.id,
          level_name: level.level_name,
          min_score: parseFloat(level.min_score),
          max_score: parseFloat(level.max_score),
          color_code: level.color_code || '#6b7280',
          description: level.description || ''
        })));
      } else {
        // Use defaults if none exist
        setRiskLevels(DEFAULT_RISK_LEVELS);
      }
      setHasChanges(false);
    } catch (err) {
      console.error('Error loading risk levels:', err);
      setError('Failed to load risk levels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');

      // Validate levels
      const validation = validateLevels(riskLevels);
      if (!validation.valid) {
        setError(validation.error);
        return;
      }

      await riskApi.setRiskLevels(formId, { levels: riskLevels });
      setHasChanges(false);

      // Show success message (could use a toast notification)
      alert('Risk levels saved successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save risk levels');
    } finally {
      setIsSaving(false);
    }
  };

  const validateLevels = (levels) => {
    if (levels.length === 0) {
      return { valid: false, error: 'At least one risk level is required' };
    }

    for (const level of levels) {
      if (!level.level_name || level.level_name.trim() === '') {
        return { valid: false, error: 'All risk levels must have a name' };
      }
      if (level.min_score >= level.max_score) {
        return { valid: false, error: `${level.level_name}: Min score must be less than max score` };
      }
    }

    // Check for overlaps
    const sorted = [...levels].sort((a, b) => a.min_score - b.min_score);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].max_score >= sorted[i + 1].min_score) {
        return { valid: false, error: 'Risk level ranges overlap or have gaps' };
      }
    }

    return { valid: true };
  };

  const addLevel = () => {
    const lastLevel = riskLevels[riskLevels.length - 1];
    const newLevel = {
      level_name: 'New Level',
      min_score: lastLevel ? lastLevel.max_score + 0.1 : 0,
      max_score: lastLevel ? lastLevel.max_score + 5 : 5,
      color_code: '#6b7280',
      description: ''
    };
    setRiskLevels([...riskLevels, newLevel]);
    setHasChanges(true);
  };

  const updateLevel = (index, field, value) => {
    const updated = [...riskLevels];
    updated[index] = {
      ...updated[index],
      [field]: field.includes('score') ? parseFloat(value) || 0 : value
    };
    setRiskLevels(updated);
    setHasChanges(true);
  };

  const removeLevel = (index) => {
    if (riskLevels.length <= 1) {
      alert('At least one risk level is required');
      return;
    }
    setRiskLevels(riskLevels.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    if (confirm('Reset to default risk levels? Any unsaved changes will be lost.')) {
      setRiskLevels(DEFAULT_RISK_LEVELS);
      setHasChanges(true);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-secondary rounded w-3/4" />
          <div className="h-4 bg-secondary rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Risk Level Thresholds</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define risk level categories and score ranges for patient assessment
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={addLevel}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Level
          </button>
          <button
            onClick={resetToDefaults}
            className="btn-secondary"
          >
            Reset to Defaults
          </button>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="spinner" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Risk Levels List */}
      <div className="space-y-4">
        {riskLevels.map((level, index) => (
          <RiskLevelCard
            key={index}
            level={level}
            index={index}
            onUpdate={(field, value) => updateLevel(index, field, value)}
            onDelete={() => removeLevel(index)}
            canDelete={riskLevels.length > 1}
          />
        ))}
      </div>

      {/* Preview */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Risk Level Preview</h3>
        <div className="space-y-3">
          {riskLevels
            .sort((a, b) => a.min_score - b.min_score)
            .map((level, index) => (
              <div key={index} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: level.color_code }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{level.level_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {level.min_score} - {level.max_score} points
                    </span>
                  </div>
                  {level.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{level.description}</p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="alert-info">
        <p className="text-sm">
          <strong>Tip:</strong> Ensure risk level ranges are continuous with no gaps or overlaps.
          The minimum score of each level should be slightly higher than the maximum of the previous level.
        </p>
      </div>
    </div>
  );
}

// Risk Level Card Component
function RiskLevelCard({ level, index, onUpdate, onDelete, canDelete }) {
  return (
    <div className="card">
      <div className="grid grid-cols-12 gap-4">
        {/* Level Name */}
        <div className="col-span-12 md:col-span-3">
          <label className="form-label">Level Name</label>
          <input
            type="text"
            value={level.level_name}
            onChange={(e) => onUpdate('level_name', e.target.value)}
            className="input"
            placeholder="e.g., Low, Moderate"
          />
        </div>

        {/* Min Score */}
        <div className="col-span-6 md:col-span-2">
          <label className="form-label">Min Score</label>
          <input
            type="number"
            value={level.min_score}
            onChange={(e) => onUpdate('min_score', e.target.value)}
            className="input"
            step="0.1"
            min="0"
          />
        </div>

        {/* Max Score */}
        <div className="col-span-6 md:col-span-2">
          <label className="form-label">Max Score</label>
          <input
            type="number"
            value={level.max_score}
            onChange={(e) => onUpdate('max_score', e.target.value)}
            className="input"
            step="0.1"
            min="0"
          />
        </div>

        {/* Color */}
        <div className="col-span-6 md:col-span-2">
          <label className="form-label">Color</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={level.color_code}
              onChange={(e) => onUpdate('color_code', e.target.value)}
              className="w-12 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={level.color_code}
              onChange={(e) => onUpdate('color_code', e.target.value)}
              className="input flex-1 font-mono text-sm"
              placeholder="#22c55e"
            />
          </div>
        </div>

        {/* Delete Button */}
        <div className="col-span-6 md:col-span-1 flex items-end">
          <button
            onClick={onDelete}
            disabled={!canDelete}
            className="btn-danger w-full h-10"
            title="Delete level"
          >
            <Trash2 className="w-4 h-4 mx-auto" />
          </button>
        </div>

        {/* Description */}
        <div className="col-span-12 md:col-span-10">
          <label className="form-label">Description</label>
          <input
            type="text"
            value={level.description}
            onChange={(e) => onUpdate('description', e.target.value)}
            className="input"
            placeholder="Describe what this risk level means..."
          />
        </div>
      </div>
    </div>
  );
}
