import { useState } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * Conditional Logic Builder Component
 * Allows users to create visibility rules for form fields
 */
export default function ConditionalLogicBuilder({ fields, currentFieldId, visibilityRules = [], onChange }) {
  const [rules, setRules] = useState(visibilityRules);

  // Available fields (exclude current field and non-input fields like sections)
  const availableFields = fields.filter(
    (f) => f.id !== currentFieldId && f.type !== 'section'
  );

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'notEquals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'notContains', label: 'Does not contain' },
    { value: 'greaterThan', label: 'Greater than' },
    { value: 'lessThan', label: 'Less than' },
    { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
    { value: 'lessThanOrEqual', label: 'Less than or equal' },
  ];

  const addRule = () => {
    if (availableFields.length === 0) {
      alert('No fields available for conditional logic');
      return;
    }

    const newRule = {
      field: availableFields[0].id,
      operator: 'equals',
      value: '',
    };

    const updatedRules = [...rules, newRule];
    setRules(updatedRules);
    onChange(updatedRules);
  };

  const updateRule = (index, property, value) => {
    const updatedRules = rules.map((rule, i) =>
      i === index ? { ...rule, [property]: value } : rule
    );
    setRules(updatedRules);
    onChange(updatedRules);
  };

  const removeRule = (index) => {
    const updatedRules = rules.filter((_, i) => i !== index);
    setRules(updatedRules);
    onChange(updatedRules);
  };

  const getFieldOptions = (fieldId) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field && (field.type === 'select' || field.type === 'radio')) {
      return field.options || [];
    }
    return [];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="form-label">Conditional Visibility</label>
        <button
          type="button"
          onClick={addRule}
          className="btn-ghost text-sm flex items-center gap-1"
          disabled={availableFields.length === 0}
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {availableFields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add more fields to the form to enable conditional logic.
        </p>
      )}

      {rules.length === 0 && availableFields.length > 0 && (
        <p className="text-sm text-muted-foreground">
          This field is always visible. Add rules to conditionally show/hide it.
        </p>
      )}

      {rules.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Show this field when <strong>ALL</strong> of the following conditions are met:
          </p>

          {rules.map((rule, index) => {
            const selectedField = fields.find((f) => f.id === rule.field);
            const fieldOptions = getFieldOptions(rule.field);

            return (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-secondary rounded-lg border border-border"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {/* Field Selection */}
                  <div>
                    <select
                      value={rule.field}
                      onChange={(e) => updateRule(index, 'field', e.target.value)}
                      className="input text-sm"
                    >
                      {availableFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operator Selection */}
                  <div>
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(index, 'operator', e.target.value)}
                      className="input text-sm"
                    >
                      {operators.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Value Input */}
                  <div>
                    {fieldOptions.length > 0 ? (
                      <select
                        value={rule.value}
                        onChange={(e) => updateRule(index, 'value', e.target.value)}
                        className="input text-sm"
                      >
                        <option value="">Select value...</option>
                        {fieldOptions.map((option, optIndex) => (
                          <option key={optIndex} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={selectedField?.type === 'number' ? 'number' : 'text'}
                        value={rule.value}
                        onChange={(e) => updateRule(index, 'value', e.target.value)}
                        placeholder="Enter value..."
                        className="input text-sm"
                      />
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="p-2 text-danger-600 hover:bg-danger-50 rounded"
                  title="Remove rule"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {rules.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Note: The field will be hidden if any condition is not met.
        </p>
      )}
    </div>
  );
}
