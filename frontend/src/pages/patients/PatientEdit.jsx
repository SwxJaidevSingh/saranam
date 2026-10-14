/**
 * PatientEdit — Edit patient demographics and clinical info
 */
import React, { useState, useEffect } from 'react';
import {
  Container, Box, Typography, Paper, Button, TextField, MenuItem,
  CircularProgress, Alert, Switch, FormControlLabel, Divider, IconButton, Tooltip,
  Chip,
} from '@mui/material';
import {
  ArrowBack, Save, Add as AddIcon, LocalFlorist,
  MyLocation, Map as MapIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatient } from '../../context/PatientContext';
import useHospitalOptions from '../../hooks/useHospitalOptions';
import MarkDeceasedDialog from '../../components/patients/MarkDeceasedDialog';
import { getHospitalBase, getDrivingDistance, DEFAULT_HOSPITAL_CODE } from '../../constants/geo';
import MapPicker, { loadGoogleMaps } from '../../components/common/MapPicker';
import patientsApi from '../../api/patients';

// Bangalore PIN code to zone mapping (auto-suggestion only, user can override)
const BANGALORE_PIN_ZONES = {
  '560064': 'North', '560092': 'North', '560094': 'North', '560097': 'North',
  '560057': 'North', '560058': 'North', '560073': 'North', '560077': 'North',
  '560013': 'North', '560024': 'North', '560032': 'North', '560045': 'North',
  '560054': 'North', '560090': 'North',
  '560004': 'South', '560011': 'South', '560019': 'South', '560041': 'South',
  '560050': 'South', '560062': 'South', '560068': 'South', '560076': 'South',
  '560078': 'South', '560083': 'South', '560085': 'South', '560070': 'South',
  '560026': 'South',
  '560005': 'East', '560008': 'East', '560016': 'East', '560017': 'East',
  '560033': 'East', '560036': 'East', '560037': 'East', '560038': 'East',
  '560043': 'East', '560048': 'East', '560066': 'East', '560075': 'East',
  '560087': 'East', '560093': 'East', '560103': 'East', '560067': 'East',
  '560010': 'West', '560015': 'West', '560021': 'West', '560023': 'West',
  '560039': 'West', '560040': 'West', '560044': 'West', '560055': 'West',
  '560056': 'West', '560060': 'West', '560079': 'West', '560086': 'West',
  '560098': 'West',
  '560001': 'Central', '560002': 'Central', '560003': 'Central', '560009': 'Central',
  '560012': 'Central', '560018': 'Central', '560020': 'Central', '560025': 'Central',
  '560027': 'Central', '560029': 'Central', '560042': 'Central', '560046': 'Central',
  '560051': 'Central', '560053': 'Central',
};

const isBangaloreCity = (city) => {
  if (!city) return false;
  const normalized = city.toLowerCase().trim();
  return normalized.includes('bengaluru') || normalized.includes('bangalore');
};

const suggestZoneFromPin = (postalCode) => {
  if (!postalCode) return '';
  return BANGALORE_PIN_ZONES[postalCode.trim()] || '';
};

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const ZONE_OPTIONS = ['North', 'South', 'East', 'West', 'Central'];
const COMPLEXITY_OPTIONS = ['not_yet_determined', 'high', 'medium', 'low'];
const PRIORITY_OPTIONS = ['not_yet_determined', 'high', 'medium', 'low'];
const PRIORITY_LABELS = { not_yet_determined: 'Not Yet Determined', high: 'High', medium: 'Medium', low: 'Low' };
const CATEGORY_OPTIONS = [
  { value: '', label: 'Not Yet Determined', bsc: null, onco: null },
  { value: 'bsc_onco', label: 'BSC Onco', bsc: true, onco: true },
  { value: 'non_bsc_onco', label: 'Non-BSC Onco', bsc: false, onco: true },
  { value: 'bsc_non_onco', label: 'BSC Non-Onco', bsc: true, onco: false },
  { value: 'non_bsc_non_onco', label: 'Non-BSC Non-Onco', bsc: false, onco: false },
];

function deriveCategoryValue(bsc, onco) {
  if (bsc === true && onco === true) return 'bsc_onco';
  if (bsc === false && onco === true) return 'non_bsc_onco';
  if (bsc === true && onco === false) return 'bsc_non_onco';
  if (bsc === false && onco === false) return 'non_bsc_non_onco';
  return '';
}

/** Parse the raw contact field — could be JSON, "Phone: X; Email: Y", or plain string */
function parseContact(raw) {
  if (!raw) return { phone: '', email: '' };
  // Try JSON
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof parsed === 'object') {
      return {
        phone: (parsed.phone || '').replace(/^\+91/, ''),
        email: parsed.email || '',
      };
    }
  } catch { /* not JSON */ }
  // Try "Phone: X; Email: Y"
  const phoneMatch = raw.match(/Phone:\s*(\+?\d+)/i);
  const emailMatch = raw.match(/Email:\s*(\S+)/i);
  return {
    phone: (phoneMatch?.[1] || '').replace(/^\+91/, ''),
    email: emailMatch?.[1] || '',
  };
}

/** Parse address — could be a full string */
function parseAddress(raw) {
  if (!raw) return { line1: '', line2: '', city: '', state: '', postal_code: '' };
  // Simple heuristic: split by comma
  const parts = raw.split(',').map(s => s.trim());
  return {
    line1: parts[0] || '',
    line2: parts.length > 3 ? parts[1] : '',
    city: parts.length > 2 ? parts[parts.length - 2] : (parts[1] || ''),
    state: '',
    postal_code: '',
  };
}

/** Convert "15/03/1968" or "1968-03-15" to "YYYY-MM-DD" for <input type="date"> */
function toDateInputValue(raw) {
  if (!raw) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // DD/MM/YYYY
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  // Try Date parse
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return '';
}

const geocodeAddress = async (addressString) => {
  await loadGoogleMaps();
  if (!window.google?.maps) {
    throw new Error('Google Maps API not loaded');
  }
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: addressString, componentRestrictions: { country: 'in' } }, (results, status) => {
      if (status === 'OK' && results[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else {
        reject(new Error(`Geocoding failed with status: ${status}`));
      }
    });
  });
};

const SectionTitle = ({ children }) => (
  <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1, mb: 1, color: 'primary.main' }}>
    {children}
  </Typography>
);

const Row = ({ children }) => (
  <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
    {children}
  </Box>
);

const PatientEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPatient, updatePatient, loading } = usePatient();
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deathDialogOpen, setDeathDialogOpen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  // Hospital master list + inline "+ Add Hospital" state
  const { options: hospitalOptions, add: addHospital } = useHospitalOptions();
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [newHospital, setNewHospital] = useState({ code: '', name: '', homecare_prefix: '' });
  const [prefixUserEdited, setPrefixUserEdited] = useState(false);

  const handleAddHospital = async () => {
    const code = (newHospital.code || '').trim().toUpperCase();
    const name = (newHospital.name || '').trim();
    const homecare_prefix = (newHospital.homecare_prefix || '').trim().toUpperCase();
    if (!code || !name) { alert('Code and Name are required'); return; }
    try {
      const added = await addHospital({ code, name, homecare_prefix });
      setForm(prev => ({ ...prev, linked_hospital: (added && added.code) || code }));
      setNewHospital({ code: '', name: '', homecare_prefix: '' });
      setPrefixUserEdited(false);
      setShowAddHospital(false);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to add hospital');
    }
  };

  useEffect(() => { loadPatient(); }, [id]);

  const loadPatient = async () => {
    try {
      const data = await getPatient(id);
      setPatient(data);
      const contact = parseContact(data.contact);
      const addr = parseAddress(data.address);
      const latVal = data.latitude != null ? String(data.latitude) : ((data.external_metadata?.latitude != null) ? String(data.external_metadata.latitude) : '');
      const lngVal = data.longitude != null ? String(data.longitude) : ((data.external_metadata?.longitude != null) ? String(data.external_metadata.longitude) : '');
      setForm({
        full_name: data.full_name || '',
        date_of_birth: toDateInputValue(data.date_of_birth),
        gender: data.gender || '',
        phone_number: contact.phone,
        email: contact.email,
        alternative_phone: (data.alternative_phone || '').replace(/^\+91/, ''),
        alternative_phone_name: data.alternative_phone_name || '',
        hospital_uhid: data.hospital_uhid || '',
        primary_caregiver_name: data.primary_caregiver_name || '',
        primary_caregiver_relationship: data.primary_caregiver_relationship || '',
        primary_caregiver_phone: data.primary_caregiver_phone || '',
        decision_maker_name: data.decision_maker_name || '',
        decision_maker_designation: data.decision_maker_designation || '',
        decision_maker_phone: data.decision_maker_phone || '',
        educational_status: data.educational_status || '',
        occupation: data.occupation || '',
        religion: data.religion || '',
        marital_status: data.marital_status || '',
        preferred_language: data.preferred_language || '',
        barriers_to_communication: data.barriers_to_communication || '',
        no_of_children: data.no_of_children !== null && data.no_of_children !== undefined ? data.no_of_children : '',
        source_of_information: data.source_of_information || '',
        address_line1: addr.line1,
        address_line2: addr.line2,
        city: addr.city,
        state: addr.state,
        postal_code: addr.postal_code,
        latitude: latVal,
        longitude: lngVal,
        diagnosis: data.diagnosis || '',
        referred_from: data.referred_from || '',
        is_bangalore_resident: data.is_bangalore_resident || false,
        geographic_cluster: data.geographic_cluster || '',
        linked_hospital: data.linked_hospital || '',
        patient_category: deriveCategoryValue(data.bsc_status, data.is_onco),
        clinical_complexity: data.clinical_complexity || '',
        latest_pps_score: data.latest_pps_score != null ? data.latest_pps_score : null,
        care_status: data.care_status || 'active',
        is_contacted: data.is_contacted !== undefined ? data.is_contacted : true,
        home_care_decline_reason: data.home_care_decline_reason || '',
        is_deceased: !!data.is_deceased,
        date_of_death: data.date_of_death || '',
        place_of_death: data.place_of_death || '',
        place_of_death_remarks: data.place_of_death_remarks || '',
        registration_date: toDateInputValue(data.registration_date) || '',
      });
    } catch {
      setError('Failed to load patient');
    }
  };

  const applyZoneFromLatLng = async (lat, lng) => {
    try {
      const zone = await patientsApi.detectZone(lat, lng);
      if (zone) {
        setForm(prev => ({
          ...prev,
          geographic_cluster: zone,
          is_bangalore_resident: true,
          linked_hospital: prev.linked_hospital || DEFAULT_HOSPITAL_CODE,
        }));
      }
    } catch (e) { }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        applyZoneFromLatLng(pos.coords.latitude, pos.coords.longitude);
        setLocLoading(false);
      },
      (err) => {
        alert('Failed to get location: ' + err.message);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAddressResolved = (addr) => {
    const city = addr.city || '';
    const postalCode = addr.postal_code || '';
    const isBlr = isBangaloreCity(city);
    const suggestedZone = isBlr ? suggestZoneFromPin(postalCode) : '';

    setForm(prev => ({
      ...prev,
      address_line1: addr.address_line1 || prev.address_line1,
      address_line2: addr.address_line2 || prev.address_line2,
      city: city || prev.city,
      state: addr.state || prev.state,
      postal_code: postalCode || prev.postal_code,
      is_bangalore_resident: isBlr,
      geographic_cluster: suggestedZone || (isBlr ? prev.geographic_cluster : ''),
      linked_hospital: isBlr ? (prev.linked_hospital || DEFAULT_HOSPITAL_CODE) : '',
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone_number' || name === 'alternative_phone') {
      setForm(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
      return;
    }
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'home_care_decline_reason') {
        next.is_contacted = value !== 'Not contacted';
      }
      if (name === 'care_status') {
        if (value === 'active') {
          next.home_care_decline_reason = '';
          next.is_contacted = true;
        } else if (value === 'inactive' && !next.home_care_decline_reason) {
          next.home_care_decline_reason = "Doesn't want homecare";
          next.is_contacted = true;
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {};

      // Only send fields that have values (schema is all-optional)
      if (form.full_name) payload.full_name = form.full_name;
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      if (form.gender) payload.gender = form.gender;
      if (form.phone_number) payload.phone_number = '+91' + form.phone_number;
      if (form.email) payload.email = form.email;
      payload.alternative_phone = form.alternative_phone ? '+91' + form.alternative_phone : '';
      payload.alternative_phone_name = form.alternative_phone_name || '';
      payload.hospital_uhid = (form.hospital_uhid || '').trim();
      payload.primary_caregiver_name = (form.primary_caregiver_name || '').trim();
      payload.primary_caregiver_relationship = (form.primary_caregiver_relationship || '').trim();
      payload.primary_caregiver_phone = (form.primary_caregiver_phone || '').trim();
      payload.decision_maker_name = (form.decision_maker_name || '').trim();
      payload.decision_maker_designation = (form.decision_maker_designation || '').trim();
      payload.decision_maker_phone = (form.decision_maker_phone || '').trim();
      payload.educational_status = form.educational_status || '';
      payload.occupation = form.occupation || '';
      payload.religion = form.religion || '';
      payload.marital_status = form.marital_status || '';
      payload.preferred_language = form.preferred_language || '';
      payload.barriers_to_communication = form.barriers_to_communication || '';
      payload.no_of_children = form.no_of_children === '' ? null : Number(form.no_of_children);
      payload.source_of_information = form.source_of_information || '';
      if (form.address_line1) payload.address_line1 = form.address_line1;
      if (form.address_line2) payload.address_line2 = form.address_line2;
      if (form.city) payload.city = form.city;
      if (form.state) payload.state = form.state;
      if (form.postal_code) payload.postal_code = form.postal_code;
      if (form.diagnosis) payload.diagnosis = form.diagnosis;
      if (form.referred_from) payload.referred_from = form.referred_from;
      if (form.registration_date) payload.registration_date = form.registration_date;

      payload.is_bangalore_resident = form.is_bangalore_resident;
      if (form.is_bangalore_resident && form.geographic_cluster) {
        payload.geographic_cluster = form.geographic_cluster;
      }
      if (form.is_bangalore_resident && form.linked_hospital) {
        payload.linked_hospital = form.linked_hospital;
      }

      // Coordinates & driving distance handling
      const hasCoords = Boolean(form.latitude && form.longitude && !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude)));
      const originalLat = patient?.latitude ?? patient?.external_metadata?.latitude;
      const originalLng = patient?.longitude ?? patient?.external_metadata?.longitude;
      const coordsChanged =
        (form.latitude || '') !== (originalLat != null ? String(originalLat) : '') ||
        (form.longitude || '') !== (originalLng != null ? String(originalLng) : '');

      const originalAddr = parseAddress(patient?.address);
      const addressChanged =
        (form.address_line1 || '') !== (originalAddr.line1 || '') ||
        (form.address_line2 || '') !== (originalAddr.line2 || '') ||
        (form.city || '') !== (originalAddr.city || '') ||
        (form.state || '') !== (originalAddr.state || '') ||
        (form.postal_code || '') !== (originalAddr.postal_code || '');

      if (coordsChanged && hasCoords) {
        // User explicitly set or changed coordinates (via Map, GPS, or manual input)
        const lat = parseFloat(form.latitude);
        const lng = parseFloat(form.longitude);
        let driveDistanceKm = null;
        const hospitalCode = form.linked_hospital || patient?.linked_hospital || DEFAULT_HOSPITAL_CODE;
        try {
          await loadGoogleMaps();
          const hospital = getHospitalBase(hospitalCode);
          driveDistanceKm = await getDrivingDistance(hospital.lat, hospital.lng, lat, lng);
        } catch (distErr) {
          console.warn('Driving distance calculation failed:', distErr);
        }

        payload.external_metadata = {
          ...(patient?.external_metadata || {}),
          latitude: lat,
          longitude: lng,
          drive_distance_km: driveDistanceKm ? Math.round(driveDistanceKm * 10) / 10 : null
        };
      } else if (coordsChanged && !hasCoords && (originalLat != null || originalLng != null)) {
        // User explicitly cleared the coordinates
        payload.external_metadata = {
          ...(patient?.external_metadata || {}),
          latitude: null,
          longitude: null,
          drive_distance_km: null
        };
      } else if (addressChanged) {
        // Address was updated without directly editing coordinates -> auto geocode
        const addressParts = [
          form.address_line1, form.address_line2, form.city,
          form.state, form.postal_code
        ].filter(Boolean);

        if (addressParts.length > 0) {
          const addressString = addressParts.join(', ');
          try {
            const coords = await geocodeAddress(addressString);
            const lat = coords.lat;
            const lng = coords.lng;

            // Detect new zone and update geographic cluster
            try {
              const zone = await patientsApi.detectZone(lat, lng);
              if (zone) {
                payload.geographic_cluster = zone;
                payload.is_bangalore_resident = true;
              }
            } catch (zoneErr) {
              console.warn('Failed to detect zone for geocoded coordinates:', zoneErr);
            }

            let driveDistanceKm = null;
            const hospitalCode = form.linked_hospital || patient?.linked_hospital || DEFAULT_HOSPITAL_CODE;
            try {
              const hospital = getHospitalBase(hospitalCode);
              driveDistanceKm = await getDrivingDistance(hospital.lat, hospital.lng, lat, lng);
            } catch (distErr) {
              console.warn('Driving distance calculation failed:', distErr);
            }

            payload.external_metadata = {
              ...(patient?.external_metadata || {}),
              latitude: lat,
              longitude: lng,
              drive_distance_km: driveDistanceKm ? Math.round(driveDistanceKm * 10) / 10 : null
            };
          } catch (geocodeErr) {
            console.warn('Geocoding failed, falling back to old coordinates:', geocodeErr);
            payload.external_metadata = {
              ...(patient?.external_metadata || {})
            };
          }
        }
      } else if (form.linked_hospital !== patient?.linked_hospital && (patient?.latitude || form.latitude) && (patient?.longitude || form.longitude)) {
        // Recalculate driving distance if ONLY linked_hospital changed and coordinates exist
        try {
          await loadGoogleMaps();
          const hospital = getHospitalBase(form.linked_hospital);
          const curLat = parseFloat(form.latitude || patient?.latitude);
          const curLng = parseFloat(form.longitude || patient?.longitude);
          const driveDistanceKm = await getDrivingDistance(hospital.lat, hospital.lng, curLat, curLng);
          payload.external_metadata = {
            ...(patient?.external_metadata || {}),
            drive_distance_km: driveDistanceKm ? Math.round(driveDistanceKm * 10) / 10 : null
          };
        } catch (err) {
          console.warn('Failed to recalculate driving distance on hospital change:', err);
        }
      }
      // clinical_complexity: manual override, always sent if set. On PPS save,
      // the backend re-derives this; here the user can override freely.
      if (form.clinical_complexity) payload.clinical_complexity = form.clinical_complexity;

      // Three-state care status (§3, 2026-04-14). Only applies when the patient
      // is alive — the backend auto-demotes to 'inactive' if is_deceased is true.
      if (!form.is_deceased && form.care_status) {
        payload.care_status = form.care_status;
        payload.is_contacted = form.is_contacted;
        payload.home_care_decline_reason = form.care_status === 'inactive' ? form.home_care_decline_reason : null;
      }

      // Derive bsc_status and is_onco from category
      if (form.patient_category) {
        const cat = CATEGORY_OPTIONS.find(c => c.value === form.patient_category);
        if (cat) {
          payload.bsc_status = cat.bsc;
          payload.is_onco = cat.onco;
        }
      }

      await updatePatient(id, payload);
      setSuccess(true);
      setTimeout(() => navigate(`/patients/${id}`), 800);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.details?.[0]?.msg || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !patient) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      </Container>
    );
  }

  if (!patient && !loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Patient not found</Alert>
      </Container>
    );
  }

  const hasLocation = Boolean(form.latitude && form.longitude);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(`/patients/${id}`)} sx={{ mb: 2, textTransform: 'none' }} size="small">
        Back to Patient
      </Button>

      <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Edit Patient
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {patient?.full_name}
          </Typography>
          {patient?.homecare_code && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 700,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'background.default',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {patient.homecare_code}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              fontWeight: 600,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: patient?.uhid ? 'primary.50' : 'action.hover',
              color: patient?.uhid ? 'primary.main' : 'text.disabled',
              border: '1px solid',
              borderColor: patient?.uhid ? 'primary.200' : 'divider',
            }}
          >
            UHID: {patient?.uhid || '—'}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            (UHID is system-generated. Editing the linked hospital below updates the Homecare Code prefix but does not change the UHID number.)
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>Patient updated successfully!</Alert>}

        {/* ── Personal Info ── */}
        <SectionTitle>Personal Information</SectionTitle>
        <Row>
          <TextField fullWidth size="small" label="Full Name" name="full_name" value={form.full_name || ''} onChange={handleChange} required />
        </Row>
        <Row>
          <TextField fullWidth size="small" type="date" label="Date of Birth" name="date_of_birth" value={form.date_of_birth || ''} onChange={handleChange} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth size="small" select label="Gender" name="gender" value={form.gender || ''} onChange={handleChange}>
            {GENDER_OPTIONS.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
        </Row>
        <Row>
          <TextField fullWidth size="small" label="Phone Number" name="phone_number" value={form.phone_number || ''} onChange={handleChange} placeholder="9876543210"
            InputProps={{ startAdornment: <Typography variant="body2" sx={{ mr: 1, color: 'text.secondary', fontWeight: 600 }}>+91</Typography> }}
          />
          <TextField fullWidth size="small" label="Email" name="email" type="email" value={form.email || ''} onChange={handleChange} />
        </Row>
        <Row>
          <TextField fullWidth size="small" label="Alternative Phone" name="alternative_phone" value={form.alternative_phone || ''} onChange={handleChange} placeholder="9876543210"
            InputProps={{ startAdornment: <Typography variant="body2" sx={{ mr: 1, color: 'text.secondary', fontWeight: 600 }}>+91</Typography> }}
          />
          <TextField fullWidth size="small" label="Name (Relationship)" name="alternative_phone_name" value={form.alternative_phone_name || ''} onChange={handleChange} placeholder="e.g. Ravi (Son)" />
        </Row>
        <Row>
          <TextField fullWidth size="small" label="Hospital UHID" name="hospital_uhid" value={form.hospital_uhid || ''} onChange={handleChange} placeholder="e.g. 20240015098" inputProps={{ maxLength: 30 }} helperText="From the patient's hospital file" />
          <TextField fullWidth size="small" type="date" label="Registration Date" name="registration_date" value={form.registration_date || ''} onChange={handleChange} InputLabelProps={{ shrink: true }} helperText="When the patient was registered with the organization" />
        </Row>

        <Divider sx={{ my: 2 }} />

        {/* ── Care Circle (captured at baseline, editable here for corrections) ── */}
        <SectionTitle>Care Circle</SectionTitle>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1.5, mb: 1.5 }}>
          Primary Caregiver = family member doing hands-on care. Decision Maker = clinical authority (doctor / consultant).
        </Typography>
        <Row>
          <TextField fullWidth size="small" label="Primary Caregiver Name" name="primary_caregiver_name" value={form.primary_caregiver_name || ''} onChange={handleChange} inputProps={{ maxLength: 100 }} />
          <TextField fullWidth size="small" label="Relationship" name="primary_caregiver_relationship" value={form.primary_caregiver_relationship || ''} onChange={handleChange} placeholder="e.g. Daughter, Spouse" inputProps={{ maxLength: 50 }} />
          {/* <TextField fullWidth size="small" label="Phone" name="primary_caregiver_phone" value={form.primary_caregiver_phone || ''} onChange={handleChange} placeholder="9876543210" inputProps={{ maxLength: 20, inputMode: 'tel' }} /> */}
        </Row>
        <Row>
          <TextField fullWidth size="small" label="Decision Maker Name" name="decision_maker_name" value={form.decision_maker_name || ''} onChange={handleChange} placeholder="e.g. Dr. Ashwini" inputProps={{ maxLength: 100 }} />
          <TextField fullWidth size="small" label="Relationship" name="decision_maker_designation" value={form.decision_maker_designation || ''} onChange={handleChange} inputProps={{ maxLength: 50 }} />
          {/* <TextField fullWidth size="small" label="Phone" name="decision_maker_phone" value={form.decision_maker_phone || ''} onChange={handleChange} placeholder="9876543210" inputProps={{ maxLength: 20, inputMode: 'tel' }} /> */}
        </Row>

        <Divider sx={{ my: 2 }} />

        {/* ── Address ── */}
        <SectionTitle>Address</SectionTitle>
        <Row>
          <TextField fullWidth size="small" label="Address Line 1" name="address_line1" value={form.address_line1 || ''} onChange={handleChange} />
          <TextField fullWidth size="small" label="Address Line 2" name="address_line2" value={form.address_line2 || ''} onChange={handleChange} />
        </Row>
        <Row>
          <TextField fullWidth size="small" label="City" name="city" value={form.city || ''} onChange={handleChange} />
          <TextField fullWidth size="small" label="State" name="state" value={form.state || ''} onChange={handleChange} />
          <TextField sx={{ minWidth: 140 }} size="small" label="Postal Code" name="postal_code" value={form.postal_code || ''} onChange={handleChange} />
        </Row>

        <Divider sx={{ my: 2 }} />

        {/* ── Clinical ── */}
        <SectionTitle>Clinical Information</SectionTitle>
        <Row>
          <TextField fullWidth size="small" label="Diagnosis" name="diagnosis" value={form.diagnosis || ''} onChange={handleChange} />
          <TextField fullWidth size="small" label="Referred From" name="referred_from" value={form.referred_from || ''} onChange={handleChange} />
        </Row>
        <Row>
          <TextField fullWidth size="small" select label="Patient Category" name="patient_category" value={form.patient_category || ''} onChange={handleChange}>
            {CATEGORY_OPTIONS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" select label="Patient Priority" name="clinical_complexity" value={form.clinical_complexity || ''} onChange={handleChange} helperText={form.latest_pps_score != null ? `Auto-updates from PPS (currently ${form.latest_pps_score}%). Editable as override.` : 'Auto-updates when a PPS score is recorded. Editable as override.'}>
            <MenuItem value="">Not Set</MenuItem>
            {COMPLEXITY_OPTIONS.map(c => <MenuItem key={c} value={c}>{c === 'not_yet_determined' ? 'Not Yet Determined' : c.charAt(0).toUpperCase() + c.slice(1)}</MenuItem>)}
          </TextField>
        </Row>

        <Divider sx={{ my: 2 }} />

        {/* ── Patient Status (§3, 2026-04-14) ── */}
        <SectionTitle>Patient Status</SectionTitle>
        {form.is_deceased ? (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'grey.100', borderRadius: 1, mb: 2, flexWrap: 'wrap' }}>
            <LocalFlorist sx={{ color: 'grey.700' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Marked as Deceased</Typography>
              <Typography variant="caption" color="text.secondary">
                {form.date_of_death ? `Date of death: ${form.date_of_death}` : 'Date of death not set'}
                {form.place_of_death ? ` · Place: ${form.place_of_death}` : ''}
              </Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => setDeathDialogOpen(true)} sx={{ textTransform: 'none' }}>
              Edit Death Record
            </Button>
          </Box>
        ) : (
          <Row>
            <TextField
              sx={{ minWidth: 220 }} size="small" select
              label="Care Status"
              name="care_status"
              value={form.care_status || 'active'}
              onChange={handleChange}
              helperText="Active = currently receiving home care. Inactive = registered but not receiving care."
            >
              <MenuItem value="active">Alive &amp; Active</MenuItem>
              <MenuItem value="inactive">Alive &amp; Inactive</MenuItem>
            </TextField>

            <FormControlLabel
              control={
                <Switch
                  checked={form.is_contacted}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm(p => ({
                      ...p,
                      is_contacted: checked,
                      care_status: checked ? (p.home_care_decline_reason === 'Not contacted' ? 'active' : p.care_status) : 'inactive',
                      home_care_decline_reason: checked ? (p.home_care_decline_reason === 'Not contacted' ? '' : p.home_care_decline_reason) : 'Not contacted',
                    }));
                  }}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Contacted
                </Typography>
              }
            />

            {form.care_status === 'inactive' && (
              <TextField
                sx={{ minWidth: 220 }}
                size="small"
                select
                label="Decline Reason"
                name="home_care_decline_reason"
                value={form.home_care_decline_reason || ''}
                onChange={handleChange}
              >
                <MenuItem value="Not contacted">Not contacted</MenuItem>
                <MenuItem value="Doesn't want homecare">Doesn't want homecare</MenuItem>
                <MenuItem value="Patient unavailable">Patient unavailable</MenuItem>
                <MenuItem value="Admitted in hospital">Admitted in hospital</MenuItem>
                <MenuItem value="Shifted to hospice">Shifted to hospice</MenuItem>
                <MenuItem value="Other reasons">Other reasons</MenuItem>
              </TextField>
            )}

            <Button
              variant="outlined"
              color="error"
              startIcon={<LocalFlorist />}
              onClick={() => setDeathDialogOpen(true)}
              sx={{ textTransform: 'none', height: 40 }}
            >
              Mark as Deceased
            </Button>
          </Row>
        )}

        <Divider sx={{ my: 2 }} />

        {/* ── Location & GPS Coordinates ── */}
        <SectionTitle>Location &amp; Coordinates</SectionTitle>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={locLoading ? <CircularProgress size={16} color="inherit" /> : <MyLocation />}
              onClick={handleGetLocation}
              disabled={locLoading}
              sx={{ textTransform: 'none' }}
            >
              {locLoading ? 'Getting...' : 'Use Current Location'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<MapIcon />}
              onClick={() => setShowMap(!showMap)}
              sx={{ textTransform: 'none' }}
            >
              {showMap ? 'Hide Map' : 'Pick on Map'}
            </Button>
          </Box>

          {hasLocation && (
            <Alert severity="success" sx={{ mb: 1.5, py: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Coordinates: {form.latitude}, {form.longitude}
                </Typography>
                <Chip label="Captured" size="small" color="success" sx={{ height: 20, fontSize: 11 }} />
              </Box>
            </Alert>
          )}

          {showMap && (
            <Box sx={{ mb: 2 }}>
              <MapPicker
                latitude={form.latitude ? parseFloat(form.latitude) : null}
                longitude={form.longitude ? parseFloat(form.longitude) : null}
                height={350}
                onChange={(lat, lng) => {
                  setForm(prev => ({
                    ...prev,
                    latitude: String(lat),
                    longitude: String(lng),
                  }));
                  applyZoneFromLatLng(lat, lng);
                }}
                onAddressResolved={handleAddressResolved}
              />
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, textAlign: 'center', color: 'text.secondary' }}>
                Drag the map or search above to move the pin to the patient's location
              </Typography>
            </Box>
          )}

          <Row>
            <TextField
              fullWidth size="small"
              label="Latitude"
              name="latitude"
              value={form.latitude || ''}
              onChange={handleChange}
              placeholder="12.9716"
              type="number"
              inputProps={{ step: 'any' }}
            />
            <TextField
              fullWidth size="small"
              label="Longitude"
              name="longitude"
              value={form.longitude || ''}
              onChange={handleChange}
              placeholder="77.5946"
              type="number"
              inputProps={{ step: 'any' }}
            />
          </Row>
        </Box>

        <Row>
          <FormControlLabel
            control={<Switch checked={form.is_bangalore_resident || false} onChange={(e) => setForm(p => ({
              ...p,
              is_bangalore_resident: e.target.checked,
              geographic_cluster: e.target.checked ? p.geographic_cluster : '',
              linked_hospital: e.target.checked ? (p.linked_hospital || 'KMIO') : '',
            }))} />}
            label="Bangalore Resident"
          />
          {form.is_bangalore_resident && (
            <>
              <TextField sx={{ minWidth: 180 }} size="small" select label="Bangalore Zone" name="geographic_cluster" value={form.geographic_cluster || ''} onChange={handleChange}>
                {ZONE_OPTIONS.map(z => <MenuItem key={z} value={z}>{z}</MenuItem>)}
              </TextField>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', minWidth: 260 }}>
                <TextField fullWidth size="small" select label="Linked Hospital" name="linked_hospital" value={form.linked_hospital || ''} onChange={handleChange} helperText="Drives the Homecare Code prefix">
                  {hospitalOptions.map(h => (
                    <MenuItem key={h.code} value={h.code}>{h.name} ({h.code})</MenuItem>
                  ))}
                </TextField>
                <Tooltip title="Add new hospital" arrow>
                  <IconButton size="small" onClick={() => setShowAddHospital(!showAddHospital)} sx={{ mt: 0.5 }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </>
          )}
        </Row>
        {form.is_bangalore_resident && showAddHospital && (
          <Box sx={{
            mt: -1, mb: 2, p: 1.5, borderRadius: 1,
            border: '1px solid', borderColor: 'divider',
            bgcolor: 'background.default',
            display: 'flex', flexDirection: 'column', gap: 1,
          }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Add new hospital
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                label="Code"
                placeholder="e.g. MSR"
                value={newHospital.code}
                onChange={(e) => {
                  const code = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                  setNewHospital(prev => ({
                    ...prev,
                    code,
                    homecare_prefix: prefixUserEdited ? prev.homecare_prefix : (code ? `KAGBA${code}` : ''),
                  }));
                }}
                sx={{ width: 120 }}
                inputProps={{ maxLength: 10, style: { fontFamily: 'monospace' } }}
              />
              <TextField
                size="small" fullWidth
                label="Name"
                placeholder="e.g. M.S. Ramaiah Memorial"
                value={newHospital.name}
                onChange={(e) => setNewHospital(prev => ({ ...prev, name: e.target.value }))}
              />
            </Box>
            <TextField
              size="small" fullWidth
              label="Homecare Prefix"
              helperText="Auto-derived as KAGBA + code. Edit if needed."
              value={newHospital.homecare_prefix}
              onChange={(e) => {
                setPrefixUserEdited(true);
                setNewHospital(prev => ({ ...prev, homecare_prefix: e.target.value.toUpperCase() }));
              }}
              inputProps={{ maxLength: 20, style: { fontFamily: 'monospace' } }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small" variant="text"
                onClick={() => {
                  setShowAddHospital(false);
                  setNewHospital({ code: '', name: '', homecare_prefix: '' });
                  setPrefixUserEdited(false);
                }}
                sx={{ textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                size="small" variant="contained"
                onClick={handleAddHospital}
                disabled={!newHospital.code || !newHospital.name}
                sx={{ textTransform: 'none', minWidth: 70 }}
              >
                Add
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Actions ── */}
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={() => navigate(`/patients/${id}`)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />} onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', px: 4 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>

      {/* Mark Deceased dialog — shared across card header + follow-up + admin edit */}
      <MarkDeceasedDialog
        patient={patient}
        open={deathDialogOpen}
        onClose={() => setDeathDialogOpen(false)}
        onSaved={() => { loadPatient(); }}
      />
    </Container>
  );
};

export default PatientEdit;
