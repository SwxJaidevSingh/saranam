import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  RefreshCw,
  Download,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CohortPatientList } from '@/components/cohorts/CohortPatientList';
import { OutcomeTracker } from '@/components/cohorts/OutcomeTracker';
import { getCohort, recalculateCohort, exportCohortPatients } from '@/api/cohorts';
import { formatDistanceToNow, format } from 'date-fns';

export default function CohortDetail() {
  const navigate = useNavigate();
  const { cohortId } = useParams();

  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('patients');

  useEffect(() => {
    loadCohort();
  }, [cohortId]);

  const loadCohort = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCohort(cohortId);
      setCohort(data.cohort);
    } catch (err) {
      console.error('Error loading cohort:', err);
      setError(err.response?.data?.error || 'Failed to load cohort');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/cohorts/${cohortId}/edit`);
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const result = await recalculateCohort(cohortId);
      // Update the cohort with new member count
      setCohort(prev => ({
        ...prev,
        member_count: result.member_count,
        last_calculated_at: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('Error recalculating cohort:', err);
      alert('Failed to recalculate cohort: ' + (err.response?.data?.error || err.message));
    } finally {
      setRecalculating(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportCohortPatients(cohortId);
    } catch (err) {
      console.error('Error exporting patients:', err);
      alert('Failed to export patients: ' + (err.response?.data?.error || err.message));
    } finally {
      setExporting(false);
    }
  };

  const handleBack = () => {
    navigate('/cohorts');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const formatFullDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return format(new Date(dateString), 'PPpp');
    } catch {
      return 'Unknown';
    }
  };

  const renderCriteriaReadable = (criteria) => {
    const parts = [];

    if (criteria.age) {
      const { min, max } = criteria.age;
      if (min && max) {
        parts.push(`Age between ${min} and ${max}`);
      } else if (min) {
        parts.push(`Age ${min} or older`);
      } else if (max) {
        parts.push(`Age ${max} or younger`);
      }
    }

    if (criteria.gender && criteria.gender.length > 0) {
      parts.push(`Gender: ${criteria.gender.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ')}`);
    }

    if (criteria.location) {
      const locParts = [];
      if (criteria.location.city) locParts.push(criteria.location.city);
      if (criteria.location.state) locParts.push(criteria.location.state);
      if (locParts.length > 0) {
        parts.push(`Location: ${locParts.join(', ')}`);
      }
    }

    if (criteria.last_visit) {
      const { operator, days, end_days } = criteria.last_visit;
      if (operator === 'within_days') {
        parts.push(`Visited within last ${days} days`);
      } else if (operator === 'before_days') {
        parts.push(`Last visit more than ${days} days ago`);
      } else if (operator === 'between' && end_days) {
        parts.push(`Last visit between ${days} and ${end_days} days ago`);
      }
    }

    if (criteria.forms_completed) {
      const { min, max } = criteria.forms_completed;
      if (min && max) {
        parts.push(`Forms completed: ${min} to ${max}`);
      } else if (min) {
        parts.push(`At least ${min} forms completed`);
      } else if (max) {
        parts.push(`Up to ${max} forms completed`);
      }
    }

    return parts.length > 0 ? parts : ['No criteria defined'];
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading cohort</p>
          <p className="text-sm mt-1">{error}</p>
          <div className="flex gap-2 mt-3">
            <Button onClick={loadCohort} variant="outline" size="sm">
              Try Again
            </Button>
            <Button onClick={handleBack} variant="outline" size="sm">
              Back to Cohorts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!cohort) {
    return null;
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{cohort.name}</h1>
              <p className="text-muted-foreground mt-2">
                {cohort.description || 'No description provided'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={cohort.is_active ? 'default' : 'outline'}>
                {cohort.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {cohort.auto_update && (
                <Badge variant="outline" className="border-success-300 bg-success-50 text-success-700">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Auto-updating {cohort.update_frequency}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button onClick={handleEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Edit Cohort
        </Button>
        <Button
          onClick={handleRecalculate}
          variant="outline"
          className="gap-2"
          disabled={recalculating}
        >
          <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Recalculating...' : 'Recalculate'}
        </Button>
        <Button
          onClick={handleExport}
          variant="outline"
          className="gap-2"
          disabled={exporting || cohort.member_count === 0}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Patients</CardDescription>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-100">
                <Users className="h-5 w-5 text-primary-600" />
              </div>
              <CardTitle className="text-3xl">{cohort.member_count || 0}</CardTitle>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Last Calculated</CardDescription>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success-100">
                <Calendar className="h-5 w-5 text-success-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{formatDate(cohort.last_calculated_at)}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatFullDate(cohort.last_calculated_at)}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Created</CardDescription>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info-100">
                <Activity className="h-5 w-5 text-info-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{formatDate(cohort.created_at)}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  by {cohort.created_by_username || 'Unknown'}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Criteria */}
      <Card>
        <CardHeader>
          <CardTitle>Selection Criteria</CardTitle>
          <CardDescription>Patients matching all of the following criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {renderCriteriaReadable(cohort.criteria).map((criterion, index) => (
              <div key={index} className="flex items-center gap-2">
                <Badge variant="outline">{criterion}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Patients and Outcomes */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="outcomes">Outcome Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="mt-6">
          <CohortPatientList cohortId={cohortId} />
        </TabsContent>

        <TabsContent value="outcomes" className="mt-6">
          <OutcomeTracker cohortId={cohortId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
