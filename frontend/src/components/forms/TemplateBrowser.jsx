import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  FileText,
  Copy,
  Eye,
  Calendar,
  Layers,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import formsApi from '../../api/forms';

const CATEGORY_LABELS = {
  physiotherapy: 'Physiotherapy Services',
  msw: 'MSW Counselling',
  opd: 'OPD Assessment',
  ipd: 'IPD Assessment',
  'home-care': 'Home Care',
};

const CATEGORY_COLORS = {
  physiotherapy: 'bg-blue-100 text-blue-700 border-blue-200',
  msw: 'bg-purple-100 text-purple-700 border-purple-200',
  opd: 'bg-green-100 text-green-700 border-green-200',
  ipd: 'bg-orange-100 text-orange-700 border-orange-200',
  'home-care': 'bg-pink-100 text-pink-700 border-pink-200',
};

function TemplateCard({ template, onClone, onPreview }) {
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    setIsCloning(true);
    try {
      await onClone(template);
    } finally {
      setIsCloning(false);
    }
  };

  // Count total fields across all pages
  const getTotalFields = () => {
    if (template.schema?.pages) {
      return template.schema.pages.reduce((sum, page) => sum + (page.fields?.length || 0), 0);
    }
    return template.schema?.fields?.length || 0;
  };

  // Count pages
  const getPageCount = () => {
    return template.schema?.pages?.length || 1;
  };

  const categoryColor = CATEGORY_COLORS[template.template_category] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <div className="bg-card border-2 border-border rounded-lg p-4 hover:border-primary-300 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-lg mb-1">{template.name}</h3>
          {template.template_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{template.template_description}</p>
          )}
        </div>
        {template.template_category && (
          <span
            className={`px-2 py-1 text-xs font-medium rounded border ${categoryColor} ml-3 whitespace-nowrap`}
          >
            {CATEGORY_LABELS[template.template_category] || template.template_category}
          </span>
        )}
      </div>

      {/* Template Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1">
          <Layers className="w-4 h-4" />
          <span>{getPageCount()} {getPageCount() === 1 ? 'page' : 'pages'}</span>
        </div>
        <div className="flex items-center gap-1">
          <FileText className="w-4 h-4" />
          <span>{getTotalFields()} fields</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span>{new Date(template.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPreview(template)}
          className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={handleClone}
          disabled={isCloning}
          className="flex-1 btn-primary text-sm flex items-center justify-center gap-2"
        >
          {isCloning ? (
            <>
              <div className="spinner-small" />
              <span>Cloning...</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Use Template
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TemplatePreview({ template, onClose }) {
  // Get all fields for preview
  const getAllFields = () => {
    if (template.schema?.pages) {
      return template.schema.pages.flatMap((page) => ({
        ...page,
        fields: page.fields || [],
      }));
    }
    return [{ title: 'Form', fields: template.schema?.fields || [] }];
  };

  const pages = getAllFields();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{template.name}</h2>
            {template.template_description && (
              <p className="text-sm text-muted-foreground mt-1">{template.template_description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {pages.map((page, pageIdx) => (
            <div key={pageIdx} className="mb-8 last:mb-0">
              {pages.length > 1 && (
                <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  {page.title || `Page ${pageIdx + 1}`}
                </h3>
              )}
              <div className="space-y-3">
                {page.fields.map((field, fieldIdx) => (
                  <div
                    key={fieldIdx}
                    className="bg-secondary border border-border rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{field.label}</span>
                          {field.required && <span className="text-red-500 text-sm">*</span>}
                        </div>
                        {field.placeholder && (
                          <p className="text-xs text-muted-foreground mt-1">{field.placeholder}</p>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                        {field.type}
                      </span>
                    </div>
                    {field.options && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {field.options.map((option, optIdx) => {
                          // Handle both string and object options
                          let optionLabel;
                          if (typeof option === 'string') {
                            optionLabel = option;
                          } else if (typeof option === 'object' && option !== null) {
                            optionLabel = option.label || option.value || JSON.stringify(option);
                          } else {
                            optionLabel = String(option);
                          }
                          return (
                            <span
                              key={optIdx}
                              className="px-2 py-0.5 bg-card border border-border rounded text-xs text-muted-foreground"
                            >
                              {optionLabel}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TemplateBrowser({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { is_template: true };
      if (selectedCategory !== 'all') {
        params.template_category = selectedCategory;
      }

      const response = await formsApi.getAll(params);
      setTemplates(response.forms || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [selectedCategory]);

  const handleCloneTemplate = async (template) => {
    try {
      const newName = `${template.name} (Copy)`;
      const response = await formsApi.clone(template.id, newName);

      if (response.form) {
        setSuccessMessage(`Template cloned successfully as "${newName}"`);
        setTimeout(() => {
          onClose();
          navigate(`/forms/${response.form.id}/edit`);
        }, 1000);
      }
    } catch (err) {
      console.error('Error cloning template:', err);
      setError('Failed to clone template');
    }
  };

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.template_description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['all', ...new Set(templates.map((t) => t.template_category).filter(Boolean))];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-card rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-primary-50 to-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Form Templates</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a pre-built template to get started quickly
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-card rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="p-6 border-b border-border space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="input pl-10"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-foreground hover:bg-accent'
                }`}
              >
                {category === 'all' ? 'All Templates' : CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading templates...</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground/70 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No templates found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'No templates available in this category'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClone={handleCloneTemplate}
                  onPreview={setPreviewTemplate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Template Preview Modal */}
      {previewTemplate && (
        <TemplatePreview template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
    </div>
  );
}
