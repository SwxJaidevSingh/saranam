import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import formsApi from '../../api/forms';
import FieldPalette from '../../components/forms/builder/FieldPalette';
import SectionPalette from '../../components/forms/builder/SectionPalette';
import FormCanvas from '../../components/forms/builder/FormCanvas';
import FieldPropertyEditor from '../../components/forms/builder/FieldPropertyEditor';
import PageNavigator from '../../components/forms/PageNavigator';
import ThemeEditor from '../../components/forms/builder/ThemeEditor';
import RiskRulesTab from '../../components/forms/builder/RiskRulesTab';
import RiskLevelsTab from '../../components/forms/builder/RiskLevelsTab';
import { ArrowLeft, Save, Eye, AlertCircle, Plus, Settings, Palette, Shield, BedDouble } from 'lucide-react';

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);

  // Check if creating IPD form from URL params
  const isIPDContext = searchParams.get('template_category') === 'ipd';
  const isTemplateFromURL = searchParams.get('is_template') === 'true';

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isMultiPage, setIsMultiPage] = useState(false);
  const [pages, setPages] = useState([{ id: 'page_1', title: 'Page 1', fields: [] }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('fields'); // 'fields', 'riskRules', 'riskLevels'

  // Template properties
  const [isTemplate, setIsTemplate] = useState(isTemplateFromURL);
  const [templateCategory, setTemplateCategory] = useState(isIPDContext ? 'ipd' : '');

  useEffect(() => {
    if (isEditMode) {
      loadForm();
    }
  }, [id]);

  const loadForm = async () => {
    try {
      const data = await formsApi.getForm(id);
      // Extract form from response wrapper
      const form = data.form || data;

      setFormName(form.name);
      setFormDescription(form.description || '');

      // Check if multi-page or single-page format
      if (form.schema?.pages) {
        setIsMultiPage(true);
        setPages(form.schema.pages);
        setCurrentPageIndex(0);
      } else {
        setIsMultiPage(false);
        setFields(form.schema?.fields || []);
      }
    } catch (err) {
      setError('Failed to load form');
      console.error('Error loading form:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get all fields (for conditional logic builder)
  const getAllFields = () => {
    if (isMultiPage) {
      return pages.flatMap(page => page.fields || []);
    }
    return fields;
  };

  // Get current page fields
  const getCurrentFields = () => {
    if (isMultiPage) {
      return pages[currentPageIndex]?.fields || [];
    }
    return fields;
  };

  // Update fields (single or multi-page)
  const updateFields = (newFields) => {
    if (isMultiPage) {
      const updatedPages = [...pages];
      updatedPages[currentPageIndex].fields = newFields;
      setPages(updatedPages);
    } else {
      setFields(newFields);
    }
  };

  // Page management functions
  const addPage = () => {
    const newPage = {
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: `Page ${pages.length + 1}`,
      fields: []
    };
    setPages([...pages, newPage]);
    setCurrentPageIndex(pages.length);
  };

  const deletePage = (index) => {
    if (pages.length <= 1) {
      alert('Cannot delete the last page');
      return;
    }
    const updatedPages = pages.filter((_, i) => i !== index);
    setPages(updatedPages);
    if (currentPageIndex >= updatedPages.length) {
      setCurrentPageIndex(updatedPages.length - 1);
    }
  };

  const renamePage = (index, newTitle) => {
    const updatedPages = [...pages];
    updatedPages[index].title = newTitle;
    setPages(updatedPages);
  };

  const toggleMultiPage = () => {
    if (!isMultiPage) {
      // Convert single-page to multi-page
      setPages([{ id: 'page_1', title: 'Page 1', fields: [...fields] }]);
      setCurrentPageIndex(0);
    } else {
      // Convert multi-page to single-page
      const allFields = pages.flatMap(page => page.fields || []);
      setFields(allFields);
    }
    setIsMultiPage(!isMultiPage);
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const currentFields = getCurrentFields();

    // Check if dragging an individual field from section palette
    if (active.data.current?.fromSectionPalette && active.data.current?.fromIndividualField) {
      const field = active.data.current.field;

      // Generate unique ID for the field
      const newField = {
        ...field,
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // If dropped on canvas, add to end
      if (over.id === 'form-canvas') {
        updateFields([...currentFields, newField]);
        setSelectedField(newField);
        return;
      }

      // If dropped on an existing field, insert at that position
      const overIndex = currentFields.findIndex((f) => f.id === over.id);
      if (overIndex !== -1) {
        const updatedFields = [...currentFields];
        updatedFields.splice(overIndex, 0, newField);
        updateFields(updatedFields);
        setSelectedField(newField);
        return;
      }

      // Default: add to end
      updateFields([...currentFields, newField]);
      setSelectedField(newField);
      return;
    }

    // Check if dragging a section from section palette
    if (active.data.current?.fromSectionPalette) {
      const section = active.data.current.section;

      // Generate unique IDs for all section fields
      const newFields = section.fields.map((field) => ({
        ...field,
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));

      // If dropped on canvas, add to end
      if (over.id === 'form-canvas') {
        updateFields([...currentFields, ...newFields]);
        // Select the first field from the section
        if (newFields.length > 0) {
          setSelectedField(newFields[0]);
        }
        return;
      }

      // If dropped on an existing field, insert at that position
      const overIndex = currentFields.findIndex((f) => f.id === over.id);
      if (overIndex !== -1) {
        const updatedFields = [...currentFields];
        updatedFields.splice(overIndex, 0, ...newFields);
        updateFields(updatedFields);
        if (newFields.length > 0) {
          setSelectedField(newFields[0]);
        }
        return;
      }

      // Default: add to end
      updateFields([...currentFields, ...newFields]);
      if (newFields.length > 0) {
        setSelectedField(newFields[0]);
      }
      return;
    }

    // Check if dragging from palette
    if (active.data.current?.fromPalette) {
      // Initialize field config based on type
      let config = undefined;
      if (active.data.current.type === 'painScale') {
        config = { min: 0, max: 10, scaleSize: 10, showEmojis: true, showMainLabels: true };
      } else if (active.data.current.type === 'numeric') {
        config = { allowDecimals: false, decimalPlaces: 2 };
      } else if (active.data.current.type === 'phone') {
        config = { defaultCountryCode: '+91' };
      }

      const newField = {
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: active.data.current.type,
        label: '',
        required: false,
        validation: {},
        options: active.data.current.type === 'select' || active.data.current.type === 'radio' ? [] : undefined,
        config,
      };

      // If dropped on canvas, add to end
      if (over.id === 'form-canvas') {
        updateFields([...currentFields, newField]);
        setSelectedField(newField);
        return;
      }

      // If dropped on an existing field, insert at that position
      const overIndex = currentFields.findIndex((f) => f.id === over.id);
      if (overIndex !== -1) {
        const newFields = [...currentFields];
        newFields.splice(overIndex, 0, newField);
        updateFields(newFields);
        setSelectedField(newField);
        return;
      }

      // Default: add to end
      updateFields([...currentFields, newField]);
      setSelectedField(newField);
      return;
    }

    // Reorder existing fields
    if (active.id !== over.id) {
      const oldIndex = currentFields.findIndex((f) => f.id === active.id);
      const newIndex = currentFields.findIndex((f) => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        updateFields(arrayMove(currentFields, oldIndex, newIndex));
      }
    }
  };

  const handleUpdateField = (updatedField) => {
    const currentFields = getCurrentFields();
    updateFields(currentFields.map((f) => (f.id === updatedField.id ? updatedField : f)));
    setSelectedField(null);
  };

  const handleDeleteField = (fieldId) => {
    const currentFields = getCurrentFields();
    updateFields(currentFields.filter((f) => f.id !== fieldId));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  const handleDuplicateField = (field) => {
    const currentFields = getCurrentFields();
    const duplicatedField = {
      ...field,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `${field.label} (Copy)`
    };
    updateFields([...currentFields, duplicatedField]);
  };

  const handleEditField = (field) => {
    setSelectedField(field);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('Please enter a form name');
      return;
    }

    // Validate based on form type
    const allFields = getAllFields();
    if (allFields.length === 0) {
      alert('Please add at least one field to the form');
      return;
    }

    // Validate all fields have labels and IDs
    const invalidFields = allFields.filter((f) => !f.label || !f.id);
    if (invalidFields.length > 0) {
      alert('Please ensure all fields have a label and ID');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const formData = {
        name: formName,
        description: formDescription,
        schema: isMultiPage ? { pages } : { fields },
        is_template: isTemplate,
        template_category: templateCategory || null,
      };

      if (isEditMode) {
        await formsApi.updateForm(id, formData);
      } else {
        await formsApi.createForm(formData);
      }

      // Navigate back to appropriate page
      if (isIPDContext) {
        navigate('/ipd/forms');
      } else {
        navigate('/forms');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save form');
      console.error('Error saving form:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="card animate-pulse">
          <div className="h-64 bg-secondary rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/forms"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Forms
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">
                {isEditMode ? 'Edit Form' : 'Create New Form'}
              </h1>
              {isIPDContext && (
                <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full flex items-center gap-2">
                  <BedDouble className="h-4 w-4" />
                  IPD Form Template
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {isIPDContext
                ? 'Creating a form template for In-Patient Department workflows'
                : 'Design your form by dragging fields from the palette'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-secondary flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="spinner" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditMode ? 'Update' : 'Create'} Form</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Metadata */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Form Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="input"
              placeholder="e.g., Patient Registration Form"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="input"
              placeholder="Brief description of the form"
            />
          </div>
        </div>

        {/* Multi-page toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-muted-foreground/70" />
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMultiPage}
                  onChange={toggleMultiPage}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground">Multi-page form</span>
              </label>
              <p className="text-xs text-muted-foreground ml-6">Split your form into multiple sections</p>
            </div>
          </div>
          {isMultiPage && (
            <button
              onClick={addPage}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Page
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="card">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('fields')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'fields'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Fields
            </button>
            {isEditMode && (
              <>
                <button
                  onClick={() => setActiveTab('riskRules')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'riskRules'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <Shield className="w-4 h-4 inline-block mr-2" />
                  Risk Rules
                </button>
                <button
                  onClick={() => setActiveTab('riskLevels')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'riskLevels'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <Shield className="w-4 h-4 inline-block mr-2" />
                  Risk Levels
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Helper message for new forms */}
        {!isEditMode && (
          <div className="bg-primary/5 border-t border-primary/20 px-6 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-primary">
                <span className="font-medium">Risk Rules and Risk Levels</span> will be available
                after you save this form. These features require the form and its fields to be
                saved first.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'fields' && (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-12 gap-6">
          {/* Field Palette */}
          <div className="col-span-12 lg:col-span-3">
            <div className="space-y-4">
              <div className="card sticky top-6">
                <FieldPalette />
              </div>
              <div className="card sticky top-6">
                <SectionPalette />
              </div>
            </div>
          </div>

          {/* Form Canvas */}
          <div className="col-span-12 lg:col-span-6">
            <div className="card">
              {/* Page Navigator */}
              {isMultiPage && (
                <PageNavigator
                  pages={pages}
                  currentPage={currentPageIndex}
                  onPageChange={setCurrentPageIndex}
                  variant="tabs"
                />
              )}

              {/* Page Title (for multi-page) */}
              {isMultiPage && (
                <div className="p-4 border-b border-border">
                  <input
                    type="text"
                    value={pages[currentPageIndex]?.title || ''}
                    onChange={(e) => renamePage(currentPageIndex, e.target.value)}
                    className="input font-semibold"
                    placeholder="Page title"
                  />
                </div>
              )}

              <div className="p-4">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  {isMultiPage ? pages[currentPageIndex]?.title || 'Page' : 'Form Preview'}
                </h2>
                <FormCanvas
                  fields={getCurrentFields()}
                  onEdit={handleEditField}
                  onDelete={handleDeleteField}
                  onDuplicate={handleDuplicateField}
                  selectedFieldId={selectedField?.id}
                />
              </div>
            </div>
          </div>

          {/* Field Properties */}
          <div className="col-span-12 lg:col-span-3">
            <div className="card sticky top-6 h-[600px] overflow-hidden">
              <FieldPropertyEditor
                field={selectedField}
                allFields={getAllFields()}
                onUpdate={handleUpdateField}
                onClose={() => setSelectedField(null)}
              />
            </div>
          </div>
        </div>

          <DragOverlay>
            {activeId ? (
              <div className="bg-card border-2 border-primary rounded-lg p-4 shadow-lg opacity-90">
                Dragging...
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Risk Rules Tab */}
      {activeTab === 'riskRules' && isEditMode && (
        <div className="card">
          <RiskRulesTab formId={id} allFields={getAllFields()} />
        </div>
      )}

      {/* Risk Levels Tab */}
      {activeTab === 'riskLevels' && isEditMode && (
        <div className="card">
          <RiskLevelsTab formId={id} />
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Form Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <h3 className="text-xl font-semibold">{formName || 'Untitled Form'}</h3>
                {formDescription && <p className="text-muted-foreground">{formDescription}</p>}
                <div className="border-t border-border pt-4 space-y-4">
                  {getAllFields().map((field) => (
                    <div key={field.id} className="form-group">
                      <label className="form-label">
                        {field.label || 'Untitled Field'}
                        {field.required && <span className="text-danger-600 ml-1">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          className="input"
                          placeholder={field.placeholder}
                          rows={4}
                          disabled
                        />
                      ) : field.type === 'select' ? (
                        <select className="input" disabled>
                          <option>Select...</option>
                          {field.options?.map((opt, i) => {
                            const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                            return <option key={i}>{optLabel}</option>;
                          })}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          className="input"
                          placeholder={field.placeholder}
                          disabled
                        />
                      )}
                      {field.helpText && <p className="form-help">{field.helpText}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
