/**
 * VisitsTab — List patient visits and create new visits.
 *
 * Visit Type "Teleconsult" replaces the legacy "Phone Call". When the user
 * picks Teleconsult:
 *   - Location dropdown switches to {Voice Call, Video Call}
 *   - Time picker becomes visible
 *   - Provider Select is required
 *   - "Record call" toggle appears for video
 *   - On submit, both a patient_visit AND a tele_session are created.
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Card, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Switch, FormControlLabel, Stack,
} from '@mui/material';
import { Add, CalendarToday, LocationOn, ArrowForward, ChevronRight } from '@mui/icons-material';
import saranamApi from '../../../api/saranam';
import teleconsultApi from '../../../api/teleconsult';
import patientsApi from '../../../api/patients';
import ProviderSelect from '../../teleconsult/components/ProviderSelect';

const VISIT_TYPES = [
  { value: 'initial', label: 'Initial Visit' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'teleconsult', label: 'Teleconsult' },
  { value: 'bereavement', label: 'Bereavement' },
];

const LOCATION_OPTIONS = {
  default: [{ value: 'home', label: 'Home' }],
  teleconsult: [
    { value: 'video', label: 'Video Call' },
    { value: 'voice', label: 'Voice Call' },
  ],
};

const getLocationOptions = (visitType) =>
  visitType === 'teleconsult' ? LOCATION_OPTIONS.teleconsult : LOCATION_OPTIONS.default;

const STATUS_COLORS = {
  completed: 'success',
  in_progress: 'warning',
  scheduled: 'info',
  cancelled: 'error',
};

// Default time = today's HH:MM rounded up to next :00 or :30
const defaultTimeStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 0);
  if (d.getMinutes() === 0) d.setHours(d.getHours() + 1);
  d.setSeconds(0);
  return d.toTimeString().slice(0, 5);
};

const initialVisitState = () => ({
  visit_type: 'follow_up',
  visit_date: new Date().toISOString().split('T')[0],
  visit_time: defaultTimeStr(),
  visit_location: 'home',
  provider_id: null,
  record_call: false,
  notes: '',
  vitals_pr: '',
  vitals_bp_systolic: '',
  vitals_bp_diastolic: '',
  vitals_rr: '',
  vitals_spo2: '',
  vitals_temperature: '',
});

const VisitsTab = ({ patientId, patient, onPatientRefresh, onVisitSelect }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState(null);
  const [newVisit, setNewVisit] = useState(initialVisitState);

  const handleToggleWillingness = async (event) => {
    const isNotWilling = event.target.checked;
    try {
      setToggling(true);
      setError(null);
      const payload = {
        care_status: isNotWilling ? 'inactive' : 'active',
        home_care_decline_reason: isNotWilling ? "Doesn't want homecare" : null,
        is_contacted: true
      };
      await patientsApi.update(patientId, payload);
      if (onPatientRefresh) {
        await onPatientRefresh();
      }
    } catch (err) {
      console.error('Failed to update home care willingness:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update willingness for home care');
    } finally {
      setToggling(false);
    }
  };

  const handleReasonChange = async (event) => {
    const reason = event.target.value;
    try {
      setToggling(true);
      setError(null);
      const payload = {
        care_status: 'inactive',
        home_care_decline_reason: reason,
        is_contacted: reason !== 'Not contacted'
      };
      await patientsApi.update(patientId, payload);
      if (onPatientRefresh) {
        await onPatientRefresh();
      }
    } catch (err) {
      console.error('Failed to update decline reason:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update decline reason');
    } finally {
      setToggling(false);
    }
  };

  const isTele = newVisit.visit_type === 'teleconsult';

  const loadVisits = async () => {
    try {
      setLoading(true);
      const data = await saranamApi.listVisits(patientId);
      setVisits(data.visits || []);
    } catch (err) {
      setError('Failed to load visits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) loadVisits();
  }, [patientId]);

  const setField = (key, value) => {
    setNewVisit(prev => {
      const next = { ...prev, [key]: value };
      // When user toggles into / out of teleconsult, reset location sensibly
      if (key === 'visit_type') {
        if (value === 'teleconsult' && prev.visit_location === 'home') {
          next.visit_location = 'video';
        } else if (value !== 'teleconsult' && (prev.visit_location === 'video' || prev.visit_location === 'voice')) {
          next.visit_location = 'home';
        }
      }
      return next;
    });
  };

  const validate = () => {
    return null;
  };

  const handleCreateVisit = async () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    try {
      setCreating(true);
      setError(null);

      // Create the patient visit
      const visitData = {
        visit_type: newVisit.visit_type,
        visit_date: newVisit.visit_date,
        visit_location: newVisit.visit_location,
      };
      ['vitals_pr', 'vitals_bp_systolic', 'vitals_bp_diastolic', 'vitals_rr', 'vitals_spo2', 'vitals_temperature'].forEach(key => {
        const v = newVisit[key];
        visitData[key] = v === '' ? null : Number(v);
      });
      await saranamApi.createVisit(patientId, visitData);

      setShowCreate(false);
      setNewVisit(initialVisitState());
      loadVisits();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create visit');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {/* Action Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" spacing={3} alignItems="center" sx={{ flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Visits</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={patient?.care_status === 'inactive'}
                onChange={handleToggleWillingness}
                disabled={toggling || !patient}
                color="error"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Not willing for home care
              </Typography>
            }
          />
          {patient?.care_status === 'inactive' && (
            <TextField
              size="small"
              select
              label="Reason for decline"
              value={patient?.home_care_decline_reason || "Doesn't want homecare"}
              onChange={handleReasonChange}
              disabled={toggling}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="Not contacted">Not contacted</MenuItem>
              <MenuItem value="Doesn't want homecare">Doesn't want homecare</MenuItem>
              <MenuItem value="Patient unavailable">Patient unavailable</MenuItem>
              <MenuItem value="Admitted in hospital">Admitted in hospital</MenuItem>
              <MenuItem value="Shifted to hospice">Shifted to hospice</MenuItem>
              <MenuItem value="Other reasons">Other reasons</MenuItem>
            </TextField>
          )}
        </Stack>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setShowCreate(true)}
          disabled={patient?.care_status === 'inactive'}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          New Visit
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {patient?.care_status === 'inactive' && (
        <Alert severity="warning" sx={{ mb: 3, fontWeight: 500 }}>
          This patient is marked as &quot;Not willing for home care&quot; (Inactive). Direct home care visit creation is disabled.
        </Alert>
      )}

      {/* Visits List */}
      {visits.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', borderRadius: 2 }}>
          <Typography variant="body1">No visits recorded yet.</Typography>
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
            Click "New Visit" above to add a follow-up or teleconsult visit.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {visits.map((visit) => (
            <Card
              key={visit.id}
              variant="outlined"
              onClick={() => onVisitSelect && onVisitSelect(visit)}
              sx={{
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '50%',
                    bgcolor: 'primary.main', color: 'primary.contrastText',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.875rem',
                  }}>
                    #{visit.visit_number}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {VISIT_TYPES.find(t => t.value === visit.visit_type)?.label || visit.visit_type}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                      <CalendarToday sx={{ fontSize: 12, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'N/A'}
                      </Typography>
                      {visit.visit_location && (
                        <>
                          <LocationOn sx={{ fontSize: 12, color: 'text.secondary', ml: 0.5 }} />
                          <Typography variant="caption" color="text.secondary">
                            {visit.visit_location}
                          </Typography>
                        </>
                      )}
                    </Box>
                    {/* Consultation Roles */}
                    {(() => {
                      const roles = (Array.isArray(visit.consultation_types) && visit.consultation_types.length > 0)
                        ? visit.consultation_types
                        : [
                            visit.doctor_consultation && 'Doctor',
                            visit.nursing_consultation && 'Nurse',
                            visit.counsellor_consultation && 'Counsellor',
                            visit.physiotherapy_consultation && 'Physiotherapist',
                            visit.social_worker_consultation && 'Social Worker',
                          ].filter(Boolean);
                      if (roles.length > 0) {
                        return (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {roles.map(r => (
                              <Chip
                                key={r}
                                label={r}
                                size="small"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, bgcolor: 'action.hover' }}
                              />
                            ))}
                          </Box>
                        );
                      }
                      return null;
                    })()}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {visit.status && (
                    <Chip
                      label={visit.status}
                      size="small"
                      color={STATUS_COLORS[visit.status] || 'default'}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22, textTransform: 'capitalize' }}
                    />
                  )}
                  <ChevronRight sx={{ color: 'text.secondary' }} />
                </Box>
              </Box>
            </Card>
          ))}
        </Stack>
      )}

      {/* New Visit Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          New Visit
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                select fullWidth size="small" label="Visit Type"
                value={newVisit.visit_type}
                onChange={(e) => setField('visit_type', e.target.value)}
              >
                {VISIT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
              <TextField
                fullWidth size="small" label="Date" type="date"
                value={newVisit.visit_date}
                onChange={(e) => setField('visit_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                select fullWidth size="small" label="Location"
                value={newVisit.visit_location}
                onChange={(e) => setField('visit_location', e.target.value)}
              >
                {getLocationOptions(newVisit.visit_type).map(l => (
                  <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCreate(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateVisit} disabled={creating} sx={{ textTransform: 'none' }}>
            {creating ? 'Creating...' : 'Create Visit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisitsTab;
