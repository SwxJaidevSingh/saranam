/**
 * OnDutyToggle — small pill in the Teleconsult page header.
 *
 * Shows the logged-in provider's current on-duty status and lets them flip
 * it. Used by the inbound router to pick who to bridge incoming calls to.
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Stack, Switch, Typography, CircularProgress, Tooltip,
} from '@mui/material';
import { Circle } from '@mui/icons-material';
import teleconsultApi from '../../../api/teleconsult';

const OnDutyToggle = () => {
  const [state, setState] = useState({ loading: true, linked: false, on: false, name: '' });

  const load = async () => {
    try {
      const r = await teleconsultApi.getMyOnDuty();
      setState({
        loading: false,
        linked: !!r.linked_provider,
        on: !!r.is_on_duty,
        name: r.provider_name || '',
      });
    } catch (_) {
      setState({ loading: false, linked: false, on: false, name: '' });
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (e) => {
    const target = e.target.checked;
    setState((s) => ({ ...s, on: target }));
    try {
      const r = await teleconsultApi.setMyOnDuty(target);
      setState((s) => ({ ...s, on: !!r.is_on_duty }));
    } catch (_) {
      setState((s) => ({ ...s, on: !target }));
    }
  };

  if (state.loading) return <CircularProgress size={18} />;
  if (!state.linked) {
    return (
      <Tooltip title="Your account isn't linked to a provider profile, so you can't take inbound calls.">
        <Typography variant="caption" color="text.secondary">
          Not on-duty roster
        </Typography>
      </Tooltip>
    );
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        px: 1.5, py: 0.5, borderRadius: 5,
        bgcolor: state.on ? 'success.light' : 'action.hover',
        color: state.on ? 'success.contrastText' : 'text.secondary',
        transition: 'all .2s',
      }}
    >
      <Circle sx={{ fontSize: 10, color: state.on ? 'success.dark' : 'text.disabled' }} />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {state.on ? 'On Duty' : 'Off Duty'}
      </Typography>
      <Switch size="small" checked={state.on} onChange={toggle} />
    </Stack>
  );
};

export default OnDutyToggle;
