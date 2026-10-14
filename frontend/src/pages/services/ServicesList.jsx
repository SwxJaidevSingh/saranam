/**
 * ServicesList Component
 * Displays services by type with booking capabilities
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building,
  Activity,
  House,
  Calendar,
  AlertCircle,
  ChevronRight,
  Loader2,
  Check,
  Search,
  Filter,
  Stethoscope,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { servicesApi } from '../../api/services';
import { usePatient } from '../../context/PatientContext';
import { useToast } from '../../hooks/useToast';
import PatientSelector from '../../components/patients/PatientSelector';

const ServicesList = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const { selectedPatient, selectPatient } = usePatient();
  const { showToast } = useToast();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAdmission, setFilterAdmission] = useState(false);
  const [filterReferral, setFilterReferral] = useState(false);

  // Service type configurations
  const serviceTypeConfig = {
    'ipd': {
      title: 'In-Patient Department (IPD)',
      icon: Building,
      color: 'bg-blue-500',
      description: 'Comprehensive in-patient care with admission and 24x7 monitoring'
    },
    'opd': {
      title: 'Out-Patient Department (OPD)',
      icon: Activity,
      color: 'bg-green-500',
      description: 'General consultation and treatment services'
    },
    'physiotherapy': {
      title: 'Physiotherapy',
      icon: Activity,
      color: 'bg-purple-500',
      description: 'Physical therapy and rehabilitation services'
    },
    'home-care': {
      title: 'Home Care Services',
      icon: House,
      color: 'bg-orange-500',
      description: 'Healthcare services delivered at your home'
    }
  };

  useEffect(() => {
    loadServices();
    loadStats();
  }, [type]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const serviceType = type?.toUpperCase().replace('-', '_');
      const response = await servicesApi.getByType(serviceType);
      setServices(response.services || []);
    } catch (error) {
      console.error('Error loading services:', error);
      showToast('Failed to load services', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await servicesApi.getStats();
      setStats(response);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);

    // Check if patient is already selected
    if (selectedPatient) {
      // Proceed to booking
      proceedToBooking(service);
    } else {
      // Show patient selector
      setShowPatientSelector(true);
    }
  };

  const proceedToBooking = (service) => {
    // Navigate to booking wizard with service and patient context
    navigate(`/services/${type}/book`, {
      state: {
        service: service,
        patient: selectedPatient
      }
    });
  };

  const handlePatientSelected = (patient) => {
    selectPatient(patient);
    setShowPatientSelector(false);

    if (selectedService) {
      proceedToBooking(selectedService);
    }
  };

  const formatDuration = (minutes) => {
    if (minutes >= 1440) {
      return `${minutes / 1440} day(s)`;
    } else if (minutes >= 60) {
      return `${minutes / 60} hour(s)`;
    }
    return `${minutes} minutes`;
  };

  const filteredServices = services.filter(service => {
    // Search filter
    if (searchQuery && !service.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !service.department?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Admission filter
    if (filterAdmission && !service.requires_admission) {
      return false;
    }

    // Referral filter
    if (filterReferral && !service.requires_referral) {
      return false;
    }

    return true;
  });

  const config = serviceTypeConfig[type] || {};
  const Icon = config.icon || Activity;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card shadow-sm rounded-lg p-6 border border-border">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-lg ${config.color} text-white`}>
            <Icon className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
            <p className="text-muted-foreground mt-1">{config.description}</p>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {stats.by_type?.[type?.toUpperCase().replace('-', '_')] || 0}
                </div>
                <div className="text-sm text-muted-foreground">Services</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Patient Selection Bar */}
      {selectedPatient && (
        <div className="bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-700 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Check className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <div>
              <span className="text-sm text-primary-900 dark:text-primary-200 font-medium">Patient Selected:</span>
              <span className="ml-2 text-sm text-primary-700 dark:text-primary-300">{selectedPatient.full_name}</span>
              {selectedPatient.abha_id && (
                <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">({selectedPatient.abha_id})</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowPatientSelector(true)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 underline"
          >
            Change Patient
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-card text-foreground"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterAdmission(!filterAdmission)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterAdmission
                  ? 'bg-primary-600 dark:bg-primary-500 text-white'
                  : 'bg-muted text-foreground hover:bg-accent'
              }`}
            >
              <Filter className="h-4 w-4 inline mr-1" />
              Admission
            </button>
            <button
              onClick={() => setFilterReferral(!filterReferral)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterReferral
                  ? 'bg-primary-600 dark:bg-primary-500 text-white'
                  : 'bg-muted text-foreground hover:bg-accent'
              }`}
            >
              <Filter className="h-4 w-4 inline mr-1" />
              Referral
            </button>
          </div>
        </div>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Services Found</h3>
          <p className="text-gray-500">
            {searchQuery || filterAdmission || filterReferral
              ? 'Try adjusting your search or filters'
              : `No ${config.title?.toLowerCase()} services are currently available.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-200 group overflow-hidden"
              onClick={() => handleServiceSelect(service)}
            >
              {/* Colored Header Bar */}
              <div className={`h-2 ${config.color} group-hover:h-3 transition-all duration-300`}></div>

              <div className="p-6">
                {/* Service Icon and Title */}
                <div className="flex items-start space-x-4 mb-4">
                  <div className={`p-3 rounded-xl ${config.color} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-8 w-8 ${config.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                      {service.name}
                    </h3>
                    {service.department && (
                      <p className="text-sm text-gray-500 flex items-center">
                        <Stethoscope className="h-3 w-3 mr-1" />
                        {service.department}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Description */}
                {service.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {service.description}
                  </p>
                )}

                {/* Special Requirements & Status */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {service.requires_admission && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Requires Admission
                    </span>
                  )}
                  {service.requires_referral && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Requires Referral
                    </span>
                  )}
                  {service.is_active && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Available
                    </span>
                  )}
                </div>

                {/* Providers Available */}
                {service.stats && service.stats.active_providers > 0 && (
                  <div className="flex items-center text-sm text-gray-600 mb-4">
                    <Stethoscope className="h-4 w-4 mr-2 text-blue-500" />
                    <span className="font-medium text-gray-900">{service.stats.active_providers}</span>
                    <span className="ml-1">provider{service.stats.active_providers > 1 ? 's' : ''} available</span>
                  </div>
                )}

                {/* Book Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServiceSelect(service);
                  }}
                  className={`w-full mt-2 px-6 py-3 ${config.color} text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg group-hover:scale-105`}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Appointment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patient Selector Modal */}
      {showPatientSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Select Patient</h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose an existing patient or register a new patient for this service
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <PatientSelector
                onSelect={handlePatientSelected}
                onCancel={() => setShowPatientSelector(false)}
                showCreateButton={true}
              />
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowPatientSelector(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesList;