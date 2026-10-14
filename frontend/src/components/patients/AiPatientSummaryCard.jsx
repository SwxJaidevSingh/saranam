/**
 * AI Patient Summary — clinician quick-view chart.
 *
 * Mixes deterministic form data (demographics, raw ESAS/PPS scores, diagnosis,
 * chief complaints, visit table) with three short AI-summarised narrative
 * blocks (nursing, psychosocial, physiotherapy). The AI never invents
 * demographics or scores — those are rendered straight from the DB.
 *
 * Generate / Save / Download PDF actions unchanged in intent; payload shape
 * is `summary_blocks` (object) on the wire, with `summary_text` flattened
 * server-side for back-compat.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Paper, Box, Typography, Button, TextField, CircularProgress, Alert, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Table, TableHead, TableBody, TableRow, TableCell, Divider, Grid,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import saranamApi from '../../api/saranam';
import generatePatientSummaryPDF from '../../utils/generatePatientSummaryPDF';
import { resolveZone } from '../../utils/bodyZones';


const BLOCK_KEYS = ['nursing', 'psychosocial', 'physiotherapy'];
const BLOCK_LABELS = {
  nursing: 'Nursing Assessment',
  psychosocial: 'Psychosocial Assessment',
  physiotherapy: 'Physiotherapy Assessment',
};

const EMPTY_BLOCKS = { nursing: '', psychosocial: '', physiotherapy: '' };

const ESAS_FIELDS = [
  ['pain', 'Pain'],
  ['tiredness', 'Tiredness'],
  ['nausea', 'Nausea'],
  ['depression', 'Depression'],
  ['anxiety', 'Anxiety'],
  ['drowsiness', 'Drowsiness'],
  ['appetite', 'Appetite'],
  ['wellbeing', 'Wellbeing'],
  ['shortness_of_breath', 'Shortness of Breath'],
];


function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age -= 1;
  return age;
}

function buildDiffMessage(stats, keptUserSlugs) {
  const parts = [];
  if (stats.added)   parts.push(`+${stats.added} added`);
  if (stats.removed) parts.push(`−${stats.removed} removed`);
  if (stats.updated) parts.push(`${stats.updated} updated`);
  if (!parts.length && !stats.kept_user) return 'No changes to body map highlights.';
  let msg = parts.length ? `Body map updated: ${parts.join(', ')}.` : 'Body map unchanged.';
  if (stats.kept_user && keptUserSlugs.length) {
    const labels = keptUserSlugs.map(s => resolveZone(s)?.label || s);
    msg += ` Kept your edits on ${labels.join(', ')}.`;
  } else if (stats.kept_user) {
    msg += ` Kept ${stats.kept_user} of your edits.`;
  }
  return msg;
}

function teamMembersToText(members) {
  if (!members) return '—';
  if (Array.isArray(members)) {
    return members
      .map(m => (typeof m === 'string' ? m : (m.name || m.role || '')))
      .filter(Boolean)
      .join(', ') || '—';
  }
  return String(members);
}


// ─── Sub-renderers ────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mt: 2, mb: 1 }}>
      {title}
    </Typography>
  );
}

function FieldRow({ label, value }) {
  return (
    <Grid item xs={12} sm={6}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Grid>
  );
}

function BasicPatientDetails({ patient, registrationDate }) {
  const age = calcAge(patient?.date_of_birth);
  const ageSex = [
    age != null ? `${age}y` : null,
    patient?.gender || null,
  ].filter(Boolean).join(' / ') || '—';

  const phone =
    patient?.phone ||
    patient?.primary_caregiver_phone ||
    patient?.alternative_phone ||
    '—';

  const homecareCode = [patient?.homecare_code, patient?.uhid]
    .filter(Boolean).join(' / ');

  const caregiver = patient?.primary_caregiver_name
    ? `${patient.primary_caregiver_name}${patient.primary_caregiver_relationship ? ` (${patient.primary_caregiver_relationship})` : ''}${patient.primary_caregiver_phone ? ` — ${patient.primary_caregiver_phone}` : ''}`
    : '—';

  return (
    <Grid container spacing={1.5}>
      <FieldRow label="Patient Name"     value={patient?.full_name} />
      <FieldRow label="UHID"             value={patient?.uhid} />
      <FieldRow label="Homecare ID"      value={homecareCode || '—'} />
      <FieldRow label="Age / Sex"        value={ageSex} />
      <FieldRow label="Address"          value={patient?.address} />
      <FieldRow label="Phone Number"     value={phone} />
      <FieldRow label="Primary Caregiver" value={caregiver} />
      <FieldRow label="Date of Registration" value={formatDate(registrationDate)} />
    </Grid>
  );
}

function FunctionalAssessment({ esas, pps }) {
  if (!esas && !pps) {
    return <Typography variant="body2" color="text.secondary">No ESAS or PPS recorded.</Typography>;
  }
  return (
    <Box>
      {esas && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">ESAS-R</Typography>
          <Table size="small" sx={{ mt: 0.5 }}>
            <TableHead>
              <TableRow>
                {ESAS_FIELDS.map(([key, label]) => (
                  <TableCell key={key} sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{label}</TableCell>
                ))}
                <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                {ESAS_FIELDS.map(([key]) => (
                  <TableCell key={key} sx={{ fontSize: '0.8rem' }}>{esas?.[key] ?? '—'}</TableCell>
                ))}
                <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{esas?.total_score ?? '—'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
      {pps && (
        <Box>
          <Typography variant="caption" color="text.secondary">Palliative Performance Status (PPS)</Typography>
          <Grid container spacing={1} sx={{ mt: 0.25 }}>
            <FieldRow label="PPS Score"       value={pps.pps_score != null ? `${pps.pps_score}%` : '—'} />
            <FieldRow label="Ambulation"      value={pps.ambulation} />
            <FieldRow label="Activity Level"  value={pps.activity_level} />
            <FieldRow label="Self-care"       value={pps.self_care} />
            <FieldRow label="Intake"          value={pps.intake} />
            <FieldRow label="Consciousness"   value={pps.consciousness_level} />
          </Grid>
        </Box>
      )}
    </Box>
  );
}

function VisitsTable({ visits, plansByVisit }) {
  if (!visits || visits.length === 0) {
    return <Typography variant="body2" color="text.secondary">No visits recorded.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Date</TableCell>
          <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Team Members</TableCell>
          <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Findings</TableCell>
          <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Interventions</TableCell>
          <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Plan of Care</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {visits.map(v => {
          const plan = plansByVisit?.[v.id];
          return (
            <TableRow key={v.id}>
              <TableCell sx={{ fontSize: '0.78rem' }}>
                {formatDate(v.visit_date)}
                <Typography variant="caption" display="block" color="text.secondary">
                  {v.visit_type === 'initial' ? 'Initial' : `Visit #${v.visit_number}`}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: '0.78rem' }}>{teamMembersToText(v.team_members)}</TableCell>
              <TableCell sx={{ fontSize: '0.78rem', maxWidth: 240 }}>{v.visit_summary || '—'}</TableCell>
              <TableCell sx={{ fontSize: '0.78rem', maxWidth: 240 }}>
                {plan?.intervention_pharmacological || plan?.intervention_non_pharmacological
                  ? [plan.intervention_pharmacological, plan.intervention_non_pharmacological]
                      .filter(Boolean).join(' — ')
                  : (v.advice_pharmacological || v.advice_non_pharmacological || '—')}
              </TableCell>
              <TableCell sx={{ fontSize: '0.78rem', maxWidth: 240 }}>
                {v.follow_up_advice || plan?.intervention_non_pharmacological || '—'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}


// ─── Main card ────────────────────────────────────────────────────────────

export default function AiPatientSummaryCard({ patient, bodyLocations, onBodyLocationsChange }) {
  const [snapshot, setSnapshot] = useState(null);
  const [blocks, setBlocks] = useState(EMPTY_BLOCKS);
  const [savedBlocks, setSavedBlocks] = useState(EMPTY_BLOCKS);
  const [pendingModel, setPendingModel] = useState(null);

  const [initialVisit, setInitialVisit] = useState(null);
  const [doctorRec, setDoctorRec] = useState(null);
  const [esasRec, setEsasRec] = useState(null);
  const [ppsRec, setPpsRec] = useState(null);
  const [visits, setVisits] = useState([]);
  const [plansByVisit, setPlansByVisit] = useState({});

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [diffToast, setDiffToast] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load saved summary + chart data
  useEffect(() => {
    let cancelled = false;
    if (!patient?.id) return undefined;
    setLoading(true);

    (async () => {
      try {
        const [summary, iv, vList] = await Promise.all([
          saranamApi.getPatientSummary(patient.id).catch(() => null),
          saranamApi.getInitialVisit(patient.id).catch(() => null),
          saranamApi.listVisits(patient.id).catch(() => ({ items: [] })),
        ]);

        if (cancelled) return;

        if (summary) {
          setSnapshot(summary);
          const sb = summary.summary_blocks && typeof summary.summary_blocks === 'object'
            ? { ...EMPTY_BLOCKS, ...summary.summary_blocks }
            : EMPTY_BLOCKS;
          // Legacy fallback: if no per-block dict but summary_text exists,
          // surface it in the nursing block so it isn't lost on re-edit.
          if (!summary.summary_blocks && summary.summary_text) {
            sb.nursing = summary.summary_text;
          }
          setBlocks(sb);
          setSavedBlocks(sb);
        } else {
          setSnapshot(null);
          setBlocks(EMPTY_BLOCKS);
          setSavedBlocks(EMPTY_BLOCKS);
        }

        setInitialVisit(iv || null);
        const vItems = Array.isArray(vList) ? vList : (vList?.items || []);
        // Sort by date desc for the table
        const vSorted = [...vItems].sort((a, b) => {
          const ad = a.visit_date || ''; const bd = b.visit_date || '';
          return bd.localeCompare(ad);
        });
        setVisits(vSorted);

        // Pull doctor / esas / pps from initial visit, plus care_plan per visit
        if (iv?.id) {
          const [doc, esas, pps] = await Promise.all([
            saranamApi.getAssessment(iv.id, 'doctor').catch(() => null),
            saranamApi.getAssessment(iv.id, 'esas').catch(() => null),
            saranamApi.getAssessment(iv.id, 'pps').catch(() => null),
          ]);
          if (cancelled) return;
          setDoctorRec(doc || null);
          setEsasRec(esas || null);
          setPpsRec(pps || null);
        }

        // Care plans per visit (best-effort; ignore failures)
        const planEntries = await Promise.all(
          vSorted.map(v =>
            saranamApi.getAssessment(v.id, 'care_plan')
              .then(r => [v.id, r])
              .catch(() => [v.id, null])
          ),
        );
        if (cancelled) return;
        const planMap = {};
        planEntries.forEach(([id, plan]) => { if (plan) planMap[id] = plan; });
        setPlansByVisit(planMap);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.error || 'Failed to load patient chart');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [patient?.id]);

  const hasUnsavedEdits = useMemo(
    () => BLOCK_KEYS.some(k => (blocks[k] || '') !== (savedBlocks[k] || '')),
    [blocks, savedBlocks],
  );

  const handleGenerateRequest = () => {
    if (hasUnsavedEdits) {
      setConfirmOpen(true);
    } else {
      runGenerate();
    }
  };

  const runGenerate = async () => {
    setConfirmOpen(false);
    setGenerating(true); setError(''); setOkMsg('');
    try {
      const res = await saranamApi.generatePatientSummary(patient.id);
      const newBlocks = { ...EMPTY_BLOCKS, ...(res.summary_blocks || {}) };
      setBlocks(newBlocks);
      setPendingModel(res.model || null);

      if (onBodyLocationsChange && Array.isArray(res.body_locations)) {
        const prev = bodyLocations || [];
        const newBySlug = new Map(res.body_locations.map(b => [b.zoneSlug, b]));
        const keptUserSlugs = prev
          .filter(p => p.userEdited && newBySlug.get(p.zoneSlug)?.userEdited)
          .map(p => p.zoneSlug);
        onBodyLocationsChange(res.body_locations);
        if (res.diff_stats) setDiffToast(buildDiffMessage(res.diff_stats, keptUserSlugs));
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to generate patient summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    const hasAnyBlock = BLOCK_KEYS.some(k => (blocks[k] || '').trim());
    if (!hasAnyBlock) {
      setError('Summary is empty — generate or write at least one block first.');
      return;
    }
    setSaving(true); setError(''); setOkMsg('');
    try {
      const saved = await saranamApi.savePatientSummary(patient.id, {
        summary_blocks: blocks,
        body_locations: bodyLocations || [],
        model: pendingModel || snapshot?.model_used || null,
      });
      setSnapshot(saved);
      const sb = saved.summary_blocks && typeof saved.summary_blocks === 'object'
        ? { ...EMPTY_BLOCKS, ...saved.summary_blocks }
        : blocks;
      setSavedBlocks(sb);
      setOkMsg('Saved.');
      setTimeout(() => setOkMsg(''), 2500);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save patient summary');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const hasAnyBlock = BLOCK_KEYS.some(k => (blocks[k] || '').trim());
    if (!snapshot && !hasAnyBlock) {
      setError('Nothing to download — save the summary first.');
      return;
    }
    generatePatientSummaryPDF({
      patient,
      summary: snapshot || {
        summary_blocks: blocks,
        model_used: pendingModel,
        generated_at: new Date().toISOString(),
      },
      chart: {
        diagnosis: doctorRec?.diagnosis,
        chief_complaints: doctorRec?.chief_complaints,
        esas: esasRec,
        pps: ppsRec,
        visits,
        plansByVisit,
        initialVisit,
      },
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            AI Patient Summary
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Clinician quick-view. Demographics, diagnosis, and scores are pulled directly from form data; nursing / psychosocial / physiotherapy blocks are AI-drafted — review before sharing.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button
            size="small"
            variant="contained"
            onClick={handleGenerateRequest}
            disabled={generating || loading}
            startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon fontSize="small" />}
          >
            {generating ? 'Generating...' : 'Generate Patient Summary'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleSave}
            disabled={saving || generating || !BLOCK_KEYS.some(k => (blocks[k] || '').trim())}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleDownload}
            disabled={loading || (!snapshot && !BLOCK_KEYS.some(k => (blocks[k] || '').trim()))}
            startIcon={<DownloadIcon fontSize="small" />}
          >
            Download PDF
          </Button>
        </Box>
      </Box>

      {snapshot && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Last saved {formatWhen(snapshot.generated_at)}
          {snapshot.model_used ? ` • ${snapshot.model_used}` : ''}
        </Typography>
      )}

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {okMsg && <Alert severity="success" sx={{ mb: 1 }}>{okMsg}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <Box>
          <SectionHeader title="Basic Patient Details" />
          <BasicPatientDetails patient={patient} registrationDate={patient?.created_at} />

          <Divider sx={{ my: 2 }} />

          <SectionHeader title="Clinical Details" />
          <Typography variant="caption" color="text.secondary">Diagnosis</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 1.5, whiteSpace: 'pre-wrap' }}>
            {doctorRec?.diagnosis || patient?.diagnosis || '—'}
          </Typography>

          <Typography variant="caption" color="text.secondary">Present Complaints</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>
            {doctorRec?.chief_complaints || '—'}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <SectionHeader title="Functional Assessment (ESAS & Performance Status)" />
          <FunctionalAssessment esas={esasRec} pps={ppsRec} />

          <Divider sx={{ my: 2 }} />

          {BLOCK_KEYS.map(key => (
            <Box key={key} sx={{ mb: 2 }}>
              <SectionHeader title={BLOCK_LABELS[key]} />
              <TextField
                fullWidth multiline minRows={3} size="small"
                placeholder={`Click 'Generate Patient Summary' to draft the ${BLOCK_LABELS[key].toLowerCase()} block. Edit before saving.`}
                value={blocks[key] || ''}
                onChange={(e) => setBlocks(prev => ({ ...prev, [key]: e.target.value }))}
              />
            </Box>
          ))}

          <Divider sx={{ my: 2 }} />

          <SectionHeader title="Homecare Visit Details" />
          <VisitsTable visits={visits} plansByVisit={plansByVisit} />
        </Box>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Regenerate and overwrite your edits?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved edits in one or more narrative blocks. Generating
            will overwrite them with a fresh AI draft. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={runGenerate} variant="contained" color="primary">
            Overwrite & Generate
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!diffToast}
        autoHideDuration={6000}
        onClose={() => setDiffToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setDiffToast('')} severity="info" sx={{ width: '100%' }}>
          {diffToast}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
