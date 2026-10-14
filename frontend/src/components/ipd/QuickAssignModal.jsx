/**
 * Quick Assign Modal - Quickly assign an IPD form to a service
 */
import { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import servicesApi from '../../api/services';
import formConfigurationsApi from '../../api/formConfigurations';

const FORM_TYPES = [
  { value: 'ADMISSION', label: 'Admission Form', description: 'Form shown during patient admission' },
  { value: 'DISCHARGE', label: 'Discharge Form', description: 'Form for discharge documentation' },
  { value: 'PROGRESS_NOTE', label: 'Progress Note', description: 'Daily progress notes' },
  { value: 'NURSING_ASSESSMENT', label: 'Nursing Assessment', description: 'Nursing care documentation' }
];

export default function QuickAssignModal({ form, onClose, onSuccess }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [config, setConfig] = useState({
    service_id: '',
    form_type: 'ADMISSION',
    is_required: false
  });

  useEffect(() => {
    loadServices();
    // Auto-detect form type from form name
    detectFormType();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await servicesApi.list({ limit: 100 });
      setServices(data.services || []);
    } catch (err) {
      console.error('Failed to load services:', err);
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const detectFormType = () => {
    if (!form.name) return;

    const name = form.name.toLowerCase();
    if (name.includes('admission')) {
      setConfig(prev => ({ ...prev, form_type: 'ADMISSION' }));
    } else if (name.includes('discharge')) {
      setConfig(prev => ({ ...prev, form_type: 'DISCHARGE' }));
    } else if (name.includes('progress')) {
      setConfig(prev => ({ ...prev, form_type: 'PROGRESS_NOTE' }));
    } else if (name.includes('nursing')) {
      setConfig(prev => ({ ...prev, form_type: 'NURSING_ASSESSMENT' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!config.service_id) {
      setError('Please select a service');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await formConfigurationsApi.create({
        service_id: config.service_id,
        form_type: config.form_type,
        form_id: form.id,
        is_required: config.is_required
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Failed to assign form:', err);
      setError(err.response?.data?.message || 'Failed to assign form to service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Quick Assign Form</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Assign "{form.name}" to a service
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-6 bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Service Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Service *
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <select
                value={config.service_id}
                onChange={(e) => setConfig({ ...config, service_id: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Choose a service...</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              The form will be used for this service's IPD workflows
            </p>
          </div>

          {/* Form Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Form Type *
            </label>
            <select
              value={config.form_type}
              onChange={(e) => setConfig({ ...config, form_type: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {FORM_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {FORM_TYPES.find(t => t.value === config.form_type)?.description}
            </p>
          </div>

          {/* Required Checkbox */}
          <div className="flex items-start">
            <input
              type="checkbox"
              id="is_required"
              checked={config.is_required}
              onChange={(e) => setConfig({ ...config, is_required: e.target.checked })}
              className="mt-1 h-4 w-4 text-primary border-border rounded focus:ring-primary"
            />
            <label htmlFor="is_required" className="ml-2 block text-sm text-foreground">
              <span className="font-medium">Required Form</span>
              <p className="text-xs text-muted-foreground mt-1">
                Make this form mandatory for the selected workflow
              </p>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Assign Form
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
