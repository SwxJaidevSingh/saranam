import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import LLMConfigStep from './LLMConfigStep';
import ConversationStep from './ConversationStep';
import aiFormsApi from '../../api/ai-forms';

export default function AIFormBuilderModal({ isOpen, onClose, mode = 'general' }) {
  const [step, setStep] = useState(1); // 1: Config, 2: Conversation
  const [llmConfig, setLLMConfig] = useState({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: ''
  });
  const [session, setSession] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [currentSchema, setCurrentSchema] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleStartSession = (config) => {
    setLLMConfig(config);
    setStep(2);
  };

  const handleSendMessage = async (message) => {
    setIsGenerating(true);
    setError('');

    try {
      const response = await aiFormsApi.generate({
        llm_provider: llmConfig.provider,
        llm_model: llmConfig.model,
        api_key: llmConfig.apiKey,
        mode: mode,
        user_message: message,
        conversation_history: conversation,
        current_schema: currentSchema
      });

      setSession(response);
      setConversation([
        ...conversation,
        { role: 'user', content: message },
        { role: 'assistant', content: response.message }
      ]);
      setCurrentSchema(response.schema);

    } catch (err) {
      console.error('Generation error:', err);
      setError(err.response?.data?.error || 'Failed to generate form. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!session || !currentSchema) {
      alert('No form to save');
      return;
    }

    try {
      const result = await aiFormsApi.finalize({
        session_id: session.session_id,
        form_name: currentSchema.name,
        form_description: currentSchema.description
      });

      alert('Form created successfully!');
      onClose();
      // Redirect to form builder
      window.location.href = `/forms/${result.form_id}/edit`;

    } catch (err) {
      console.error('Finalize error:', err);
      alert(err.response?.data?.error || 'Failed to save form');
    }
  };

  const handleClose = () => {
    if (session && session.session_id) {
      // Optionally abandon session
      aiFormsApi.abandonSession(session.session_id).catch(console.error);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

        {/* Modal */}
        <div className="relative w-full max-w-6xl bg-card rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  AI Form Builder
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === 'healthcare' ? '🏥 Healthcare Mode' : '📝 General Mode'}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="text-muted-foreground/70 hover:text-muted-foreground">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {step === 1 && (
              <LLMConfigStep
                initialConfig={llmConfig}
                mode={mode}
                onNext={handleStartSession}
              />
            )}

            {step === 2 && (
              <ConversationStep
                conversation={conversation}
                currentSchema={currentSchema}
                session={session}
                isGenerating={isGenerating}
                error={error}
                mode={mode}
                onSendMessage={handleSendMessage}
                onFinalize={handleFinalize}
                onBack={() => setStep(1)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
