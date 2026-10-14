/**
 * Service Type Color Coding Utilities
 * Provides consistent colors for different service types across the application
 */

export const SERVICE_COLORS = {
  IPD: {
    primary: '#8b5cf6',      // Purple
    light: '#ede9fe',
    dark: '#6d28d9',
    text: '#5b21b6'
  },
  OPD: {
    primary: '#10b981',      // Green
    light: '#d1fae5',
    dark: '#059669',
    text: '#047857'
  },
  PHYSIOTHERAPY: {
    primary: '#f59e0b',      // Orange
    light: '#fef3c7',
    dark: '#d97706',
    text: '#b45309'
  },
  HOME_CARE: {
    primary: '#ef4444',      // Red
    light: '#fee2e2',
    dark: '#dc2626',
    text: '#b91c1c'
  },
  APPOINTMENT: {
    primary: '#3b82f6',      // Blue (regular appointments)
    light: '#dbeafe',
    dark: '#2563eb',
    text: '#1d4ed8'
  }
};

/**
 * Get color for a service type
 * @param {string} serviceType - The service type (IPD, OPD, PHYSIOTHERAPY, HOME_CARE, APPOINTMENT)
 * @param {string} variant - Color variant (primary, light, dark, text)
 * @returns {string} Hex color code
 */
export const getServiceColor = (serviceType, variant = 'primary') => {
  const type = serviceType?.toUpperCase();

  if (!type || !SERVICE_COLORS[type]) {
    return '#6b7280'; // Gray default
  }

  return SERVICE_COLORS[type][variant] || SERVICE_COLORS[type].primary;
};

/**
 * Get display name for service type
 * @param {string} serviceType - The service type
 * @returns {string} Display name
 */
export const getServiceTypeName = (serviceType) => {
  const names = {
    IPD: 'In-Patient Department',
    OPD: 'Out-Patient Department',
    PHYSIOTHERAPY: 'Physiotherapy',
    HOME_CARE: 'Home Care',
    APPOINTMENT: 'Appointment'
  };

  return names[serviceType?.toUpperCase()] || serviceType;
};

/**
 * Get icon name for service type (lucide-react icons)
 * @param {string} serviceType - The service type
 * @returns {string} Icon name
 */
export const getServiceIcon = (serviceType) => {
  const icons = {
    IPD: 'Building',
    OPD: 'Activity',
    PHYSIOTHERAPY: 'Dumbbell',
    HOME_CARE: 'Home',
    APPOINTMENT: 'Calendar'
  };

  return icons[serviceType?.toUpperCase()] || 'Briefcase';
};

/**
 * Get event type colors for calendar
 * @param {string} eventType - 'appointment' or 'service'
 * @param {string} serviceType - For service events, the specific service type
 * @returns {object} Color object with backgroundColor, borderColor, textColor
 */
export const getEventColors = (eventType, serviceType = null) => {
  if (eventType === 'service' && serviceType) {
    return {
      backgroundColor: getServiceColor(serviceType, 'primary'),
      borderColor: getServiceColor(serviceType, 'dark'),
      textColor: '#ffffff'
    };
  }

  // Default to appointment blue
  return {
    backgroundColor: SERVICE_COLORS.APPOINTMENT.primary,
    borderColor: SERVICE_COLORS.APPOINTMENT.dark,
    textColor: '#ffffff'
  };
};

/**
 * Get badge class for service type
 * @param {string} serviceType - The service type
 * @returns {string} Tailwind CSS classes for badge styling
 */
export const getServiceBadgeClass = (serviceType) => {
  const classes = {
    IPD: 'bg-purple-100 text-purple-800 border-purple-200',
    OPD: 'bg-green-100 text-green-800 border-green-200',
    PHYSIOTHERAPY: 'bg-orange-100 text-orange-800 border-orange-200',
    HOME_CARE: 'bg-red-100 text-red-800 border-red-200',
    APPOINTMENT: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  return classes[serviceType?.toUpperCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
};

export default {
  SERVICE_COLORS,
  getServiceColor,
  getServiceTypeName,
  getServiceIcon,
  getEventColors,
  getServiceBadgeClass
};
