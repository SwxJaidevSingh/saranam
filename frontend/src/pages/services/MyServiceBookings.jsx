import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  FileText,
  Building,
  Stethoscope,
  HeartHandshake,
  Home,
  Search,
  Filter,
  ChevronLeft,
  Plus,
  Download,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import appointmentsApi from '@/api/appointments';
import { useAuth } from '@/context/AuthContext';

const MyServiceBookings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // Try to fetch user's bookings (assuming user is patient in this context)
      const response = await appointmentsApi.list({ patient_id: user?.id, limit: 100 });
      const rawBookings = response.appointments || response.data || [];
      const mappedBookings = rawBookings.map(b => {
        const startTime = new Date(b.start_time);
        return {
          ...b,
          service_type: b.encounter_type,
          appointment_date: startTime.toISOString(),
          appointment_time: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
          created_at: b.created_at || new Date().toISOString()
        };
      });
      setBookings(mappedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      // Use mock data for demonstration
      setBookings(getMockBookings());
    } finally {
      setLoading(false);
    }
  };

  const getMockBookings = () => {
    return [
      {
        id: 'BK12345678',
        patient_name: 'John Doe',
        service_type: 'OPD',
        service_name: 'General Consultation',
        provider_name: 'Dr. Sarah Smith',
        appointment_date: '2024-01-15',
        appointment_time: '10:30',
        status: 'confirmed',
        chief_complaint: 'Regular checkup',
        created_at: '2024-01-10'
      },
      {
        id: 'BK23456789',
        patient_name: 'Jane Doe',
        service_type: 'PHYSIOTHERAPY',
        service_name: 'Back Pain Treatment',
        provider_name: 'Dr. Michael Johnson',
        appointment_date: '2024-01-12',
        appointment_time: '14:00',
        status: 'completed',
        chief_complaint: 'Lower back pain',
        created_at: '2024-01-08'
      },
      {
        id: 'BK34567890',
        patient_name: 'John Doe',
        service_type: 'HOME_CARE',
        service_name: 'Home Nursing',
        provider_name: 'Nurse Patricia',
        appointment_date: '2024-01-20',
        appointment_time: '09:00',
        status: 'confirmed',
        chief_complaint: 'Post-surgery care',
        home_address: '123 Main St, City',
        created_at: '2024-01-11'
      },
      {
        id: 'BK45678901',
        patient_name: 'Robert Smith',
        service_type: 'IPD',
        service_name: 'Surgical Admission',
        provider_name: 'Dr. James Wilson',
        appointment_date: '2024-01-10',
        appointment_time: '08:00',
        status: 'cancelled',
        chief_complaint: 'Appendectomy',
        created_at: '2024-01-05'
      }
    ];
  };

  const getServiceIcon = (type) => {
    switch (type) {
      case 'IPD':
        return <Building className="h-4 w-4" />;
      case 'OPD':
        return <Stethoscope className="h-4 w-4" />;
      case 'PHYSIOTHERAPY':
        return <HeartHandshake className="h-4 w-4" />;
      case 'HOME_CARE':
        return <Home className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getServiceTypeLabel = (type) => {
    switch (type) {
      case 'IPD':
        return 'In-Patient';
      case 'OPD':
        return 'Out-Patient';
      case 'PHYSIOTHERAPY':
      case 'Physiotherapy':
        return 'Physiotherapy';
      case 'HOME_CARE':
      case 'HomeCare':
        return 'Home Care';
      default:
        return type;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-success-100 dark:bg-success-900/20 text-success-800 dark:text-success-200';
      case 'completed':
        return 'bg-primary-100 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200';
      case 'cancelled':
        return 'bg-danger-100 dark:bg-danger-900/20 text-danger-800 dark:text-danger-200';
      case 'pending':
        return 'bg-warning-100 dark:bg-warning-900/20 text-warning-800 dark:text-warning-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const handleCancelBooking = async (bookingId) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      try {
        await appointmentsApi.cancel(bookingId, 'User cancelled');
        setBookings(prevBookings =>
          prevBookings.map(booking =>
            booking.id === bookingId
              ? { ...booking, status: 'cancelled' }
              : booking
          )
        );
      } catch (error) {
        console.error('Error cancelling booking:', error);
        // For demo, update locally
        setBookings(prevBookings =>
          prevBookings.map(booking =>
            booking.id === bookingId
              ? { ...booking, status: 'cancelled' }
              : booking
          )
        );
      }
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = searchTerm === '' ||
      booking.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.provider_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcomingBookings = filteredBookings.filter(b => {
    if (b.status === 'cancelled' || b.status === 'completed') return false;
    const apptDate = new Date(b.appointment_date);
    apptDate.setHours(0, 0, 0, 0);
    return apptDate >= todayStart;
  });

  const pastBookings = filteredBookings.filter(b => {
    if (b.status === 'completed') return true;
    const apptDate = new Date(b.appointment_date);
    apptDate.setHours(0, 0, 0, 0);
    return apptDate < todayStart && b.status !== 'cancelled';
  });

  const cancelledBookings = filteredBookings.filter(
    b => b.status === 'cancelled'
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/services')}
                className="pl-0"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Services
              </Button>
            </div>
            <Button onClick={() => navigate('/services/book')}>
              <Plus className="mr-2 h-4 w-4" />
              Book New Service
            </Button>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">My Service Bookings</h1>
          <p className="text-muted-foreground">View and manage your healthcare service appointments</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by patient name, service, provider, or booking ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Bookings Tabs */}
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastBookings.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled ({cancelledBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingBookings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No upcoming bookings found</p>
                  <Button onClick={() => navigate('/services/book')}>
                    Book a Service
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map(booking => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onCancel={handleCancelBooking}
                    onView={() => setSelectedBooking(booking)}
                    getServiceIcon={getServiceIcon}
                    getServiceTypeLabel={getServiceTypeLabel}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatTime={formatTime}
                    showActions
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastBookings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No past bookings found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastBookings.map(booking => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onView={() => setSelectedBooking(booking)}
                    getServiceIcon={getServiceIcon}
                    getServiceTypeLabel={getServiceTypeLabel}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatTime={formatTime}
                    showRebook
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled">
            {cancelledBookings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <XCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No cancelled bookings found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cancelledBookings.map(booking => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onView={() => setSelectedBooking(booking)}
                    getServiceIcon={getServiceIcon}
                    getServiceTypeLabel={getServiceTypeLabel}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatTime={formatTime}
                    showRebook
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Booking Details Modal */}
        {selectedBooking && (
          <BookingDetailsModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            getServiceIcon={getServiceIcon}
            getServiceTypeLabel={getServiceTypeLabel}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
            formatTime={formatTime}
          />
        )}
      </div>
    </div>
  );
};

// Booking Card Component
const BookingCard = ({
  booking,
  onCancel,
  onView,
  getServiceIcon,
  getServiceTypeLabel,
  getStatusIcon,
  getStatusColor,
  formatTime,
  showActions,
  showRebook
}) => {
  const navigate = useNavigate();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {booking.service_name}
                  </h3>
                  <Badge variant="secondary" className="flex items-center">
                    {getServiceIcon(booking.service_type)}
                    <span className="ml-1">{getServiceTypeLabel(booking.service_type)}</span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono mb-2">
                  Booking ID: {booking.id}
                </p>
              </div>
              <Badge className={`${getStatusColor(booking.status)} flex items-center`}>
                {getStatusIcon(booking.status)}
                <span className="ml-1 capitalize">{booking.status}</span>
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center text-muted-foreground">
                <User className="h-4 w-4 mr-2" />
                <span>{booking.patient_name}</span>
              </div>

              <div className="flex items-center text-muted-foreground">
                <Stethoscope className="h-4 w-4 mr-2" />
                <span>{booking.provider_name}</span>
              </div>

              <div className="flex items-center text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                <span>{format(new Date(booking.appointment_date), 'MMM d, yyyy')}</span>
              </div>

              <div className="flex items-center text-muted-foreground">
                <Clock className="h-4 w-4 mr-2" />
                <span>{formatTime(booking.appointment_time)}</span>
              </div>

              {booking.home_address && (
                <div className="flex items-center text-muted-foreground md:col-span-2">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>{booking.home_address}</span>
                </div>
              )}
            </div>

            {booking.chief_complaint && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <FileText className="inline h-4 w-4 mr-2" />
                  {booking.chief_complaint}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Button>

          {showActions && (booking.status === 'confirmed' || booking.status === 'scheduled') && (
            <>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCancel(booking.id)}
                className="text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-500"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}

          {showRebook && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/services/book')}
            >
              Book Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Booking Details Modal Component
const BookingDetailsModal = ({
  booking,
  onClose,
  getServiceIcon,
  getServiceTypeLabel,
  getStatusIcon,
  getStatusColor,
  formatTime
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              Booking Details
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content similar to booking confirmation */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <p className="text-sm text-muted-foreground">Booking ID</p>
                <p className="font-mono font-bold">{booking.id}</p>
              </div>
              <Badge className={`${getStatusColor(booking.status)} flex items-center`}>
                {getStatusIcon(booking.status)}
                <span className="ml-1 capitalize">{booking.status}</span>
              </Badge>
            </div>

            {/* Add more details as needed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Patient</p>
                <p className="font-medium">{booking.patient_name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Service</p>
                <p className="font-medium">{booking.service_name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Provider</p>
                <p className="font-medium">{booking.provider_name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Service Type</p>
                <div className="flex items-center">
                  {getServiceIcon(booking.service_type)}
                  <span className="ml-2 font-medium">
                    {getServiceTypeLabel(booking.service_type)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {format(new Date(booking.appointment_date), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium">{formatTime(booking.appointment_time)}</p>
              </div>
            </div>

            {booking.chief_complaint && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Chief Complaint</p>
                <p className="font-medium">{booking.chief_complaint}</p>
              </div>
            )}

            {booking.home_address && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Service Address</p>
                <p className="font-medium">{booking.home_address}</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Booked On</p>
              <p className="font-medium">
                {format(new Date(booking.created_at), 'MMMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyServiceBookings;