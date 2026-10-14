import { CheckCircle2, Circle } from 'lucide-react';

export default function FormPreview({ schema }) {
  if (!schema || !schema.schema) {
    return null;
  }

  const formSchema = schema.schema;
  const isMultiPage = 'pages' in formSchema;

  // Get all fields
  const getAllFields = () => {
    if (isMultiPage) {
      return formSchema.pages.flatMap(page => page.fields || []);
    }
    return formSchema.fields || [];
  };

  const allFields = getAllFields();

  return (
    <div className="space-y-6">
      {/* Form Info */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="font-bold text-lg text-foreground mb-1">{schema.name}</h3>
        {schema.description && (
          <p className="text-sm text-muted-foreground">{schema.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>{allFields.length} fields</span>
          {isMultiPage && <span>{formSchema.pages.length} pages</span>}
          <span>{allFields.filter(f => f.required).length} required</span>
        </div>
      </div>

      {/* Pages or Fields */}
      {isMultiPage ? (
        formSchema.pages.map((page, pageIdx) => (
          <div key={page.id} className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                {pageIdx + 1}
              </div>
              <h4 className="font-semibold text-foreground">{page.title}</h4>
            </div>
            <div className="space-y-3">
              {(page.fields || []).map((field) => (
                <FieldPreview key={field.id} field={field} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="space-y-3">
            {formSchema.fields.map((field) => (
              <FieldPreview key={field.id} field={field} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldPreview({ field }) {
  const getFieldTypeIcon = (type) => {
    const icons = {
      text: '📝',
      textarea: '📄',
      number: '🔢',
      numeric: '🔢',
      email: '📧',
      phone: '📱',
      date: '📅',
      time: '⏰',
      url: '🔗',
      select: '📋',
      radio: '⚪',
      checkbox: '☑️',
      file: '📎',
      linearScale: '📊',
      painScale: '😊',
      severityRating: '⚠️',
      symptomChecklist: '✅',
      functionalStatus: '🚶',
      riskScoreDisplay: '📈',
      geoLocation: '📍',
      section: '📑',
      calculated: '🧮'
    };
    return icons[type] || '•';
  };

  // Section fields are just dividers
  if (field.type === 'section') {
    return (
      <div className="border-t border-border pt-2 mt-2">
        <h5 className="font-semibold text-foreground text-sm">{field.label}</h5>
      </div>
    );
  }

  return (
    <div className="p-3 bg-secondary rounded border border-border">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getFieldTypeIcon(field.type)}</span>
          <label className="font-medium text-sm text-foreground">
            {field.label}
            {field.required && <span className="text-danger-600 ml-1">*</span>}
          </label>
        </div>
        <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded border border-border">
          {field.type}
        </span>
      </div>

      {/* Field Details */}
      <div className="ml-7 space-y-1">
        {field.placeholder && (
          <p className="text-xs text-muted-foreground italic">Placeholder: {field.placeholder}</p>
        )}

        {field.validation && (
          <div className="text-xs text-muted-foreground">
            {field.validation.min !== undefined && <span>Min: {field.validation.min}</span>}
            {field.validation.max !== undefined && <span className="ml-2">Max: {field.validation.max}</span>}
            {field.validation.minLength && <span>Min length: {field.validation.minLength}</span>}
            {field.validation.maxLength && <span className="ml-2">Max length: {field.validation.maxLength}</span>}
          </div>
        )}

        {field.options && field.options.length > 0 && (
          <div className="space-y-1 mt-2">
            <p className="text-xs font-medium text-muted-foreground">Options:</p>
            {field.options.map((option, idx) => {
              // Handle both string options and object options {label, value}
              let optionLabel;
              if (typeof option === 'string') {
                optionLabel = option;
              } else if (typeof option === 'object' && option !== null) {
                optionLabel = option.label || option.value || JSON.stringify(option);
              } else {
                optionLabel = String(option);
              }

              return (
                <div key={idx} className="flex items-center gap-2 text-xs text-foreground">
                  {field.type === 'radio' ? <Circle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  <span>{optionLabel}</span>
                </div>
              );
            })}
          </div>
        )}

        {field.clinicalMapping && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <span className="font-medium text-blue-900">🏥 Clinical: </span>
            <span className="text-blue-700">
              {field.clinicalMapping.loincCode && `LOINC ${field.clinicalMapping.loincCode}`}
              {field.clinicalMapping.unit && ` (${field.clinicalMapping.unit})`}
            </span>
          </div>
        )}

        {(field.config?.isCalculated || field.type === 'calculated') && (
          <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
            <span className="font-medium text-purple-900">🧮 Auto-calculated</span>
            {field.config?.calculationFormula && (
              <span className="text-purple-700 block mt-1 font-mono text-[10px]">
                {field.config.calculationFormula}
              </span>
            )}
            {field.formula && (
              <div className="text-purple-700 mt-1">
                <span className="font-medium">Formula: </span>
                <span className="uppercase">{field.formula}</span>
                {field.inputs && (
                  <span className="block mt-1 text-[10px]">
                    Inputs: {Object.keys(field.inputs).join(', ')}
                  </span>
                )}
                {field.unit && (
                  <span className="block mt-1">
                    Unit: {field.unit}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {field.visibilityRules && field.visibilityRules.length > 0 && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <span className="font-medium text-yellow-900">👁️ Conditional: </span>
            <span className="text-yellow-700">
              Shows when {field.visibilityRules[0].field} {field.visibilityRules[0].operator} {field.visibilityRules[0].value}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
