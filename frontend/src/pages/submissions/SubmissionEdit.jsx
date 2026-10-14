import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import submissionsApi from '../../api/submissions';
import formsApi from '../../api/forms';
import FormRenderer from '../../components/forms/FormRenderer';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';

export default function SubmissionEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [form, setForm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        setIsLoading(true);
        const response = await submissionsApi.getById(id);
        const submissionData = response.submission;
        setSubmission(submissionData);

        // Check if submission has a valid form_id
        if (!submissionData.form_id) {
          setError('This is an old form which cannot be edited');
          setIsLoading(false);
          return;
        }

        // Fetch the form to get schema
        const formResponse = await formsApi.getById(submissionData.form_id);
        setForm(formResponse.form);
      } catch (err) {
        console.error('Error fetching submission:', err);
        setError(err.response?.data?.message || 'Failed to load submission');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmission();
  }, [id]);

  const handleSubmit = async (data) => {
    try {
      setIsSaving(true);
      setError('');

      // API wrapper will add { data } wrapping, so just pass data directly
      await submissionsApi.update(id, data);

      // Navigate back to submissions list on success
      navigate('/submissions');
    } catch (err) {
      console.error('Error updating submission:', err);
      const errorMessage = err.response?.data?.message ||
                          err.response?.data?.error ||
                          'Failed to update submission';
      setError(errorMessage);
      setIsSaving(false);

      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{error}</p>
        </div>
        <Link to="/submissions" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
          ← Back to submissions
        </Link>
      </div>
    );
  }

  if (!submission || !form) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Submission not found</p>
        <Link to="/submissions" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
          ← Back to submissions
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            to="/submissions"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to submissions
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Edit Submission</h1>
          <p className="text-muted-foreground mt-2">{form.name}</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="card">
          <FormRenderer
            schema={form.schema}
            onSubmit={handleSubmit}
            isLoading={isSaving}
            defaultValues={submission.data}
            showProgress={true}
          />
        </div>
      </div>
    </div>
  );
}
