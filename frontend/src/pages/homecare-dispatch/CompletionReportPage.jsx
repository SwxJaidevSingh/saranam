/** Daily Dispatch Completion Report — execution metrics per date, CSV/PDF export, vehicle run details. */
import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, CircularProgress, FormControl, InputLabel,
  LinearProgress, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';

const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).replace(', ', ' - ');
const STATUS = { completed: '🟢 Completed', failed: '🔴 Unavailable', active: '🚛 Active Run' };
const visitBadge = (s) => {
  const vt = String(s.visit_type || (s.patient_type_at_visit === 'new' ? 'initial' : 'follow_up')).toLowerCase();
  return vt === 'bereavement' ? '🕊️ Bereavement' : vt === 'initial' ? '🆕 Initial' : '🟢 Follow-up';
};

export default function CompletionReportPage() {
  const [dates, setDates] = useState(null);
  const [selected, setSelected] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    homecareDispatchApi.getReportDates()
      .then(d => { setDates(d); if (d.length) setSelected(d[0]); })
      .catch(err => setError(`Failed to fetch reports from the database: ${apiError(err)}`));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setReport(null);
    homecareDispatchApi.getReport(selected)
      .then(setReport)
      .catch(err => setError(`Error fetching completion report: ${apiError(err)}`));
  }, [selected]);

  const download = async (format) => {
    try {
      setDownloading(format);
      await homecareDispatchApi.downloadReport(selected, format);
    } catch (err) {
      setError(`Download failed: ${apiError(err)}`);
    } finally {
      setDownloading(null);
    }
  };

  const m = report?.metrics;

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>📊 Daily Dispatch Completion Report</Typography>
        <Typography variant="body2" color="text.secondary">Monitor daily execution metrics, completion rates, and patient visit details.</Typography>
      </div>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {!dates && !error && <Box className="flex justify-center p-10"><CircularProgress /></Box>}
      {dates && dates.length === 0 && (
        <Alert severity="warning">⚠️ No scheduling reports found. Generate and run daily schedules on the Scheduling Board first!</Alert>
      )}

      {dates && dates.length > 0 && (
        <>
          <FormControl size="small" sx={{ minWidth: 320 }}>
            <InputLabel>Select Run Date</InputLabel>
            <Select label="Select Run Date" value={selected} onChange={e => setSelected(e.target.value)}>
              {dates.map(d => <MenuItem key={d} value={d}>{formatDate(d)}</MenuItem>)}
            </Select>
          </FormControl>

          {!report && !error && <Box className="flex justify-center p-6"><CircularProgress size={28} /></Box>}
          {report && m.total_patients === 0 && <Alert severity="info">No schedule runs found for this date.</Alert>}

          {report && m.total_patients > 0 && (
            <>
              <Paper className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  ['Scheduled Patients', m.total_patients, `Init: ${m.initial_count} | F/U: ${m.followup_count} | 🕊️ Bereav: ${m.bereavement_count}`],
                  ['Completed Visits', m.completed, `Init: ${m.completed_initial} | F/U: ${m.completed_followup} | 🕊️ Bereav: ${m.completed_bereavement}`],
                  ['Unavailable / Absent', m.failed, `Init: ${m.failed_initial} | F/U: ${m.failed_followup} | 🕊️ Bereav: ${m.failed_bereavement}`],
                  ['Active Vehicles', m.total_vehicles, null],
                  ['Completion Rate', `${m.completion_rate.toFixed(1)}%`, null],
                ].map(([l, v, cap]) => (
                  <div key={l}>
                    <Typography variant="caption" color="text.secondary">{l}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{v}</Typography>
                    {cap && <Typography variant="caption" color="text.secondary">{cap}</Typography>}
                  </div>
                ))}
              </Paper>

              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>📥 Export Reports</Typography>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outlined" disabled={!!downloading} onClick={() => download('csv')}>📥 Download CSV Report</Button>
                  <Button variant="outlined" disabled={!!downloading} onClick={() => download('pdf')}
                    title="Download official daily dispatch & completion report in PDF format.">📄 Download PDF Report</Button>
                </div>
              </div>

              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>🚛 Vehicle Runs Detail</Typography>
              {report.vehicles.map(v => {
                const total = v.completed + v.failed + v.pending;
                const pct = total ? (v.completed / total) * 100 : 0;
                const rt = v.round_trip_short_url || v.round_trip_url;
                const ow = v.one_way_short_url || v.one_way_url;
                return (
                  <Accordion key={v.name} defaultExpanded disableGutters>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography><strong>{v.name} ({v.reg})</strong> — {v.completed}/{total} Visits Completed ({pct.toFixed(0)}%)</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="space-y-3">
                      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
                      {(rt || ow) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {rt && <div><Button fullWidth variant="outlined" href={v.round_trip_url || rt} target="_blank" rel="noreferrer">🗺️ Open Round-Trip Route</Button><Typography variant="caption">Short link: <code>{rt}</code></Typography></div>}
                          {ow && <div><Button fullWidth variant="outlined" href={v.one_way_url || ow} target="_blank" rel="noreferrer">🏁 Open One-Way Route</Button><Typography variant="caption">Short link: <code>{ow}</code></Typography></div>}
                        </div>
                      )}
                      <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>{['Stop', 'Patient', 'UHID', 'Zone', 'Priority', 'Visit Type', 'Status', 'Travel Info'].map(h => <TableCell key={h} sx={{ fontWeight: 600 }}>{h}</TableCell>)}</TableRow>
                          </TableHead>
                          <TableBody>
                            {v.slots.map(s => (
                              <TableRow key={s.id}>
                                <TableCell><strong>#{s.slot_order}</strong></TableCell>
                                <TableCell>{s.patient_name}</TableCell>
                                <TableCell><code>{s.patient_uhid || 'N/A'}</code></TableCell>
                                <TableCell>{s.patient_zone}</TableCell>
                                <TableCell>{s.priority_at_visit || 'N/A'}</TableCell>
                                <TableCell>{visitBadge(s)}</TableCell>
                                <TableCell>{STATUS[s.status] || '⏳ Pending'}</TableCell>
                                <TableCell>{s.drive_distance_km != null ? `+${s.drive_distance_km.toFixed(2)} km (+${Number(s.drive_duration_min || 0).toFixed(0)}m)` : 'Start/Depot'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </>
          )}
        </>
      )}
    </Box>
  );
}
