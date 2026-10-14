/** Route Map — locked routes for all vehicles or one, with the selected vehicle's route summary. */
import React, { useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Divider, FormControl, InputLabel, MenuItem, Paper,
  Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import DispatchRouteMap from './DispatchRouteMap';
import { ShareRouteLinks } from './DispatchConsoleTab';

export default function RouteMapTab({ schedule }) {
  const mapVehicles = useMemo(
    () => schedule.vehicles.filter(v => schedule.slots.some(s => s.vehicle_id === v.id)),
    [schedule],
  );
  const [selected, setSelected] = useState('all');
  const vehicle = mapVehicles.find(v => v.id === selected);
  const vSlots = vehicle ? schedule.slots.filter(s => s.vehicle_id === vehicle.id).sort((a, b) => a.slot_order - b.slot_order) : [];
  const totalDist = vSlots.reduce((t, s) => t + (s.drive_distance_km || 0), 0);
  const totalDur = vSlots.reduce((t, s) => t + (s.drive_duration_min || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>🗺️ Daily Dispatch Route Map</Typography>
        <Typography variant="body2" color="text.secondary">View routes and patient stops for each vehicle. Selecting a vehicle highlights its path.</Typography>
      </div>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMore />}><Typography sx={{ fontWeight: 600 }}>ℹ️ How Route Optimization Works (Google Routes API Logic)</Typography></AccordionSummary>
        <AccordionDetails className="space-y-2">
          <Typography variant="body2"><strong>Optimization heuristics:</strong> the Google Routes API reorders the patient stops between the start and end point to minimise total travel time over the road network.</Typography>
          <Typography variant="body2"><strong>🔄 Round Trip (default):</strong> the route starts and ends at the vehicle&apos;s home depot; every patient is an intermediate stop.</Typography>
          <Typography variant="body2"><strong>🛣️ Open Loop:</strong> the route starts at the depot and ends at the patient furthest from it (straight-line); the other patients are ordered to lead there efficiently.</Typography>
          <Typography variant="body2"><strong>Automatic fallback:</strong> without a Google Maps key, or if the request fails, a local nearest-neighbour ordering is used (Google road distances if available, otherwise straight-line Haversine distances).</Typography>
        </AccordionDetails>
      </Accordion>

      {mapVehicles.length === 0 ? (
        <Alert severity="info">No active routes to display on map.</Alert>
      ) : (
        <>
          <FormControl size="small" sx={{ minWidth: 320 }}>
            <InputLabel>Select Vehicle Route</InputLabel>
            <Select label="Select Vehicle Route" value={selected} onChange={e => setSelected(e.target.value)}>
              <MenuItem value="all">🌐 Show All Vehicles</MenuItem>
              {mapVehicles.map(v => <MenuItem key={v.id} value={v.id}>🚛 {v.name} ({v.registration_number || 'No Reg'})</MenuItem>)}
            </Select>
          </FormControl>

          <DispatchRouteMap slots={schedule.slots} vehicles={mapVehicles} selectedVehicleId={selected} />

          {vehicle && (
            <Paper className="p-4 space-y-3">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>📊 Route Summary: {vehicle.name}</Typography>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[['Total Stops', `${vSlots.length} patients`], ['Total Distance', `${totalDist.toFixed(2)} km`], ['Est. Driving Time', `${totalDur.toFixed(1)} mins`]].map(([l, v]) => (
                  <div key={l}><Typography variant="caption" color="text.secondary">{l}</Typography><Typography variant="h6" sx={{ fontWeight: 700 }}>{v}</Typography></div>
                ))}
              </div>
              <Divider />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>🔗 Share Route Map (Google Maps):</Typography>
              <ShareRouteLinks vehicle={vehicle} slots={vSlots} stored={schedule.routes[vehicle.id]} />
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Stop', 'Patient Name', 'UHID', 'Address', 'Zone', 'Distance from Prev', 'Duration from Prev', 'Status'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vSlots.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{s.slot_order}</TableCell><TableCell>{s.patient_name}</TableCell><TableCell>{s.uhid}</TableCell>
                        <TableCell>{s.address || 'N/A'}</TableCell><TableCell>{s.zone}</TableCell>
                        <TableCell>{Number(s.drive_distance_km || 0).toFixed(2)} km</TableCell>
                        <TableCell>{Number(s.drive_duration_min || 0).toFixed(1)} mins</TableCell>
                        <TableCell>{s.status.toUpperCase()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}
    </div>
  );
}
