import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import submissionsApi from '../../api/submissions';
import formsApi from '../../api/forms';
import { ArrowLeft, Calendar, User, FileText, Trash2, MapPin, Globe } from 'lucide-react';
import { format } from 'date-fns';

export default function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [form, setForm] = useState(null);
  const [fieldLabels, setFieldLabels] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Helper function to render field values
  const renderFieldValue = (value) => {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground/70">-</span>;
    }

    // Handle boolean
    if (typeof value === 'boolean') {
      return <span className="text-foreground">{value ? 'Yes' : 'No'}</span>;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside text-foreground">
          {value.map((item, idx) => (
            <li key={idx}>{String(item)}</li>
          ))}
        </ul>
      );
    }

    // Handle geoLocation object
    if (typeof value === 'object' && (value.lat || value.lng || value.ip || value.address)) {
      return (
        <div className="bg-secondary border border-border rounded-lg p-3 space-y-2">
          {value.lat && value.lng && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground">GPS Coordinates</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {Number(value.lat).toFixed(6)}, {Number(value.lng).toFixed(6)}
                </div>
                {value.accuracy && (
                  <div className="text-muted-foreground text-xs">
                    Accuracy: ±{Math.round(value.accuracy)}m
                  </div>
                )}
              </div>
            </div>
          )}
          {value.ip && (
            <div className="flex items-start gap-2 text-sm">
              <Globe className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground">IP Address</div>
                <div className="text-muted-foreground font-mono text-xs">{value.ip}</div>
              </div>
            </div>
          )}
          {value.address && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground">Address</div>
                <div className="text-muted-foreground text-xs">{value.address}</div>
              </div>
            </div>
          )}
          {value.timestamp && (
            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Captured: {format(new Date(value.timestamp), 'PPpp')}
            </div>
          )}
        </div>
      );
    }

    // Handle other objects (convert to JSON)
    if (typeof value === 'object') {
      return (
        <pre className="bg-secondary border border-border rounded p-2 text-xs overflow-x-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    // Handle strings and numbers
    return <span className="text-foreground">{String(value)}</span>;
  };

  useEffect(() => {
    loadSubmission();
  }, [id]);

  const loadSubmission = async () => {
    try {
      const data = await submissionsApi.getSubmission(id);
      const submissionData = data.submission || data;
      setSubmission(submissionData);

      // Load the form to get field labels
      if (submissionData.form_id) {
        try {
          const formData = await formsApi.getForm(submissionData.form_id);
          const formObj = formData.form || formData;
          setForm(formObj);

          // Extract all fields from schema (handle both single-page and multi-page)
          let allFields = [];
          if (formObj.schema?.pages) {
            // Multi-page form
            allFields = formObj.schema.pages.flatMap(page => page.fields || []);
          } else if (formObj.schema?.fields) {
            // Single-page form
            allFields = formObj.schema.fields;
          }

          // Create mapping of field ID to label
          const labelMap = {};
          allFields.forEach(field => {
            labelMap[field.id] = field.label;
          });
          setFieldLabels(labelMap);
        } catch (formErr) {
          console.error('Error loading form:', formErr);
          // Continue anyway - we can still show the submission data
        }
      }
    } catch (err) {
      setError('Failed to load submission');
      console.error('Error loading submission:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;

    try {
      await submissionsApi.deleteSubmission(id);
      navigate('/submissions');
    } catch (err) {
      alert('Failed to delete submission');
      console.error('Error deleting submission:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="card animate-pulse">
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="alert-danger">
            {error || 'Submission not found'}
          </div>
          <Link to="/submissions" className="btn-secondary mt-4 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Submissions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            to="/submissions"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Submissions
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Submission Details</h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{submission.form_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{submission.submitted_by_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {submission.created_at
                      ? format(new Date(submission.created_at), 'MMM dd, yyyy HH:mm')
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDelete}
              className="btn-danger flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-2">Status</h2>
          <span className="badge-success">{submission.status}</span>
        </div>

        {/* Submission Data */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Submitted Data</h2>
          <div className="space-y-4">
            {submission.data && Object.keys(submission.data).length > 0 ? (
              Object.entries(submission.data)
                // Filter out system/internal fields and only show fields from the form schema
                .filter(([key]) => {
                  // Exclude known system fields
                  const systemFields = ['data', 'id', 'created_at', 'updated_at', 'form_id', 'submitted_by'];
                  if (systemFields.includes(key)) return false;

                  // If we have field labels (form schema loaded), only show fields that exist in schema
                  if (Object.keys(fieldLabels).length > 0) {
                    return key in fieldLabels;
                  }

                  // Otherwise show all non-system fields
                  return true;
                })
                .map(([key, value]) => (
                  <div key={key} className="border-b border-border pb-4 last:border-0">
                    <label className="form-label">
                      {fieldLabels[key] || key.replace(/_/g, ' ')}
                    </label>
                    <div className="mt-1">
                      {renderFieldValue(value)}
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-center py-8">No submission data available</p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Metadata</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Submission ID</label>
              <p className="text-foreground font-mono text-sm">{submission.id}</p>
            </div>
            <div>
              <label className="form-label">Form ID</label>
              <p className="text-foreground font-mono text-sm">{submission.form_id}</p>
            </div>
            <div>
              <label className="form-label">Submitted At</label>
              <p className="text-foreground">
                {submission.created_at
                  ? format(new Date(submission.created_at), 'PPpp')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <label className="form-label">Last Updated</label>
              <p className="text-foreground">
                {submission.updated_at
                  ? format(new Date(submission.updated_at), 'PPpp')
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
