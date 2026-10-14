import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { adminApi } from '../../api/admin';

const ORG_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'nursing_home', label: 'Nursing Home' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const emptyForm = {
  name: '',
  code: '',
  type: 'hospital',
  linked_hospital_code: '',
  status: 'active',
  display_name: '',
  accent_color: '',
  logo_url: '',
  directory_visible: true,
  referral_feedback_enabled: true,
};

/**
 * Create / Edit organisation (hospital) modal.
 * Pass `org` to edit an existing one, or omit it to create.
 */
export default function OrgFormModal({ org, onClose, onSuccess }) {
  const isEdit = Boolean(org);
  const [formData, setFormData] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || '',
        code: org.code || '',
        type: org.type || 'hospital',
        linked_hospital_code: org.linked_hospital_code || '',
        status: org.status || 'active',
        display_name: org.display_name || '',
        accent_color: org.accent_color || '',
        logo_url: org.logo_url || '',
        directory_visible: org.directory_visible ?? true,
        referral_feedback_enabled: org.referral_feedback_enabled ?? true,
      });
    } else {
      setFormData(emptyForm);
    }
  }, [org]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);

      // Drop empty optional strings so they post as null/omitted.
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        type: formData.type,
        status: formData.status,
        linked_hospital_code: formData.linked_hospital_code.trim() || null,
        display_name: formData.display_name.trim() || null,
        accent_color: formData.accent_color.trim() || null,
        logo_url: formData.logo_url.trim() || null,
        directory_visible: formData.directory_visible,
        referral_feedback_enabled: formData.referral_feedback_enabled,
      };

      if (isEdit) {
        await adminApi.updateOrg(org.id, payload);
      } else {
        await adminApi.createOrg(payload);
      }
      onSuccess();
    } catch (err) {
      console.error('Failed to save organisation:', err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to save organisation'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-2xl font-bold text-foreground">
            {isEdit ? 'Edit Organisation' : 'Create Organisation'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="alert-danger flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Core details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Saranam General Hospital"
                required
                minLength={2}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="e.g. SGH"
                required
                disabled={isEdit}
                className="input"
              />
              {isEdit && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Code can't be changed after creation.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                required
                className="input"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                required
                className="input"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Origin / Linked Hospital Code
              </label>
              <input
                type="text"
                value={formData.linked_hospital_code}
                onChange={(e) => handleChange('linked_hospital_code', e.target.value)}
                placeholder="Code of the originating hospital (optional)"
                className="input"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Links this organisation to an existing hospital master record.
              </p>
            </div>
          </div>

          {/* Branding */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Branding (optional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => handleChange('display_name', e.target.value)}
                  placeholder="Public-facing name"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.accent_color || '#2563eb'}
                    onChange={(e) => handleChange('accent_color', e.target.value)}
                    className="h-10 w-12 rounded border border-border bg-background cursor-pointer"
                    aria-label="Accent color picker"
                  />
                  <input
                    type="text"
                    value={formData.accent_color}
                    onChange={(e) => handleChange('accent_color', e.target.value)}
                    placeholder="#2563eb"
                    className="input"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                  placeholder="https://..."
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-4 border-t border-border space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.directory_visible}
                onChange={(e) => handleChange('directory_visible', e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-foreground">
                Visible in directory
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.referral_feedback_enabled}
                onChange={(e) =>
                  handleChange('referral_feedback_enabled', e.target.checked)
                }
                className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-foreground">
                Referral feedback enabled
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading
                ? 'Saving...'
                : isEdit
                ? 'Save Changes'
                : 'Create Organisation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
