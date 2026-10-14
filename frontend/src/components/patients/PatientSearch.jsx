/**
 * PatientSearch Component
 * Autocomplete search for patients
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Box,
  Typography,
  Avatar
} from '@mui/material';
import { Person } from '@mui/icons-material';
import { usePatient } from '../../context/PatientContext';
import { debounce } from 'lodash';

const PatientSearch = ({ onSelect, autoFocus = false, label = "Search Patient" }) => {
  const { searchPatients, loading } = usePatient();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setOptions([]);
        return;
      }

      try {
        const data = await searchPatients(query, 1, 10);
        setOptions(data.patients || []);
      } catch (error) {
        console.error('Search failed:', error);
        setOptions([]);
      }
    }, 300),
    [searchPatients]
  );

  useEffect(() => {
    if (inputValue) {
      debouncedSearch(inputValue);
    } else {
      setOptions([]);
    }
  }, [inputValue, debouncedSearch]);

  const handleSelect = (event, value) => {
    if (value && onSelect) {
      onSelect(value);
    }
  };

  const getOptionLabel = (option) => {
    if (!option) return '';
    return option.full_name || '';
  };

  const renderOption = (props, option) => (
    <Box component="li" {...props} key={option.id}>
      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
        <Person />
      </Avatar>
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body1">{option.full_name}</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
            {option.uhid || ''}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {option.gender}{option.age ? `, ${option.age}y` : ''}
          {option.city ? ` • ${option.city}` : ''}
          {option.contact ? ` • ${option.contact}` : ''}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      getOptionLabel={getOptionLabel}
      onChange={handleSelect}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      loading={loading}
      renderOption={renderOption}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Search by name, phone, or ABHA ID"
          autoFocus={autoFocus}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      noOptionsText={
        inputValue.length < 2
          ? "Type at least 2 characters to search"
          : "No patients found"
      }
      filterOptions={(x) => x} // Disable built-in filtering since we're doing server-side search
    />
  );
};

export default PatientSearch;
