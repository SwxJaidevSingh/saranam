/**
 * Admission Detail Page - View and manage an IPD admission
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Calendar,
  Bed,
  FileText,
  Activity,
  AlertCircle,
  Loader2,
  Plus
} from 'lucide-react';
import ipdApi from '../../api/ipd';
import ProgressNoteForm from '../../components/ipd/ProgressNoteForm';
import NursingAssessmentForm from '../../components/ipd/NursingAssessmentForm';
import FormSubmissionViewer from '../../components/forms/FormSubmissionViewer';

export default function AdmissionDetail() {
  const { admissionId } = useParams();
  const navigate = useNavigate();
  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [clinicalDocs, setClinicalDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    loadAdmission();
    loadClinicalDocumentation();
  }, [admissionId]);

  const loadAdmission = async () => {
    try {
      setLoading(true);
      const data = await ipdApi.getAdmission(admissionId);
      setAdmission(data);
    } catch (err) {
      console.error('Failed to load admission:', err);
      setError('Failed to load admission details');
    } finally {
      setLoading(false);
    }
  };

  const loadClinicalDocumentation = async () => {
    try {
      setLoadingDocs(true);
      const data = await ipdApi.getClinicalDocumentation(admissionId);
      setClinicalDocs(data.documentation || []);
    } catch (err) {
      console.error('Failed to load clinical documentation:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDocumentationSuccess = () => {
    loadClinicalDocumentation();
    // Optionally switch to documentation tab to show the new entry
    setActiveTab('documentation');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !admission) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold">Error</h3>
            </div>
            <p>{error || 'Admission not found'}</p>
            <button
              onClick={() => navigate('/ipd/admissions')}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Back to Admissions
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'progress-note', label: 'Progress Note', icon: FileText },
    { id: 'nursing-assessment', label: 'Nursing Assessment', icon: Activity },
    { id: 'documentation', label: 'Documentation History', icon: Calendar }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/ipd/admissions')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admissions
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Admission Details
              </h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                {admission.patient_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{admission.patient_name}</span>
                  </div>
                )}
                {admission.bed && (
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4" />
                    <span>Bed: {admission.bed.bed_number}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="border-b border-border">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Admission Type</h3>
                    <p className="text-foreground capitalize">{admission.admission_type}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Admission Date</h3>
                    <p className="text-foreground">
                      {admission.admission_date ? new Date(admission.admission_date).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Admission Source</h3>
                    <p className="text-foreground capitalize">{admission.admission_source || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Admitting Doctor</h3>
                    <p className="text-foreground">{admission.admitting_doctor_name || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Admission Diagnosis</h3>
                  <p className="text-foreground whitespace-pre-wrap">{admission.admission_diagnosis || 'N/A'}</p>
                </div>

                {admission.admission_notes && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Admission Notes</h3>
                    <p className="text-foreground whitespace-pre-wrap">{admission.admission_notes}</p>
                  </div>
                )}

                {admission.estimated_length_of_stay_days && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Estimated Length of Stay</h3>
                    <p className="text-foreground">{admission.estimated_length_of_stay_days} days</p>
                  </div>
                )}

                {/* Show admission form submission if exists */}
                {admission.admission_form_submission_id && (
                  <div className="border-t border-border pt-6 mt-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Admission Form</h3>
                    {/* You would load and display the form submission here */}
                    <p className="text-muted-foreground">Admission form data available</p>
                  </div>
                )}
              </div>
            )}

            {/* Progress Note Tab */}
            {activeTab === 'progress-note' && (
              <ProgressNoteForm
                admissionId={admission.id}
                patientId={admission.patient_id}
                serviceId={admission.service_id}
                onSuccess={handleDocumentationSuccess}
              />
            )}

            {/* Nursing Assessment Tab */}
            {activeTab === 'nursing-assessment' && (
              <NursingAssessmentForm
                admissionId={admission.id}
                patientId={admission.patient_id}
                serviceId={admission.service_id}
                onSuccess={handleDocumentationSuccess}
              />
            )}

            {/* Documentation History Tab */}
            {activeTab === 'documentation' && (
              <div className="space-y-4">
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : clinicalDocs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No clinical documentation yet</p>
                    <p className="text-sm mt-2">Use the tabs above to add progress notes or nursing assessments</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clinicalDocs.map(doc => (
                      <div key={doc.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                                {doc.documentation_type?.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {doc.documented_at ? new Date(doc.documented_at).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                        {doc.notes && (
                          <p className="text-foreground whitespace-pre-wrap text-sm">{doc.notes}</p>
                        )}
                        {/* Display form submission if exists */}
                        {doc.form_submission && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <FormSubmissionViewer
                              submission={doc.form_submission}
                              schema={doc.form_submission.form?.schema}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
