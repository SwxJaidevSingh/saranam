/**
 * Reusable AI summary block for assessment forms.
 *
 * Renders the "Auto-Generated Summary (editable)" textarea + the
 * "Generate from assessment" trigger button. The assessment must already be
 * saved at least once before the LLM can summarize it (the backend reads the
 * persisted row), so the parent passes `hasSavedRow`.
 */
import { Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';
import saranamApi from '../../../api/saranam';


export default function AiSummaryBlock({
  visitId,
  assessmentType,         // 'nursing' | 'doctor' | 'psychological' | 'physiotherapy'
  value,
  onChange,
  hasSavedRow,
  label = 'Auto-Generated Summary (editable)',
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!hasSavedRow) {
      alert('Save the assessment first — the AI summary reads the saved record.');
      return;
    }
    setGenerating(true);
    try {
      const { summary } = await saranamApi.generateAssessmentSummary(visitId, assessmentType);
      onChange(summary || '');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to generate AI summary');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !hasSavedRow}
          title={!hasSavedRow ? 'Save assessment first' : ''}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? 'Generating...' : 'Generate from assessment'}
        </button>
      </div>
      <textarea
        rows={4}
        placeholder="Click 'Generate from assessment' or type manually..."
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
      />
    </div>
  );
}
