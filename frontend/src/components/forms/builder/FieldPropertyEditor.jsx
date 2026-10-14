import { useState, useEffect } from 'react';
import { Settings, X, Plus } from 'lucide-react';
import ConditionalLogicBuilder from '../ConditionalLogicBuilder';
import ClinicalMappingEditor from './ClinicalMappingEditor';

export default function FieldPropertyEditor({ field, allFields = [], onUpdate, onClose }) {
  const [formData, setFormData] = useState({
    id: field?.id || '',
    type: field?.type || 'text',
    label: field?.label || '',
    placeholder: field?.placeholder || '',
    required: field?.required || false,
    helpText: field?.helpText || '',
    defaultValue: field?.defaultValue || '',
    validation: field?.validation || {},
    options: field?.options || [],
    visibilityRules: field?.visibilityRules || [],
    config: field?.config || (field?.type === 'painScale' ? { min: 0, max: 10, scaleSize: 10, showEmojis: true, showMainLabels: true } : undefined),
    clinicalMapping: field?.clinicalMapping || null,
  });

  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    if (field) {
      setFormData({
        id: field.id || '',
        type: field.type || 'text',
        label: field.label || '',
        placeholder: field.placeholder || '',
        required: field.required || false,
        helpText: field.helpText || '',
        defaultValue: field.defaultValue || '',
        validation: field.validation || {},
        options: field.options || [],
        visibilityRules: field.visibilityRules || [],
        config: field.config || (field.type === 'painScale' ? { min: 0, max: 10, scaleSize: 10, showEmojis: true, showMainLabels: true } : undefined),
        clinicalMapping: field.clinicalMapping || null,
      });
    }
  }, [field]);

  if (!field) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a field to edit its properties</p>
        </div>
      </div>
    );
  }

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleValidationChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      validation: { ...prev.validation, [key]: value },
    }));
  };

  const handleAddOption = () => {
    if (newOption.trim()) {
      setFormData((prev) => ({
        ...prev,
        options: [...prev.options, newOption.trim()],
      }));
      setNewOption('');
    }
  };

  const handleRemoveOption = (index) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    onUpdate(formData);
  };

  const showOptions = ['select', 'radio'].includes(formData.type);
  const showPlaceholder = ['text', 'email', 'numeric', 'number', 'textarea'].includes(formData.type);
  const showMinMax = ['numeric', 'number'].includes(formData.type);
  const showMaxLength = ['text', 'textarea'].includes(formData.type);
  const showPainScaleConfig = formData.type === 'painScale';
  const showNumericConfig = ['numeric', 'number'].includes(formData.type);
  const showPhoneConfig = formData.type === 'phone';
  const showSeverityRatingConfig = formData.type === 'severityRating';
  const showSymptomChecklistConfig = formData.type === 'symptomChecklist';
  const showFunctionalStatusConfig = formData.type === 'functionalStatus';
  const showRiskScoreDisplayConfig = formData.type === 'riskScoreDisplay';
  const showGeoLocationConfig = formData.type === 'geoLocation';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Field Properties</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground/70 hover:text-muted-foreground rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* Field ID - Read Only */}
        <div className="form-group">
          <label className="form-label text-muted-foreground">Field ID (Auto-generated)</label>
          <input
            type="text"
            value={formData.id}
            readOnly
            className="input bg-secondary cursor-not-allowed text-muted-foreground"
            title="Field ID is automatically generated and cannot be edited"
          />
          <p className="form-help text-xs text-muted-foreground">This ID is used internally for form data storage</p>
        </div>

        {/* Label */}
        <div className="form-group">
          <label className="form-label">Label</label>
          <input
            type="text"
            value={formData.label}
            onChange={(e) => handleChange('label', e.target.value)}
            className="input"
            placeholder="e.g., Patient Name"
          />
        </div>

        {/* Placeholder */}
        {showPlaceholder && (
          <div className="form-group">
            <label className="form-label">Placeholder</label>
            <input
              type="text"
              value={formData.placeholder}
              onChange={(e) => handleChange('placeholder', e.target.value)}
              className="input"
              placeholder="e.g., Enter patient name"
            />
          </div>
        )}

        {/* Required Toggle */}
        <div className="form-group">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.required}
              onChange={(e) => handleChange('required', e.target.checked)}
              className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-foreground">Required field</span>
          </label>
        </div>

        {/* Help Text */}
        <div className="form-group">
          <label className="form-label">Help Text</label>
          <textarea
            value={formData.helpText}
            onChange={(e) => handleChange('helpText', e.target.value)}
            className="input"
            rows={2}
            placeholder="Additional help or instructions"
          />
        </div>

        {/* Default Value */}
        {formData.type !== 'checkbox' && formData.type !== 'file' && (
          <div className="form-group">
            <label className="form-label">Default Value</label>
            {formData.type === 'select' || formData.type === 'radio' ? (
              <select
                value={formData.defaultValue}
                onChange={(e) => handleChange('defaultValue', e.target.value)}
                className="input"
              >
                <option value="">None</option>
                {formData.options.map((option, index) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : formData.type === 'textarea' ? (
              <textarea
                value={formData.defaultValue}
                onChange={(e) => handleChange('defaultValue', e.target.value)}
                className="input"
                rows={2}
                placeholder="Default value for this field"
              />
            ) : (
              <input
                type={['numeric', 'number'].includes(formData.type) ? 'number' : formData.type === 'date' ? 'date' : 'text'}
                value={formData.defaultValue}
                onChange={(e) => handleChange('defaultValue', e.target.value)}
                className="input"
                placeholder="Default value for this field"
                step={['numeric', 'number'].includes(formData.type) && formData.config?.allowDecimals ? 'any' : '1'}
              />
            )}
          </div>
        )}

        {/* Validation Rules */}
        <div className="border-t border-border pt-4">
          <h4 className="font-medium text-foreground mb-3">Validation Rules</h4>

          {/* Min/Max for numbers */}
          {showMinMax && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="form-group">
                <label className="form-label">Min Value</label>
                <input
                  type="number"
                  value={formData.validation.min || ''}
                  onChange={(e) =>
                    handleValidationChange('min', parseInt(e.target.value))
                  }
                  className="input"
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Value</label>
                <input
                  type="number"
                  value={formData.validation.max || ''}
                  onChange={(e) =>
                    handleValidationChange('max', parseInt(e.target.value))
                  }
                  className="input"
                  placeholder="100"
                />
              </div>
            </div>
          )}

          {/* Max Length for text */}
          {showMaxLength && (
            <div className="form-group">
              <label className="form-label">Max Length</label>
              <input
                type="number"
                value={formData.validation.maxLength || ''}
                onChange={(e) =>
                  handleValidationChange('maxLength', parseInt(e.target.value))
                }
                className="input"
                placeholder="e.g., 100"
              />
            </div>
          )}

          {/* Pattern (Regex) validation for text fields */}
          {['text', 'email'].includes(formData.type) && (
            <div className="form-group">
              <label className="form-label">Pattern (Regex)</label>
              <input
                type="text"
                value={formData.validation.pattern || ''}
                onChange={(e) => handleValidationChange('pattern', e.target.value)}
                className="input font-mono text-sm"
                placeholder="e.g., ^[A-Z]{2}[0-9]{6}$"
              />
              <p className="form-help">Regular expression for custom validation</p>
            </div>
          )}

          {/* Custom Error Message */}
          <div className="form-group">
            <label className="form-label">Custom Error Message</label>
            <input
              type="text"
              value={formData.validation.errorMessage || ''}
              onChange={(e) => handleValidationChange('errorMessage', e.target.value)}
              className="input"
              placeholder="e.g., Please enter a valid value"
            />
            <p className="form-help">Message shown when validation fails</p>
          </div>
        </div>

        {/* Options for select/radio */}
        {showOptions && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Options</h4>

            {/* Option List */}
            <div className="space-y-2 mb-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    readOnly
                    className="input flex-1"
                  />
                  <button
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-danger-600 hover:bg-danger-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Option */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                className="input flex-1"
                placeholder="Add option..."
              />
              <button
                onClick={handleAddOption}
                className="btn-primary flex items-center gap-1 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        )}

        {/* Pain Scale Configuration */}
        {showPainScaleConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Pain Scale Settings</h4>

            {/* Scale Size Dropdown */}
            <div className="form-group">
              <label className="form-label">Scale Size</label>
              <select
                value={formData.config?.scaleSize || 10}
                onChange={(e) => handleChange('config', { ...formData.config, scaleSize: parseInt(e.target.value) })}
                className="input"
              >
                <option value={5}>5-point scale (0, 2, 5, 7, 10)</option>
                <option value={6}>6-point scale (0, 2, 4, 6, 8, 10)</option>
                <option value={10}>10-point scale (0-10) - Medical standard</option>
              </select>
              <p className="form-help text-xs mt-1">
                {formData.config?.scaleSize === 5 && 'Simplified 5-level scale with emoji buttons'}
                {formData.config?.scaleSize === 6 && '6-level scale with emoji buttons'}
                {(formData.config?.scaleSize === 10 || !formData.config?.scaleSize) && 'Full 0-10 numeric scale (no emojis)'}
              </p>
            </div>

            {/* Show Emojis Toggle - only for 5 and 6 scales */}
            {(formData.config?.scaleSize === 5 || formData.config?.scaleSize === 6) && (
              <div className="form-group">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.config?.showEmojis !== false}
                    onChange={(e) => handleChange('config', { ...formData.config, showEmojis: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-foreground">Show emoji faces</span>
                </label>
              </div>
            )}

            {/* Show Main Labels Toggle */}
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config?.showMainLabels !== false}
                  onChange={(e) => handleChange('config', { ...formData.config, showMainLabels: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Show main pain level labels</span>
              </label>
              <p className="form-help text-xs mt-1">Display labels like "No pain", "Discomforting", "Intense", etc.</p>
            </div>
          </div>
        )}

        {/* Numeric Field Configuration */}
        {showNumericConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Numeric Settings</h4>

            {/* Allow Decimals Toggle */}
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config?.allowDecimals || false}
                  onChange={(e) => handleChange('config', { ...formData.config, allowDecimals: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Allow decimal/floating point numbers</span>
              </label>
              <p className="form-help text-xs mt-1">
                {formData.config?.allowDecimals
                  ? 'Field accepts decimals like 3.14, 98.6, etc.'
                  : 'Field only accepts whole numbers (integers)'}
              </p>
            </div>

            {/* Decimal Places */}
            {formData.config?.allowDecimals && (
              <div className="form-group">
                <label className="form-label">Decimal Places</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.config?.decimalPlaces || 2}
                  onChange={(e) => handleChange('config', { ...formData.config, decimalPlaces: parseInt(e.target.value) || 2 })}
                  className="input"
                  placeholder="2"
                />
                <p className="form-help text-xs mt-1">Maximum number of digits after decimal point</p>
              </div>
            )}

            {/* Calculated Field Info */}
            {formData.config?.isCalculated && (
              <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-400/30 rounded-lg p-3 mt-4">
                <h5 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">Auto-Calculated Field</h5>
                <div className="space-y-2 text-xs text-blue-600 dark:text-blue-400">
                  <div>
                    <span className="font-medium">Formula:</span>
                    <code className="ml-2 bg-card px-2 py-1 rounded border border-blue-200 dark:border-blue-400/30">
                      {formData.config.calculationFormula}
                    </code>
                  </div>
                  {formData.config.dependsOn && formData.config.dependsOn.length > 0 && (
                    <div>
                      <span className="font-medium">Depends on fields:</span>
                      <span className="ml-2">{formData.config.dependsOn.join(', ')}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Manual override:</span>
                    <span className="ml-2">{formData.config.allowOverride ? 'Allowed' : 'Not allowed'}</span>
                  </div>
                  <p className="mt-2 text-xs italic">
                    This field will automatically calculate its value based on other fields when forms are submitted.
                    {formData.config.allowOverride && ' Users can manually override the calculated value if needed.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Severity Rating Configuration */}
        {showSeverityRatingConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Severity Rating Settings</h4>

            <div className="form-group">
              <label className="form-label">Severity Levels (comma-separated)</label>
              <input
                type="text"
                value={(formData.config?.levels || ['None', 'Mild', 'Moderate', 'Severe', 'Critical']).join(', ')}
                onChange={(e) => handleChange('config', {
                  ...formData.config,
                  levels: e.target.value.split(',').map(l => l.trim()).filter(l => l)
                })}
                className="input"
                placeholder="None, Mild, Moderate, Severe, Critical"
              />
              <p className="form-help text-xs mt-1">Define severity levels from lowest to highest</p>
            </div>

            <div className="form-group">
              <label className="form-label">Layout</label>
              <select
                value={formData.config?.layout || 'horizontal'}
                onChange={(e) => handleChange('config', { ...formData.config, layout: e.target.value })}
                className="input"
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </div>
          </div>
        )}

        {/* Symptom Checklist Configuration */}
        {showSymptomChecklistConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Symptom Checklist Settings</h4>

            <div className="form-group">
              <label className="form-label">Symptoms (comma-separated)</label>
              <textarea
                value={(formData.config?.symptoms || ['Pain', 'Nausea', 'Fatigue', 'Weakness', 'Dizziness']).join(', ')}
                onChange={(e) => handleChange('config', {
                  ...formData.config,
                  symptoms: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                })}
                className="input"
                rows="3"
                placeholder="Pain, Nausea, Fatigue, Weakness, Dizziness"
              />
              <p className="form-help text-xs mt-1">List symptoms to track</p>
            </div>

            <div className="form-group">
              <label className="form-label">Severity Levels (comma-separated)</label>
              <input
                type="text"
                value={(formData.config?.severityLevels || ['Mild', 'Moderate', 'Severe']).join(', ')}
                onChange={(e) => handleChange('config', {
                  ...formData.config,
                  severityLevels: e.target.value.split(',').map(l => l.trim()).filter(l => l)
                })}
                className="input"
                placeholder="Mild, Moderate, Severe"
              />
              <p className="form-help text-xs mt-1">Severity options for each symptom</p>
            </div>

            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config?.showSeverity !== false}
                  onChange={(e) => handleChange('config', { ...formData.config, showSeverity: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Show severity sub-ratings</span>
              </label>
            </div>
          </div>
        )}

        {/* Functional Status Configuration */}
        {showFunctionalStatusConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Functional Status Settings</h4>

            <div className="form-group">
              <label className="form-label">Performance Scale</label>
              <select
                value={formData.config?.scale || 'ECOG'}
                onChange={(e) => handleChange('config', { ...formData.config, scale: e.target.value })}
                className="input"
              >
                <option value="ECOG">ECOG Performance Status (0-5)</option>
                <option value="Karnofsky">Karnofsky Performance Scale (0-100)</option>
                <option value="ADL">ADL Independence Scale (0-10)</option>
              </select>
              <p className="form-help text-xs mt-1">Select appropriate clinical scale</p>
            </div>

            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config?.showDescriptions !== false}
                  onChange={(e) => handleChange('config', { ...formData.config, showDescriptions: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Show detailed descriptions</span>
              </label>
            </div>
          </div>
        )}

        {/* Risk Score Display Configuration */}
        {showRiskScoreDisplayConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Risk Score Display Settings</h4>

            <div className="form-group">
              <label className="form-label">Display Mode</label>
              <select
                value={formData.config?.display || 'gauge'}
                onChange={(e) => handleChange('config', { ...formData.config, display: e.target.value })}
                className="input"
              >
                <option value="gauge">Circular Gauge</option>
                <option value="badge">Badge with Score</option>
                <option value="bar">Progress Bar</option>
              </select>
              <p className="form-help text-xs mt-1">How to visualize the risk score</p>
            </div>

            <div className="alert-info text-xs">
              <p><strong>Note:</strong> Risk score is automatically calculated from form fields with risk rules. Configure risk rules in the "Risk Rules" tab.</p>
            </div>
          </div>
        )}

        {/* Phone Number Configuration */}
        {showPhoneConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Phone Number Settings</h4>

            {/* Default Country Code */}
            <div className="form-group">
              <label className="form-label">Default Country Code</label>
              <select
                value={formData.config?.defaultCountryCode || '+91'}
                onChange={(e) => handleChange('config', { ...formData.config, defaultCountryCode: e.target.value })}
                className="input"
              >
                <option value="+91">🇮🇳 India (+91)</option>
                <option value="+1">🇺🇸 USA/Canada (+1)</option>
                <option value="+44">🇬🇧 UK (+44)</option>
                <option value="+971">🇦🇪 UAE (+971)</option>
                <option value="+966">🇸🇦 Saudi Arabia (+966)</option>
                <option value="+65">🇸🇬 Singapore (+65)</option>
                <option value="+61">🇦🇺 Australia (+61)</option>
                <option value="+81">🇯🇵 Japan (+81)</option>
                <option value="+86">🇨🇳 China (+86)</option>
              </select>
              <p className="form-help text-xs mt-1">Country code pre-selected for users</p>
            </div>
          </div>
        )}

        {/* Geo-Location Configuration */}
        {showGeoLocationConfig && (
          <div className="border-t border-border pt-4">
            <h4 className="font-medium text-foreground mb-3">Geo-Location Settings</h4>

            {/* Capture GPS Toggle */}
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config?.captureGPS !== false}
                  onChange={(e) => handleChange('config', { ...formData.config, captureGPS: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Capture GPS Coordinates</span>
              </label>
              <p className="form-help text-xs mt-1">
                Auto-capture latitude and longitude from user's device
              </p>
            </div>

            {/* Capture IP Toggle */}
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config?.captureIP !== false}
                  onChange={(e) => handleChange('config', { ...formData.config, captureIP: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Capture IP Address</span>
              </label>
              <p className="form-help text-xs mt-1">
                Auto-detect and store user's IP address
              </p>
            </div>

            {/* Allow Manual Address Toggle */}
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.config?.allowManualAddress !== false}
                  onChange={(e) => handleChange('config', { ...formData.config, allowManualAddress: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Allow Manual Address Input</span>
              </label>
              <p className="form-help text-xs mt-1">
                Let users manually enter their address
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-400/30 rounded-lg p-3 mt-3">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                <span className="font-medium">Note:</span> GPS capture requires user permission in the browser.
                IP address is detected automatically. Manual address provides a fallback option.
              </p>
            </div>
          </div>
        )}

        {/* Clinical Mapping - For fields that can produce observations */}
        {(formData.type === 'number' || formData.type === 'painScale' || formData.type === 'linearScale') && (
          <div className="border-t border-border pt-4">
            <ClinicalMappingEditor
              value={formData.clinicalMapping}
              onChange={(mapping) => handleChange('clinicalMapping', mapping)}
            />
          </div>
        )}

        {/* Conditional Logic */}
        <div className="border-t border-border pt-4">
          <ConditionalLogicBuilder
            fields={allFields}
            currentFieldId={formData.id}
            visibilityRules={formData.visibilityRules}
            onChange={(rules) => handleChange('visibilityRules', rules)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary flex-1">
          Save Changes
        </button>
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
