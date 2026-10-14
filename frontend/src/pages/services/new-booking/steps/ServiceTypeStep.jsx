import React, { useState, useEffect } from 'react';
import { useServiceBooking } from '../ServiceBookingContext';
import ServiceTypeCard from '../components/ServiceTypeCard';
import servicesApi from '@/api/services';
import { Loader2 } from 'lucide-react';

const ServiceTypeStep = () => {
  const { updateBookingData, bookingData } = useServiceBooking();
  const [selectedType, setSelectedType] = useState(bookingData.serviceType);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState(bookingData.service);

  const serviceTypes = [
    {
      type: 'IPD',
      title: 'In-Patient Department',
      description: 'Admission and comprehensive inpatient care with 24/7 monitoring',
      features: [
        '24/7 medical supervision',
        'Dedicated nursing care',
        'All meals included',
        'Room options available'
      ]
    },
    {
      type: 'OPD',
      title: 'Out-Patient Department',
      description: 'Consultation and treatment without hospital admission',
      features: [
        'Expert consultation',
        'Same-day appointments',
        'Follow-up care',
        'Prescription services'
      ]
    },
    {
      type: 'PHYSIOTHERAPY',
      title: 'Physiotherapy',
      description: 'Physical therapy and rehabilitation services',
      features: [
        'Pain management',
        'Post-surgery rehab',
        'Sports injury treatment',
        'Mobility improvement'
      ]
    },
    {
      type: 'HOME_CARE',
      title: 'Home Care',
      description: 'Medical care and support services at your home',
      features: [
        'Doctor visits at home',
        'Nursing care',
        'Medical procedures',
        'Health monitoring'
      ]
    }
  ];

  useEffect(() => {
    if (selectedType) {
      fetchServicesForType(selectedType);
    }
  }, [selectedType]);

  useEffect(() => {
    console.log('ServiceTypeStep - bookingData.service:', bookingData.service);
    console.log('ServiceTypeStep - selectedService:', selectedService);
  }, [bookingData.service, selectedService]);

  const fetchServicesForType = async (type) => {
    setLoading(true);
    try {
      const response = await servicesApi.list({ service_type: type });
      setServices(response.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    updateBookingData('serviceType', type);
    setSelectedService(null); // Reset service selection when type changes
    updateBookingData('service', null);
  };

  const handleServiceSelect = (service) => {
    console.log('Service selected:', service);
    setSelectedService(service);
    updateBookingData('service', service);
  };

  return (
    <div className="space-y-6">
      {/* Service Type Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Service Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {serviceTypes.map(serviceType => (
            <ServiceTypeCard
              key={serviceType.type}
              {...serviceType}
              isSelected={selectedType === serviceType.type}
              onClick={() => handleTypeSelect(serviceType.type)}
            />
          ))}
        </div>
      </div>

      {/* Service Selection - Only show after type is selected */}
      {selectedType && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">
            Select {serviceTypes.find(t => t.type === selectedType)?.title} Service
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
              <span className="ml-3 text-muted-foreground">Loading services...</span>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No services available for this type.</p>
              <p className="text-sm mt-2">Please select a different service type.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map(service => (
                <div
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                    selectedService?.id === service.id
                      ? 'border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-950'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {service.name}
                      </h4>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {service.description}
                        </p>
                      )}
                      {service.duration && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Duration: {service.duration} minutes
                        </p>
                      )}
                    </div>
                    {service.base_price && (
                      <div className="text-right">
                        <span className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                          ₹{service.base_price}
                        </span>
                        <p className="text-xs text-muted-foreground">Starting from</p>
                      </div>
                    )}
                  </div>

                  {/* Additional Service Info */}
                  {service.department && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="inline-block text-xs bg-muted text-foreground px-2 py-1 rounded">
                        {service.department}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceTypeStep;