import React, { useState, useEffect } from 'react';
import { useServiceBooking } from '../ServiceBookingContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import servicesApi from '@/api/services';
import providersApi from '@/api/providers';
import {
  Loader2,
  User,
  Award,
  Clock,
  Calendar,
  CreditCard,
  Languages,
  MapPin,
  Stethoscope
} from 'lucide-react';

const ProviderSelectionStep = () => {
  const { updateBookingData, bookingData } = useServiceBooking();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(bookingData.provider);

  useEffect(() => {
    // Always fetch providers when component mounts or service changes
    fetchProvidersForService();
  }, [bookingData.service]);

  const fetchProvidersForService = async () => {
    setLoading(true);
    try {
      // If no service selected, fetch all providers
      if (!bookingData.service || !bookingData.service.id) {
        console.log('No service selected, fetching all providers');
        const allProvidersResponse = await providersApi.list();
        const allProviders = allProvidersResponse.providers || allProvidersResponse || [];
        setProviders(allProviders);
        return;
      }

      // Fetch providers assigned to this service
      console.log('Fetching providers for service:', bookingData.service.id);
      const response = await servicesApi.getProviders(bookingData.service.id);
      const serviceProviderRelations = response.providers || response || [];

      // Extract actual providers from ServiceProvider relationships
      const providersList = serviceProviderRelations.map(sp => {
        // If it's a ServiceProvider relation with nested provider, extract it
        if (sp.provider) {
          return {
            ...sp.provider,
            is_primary: sp.is_primary,
            service_settings: sp.settings
          };
        }
        // Otherwise, assume it's already a provider object
        return sp;
      });

      // If no providers directly assigned to service, fetch all providers
      if (providersList.length === 0) {
        console.log('No service-specific providers found, fetching all providers');
        const allProvidersResponse = await providersApi.list();
        const allProviders = allProvidersResponse.providers || allProvidersResponse || [];
        setProviders(allProviders);
      } else {
        setProviders(providersList);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      // Fallback to fetching all providers
      try {
        console.log('Error occurred, falling back to fetch all providers');
        const allProvidersResponse = await providersApi.list();
        const allProviders = allProvidersResponse.providers || allProvidersResponse || [];
        setProviders(allProviders);
      } catch (fallbackError) {
        console.error('Error fetching all providers:', fallbackError);
        setProviders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (providerId) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
      updateBookingData('provider', provider);
    }
  };

  const handleClearSelection = () => {
    setSelectedProvider(null);
    updateBookingData('provider', null);
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getDaysDisplay = (days) => {
    if (!days || days.length === 0) return 'Not Available';
    if (days.length === 7) return 'All Days';
    if (days.length === 5 && !days.includes('Saturday') && !days.includes('Sunday')) {
      return 'Mon-Fri';
    }
    return days.join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Service Info */}
      {bookingData.service && (
        <div className="bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-primary-900 dark:text-primary-100">
                Selected Service: {bookingData.service.name}
              </h4>
              <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                {bookingData.serviceType === 'IPD' && 'In-Patient Department'}
                {bookingData.serviceType === 'OPD' && 'Out-Patient Department'}
                {bookingData.serviceType === 'PHYSIOTHERAPY' && 'Physiotherapy'}
                {bookingData.serviceType === 'HOME_CARE' && 'Home Care'}
              </p>
            </div>
            {bookingData.service.duration && (
              <Badge variant="secondary">
                {bookingData.service.duration} min
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Provider Selection Dropdown */}
      <div className="space-y-2">
        <Label htmlFor="provider-select" className="text-base font-medium">
          Select Healthcare Provider
        </Label>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
            <span className="ml-3 text-muted-foreground">Loading providers...</span>
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-lg">No providers available</p>
            <p className="text-sm mt-2">Please contact support for assistance</p>
          </div>
        ) : (
          <Select
            value={selectedProvider?.id || ''}
            onValueChange={handleProviderSelect}
          >
            <SelectTrigger id="provider-select" className="w-full">
              <SelectValue placeholder="Choose a provider from the list" />
            </SelectTrigger>
            <SelectContent>
              {providers.map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex-1">
                      <div className="font-medium">{provider.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {[
                          provider.specialization,
                          provider.qualification
                        ].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    {provider.consultation_fee && (
                      <span className="text-sm font-medium ml-4">
                        ₹{provider.consultation_fee}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Selected Provider Details */}
      {selectedProvider && (
        <Card className="bg-success-50 dark:bg-success-950 border-success-200 dark:border-success-800">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-success-100 dark:bg-success-900 rounded-full flex items-center justify-center mr-3">
                  <User className="h-6 w-6 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-success-900 dark:text-success-100">
                    {selectedProvider.full_name}
                  </h4>
                  <p className="text-sm text-success-700 dark:text-success-300">
                    {selectedProvider.qualification}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                className="text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 border-danger-300 dark:border-danger-700"
              >
                Change Provider
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Specialization */}
              {selectedProvider.specialization && (
                <div className="flex items-start">
                  <Stethoscope className="h-4 w-4 text-success-600 dark:text-success-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Specialization</p>
                    <p className="font-medium">{selectedProvider.specialization}</p>
                  </div>
                </div>
              )}

              {/* Department */}
              {selectedProvider.department && (
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-success-600 dark:text-success-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{selectedProvider.department}</p>
                  </div>
                </div>
              )}

              {/* Experience */}
              {selectedProvider.years_of_experience && (
                <div className="flex items-start">
                  <Award className="h-4 w-4 text-success-600 dark:text-success-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Experience</p>
                    <p className="font-medium">{selectedProvider.years_of_experience} years</p>
                  </div>
                </div>
              )}

              {/* Availability */}
              {selectedProvider.available_days && (
                <div className="flex items-start">
                  <Calendar className="h-4 w-4 text-success-600 dark:text-success-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Available Days</p>
                    <p className="font-medium">{getDaysDisplay(selectedProvider.available_days)}</p>
                  </div>
                </div>
              )}

              {/* Timing */}
              {selectedProvider.available_time_start && selectedProvider.available_time_end && (
                <div className="flex items-start">
                  <Clock className="h-4 w-4 text-success-600 dark:text-success-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Available Time</p>
                    <p className="font-medium">
                      {formatTime(selectedProvider.available_time_start)} - {formatTime(selectedProvider.available_time_end)}
                    </p>
                  </div>
                </div>
              )}

              {/* Consultation Fee */}
              {selectedProvider.consultation_fee && (
                <div className="flex items-start">
                  <CreditCard className="h-4 w-4 text-success-600 dark:text-success-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Consultation Fee</p>
                    <p className="font-medium text-lg">₹{selectedProvider.consultation_fee}</p>
                  </div>
                </div>
              )}

              {/* Languages */}
              {selectedProvider.languages && selectedProvider.languages.length > 0 && (
                <div className="flex items-start">
                  <Languages className="h-4 w-4 text-success-600 dark:text-success-400 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm text-muted-foreground">Languages</p>
                    <p className="font-medium">{selectedProvider.languages.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProviderSelectionStep;