import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, TrendingUp, Search, 
  ChevronRight, Calendar, Users, Loader2, AlertCircle
} from 'lucide-react';
import { analyticsApi } from '../../../api/analytics';
import formsApi from '../../../api/forms';

export default function FormAnalyticsHub() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [analyticsMap, setAnalyticsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFormsAndAnalytics();
  }, []);

  const loadFormsAndAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all available forms
      const formsRes = await formsApi.getAllForms();
      const formList = formsRes.forms || [];
      setForms(formList);
      
      // Load high-level analytics for each form sequentially or use a bulk endpoint if available
      // Actually, since we don't have a bulk endpoint in the new service yet, we can fetch
      // the existing global form analytics which has basic stats, or fetch advanced for the top few.
      // For now, let's use the existing global analytics which should return some basics for all forms.
      const globalRes = await analyticsApi.getFormAnalytics();
      
      if (globalRes) {
        // Map the summary and top forms to the statsMap
        const statsMap = {};
        
        // Use top forms data if available
        const topForms = globalRes.top_forms || [];
        topForms.forEach(item => {
          statsMap[item.form_id] = {
            submissions: item.submissions || 0,
            completion_rate: 'N/A', // Global endpoint doesn't provide per-form rates yet
            avg_time: 0
          };
        });
        
        setAnalyticsMap(statsMap);
      }
      
    } catch (err) {
      console.error('Error loading form hub:', err);
      setError(err?.response?.data?.error || err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  const filteredForms = forms.filter(f => 
    (f.name || f.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (f.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  if (loading) {
    return (
      <div className="flex justify-center flex-col items-center h-[calc(100vh-100px)]">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium">Loading form registry...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 bg-background min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
             <TrendingUp className="w-8 h-8 text-primary" />
             Form Analytics Hub
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Monitor submission rates, identify bottlenecks, and explore the value distributions of your clinical and operational forms.
          </p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-ring focus:border-input shadow-sm transition-all text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Form List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredForms.map(form => {
          const stats = analyticsMap[form.id] || { submissions: 0, completion_rate: '0.0', avg_time: 0 };
          
          return (
            <div 
              key={form.id}
              onClick={() => navigate(`/analytics/forms/${form.id}`)}
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col h-full relative overflow-hidden"
            >
              {/* Highlight bar inside card */}
              <div className="absolute top-0 left-0 w-1 h-full bg-primary origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>

              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-secondary text-primary rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {form.name || form.title}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      Created {new Date(form.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-2 my-4 flex-1">
                {form.description || 'No description provided.'}
              </p>
              
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/50">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Submissions</p>
                  <p className="font-medium text-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    {stats.submissions}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Completion</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    {typeof stats.completion_rate === 'number' 
                      ? `${stats.completion_rate.toFixed(1)}%` 
                      : `${stats.completion_rate}%`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Avg Time</p>
                  <p className="font-medium text-foreground">{formatTime(stats.avg_time)}</p>
                </div>
              </div>
              
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                <ChevronRight className="w-5 h-5 text-primary" />
              </div>
            </div>
          );
        })}
      </div>

      {filteredForms.length === 0 && !loading && !error && (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <FileText className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-foreground">No forms found</h3>
          <p className="text-muted-foreground">Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
}
