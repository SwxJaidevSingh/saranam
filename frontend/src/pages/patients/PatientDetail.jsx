/**
 * PatientDetail Page — Saranam Clinical Dashboard
 * Tabbed view: Overview | Visits | Trends | Contacts
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Box, Typography, Paper, Chip, CircularProgress,
  Alert, Button, Tabs, Tab, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Checkbox,
} from '@mui/material';
import { ArrowBack, Edit, Person, CalendarToday, ContentCopy, Refresh, LocalFlorist, Download } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatient } from '../../context/PatientContext';
import { useAuth } from '../../context/AuthContext';
import patientsApi from '../../api/patients';
import { formatUhid } from '../../constants/uhid';
import MarkDeceasedDialog from '../../components/patients/MarkDeceasedDialog';

import OverviewTab from './tabs/OverviewTab';
import VisitsTab from './tabs/VisitsTab';
import VisitDetailView from './tabs/VisitDetailView';
import TrendsTab from './tabs/TrendsTab';
import PastRecordsTab from './tabs/PastRecordsTab';
import saranamApi from '../../api/saranam';
import generateAcuteVisitSheetPDF from '../../utils/generateAcuteVisitSheetPDF';

const PatientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPatient, loading, error } = usePatient();
  const { hasRole } = useAuth();
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [deathDialogOpen, setDeathDialogOpen] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    if (!patient) return;
    setDownloadingTemplate(true);
    try {
      const lastRx = await saranamApi.latestPrescription(patient.id);
      await generateAcuteVisitSheetPDF({ patient, lastRx });
    } catch (err) {
      alert("Failed to download template: " + (err?.message || err));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // UHID regeneration (admin-only)
  const [uhidDialog, setUhidDialog] = useState(false);
  const [uhidReason, setUhidReason] = useState('');
  const [uhidRegenerating, setUhidRegenerating] = useState(false);
  const [uhidCopied, setUhidCopied] = useState(false);

  const isAdmin = hasRole && hasRole('admin');

  const handleCopyUhid = () => {
    if (!patient?.uhid) return;
    try {
      navigator.clipboard.writeText(patient.uhid);
      setUhidCopied(true);
      setTimeout(() => setUhidCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  };

  const handleRegenerateUhid = async () => {
    setUhidRegenerating(true);
    try {
      const res = await patientsApi.regenerateUhid(id, uhidReason);
      if (res?.patient) setPatient(res.patient);
      setUhidDialog(false);
      setUhidReason('');
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to regenerate UHID');
    } finally {
      setUhidRegenerating(false);
    }
  };

  useEffect(() => {
    loadPatient();
  }, [id]);

  const loadPatient = async () => {
    try {
      const data = await getPatient(id);
      setPatient(data);
    } catch (err) {
      console.error('Failed to load patient:', err);
    }
  };

  const age = patient?.age || (patient?.date_of_birth
    ? Math.floor((new Date() - new Date(patient.date_of_birth)) / 31557600000)
    : null);

  if (loading && !patient) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!patient) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Patient not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Back & Download Template Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/patients')}
          sx={{ textTransform: 'none' }}
          size="small"
        >
          Back to Patients
        </Button>
        <Button
          startIcon={downloadingTemplate ? <CircularProgress size={14} color="inherit" /> : <Download />}
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          variant="outlined"
          size="small"
          sx={{ textTransform: 'none' }}
        >
          {downloadingTemplate ? 'Downloading...' : 'Download Acute Visit Sheet'}
        </Button>
      </Box>

      {/* Patient Header Card */}
      <Paper
        sx={(theme) => ({
          p: 2.5,
          mb: 2,
          borderRadius: 2,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(139,92,246,0.06) 100%)'
            : 'linear-gradient(135deg, rgba(14,165,233,0.05) 0%, rgba(139,92,246,0.03) 100%)',
          border: '1px solid',
          borderColor: 'divider',
        })}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '50%',
              bgcolor: 'primary.main', color: 'primary.contrastText',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Person sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {patient.full_name}
                </Typography>
                {patient.homecare_code && (
                  <Tooltip title="Homecare UHID Code" arrow>
                    <Chip
                      label={patient.homecare_code}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        height: 24,
                        bgcolor: 'background.default',
                      }}
                    />
                  </Tooltip>
                )}
                <Tooltip title={patient.uhid ? (uhidCopied ? 'Copied!' : 'Click to copy UHID') : 'No UHID (non-Bangalore patient)'} arrow>
                  <Chip
                    label={`UHID: ${formatUhid(patient.uhid)}`}
                    size="small"
                    color={patient.uhid ? 'primary' : 'default'}
                    variant="outlined"
                    onClick={patient.uhid ? handleCopyUhid : undefined}
                    icon={patient.uhid ? <ContentCopy sx={{ fontSize: 14 }} /> : undefined}
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      height: 24,
                      cursor: patient.uhid ? 'pointer' : 'default',
                    }}
                  />
                </Tooltip>
                {isAdmin && patient.is_bangalore_resident && patient.geographic_cluster && (
                  <Tooltip title="Regenerate UHID (admin only)" arrow>
                    <IconButton size="small" onClick={() => setUhidDialog(true)} sx={{ p: 0.5 }}>
                      <Refresh sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                {patient.gender && (
                  <Typography variant="body2" color="text.secondary">{patient.gender}</Typography>
                )}
                {age && (
                  <Typography variant="body2" color="text.secondary">
                    {patient.gender ? '·' : ''} {age} years
                  </Typography>
                )}
                {patient.contact && (
                  <Typography variant="body2" color="text.secondary">
                    · {patient.contact}
                  </Typography>
                )}
                {patient.alternative_phone && (
                  <Typography variant="body2" color="text.secondary">
                    · Alt: {patient.alternative_phone}{patient.alternative_phone_name ? ` (${patient.alternative_phone_name})` : ''}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                {/* Three-state patient status chip (§3, 2026-04-14) */}
                {patient.is_deceased ? (
                  <Chip
                    icon={<LocalFlorist sx={{ fontSize: '14px !important' }} />}
                    label={`Deceased${patient.date_of_death ? ` · ${new Date(patient.date_of_death).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`}
                    size="small"
                    sx={{ fontWeight: 700, height: 22, fontSize: '0.7rem', bgcolor: 'grey.800', color: 'common.white' }}
                  />
                ) : patient.care_status === 'inactive' ? (
                  <Chip
                    label={`Alive & Inactive${patient.home_care_decline_reason ? ` (${patient.home_care_decline_reason})` : ''}`}
                    size="small"
                    sx={{ fontWeight: 700, height: 22, fontSize: '0.7rem', bgcolor: 'grey.300', color: 'grey.900' }}
                  />
                ) : (
                  <Chip
                    label="Alive & Active"
                    size="small"
                    color="success"
                    sx={{ fontWeight: 700, height: 22, fontSize: '0.7rem' }}
                  />
                )}
                <Chip
                  label={patient.bsc_status ? 'BSC' : 'N-BSC'}
                  size="small"
                  color={patient.bsc_status ? 'success' : 'default'}
                  sx={{ fontWeight: 700, height: 22, fontSize: '0.7rem' }}
                />
                {patient.geographic_cluster && (
                  <Chip label={patient.geographic_cluster} size="small" variant="outlined" color="info" sx={{ height: 22, fontSize: '0.7rem' }} />
                )}
                {patient.clinical_complexity && patient.clinical_complexity !== 'not_yet_determined' && (
                  <Chip
                    label={`Priority: ${patient.clinical_complexity.charAt(0).toUpperCase() + patient.clinical_complexity.slice(1)}`}
                    size="small"
                    variant="outlined"
                    color={patient.clinical_complexity === 'high' ? 'error' : patient.clinical_complexity === 'medium' ? 'warning' : 'default'}
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* Mark as Deceased — shown for alive patients; edit mode for deceased */}
            <Tooltip title={patient.is_deceased ? 'Edit death record' : 'Mark as Deceased'}>
              <IconButton onClick={() => setDeathDialogOpen(true)} size="small" color={patient.is_deceased ? 'default' : 'error'}>
                <LocalFlorist />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Patient">
              <IconButton onClick={() => navigate(`/patients/${id}/edit`)} size="small">
                <Edit />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Mark Deceased dialog */}
        <MarkDeceasedDialog
          patient={patient}
          open={deathDialogOpen}
          onClose={() => setDeathDialogOpen(false)}
          onSaved={loadPatient}
        />

      </Paper>

      {/* Regenerate UHID Dialog (admin-only) */}
      <Dialog open={uhidDialog} onClose={() => !uhidRegenerating && setUhidDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Regenerate UHID</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will mint a new UHID using the current year and zone counter. The old UHID
            will be recorded in history and the patient will remain searchable by either ID,
            but the old number is permanently abandoned. This action is logged.
          </Alert>
          <Box sx={{ mb: 1.5, fontSize: '0.875rem' }}>
            <strong>Current UHID:</strong>{' '}
            <span style={{ fontFamily: 'monospace' }}>{formatUhid(patient?.uhid)}</span>
          </Box>
          <Box sx={{ mb: 1.5, fontSize: '0.875rem' }}>
            <strong>Current Zone:</strong> {patient?.geographic_cluster || '—'}
          </Box>
          <TextField
            label="Reason (optional but recommended)"
            placeholder="e.g. wrong zone selected at registration"
            multiline rows={2}
            fullWidth
            value={uhidReason}
            onChange={(e) => setUhidReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUhidDialog(false)} disabled={uhidRegenerating}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRegenerateUhid}
            disabled={uhidRegenerating}
          >
            {uhidRegenerating ? 'Regenerating…' : 'Regenerate UHID'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tabs */}
      <Paper sx={{ mb: 2, borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => { setActiveTab(v); setSelectedVisit(null); }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
          }}
        >
          <Tab label="Overview" />
          <Tab label="Visits" />
          <Tab label="Trends" />
          <Tab label="Past Records" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 1 }}>
        {activeTab === 0 && <OverviewTab patient={patient} onPatientRefresh={loadPatient} />}

        {activeTab === 1 && (
          selectedVisit
            ? <VisitDetailView visit={selectedVisit} onBack={() => { setSelectedVisit(null); loadPatient(); }} patientName={patient?.full_name} patientUhid={patient?.uhid} patientHomecareCode={patient?.homecare_code} />
            : <VisitsTab patientId={id} patient={patient} onPatientRefresh={loadPatient} onVisitSelect={setSelectedVisit} />
        )}

        {activeTab === 2 && <TrendsTab patientId={id} />}

        {activeTab === 3 && <PastRecordsTab patientId={id} patientName={patient?.full_name} />}
      </Box>
    </Container>
  );
};

export default PatientDetail;
