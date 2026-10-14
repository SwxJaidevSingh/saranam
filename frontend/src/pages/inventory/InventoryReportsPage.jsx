/** Reports — stock, low stock, stock by source, dispensing, emergency meds, errors, audit. */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Divider, FormControl, InputLabel, MenuItem, Select, Slider, TextField, Typography,
} from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import inventoryApi, { apiError } from '../../api/inventory';
import { DataTable, Metric, PageHeader } from '../../components/inventory/shared';

const REPORTS = [
  ['stock_inventory', 'Stock Inventory'],
  ['low_stock', 'Low-Stock Items'],
  ['stock_by_source', 'Stock by Source'],
  ['dispensing_summary', 'Dispensing Summary'],
  ['emergency_meds', 'Emergency Medications by Location'],
  ['error_summary', 'Medication Error Summary'],
  ['audit_log', 'Audit Log'],
];
const TITLES = {
  stock_inventory: 'Stock Inventory Report', low_stock: 'Low-Stock Items by Source of Indent',
  stock_by_source: 'Stock Breakdown by Source', dispensing_summary: 'Dispensing Summary',
  emergency_meds: 'Emergency Medications by Location', error_summary: 'Medication Error Summary', audit_log: 'Audit Log',
};
const SOURCE_LABELS = { saranam: '🟢 Saranam Procurement', partner: '🔵 Partner Indent', unattributed: '⚪ Unattributed' };

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function InventoryReportsPage() {
  const [slug, setSlug] = useState('stock_inventory');
  const [filters, setFilters] = useState(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    return { source: 'All', category: 'All', location: '', start: iso(from), end: iso(today), limit: 50 };
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const params = useMemo(() => {
    if (slug === 'stock_inventory') return { source: filters.source, category: filters.category, location: filters.location };
    if (slug === 'dispensing_summary') return { start: filters.start, end: filters.end };
    if (slug === 'audit_log') return { limit: filters.limit };
    return {};
  }, [slug, filters]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      inventoryApi.getReport(slug, params)
        .then(d => { if (!cancelled) { setData({ slug, ...d }); setError(null); } })
        .catch(err => !cancelled && setError(apiError(err)));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [slug, params]);

  const set = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));
  const rows = data?.slug === slug ? data.rows : null;
  const download = () => inventoryApi.downloadReportCsv(slug, params).catch(err => setError(apiError(err)));
  const csvButton = rows?.length && slug !== 'error_summary'
    ? <Button variant="outlined" onClick={download}>⬇️ Download {slug} CSV</Button> : null;

  const byType = useMemo(() => {
    if (slug !== 'error_summary' || !rows) return [];
    const t = {};
    rows.forEach(r => { t[r.error_type] = (t[r.error_type] || 0) + r.count; });
    return Object.entries(t).map(([error_type, count]) => ({ error_type, count }));
  }, [slug, rows]);

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader title="📋 Reports" />
      <FormControl size="small" sx={{ minWidth: 320 }}>
        <InputLabel>Select Report</InputLabel>
        <Select label="Select Report" value={slug} onChange={e => { setSlug(e.target.value); setData(null); }}>
          {REPORTS.map(([s, l]) => <MenuItem key={s} value={s}>{l}</MenuItem>)}
        </Select>
      </FormControl>
      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>{TITLES[slug]}</Typography>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {slug === 'stock_inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormControl size="small">
            <InputLabel>Source</InputLabel>
            <Select label="Source" value={filters.source} onChange={set('source')}>
              <MenuItem value="All">All</MenuItem>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={filters.category} onChange={set('category')}>
              {['All', ...(data?.categories || [])].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Location" placeholder="All locations" value={filters.location} onChange={set('location')} />
        </div>
      )}
      {slug === 'dispensing_summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField size="small" type="date" label="From" value={filters.start} onChange={set('start')} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="To" value={filters.end} onChange={set('end')} slotProps={{ inputLabel: { shrink: true } }} />
        </div>
      )}
      {slug === 'audit_log' && (
        <Box sx={{ maxWidth: 420 }}>
          <Typography variant="body2">Show last N entries: <strong>{filters.limit}</strong></Typography>
          <Slider min={10} max={200} value={Number(filters.limit)} onChange={(_, v) => setFilters(f => ({ ...f, limit: v }))} />
        </Box>
      )}

      {rows && rows.length === 0 && (
        {
          stock_inventory: <Alert severity="info">No stock data.</Alert>,
          low_stock: <Alert severity="success">All items above reorder level.</Alert>,
          stock_by_source: <Alert severity="info">No stock data.</Alert>,
          dispensing_summary: <Alert severity="info">No dispensing activity in this period.</Alert>,
          emergency_meds: <Alert severity="info">No emergency medication records. Configure them in Admin.</Alert>,
          error_summary: <Alert severity="success">No medication errors recorded.</Alert>,
          audit_log: <Alert severity="info">No audit entries yet.</Alert>,
        }[slug]
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          {slug === 'stock_by_source' ? Object.keys(SOURCE_LABELS).map(src => {
            const subset = rows.filter(r => r.source === src);
            if (!subset.length) return null;
            const cols = ['partner', 'medicine', 'strength', 'quantity', 'location'].filter(c => src === 'partner' || c !== 'partner');
            return (
              <div key={src} className="space-y-2">
                <Typography variant="body2"><strong>{SOURCE_LABELS[src]}</strong> — {subset.reduce((t, r) => t + r.quantity, 0)} total units</Typography>
                <DataTable rows={subset} columns={cols} maxHeight={360} />
              </div>
            );
          }) : slug === 'emergency_meds' ? [...new Set(rows.map(r => r.location))].map(loc => (
            <div key={loc} className="space-y-2">
              <Typography variant="body2"><strong>📍 {loc}</strong></Typography>
              <DataTable rows={rows.filter(r => r.location === loc)} maxHeight={360} />
            </div>
          )) : <DataTable rows={rows} minWidth={slug === 'stock_inventory' ? 1300 : undefined} />}

          {slug === 'dispensing_summary' && <Metric label="Total dispense events" value={rows.length} />}
          {slug === 'error_summary' && (
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={byType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="error_type" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
          {csvButton}
        </div>
      )}
    </Box>
  );
}
