/**
 * ConsultationTypeMultiSelect — Multi-select role buttons for visit consultation types.
 *
 * Adheres strictly to the application's UI principles and color tokens:
 * - 5 clinical roles: Doctor, Nurse, Counsellor, Physiotherapist, Social Worker
 * - Direct 1-click toggling
 * - Clean theme tokens: border-border, bg-background, text-foreground, text-primary, bg-primary/10
 * - Crisp Lucide Check icon on active items (no emojis)
 */
import React from 'react';
import { Check } from 'lucide-react';

export const CONSULTATION_ROLES = [
  { key: 'doctor_consultation', label: 'Doctor' },
  { key: 'nursing_consultation', label: 'Nurse' },
  { key: 'counsellor_consultation', label: 'Counsellor' },
  { key: 'physiotherapy_consultation', label: 'Physiotherapist' },
  { key: 'social_worker_consultation', label: 'Social Worker' },
];

export default function ConsultationTypeMultiSelect({
  values = {},
  onChange,
  disabled = false,
  label = 'Type of Consultation',
  helperText,
  className = '',
}) {
  const isChecked = (key, labelName) => {
    if (values && typeof values === 'object') {
      if (values[key] !== undefined) return Boolean(values[key]);
      // If values is passed as an array of labels or keys
      if (Array.isArray(values)) {
        return values.includes(key) || values.includes(labelName);
      }
      if (Array.isArray(values.consultation_types)) {
        return values.consultation_types.includes(labelName) || values.consultation_types.includes(key);
      }
    }
    return false;
  };

  const handleToggle = (role) => {
    if (disabled || !onChange) return;

    const currentStatus = isChecked(role.key, role.label);
    const newStatus = !currentStatus;

    // Build the updated object
    let nextValues = {};
    if (Array.isArray(values)) {
      const set = new Set(values);
      if (newStatus) {
        set.add(role.label);
      } else {
        set.delete(role.label);
        set.delete(role.key);
      }
      nextValues = Array.from(set);
    } else {
      nextValues = {
        ...values,
        [role.key]: newStatus,
      };
    }

    // Also build a list of active role names
    const activeRoles = CONSULTATION_ROLES.filter((r) => {
      if (r.key === role.key) return newStatus;
      return isChecked(r.key, r.label);
    }).map((r) => r.label);

    onChange(nextValues, activeRoles);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {CONSULTATION_ROLES.map((role) => {
          const active = isChecked(role.key, role.label);
          return (
            <button
              key={role.key}
              type="button"
              role="checkbox"
              aria-checked={active}
              disabled={disabled}
              onClick={() => handleToggle(role)}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs transition-all select-none border ${
                active
                  ? 'bg-primary/10 text-primary border-primary/50 font-semibold shadow-xs'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted/40 hover:text-foreground font-medium'
              } ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } focus:outline-none focus:ring-1 focus:ring-primary`}
            >
              {active && <Check className="h-3.5 w-3.5 mr-1 stroke-[2.5]" />}
              <span>{role.label}</span>
            </button>
          );
        })}
      </div>

      {helperText && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{helperText}</p>
      )}
    </div>
  );
}
