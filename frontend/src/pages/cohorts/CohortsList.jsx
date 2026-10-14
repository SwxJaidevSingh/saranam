import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Grid3x3, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CohortCard } from '@/components/cohorts/CohortCard';
import { getCohorts, deleteCohort, recalculateCohort } from '@/api/cohorts';

export default function CohortsList() {
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadCohorts();
  }, []);

  const loadCohorts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCohorts();
      setCohorts(data.cohorts || []);
    } catch (err) {
      console.error('Error loading cohorts:', err);
      setError(err.response?.data?.error || 'Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCohorts();
    setIsRefreshing(false);
  };

  const handleView = (cohortId) => {
    navigate(`/cohorts/${cohortId}`);
  };

  const handleEdit = (cohortId) => {
    navigate(`/cohorts/${cohortId}/edit`);
  };

  const handleDelete = async (cohortId) => {
    if (!window.confirm('Are you sure you want to delete this cohort?')) {
      return;
    }

    try {
      await deleteCohort(cohortId);
      setCohorts(cohorts.filter(c => c.id !== cohortId));
    } catch (err) {
      console.error('Error deleting cohort:', err);
      alert('Failed to delete cohort: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRecalculate = async (cohortId) => {
    try {
      const result = await recalculateCohort(cohortId);
      alert(`Cohort recalculated successfully. New member count: ${result.member_count}`);
      loadCohorts(); // Reload to show updated counts
    } catch (err) {
      console.error('Error recalculating cohort:', err);
      alert('Failed to recalculate cohort: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateNew = () => {
    navigate('/cohorts/new');
  };

  // Filter cohorts based on search query
  const filteredCohorts = cohorts.filter(cohort =>
    cohort.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cohort.description && cohort.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading cohorts</p>
          <p className="text-sm mt-1">{error}</p>
          <Button onClick={loadCohorts} variant="outline" className="mt-3" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Patient Cohorts</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage dynamic patient groups for targeted interventions
          </p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Cohort
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cohorts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Cohorts</p>
          <p className="text-3xl font-bold">{cohorts.length}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Active Cohorts</p>
          <p className="text-3xl font-bold">
            {cohorts.filter(c => c.is_active).length}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Patients</p>
          <p className="text-3xl font-bold">
            {cohorts.reduce((sum, c) => sum + (c.member_count || 0), 0)}
          </p>
        </div>
      </div>

      {/* Cohorts Grid/List */}
      {loading ? (
        <div className={viewMode === 'grid' ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card rounded-lg border p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-16 w-24" />
                <Skeleton className="h-16 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCohorts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">
            {searchQuery ? 'No cohorts found matching your search' : 'No cohorts yet'}
          </p>
          {!searchQuery && (
            <Button onClick={handleCreateNew} className="mt-4">
              Create Your First Cohort
            </Button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3' : 'space-y-4'}>
          {filteredCohorts.map((cohort) => (
            <CohortCard
              key={cohort.id}
              cohort={cohort}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRecalculate={handleRecalculate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
