/** Dashboard — KPIs, low-stock alerts, stock by source, recent activity. */
import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Divider, Paper, Typography } from '@mui/material';
import inventoryApi, { apiError } from '../../api/inventory';
import { DataTable, Md, Metric, PageHeader } from '../../components/inventory/shared';

export default function InventoryDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    inventoryApi.getDashboard().then(setData).catch(err => setError(apiError(err)));
  }, []);

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader title="Dashboard" caption="Real-time overview of medicine inventory" />
      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <Box className="flex justify-center p-10"><CircularProgress /></Box>}
      {data && (
        <>
          <Paper className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
            <Metric label="Unique Medicines" value={data.unique_meds} />
            <Metric label="Total Units" value={data.total_units} />
            <Metric label="🟢 Saranam Stock" value={data.by_source.saranam} />
            <Metric label="🔵 Partner Stock" value={data.by_source.partner} />
            <Metric label="⚪ Unattributed" value={data.by_source.unattributed} />
          </Paper>
          <Divider />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Typography variant="h6" sx={{ fontWeight: 700 }}>⚠️ Low-Stock Items</Typography>
              {data.low_stock.length
                ? <DataTable rows={data.low_stock} maxHeight={420} />
                : <Alert severity="success">All stock levels are healthy.</Alert>}
            </div>
            <div className="space-y-2">
              <Typography variant="h6" sx={{ fontWeight: 700 }}>🔴 Open Issues</Typography>
              {data.open_errors
                ? <Alert severity="warning"><Md>{`**${data.open_errors}** unresolved medication error report(s). Review them in Error Reporting.`}</Md></Alert>
                : <Alert severity="success">No open medication errors.</Alert>}
              {data.low_stock.length > 0 && (
                <Alert severity="warning"><Md>{`**${data.low_stock.length}** item(s) at or below their source's reorder level.`}</Md></Alert>
              )}
            </div>
          </div>
          <Divider />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>🕐 Recent Dispensing Activity</Typography>
          {data.recent_dispensing.length
            ? <DataTable rows={data.recent_dispensing} />
            : <Alert severity="info">No dispensing activity yet.</Alert>}
        </>
      )}
    </Box>
  );
}
