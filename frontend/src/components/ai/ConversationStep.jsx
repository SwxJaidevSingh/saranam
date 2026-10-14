import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, ArrowLeft, Save, Lightbulb, AlertCircle, Loader, Plus, Edit3, Trash2, Activity, FileText } from 'lucide-react';
import FormPreview from './FormPreview';

export default function ConversationStep({
  conversation,
  currentSchema,
  session,
  isGenerating,
  error,
  mode,
  onSendMessage,
  onFinalize,
  onBack
}) {
  const [message, setMessage] = useState('');
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || isGenerating) return;

    onSendMessage(message);
    setMessage('');
  };

  const handleSuggestionClick = (suggestion) => {
    setMessage(suggestion);
    textareaRef.current?.focus();
  };

  const handleQuickAction = (action) => {
    const prompts = {
      addField: 'Add a new field for ',
      addSection: 'Add a new section for ',
      modifyField: 'Change the ',
      removeField: 'Remove the ',
      addClinical: 'Add LOINC code to ',
      addRisk: 'Add risk scoring rules for '
    };
    setMessage(prompts[action] || '');
    textareaRef.current?.focus();
  };

  // Extract field count
  const fieldCount = currentSchema?.schema?.pages
    ? currentSchema.schema.pages.reduce((total, page) => total + (page.fields?.length || 0), 0)
    : currentSchema?.schema?.fields?.length || 0;

  return (
    <div className="flex h-[600px]">
      {/* Left: Chat */}
      <div className="w-1/2 border-r border-border flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Conversation</h3>
            <p className="text-xs text-muted-foreground">
              {mode === 'healthcare' ? 'Healthcare-aware AI' : 'General form builder'}
            </p>
          </div>
          <button onClick={onBack} className="btn-ghost btn-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversation.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 mx-auto text-primary-500 mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Start a conversation</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Describe the form you want to create
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleSuggestionClick(mode === 'healthcare'
                    ? 'Create a patient intake form with vitals and medical history'
                    : 'Create a conference registration form')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm"
                >
                  {mode === 'healthcare'
                    ? '🏥 Patient intake form with vitals'
                    : '📝 Conference registration form'}
                </button>
                <button
                  onClick={() => handleSuggestionClick(mode === 'healthcare'
                    ? 'Create a sepsis screening form with qSOFA risk scoring'
                    : 'Create a customer feedback survey')}
                  className="block w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm"
                >
                  {mode === 'healthcare'
                    ? '⚠️ Sepsis screening with risk scoring'
                    : '💬 Customer feedback survey'}
                </button>
              </div>
            </div>
          )}

          {conversation.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary text-foreground'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-xs font-semibold">AI</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-secondary text-foreground rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="alert-danger flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Success banner after first generation */}
          {currentSchema && conversation.length === 2 && !isGenerating && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-900">
                  <p className="font-semibold mb-1">✓ Form generated successfully!</p>
                  <p className="text-xs">
                    You can now refine it by adding fields, modifying properties, or reorganizing the structure.
                    Use the quick action buttons below or just describe what you want to change.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggestions */}
        {session?.suggestions && session.suggestions.length > 0 && (
          <div className="p-3 border-t border-border bg-secondary flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-semibold text-foreground">Suggestions to improve your form:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {session.suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion.replace(/^[💡⚠️🏥🆔➕📄📞📋✅📧📱✓📑📂]\s*/, ''))}
                  className="text-xs bg-white hover:bg-gray-100 border border-gray-300 rounded-full px-3 py-1 text-gray-700 transition-colors"
                  title="Click to use this suggestion"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Example Prompts (show when form exists but no suggestions yet) */}
        {currentSchema && (!session?.suggestions || session.suggestions.length === 0) && conversation.length > 1 && (
          <div className="p-3 border-t border-gray-200 bg-blue-50 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-900">Try these:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSuggestionClick('Add an emergency contact phone number field')}
                className="text-xs bg-white hover:bg-blue-100 border border-blue-300 rounded-full px-3 py-1 text-blue-700"
              >
                Add emergency contact
              </button>
              <button
                onClick={() => handleSuggestionClick('Make email field required')}
                className="text-xs bg-white hover:bg-blue-100 border border-blue-300 rounded-full px-3 py-1 text-blue-700"
              >
                Make field required
              </button>
              {mode === 'healthcare' && (
                <>
                  <button
                    onClick={() => handleSuggestionClick('Add BMI calculator field')}
                    className="text-xs bg-white hover:bg-blue-100 border border-blue-300 rounded-full px-3 py-1 text-blue-700"
                  >
                    Add BMI calculator
                  </button>
                  <button
                    onClick={() => handleSuggestionClick('Add risk scoring rules for fall risk')}
                    className="text-xs bg-white hover:bg-blue-100 border border-blue-300 rounded-full px-3 py-1 text-blue-700"
                  >
                    Add risk scoring
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border flex-shrink-0">
          {/* Quick Actions (only show after form is generated) */}
          {currentSchema && (
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickAction('addField')}
                className="text-xs px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-full flex items-center gap-1.5 border border-primary-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Field
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('addSection')}
                className="text-xs px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-full flex items-center gap-1.5 border border-purple-200"
              >
                <FileText className="w-3.5 h-3.5" />
                Add Section
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('modifyField')}
                className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full flex items-center gap-1.5 border border-blue-200"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Modify Field
              </button>
              {mode === 'healthcare' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleQuickAction('addClinical')}
                    className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-full flex items-center gap-1.5 border border-green-200"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Add LOINC Code
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAction('addRisk')}
                    className="text-xs px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-full flex items-center gap-1.5 border border-orange-200"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Add Risk Rules
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => handleQuickAction('removeField')}
                className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-full flex items-center gap-1.5 border border-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Field
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                currentSchema
                  ? "Refine your form... Try: 'Add emergency contact', 'Make email optional', 'Add BMI calculator'"
                  : 'Describe the form you want to create...'
              }
              className="input flex-1 resize-none"
              rows={1}
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!message.trim() || isGenerating}
              className="btn-primary px-4"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>

      {/* Right: Preview */}
      <div className="w-1/2 flex flex-col bg-secondary">
        {/* Preview Header */}
        <div className="p-4 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">
              {currentSchema?.name || 'Form Preview'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {fieldCount > 0 && `${fieldCount} fields`}
              {session?.tokens_used && ` • ${session.tokens_used} tokens used`}
            </p>
          </div>
          {currentSchema && (
            <button
              onClick={onFinalize}
              className="btn-primary btn-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Create Form
            </button>
          )}
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentSchema ? (
            <FormPreview schema={currentSchema} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Form preview will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
