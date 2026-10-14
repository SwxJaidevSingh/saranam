/**
 * PatientsList Page
 * Main patient management interface with modern design
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  UserPlus,
  Search as SearchIcon,
  Loader2,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  LayoutGrid,
  List as ListIcon,
  Phone,
  MapPin,
  ClipboardList,
  Eye,
  Download,
  ArrowUpDown
} from 'lucide-react';
import Papa from 'papaparse';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

import { usePatient } from '../../context/PatientContext';
import patientsApi from '../../api/patients';
import PatientCard from '../../components/patients/PatientCard';
import PatientQuickAdd from '../../components/patients/PatientQuickAdd';
import { cn } from '@/lib/utils';

const calculateAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const ZONE_OPTIONS = ['North', 'South', 'East', 'West', 'Central'];

const CSV_PAGE_SIZE = 100;

const patientStatus = (patient) => {
  if (patient.is_deceased) return 'Deceased';
  return patient.care_status === 'inactive' ? 'Inactive' : 'Active';
};

const csvValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};

const PatientsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { searchPatients, loading, error } = usePatient();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'grid' or 'table'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [filterBsc, setFilterBsc] = useState(null); // null = all, true = BSC, false = N-BSC
  const [filterOnco, setFilterOnco] = useState(null); // null = all, true = Onco, false = Non-Onco
  const [filterZone, setFilterZone] = useState(''); // '' = all
  const [filterContacted, setFilterContacted] = useState(null); // null = all, true = Contacted, false = Not Contacted
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const perPage = 20;

  useEffect(() => {
    if (searchParams.get('action') === 'add' || searchParams.get('new') === 'true') {
      setShowQuickAdd(true);
    }
  }, [searchParams]);

  const loadPatients = async (query = '', pageNum = 1, bsc = null, zone = '', onco = null, contacted = null, currentSortBy = sortBy, currentSortOrder = sortOrder) => {
    try {
      const data = await searchPatients(query, pageNum, perPage, bsc, zone, onco, contacted, currentSortBy, currentSortOrder);
      setPatients(data.patients || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch (err) {
      console.error('Failed to load patients:', err);
    }
  };

  useEffect(() => {
    loadPatients(searchQuery, page, filterBsc, filterZone, filterOnco, filterContacted, sortBy, sortOrder);
  }, [page, filterBsc, filterZone, filterOnco, filterContacted, sortBy, sortOrder]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadPatients(searchQuery, 1, filterBsc, filterZone, filterOnco, filterContacted, sortBy, sortOrder);
  };

  const handlePageChange = (value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePatientClick = (patient) => {
    navigate(`/patients/${patient.id}`);
  };

  const handleQuickAddSuccess = () => {
    setShowQuickAdd(false);
    loadPatients(searchQuery, page, filterBsc, filterZone, filterOnco, filterContacted, sortBy, sortOrder);
  };

  const handleDownloadCsv = async () => {
    setDownloading(true);
    setDownloadError('');

    try {
      const firstPage = await patientsApi.search('', 1, CSV_PAGE_SIZE);
      const allPatients = [...(firstPage.patients || [])];

      for (let pageNum = 2; pageNum <= (firstPage.total_pages || 1); pageNum += 1) {
        const pageData = await patientsApi.search('', pageNum, CSV_PAGE_SIZE);
        allPatients.push(...(pageData.patients || []));
      }

      if (allPatients.length === 0) {
        setDownloadError('There are no patients to download.');
        return;
      }

      const fieldNames = Array.from(
        allPatients.reduce((fields, patient) => {
          Object.keys(patient).forEach((field) => fields.add(field));
          return fields;
        }, new Set())
      );
      const rows = allPatients.map((patient) => ({
        status: patientStatus(patient),
        ...Object.fromEntries(fieldNames.map((field) => [field, csvValue(patient[field])])),
      }));
      const csv = Papa.unparse(rows, { escapeFormulae: true });
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download patients CSV:', err);
      setDownloadError(err.response?.data?.error || 'Failed to download patients. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Users size={24} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Patients</h1>
          </div>
          <p className="text-muted-foreground">
            Manage and monitor your patient registry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/50">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={cn(
                "h-9 px-3 gap-2 rounded-lg transition-all",
                viewMode === 'grid' && "bg-background shadow-sm border border-border/50 text-primary"
              )}
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Grid</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={cn(
                "h-9 px-3 gap-2 rounded-lg transition-all",
                viewMode === 'table' && "bg-background shadow-sm border border-border/50 text-primary"
              )}
            >
              <ListIcon size={16} />
              <span className="hidden sm:inline">Table</span>
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadCsv}
            disabled={downloading}
            className="gap-2 h-11"
          >
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            <span className="hidden sm:inline">{downloading ? 'Downloading…' : 'Download CSV'}</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button
            onClick={() => setShowQuickAdd(true)}
            className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 h-11"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add New Patient</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      <Separator />

      {/* Search and Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <form onSubmit={handleSearch} className="md:col-span-8 lg:col-span-9 relative group">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" size={18} />
          <Input
            placeholder="Search by name, UHID, phone, ABHA ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-card/50 border-border/50 focus:ring-primary/20 transition-all text-base"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button type="submit" size="sm" disabled={loading} className="h-8">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
            </Button>
          </div>
        </form>

        <div className="md:col-span-4 lg:col-span-3">
          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(val) => {
              const [newSortBy, newSortOrder] = val.split('-');
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
          >
            <SelectTrigger className="w-full h-12 bg-card/50 border-border/50 focus:ring-primary/20 transition-all text-base gap-2 flex items-center justify-start text-muted-foreground">
              <ArrowUpDown size={16} className="shrink-0" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Recently Registered</SelectItem>
              <SelectItem value="created_at-asc">Oldest Registered</SelectItem>
              <SelectItem value="latest_pps_score-asc">PPS Score (Lowest First)</SelectItem>
              <SelectItem value="latest_pps_score-desc">PPS Score (Highest First)</SelectItem>
              <SelectItem value="full_name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="full_name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="date_of_birth-asc">Age (Oldest First)</SelectItem>
              <SelectItem value="date_of_birth-desc">Age (Youngest First)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* BSC + Zone Filter Chips */}
        <div className="md:col-span-12 flex flex-wrap items-center gap-2">
          {/* BSC Filter */}
          <button
            onClick={() => setFilterBsc(filterBsc === null ? true : filterBsc === true ? false : null)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
              filterBsc === true && "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
              filterBsc === false && "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
              filterBsc === null && "bg-card/50 text-muted-foreground border-border/50 hover:bg-muted/50"
            )}
          >
            {filterBsc === null ? 'All Patients' : filterBsc ? 'BSC Only' : 'N-BSC Only'}
          </button>

          {/* Onco Filter */}
          <button
            onClick={() => setFilterOnco(filterOnco === null ? true : filterOnco === true ? false : null)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
              filterOnco === true && "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700",
              filterOnco === false && "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600",
              filterOnco === null && "bg-card/50 text-muted-foreground border-border/50 hover:bg-muted/50"
            )}
          >
            {filterOnco === null ? 'All Types' : filterOnco ? 'Onco Only' : 'Non-Onco Only'}
          </button>

          {/* Contact Status Filter */}
          <button
            onClick={() => setFilterContacted(filterContacted === null ? false : filterContacted === false ? true : null)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
              filterContacted === true && "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
              filterContacted === false && "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
              filterContacted === null && "bg-card/50 text-muted-foreground border-border/50 hover:bg-muted/50"
            )}
          >
            {filterContacted === null ? 'All Contact Status' : filterContacted ? 'Contacted' : 'Not Contacted'}
          </button>

          {/* Zone Filters */}
          {ZONE_OPTIONS.map(zone => (
            <button
              key={zone}
              onClick={() => setFilterZone(filterZone === zone ? '' : zone)}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                filterZone === zone
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                  : "bg-card/50 text-muted-foreground border-border/50 hover:bg-muted/50"
              )}
            >
              <MapPin size={12} />
              {zone}
            </button>
          ))}

          {/* Clear filters */}
          {(filterBsc !== null || filterOnco !== null || filterZone || filterContacted !== null) && (
            <button
              onClick={() => { setFilterBsc(null); setFilterOnco(null); setFilterZone(''); setFilterContacted(null); }}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results and Content */}
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 animate-slide-up">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {downloadError && (
          <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 animate-slide-up">
            <AlertDescription>{downloadError}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-medium text-muted-foreground">
            {loading ? 'Updating results...' : (
              <span>Found <span className="text-foreground font-bold">{total}</span> patient{total !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>

        {loading && patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 size={48} className="text-primary animate-spin" />
            <p className="text-muted-foreground animate-pulse font-medium">Fetching patient records...</p>
          </div>
        ) : patients.length > 0 ? (
          <div className="space-y-8">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {patients.map((patient) => (
                  <div key={patient.id} className="animate-slide-up">
                    <PatientCard
                      patient={patient}
                      variant="detailed"
                      onClick={() => handlePatientClick(patient)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden animate-slide-up shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30 pl-6">Patient Name</TableHead>
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30">Gender</TableHead>
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30">Age</TableHead>
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30">Contact</TableHead>
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30">Location</TableHead>
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30">Status</TableHead>
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30">Last Activity</TableHead>
                      <TableHead className="py-4 font-semibold text-foreground bg-muted/30 text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((patient) => (
                      <TableRow
                        key={patient.id}
                        className="group hover:bg-primary/5 cursor-pointer transition-colors"
                        onClick={() => handlePatientClick(patient)}
                      >
                        <TableCell className="py-5 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                              <Users size={18} />
                            </div>
                            <div>
                              <div className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                                {patient.full_name}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono font-medium">
                                {patient.uhid || '—'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">
                            {patient.gender || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {patient.age || calculateAge(patient.date_of_birth) ? `${patient.age || calculateAge(patient.date_of_birth)} yrs` : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <Phone size={14} className="text-muted-foreground" />
                            {patient.contact || 'No phone'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic font-medium">
                            <MapPin size={12} />
                            {patient.city || (patient.latitude ? `${patient.latitude.toFixed(4)}, ${patient.longitude.toFixed(4)}` : (patient.address ? patient.address.split(',')[0] : 'No location'))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {patient.bsc_status == null && patient.is_onco == null ? (
                              <Badge variant="outline" className="text-[10px] font-bold border-dashed text-muted-foreground">
                                Not Determined
                              </Badge>
                            ) : (
                              <>
                                <Badge variant={patient.bsc_status ? 'default' : 'secondary'}
                                  className={cn(
                                    "text-[10px] font-bold",
                                    patient.bsc_status
                                      ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700"
                                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                                  )}>
                                  {patient.bsc_status ? 'BSC' : 'N-BSC'}
                                </Badge>
                                {patient.is_onco !== null && patient.is_onco !== undefined && (
                                  <Badge variant="secondary"
                                    className={cn(
                                      "text-[10px] font-bold",
                                      patient.is_onco === true
                                        ? "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700"
                                        : "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700"
                                    )}>
                                    {patient.is_onco === true ? 'Onco' : 'Non-Onco'}
                                  </Badge>
                                )}
                              </>
                            )}
                            {patient.geographic_cluster && (
                              <Badge variant="outline" className="text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                {patient.geographic_cluster}
                              </Badge>
                            )}
                            {patient.is_contacted === false && (
                              <Badge className="text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/60">
                                Not Contacted
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 rounded-lg bg-secondary/30 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <ClipboardList size={14} className="text-muted-foreground group-hover:text-primary" />
                            </div>
                            <div>
                              <span className="font-bold text-foreground">
                                {patient.submission_count || 0}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">subs</span>
                              {patient.last_submission && (
                                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                  {new Date(patient.last_submission).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" className="group/btn hover:bg-primary group-hover:scale-110 transition-all rounded-full">
                            <Eye size={18} className="text-muted-foreground group-hover/btn:text-white" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="rounded-full h-10 w-10 border-border/50 hover:bg-primary hover:text-white transition-all shadow-sm"
                >
                  <ChevronLeft size={20} />
                </Button>

                <div className="flex items-center gap-1.5 px-6 py-2 bg-card/10 backdrop-blur-sm border border-border/10 rounded-full text-sm font-bold shadow-sm">
                  <span className="text-primary">{page}</span>
                  <span className="text-muted-foreground/30 font-light">|</span>
                  <span className="text-muted-foreground">{totalPages}</span>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="rounded-full h-10 w-10 border-border/50 hover:bg-primary hover:text-white transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 bg-card/30 rounded-[2.5rem] border border-dashed border-border/50 animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground/20">
              <Users size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-bold text-foreground tracking-tight">
                {searchQuery ? 'No Results Found' : 'Your Patient Registry is Empty'}
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-lg leading-relaxed">
                {searchQuery
                  ? "We couldn't find any patients matching your search. Try using a different name or phone number."
                  : "Every journey begins with a single step. Start by adding your first patient record."}
              </p>
            </div>
            {!searchQuery && (
              <Button
                variant="default"
                onClick={() => setShowQuickAdd(true)}
                className="gap-2 h-12 px-8 rounded-2xl shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95"
              >
                <UserPlus size={18} />
                <span className="text-lg">Register First Patient</span>
              </Button>
            )}
            {searchQuery && (
              <Button
                variant="ghost"
                onClick={() => { setSearchQuery(''); loadPatients('', 1); }}
                className="hover:bg-primary/5"
              >
                Clear Search Results
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Add Dialog */}
      <PatientQuickAdd
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  );
};

export default PatientsList;
