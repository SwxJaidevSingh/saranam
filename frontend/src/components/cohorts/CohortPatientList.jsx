import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, CheckSquare, Square, Mail, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkActionDialog } from './BulkActionDialog';
import { getCohortPatients } from '@/api/cohorts';
import { format } from 'date-fns';

export function CohortPatientList({ cohortId }) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPatients, setSelectedPatients] = useState(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  // Pagination and filtering
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [qualifiesFilter, setQualifiesFilter] = useState('all'); // 'all', 'qualified', 'no-longer'

  useEffect(() => {
    loadPatients();
  }, [cohortId, page, perPage, qualifiesFilter]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const stillQualifies = qualifiesFilter === 'all' ? null : qualifiesFilter === 'qualified';
      const data = await getCohortPatients(cohortId, page, perPage, stillQualifies);
      setPatients(data.patients || []);
      setTotalCount(data.total_count || 0);
      setSelectedPatients(new Set()); // Clear selection on reload
    } catch (err) {
      console.error('Error loading patients:', err);
      setError(err.response?.data?.error || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedPatients.size === patients.length) {
      setSelectedPatients(new Set());
    } else {
      setSelectedPatients(new Set(patients.map(p => p.id)));
    }
  };

  const handleSelectPatient = (patientId) => {
    const newSelected = new Set(selectedPatients);
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId);
    } else {
      newSelected.add(patientId);
    }
    setSelectedPatients(newSelected);
  };

  const handleViewPatient = (patientId) => {
    navigate(`/patients/${patientId}`);
  };

  const handleBulkAction = () => {
    setShowBulkDialog(true);
  };

  const handleBulkActionComplete = () => {
    setShowBulkDialog(false);
    setSelectedPatients(new Set());
    loadPatients(); // Reload after bulk action
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  // Filter patients by search query
  const filteredPatients = patients.filter(patient => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      patient.first_name?.toLowerCase().includes(query) ||
      patient.last_name?.toLowerCase().includes(query) ||
      patient.email?.toLowerCase().includes(query) ||
      patient.phone?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(totalCount / perPage);
  const allSelected = selectedPatients.size === patients.length && patients.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cohort Members</CardTitle>
            <CardDescription>
              {totalCount} {totalCount === 1 ? 'patient' : 'patients'} in this cohort
            </CardDescription>
          </div>
          {selectedPatients.size > 0 && (
            <Button onClick={handleBulkAction} className="gap-2">
              <Activity className="h-4 w-4" />
              Bulk Actions ({selectedPatients.size})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={qualifiesFilter} onValueChange={setQualifiesFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients</SelectItem>
                <SelectItem value="qualified">Still Qualifies</SelectItem>
                <SelectItem value="no-longer">No Longer Qualifies</SelectItem>
              </SelectContent>
            </Select>

            <Select value={perPage.toString()} onValueChange={(val) => setPerPage(parseInt(val))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
            <p className="font-medium">Error loading patients</p>
            <p className="text-sm mt-1">{error}</p>
            <Button onClick={loadPatients} variant="outline" className="mt-3" size="sm">
              Try Again
            </Button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              {searchQuery ? 'No patients found matching your search' : 'No patients in this cohort'}
            </p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSelectAll}
                        className="h-8 w-8"
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSelectPatient(patient.id)}
                          className="h-8 w-8"
                        >
                          {selectedPatients.has(patient.id) ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell onClick={() => handleViewPatient(patient.id)}>
                        <div className="font-medium">
                          {patient.first_name} {patient.last_name}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => handleViewPatient(patient.id)}>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{patient.email || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => handleViewPatient(patient.id)}>
                        {patient.phone || 'N/A'}
                      </TableCell>
                      <TableCell onClick={() => handleViewPatient(patient.id)}>
                        <span className="capitalize">{patient.gender || 'N/A'}</span>
                      </TableCell>
                      <TableCell onClick={() => handleViewPatient(patient.id)}>
                        {formatDate(patient.date_of_birth)}
                      </TableCell>
                      <TableCell onClick={() => handleViewPatient(patient.id)}>
                        {patient.still_qualifies !== undefined && (
                          <Badge
                            variant={patient.still_qualifies ? 'default' : 'outline'}
                            className={
                              patient.still_qualifies
                                ? 'bg-success-100 text-success-700 border-success-300'
                                : 'bg-warning-100 text-warning-700 border-warning-300'
                            }
                          >
                            {patient.still_qualifies ? 'Qualifies' : 'No Longer'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell onClick={() => handleViewPatient(patient.id)}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, totalCount)} of{' '}
                  {totalCount} patients
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Bulk Action Dialog */}
      {showBulkDialog && (
        <BulkActionDialog
          cohortId={cohortId}
          selectedPatients={Array.from(selectedPatients)}
          onClose={() => setShowBulkDialog(false)}
          onComplete={handleBulkActionComplete}
        />
      )}
    </Card>
  );
}
