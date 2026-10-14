import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useServiceBooking } from '../ServiceBookingContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import servicesApi from '@/api/services';
import {
  CheckCircle,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Building,
  Stethoscope,
  HeartHandshake,
  Home,
  AlertCircle,
  Loader2,
  Download,
  Share2,
  Printer
} from 'lucide-react';

const ConfirmationStep = () => {
  const navigate = useNavigate();
  const { bookingData, updateBookingData } = useServiceBooking();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(
    bookingData.booking.status === 'confirmed'
  );

  const handleViewBookings = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('View My Bookings button clicked');
    console.log('Navigating to /appointments...');
    try {
      navigate('/appointments');
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to window.location
      window.location.href = '/appointments';
    }
  };

  const handleBookAnother = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Book Another Service button clicked');
    console.log('Navigating to /services/book...');
    try {
      navigate('/services/book');
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to window.location
      window.location.href = '/services/book';
    }
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    setError('');

    // Debug logging
    console.log('Booking data at confirmation:', bookingData);
    console.log('Service:', bookingData.service);
    console.log('Provider:', bookingData.provider);
    console.log('Patient:', bookingData.patient);

    // Validate required data
    if (!bookingData.patient) {
      setError('Patient information is missing. Please go back and select a patient.');
      setLoading(false);
      return;
    }

    if (!bookingData.service) {
      setError('Service information is missing. Please go back and select a service.');
      setLoading(false);
      return;
    }

    if (!bookingData.provider) {
      setError('Provider information is missing. Please go back and select a provider.');
      setLoading(false);
      return;
    }

    try {
      // Combine date and time into ISO format
      let startTime = null;
      if (bookingData.schedule?.date && bookingData.schedule?.timeSlot) {
        const timeSlot = bookingData.schedule.timeSlot.includes(':')
          ? bookingData.schedule.timeSlot
          : bookingData.schedule.timeSlot + ':00';
        startTime = `${bookingData.schedule.date}T${timeSlot}:00`;
      }

      const bookingPayload = {
        patient_id: bookingData.patient?.patient_id || bookingData.patient?.id,
        provider_id: bookingData.provider?.id,
        start_time: startTime,  // Combined ISO datetime
        appointment_type: 'consultation',
        duration: bookingData.schedule?.duration || bookingData.service?.duration || 30,
        chief_complaint: bookingData.details?.chiefComplaint,
        notes: bookingData.details?.notes,
        metadata: {
          service_type: bookingData.serviceType,
          service_name: bookingData.service?.name,
          contact_number: bookingData.details?.contactNumber,
          home_address: bookingData.details?.homeAddress,
          insurance_info: bookingData.details?.insuranceInfo,
          special_requirements: bookingData.details?.specialRequirements,
          emergency_contact: bookingData.details?.emergencyContact,
          emergency_contact_number: bookingData.details?.emergencyContactNumber
        }
      };

      const response = await servicesApi.book(
        bookingData.service?.id,
        bookingPayload
      );

      if (response) {
        const confirmationNumber = `BK${Date.now().toString().slice(-8)}`;
        updateBookingData('booking.status', 'confirmed');
        updateBookingData('booking.confirmationNumber', confirmationNumber);
        updateBookingData('booking.bookingId', response.appointment?.id);
        setBookingConfirmed(true);
      }
    } catch (error) {
      console.error('Booking error:', error);
      // Backend returns errors as { error: "message" }
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to confirm booking. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
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

  const getServiceIcon = () => {
    switch (bookingData.serviceType) {
      case 'IPD':
        return <Building className="h-5 w-5" />;
      case 'OPD':
        return <Stethoscope className="h-5 w-5" />;
      case 'PHYSIOTHERAPY':
        return <HeartHandshake className="h-5 w-5" />;
      case 'HOME_CARE':
        return <Home className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getServiceTypeLabel = () => {
    switch (bookingData.serviceType) {
      case 'IPD':
        return 'In-Patient Department';
      case 'OPD':
        return 'Out-Patient Department';
      case 'PHYSIOTHERAPY':
        return 'Physiotherapy';
      case 'HOME_CARE':
        return 'Home Care';
      default:
        return bookingData.serviceType;
    }
  };

  const handleDownloadSummary = () => {
    // Create a text summary
    const summary = `
SERVICE BOOKING CONFIRMATION
=============================
Confirmation Number: ${bookingData.booking.confirmationNumber}

PATIENT INFORMATION
Name: ${bookingData.patient?.full_name || 'Not provided'}
Phone: ${bookingData.details?.contactNumber || 'Not provided'}

SERVICE DETAILS
Type: ${getServiceTypeLabel()}
Service: ${bookingData.service?.name || 'Not selected'}
Provider: ${bookingData.provider?.full_name || 'Not selected'}
Date: ${bookingData.schedule?.date ? format(new Date(bookingData.schedule.date), 'EEEE, MMMM d, yyyy') : 'Not selected'}
Time: ${formatTime(bookingData.schedule?.timeSlot) || 'Not selected'}
Duration: ${bookingData.schedule?.duration || 30} minutes

CHIEF COMPLAINT
${bookingData.details?.chiefComplaint || 'Not provided'}

${bookingData.serviceType === 'HOME_CARE' && bookingData.details?.homeAddress ? `HOME ADDRESS\n${bookingData.details.homeAddress}\n` : ''}

=============================
Please arrive 15 minutes early for your appointment.
Bring any relevant medical records and insurance cards.
    `;

    // Create a blob and download
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${bookingData.booking.confirmationNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (bookingConfirmed) {
    return (
      <div className="space-y-6">
        {/* Success Message */}
        <Card className="bg-success-50 dark:bg-success-950 border-success-200 dark:border-success-800">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-16 w-16 text-success-600 dark:text-success-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-success-900 dark:text-success-100 mb-2">
              Booking Confirmed!
            </h2>
            <p className="text-success-700 dark:text-success-300 mb-4">
              Your service booking has been successfully confirmed.
            </p>
            <div className="bg-card rounded-lg px-4 py-2 inline-block">
              <p className="text-sm text-muted-foreground">Confirmation Number</p>
              <p className="text-xl font-mono font-bold text-foreground">
                {bookingData.booking.confirmationNumber}
              </p>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <Button
                size="lg"
                type="button"
                onClick={handleViewBookings}
                onMouseDown={(e) => e.preventDefault()}
                className="cursor-pointer hover:opacity-90 transition-opacity"
              >
                View My Bookings
              </Button>
              <Button
                variant="outline"
                size="lg"
                type="button"
                onClick={handleBookAnother}
                onMouseDown={(e) => e.preventDefault()}
                className="cursor-pointer hover:opacity-90 transition-opacity"
              >
                Book Another Service
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Booking Summary */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>

            <div className="space-y-4">
              {/* Patient Info */}
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">{bookingData.patient?.full_name || 'Not selected'}</p>
                </div>
              </div>

              {/* Service Info */}
              <div className="flex items-start space-x-3">
                {getServiceIcon()}
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium">{bookingData.service?.name || 'Not selected'}</p>
                  <Badge variant="secondary" className="mt-1">
                    {getServiceTypeLabel()}
                  </Badge>
                </div>
              </div>

              {/* Provider Info */}
              <div className="flex items-start space-x-3">
                <Stethoscope className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{bookingData.provider?.full_name || 'Not selected'}</p>
                  {bookingData.provider?.specialization && (
                    <p className="text-sm text-muted-foreground">
                      {bookingData.provider?.specialization}
                    </p>
                  )}
                </div>
              </div>

              {/* Schedule Info */}
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {bookingData.schedule?.date ? format(new Date(bookingData.schedule.date), 'EEEE, MMMM d, yyyy') : 'Not selected'}
                  </p>
                  <p className="text-sm">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {bookingData.schedule?.timeSlot ? formatTime(bookingData.schedule.timeSlot) : 'Not selected'}
                    {bookingData.schedule?.duration && (
                      <span className="text-muted-foreground">
                        {' '}({bookingData.schedule.duration} minutes)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{bookingData.details?.contactNumber || 'Not provided'}</p>
                </div>
              </div>

              {/* Home Address for Home Care */}
              {bookingData.serviceType === 'HOME_CARE' && bookingData.details?.homeAddress && (
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Service Address</p>
                    <p className="font-medium">{bookingData.details?.homeAddress || 'Not provided'}</p>
                  </div>
                </div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handleDownloadSummary} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Summary
          </Button>
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Important Notes */}
        <Card className="bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800">
          <CardContent className="p-4">
            <h4 className="font-semibold text-primary-900 dark:text-primary-100 mb-2 flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Important Information
            </h4>
            <ul className="text-sm text-primary-800 dark:text-primary-200 space-y-1">
              <li>• Please arrive 15 minutes before your scheduled time</li>
              <li>• Bring any relevant medical records and reports</li>
              <li>• Carry your insurance card if applicable</li>
              <li>• For cancellations, please call at least 2 hours in advance</li>
              {bookingData.serviceType === 'IPD' && (
                <li>• Admission process will begin at the scheduled time</li>
              )}
              {bookingData.serviceType === 'HOME_CARE' && (
                <li>• Ensure someone is available at the service address</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Review Your Booking</h3>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-700 dark:text-danger-300">
              <AlertCircle className="inline h-4 w-4 mr-2" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Patient Info */}
            <div className="pb-4 border-b border-border">
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">{bookingData.patient?.full_name}</p>
                </div>
              </div>
            </div>

            {/* Service Info */}
            <div className="pb-4 border-b border-border">
              <div className="flex items-start space-x-3">
                {getServiceIcon()}
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium">{bookingData.service?.name}</p>
                  <Badge variant="secondary" className="mt-1">
                    {getServiceTypeLabel()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Provider Info */}
            <div className="pb-4 border-b border-border">
              <div className="flex items-start space-x-3">
                <Stethoscope className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{bookingData.provider?.full_name}</p>
                  {bookingData.provider?.specialization && (
                    <p className="text-sm text-muted-foreground">
                      {bookingData.provider?.specialization}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule Info */}
            <div className="pb-4 border-b border-border">
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">
                    {bookingData.schedule?.date ? format(new Date(bookingData.schedule.date), 'EEEE, MMMM d, yyyy') : 'Not selected'}
                  </p>
                  <p className="text-sm">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {bookingData.schedule?.timeSlot ? formatTime(bookingData.schedule.timeSlot) : 'Not selected'}
                    {bookingData.schedule?.duration && (
                      <span className="text-muted-foreground">
                        {' '}({bookingData.schedule.duration} minutes)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Chief Complaint */}
            <div className="pb-4 border-b border-border">
              <div className="flex items-start space-x-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Chief Complaint</p>
                  <p className="font-medium">{bookingData.details?.chiefComplaint || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="pb-4 border-b border-border">
              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{bookingData.details?.contactNumber || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Home Address for Home Care */}
            {bookingData.serviceType === 'HOME_CARE' && bookingData.details.homeAddress && (
              <div className="pb-4 border-b border-border">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Service Address</p>
                    <p className="font-medium">{bookingData.details?.homeAddress || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Confirm Button */}
          <div className="mt-6">
            <Button
              onClick={handleConfirmBooking}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming Booking...
                </>
              ) : (
                'Confirm Booking'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terms */}
      <Card className="bg-accent">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            By confirming this booking, you agree to our terms and conditions.
            Cancellations must be made at least 2 hours before the scheduled time.
            For IPD admissions, please bring all necessary documents and arrive
            at least 30 minutes early for the admission process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmationStep;