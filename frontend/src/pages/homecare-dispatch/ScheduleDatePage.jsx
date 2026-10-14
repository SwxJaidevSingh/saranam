/**
 * Daily Dispatch Dashboard for one date.
 *
 * Unlocked: Planning Board, Reshuffle Patients, Lock & Optimize — all editing one
 * shared draft. Locked: Finalized Details, Dispatch Console, Route Map.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';
import { draftFromSavedSlot, deceasedInDraft, formatRemaining } from '../../components/homecare-dispatch/draft';
import PlanningBoardTab from '../../components/homecare-dispatch/PlanningBoardTab';
import ReshuffleTab from '../../components/homecare-dispatch/ReshuffleTab';
import LockOptimizeTab from '../../components/homecare-dispatch/LockOptimizeTab';
import FinalizedDetailsTab from '../../components/homecare-dispatch/FinalizedDetailsTab';
import DispatchConsoleTab from '../../components/homecare-dispatch/DispatchConsoleTab';
import RouteMapTab from '../../components/homecare-dispatch/RouteMapTab';

const PLANNING_TABS = [['plan', '🏗️ Planning Board'], ['shuffle', '🔄 Reshuffle Patients'], ['lock', '⚡ Lock & Optimize']];
const LOCKED_TABS = [['details', '📋 Finalized Details'], ['dispatch', '🗺️ Dispatch Console'], ['map', '🗺️ Route Map']];

export default function ScheduleDatePage() {
  const { date: dateStr } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [schedule, setSchedule] = useState(null);
  const [candidates, setCandidates] = useState({ patients: [], deceased_patients: [] });
  const [draft, setDraft] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(location.state?.created ? `Schedule initialized for ${dateStr}!` : null);
  const [warning, setWarning] = useState(null);
  const [planningTab, setPlanningTab] = useState('plan');
  const [lockedTab, setLockedTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [overwrite, setOverwrite] = useState(null); // { dbCount, successMessage }
  const [loadedAt, setLoadedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setError(null);
      const [sched, cands] = await Promise.all([
        homecareDispatchApi.getSchedule(dateStr),
        homecareDispatchApi.getCandidates(dateStr),
      ]);
      setSchedule(sched);
      setCandidates(cands);
      setDraft(sched.slots.map(s => draftFromSavedSlot(s, sched.config)));
      setLoadedAt(Date.now());
    } catch (err) {
      setError(`Error loading resources: ${apiError(err)}`);
    }
  }, [dateStr]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg, kind = 'success') => {
    if (kind === 'success') { setSuccess(msg); setWarning(null); } else { setWarning(msg); setSuccess(null); }
  };

  // Draft reservation countdown; reload when it runs out so the server releases the patients.
  const draftState = schedule?.draft;
  const remaining = draftState?.draft_remaining_seconds != null
    ? draftState.draft_remaining_seconds - (now - loadedAt) / 1000 : null;
  useEffect(() => {
    if (draftState?.draft_remaining_seconds == null) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [draftState]);
  useEffect(() => { if (remaining != null && remaining <= 0) load(); }, [remaining, load]);

  const saveDraft = async (successMessage, { force = false } = {}) => {
    try {
      setSaving(true);
      await homecareDispatchApi.saveDraft(dateStr, draft, {
        loadedSlotCount: schedule.loaded_slot_count,
        loadedMaxUpdated: schedule.loaded_max_updated,
        force,
      });
      setOverwrite(null);
      flash(successMessage);
      await load();
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.code === 'concurrent_edit') {
        setOverwrite({ dbCount: err.response.data.db_count, successMessage });
      } else {
        setError(`Error saving schedule: ${apiError(err)}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    try {
      const res = await homecareDispatchApi.deleteDraft(dateStr);
      flash(res.message);
      await load();
    } catch (err) {
      setError(`Error deleting draft: ${apiError(err)}`);
    }
  };

  const deceasedById = useMemo(() => new Map(candidates.deceased_patients.map(p => [String(p.id), p])), [candidates]);
  const deceased = useMemo(
    () => (schedule ? deceasedInDraft(schedule.slots, draft, deceasedById) : []),
    [schedule, draft, deceasedById],
  );

  if (!schedule) {
    return (
      <Box className="p-6 max-w-7xl mx-auto space-y-4">
        <Button variant="outlined" onClick={() => navigate('/homecare-dispatch/schedules')}>⬅️ Back to Overview</Button>
        {error ? <Alert severity="error">{error}</Alert> : <Box className="flex justify-center p-10"><CircularProgress /></Box>}
      </Box>
    );
  }

  const { is_locked: isLocked, is_past_date: isPast, has_vehicle_log: hasLog, is_disabled: isDisabled, slots } = schedule;
  const completedCount = slots.filter(s => s.status === 'completed').length;
  const expiryDisplay = draftState.expiry_display;
  const remainingStr = remaining != null ? formatRemaining(remaining, draftState.is_capped_by_midnight) : draftState.draft_remaining_str;
  const statusLabel = !isLocked && slots.length && !isDisabled
    ? `📝 Pending Draft (Expires in ~${remainingStr} if not locked)` : schedule.status_label;
  const deadNames = deceased.map(d => `${d.name} (UHID: ${d.uhid || 'N/A'})`).join(', ');

  const common = {
    dateStr, schedule, candidates, draft, setDraft, deceased, isDisabled, saving,
    onError: setError, onFlash: flash, reload: load,
  };

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <Button variant="outlined" onClick={() => navigate('/homecare-dispatch/schedules')}>⬅️ Back to Overview</Button>

      {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
      {warning && <Alert severity="warning" onClose={() => setWarning(null)}>{warning}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Paper className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>🏥 Daily Dispatch Dashboard: {dateStr}</Typography>
          <Typography variant="body2" color="text.secondary"><strong>Current Status:</strong> {statusLabel}</Typography>
        </div>
        <div className="text-right">
          <Typography variant="caption" color="text.secondary">Assigned Patients</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{slots.length}</Typography>
          {isLocked && <Typography variant="caption" color="success.main">↑ {completedCount} completed</Typography>}
        </div>
      </Paper>

      {hasLog ? (
        <Alert severity="success"><strong>Schedule Completed</strong>: Daily vehicle log has been recorded for {dateStr}. All runs are completed and finalized.</Alert>
      ) : draftState.is_date_surpassed_expired ? (
        <Alert severity="error"><strong>⏱️ Draft Expired (Schedule Date Surpassed)</strong>: The schedule date for this draft ({dateStr}) has passed without being locked. All unfinalized patient reservations have been automatically released back to the candidate pool.</Alert>
      ) : draftState.is_draft_expired ? (
        <Alert severity="error"><strong>⏱️ Draft Expired</strong>: The draft reservation for {dateStr} exceeded the {expiryDisplay} inactivity limit and was automatically purged. Patient reservations have been released.</Alert>
      ) : isPast ? (
        <Alert severity="info">
          {isLocked
            ? <><strong>Schedule Closed</strong>: {dateStr} has passed. In accordance with the configured Locked Schedule Expiry ({schedule.locked_expiry_display}), uncompleted patient reservations have been released back to the candidate pool while visit records remain safely preserved in the database.</>
            : <><strong>Schedule Closed</strong>: {dateStr} has already passed. Historical records are read-only and cannot be modified.</>}
        </Alert>
      ) : !isLocked && slots.length > 0 ? (
        <Alert
          severity="warning"
          action={<Button color="inherit" size="small" onClick={deleteDraft} disabled={isDisabled}>🗑️ Delete Draft</Button>}
        >
          {draftState.is_capped_by_midnight
            ? <><strong>⏱️ Draft Schedule Active</strong>: This draft is reserved. <strong>Important</strong>: Schedule date ends at midnight (~{remainingStr}). Updating this draft will not extend its validity past midnight.</>
            : <><strong>⏱️ Draft Schedule Active</strong>: This draft is reserved. It will automatically expire in <strong>~{remainingStr}</strong> (limit: {expiryDisplay}) if not locked.</>}
        </Alert>
      ) : null}

      {deceased.length > 0 && (
        <Alert severity="error">
          {isLocked
            ? <><strong>🚨 Deceased Patient Notice (Locked Run)</strong>: Patient {deadNames} is marked as <strong>deceased</strong> in the database! In the <strong>Dispatch Console</strong> tab below, you can swap them with an available candidate or mark their visit as Failed/Absent.</>
            : <><strong>⚠️ Deceased Patient Warning</strong>: Patient {deadNames} has been marked as <strong>deceased</strong> in the database but is assigned in this draft schedule! Please remove them before finalizing or locking.</>}
        </Alert>
      )}

      {overwrite && (
        <Alert
          severity="warning"
          action={(
            <div className="flex gap-2">
              <Button color="inherit" size="small" variant="outlined" disabled={saving}
                onClick={() => saveDraft(overwrite.successMessage, { force: true })}>⚠️ Confirm & Overwrite Schedule</Button>
              <Button color="inherit" size="small" onClick={() => setOverwrite(null)}>❌ Cancel</Button>
            </div>
          )}
        >
          <strong>Overwrite Warning</strong>: A schedule already exists for <strong>{dateStr}</strong> with <strong>{overwrite.dbCount} patient(s)</strong>. Saving these changes will <strong>overwrite</strong> the existing schedule in the database. Are you sure you want to proceed?
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {(isLocked ? LOCKED_TABS : PLANNING_TABS).map(([key, label]) => {
          const active = (isLocked ? lockedTab : planningTab) === key;
          return (
            <Button key={key} variant={active ? 'contained' : 'outlined'} sx={{ textTransform: 'none' }}
              onClick={() => (isLocked ? setLockedTab(key) : setPlanningTab(key))}>
              {label}
            </Button>
          );
        })}
      </div>

      {!isLocked && planningTab === 'plan' && (
        <PlanningBoardTab {...common} onSave={() => saveDraft(`Draft schedule changes saved successfully! (${expiryDisplay} draft reservation active)`)} onDeleteDraft={deleteDraft} />
      )}
      {!isLocked && planningTab === 'shuffle' && (
        <ReshuffleTab {...common} onSave={() => saveDraft(`Reshuffled schedule changes saved successfully! (${expiryDisplay} draft reservation active)`)} />
      )}
      {!isLocked && planningTab === 'lock' && (
        <LockOptimizeTab {...common} onSave={() => saveDraft('Schedule changes saved successfully! (Now ready to lock)')} />
      )}
      {isLocked && lockedTab === 'details' && <FinalizedDetailsTab {...common} />}
      {isLocked && lockedTab === 'dispatch' && <DispatchConsoleTab {...common} />}
      {isLocked && lockedTab === 'map' && <RouteMapTab {...common} />}
    </Box>
  );
}
