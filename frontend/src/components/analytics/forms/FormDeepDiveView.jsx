import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, CheckCircle2, FileText, 
  Activity, ArrowDownRight, Loader2, AlertCircle, TrendingUp
} from 'lucide-react';
import { analyticsApi } from '../../../api/analytics';
import formsApi from '../../../api/forms';

import FieldValueDistribution from './FieldValueDistribution';
import FieldDropoffFunnel from './FieldDropoffFunnel';
import UsageHeatmap from './UsageHeatmap';

export default function FormDeepDiveView() {
  const { formId } = useParams();
  const navigate = useNavigate();
  
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for the selected field to view distribution for
  const [selectedFieldId, setSelectedFieldId] = useState('');

  useEffect(() => {
    if (formId) {
      loadFormData();
    }
  }, [formId]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch form schema and advanced overview in parallel
      const [schemaRes, overviewRes] = await Promise.all([
        formsApi.getForm(formId),
        analyticsApi.getAdvancedFormOverview(formId)
      ]);
      
      if (schemaRes && overviewRes) {
        const formData = schemaRes.form || schemaRes.data || schemaRes;
        console.log('DEBUG [FormDeepDiveView]: formData received:', formData);
        setForm(formData);
        setOverview(overviewRes);
        
        // Access fields correctly from schema object or array - prioritize fields array if present
        let fields = [];
        if (formData.schema?.fields && Array.isArray(formData.schema.fields)) {
          fields = formData.schema.fields;
        } else if (formData.schema?.pages && Array.isArray(formData.schema.pages)) {
          // SurveyJS / Form Builder typical structure
          fields = formData.schema.pages.flatMap(p => p.elements || p.fields || []);
        } else if (Array.isArray(formData.schema)) {
          fields = formData.schema;
        } else if (formData.sections && Array.isArray(formData.sections)) {
          // Alternative structure common in some builders
          fields = formData.sections.flatMap(s => s.fields || []);
        }
        
        console.log('DEBUG [FormDeepDiveView]: Parsed fields:', fields);
        setFields(fields);
        
        // Auto-select the first field with options if available, otherwise just first field
        const firstAnalyzableField = fields.find(f => 
          f && f.type && ['select', 'radio', 'checkbox', 'numeric'].includes(f.type)
        );
        setSelectedFieldId(firstAnalyzableField?.id || fields[0]?.id || '');
      } else {
        throw new Error('Failed to load form analytics data');
      }
    } catch (err) {
      console.error('Error fetching deep dive analytics:', err);
      setError(err?.response?.data?.error || err.message || 'An error occurred Loading Form Analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-100px)]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground font-medium">Loading deep dive analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Error Loading Analytics</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button 
          onClick={() => navigate('/analytics/forms')}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  // Safe defaults for overview metrics
  const displayMetrics = {
    total_submissions: (overview?.metrics?.total_submissions ?? overview?.data?.total_submissions ?? overview?.total_submissions) || 0,
    completion_rate: (overview?.metrics?.completion_rate ?? overview?.data?.completion_rate ?? overview?.completion_rate) || 0,
    avg_completion_time: (overview?.metrics?.avg_completion_time_seconds ?? overview?.metrics?.avg_completion_time ?? overview?.data?.avg_completion_time_seconds ?? overview?.data?.avg_completion_time ?? overview?.avg_completion_time_seconds ?? overview?.avg_completion_time) || 0,
    efficiency_score: (overview?.metrics?.efficiency_score ?? overview?.data?.efficiency_score ?? overview?.efficiency_score) || 0,
    avg_fields_completed: (overview?.metrics?.avg_fields_completed ?? overview?.data?.avg_fields_completed ?? overview?.avg_fields_completed) || 0
  };

  const compRate = typeof displayMetrics.completion_rate === 'number' ? displayMetrics.completion_rate.toFixed(1) : '0.0';
  const avgTimeSeconds = displayMetrics.avg_completion_time;
  const avgTimeMins = Math.floor(Math.abs(avgTimeSeconds) / 60);
  const avgTimeSecs = Math.round(Math.abs(avgTimeSeconds) % 60);
  const avgTimeStr = `${avgTimeMins}m ${avgTimeSecs}s`;
  
  const efficiencyScore = displayMetrics.efficiency_score;
  const scoreColor = efficiencyScore >= 80 ? 'text-emerald-500' : 
                     efficiencyScore >= 60 ? 'text-amber-500' : 'text-red-500';


  // Get currently selected field details
  const selectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 bg-background min-h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/analytics')}
            className="p-2 hover:bg-secondary rounded-full border border-border transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {form?.title || 'Form Analytics'}
              </h1>
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 font-medium tracking-wide shadow-sm">
                DEEP DIVE
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {form?.description || 'Detailed performance and completion analysis'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="px-4 py-2 border border-border rounded-lg bg-card shadow-sm flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Form Efficiency</span>
              <span className={`text-xl font-bold ${scoreColor}`}>
                {displayMetrics.efficiency_score}
                <span className="text-sm text-muted-foreground ml-0.5">/100</span>
              </span>
            </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Submissions */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Total Submissions</h3>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{displayMetrics.total_submissions}</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Completion Rate</h3>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">{compRate}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Vs {(100 - displayMetrics.completion_rate).toFixed(1)}% abandonment
          </p>
        </div>

        {/* Average Time */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Avg. Completion Time</h3>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Clock className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{avgTimeStr}</span>
          </div>
        </div>

        {/* Abandonment Stage */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Fields Completed</h3>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Activity className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {displayMetrics.avg_fields_completed.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">/ {fields.length || 0} fields</span>
          </div>
           <p className="text-xs text-muted-foreground mt-2">
            Average fields filled per user
          </p>
        </div>
      </div>

      {/* Row 2: Funnel and Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FieldDropoffFunnel formId={formId} />
        <UsageHeatmap formId={formId} />
      </div>

      {/* Row 3: Field Level Analysis */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Field Level Distributions
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Select a field to analyze its value distribution across all submissions.
            </p>
          </div>
          
          <div className="w-full sm:w-auto relative">
            <select 
              value={selectedFieldId}
              onChange={(e) => setSelectedFieldId(e.target.value)}
              className="w-full sm:w-64 appearance-none bg-background border border-input text-foreground rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-ring focus:border-input shadow-sm"
            >
              {fields.map((f, i) => (
                <option key={f.id} value={f.id}>
                  {i + 1}. {f.label} ({f.type})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-background h-[350px]">
          {selectedField ? (
            <FieldValueDistribution 
              key={selectedField.id} // Force re-mount on change
              formId={formId}
              fieldId={selectedField.id}
              fieldType={selectedField.type}
              fieldLabel={selectedField.label}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Please select a field to view its distribution.
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
