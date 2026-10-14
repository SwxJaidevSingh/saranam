/**
 * InvestigationsSection — Structured investigation panels for clinical visits.
 * Panels: CBC, RFT, LFT, Serum Electrolytes, TFT, Others
 *
 * Props:
 *   visitId   - visit UUID
 *   patientId - patient UUID
 *   onSaved   - optional callback after save
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, FlaskConical, Plus, X } from 'lucide-react';
import { saranamApi } from '../../../api/saranam';

// ─── Panel definitions ────────────────────────────────────────────
const INVESTIGATION_PANELS = [
    {
        key: 'cbc',
        label: 'CBC',
        title: 'Complete Blood Count',
        fields: [
            { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL' },
            { key: 'tlc', label: 'TLC', unit: 'cells/μL' },
            { key: 'platelet_count', label: 'Platelet Count', unit: 'lakhs/μL' },
        ],
    },
    {
        key: 'rft',
        label: 'RFT',
        title: 'Renal Function Test',
        fields: [
            { key: 'serum_creatinine', label: 'Serum Creatinine', unit: 'mg/dL' },
            { key: 'serum_urea', label: 'Serum Urea', unit: 'mg/dL' },
        ],
    },
    {
        key: 'lft',
        label: 'LFT',
        title: 'Liver Function Test',
        fields: [
            { key: 'total_bilirubin', label: 'Total Bilirubin', unit: 'mg/dL' },
            { key: 'direct_bilirubin', label: 'Direct Bilirubin', unit: 'mg/dL' },
            { key: 'indirect_bilirubin', label: 'Indirect Bilirubin', unit: 'mg/dL' },
            { key: 'sgot', label: 'SGOT', unit: 'U/L' },
            { key: 'sgpt', label: 'SGPT', unit: 'U/L' },
            { key: 'total_protein', label: 'Total Protein', unit: 'g/dL' },
        ],
    },
    {
        key: 'electrolytes',
        label: 'Serum Electrolytes',
        title: 'Serum Electrolytes',
        fields: [
            { key: 'sodium', label: 'Sodium', unit: 'mEq/L' },
            { key: 'potassium', label: 'Potassium', unit: 'mEq/L' },
            { key: 'chloride', label: 'Chloride', unit: 'mEq/L' },
        ],
    },
    {
        key: 'tft',
        label: 'TFT',
        title: 'Thyroid Function Test',
        fields: [
            { key: 't3', label: 'T3', unit: 'ng/dL' },
            { key: 't4', label: 'T4', unit: 'μg/dL' },
            { key: 'tsh', label: 'TSH', unit: 'mIU/L' },
        ],
    },
];

// ─── Single panel component ───────────────────────────────────────
function InvestigationPanel({ panel, index, values, onChange }) {
    return (
        <div className="rounded-lg border border-border overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{index}.</span>
                <span className="text-sm font-semibold text-foreground">{panel.label}</span>
                {panel.label !== panel.title && (
                    <span className="text-xs text-muted-foreground">— {panel.title}</span>
                )}
            </div>

            {/* Fields */}
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {panel.fields.map(field => (
                    <div key={field.key}>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            {field.label}
                            {field.unit && (
                                <span className="ml-1 text-[10px] text-muted-foreground/60">({field.unit})</span>
                            )}
                        </label>
                        <input
                            type="text"
                            placeholder="—"
                            value={values?.[field.key] || ''}
                            onChange={e => onChange(panel.key, field.key, e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Others panel ─────────────────────────────────────────────────
function OthersPanel({ index, items, onChange }) {
    const [label, setLabel] = useState('');
    const [value, setValue] = useState('');

    const addItem = () => {
        const l = label.trim();
        const v = value.trim();
        if (!l) return;
        onChange([...items, { label: l, value: v }]);
        setLabel('');
        setValue('');
    };

    const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));

    const updateItem = (i, field, val) =>
        onChange(items.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

    return (
        <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{index}.</span>
                <span className="text-sm font-semibold text-foreground">Others</span>
            </div>

            <div className="p-3 space-y-2">
                {/* Existing items */}
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={item.label}
                            onChange={e => updateItem(i, 'label', e.target.value)}
                            placeholder="Test name"
                            className="flex-1 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                        />
                        <input
                            type="text"
                            value={item.value}
                            onChange={e => updateItem(i, 'value', e.target.value)}
                            placeholder="Result"
                            className="flex-1 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => removeItem(i)}
                            className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}

                {/* Add row */}
                <div className="flex items-center gap-2 pt-1">
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                        placeholder="Test name..."
                        className="flex-1 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                    />
                    <input
                        type="text"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                        placeholder="Result..."
                        className="flex-1 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                    />
                    <button
                        type="button"
                        onClick={addItem}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-border text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors whitespace-nowrap"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────
export default function InvestigationsSection({ visitId, patientId, panelValues, setPanelValues, othersItems, setOthersItems, notes, setNotes }) {
    const [saved, setSaved] = useState(false);

    const handleFieldChange = (panelKey, fieldKey, value) => {
        setPanelValues(prev => ({
            ...prev,
            [panelKey]: { ...(prev[panelKey] || {}), [fieldKey]: value },
        }));
        setSaved(false);
    };

    return (

        <div className="p-4 space-y-3">
            {/* Predefined panels */}
            {INVESTIGATION_PANELS.map((panel, i) => (
                <InvestigationPanel
                    key={panel.key}
                    panel={panel}
                    index={i + 1}
                    values={panelValues[panel.key]}
                    onChange={handleFieldChange}
                />
            ))}

            {/* Others */}
            <OthersPanel
                index={INVESTIGATION_PANELS.length + 1}
                items={othersItems}
                onChange={(v) => { setOthersItems(v); setSaved(false); }}
            />

            {/* Notes */}
            <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Investigation Notes</label>
                <textarea
                    rows={2}
                    placeholder="Additional remarks, pending investigations, follow-up instructions..."
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setSaved(false); }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
                />
            </div>

            {/* Save */}
            {/* <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                    {saving
                        ? <RefreshCw className="h-4 w-4 animate-spin" />
                        : saved
                            ? <CheckCircle className="h-4 w-4" />
                            : <Save className="h-4 w-4" />}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Investigations'}
                </button>
            </div> */}
        </div>
    );
}