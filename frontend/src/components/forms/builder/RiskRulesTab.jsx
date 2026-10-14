import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Save, X } from 'lucide-react';
import riskApi from '../../../api/risk';

export default function RiskRulesTab({ formId, allFields }) {
  const [riskRules, setRiskRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);

  useEffect(() => {
    if (formId) {
      loadRiskRules();
    }
  }, [formId]);

  const loadRiskRules = async () => {
    try {
      setIsLoading(true);
      const response = await riskApi.getRiskRules(formId);
      setRiskRules(response.risk_rules || []);
    } catch (err) {
      console.error('Error loading risk rules:', err);
      setError('Failed to load risk rules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRule = async (ruleData) => {
    try {
      setIsSaving(true);
      setError('');

      if (editingRule) {
        // Update existing rule
        await riskApi.updateRiskRule(formId, editingRule.id, {
          condition: ruleData.condition
        });
      } else {
        // Create new rule
        await riskApi.createRiskRule(formId, ruleData);
      }

      await loadRiskRules();
      setEditingRule(null);
      setShowAddRule(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save risk rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this risk rule?')) {
      return;
    }

    try {
      setError('');
      await riskApi.deleteRiskRule(formId, ruleId);
      await loadRiskRules();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete risk rule');
    }
  };

  // Get available fields that can have risk rules
  const getAvailableFields = () => {
    if (!allFields) return [];

    // Fields that can have risk scoring: number, select, radio, painScale, linearScale
    const scorableTypes = ['number', 'select', 'radio', 'painScale', 'linearScale'];
    const availableFields = allFields.filter(f => scorableTypes.includes(f.type));

    // Exclude fields that already have rules (when adding new)
    if (!editingRule && showAddRule) {
      const usedFieldIds = riskRules.map(r => r.field_id);
      return availableFields.filter(f => !usedFieldIds.includes(f.id));
    }

    return availableFields;
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
        <h2 className="text-xl font-semibold text-foreground">Risk Scoring Rules</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure risk scores for form fields to calculate patient risk levels
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Rule Button */}
      {!showAddRule && !editingRule && (
        <button
          onClick={() => setShowAddRule(true)}
          className="btn-primary flex items-center gap-2"
          disabled={getAvailableFields().length === 0}
        >
          <Plus className="w-4 h-4" />
          Add Risk Rule
        </button>
      )}

      {/* No available fields message */}
      {getAvailableFields().length === 0 && !showAddRule && !editingRule && (
        <div className="alert-info">
          No fields available for risk scoring. Add numeric, select, or radio fields to your form first.
        </div>
      )}

      {/* Add/Edit Rule Form */}
      {(showAddRule || editingRule) && (
        <RuleEditor
          fields={getAvailableFields()}
          existingRule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowAddRule(false);
            setEditingRule(null);
          }}
          isSaving={isSaving}
        />
      )}

      {/* Risk Rules List */}
      {riskRules.length > 0 ? (
        <div className="space-y-4">
          {riskRules.map((rule) => (
            <RiskRuleCard
              key={rule.id}
              rule={rule}
              field={allFields?.find(f => f.id === rule.field_id)}
              onEdit={() => setEditingRule(rule)}
              onDelete={() => handleDeleteRule(rule.id)}
            />
          ))}
        </div>
      ) : !showAddRule && !editingRule && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">No risk rules configured yet</p>
        </div>
      )}
    </div>
  );
}

// Rule Editor Component
function RuleEditor({ fields, existingRule, onSave, onCancel, isSaving }) {
  const [selectedFieldId, setSelectedFieldId] = useState(existingRule?.field_id || '');
  const [ruleType, setRuleType] = useState(existingRule?.rule_type || 'categorical');
  const [condition, setCondition] = useState(existingRule?.condition || {});

  const selectedField = fields?.find(f => f.id === selectedFieldId);

  // Determine default rule type based on field type
  useEffect(() => {
    if (selectedField && !existingRule) {
      if (selectedField.type === 'number' || selectedField.type === 'painScale' || selectedField.type === 'linearScale') {
        setRuleType('range');
        setCondition({
          low: { lower: 0, upper: 3, score: 1 },
          moderate: { lower: 4, upper: 6, score: 2 },
          high: { lower: 7, upper: 10, score: 3 }
        });
      } else {
        setRuleType('categorical');
        const newCondition = {};
        (selectedField.options || []).forEach((opt, idx) => {
          newCondition[opt] = { score: idx + 1 };
        });
        setCondition(newCondition);
      }
    }
  }, [selectedField]);

  const handleSubmit = (e) => {
    e.preventDefault();

    onSave({
      field_id: selectedFieldId,
      rule_type: ruleType,
      condition
    });
  };

  const addRangeCondition = () => {
    const key = `range_${Object.keys(condition).length + 1}`;
    setCondition({
      ...condition,
      [key]: { lower: 0, upper: 10, score: 1 }
    });
  };

  const updateRangeCondition = (key, field, value) => {
    setCondition({
      ...condition,
      [key]: {
        ...condition[key],
        [field]: parseFloat(value) || 0
      }
    });
  };

  const removeRangeCondition = (key) => {
    const newCondition = { ...condition };
    delete newCondition[key];
    setCondition(newCondition);
  };

  const updateCategoricalScore = (category, score) => {
    setCondition({
      ...condition,
      [category]: { score: parseFloat(score) || 0 }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {existingRule ? 'Edit Risk Rule' : 'Add Risk Rule'}
        </h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground/70 hover:text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Field Selection */}
      <div className="form-group">
        <label className="form-label">Field</label>
        <select
          value={selectedFieldId}
          onChange={(e) => setSelectedFieldId(e.target.value)}
          className="input"
          required
          disabled={!!existingRule}
        >
          <option value="">Select a field...</option>
          {fields?.map(field => (
            <option key={field.id} value={field.id}>
              {field.label} ({field.type})
            </option>
          ))}
        </select>
      </div>

      {selectedField && (
        <>
          {/* Rule Type */}
          <div className="form-group">
            <label className="form-label">Rule Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              className="input"
              disabled={!!existingRule}
            >
              <option value="range">Range (for numeric values)</option>
              <option value="categorical">Categorical (for options)</option>
            </select>
          </div>

          {/* Range Conditions */}
          {ruleType === 'range' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="form-label">Score Ranges</label>
                <button
                  type="button"
                  onClick={addRangeCondition}
                  className="btn-secondary btn-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Range
                </button>
              </div>

              {Object.entries(condition).map(([key, range]) => (
                <div key={key} className="grid grid-cols-12 gap-2 items-center p-3 bg-secondary rounded">
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={range.lower || ''}
                      onChange={(e) => updateRangeCondition(key, 'lower', e.target.value)}
                      className="input input-sm"
                      placeholder="Min"
                      step="0.1"
                    />
                  </div>
                  <div className="col-span-1 text-center text-muted-foreground">-</div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={range.upper || ''}
                      onChange={(e) => updateRangeCondition(key, 'upper', e.target.value)}
                      className="input input-sm"
                      placeholder="Max"
                      step="0.1"
                    />
                  </div>
                  <div className="col-span-1 text-center text-muted-foreground">=</div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={range.score || ''}
                      onChange={(e) => updateRangeCondition(key, 'score', e.target.value)}
                      className="input input-sm"
                      placeholder="Score"
                      step="0.1"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => removeRangeCondition(key)}
                      className="text-danger-600 hover:text-danger-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Categorical Conditions */}
          {ruleType === 'categorical' && (
            <div className="space-y-2">
              <label className="form-label">Option Scores</label>
              {selectedField.options?.length > 0 ? (
                selectedField.options.map((option) => (
                  <div key={option} className="grid grid-cols-2 gap-2 items-center">
                    <div className="text-sm font-medium text-foreground">{option}</div>
                    <input
                      type="number"
                      value={condition[option]?.score || 0}
                      onChange={(e) => updateCategoricalScore(option, e.target.value)}
                      className="input input-sm"
                      placeholder="Score"
                      step="0.1"
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No options defined for this field</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={!selectedFieldId || isSaving}
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
              <span>{existingRule ? 'Update' : 'Create'} Rule</span>
            </>
          )}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Risk Rule Card Component
function RiskRuleCard({ rule, field, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-foreground">
            {field?.label || rule.field_id}
          </h4>
          <p className="text-sm text-muted-foreground">
            {rule.rule_type === 'range' ? 'Range Rule' : 'Categorical Rule'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="btn-secondary btn-sm">
            Edit
          </button>
          <button onClick={onDelete} className="btn-danger btn-sm">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Display Conditions */}
      <div className="bg-secondary rounded p-3 space-y-2">
        {rule.rule_type === 'range' ? (
          Object.entries(rule.condition).map(([key, range]) => (
            <div key={key} className="text-sm">
              <span className="font-medium">{range.lower}</span> -
              <span className="font-medium">{range.upper}</span> =
              <span className="text-primary-600 font-semibold ml-1">{range.score} points</span>
            </div>
          ))
        ) : (
          Object.entries(rule.condition).map(([category, data]) => (
            <div key={category} className="text-sm flex justify-between">
              <span>{category}</span>
              <span className="text-primary-600 font-semibold">{data.score} points</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
