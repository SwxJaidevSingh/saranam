import { useEffect } from 'react';
import { Calculator } from 'lucide-react';

/**
 * Calculated Field Component
 * Displays auto-calculated values based on formulas and other field values
 *
 * Supported formulas:
 * - bmi: Body Mass Index = weight(kg) / (height(m))^2
 * - age: Age from date of birth
 * - custom: Custom JavaScript expression
 */
export default function CalculatedField({ field, watch, setValue, value }) {
  const { formula, inputs, precision = 2, unit = '', helpText } = field;

  // Calculate value based on formula
  const calculateValue = () => {
    if (!inputs) return '';

    switch (formula) {
      case 'bmi': {
        const weight = watch(inputs.weight);
        const height = watch(inputs.height);

        if (!weight || !height || height === 0) return '';

        // Convert height to meters if needed (assume cm if > 3)
        const heightInMeters = height > 3 ? height / 100 : height;

        // BMI = weight(kg) / height(m)^2
        const bmi = weight / (heightInMeters ** 2);

        return bmi.toFixed(precision);
      }

      case 'age': {
        const dob = watch(inputs.dateOfBirth);

        if (!dob) return '';

        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        return age.toString();
      }

      case 'sum': {
        // Sum multiple fields
        let total = 0;
        Object.values(inputs).forEach(fieldId => {
          const value = parseFloat(watch(fieldId)) || 0;
          total += value;
        });
        return total.toFixed(precision);
      }

      case 'multiply': {
        // Multiply multiple fields
        let product = 1;
        Object.values(inputs).forEach(fieldId => {
          const value = parseFloat(watch(fieldId)) || 0;
          product *= value;
        });
        return product.toFixed(precision);
      }

      case 'custom': {
        // Custom JavaScript expression
        try {
          // Create a context with all input field values
          const context = {};
          Object.entries(inputs).forEach(([key, fieldId]) => {
            context[key] = watch(fieldId);
          });

          // Evaluate the custom expression
          // eslint-disable-next-line no-new-func
          const result = new Function(...Object.keys(context), `return ${field.expression}`)(...Object.values(context));

          return typeof result === 'number' ? result.toFixed(precision) : result;
        } catch (e) {
          console.error('Error evaluating custom formula:', e);
          return '';
        }
      }

      default:
        return '';
    }
  };

  // Update calculated value whenever input fields change
  useEffect(() => {
    const calculatedValue = calculateValue();
    setValue(field.id, calculatedValue);
  }, [
    // Watch all input fields
    ...Object.values(inputs || {}).map(fieldId => watch(fieldId))
  ]);

  // Get BMI category for display
  const getBMICategory = (bmi) => {
    const bmiNum = parseFloat(bmi);
    if (!bmiNum) return null;

    if (bmiNum < 18.5) return { label: 'Underweight', color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-200 dark:border-blue-800' };
    if (bmiNum < 25) return { label: 'Normal', color: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-200 dark:border-green-800' };
    if (bmiNum < 30) return { label: 'Overweight', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-200 dark:border-yellow-800' };
    return { label: 'Obese', color: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-200 dark:border-red-800' };
  };

  const displayValue = value || calculateValue();
  const category = formula === 'bmi' ? getBMICategory(displayValue) : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-primary-500/10 to-blue-500/10 dark:from-primary-500/20 dark:to-blue-500/20 border-2 border-primary-200 dark:border-primary-800 rounded-lg">
          <Calculator className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">
                {displayValue || '—'}
              </span>
              {unit && displayValue && (
                <span className="text-sm text-muted-foreground">{unit}</span>
              )}
            </div>
            {category && (
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${category.color}`}>
                  {category.label}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-card px-2 py-1 rounded border border-border">
            <Calculator className="w-3 h-3" />
            Auto-calculated
          </div>
        </div>
      </div>

      {helpText && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}

      {formula === 'bmi' && !displayValue && (
        <p className="text-xs text-muted-foreground italic">
          Enter height and weight above to calculate BMI
        </p>
      )}
    </div>
  );
}
