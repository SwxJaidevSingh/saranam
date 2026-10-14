import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import formsApi from '../../api/forms';
import TemplateBrowser from '../../components/forms/TemplateBrowser';
import AIFormBuilderModal from '../../components/ai/AIFormBuilderModal';
import AITemplateGeneratorModal from '../../components/ai/AITemplateGeneratorModal';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Send,
  Copy,
  FileText,
  AlertCircle,
  Layers,
  Sparkles,
  Package,
} from 'lucide-react';

export default function FormsList() {
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiMode, setAIMode] = useState('general');
  const [showTemplateGenerator, setShowTemplateGenerator] = useState(false);
  const [templateMode, setTemplateMode] = useState('general');

  // Helper function to count total fields in a form
  const getFieldCount = (form) => {
    if (!form.schema) return 0;

    // Multi-page form
    if (form.schema.pages && Array.isArray(form.schema.pages)) {
      return form.schema.pages.reduce((total, page) => {
        return total + (page.fields?.length || 0);
      }, 0);
    }

    // Single-page form
    if (form.schema.fields && Array.isArray(form.schema.fields)) {
      return form.schema.fields.length;
    }

    return 0;
  };

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const data = await formsApi.getAllForms();
      setForms(data.forms || []);
    } catch (err) {
      setError('Failed to load forms');
      console.error('Error loading forms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this form?')) return;

    try {
      await formsApi.deleteForm(id);
      setForms(forms.filter(f => f.id !== id));
    } catch (err) {
      alert('Failed to delete form');
      console.error('Error deleting form:', err);
    }
  };

  const handleClone = async (id) => {
    try {
      const clonedForm = await formsApi.cloneForm(id);
      setForms([clonedForm, ...forms]);
    } catch (err) {
      alert('Failed to clone form');
      console.error('Error cloning form:', err);
    }
  };

  const filteredForms = forms.filter(form =>
    form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const canCreateForm = user?.role === 'admin' || user?.permissions?.includes('create_form');
  const canEditForm = user?.role === 'admin' || user?.permissions?.includes('edit_form');
  const canDeleteForm = user?.role === 'admin' || user?.permissions?.includes('delete_form');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Forms</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage form templates
          </p>
        </div>
        {canCreateForm && (
          <div className="flex items-center gap-3">
            {/* AI Buttons */}
            <button
              onClick={() => { setAIMode('general'); setShowAIModal(true); }}
              className="btn-secondary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              🤖 AI General
            </button>
            <button
              onClick={() => { setAIMode('healthcare'); setShowAIModal(true); }}
              className="btn-primary flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700"
            >
              <Sparkles className="w-4 h-4" />
              🏥 AI Healthcare
            </button>

            {/* Template Generator */}
            <div className="border-l border-border h-8 mx-2"></div>
            <button
              onClick={() => { setTemplateMode('general'); setShowTemplateGenerator(true); }}
              className="btn-ghost flex items-center gap-2 border-2 border-secondary-300 dark:border-secondary-700 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-900/20"
            >
              <Package className="w-4 h-4" />
              Generate Template
            </button>

            {/* Existing buttons */}
            <button
              onClick={() => setShowTemplateBrowser(true)}
              className="btn-ghost flex items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              Templates
            </button>
            <Link to="/forms/new" className="btn-ghost flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Manual
            </Link>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Forms Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchTerm ? 'No forms found' : 'No forms yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'Create your first form to get started'}
          </p>
          {canCreateForm && !searchTerm && (
            <Link to="/forms/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Form
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <div key={form.id} className="card hover:shadow-medium transition-shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {form.name}
                </h3>
                {form.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {form.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span className={`badge ${form.is_active ? 'badge-success' : 'badge-gray'}`}>
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="badge-gray">
                  v{form.version}
                </span>
                <span className="badge-primary">
                  {getFieldCount(form)} fields
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <Link
                  to={`/forms/${form.id}/submit`}
                  className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  Submit
                </Link>

                {canEditForm && (
                  <Link
                    to={`/forms/${form.id}/edit`}
                    className="btn-ghost flex items-center justify-center gap-2 text-sm p-2"
                    title="Edit form"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                )}

                {canCreateForm && (
                  <button
                    onClick={() => handleClone(form.id)}
                    className="btn-ghost flex items-center justify-center gap-2 text-sm p-2"
                    title="Clone form"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}

                {canDeleteForm && (
                  <button
                    onClick={() => handleDelete(form.id)}
                    className="btn-ghost flex items-center justify-center gap-2 text-sm p-2 text-destructive hover:bg-destructive/10"
                    title="Delete form"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Browser Modal */}
      <TemplateBrowser
        isOpen={showTemplateBrowser}
        onClose={() => setShowTemplateBrowser(false)}
      />

      {/* AI Form Builder Modal */}
      <AIFormBuilderModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        mode={aiMode}
      />

      {/* AI Template Generator Modal */}
      <AITemplateGeneratorModal
        isOpen={showTemplateGenerator}
        onClose={() => setShowTemplateGenerator(false)}
        mode={templateMode}
      />
    </div>
  );
}
