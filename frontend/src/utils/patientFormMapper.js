/**
 * Patient to Form Field Mapper
 * Intelligently maps patient data to form fields based on label matching
 */

/**
 * Field mapping configuration
 * Maps patient fields to common form field label patterns
 */
const PATIENT_FIELD_MAPPINGS = [
  {
    patientField: 'full_name',
    labelPatterns: ['full name', 'patient name', 'name', 'member name', 'customer name'],
    exactMatch: true
  },
  {
    patientField: 'contact',
    labelPatterns: ['phone', 'contact', 'mobile', 'phone number', 'contact number', 'mobile number', 'telephone'],
    fieldTypes: ['phone', 'tel']
  },
  {
    patientField: 'email',
    labelPatterns: ['email', 'email address', 'e-mail', 'email id'],
    fieldTypes: ['email']
  },
  {
    patientField: 'date_of_birth',
    labelPatterns: ['date of birth', 'birth date', 'dob', 'birthday'],
    fieldTypes: ['date']
  },
  {
    patientField: 'gender',
    labelPatterns: ['gender', 'sex']
  },
  {
    patientField: 'address',
    labelPatterns: ['address', 'street address', 'full address', 'residential address']
  },
  {
    patientField: 'city',
    labelPatterns: ['city', 'town']
  },
  {
    patientField: 'state',
    labelPatterns: ['state', 'province', 'region']
  },
  {
    patientField: 'postal_code',
    labelPatterns: ['postal code', 'zip code', 'pin code', 'pincode', 'zip', 'postal']
  },
  {
    patientField: 'blood_group',
    labelPatterns: ['blood group', 'blood type']
  },
  {
    patientField: 'emergency_contact_name',
    labelPatterns: ['emergency contact', 'emergency contact name', 'next of kin']
  },
  {
    patientField: 'emergency_contact_phone',
    labelPatterns: ['emergency phone', 'emergency contact phone', 'emergency number']
  }
];

/**
 * Normalize a string for comparison
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
const normalizeString = (str) => {
  if (!str) return '';
  return str.toString().toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
};

/**
 * Check if a form field label matches a patient field
 * @param {Object} field - Form field object
 * @param {Object} mapping - Mapping configuration
 * @returns {boolean} True if matches
 */
const fieldMatches = (field, mapping) => {
  // Get label - fields use 'label' not 'field_label'
  const normalizedLabel = normalizeString(field.label || field.field_label || '');

  // Check label patterns
  const labelMatch = mapping.labelPatterns.some(pattern => {
    const normalizedPattern = normalizeString(pattern);
    return normalizedLabel.includes(normalizedPattern);
  });

  // Check field type if specified - fields use 'type' not 'field_type'
  const typeMatch = mapping.fieldTypes
    ? mapping.fieldTypes.includes(field.type || field.field_type)
    : true;

  return labelMatch && typeMatch;
};

/**
 * Format date for date input field
 * @param {string|Date} dateValue - Date value
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
const formatDateValue = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

/**
 * Format phone number for phone input field
 * Phone field expects format: "+91 1234567890" (country code with space)
 * @param {string} phoneValue - Phone value
 * @returns {string} Formatted phone with space between country code and number
 */
const formatPhoneValue = (phoneValue) => {
  if (!phoneValue) return '';

  const cleaned = phoneValue.toString().trim();

  // If already has space after country code, return as-is
  if (/^\+\d{1,4}\s\d+$/.test(cleaned)) {
    return cleaned;
  }

  // Extract country code and number, add space between them
  // Matches: +91xxxxxxxxxx or +1xxxxxxxxxx etc.
  const match = cleaned.match(/^(\+\d{1,4})(\d+)$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  // If format doesn't match expected pattern, return as-is
  return cleaned;
};

/**
 * Format value based on field type
 * @param {any} value - Value to format
 * @param {string} fieldType - Type of field
 * @returns {any} Formatted value
 */
const formatValueForField = (value, fieldType) => {
  if (value === null || value === undefined) return '';

  switch (fieldType) {
    case 'date':
      return formatDateValue(value);
    case 'phone':
    case 'tel':
      return formatPhoneValue(value);
    case 'number':
      return Number(value) || '';
    case 'email':
    case 'text':
    case 'textarea':
    default:
      return value.toString();
  }
};

/**
 * Extract all fields from form schema
 * Handles both single-page and multi-page forms
 * @param {Object} schema - Form schema
 * @returns {Array} Array of all fields
 */
const extractAllFields = (schema) => {
  if (!schema) return [];

  const fields = [];

  // Handle multi-page form (pages array)
  if (schema.pages && Array.isArray(schema.pages)) {
    schema.pages.forEach(page => {
      // Pages have fields directly, not in sections
      if (page.fields && Array.isArray(page.fields)) {
        fields.push(...page.fields);
      }
      // Also check for sections (older format)
      if (page.sections && Array.isArray(page.sections)) {
        page.sections.forEach(section => {
          if (section.fields && Array.isArray(section.fields)) {
            fields.push(...section.fields);
          }
        });
      }
    });
  }
  // Handle single-page form (sections array)
  else if (schema.sections && Array.isArray(schema.sections)) {
    schema.sections.forEach(section => {
      if (section.fields && Array.isArray(section.fields)) {
        fields.push(...section.fields);
      }
    });
  }
  // Handle flat fields array
  else if (schema.fields && Array.isArray(schema.fields)) {
    fields.push(...schema.fields);
  }

  return fields;
};

/**
 * Map patient data to form fields
 * @param {Object} patient - Patient data object
 * @param {Object} formSchema - Form schema
 * @returns {Object} Object with fieldId: value mappings
 */
export const mapPatientToFormFields = (patient, formSchema) => {
  if (!patient || !formSchema) return {};

  const mappedValues = {};
  const allFields = extractAllFields(formSchema);

  // Iterate through all form fields
  allFields.forEach(field => {
    if (!field.id) return;

    // Special handling for patient contact field (can be phone or email)
    // Contact format: "Phone: +917667065798; Email: farzanmanzer@gmail.com"
    if (patient.contact) {
      const fieldLabel = normalizeString(field.label || '');
      const fieldType = field.type || field.field_type;

      // Parse phone and email from contact string
      let phoneNumber = '';
      let emailAddress = '';

      // Extract phone number
      const phoneMatch = patient.contact.match(/Phone:\s*([+\d\s-()]+)/i);
      if (phoneMatch) {
        phoneNumber = phoneMatch[1].trim();
      }

      // Extract email address
      const emailMatch = patient.contact.match(/Email:\s*([^\s;]+@[^\s;]+)/i);
      if (emailMatch) {
        emailAddress = emailMatch[1].trim();
      }

      // If contact is just a plain phone or email (no labels)
      if (!phoneMatch && !emailMatch) {
        if (patient.contact.includes('@')) {
          emailAddress = patient.contact.trim();
        } else if (/^[+\d\s-()]+$/.test(patient.contact)) {
          phoneNumber = patient.contact.trim();
        }
      }

      // Map to phone field
      if ((fieldType === 'phone' || fieldType === 'tel' || fieldLabel.includes('phone')) && phoneNumber) {
        mappedValues[field.id] = phoneNumber;
        return;
      }

      // Map to email field
      if ((fieldType === 'email' || fieldLabel.includes('email')) && emailAddress) {
        mappedValues[field.id] = emailAddress;
        return;
      }
    }

    // Try to find a matching patient field
    for (const mapping of PATIENT_FIELD_MAPPINGS) {
      if (fieldMatches(field, mapping)) {
        const patientValue = patient[mapping.patientField];

        // Only map if patient has a value for this field
        if (patientValue !== null && patientValue !== undefined && patientValue !== '') {
          // Use 'type' not 'field_type' for field type
          const formattedValue = formatValueForField(
            patientValue,
            field.type || field.field_type
          );

          if (formattedValue !== '') {
            mappedValues[field.id] = formattedValue;
          }
        }

        // Break after first match to avoid duplicate mappings
        break;
      }
    }
  });

  return mappedValues;
};

/**
 * Get a list of fields that were auto-filled
 * @param {Object} mappedValues - Result from mapPatientToFormFields
 * @param {Object} formSchema - Form schema
 * @returns {Array} Array of field labels that were auto-filled
 */
export const getAutoFilledFieldLabels = (mappedValues, formSchema) => {
  if (!mappedValues || !formSchema) return [];

  const allFields = extractAllFields(formSchema);
  const autoFilledLabels = [];

  Object.keys(mappedValues).forEach(fieldId => {
    const field = allFields.find(f => f.id === fieldId);
    if (field) {
      autoFilledLabels.push(field.label || field.field_label || fieldId);
    }
  });

  return autoFilledLabels;
};

export default mapPatientToFormFields;
