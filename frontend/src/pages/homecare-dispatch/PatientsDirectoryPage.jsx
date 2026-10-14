/**
 * Patients Directory — active homecare patients, homecare days since their last
 * visit (or registration) against their priority SLA.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, OutlinedInput,
  Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import homecareDispatchApi, { apiError } from '../../api/homecareDispatch';

const COLUMNS = [
  ['uhid', 'UHID'], ['hospital_uhid', 'Hospital UHID'], ['name', 'Name'], ['phone', 'Phone Number'],
  ['alternative_phone', 'Alternative Phone'], ['caregiver_phone', 'Caregiver Phone'],
  ['decision_maker_phone', 'Decision Maker Phone'], ['priority', 'Priority'], ['zone', 'Zone'],
  ['registration_date', 'Registration Date'], ['last_visit_date', 'Last Visit Date'],
  ['gap_days', 'Gaps (Days)'], ['status', 'Status'], ['sla_days', 'SLA Value'], ['sla_status', 'SLA Status'],
];
const SEARCH_FIELDS = ['name', 'uhid', 'hospital_uhid', 'phone', 'alternative_phone', 'caregiver_phone', 'decision_maker_phone'];

export default function PatientsDirectoryPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [zones, setZones] = useState([]);
  const [status, setStatus] = useState('All');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    homecareDispatchApi.getPatientsDirectory()
      .then(setData)
      .catch(err => setError(`Failed to fetch patient data: ${apiError(err)}`));
  }, []);

  const patients = useMemo(() => data?.patients || [], [data]);
  const allZones = useMemo(() => [...new Set(patients.map(p => p.zone))].sort(), [patients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter(p => {
      if (q && !SEARCH_FIELDS.some(f => String(p[f] ?? '').toLowerCase().includes(q))) return false;
      if (zones.length && !zones.includes(p.zone)) return false;
      if (status !== 'All' && p.status !== status) return false;
      return true;
    });
  }, [patients, search, zones, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);


  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>👥 Patients Directory</Typography>
        <Typography variant="body2" color="text.secondary">
          Browse, search, and monitor patients registered in the homecare network.
        </Typography>
      </div>

      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <Box className="flex justify-center p-10"><CircularProgress /></Box>}
      {data && patients.length === 0 && <Alert severity="info">No active patients found in the database.</Alert>}

      {data && patients.length > 0 && (
        <>
          <Paper className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[['Total Patients', data.summary.total, 'All active patients in the system'],
              ['New Patients', data.summary.new, 'Patients with no completed visit yet'],
              ['Old Patients', data.summary.old, 'Patients with prior visits']].map(([label, value, help]) => (
              <div key={label} title={help}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
              </div>
            ))}
          </Paper>

          <Paper className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
            <TextField
              className="md:col-span-6"
              size="small"
              label="Search Directory"
              placeholder="Search by Name, UHID, Hospital UHID or Phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <FormControl size="small" className="md:col-span-3">
              <InputLabel>Zone Filter</InputLabel>
              <Select
                multiple
                value={zones}
                onChange={e => { setZones(e.target.value); setPage(1); }}
                input={<OutlinedInput label="Zone Filter" />}
                renderValue={v => (v.length ? v.join(', ') : 'All Zones')}
              >
                {allZones.map(z => <MenuItem key={z} value={z}>{z}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" className="md:col-span-3">
              <InputLabel>Filter by Status</InputLabel>
              <Select value={status} label="Filter by Status" onChange={e => { setStatus(e.target.value); setPage(1); }}>
                {['All', 'New', 'Old'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Paper>

          {filtered.length === 0 ? (
            <Alert severity="warning">No records matched your current filters.</Alert>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <Typography variant="caption" color="text.secondary">
                  Showing <strong>{start + 1} - {Math.min(start + pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> patients
                </Typography>
                <Select size="small" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n} rows</MenuItem>)}
                </Select>
              </div>

              <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 1500 }}>
                  <TableHead>
                    <TableRow>
                      {COLUMNS.map(([key, label]) => <TableCell key={key} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(p => (
                      <TableRow key={p.id} hover>
                        {COLUMNS.map(([key]) => (
                          <TableCell key={key} sx={{ whiteSpace: 'nowrap' }}>
                            {key === 'sla_status' ? (
                              <Chip size="small" label={p.sla_status === 'Overdue' ? '🚨 Overdue' : '✅ On Track'}
                                color={p.sla_status === 'Overdue' ? 'error' : 'success'} variant="outlined" />
                            ) : key === 'gap_days' ? `${p.gap_days} days` : p[key]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <div className="grid grid-cols-3 items-center gap-2">
                <Button variant="outlined" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>⬅️ Previous</Button>
                <Typography variant="caption" className="text-center">Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></Typography>
                <Button variant="outlined" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next ➡️</Button>
              </div>
            </>
          )}
        </>
      )}
    </Box>
  );
}
