/**
 * ProviderSelect — autocomplete picker for active healthcare providers.
 */
import React, { useEffect, useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { providersApi } from '../../../api/providers';

const ProviderSelect = ({ value, onChange, label = 'Provider', size = 'small', required = false, disabled = false }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await providersApi.list({ is_active: true, per_page: 100 });
        const items = (res?.providers || res?.items || res || []).filter(p =>
          p?.is_active !== false
        );
        if (active) setOptions(items);
      } catch (e) {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const selected = options.find(o => o.id === value) || null;

  return (
    <Autocomplete
      size={size}
      options={options}
      loading={loading}
      value={selected}
      onChange={(_, v) => onChange(v?.id || null)}
      getOptionLabel={(o) => o?.full_name || o?.name || ''}
      isOptionEqualToValue={(o, v) => o.id === v?.id}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default ProviderSelect;
