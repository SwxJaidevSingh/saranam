import { useState, useEffect } from 'react';
import { ArrowRight, Key, Cpu, Info, Save } from 'lucide-react';

export default function LLMConfigStep({ initialConfig, mode, onNext }) {
  const [config, setConfig] = useState({
    ...initialConfig,
    model: initialConfig.model || 'gpt-4o'
  });
  const [showApiKeyHelp, setShowApiKeyHelp] = useState(false);
  const [saveApiKey, setSaveApiKey] = useState(false);

  // Load saved config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('ai_llm_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({
          provider: parsed.provider || 'openai',
          model: parsed.model || 'gpt-4o',
          apiKey: parsed.apiKey || ''
        });
        setSaveApiKey(!!parsed.apiKey);
      } catch (e) {
        console.error('Failed to load saved config:', e);
      }
    }
  }, []);

  const providers = {
    openai: {
      name: 'OpenAI',
      models: [
        { value: 'gpt-4o', label: 'GPT-4o (Latest, Recommended)', cost: '$0.005/1K tokens' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fastest, Cheapest)', cost: '$0.00015/1K tokens' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', cost: '$0.01/1K tokens' },
        { value: 'gpt-4', label: 'GPT-4', cost: '$0.03/1K tokens' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', cost: '$0.001/1K tokens' }
      ],
      helpUrl: 'https://platform.openai.com/api-keys'
    },
    anthropic: {
      name: 'Anthropic',
      models: [
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommended)', cost: '$0.003/1K tokens' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', cost: '$0.015/1K tokens' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Faster)', cost: '$0.00025/1K tokens' }
      ],
      helpUrl: 'https://console.anthropic.com/settings/keys'
    },
    gemini: {
      name: 'Google Gemini',
      models: [
        { value: 'gemini-pro', label: 'Gemini Pro', cost: '$0.0005/1K tokens' },
        { value: 'gemini-pro-vision', label: 'Gemini Pro Vision', cost: '$0.0005/1K tokens' }
      ],
      helpUrl: 'https://makersuite.google.com/app/apikey'
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!config.apiKey) {
      alert('Please enter your API key');
      return;
    }

    // Save config to localStorage if requested
    if (saveApiKey) {
      localStorage.setItem('ai_llm_config', JSON.stringify({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey
      }));
    } else {
      // Clear saved config if not saving
      localStorage.removeItem('ai_llm_config');
    }

    onNext(config);
  };

  const currentProvider = providers[config.provider];

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Bring Your Own API Key</p>
            <p>
              Your API key is used securely and never stored. You'll be charged directly by {currentProvider.name} for AI usage.
              {mode === 'healthcare' && (
                <span className="block mt-1 font-medium">
                  Healthcare mode includes ABDM compliance, LOINC codes, and clinical risk scoring.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="form-group">
        <label className="form-label flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          LLM Provider
        </label>
        <select
          value={config.provider}
          onChange={(e) => setConfig({ ...config, provider: e.target.value, model: providers[e.target.value].models[0].value })}
          className="input"
          required
        >
          {Object.entries(providers).map(([key, provider]) => (
            <option key={key} value={key}>{provider.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Choose your preferred AI provider
        </p>
      </div>

      {/* Model Selection */}
      <div className="form-group">
        <label className="form-label">Model</label>
        <select
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          className="input"
          required
        >
          {currentProvider.models.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label} ({model.cost})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Recommended models balance quality and cost
        </p>
      </div>

      {/* API Key */}
      <div className="form-group">
        <div className="flex items-center justify-between mb-2">
          <label className="form-label flex items-center gap-2 mb-0">
            <Key className="w-4 h-4" />
            API Key
          </label>
          <button
            type="button"
            onClick={() => setShowApiKeyHelp(!showApiKeyHelp)}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            {showApiKeyHelp ? 'Hide help' : 'Where do I get this?'}
          </button>
        </div>

        {showApiKeyHelp && (
          <div className="mb-3 p-3 bg-secondary border border-border rounded text-sm">
            <p className="font-medium mb-1">Getting your {currentProvider.name} API Key:</p>
            <ol className="list-decimal list-inside space-y-1 text-foreground">
              <li>Go to <a href={currentProvider.helpUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{currentProvider.helpUrl}</a></li>
              <li>Sign up or log in to your account</li>
              <li>Create a new API key</li>
              <li>Copy and paste it below</li>
            </ol>
          </div>
        )}

        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          className="input font-mono"
          placeholder={`sk-...`}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          🔒 Your key is used securely and never sent to our servers
        </p>

        {/* Save API Key Checkbox */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="save-api-key"
            checked={saveApiKey}
            onChange={(e) => setSaveApiKey(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
          />
          <label htmlFor="save-api-key" className="text-sm text-foreground flex items-center gap-1.5 cursor-pointer">
            <Save className="w-3.5 h-3.5" />
            Save API key and settings locally for next time
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          Saved to your browser's local storage (not on our servers)
        </p>
      </div>

      {/* Cost Estimate */}
      <div className="bg-secondary border border-border rounded-lg p-4">
        <h3 className="font-semibold text-foreground mb-2">Estimated Cost</h3>
        <p className="text-sm text-foreground">
          Typical form generation: <span className="font-semibold">$0.10 - $0.20</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Includes initial generation + 2-3 refinements (~12,000 tokens)
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <span>Start Building with AI</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
