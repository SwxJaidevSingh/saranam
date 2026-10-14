/**
 * IPD Forms Manager - Manage all IPD-specific form templates
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle,
  Settings,
  ArrowLeft,
  Link as LinkIcon
} from 'lucide-react';
import formsApi from '../../api/forms';
import QuickAssignModal from '../../components/ipd/QuickAssignModal';

export default function IPDFormsManager() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      setLoading(true);
      const data = await formsApi.getAll({
        is_template: true,
        template_category: 'ipd',
        per_page: 100
      });
      setForms(data.forms || []);
    } catch (err) {
      console.error('Failed to load IPD forms:', err);
      setError('Failed to load IPD forms');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (formId) => {
    if (!confirm('Are you sure you want to delete this IPD form template? This action cannot be undone.')) {
      return;
    }

    try {
      await formsApi.delete(formId);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadForms();
    } catch (err) {
      console.error('Failed to delete form:', err);
      setError(err.response?.data?.message || 'Failed to delete form');
    }
  };

  const handleQuickAssign = (form) => {
    setSelectedForm(form);
    setShowAssignModal(true);
  };

  const handleAssignSuccess = () => {
    setShowAssignModal(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const getFormTypeBadge = (formName) => {
    if (!formName) return 'General';
    const name = formName.toLowerCase();
    if (name.includes('admission')) return 'Admission';
    if (name.includes('discharge')) return 'Discharge';
    if (name.includes('progress')) return 'Progress Note';
    if (name.includes('nursing')) return 'Nursing';
    return 'General';
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/ipd/form-configuration')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Configuration
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">IPD Form Templates</h1>
                <p className="text-muted-foreground mt-1">
                  Manage form templates for IPD workflows
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/forms/new?template_category=ipd&is_template=true')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 font-medium"
            >
              <Plus className="h-4 w-4" />
              Create New Form
            </button>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-5 w-5" />
              <span>Operation completed successfully!</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          </div>
        )}

        {/* Forms Grid */}
        {forms.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No IPD Forms Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first IPD form template to get started with dynamic forms
            </p>
            <button
              onClick={() => navigate('/forms/new?template_category=ipd&is_template=true')}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 font-medium mx-auto"
            >
              <Plus className="h-5 w-5" />
              Create First IPD Form
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => (
              <div
                key={form.id}
                className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  {/* Form Type Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      {getFormTypeBadge(form.name)}
                    </span>
                    {form.is_active && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Form Name */}
                  <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-2">
                    {form.name}
                  </h3>

                  {/* Form Description */}
                  {form.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {form.description}
                    </p>
                  )}

                  {/* Form Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span>
                        {form.schema?.pages?.length || 0} {form.schema?.pages?.length === 1 ? 'page' : 'pages'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>
                        {form.schema?.pages?.reduce((total, page) => total + (page.fields?.length || 0), 0) || 0} fields
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate(`/forms/${form.id}/edit`)}
                      className="flex-1 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleQuickAssign(form)}
                      className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Assign
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => handleDelete(form.id)}
                      className="w-full px-3 py-2 text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Template
                    </button>
                  </div>
                </div>

                {/* Created Date Footer */}
                <div className="px-6 py-3 bg-secondary/30 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Created {form.created_at ? new Date(form.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            About IPD Form Templates
          </h3>
          <ul className="list-disc list-inside space-y-2 text-blue-800 dark:text-blue-200 text-sm">
            <li>IPD forms are special templates exclusively for in-patient department workflows</li>
            <li>Use the "Assign" button to quickly assign forms to services</li>
            <li>Forms can be edited in the Form Builder to add or modify fields</li>
            <li>All IPD forms are centrally tracked for analytics and reporting</li>
            <li>Configure service-specific assignments in the Form Configuration page</li>
          </ul>
        </div>
      </div>

      {/* Quick Assign Modal */}
      {showAssignModal && selectedForm && (
        <QuickAssignModal
          form={selectedForm}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleAssignSuccess}
        />
      )}
    </div>
  );
}
