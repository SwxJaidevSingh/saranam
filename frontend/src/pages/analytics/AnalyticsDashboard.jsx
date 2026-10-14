import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Users, ClipboardList, Activity, AlertTriangle, MapPin, TrendingUp, Heart, IndianRupee, Thermometer, BadgeIndianRupee, HandHeart, PhoneCall, Presentation, FileSpreadsheet } from 'lucide-react';
import { subMonths } from 'date-fns';
import axios from 'axios';

// Shadcn components
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Custom analytics components
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { ExportButton } from '@/components/analytics/ExportButton';
import { PatientAnalysisView } from '@/components/analytics/PatientAnalysisView';
import { FormAnalysisView } from '@/components/analytics/FormAnalysisView';
import { DiseaseAnalysisView } from '@/components/analytics/DiseaseAnalysisView';
import { RiskAnalysisView } from '@/components/analytics/RiskAnalysisView';
import { GeospatialAnalysisView } from '@/components/analytics/GeospatialAnalysisView';
import ProviderOptimizationView from '@/components/analytics/ProviderOptimizationView';
import ClinicalOutcomesView from '@/components/analytics/ClinicalOutcomesView';
import OperationalFinancialView from '@/components/analytics/OperationalFinancialView';
import { VitalsAnalysisView } from '@/components/analytics/VitalsAnalysisView';
import { DonorAnalyticsView } from '@/components/analytics/DonorAnalyticsView';
import PrescriptionAnalyticsView from '@/components/analytics/PrescriptionAnalyticsView';
import { TelemedicineAnalyticsView } from '@/components/analytics/TelemedicineAnalyticsView';
import { PptAnalyticsView } from '@/components/analytics/PptAnalyticsView';
import { ReportGeneratorView } from '@/components/analytics/report';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';

const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('ppt'); // default to PPT Charts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [formData, setFormData] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: subMonths(new Date(), 12),
    to: new Date()
  });
  const [patientFilter, setPatientFilter] = useState('all');

  useEffect(() => {
    if (activeView === 'patient') {
      fetchPatientData();
    } else if (activeView === 'form') {
      fetchFormData();
    }
  }, [dateRange, patientFilter, activeView]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_BASE_URL}/api/analytics/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          start_date: dateRange?.from?.toISOString(),
          end_date: dateRange?.to?.toISOString(),
          patient_type: patientFilter !== 'all' ? patientFilter : undefined
        }
      });

      setPatientData(response.data);
    } catch (err) {
      console.error('Error fetching patient data:', err);
      setError(err.response?.data?.error || 'Failed to load patient data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_BASE_URL}/api/analytics/forms`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          start_date: dateRange?.from?.toISOString(),
          end_date: dateRange?.to?.toISOString()
        }
      });

      setFormData(response.data);
    } catch (err) {
      console.error('Error fetching form data:', err);
      setError(err.response?.data?.error || 'Failed to load form analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (activeView === 'patient') {
      fetchPatientData();
    } else if (activeView === 'form') {
      fetchFormData();
    }
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{error}</p>
          <Button onClick={handleRefresh} variant="outline" className="mt-3" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Prepare export data based on active view
  const exportData = activeView === 'patient' && patientData ? {
    stats: {
      totalPatients: patientData.summary?.total_patients,
      newPatients: patientData.summary?.new_patients,
      activePatients: patientData.summary?.active_patients,
      totalForms: patientData.summary?.total_forms,
      formCompletionRate: patientData.trends?.form_completion_rate,
      avgResponseTime: patientData.trends?.average_response_time_hours ? `${patientData.trends.average_response_time_hours} hours` : 'N/A'
    },
    ageDistribution: patientData.demographics?.age_distribution?.map(item => ({
      ageGroup: item.range,
      count: item.count
    })),
    genderDistribution: patientData.demographics?.gender_distribution?.map(item => ({
      name: item.gender || 'Unknown',
      value: item.count
    }))
  } : activeView === 'form' && formData ? {
    stats: {
      totalForms: formData.summary?.total_forms,
      totalSubmissions: formData.summary?.total_submissions,
      avgCompletionRate: `${formData.summary?.average_completion_rate}%`,
      avgCompletionTime: `${formData.summary?.average_completion_time_minutes} minutes`
    },
    statusBreakdown: formData.status_breakdown,
    topForms: formData.top_forms
  } : null;

  return (
    <div className="p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive insights into {
              activeView === 'report' ? 'custom datasets with selectable columns and exports' :
              activeView === 'ppt' ? 'PPT and presentation' :
              activeView === 'patient' ? 'patient demographics and operational' :
              activeView === 'form' ? 'form usage and completion' :
              activeView === 'donor' ? 'Theory of Change-aligned stewardship' :
              activeView === 'vitals' ? 'vital sign trends and clinical correlations' :
              activeView === 'symptoms' ? 'patient symptom prevalence and trends' :
              activeView === 'risk' ? 'patient risk stratification' :
              activeView === 'geo' ? 'geographic distribution and hotspots' :
              activeView === 'optimization' ? 'provider performance and scheduling efficiency' :
              activeView === 'clinical' ? 'clinical outcomes and care quality' :
              'financial performance and bed utilization'
            } metrics
          </p>
        </div>
        
        {activeView === 'form' && (
          <div className="flex justify-end">
            <Button 
              onClick={() => navigate('/analytics/forms')}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <TrendingUp className="h-4 w-4" />
              Advanced Form Analytics Hub
            </Button>
          </div>
        )}

        {/* Toggle Buttons */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 overflow-x-auto max-w-full">
            <Button
              variant={activeView === 'ppt' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('ppt')}
              className="gap-2 shrink-0"
            >
              <Presentation className="h-4 w-4" />
              PPT Charts
            </Button>
            <Button
              variant={activeView === 'report' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('report')}
              className="gap-2 shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Custom Report
            </Button>
            <Button
              variant={activeView === 'patient' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('patient')}
              className="gap-2 shrink-0"
            >
              <Users className="h-4 w-4" />
              Patient
            </Button>
            {/* Hidden per user request
            <Button
              variant={activeView === 'form' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('form')}
              className="gap-2 shrink-0"
            >
              <ClipboardList className="h-4 w-4" />
              Forms
            </Button>
            */}
            <Button
              variant={activeView === 'telemedicine' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('telemedicine')}
              className="gap-2 shrink-0"
            >
              <PhoneCall className="h-4 w-4" />
              Telemedicine
            </Button>
            <Button
              variant={activeView === 'vitals' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('vitals')}
              className="gap-2 shrink-0"
            >
              <Thermometer className="h-4 w-4" />
              Vitals
            </Button>
            <Button
              variant={activeView === 'donor' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('donor')}
              className="gap-2 shrink-0"
            >
              <HandHeart className="h-4 w-4" />
              Donor / ToC
            </Button>
            <Button
              variant={activeView === 'prescriptions' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('prescriptions')}
              className="gap-2 shrink-0"
            >
              <ClipboardList className="h-4 w-4" />
              Prescriptions
            </Button>
            <Button
              variant={activeView === 'diseases' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('diseases')}
              className="gap-2 shrink-0"
            >
              <Activity className="h-4 w-4" />
              Diseases
            </Button>
            <Button
              variant={activeView === 'geo' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleViewChange('geo')}
              className="gap-2 shrink-0"
            >
              <MapPin className="h-4 w-4" />
              Geospatial
            </Button>
            {/* Hidden tabs — uncomment when ready for production
            <Button variant={activeView === 'symptoms' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('symptoms')} className="gap-2 shrink-0"><Activity className="h-4 w-4" />Symptoms</Button>
            <Button variant={activeView === 'risk' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('risk')} className="gap-2 shrink-0"><AlertTriangle className="h-4 w-4" />Risk</Button>
            <Button variant={activeView === 'optimization' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('optimization')} className="gap-2 shrink-0"><TrendingUp className="h-4 w-4" />Optimization</Button>
            <Button variant={activeView === 'clinical' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('clinical')} className="gap-2 shrink-0"><Heart className="h-4 w-4" />Outcomes</Button>
            <Button variant={activeView === 'financial' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('financial')} className="gap-2 shrink-0"><IndianRupee className="h-4 w-4" />Financial</Button>
            */}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeView === 'patient' && (
              <Select value={patientFilter} onValueChange={setPatientFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter patients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Patients</SelectItem>
                  <SelectItem value="new">New Patients</SelectItem>
                  <SelectItem value="active">Active Patients</SelectItem>
                </SelectContent>
              </Select>
            )}
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <ExportButton data={exportData} dateRange={dateRange} viewType={activeView} />
          </div>
        </div>
      </div>

      <Separator />

      {/* Conditional Content Rendering */}
      {activeView === 'ppt' && <PptAnalyticsView />}
      {activeView === 'report' && <ReportGeneratorView />}
      {activeView === 'patient' && <PatientAnalysisView data={patientData} loading={loading} />}
      {activeView === 'telemedicine' && <TelemedicineAnalyticsView />}
      {/* Hidden per user request
      {activeView === 'form' && <FormAnalysisView data={formData} loading={loading} />}
      */}
      {activeView === 'vitals' && <VitalsAnalysisView />}
      {activeView === 'donor' && <DonorAnalyticsView dateRange={dateRange} />}
      {activeView === 'prescriptions' && <PrescriptionAnalyticsView />}
      {activeView === 'diseases' && <DiseaseAnalysisView />}
      {activeView === 'geo' && <GeospatialAnalysisView />}
      {/* Hidden views — uncomment when ready for production
      {activeView === 'symptoms' && <SymptomAnalysisView />}
      {activeView === 'risk' && <RiskAnalysisView />}
      {activeView === 'optimization' && <ProviderOptimizationView />}
      {activeView === 'clinical' && <ClinicalOutcomesView />}
      {activeView === 'financial' && <OperationalFinancialView />}
      */}
    </div>
  );
};

export default AnalyticsDashboard;
