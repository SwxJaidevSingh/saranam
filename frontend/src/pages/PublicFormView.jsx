import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import formsApi from '../api/forms';
import FormRenderer from '../components/forms/FormRenderer';

/**
 * Public Form View
 * Allows anyone to view and submit a form via share token
 */
export default function PublicFormView() {
  const { shareToken } = useParams();
  const [form, setForm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadForm();
  }, [shareToken]);

  const loadForm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await formsApi.getPublicForm(shareToken);
      setForm(response.form);
    } catch (err) {
      console.error('Error loading form:', err);
      setError(err.response?.data?.message || 'Failed to load form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await formsApi.submitPublicForm(shareToken, { data });
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting form:', err);
      alert(err.response?.data?.message || 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-6">
        <div className="bg-card rounded-lg shadow-xl p-8 text-center">
          <Loader className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-danger-50 to-warning-50 flex items-center justify-center p-6">
        <div className="bg-card rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto bg-danger-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-danger-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Form Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <p className="text-sm text-muted-foreground">
            This form may have been deleted or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-success-50 to-primary/10 flex items-center justify-center p-6">
        <div className="bg-card rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto bg-success-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-success-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Thank You!</h1>
          <p className="text-muted-foreground mb-6">
            Your response has been successfully submitted.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="btn-primary"
          >
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-card rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-100 rounded-lg flex-shrink-0">
              <FileText className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2">{form.name}</h1>
              {form.description && (
                <p className="text-muted-foreground leading-relaxed">{form.description}</p>
              )}
            </div>
          </div>

          {/* Public indicator */}
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-success-500 rounded-full"></div>
            <span>This is a public form - no account required</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-card rounded-lg shadow-lg p-8">
          <FormRenderer
            schema={form.schema}
            onSubmit={handleSubmit}
            isLoading={isSubmitting}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Powered by Saranam India Health Care Form Builder</p>
        </div>
      </div>
    </div>
  );
}
