/**
 * ProviderDetail Page
 * Displays detailed information about a healthcare provider
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import AppointmentList from '../../components/appointments/AppointmentList';
import AppointmentDetailsModal from '../../components/appointments/AppointmentDetailsModal';
import {
  ArrowLeft,
  Stethoscope,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Award,
  FileText,
  Edit,
  Trash2
} from 'lucide-react';
import providersApi from '../../api/providers';

const ProviderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [schedule, setSchedule] = useState([]);

  // Fetch provider details
  useEffect(() => {
    const fetchProvider = async () => {
      try {
        setLoading(true);
        setError(null);
        const [response, schedResponse] = await Promise.all([
          providersApi.getById(id),
          providersApi.getSchedule(id)
        ]);
        setProvider(response);
        setSchedule(schedResponse.schedules || []);
      } catch (err) {
        console.error('Error fetching provider details:', err);
        setError('Failed to load provider details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProvider();
    }
  }, [id, refreshKey]);

  const handleBack = () => {
    navigate('/providers');
  };

  const handleEdit = () => {
    navigate(`/providers/${id}/edit`);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to deactivate this provider?')) {
      try {
        await providersApi.delete(id);
        navigate('/providers');
      } catch (err) {
        console.error('Error deleting provider:', err);
        alert('Failed to deactivate provider');
      }
    }
  };

  const handleSelectAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading provider details...</p>
        </div>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Providers
        </Button>
        <Alert variant="destructive">{error || 'Provider not found'}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{provider.full_name}</h1>
            <p className="text-muted-foreground mt-1">{provider.specialization}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Deactivate
          </Button>
        </div>
      </div>

      {/* Provider Info Card */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {provider.is_active ? (
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
            )}
            {provider.available_for_teleconsult && (
              <Badge className="bg-blue-100 text-blue-800">Teleconsultation Available</Badge>
            )}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Basic Information
              </h3>

              {/* Department - Commented out for now */}
              {/* {provider.department && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Department
                  </p>
                  <p className="font-medium">{provider.department}</p>
                </div>
              )} */}

              {provider.specialization && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Specialization
                  </p>
                  <p className="font-medium">{provider.specialization}</p>
                </div>
              )}

              {provider.license_number && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    License Number
                  </p>
                  <p className="font-medium">{provider.license_number}</p>
                </div>
              )}

              {provider.hpr_id && (
                <div>
                  <p className="text-sm text-muted-foreground">HPR ID (ABDM)</p>
                  <p className="font-medium">{provider.hpr_id}</p>
                </div>
              )}

              {provider.qualification && (
                <div>
                  <p className="text-sm text-muted-foreground">Qualification</p>
                  <p className="font-medium">{provider.qualification}</p>
                </div>
              )}

              {provider.years_of_experience && (
                <div>
                  <p className="text-sm text-muted-foreground">Experience</p>
                  <p className="font-medium">{provider.years_of_experience} years</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Contact Information</h3>

              {provider.email && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </p>
                  <p className="font-medium">{provider.email}</p>
                </div>
              )}

              {provider.phone && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </p>
                  <p className="font-medium">{provider.phone}</p>
                </div>
              )}

              {provider.clinic_address && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Clinic Address
                  </p>
                  <p className="font-medium">{provider.clinic_address}</p>
                </div>
              )}

              {provider.consultation_fee && (
                <div>
                  <p className="text-sm text-muted-foreground">Consultation Fee</p>
                  <p className="font-medium">₹{provider.consultation_fee}</p>
                </div>
              )}

              {provider.languages_spoken && provider.languages_spoken.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Languages</p>
                  <p className="font-medium">{provider.languages_spoken.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {provider.bio && (
            <div>
              <h3 className="font-semibold text-lg mb-2">About</h3>
              <p className="text-foreground">{provider.bio}</p>
            </div>
          )}

          {/* Stats */}
          {provider.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Total Appointments</p>
                <p className="text-2xl font-bold text-foreground">
                  {provider.stats.total_appointments || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold text-foreground">
                  {provider.stats.upcoming_appointments || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-foreground">
                  {provider.stats.completed_appointments || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold text-foreground">
                  {provider.stats.cancelled_appointments || 0}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs for Appointments and Schedule */}
      <Tabs defaultValue="appointments" className="w-full">
        <TabsList>
          <TabsTrigger value="appointments">
            <Calendar className="h-4 w-4 mr-2" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Clock className="h-4 w-4 mr-2" />
            Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="mt-6">
          <AppointmentList
            providerId={id}
            onSelectAppointment={handleSelectAppointment}
            defaultView="upcoming"
            showFilters={true}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Weekly Schedule</h3>
                <p className="text-sm text-muted-foreground">Normal working hours and availability.</p>
              </div>
              <Button onClick={() => navigate(`/providers/${id}/schedule`)} variant="outline">
                Manage Schedule
              </Button>
            </div>
            
            {schedule.length > 0 ? (
              <div className="grid gap-4">
                {schedule.map((day) => (
                  <div key={day.day_of_week} className="flex justify-between items-center p-4 border rounded-lg bg-secondary">
                    <span className="font-medium text-foreground">{day.day_name}</span>
                    <div className="flex items-center text-muted-foreground space-x-4">
                      <span>{day.start_time.substring(0, 5)} - {day.end_time.substring(0, 5)}</span>
                      <Badge variant="outline">{day.slot_duration} min slots</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-t mt-4">
                <Clock className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-foreground mb-1">No Schedule Defined</h4>
                <p className="text-muted-foreground mb-4">This provider does not have a weekly schedule set yet.</p>
                <Button onClick={() => navigate(`/providers/${id}/schedule`)}>
                  Setup Schedule
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onUpdate={() => {
          setRefreshKey(prev => prev + 1);
        }}
      />
    </div>
  );
};

export default ProviderDetail;
