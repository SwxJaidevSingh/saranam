import { useState } from 'react';
import { Save, Package, Edit3, Sparkles } from 'lucide-react';
import ConversationStep from './ConversationStep';

export default function TemplateConversationStep({
  conversation,
  currentSchema,
  session,
  isGenerating,
  error,
  mode,
  metadata,
  onSendMessage,
  onSaveTemplate,
  onBack
}) {
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState(metadata);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      await onSaveTemplate(editedMetadata);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Metadata Card */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-50 to-blue-50 border-b-2 border-purple-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-lg text-purple-900">Template Metadata</h3>
            </div>
            <button
              onClick={() => setEditingMetadata(!editingMetadata)}
              className="text-xs px-3 py-1 bg-white border border-purple-300 rounded-full hover:bg-purple-50 flex items-center gap-1.5"
            >
              <Edit3 className="w-3 h-3" />
              {editingMetadata ? 'Done' : 'Edit'}
            </button>
          </div>

          {editingMetadata ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-purple-900">Template Name</label>
                <input
                  type="text"
                  value={editedMetadata.name}
                  onChange={(e) => setEditedMetadata({ ...editedMetadata, name: e.target.value })}
                  className="input text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-purple-900">Category</label>
                <select
                  value={editedMetadata.category}
                  onChange={(e) => setEditedMetadata({ ...editedMetadata, category: e.target.value })}
                  className="input text-sm mt-1"
                >
                  <option>Healthcare Assessment</option>
                  <option>Patient Intake</option>
                  <option>Physiotherapy</option>
                  <option>Mental Health</option>
                  <option>Diagnostic Forms</option>
                  <option>Screening & Prevention</option>
                  <option>General Forms</option>
                  <option>Event Registration</option>
                  <option>Survey & Feedback</option>
                  <option>Contact & Application</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-purple-900">Description</label>
                <textarea
                  value={editedMetadata.description}
                  onChange={(e) => setEditedMetadata({ ...editedMetadata, description: e.target.value })}
                  className="input text-sm mt-1"
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs font-semibold text-purple-700">Name:</span>
                <p className="text-foreground font-medium">{editedMetadata.name}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-purple-700">Category:</span>
                <p className="text-foreground">{editedMetadata.category}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs font-semibold text-purple-700">Description:</span>
                <p className="text-foreground text-xs">{editedMetadata.description}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-purple-700">Target Users:</span>
                <p className="text-foreground text-xs">{editedMetadata.target_users}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-purple-700">Structure:</span>
                <p className="text-foreground text-xs">
                  {currentSchema?.schema?.pages
                    ? `${currentSchema.schema.pages.length} pages, ${currentSchema.schema.pages.reduce((sum, page) => sum + (page.fields?.length || 0), 0)} fields`
                    : `${currentSchema?.schema?.fields?.length || 0} fields`
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Step */}
      <div className="flex-1 min-h-0">
        <ConversationStep
          conversation={conversation}
          currentSchema={currentSchema}
          session={session}
          isGenerating={isGenerating}
          error={error}
          mode={mode}
          onSendMessage={onSendMessage}
          onFinalize={handleSaveTemplate}
          onBack={onBack}
        />
      </div>

      {/* Custom Save Button Overlay */}
      <div className="absolute bottom-0 right-0 p-6 pointer-events-none">
        <button
          onClick={handleSaveTemplate}
          disabled={isSaving}
          className="btn-primary btn-lg pointer-events-auto shadow-2xl flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving Template...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Template
            </>
          )}
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex-shrink-0 bg-blue-50 border-t border-blue-200 px-4 py-2">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-900">
            <strong>Refine your template:</strong> Ask AI to add fields, change structure, or modify properties.
            Your changes will update the preview in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
