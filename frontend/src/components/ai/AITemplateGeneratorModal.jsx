import { useState } from 'react';
import { X, Sparkles, Package } from 'lucide-react';
import LLMConfigStep from './LLMConfigStep';
import TemplateConversationStep from './TemplateConversationStep';
import aiFormsApi from '../../api/ai-forms';

export default function AITemplateGeneratorModal({ isOpen, onClose, mode = 'general' }) {
  const [step, setStep] = useState(1); // 1: Config, 2: Describe, 3: Refine & Preview
  const [llmConfig, setLLMConfig] = useState({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: ''
  });
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [currentSchema, setCurrentSchema] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');

  // Template categories
  const categories = [
    'Healthcare Assessment',
    'Patient Intake',
    'Physiotherapy',
    'Mental Health',
    'Diagnostic Forms',
    'Screening & Prevention',
    'General Forms',
    'Event Registration',
    'Survey & Feedback',
    'Contact & Application'
  ];

  const handleStartSession = (config) => {
    setLLMConfig(config);
    setStep(2);
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please describe the template you want to create');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await aiFormsApi.generateTemplate({
        llm_provider: llmConfig.provider,
        llm_model: llmConfig.model,
        api_key: llmConfig.apiKey,
        mode: mode,
        user_message: description
      });

      setGeneratedData(response);
      setMetadata(response.metadata);
      setCurrentSchema(response.schema);
      setConversation([
        { role: 'user', content: description },
        { role: 'assistant', content: response.message }
      ]);
      setStep(3);

    } catch (err) {
      console.error('Generation error:', err);
      setError(err.response?.data?.error || 'Failed to generate template. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (message) => {
    setIsGenerating(true);
    setError('');

    try {
      // Use regular generate endpoint for refinement
      const response = await aiFormsApi.generate({
        llm_provider: llmConfig.provider,
        llm_model: llmConfig.model,
        api_key: llmConfig.apiKey,
        mode: mode,
        user_message: message,
        conversation_history: conversation,
        current_schema: currentSchema
      });

      setConversation([
        ...conversation,
        { role: 'user', content: message },
        { role: 'assistant', content: response.message }
      ]);
      setCurrentSchema(response.schema);

    } catch (err) {
      console.error('Refinement error:', err);
      setError(err.response?.data?.error || 'Failed to refine template. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveTemplate = async (editedMetadata) => {
    if (!generatedData || !currentSchema) return;

    try {
      const result = await aiFormsApi.saveTemplate({
        session_id: generatedData.session_id,
        name: editedMetadata.name,
        category: editedMetadata.category,
        description: editedMetadata.description,
        use_cases: editedMetadata.use_cases || metadata.use_cases,
        target_users: editedMetadata.target_users || metadata.target_users,
        is_public: true
      });

      alert(`Template "${editedMetadata.name}" saved successfully!`);
      handleClose();
      // Optionally refresh template list
      window.location.reload();

    } catch (err) {
      console.error('Save error:', err);
      throw err;
    }
  };

  const handleClose = () => {
    setStep(1);
    setDescription('');
    setGeneratedData(null);
    setConversation([]);
    setCurrentSchema(null);
    setMetadata(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

        {/* Modal */}
        <div className={`relative w-full bg-card rounded-xl shadow-2xl flex flex-col ${
          step === 3 ? 'max-w-7xl h-[90vh]' : 'max-w-4xl max-h-[90vh]'
        }`}>
          {/* Header */}
          {step !== 3 && (
            <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    AI Template Generator
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {mode === 'healthcare' ? '🏥 Healthcare Templates' : '📝 General Templates'}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="text-muted-foreground/70 hover:text-muted-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className={`flex-1 ${step === 3 ? '' : 'overflow-y-auto p-6'}`}>
            {/* Step 1: LLM Config */}
            {step === 1 && (
              <LLMConfigStep
                initialConfig={llmConfig}
                mode={mode}
                onNext={handleStartSession}
              />
            )}

            {/* Step 2: Describe Template */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <p className="font-semibold mb-1">Describe your template</p>
                      <p>
                        Tell the AI what kind of template to create. Be specific about the purpose,
                        target audience, and what fields should be included.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">What template do you want to create?</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={mode === 'healthcare'
                      ? "Example: Create a comprehensive patient intake template for cardiology clinics with sections for demographics, medical history, current medications, cardiovascular symptoms, and risk assessment"
                      : "Example: Create an employee onboarding template with sections for personal information, emergency contacts, tax details, direct deposit information, and policy acknowledgments"
                    }
                    className="input"
                    rows={6}
                    disabled={isGenerating}
                  />
                </div>

                {error && (
                  <div className="alert-danger">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="btn-ghost"
                    disabled={isGenerating}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={!description.trim() || isGenerating}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating Template...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Refine & Preview */}
            {step === 3 && currentSchema && metadata && (
              <TemplateConversationStep
                conversation={conversation}
                currentSchema={currentSchema}
                session={generatedData}
                isGenerating={isGenerating}
                error={error}
                mode={mode}
                metadata={metadata}
                onSendMessage={handleSendMessage}
                onSaveTemplate={handleSaveTemplate}
                onBack={() => setStep(2)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
