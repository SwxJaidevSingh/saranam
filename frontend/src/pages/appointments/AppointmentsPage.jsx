/**
 * Appointments Page - Main appointment management interface
 * Displays calendar, upcoming appointments, and quick actions
 */
import React, { useState, useEffect } from 'react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import AppointmentBookingForm from '../../components/appointments/AppointmentBookingForm';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal';
import BulkAppointmentFlow from '../../components/bulk-appointments/BulkAppointmentFlow';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Users, Plus, Building, Stethoscope, Filter, FileSpreadsheet } from 'lucide-react';
import appointmentsApi from '../../api/appointments';
import servicesApi from '../../api/services';
import moment from 'moment';
import { getServiceBadgeClass, getServiceTypeName } from '../../utils/serviceColors';

const AppointmentsPage = () => {
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter states
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState(null);

  // Service bookings state
  const [serviceBookings, setServiceBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Real stats data
  const [stats, setStats] = useState({
    today: 0,
    upcoming: 0,
    checkedIn: 0,
    thisWeek: 0,
    serviceBookings: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch service bookings
  useEffect(() => {
    const fetchServiceBookings = async () => {
      try {
        setLoadingBookings(true);
        const response = await servicesApi.getUserBookings({ limit: 50 });
        setServiceBookings(response.bookings || []);
      } catch (error) {
        console.warn('Service bookings not available:', error.message);
        setServiceBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchServiceBookings();
  }, [refreshKey]);

  // Fetch real stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);

        // Fetch today's appointments
        const todayStart = moment().startOf('day').toISOString();
        const todayEnd = moment().endOf('day').toISOString();
        const todayResponse = await appointmentsApi.list({
          from_date: todayStart,
          to_date: todayEnd,
        });

        // Fetch upcoming appointments (next 30 days)
        const upcomingResponse = await appointmentsApi.list({
          from_date: moment().toISOString(),
          to_date: moment().add(30, 'days').toISOString(),
        });

        // Fetch checked in appointments (today)
        const checkedInResponse = await appointmentsApi.list({
          from_date: todayStart,
          to_date: todayEnd,
          status: 'checked_in',
        });

        // Fetch this week's appointments
        const weekStart = moment().startOf('week').toISOString();
        const weekEnd = moment().endOf('week').toISOString();
        const weekResponse = await appointmentsApi.list({
          from_date: weekStart,
          to_date: weekEnd,
        });

        // Fetch service bookings count (optional - may not be available yet)
        let serviceBookingsCount = 0;
        try {
          const bookingsResponse = await servicesApi.getUserBookings({
            status: 'scheduled',
            limit: 100
          });
          serviceBookingsCount = bookingsResponse.total || 0;
        } catch (bookingsError) {
          console.warn('Service bookings not available:', bookingsError.message);
        }

        setStats({
          today: todayResponse.appointments?.length || 0,
          upcoming: upcomingResponse.appointments?.length || 0,
          checkedIn: checkedInResponse.appointments?.length || 0,
          thisWeek: weekResponse.appointments?.length || 0,
          serviceBookings: serviceBookingsCount,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [refreshKey]);

  // Handle when user clicks on an existing appointment
  const handleSelectAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  // Handle when user clicks on an empty time slot
  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
    setShowBookingModal(true);
    console.log('Selected slot:', slot);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground mt-1">Manage patient appointments and schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowBookingModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Book Appointment
          </Button>
          <Button
            onClick={() => setShowBulkModal(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Appointment
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today's Appointments</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loadingStats ? '...' : stats.today}
              </p>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loadingStats ? '...' : stats.upcoming}
              </p>
            </div>
            <div className="bg-green-500/10 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Checked In</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loadingStats ? '...' : stats.checkedIn}
              </p>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-lg">
              <Users className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {loadingStats ? '...' : stats.thisWeek}
              </p>
            </div>
            <div className="bg-purple-500/10 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Appointment Management System</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Click on an empty time slot to book a new appointment, or click on an existing appointment to view details, check-in, or reschedule.
            </p>
          </div>
        </div>
      </Alert>

      {/* Calendar Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filter Calendar:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Event Type:</label>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="appointments">Appointments Only</SelectItem>
                <SelectItem value="services">Service Bookings Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(eventTypeFilter === 'all' || eventTypeFilter === 'services') && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Service Type:</label>
              <Select value={serviceTypeFilter || 'all'} onValueChange={(val) => setServiceTypeFilter(val === 'all' ? null : val)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="IPD">{getServiceTypeName('IPD')}</SelectItem>
                  <SelectItem value="OPD">{getServiceTypeName('OPD')}</SelectItem>
                  <SelectItem value="PHYSIOTHERAPY">{getServiceTypeName('PHYSIOTHERAPY')}</SelectItem>
                  <SelectItem value="HOME_CARE">{getServiceTypeName('HOME_CARE')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(eventTypeFilter !== 'all' || serviceTypeFilter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEventTypeFilter('all');
                setServiceTypeFilter(null);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Main Calendar */}
      <AppointmentCalendar
        key={`${refreshKey}-${eventTypeFilter}-${serviceTypeFilter}`}
        onSelectEvent={handleSelectAppointment}
        onSelectSlot={handleSelectSlot}
        enableDragDrop={false}
        defaultView="week"
        eventTypeFilter={eventTypeFilter}
        serviceTypeFilter={serviceTypeFilter}
      />
{/* 
      {/* Service Bookings Section 
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">My Service Bookings</h2>
          <p className="text-sm text-gray-600 mt-1">View and manage your service appointments</p>
        </div>

        {loadingBookings ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading bookings...</div>
          </div>
        ) : serviceBookings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No service bookings found.
          </div>
        ) : (
          <div className="space-y-4">
            {serviceBookings.map(booking => (
              <div key={booking.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {booking.service?.name || 'Service Booking'}
                      </h3>
                      <Badge
                        className={`capitalize ${
                          booking.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {booking.status}
                      </Badge>
                      {booking.service?.type && (
                        <Badge className="bg-purple-100 text-purple-700">
                          {booking.service.type}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {booking.provider && (
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Provider:</span>
                          <span className="text-gray-900 font-medium">
                            {booking.provider.name}
                            {booking.provider.specialization && (
                              <span className="text-gray-500 text-xs ml-1">
                                ({booking.provider.specialization})
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {booking.start_time && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Date:</span>
                          <span className="text-gray-900 font-medium">
                            {moment(booking.start_time).format('MMM D, YYYY')}
                          </span>
                        </div>
                      )}

                      {booking.start_time && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Time:</span>
                          <span className="text-gray-900 font-medium">
                            {moment(booking.start_time).format('h:mm A')}
                            {booking.end_time && (
                              <span> - {moment(booking.end_time).format('h:mm A')}</span>
                            )}
                          </span>
                        </div>
                      )}

                      {booking.patient && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Patient:</span>
                          <span className="text-gray-900 font-medium">
                            {booking.patient.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {booking.confirmation_number && (
                      <div className="mt-3 text-sm">
                        <span className="text-gray-600">Confirmation #:</span>
                        <span className="text-gray-900 font-mono ml-2">
                          {booking.confirmation_number}
                        </span>
                      </div>
                    )}

                    {booking.chief_complaint && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Reason:</span> {booking.chief_complaint}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAppointment(booking);
                        setShowDetailsModal(true);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card> */}

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onUpdate={() => {
          // Refresh the calendar
          setRefreshKey(prev => prev + 1);
        }}
      />

      {/* Appointment Booking Form */}
      <AppointmentBookingForm
        open={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedSlot(null);
        }}
        onSuccess={(appointment) => {
          console.log('Appointment booked:', appointment);
          // Refresh the calendar to show the new appointment
          setRefreshKey(prev => prev + 1);
          setShowBookingModal(false);
          setSelectedSlot(null);
        }}
        preselectedSlot={selectedSlot}
      />

      {/* Bulk Appointment Flow */}
      {showBulkModal && (
        <BulkAppointmentFlow
          onClose={() => setShowBulkModal(false)}
          onComplete={(results) => {
            console.log('Bulk appointment results:', results);
            setShowBulkModal(false);
            // Refresh the calendar to show new appointments
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
};

export default AppointmentsPage;
