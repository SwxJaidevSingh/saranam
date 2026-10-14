import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import formsApi from '../../api/forms';
import submissionsApi from '../../api/submissions';
import FormRenderer from '../../components/forms/FormRenderer';
import PatientSelector from '../../components/patients/PatientSelector';
import { mapPatientToFormFields } from '../../utils/patientFormMapper';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

export default function FormSubmit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientInitialValues, setPatientInitialValues] = useState({});

  useEffect(() => {
    loadForm();
  }, [id]);

  // Auto-fill form fields when patient is selected
  useEffect(() => {
    if (selectedPatient && form?.schema) {
      const mappedValues = mapPatientToFormFields(selectedPatient, form.schema);
      setPatientInitialValues(mappedValues);
    } else {
      setPatientInitialValues({});
    }
  }, [selectedPatient, form]);

  const loadForm = async () => {
    try {
      const data = await formsApi.getForm(id);
      setForm(data.form);
    } catch (err) {
      setError('Failed to load form');
      console.error('Error loading form:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    setError('');
    setIsSubmitting(true);

    try {
      await submissionsApi.createSubmission({
        form_id: id,
        patient_id: selectedPatient?.id || null,
        data,
      });
      setSuccess(true);
      setTimeout(() => navigate('/submissions'), 2000);
    } catch (err) {
      const errorData = err.response?.data;
      const errorMessage = errorData?.errors
        ? (Array.isArray(errorData.errors) ? errorData.errors.join(', ') : errorData.errors)
        : errorData?.message || 'Failed to submit form';
      setError(errorMessage);
      console.error('Error submitting form:', err);
      console.error('Error response data:', errorData);
      console.error('Validation errors:', errorData?.errors);
      console.error('Submission payload:', { form_id: id, data });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="card animate-pulse">
            <div className="h-64 bg-secondary rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="card text-center py-12">
            <div className="mx-auto w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-success-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Submission Successful!
            </h2>
            <p className="text-muted-foreground mb-6">
              Your form has been submitted successfully.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/submissions" className="btn-primary">
                View Submissions
              </Link>
              <Link to="/forms" className="btn-secondary">
                Back to Forms
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="alert-danger flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{error}</p>
              <Link to="/forms" className="text-sm underline mt-2 inline-block">
                Back to Forms
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            to="/forms"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Forms
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{form?.name}</h1>
          {form?.description && (
            <p className="text-muted-foreground mt-2">{form.description}</p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert-danger flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Patient Selector */}
        <PatientSelector
          value={selectedPatient}
          onChange={setSelectedPatient}
          required={false}
          showRecent={true}
          allowCreate={true}
        />

        {/* Form */}
        <div className="card">
          {form && (
            <FormRenderer
              schema={form.schema}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              defaultValues={patientInitialValues}
            />
          )}
        </div>
      </div>
    </div>
  );
}
