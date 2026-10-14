/**
 * IPD Form Configuration Admin Page
 * Allows administrators to assign dynamic forms to services for IPD workflows
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Trash2, Save, FileText, Loader2, CheckCircle, PlusCircle } from 'lucide-react';
import formConfigurationsApi from '../../api/formConfigurations';
import formsApi from '../../api/forms';
import servicesApi from '../../api/services';

const FORM_TYPES = [
  { value: 'ADMISSION', label: 'Admission Form', description: 'Form shown during patient admission' },
  { value: 'DISCHARGE', label: 'Discharge Form', description: 'Form for discharge documentation' },
  { value: 'PROGRESS_NOTE', label: 'Progress Note', description: 'Daily progress notes' },
  { value: 'NURSING_ASSESSMENT', label: 'Nursing Assessment', description: 'Nursing care documentation' }
];

export default function IPDFormConfiguration() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [forms, setForms] = useState([]);
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // New configuration state
  const [newConfig, setNewConfig] = useState({
    service_id: '',
    form_type: 'ADMISSION',
    form_id: '',
    is_required: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesData, formsData, configsData] = await Promise.all([
        servicesApi.list({ limit: 100 }),
        formsApi.getAll({ is_template: true, template_category: 'ipd', per_page: 100 }),
        formConfigurationsApi.getAll()
      ]);

      setServices(servicesData.services || []);
      setForms(formsData.forms || []);
      setConfigurations(configsData.configurations || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddConfiguration = async () => {
    if (!newConfig.service_id || !newConfig.form_id) {
      alert('Please select both service and form');
      return;
    }

    try {
      setSaving(true);
      await formConfigurationsApi.create(newConfig);

      // Reload configurations
      await loadData();

      // Reset form
      setNewConfig({
        service_id: '',
        form_type: 'ADMISSION',
        form_id: '',
        is_required: false
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to create configuration:', err);
      setError(err.response?.data?.message || 'Failed to create configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfiguration = async (configId) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      await formConfigurationsApi.delete(configId);
      await loadData();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to delete configuration:', err);
      setError(err.response?.data?.message || 'Failed to delete configuration');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">IPD Form Configuration</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/ipd/forms')}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 flex items-center gap-2 font-medium transition-colors"
              >
                <FileText className="h-4 w-4" />
                Manage IPD Forms
              </button>
              <button
                onClick={() => navigate('/forms/new?template_category=ipd&is_template=true')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 font-medium transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                Create New IPD Form
              </button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Assign dynamic forms to services for IPD admission, discharge, and clinical documentation.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-5 w-5" />
              <span>Configuration updated successfully!</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Add New Configuration */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Service *
              </label>
              <select
                value={newConfig.service_id}
                onChange={(e) => setNewConfig({ ...newConfig, service_id: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Service...</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Form Type *
              </label>
              <select
                value={newConfig.form_type}
                onChange={(e) => setNewConfig({ ...newConfig, form_type: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {FORM_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Form Template *
              </label>
              <select
                value={newConfig.form_id}
                onChange={(e) => setNewConfig({ ...newConfig, form_id: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Form...</option>
                {forms.map(form => (
                  <option key={form.id} value={form.id}>
                    {form.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAddConfiguration}
                disabled={saving}
                className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Add Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Configurations */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Current Configurations
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Form Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Form
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {configurations.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">
                      No configurations yet. Add one above to get started.
                    </td>
                  </tr>
                ) : (
                  configurations.map(config => (
                    <tr key={config.id} className="hover:bg-secondary/20">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {services.find(s => s.id === config.service_id)?.name || 'Unknown Service'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {FORM_TYPES.find(t => t.value === config.form_type)?.label || config.form_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {forms.find(f => f.id === config.form_id)?.name || 'Unknown Form'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          config.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {config.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteConfiguration(config.id)}
                          className="text-destructive hover:text-destructive/80 flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            How it works
          </h3>
          <ul className="list-disc list-inside space-y-2 text-blue-800 dark:text-blue-200 text-sm">
            <li>Assign forms to services to enable dynamic IPD workflows</li>
            <li>When a patient is admitted to a service, the configured admission form will be used</li>
            <li>If no form is configured for a service, the system will use the default static form</li>
            <li>Form templates can be created in the Forms Builder with template_category="ipd"</li>
            <li>Changes take effect immediately for new admissions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
