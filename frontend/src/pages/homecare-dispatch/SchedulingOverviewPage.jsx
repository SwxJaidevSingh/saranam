/**
 * Scheduling Board — monthly overview of dispatch dates. Create a date (today or
 * later, no duplicates) or open an existing one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, FormControl,
  InputLabel, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUS_DISPLAY = {
  completed: { label: '✅ Completed', color: 'success' },
  closed: { label: '⏹️ Closed (Past)', color: 'default' },
  active: { label: '🔒 Active (Locked)', color: 'info' },
  pending: { label: '📝 Draft (Pending)', color: 'warning' },
};
const PAGE_SIZE = 10;

const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const LIFECYCLE = [
  ['📥 Patient Fetching, Validation & Safety Filtering', 'Only active, living patients with a zone and valid GPS coordinates are candidates. Only visits strictly before the schedule date count, so later completions never change an earlier date\'s scoring.'],
  ['⚡ Dynamic Urgency Score & Gap Calculation', 'Urgency Score = 0.9 × Priority Weight + 0.1 × (Gap Days ÷ SLA Days). Weights: Emergency 150, Urgent 125, High 100, New 75, Medium 50, Low 25. Gap Days counts only the configured homecare weekdays since registration or the last visit.'],
  ['📅 Cross-Date Timeline Booking Guard', 'Active schedules and unexpired drafts on other dates are checked. An earlier booking becomes the patient\'s reference date, and bookings on nearby dates are flagged.'],
  ['🚛 Vehicle Assignment & Pre-population', 'Patients are matched to vehicles by zone. If several vehicles serve a zone, the patient goes to the nearest vehicle\'s existing stops (or its depot).'],
  ['🏗️ Planning Board, Reshuffling & Draft Reservations', 'Review auto-draft suggestions, move patients between vehicles, then save. Saved drafts are held for the configured draft reservation time (capped at midnight of the schedule date); expired drafts are released automatically.'],
  ['🛡️ Pre-Lock Validations & Final Route Lock', 'Unsaved changes, capacity, missing GPS, deceased patients and patients more than 40 km from the depot are flagged. Locking optimizes road routes (round trip or one-way) and cannot be undone.'],
  ['🟢 Live Dispatch Execution & Patient Swaps', 'Share Google Maps links with drivers, mark visits Complete or Failed/Absent, and swap failed or deceased patients with an eligible patient in the same zone.'],
  ['📝 Daily Vehicle Logs & Fleet Analytics', 'When all of a vehicle\'s stops are processed, record the driver, start and end points, odometer and mileage to close the run.'],
];
const MANUAL = [
  ['Step 1: Create or Select a Schedule Date', 'Pick a date from the table, or use Create New Schedule Date for today or an upcoming date.'],
  ['Step 2: Customize Vehicle Runs (Planning Board)', 'Choose a vehicle, check or uncheck patients (or use Auto-Draft Suggestions), then Save Schedule Changes.'],
  ['Step 3: Rebalance & Reshuffle (Optional)', 'Move patients between vehicles on the Reshuffle Patients tab and Save Reshuffle Changes.'],
  ['Step 4: Validate & Lock Itineraries', 'On Lock & Optimize, review the warnings, choose Round Trip or One-Way, then Lock Route & Optimize.'],
  ['Step 5: Live Execution & Dispatch', 'In the Dispatch Console, share route links, mark visits Complete or Fail/Absent, and swap failed or deceased patients.'],
  ['Step 6: Record Daily Vehicle Logs', 'After all stops of a vehicle are processed, fill in the Daily Vehicle Log.'],
];

export default function SchedulingOverviewPage() {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = toIso(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [newDate, setNewDate] = useState(todayStr);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRecords(null);
      const last = new Date(year, month, 0).getDate();
      const mm = String(month).padStart(2, '0');
      setRecords(await homecareDispatchApi.getOverview(`${year}-${mm}-01`, `${year}-${mm}-${String(last).padStart(2, '0')}`));
    } catch (err) {
      setError(`Error loading schedule summaries: ${apiError(err)}`);
    }
  }, [year, month]);

  useEffect(() => { setPage(0); load(); }, [load]);

  const handleCreate = async () => {
    setCreateError(null);
    if (!newDate || newDate < todayStr) {
      setCreateError('⚠️ Cannot create a schedule for a past date. Please select today or a future date.');
      return;
    }
    try {
      setCreating(true);
      if (await homecareDispatchApi.scheduleExists(newDate)) {
        setCreateError(`⚠️ A schedule for ${newDate} already exists! Duplicate schedules are not allowed.`);
        return;
      }
      navigate(`/homecare-dispatch/schedules/${newDate}`, { state: { created: true } });
    } catch (err) {
      setCreateError(`Error checking schedule: ${apiError(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const total = records?.length || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIdx = Math.min(page, totalPages - 1);
  const pageRows = (records || []).slice(pageIdx * PAGE_SIZE, pageIdx * PAGE_SIZE + PAGE_SIZE);

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <Paper className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>📅 Daily Schedule Overview</Typography>
          <Typography variant="body2" color="text.secondary">Monitor, plan, and lock daily dispatch itineraries.</Typography>
        </div>
        <div className="flex gap-3">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Select Year</InputLabel>
            <Select value={year} label="Select Year" onChange={e => setYear(Number(e.target.value))}>
              {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Select Month</InputLabel>
            <Select value={month} label="Select Month" onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
            </Select>
          </FormControl>
        </div>
      </Paper>

      <Alert severity="info">
        <strong>New to the Scheduling Board?</strong> Expand the sections below to view the step-by-step lifecycle of dispatch operations.
      </Alert>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[['📖 View Step-by-Step Scheduling Lifecycle', LIFECYCLE, true], ['📋 View Scheduling User Manual', MANUAL, false]].map(([title, items, numbered]) => (
          <Accordion key={title} disableGutters>
            <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 600 }}>{title}</Typography></AccordionSummary>
            <AccordionDetails className="space-y-2">
              {items.map(([h, body], i) => (
                <div key={h}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{numbered ? `${i + 1}. ` : ''}{h}</Typography>
                  <Typography variant="body2" color="text.secondary">{body}</Typography>
                </div>
              ))}
            </AccordionDetails>
          </Accordion>
        ))}
      </div>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 600 }}>➕ Create New Schedule Date</Typography></AccordionSummary>
        <AccordionDetails>
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <TextField
              type="date"
              size="small"
              label="Select Date for New Schedule"
              value={newDate}
              onChange={e => { setNewDate(e.target.value); setCreateError(null); }}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: todayStr } }}
              helperText="Schedules can only be created for today or future dates."
            />
            <Button variant="contained" onClick={handleCreate} disabled={creating}>Create & Plan Schedule</Button>
          </div>
          {createError && <Alert severity="error" sx={{ mt: 2 }}>{createError}</Alert>}
        </AccordionDetails>
      </Accordion>

      <Paper className="p-4 space-y-3">
        <div>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Select a Schedule Date</Typography>
          <Typography variant="body2" color="text.secondary">Click any row in the table below to open the planning and dispatch controller for that date.</Typography>
        </div>
        {error && <Alert severity="error">{error}</Alert>}
        {!records && !error && <Box className="flex justify-center p-6"><CircularProgress size={28} /></Box>}
        {records && total === 0 && <Alert severity="info">No active schedules found for this month.</Alert>}
        {records && total > 0 && (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assigned Patients</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map(r => {
                    const s = STATUS_DISPLAY[r.status] || { label: r.status, color: 'default' };
                    return (
                      <TableRow key={r.date} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/homecare-dispatch/schedules/${r.date}`)}>
                        <TableCell sx={{ fontWeight: 600 }}>{r.date}</TableCell>
                        <TableCell><Chip size="small" label={s.label} color={s.color} variant="outlined" /></TableCell>
                        <TableCell>{r.patients_count} patients</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <div className="grid grid-cols-3 items-center gap-2">
              <Button variant="outlined" disabled={pageIdx === 0} onClick={() => setPage(pageIdx - 1)}>◀ Previous Page</Button>
              <Typography variant="body2" className="text-center" sx={{ fontWeight: 500 }}>
                Page {pageIdx + 1} of {totalPages} (Total: {total} runs)
              </Typography>
              <Button variant="outlined" disabled={pageIdx >= totalPages - 1} onClick={() => setPage(pageIdx + 1)}>Next Page ▶</Button>
            </div>
          </>
        )}
      </Paper>
    </Box>
  );
}
