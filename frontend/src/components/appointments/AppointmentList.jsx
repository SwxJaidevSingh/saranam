/**
 * AppointmentList Component
 * Displays a list of appointments with filtering and sorting
 */
import React, { useState, useEffect } from 'react';
import AppointmentCard from './AppointmentCard';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Alert } from '../ui/alert';
import { Search, Filter, Calendar, RefreshCw } from 'lucide-react';
import appointmentsApi from '../../api/appointments';
import moment from 'moment';

const AppointmentList = ({
  onSelectAppointment,
  patientId = null,
  providerId = null,
  defaultStatus = null,
  defaultView = 'upcoming',
  showFilters = true,
  limit = 50,
}) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(defaultStatus || 'all');
  const [viewFilter, setViewFilter] = useState(defaultView);
  const [dateFilter, setDateFilter] = useState('');

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit,
        patient_id: patientId,
        provider_id: providerId,
      };

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }

      // Apply view filter (upcoming, today, past)
      const today = moment().startOf('day');
      switch (viewFilter) {
        case 'today':
          params.from_date = today.toISOString();
          params.to_date = today.endOf('day').toISOString();
          break;
        case 'upcoming':
          params.from_date = moment().toISOString();
          params.to_date = moment().add(30, 'days').toISOString();
          break;
        case 'past':
          params.to_date = moment().toISOString();
          params.from_date = moment().subtract(30, 'days').toISOString();
          break;
        case 'all':
          // No date filter
          break;
      }

      // Apply custom date filter
      if (dateFilter) {
        const selectedDate = moment(dateFilter);
        params.from_date = selectedDate.startOf('day').toISOString();
        params.to_date = selectedDate.endOf('day').toISOString();
      }

      const response = await appointmentsApi.list(params);
      let fetchedAppointments = response.appointments || [];

      // Apply search filter (client-side)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        fetchedAppointments = fetchedAppointments.filter(apt =>
          apt.patient_name?.toLowerCase().includes(query) ||
          apt.provider_name?.toLowerCase().includes(query) ||
          apt.chief_complaint?.toLowerCase().includes(query) ||
          apt.appointment_type?.toLowerCase().includes(query)
        );
      }

      // Sort by date (upcoming: ascending, past: descending)
      fetchedAppointments.sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        return viewFilter === 'past' ? dateB - dateA : dateA - dateB;
      });

      setAppointments(fetchedAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchAppointments();
  }, [statusFilter, viewFilter, dateFilter, patientId, providerId]);

  // Debounce search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (appointments.length > 0) {
        fetchAppointments();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleRefresh = () => {
    fetchAppointments();
  };

  const handleSelectAppointment = (appointment) => {
    if (onSelectAppointment) {
      onSelectAppointment(appointment);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="search">
                <Search className="h-4 w-4 inline mr-2" />
                Search
              </Label>
              <Input
                id="search"
                type="text"
                placeholder="Search by patient, provider, or complaint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View Filter */}
            <div className="space-y-2">
              <Label htmlFor="view">
                <Calendar className="h-4 w-4 inline mr-2" />
                View
              </Label>
              <Select value={viewFilter} onValueChange={setViewFilter}>
                <SelectTrigger id="view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="upcoming">Upcoming (30 days)</SelectItem>
                  <SelectItem value="past">Past (30 days)</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">
                <Filter className="h-4 w-4 inline mr-2" />
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Filter and Refresh */}
          <div className="flex items-end gap-4 mt-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="date">Specific Date (Optional)</Label>
              <Input
                id="date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && appointments.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading appointments...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && appointments.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No appointments found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'No appointments match your search criteria.'
                : 'There are no appointments for the selected filters.'}
            </p>
          </div>
        </Card>
      )}

      {/* Appointments List */}
      {!loading && appointments.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-3">
            {appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onClick={handleSelectAppointment}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AppointmentList;
