/**
 * Medicine Catalog — browse, search, add medicines. Medicines live in the EHR's
 * medicine_master; category, formulary flag and notes are kept in inventory.medicine_meta.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Divider, FormControl, FormControlLabel, InputLabel, MenuItem,
  OutlinedInput, Paper, Select, TextField, Typography,
} from '@mui/material';
import inventoryApi, { apiError } from '../../api/inventory';
import { DataTable, Md, PageHeader } from '../../components/inventory/shared';

const emptyMed = { generic_name: '', strength: '', dosage_form: 'TABLET', manufacturer: '', in_formulary: true, notes: '' };

export default function MedicineCatalogPage() {
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState([]);
  const [rows, setRows] = useState([]);
  const [allMeds, setAllMeds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dosageForms, setDosageForms] = useState([]);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [newCat, setNewCat] = useState('');
  const [med, setMed] = useState(emptyMed);
  const [newMedCategory, setNewMedCategory] = useState('');
  const [metaMedId, setMetaMedId] = useState('');
  const [meta, setMeta] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [filtered, all] = await Promise.all([inventoryApi.getCatalog(query), inventoryApi.getCatalog('')]);
      setRows(filtered.medicines);
      setAllMeds(all.medicines);
      setCategories(all.categories);
      setDosageForms(all.dosage_forms);
    } catch (err) {
      setError(apiError(err));
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const catNames = categories.map(c => c.name);
  const displayed = useMemo(
    () => (catFilter.length ? rows.filter(r => catFilter.includes(r.category_name)) : rows),
    [rows, catFilter],
  );
  const addCategoryId = newMedCategory || categories[0]?.id || '';
  const addCategoryName = categories.find(c => c.id === addCategoryId)?.name || '';
  const isConsumable = addCategoryName.toLowerCase() === 'consumables';

  // Set Category & Formulary: all medicines while a search or filter is active, else the displayed rows.
  const metaOptions = query || catFilter.length ? allMeds : displayed;
  const selectedMeta = metaOptions.find(m => m.id === metaMedId) || metaOptions[0];
  useEffect(() => {
    if (selectedMeta) {
      setMeta({ category_id: selectedMeta.category_id ?? '', in_formulary: selectedMeta.in_formulary, notes: selectedMeta.notes || '' });
    }
  }, [selectedMeta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, after) => {
    try {
      setBusy(true);
      setError(null);
      const res = await fn();
      setMessage(res.message);
      after?.();
      await load();
    } catch (err) {
      setMessage(null);
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const addMedicine = () => {
    if (!med.generic_name) { setError(`${isConsumable ? 'Item' : 'Generic'} name is required.`); return; }
    run(() => inventoryApi.addMedicine({
      ...med, category_id: addCategoryId,
      strength: isConsumable ? null : med.strength, dosage_form: isConsumable ? null : med.dosage_form,
    }), () => setMed(emptyMed));
  };

  return (
    <Box className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      <PageHeader title="💊 Medicine Catalog" />
      {message && <Alert severity="success" onClose={() => setMessage(null)}><Md>{message}</Md></Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TextField className="md:col-span-2" size="small" label="Search medicines" placeholder="Type generic name…"
          value={query} onChange={e => setQuery(e.target.value)} />
        <FormControl size="small">
          <InputLabel>Filter by category</InputLabel>
          <Select multiple value={catFilter} onChange={e => setCatFilter(e.target.value)}
            input={<OutlinedInput label="Filter by category" />} renderValue={v => v.join(', ')}>
            {catNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </Select>
        </FormControl>
      </div>

      {displayed.length ? (
        <DataTable
          rows={displayed.map(r => ({ ...r, formulary: r.in_formulary ? '✅ Yes' : '❌ No' }))}
          columns={['medicine_code', 'generic_name', 'category_name', 'strength', 'dosage_form', 'manufacturer', 'formulary']}
        />
      ) : <Alert severity="info">No medicines found.</Alert>}

      <Divider />
      <Paper className="p-4 space-y-3">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Add New Medicine</Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Drug Category</InputLabel>
          <Select label="Drug Category" value={addCategoryId} onChange={e => setNewMedCategory(e.target.value)}>
            {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField size="small" label={isConsumable ? 'Item Name *' : 'Generic Name *'} value={med.generic_name}
            onChange={e => setMed(m => ({ ...m, generic_name: e.target.value }))} />
          {!isConsumable ? (
            <FormControl size="small">
              <InputLabel>Dosage Form</InputLabel>
              <Select label="Dosage Form" value={med.dosage_form ?? '__other__'}
                onChange={e => setMed(m => ({ ...m, dosage_form: e.target.value === '__other__' ? null : e.target.value }))}>
                {dosageForms.map(f => <MenuItem key={f.label} value={f.value ?? '__other__'}>{f.label}</MenuItem>)}
              </Select>
            </FormControl>
          ) : <div />}
          {!isConsumable && (
            <TextField size="small" label="Strength" placeholder="e.g. 500mg" value={med.strength}
              onChange={e => setMed(m => ({ ...m, strength: e.target.value }))} />
          )}
          <TextField size="small" label="Manufacturer" value={med.manufacturer}
            onChange={e => setMed(m => ({ ...m, manufacturer: e.target.value }))} />
        </div>
        <FormControlLabel control={<Checkbox checked={med.in_formulary} onChange={e => setMed(m => ({ ...m, in_formulary: e.target.checked }))} />}
          label="In hospital formulary" />
        <TextField fullWidth size="small" multiline rows={3} label="Notes" value={med.notes}
          onChange={e => setMed(m => ({ ...m, notes: e.target.value }))} />
        <Button fullWidth variant="contained" disabled={busy || !addCategoryId} onClick={addMedicine}>Add Medicine</Button>
      </Paper>

      <Divider />
      <Paper className="p-4 space-y-3">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Set Category &amp; Formulary</Typography>
        {selectedMeta && meta ? (
          <>
            <FormControl size="small" fullWidth>
              <InputLabel>Medicine</InputLabel>
              <Select label="Medicine" value={selectedMeta.id} onChange={e => setMetaMedId(e.target.value)}>
                {metaOptions.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Drug Category</InputLabel>
              <Select label="Drug Category" value={meta.category_id} onChange={e => setMeta(v => ({ ...v, category_id: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControlLabel control={<Checkbox checked={meta.in_formulary} onChange={e => setMeta(v => ({ ...v, in_formulary: e.target.checked }))} />}
              label="In hospital formulary" />
            <TextField fullWidth size="small" multiline rows={3} label="Notes" value={meta.notes}
              onChange={e => setMeta(v => ({ ...v, notes: e.target.value }))} />
            <Button fullWidth variant="contained" disabled={busy} onClick={() => run(() => inventoryApi.saveMedicineMeta(selectedMeta.id, {
              category_id: meta.category_id === '' ? null : meta.category_id, in_formulary: meta.in_formulary, notes: meta.notes,
            }))}>Save</Button>
          </>
        ) : <Alert severity="info">No medicines found.</Alert>}
      </Paper>

      <Divider />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>Manage Drug Categories</Typography>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          {categories.length
            ? <DataTable rows={categories.map(c => ({ ID: c.id, Category: c.name }))} maxHeight={360} />
            : <Alert severity="info">No categories defined.</Alert>}
        </div>
        <Paper className="p-4 space-y-3">
          <TextField fullWidth size="small" label="New category name" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <Button fullWidth variant="contained" disabled={busy} onClick={() => {
            if (!newCat) { setError('Enter a category name.'); return; }
            run(() => inventoryApi.addCategory(newCat), () => setNewCat(''));
          }}>Add Category</Button>
        </Paper>
      </div>
    </Box>
  );
}
