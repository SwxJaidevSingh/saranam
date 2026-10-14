import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Send, ChevronLeft, ChevronRight } from 'lucide-react';
import LinearScaleField from './fields/LinearScaleField';
import SectionHeader from './fields/SectionHeader';
import FileUploadField from './fields/FileUploadField';
import PainScaleField from './fields/PainScaleField';
import SeverityRatingField from './fields/SeverityRatingField';
import SymptomChecklistField from './fields/SymptomChecklistField';
import FunctionalStatusField from './fields/FunctionalStatusField';
import RiskScoreDisplayField from './fields/RiskScoreDisplayField';
import GeoLocationField from './fields/GeoLocationField';
import CalculatedField from './fields/CalculatedField';
import ProgressBar from './ProgressBar';

export default function FormRenderer({ schema, onSubmit, isLoading = false, defaultValues = {}, showProgress = true }) {
  // Multi-page state
  const isMultiPage = schema?.pages && schema.pages.length > 0;
  const [currentPage, setCurrentPage] = useState(0);
  // Get all fields and create default values from field definitions
  const allFields = schema?.fields || (schema?.pages || []).flatMap(page => page.fields || []);
  const fieldDefaults = allFields.reduce((acc, field) => {
    if (field.defaultValue !== undefined && field.defaultValue !== '') {
      acc[field.id] = field.defaultValue;
    }
    return acc;
  }, {});

  // Merge field defaults with provided defaultValues
  const mergedDefaults = { ...fieldDefaults, ...defaultValues };

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: mergedDefaults });

  // Reset form when defaultValues change (e.g., when patient is selected)
  useEffect(() => {
    reset(mergedDefaults);
  }, [defaultValues]);

  // Watch all form values for conditional logic
  const formValues = watch();

  /**
   * Evaluate if a field should be visible based on its visibility rules
   */
  const isFieldVisible = (field) => {
    if (!field.visibilityRules || field.visibilityRules.length === 0) {
      return true; // No rules = always visible
    }

    // ALL rules must be satisfied (AND logic)
    return field.visibilityRules.every((rule) => {
      const fieldValue = formValues[rule.field];
      const ruleValue = rule.value;

      switch (rule.operator) {
        case 'equals':
          return fieldValue === ruleValue;
        case 'notEquals':
          return fieldValue !== ruleValue;
        case 'contains':
          return String(fieldValue || '').toLowerCase().includes(String(ruleValue).toLowerCase());
        case 'notContains':
          return !String(fieldValue || '').toLowerCase().includes(String(ruleValue).toLowerCase());
        case 'greaterThan':
          return Number(fieldValue) > Number(ruleValue);
        case 'lessThan':
          return Number(fieldValue) < Number(ruleValue);
        case 'greaterThanOrEqual':
          return Number(fieldValue) >= Number(ruleValue);
        case 'lessThanOrEqual':
          return Number(fieldValue) <= Number(ruleValue);
        default:
          return true;
      }
    });
  };

  const renderField = (field) => {
    // Build validation rules
    const validationRules = {
      required: field.required
        ? (field.validation?.errorMessage || `${field.label} is required`)
        : false,
    };

    // Add pattern validation if specified
    if (field.validation?.pattern) {
      try {
        validationRules.pattern = {
          value: new RegExp(field.validation.pattern),
          message: field.validation?.errorMessage || 'Invalid format',
        };
      } catch (e) {
        console.warn(`Invalid regex pattern for field ${field.id}:`, field.validation.pattern);
      }
    }

    // Add min/max validation for numeric fields
    if (['numeric', 'number'].includes(field.type)) {
      if (field.validation?.min !== undefined) {
        validationRules.min = {
          value: field.validation.min,
          message: field.validation?.errorMessage || `Minimum value is ${field.validation.min}`,
        };
      }
      if (field.validation?.max !== undefined) {
        validationRules.max = {
          value: field.validation.max,
          message: field.validation?.errorMessage || `Maximum value is ${field.validation.max}`,
        };
      }
    }

    // Add maxLength validation for text fields
    if (field.validation?.maxLength) {
      validationRules.maxLength = {
        value: field.validation.maxLength,
        message: field.validation?.errorMessage || `Maximum length is ${field.validation.maxLength} characters`,
      };
    }

    const commonProps = {
      id: field.id,
      className: errors[field.id] ? 'input-error' : 'input',
      ...register(field.id, validationRules),
    };

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <input
            type={field.type}
            placeholder={field.placeholder}
            {...commonProps}
          />
        );

      case 'number':
      case 'numeric':
        return (
          <input
            type="number"
            placeholder={field.placeholder}
            step={field.config?.allowDecimals ? 'any' : '1'}
            {...commonProps}
          />
        );

      case 'date':
        return <input type="date" {...commonProps} />;

      case 'textarea':
        return (
          <textarea
            rows={4}
            placeholder={field.placeholder}
            {...commonProps}
          />
        );

      case 'select':
        return (
          <select {...commonProps}>
            <option value="">Select {field.label}</option>
            {field.options?.map((option, idx) => {
              // Handle both string and object options {label, value}
              const optionValue = typeof option === 'string' ? option : (option.value || option.label);
              const optionLabel = typeof option === 'string' ? option : (option.label || option.value);
              return (
                <option key={optionValue || idx} value={optionValue}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={field.id}
              className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
              {...register(field.id, {
                required: field.required ? `${field.label} is required` : false,
              })}
            />
            <label htmlFor={field.id} className="text-sm text-foreground">
              {field.label}
            </label>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, idx) => {
              // Handle both string and object options {label, value}
              const optionValue = typeof option === 'string' ? option : (option.value || option.label);
              const optionLabel = typeof option === 'string' ? option : (option.label || option.value);
              return (
                <div key={optionValue || idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`${field.id}-${optionValue}`}
                    value={optionValue}
                    className="w-4 h-4 text-primary-600 border-border focus:ring-primary-500"
                    {...register(field.id, {
                      required: field.required ? `${field.label} is required` : false,
                    })}
                  />
                  <label htmlFor={`${field.id}-${optionValue}`} className="text-sm text-foreground">
                    {optionLabel}
                  </label>
                </div>
              );
            })}
          </div>
        );

      case 'time':
        return <input type="time" {...commonProps} />;

      case 'url':
        return (
          <input
            type="url"
            placeholder={field.placeholder || 'https://example.com'}
            {...commonProps}
          />
        );

      case 'phone':
        // Phone field handled separately with Controller below
        return null;

      case 'linearScale':
      case 'painScale':
      case 'file':
      case 'section':
      case 'severityRating':
      case 'symptomChecklist':
      case 'functionalStatus':
      case 'riskScoreDisplay':
      case 'geoLocation':
      case 'calculated':
        // These are handled separately below with Controller or custom rendering
        return null;

      default:
        return null;
    }
  };

  // Get fields for current page or all fields
  const fieldsToRender = isMultiPage
    ? (schema.pages[currentPage]?.fields || [])
    : allFields;

  const handleNext = () => {
    if (currentPage < schema.pages.length - 1) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isLastPage = !isMultiPage || currentPage === schema.pages.length - 1;

  // Prevent accidental form submission on Enter key (except on last page)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isLastPage) {
      // Check if the target is not a textarea (allow Enter in textarea)
      if (e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        // Trigger next page navigation instead
        handleNext();
      }
    }
  };

  return (
    <div>
      {/* Progress Indicator for Multi-Page Forms */}
      {isMultiPage && showProgress && (
        <ProgressBar
          currentPage={currentPage}
          totalPages={schema.pages.length}
          pages={schema.pages}
          onPageClick={setCurrentPage}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-6">
        {fieldsToRender
          .filter(field => isFieldVisible(field))
          .map((field) => {
          // Handle section headers separately (non-input element)
          if (field.type === 'section') {
            return <SectionHeader key={field.id} field={field} />;
          }

          // Handle linearScale with Controller
          if (field.type === 'linearScale') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false
                  }}
                  render={({ field: { value, onChange } }) => (
                    <LinearScaleField
                      field={field}
                      value={value}
                      onChange={onChange}
                      error={errors[field.id]?.message}
                    />
                  )}
                />

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle painScale with Controller
          if (field.type === 'painScale') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false
                  }}
                  render={({ field: { value, onChange } }) => (
                    <PainScaleField
                      field={field}
                      value={value}
                      onChange={onChange}
                      error={errors[field.id]?.message}
                    />
                  )}
                />

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle phone number with country code
          if (field.type === 'phone') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false,
                    pattern: {
                      value: /^(\+\d{1,4})\s?\d{6,15}$/,
                      message: 'Please enter a valid phone number with country code'
                    }
                  }}
                  render={({ field: { value, onChange } }) => {
                    // Parse existing value (format: "+91 1234567890")
                    const parts = (value || '').split(' ');
                    const countryCode = parts[0] || field.config?.defaultCountryCode || '+91';
                    const phoneNumber = parts.slice(1).join('');

                    return (
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => {
                            const newValue = `${e.target.value} ${phoneNumber}`;
                            onChange(newValue);
                          }}
                          className="input w-32"
                        >
                          <option value="+91">🇮🇳 +91</option>
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+971">🇦🇪 +971</option>
                          <option value="+966">🇸🇦 +966</option>
                          <option value="+65">🇸🇬 +65</option>
                          <option value="+61">🇦🇺 +61</option>
                          <option value="+81">🇯🇵 +81</option>
                          <option value="+86">🇨🇳 +86</option>
                        </select>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => {
                            const newValue = `${countryCode} ${e.target.value}`;
                            onChange(newValue);
                          }}
                          placeholder={field.placeholder || '1234567890'}
                          className={errors[field.id] ? 'input-error flex-1' : 'input flex-1'}
                        />
                      </div>
                    );
                  }}
                />

                {errors[field.id] && (
                  <p className="form-error">{errors[field.id].message}</p>
                )}

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle file upload with Controller
          if (field.type === 'file') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false
                  }}
                  render={({ field: { value, onChange } }) => (
                    <FileUploadField
                      field={field}
                      value={value}
                      onChange={onChange}
                      error={errors[field.id]?.message}
                    />
                  )}
                />

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle severityRating with Controller
          if (field.type === 'severityRating') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false
                  }}
                  render={({ field: { value, onChange } }) => (
                    <SeverityRatingField
                      field={field}
                      value={value}
                      onChange={onChange}
                      error={errors[field.id]?.message}
                    />
                  )}
                />

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle symptomChecklist with Controller
          if (field.type === 'symptomChecklist') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false
                  }}
                  render={({ field: { value, onChange } }) => (
                    <SymptomChecklistField
                      field={field}
                      value={value}
                      onChange={onChange}
                      error={errors[field.id]?.message}
                    />
                  )}
                />

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle functionalStatus with Controller
          if (field.type === 'functionalStatus') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false
                  }}
                  render={({ field: { value, onChange } }) => (
                    <FunctionalStatusField
                      field={field}
                      value={value}
                      onChange={onChange}
                      error={errors[field.id]?.message}
                    />
                  )}
                />

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle riskScoreDisplay with Controller
          if (field.type === 'riskScoreDisplay') {
            return (
              <div key={field.id} className="form-group">
                <Controller
                  name={field.id}
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <RiskScoreDisplayField
                      field={field}
                      value={value}
                      onChange={onChange}
                      formValues={formValues}
                    />
                  )}
                />
              </div>
            );
          }

          // Handle geoLocation with Controller
          if (field.type === 'geoLocation') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  rules={{
                    required: field.required
                      ? (field.validation?.errorMessage || `${field.label} is required`)
                      : false
                  }}
                  render={({ field: { value, onChange } }) => (
                    <GeoLocationField
                      field={field}
                      value={value}
                      onChange={onChange}
                      error={errors[field.id]?.message}
                    />
                  )}
                />

                {field.helpText && <p className="form-help">{field.helpText}</p>}
              </div>
            );
          }

          // Handle calculated fields (BMI, age, etc.)
          if (field.type === 'calculated') {
            return (
              <div key={field.id} className="form-group">
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                </label>

                <Controller
                  name={field.id}
                  control={control}
                  defaultValue=""
                  render={({ field: { value, onChange } }) => (
                    <CalculatedField
                      field={field}
                      watch={watch}
                      setValue={onChange}
                      value={value}
                    />
                  )}
                />
              </div>
            );
          }

          // Handle standard fields
          return (
            <div key={field.id} className="form-group">
              {field.type !== 'checkbox' && (
                <label htmlFor={field.id} className="form-label">
                  {field.label}
                  {field.required && <span className="text-danger-600 ml-1">*</span>}
                </label>
              )}

              {renderField(field)}

              {errors[field.id] && (
                <p className="form-error">{errors[field.id].message}</p>
              )}

              {field.helpText && (
                <p className="form-help">{field.helpText}</p>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
          {/* Previous Button (multi-page only) */}
          {isMultiPage && currentPage > 0 && (
            <button
              type="button"
              onClick={handlePrevious}
              className="btn-secondary flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
          )}

          <div className="flex-1" />

          {/* Next/Submit Button */}
          {isLastPage ? (
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="spinner" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary flex items-center gap-2"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
