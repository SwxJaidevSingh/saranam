/**
 * ServiceContext - State management for healthcare services
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { servicesApi } from '../api/services';
import { useToast } from '../hooks/useToast';

const ServiceContext = createContext(null);

export const useService = () => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useService must be used within ServiceProvider');
  }
  return context;
};

export const ServiceProvider = ({ children }) => {
  const { showToast } = useToast();

  // State
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [serviceForms, setServiceForms] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Service types mapping
  const serviceTypes = {
    IPD: { label: 'In-Patient Department', slug: 'ipd' },
    OPD: { label: 'Out-Patient Department', slug: 'opd' },
    PHYSIOTHERAPY: { label: 'Physiotherapy', slug: 'physiotherapy' },
    HOME_CARE: { label: 'Home Care', slug: 'home-care' }
  };

  /**
   * Load services by type
   */
  const loadServicesByType = useCallback(async (type) => {
    try {
      setLoading(true);
      setError(null);
      const response = await servicesApi.getByType(type);
      setServices(response.services || []);
      return response.services;
    } catch (err) {
      console.error('Error loading services:', err);
      setError(err.message);
      showToast('Failed to load services', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /**
   * Load all services
   */
  const loadAllServices = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await servicesApi.list(filters);
      setServices(response.services || []);
      return response.services;
    } catch (err) {
      console.error('Error loading services:', err);
      setError(err.message);
      showToast('Failed to load services', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /**
   * Get service by ID
   */
  const getServiceById = useCallback(async (serviceId) => {
    try {
      setLoading(true);
      setError(null);
      const service = await servicesApi.getById(serviceId);
      setSelectedService(service);
      return service;
    } catch (err) {
      console.error('Error loading service:', err);
      setError(err.message);
      showToast('Failed to load service details', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /**
   * Load providers for a service
   */
  const loadServiceProviders = useCallback(async (serviceId) => {
    try {
      setLoading(true);
      const response = await servicesApi.getProviders(serviceId);
      setServiceProviders(response.providers || []);
      return response.providers;
    } catch (err) {
      console.error('Error loading providers:', err);
      showToast('Failed to load providers', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /**
   * Load forms for a service
   */
  const loadServiceForms = useCallback(async (serviceId, formType = null) => {
    try {
      setLoading(true);
      const response = await servicesApi.getForms(serviceId, formType);
      setServiceForms(response.forms || []);
      return response.forms;
    } catch (err) {
      console.error('Error loading forms:', err);
      // Forms are optional, don't show error toast
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check service availability
   */
  const checkAvailability = useCallback(async (serviceId, date, duration = null) => {
    try {
      setLoading(true);
      const response = await servicesApi.getAvailability(serviceId, date, duration);
      setAvailability(response.slots || []);
      return response.slots;
    } catch (err) {
      console.error('Error checking availability:', err);
      showToast('Failed to check availability', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /**
   * Book a service
   */
  const bookService = useCallback(async (serviceId, bookingData) => {
    try {
      setLoading(true);
      const response = await servicesApi.book(serviceId, bookingData);
      showToast('Service booked successfully!', 'success');
      return response;
    } catch (err) {
      console.error('Error booking service:', err);
      const errorMessage = err.response?.data?.error || 'Failed to book service';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  /**
   * Create a new service (admin)
   */
  const createService = useCallback(async (serviceData) => {
    try {
      setLoading(true);
      const response = await servicesApi.create(serviceData);
      showToast('Service created successfully!', 'success');

      // Refresh services list
      await loadAllServices();

      return response.service;
    } catch (err) {
      console.error('Error creating service:', err);
      const errorMessage = err.response?.data?.error || 'Failed to create service';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showToast, loadAllServices]);

  /**
   * Update a service (admin)
   */
  const updateService = useCallback(async (serviceId, serviceData) => {
    try {
      setLoading(true);
      const response = await servicesApi.update(serviceId, serviceData);
      showToast('Service updated successfully!', 'success');

      // Refresh services list
      await loadAllServices();

      return response.service;
    } catch (err) {
      console.error('Error updating service:', err);
      const errorMessage = err.response?.data?.error || 'Failed to update service';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showToast, loadAllServices]);

  /**
   * Assign provider to service (admin)
   */
  const assignProviderToService = useCallback(async (serviceId, providerData) => {
    try {
      setLoading(true);
      await servicesApi.assignProvider(serviceId, providerData);
      showToast('Provider assigned successfully!', 'success');

      // Refresh providers list
      await loadServiceProviders(serviceId);

      return true;
    } catch (err) {
      console.error('Error assigning provider:', err);
      const errorMessage = err.response?.data?.error || 'Failed to assign provider';
      showToast(errorMessage, 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [showToast, loadServiceProviders]);

  /**
   * Assign form to service (admin)
   */
  const assignFormToService = useCallback(async (serviceId, formData) => {
    try {
      setLoading(true);
      await servicesApi.assignForm(serviceId, formData);
      showToast('Form assigned successfully!', 'success');

      // Refresh forms list
      await loadServiceForms(serviceId);

      return true;
    } catch (err) {
      console.error('Error assigning form:', err);
      const errorMessage = err.response?.data?.error || 'Failed to assign form';
      showToast(errorMessage, 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [showToast, loadServiceForms]);

  /**
   * Get service statistics
   */
  const getServiceStats = useCallback(async () => {
    try {
      const stats = await servicesApi.getStats();
      return stats;
    } catch (err) {
      console.error('Error loading stats:', err);
      return null;
    }
  }, []);

  /**
   * Clear selected service
   */
  const clearSelectedService = useCallback(() => {
    setSelectedService(null);
    setServiceProviders([]);
    setServiceForms([]);
    setAvailability([]);
  }, []);

  /**
   * Select a service
   */
  const selectService = useCallback((service) => {
    setSelectedService(service);
  }, []);

  const value = {
    // State
    services,
    selectedService,
    serviceProviders,
    serviceForms,
    availability,
    loading,
    error,
    serviceTypes,

    // Actions
    loadServicesByType,
    loadAllServices,
    getServiceById,
    loadServiceProviders,
    loadServiceForms,
    checkAvailability,
    bookService,
    createService,
    updateService,
    assignProviderToService,
    assignFormToService,
    getServiceStats,
    selectService,
    clearSelectedService
  };

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
};

export default ServiceProvider;