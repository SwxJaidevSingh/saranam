/**
 * Missing Providers Step - Resolve providers that don't exist in database
 * Allows users to create providers, assign to Unknown Provider, change to existing, or skip
 */
import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import pureLogicBulkApi from '../../api/pureLogicBulk';
import providersApi from '../../api/providers';

const MissingProvidersStep = ({ sessionData, missingProviders, onNext, onBack, onError }) => {
  const [resolutions, setResolutions] = useState({});
  const [existingProviders, setExistingProviders] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    // Initialize resolutions for each missing provider
    const initialResolutions = {};
    missingProviders.forEach((provider) => {
      initialResolutions[provider.provider_name] = {
        action: 'create',
        provider_data: {
          full_name: provider.provider_name,
          specialization: '',
          phone: '',
          email: ''
        },
        existing_provider_id: null
      };
    });
    setResolutions(initialResolutions);

    // Load existing providers and specializations
    loadExistingProviders();
    loadSpecializations();
  }, [missingProviders]);

  const loadExistingProviders = async () => {
    try {
      const response = await providersApi.list({ per_page: 100 });
      setExistingProviders(response.providers || []);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const loadSpecializations = async () => {
    try {
      const response = await providersApi.getSpecializations();
      setSpecializations(response.specializations || []);
    } catch (error) {
      console.error('Failed to load specializations:', error);
    }
  };

  const updateResolution = (providerName, field, value) => {
    setResolutions((prev) => ({
      ...prev,
      [providerName]: {
        ...prev[providerName],
        [field]: value
      }
    }));
  };

  const updateProviderData = (providerName, field, value) => {
    setResolutions((prev) => ({
      ...prev,
      [providerName]: {
        ...prev[providerName],
        provider_data: {
          ...prev[providerName].provider_data,
          [field]: value
        }
      }
    }));
  };

  const handleResolveAll = async () => {
    try {
      setResolving(true);
      onError(null);

      // Build resolutions array for API
      const resolutionsArray = missingProviders.map((provider) => {
        const resolution = resolutions[provider.provider_name];
        return {
          provider_name: provider.provider_name,
          action: resolution.action,
          provider_data: resolution.action === 'create' ? resolution.provider_data : undefined,
          existing_provider_id: resolution.action === 'change' ? resolution.existing_provider_id : undefined
        };
      });

      const response = await pureLogicBulkApi.resolveMissingProviders(sessionData.id, {
        resolutions: resolutionsArray
      });

      // Move to next step with updated statistics
      onNext({
        statistics: response.session_stats
      });

    } catch (error) {
      onError('Failed to resolve providers: ' + (error.response?.data?.error || error.message));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <div className="ml-2">
          <p className="font-medium">Missing Providers Detected</p>
          <p className="text-sm text-muted-foreground mt-1">
            {missingProviders.length} provider(s) mentioned in your file don't exist in the system.
            Please choose how to handle each provider.
          </p>
        </div>
      </Alert>

      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {missingProviders.map((provider) => {
          const resolution = resolutions[provider.provider_name];
          if (!resolution) return null;

          return (
            <Card key={provider.provider_name} className="p-6 border-orange-200">
              <div className="space-y-4">
                {/* Provider Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{provider.provider_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {provider.appointment_count} appointment{provider.appointment_count > 1 ? 's' : ''} affected
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    Not Found
                  </Badge>
                </div>

                {/* Resolution Options */}
                <RadioGroup
                  value={resolution.action}
                  onValueChange={(value) => updateResolution(provider.provider_name, 'action', value)}
                >
                  {/* Option 1: Create Provider */}
                  <div className="flex items-start space-x-3 p-4 rounded-lg border">
                    <RadioGroupItem value="create" id={`create-${provider.provider_name}`} />
                    <div className="flex-1 space-y-3">
                      <Label htmlFor={`create-${provider.provider_name}`} className="font-medium cursor-pointer">
                        Create New Provider
                      </Label>

                      {resolution.action === 'create' && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <Label className="text-xs">Full Name *</Label>
                            <Input
                              value={resolution.provider_data.full_name}
                              onChange={(e) =>
                                updateProviderData(provider.provider_name, 'full_name', e.target.value)
                              }
                              placeholder="Dr. John Smith"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Specialization</Label>
                            <Select
                              value={resolution.provider_data.specialization}
                              onValueChange={(value) =>
                                updateProviderData(provider.provider_name, 'specialization', value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select specialization" />
                              </SelectTrigger>
                              <SelectContent>
                                {specializations.map((spec) => (
                                  <SelectItem key={spec} value={spec}>
                                    {spec}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Phone</Label>
                            <Input
                              value={resolution.provider_data.phone}
                              onChange={(e) =>
                                updateProviderData(provider.provider_name, 'phone', e.target.value)
                              }
                              placeholder="9876543210"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Email</Label>
                            <Input
                              type="email"
                              value={resolution.provider_data.email}
                              onChange={(e) =>
                                updateProviderData(provider.provider_name, 'email', e.target.value)
                              }
                              placeholder="doctor@example.com"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Option 2: Assign to Unknown Provider */}
                  <div className="flex items-start space-x-3 p-4 rounded-lg border">
                    <RadioGroupItem value="assign_unknown" id={`unknown-${provider.provider_name}`} />
                    <div className="flex-1">
                      <Label htmlFor={`unknown-${provider.provider_name}`} className="font-medium cursor-pointer">
                        Assign to "Unknown Provider"
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Use a placeholder for now, reassign later
                      </p>
                    </div>
                  </div>

                  {/* Option 3: Change to Existing Provider */}
                  <div className="flex items-start space-x-3 p-4 rounded-lg border">
                    <RadioGroupItem value="change" id={`change-${provider.provider_name}`} />
                    <div className="flex-1 space-y-3">
                      <Label htmlFor={`change-${provider.provider_name}`} className="font-medium cursor-pointer">
                        Change to Existing Provider
                      </Label>

                      {resolution.action === 'change' && (
                        <Select
                          value={resolution.existing_provider_id || ''}
                          onValueChange={(value) =>
                            updateResolution(provider.provider_name, 'existing_provider_id', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {existingProviders.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.full_name} {p.specialization ? `- ${p.specialization}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Option 4: Skip */}
                  <div className="flex items-start space-x-3 p-4 rounded-lg border">
                    <RadioGroupItem value="skip" id={`skip-${provider.provider_name}`} />
                    <div className="flex-1">
                      <Label htmlFor={`skip-${provider.provider_name}`} className="font-medium cursor-pointer">
                        Skip These Appointments
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Don't create appointments for this provider
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={resolving}>
          Back
        </Button>
        <Button onClick={handleResolveAll} disabled={resolving}>
          {resolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {resolving ? 'Resolving...' : 'Resolve All & Continue'}
        </Button>
      </div>
    </div>
  );
};

export default MissingProvidersStep;
