import React, { useState, useEffect } from 'react';
import { useServiceBooking } from '../ServiceBookingContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Phone,
  MapPin,
  CreditCard,
  AlertCircle,
  Home,
  Building,
  Stethoscope,
  HeartHandshake
} from 'lucide-react';

const DetailsStep = () => {
  const { updateBookingData, bookingData } = useServiceBooking();
  const [details, setDetails] = useState({
    chiefComplaint: bookingData.details.chiefComplaint || '',
    notes: bookingData.details.notes || '',
    homeAddress: bookingData.details.homeAddress || '',
    contactNumber: bookingData.details.contactNumber || bookingData.patient?.phone_number || '',
    insuranceInfo: bookingData.details.insuranceInfo || '',
    specialRequirements: bookingData.details.specialRequirements || '',
    emergencyContact: bookingData.details.emergencyContact || '',
    emergencyContactNumber: bookingData.details.emergencyContactNumber || '',
    hasInsurance: bookingData.details.hasInsurance || false,
    consentGiven: bookingData.details.consentGiven || false
  });

  useEffect(() => {
    // Pre-fill contact number from patient data
    if (bookingData.patient?.phone && !details.contactNumber) {
      setDetails(prev => ({
        ...prev,
        contactNumber: bookingData.patient.phone
      }));
      updateBookingData('details.contactNumber', bookingData.patient.phone);
    }

    // Pre-fill home address for home care from patient data
    if (bookingData.serviceType === 'HOME_CARE' && bookingData.patient && !details.homeAddress) {
      const patient = bookingData.patient;
      const addressParts = [];

      if (patient.address) addressParts.push(patient.address);
      if (patient.city) addressParts.push(patient.city);
      if (patient.state) addressParts.push(patient.state);
      if (patient.pincode) addressParts.push(patient.pincode);

      const address = addressParts.join(', ');

      if (address) {
        setDetails(prev => ({ ...prev, homeAddress: address }));
        updateBookingData('details.homeAddress', address);
      }
    }
  }, [bookingData.patient, bookingData.serviceType]);

  const handleInputChange = (field, value) => {
    setDetails(prev => ({ ...prev, [field]: value }));
    updateBookingData(`details.${field}`, value);
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

  return (
    <div className="space-y-6">
      {/* Service Summary */}
      <Card className="bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              {getServiceIcon()}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-primary-900 dark:text-primary-100">Booking Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm text-primary-700 dark:text-primary-300">
                <div>
                  <span className="font-medium">Service:</span> {bookingData.service?.name}
                </div>
                <div>
                  <span className="font-medium">Provider:</span> {bookingData.provider?.full_name}
                </div>
                <div>
                  <span className="font-medium">Date:</span> {bookingData.schedule.date}
                </div>
                <div>
                  <span className="font-medium">Time:</span> {bookingData.schedule.timeSlot}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chief Complaint */}
      <div>
        <Label htmlFor="chiefComplaint" className="flex items-center mb-2">
          <FileText className="mr-2 h-4 w-4" />
          Chief Complaint / Reason for Visit *
        </Label>
        <Textarea
          id="chiefComplaint"
          value={details.chiefComplaint}
          onChange={(e) => handleInputChange('chiefComplaint', e.target.value)}
          placeholder="Please describe your symptoms or reason for this appointment..."
          rows={4}
          required
          className="w-full"
        />
      </div>

      {/* Contact Number */}
      <div>
        <Label htmlFor="contactNumber" className="flex items-center mb-2">
          <Phone className="mr-2 h-4 w-4" />
          Contact Number *
        </Label>
        <Input
          id="contactNumber"
          type="tel"
          value={details.contactNumber}
          onChange={(e) => handleInputChange('contactNumber', e.target.value)}
          placeholder="+91 99999 99999"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          We'll use this number to confirm your appointment
        </p>
      </div>

      {/* Home Address - Only for Home Care */}
      {bookingData.serviceType === 'HOME_CARE' && (
        <div>
          <Label htmlFor="homeAddress" className="flex items-center mb-2">
            <MapPin className="mr-2 h-4 w-4" />
            Service Address *
          </Label>
          <Textarea
            id="homeAddress"
            value={details.homeAddress}
            onChange={(e) => handleInputChange('homeAddress', e.target.value)}
            placeholder="Please provide the complete address where the service is needed..."
            rows={3}
            required
          />
          <p className="text-sm text-muted-foreground mt-1">
            Ensure the address is complete with landmarks for easy navigation
          </p>
        </div>
      )}

      {/* Special Requirements */}
      <div>
        <Label htmlFor="specialRequirements" className="flex items-center mb-2">
          <AlertCircle className="mr-2 h-4 w-4" />
          Special Requirements / Additional Notes
        </Label>
        <Textarea
          id="specialRequirements"
          value={details.specialRequirements}
          onChange={(e) => handleInputChange('specialRequirements', e.target.value)}
          placeholder="Any allergies, medical conditions, or special needs we should know about..."
          rows={3}
        />
      </div>

      {/* Insurance Information */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasInsurance"
                checked={details.hasInsurance}
                onCheckedChange={(checked) => handleInputChange('hasInsurance', checked)}
              />
              <Label
                htmlFor="hasInsurance"
                className="cursor-pointer font-medium"
              >
                I have health insurance
              </Label>
            </div>

            {details.hasInsurance && (
              <div>
                <Label htmlFor="insuranceInfo" className="flex items-center mb-2">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Insurance Details
                </Label>
                <Input
                  id="insuranceInfo"
                  value={details.insuranceInfo}
                  onChange={(e) => handleInputChange('insuranceInfo', e.target.value)}
                  placeholder="Insurance provider and policy number"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-medium mb-3">Emergency Contact (Optional)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyContact">Contact Name</Label>
              <Input
                id="emergencyContact"
                value={details.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                placeholder="Emergency contact name"
              />
            </div>
            <div>
              <Label htmlFor="emergencyContactNumber">Contact Number</Label>
              <Input
                id="emergencyContactNumber"
                type="tel"
                value={details.emergencyContactNumber}
                onChange={(e) => handleInputChange('emergencyContactNumber', e.target.value)}
                placeholder="+91 99999 99999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consent */}
      <Card className="border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-950">
        <CardContent className="p-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="consent"
              checked={details.consentGiven}
              onCheckedChange={(checked) => handleInputChange('consentGiven', checked)}
            />
            <Label
              htmlFor="consent"
              className="cursor-pointer text-sm"
            >
              I consent to the treatment and understand that the information provided
              will be used for medical purposes. I agree to the terms and conditions
              of the hospital.
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DetailsStep;