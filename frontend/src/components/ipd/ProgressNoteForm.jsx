/**
 * ProgressNoteForm - Component for creating progress notes during IPD stay
 */
import { useState, useEffect } from 'react';
import { FileText, Save, Loader2 } from 'lucide-react';
import FormRenderer from '../forms/FormRenderer';
import formConfigurationsApi from '../../api/formConfigurations';
import ipdApi from '../../api/ipd';

export default function ProgressNoteForm({ admissionId, patientId, serviceId, onSuccess }) {
  const [formConfig, setFormConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadForm();
  }, [serviceId]);

  const loadForm = async () => {
    try {
      setLoading(true);

      // Check if serviceId is provided
      if (!serviceId) {
        setError('This admission does not have a service assigned. Please edit the admission to assign a service first.');
        setLoading(false);
        return;
      }

      const data = await formConfigurationsApi.getForService(serviceId, 'PROGRESS_NOTE');
      setFormConfig(data);
    } catch (err) {
      console.error('Failed to load progress note form:', err);
      setError('Could not load progress note form configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setError(null);

      await ipdApi.createProgressNote(admissionId, {
        form_id: formConfig.form.id,
        form_data: formData,
        notes: formData.additional_notes || null
      });

      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to create progress note:', err);
      setError(err.response?.data?.error || 'Failed to save progress note');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!formConfig?.form) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-yellow-800 dark:text-yellow-200">
          No progress note form configured for this service. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{formConfig.form.name}</h3>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
          <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
            <Save className="h-4 w-4" />
            Progress note saved successfully!
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6">
        <FormRenderer
          schema={formConfig.form.schema}
          onSubmit={handleSubmit}
          submitButtonText={submitting ? "Saving..." : "Save Progress Note"}
          disabled={submitting}
        />
      </div>
    </div>
  );
}
