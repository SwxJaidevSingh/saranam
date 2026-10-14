/**
 * PatientDirectory — searchable list of patients with Voice/Video buttons.
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, TextField, InputAdornment, Button, Stack,
  Avatar, CircularProgress, Pagination,
} from '@mui/material';
import { Search, Videocam, Phone } from '@mui/icons-material';
import { patientsApi } from '../../../api/patients';
import CallNowDialog from './CallNowDialog';

const PatientDirectory = () => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [callDialog, setCallDialog] = useState(null); // { patient, channel }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await patientsApi.search(debounced, page, perPage);
        if (!active) return;
        setPatients(res?.patients || res?.items || res?.data || []);
        setTotal(res?.total || res?.pagination?.total || 0);
      } catch (e) {
        if (active) setPatients([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [debounced, page, perPage]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Patients</Typography>
        <TextField
          size="small"
          placeholder="Search by name / UHID / phone"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
          }}
        />
      </Stack>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : patients.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <Typography color="text.secondary" variant="body2">
            No patients match "{debounced}"
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {patients.map(p => {
            const name = p.full_name || p.name || 'Unnamed';
            const uhid = p.uhid || p.UHID;
            const phone =
              p.primary_caregiver_phone ||
              p.phone ||
              p.phone_number ||
              p.decision_maker_phone ||
              '';
            const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
            return (
              <Paper
                key={p.id}
                variant="outlined"
                sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: '0.85rem', fontWeight: 700 }}>
                  {initials || '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {name}
                    {uhid && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        · UHID {uhid}
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {phone || 'No phone on file'}
                    {p.geographic_cluster ? ` · ${p.geographic_cluster}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Phone fontSize="small" />}
                    onClick={() => setCallDialog({ patient: p, channel: 'voice' })}
                    sx={{ textTransform: 'none' }}
                  >
                    Voice
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Videocam fontSize="small" />}
                    onClick={() => setCallDialog({ patient: p, channel: 'video' })}
                    sx={{ textTransform: 'none' }}
                  >
                    Video
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
          />
        </Stack>
      )}

      {callDialog && (
        <CallNowDialog
          open
          onClose={() => setCallDialog(null)}
          patient={callDialog.patient}
          channel={callDialog.channel}
        />
      )}
    </Paper>
  );
};

export default PatientDirectory;
