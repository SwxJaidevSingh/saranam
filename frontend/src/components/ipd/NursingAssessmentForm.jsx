/**
 * NursingAssessmentForm - Component for creating nursing assessments during IPD stay
 */
import { useState, useEffect } from 'react';
import { Activity, Save, Loader2 } from 'lucide-react';
import FormRenderer from '../forms/FormRenderer';
import formConfigurationsApi from '../../api/formConfigurations';
import ipdApi from '../../api/ipd';

export default function NursingAssessmentForm({ admissionId, patientId, serviceId, onSuccess }) {
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

      const data = await formConfigurationsApi.getForService(serviceId, 'NURSING_ASSESSMENT');
      setFormConfig(data);
    } catch (err) {
      console.error('Failed to load nursing assessment form:', err);
      setError('Could not load nursing assessment form configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setError(null);

      await ipdApi.createNursingAssessment(admissionId, {
        form_id: formConfig.form.id,
        form_data: formData,
        notes: formData.care_plan_updates || null
      });

      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to create nursing assessment:', err);
      setError(err.response?.data?.error || 'Failed to save nursing assessment');
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
          No nursing assessment form configured for this service. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{formConfig.form.name}</h3>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
          <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
            <Save className="h-4 w-4" />
            Nursing assessment saved successfully!
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6">
        <FormRenderer
          schema={formConfig.form.schema}
          onSubmit={handleSubmit}
          submitButtonText={submitting ? "Saving..." : "Save Assessment"}
          disabled={submitting}
        />
      </div>
    </div>
  );
}
