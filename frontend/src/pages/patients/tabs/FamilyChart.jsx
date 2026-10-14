import { Plus, Trash2 } from 'lucide-react';

const emptyRow = () => ({
    name: '',
    relationship: '',
    age: '',
    living_with_patient: '',
    notes: '',
});

export default function FamilyChartForm({ value = [], onChange }) {
    const updateRow = (i, field, val) =>
        onChange(value.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

    const addRow = () => onChange([...value, emptyRow()]);

    const removeRow = (i) => onChange(value.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
                List the patient's family members and their relationship to the patient.
            </p>
            <div className="space-y-2">
                {value.map((row, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-lg border border-border">
                        <div className="col-span-3">
                            <label className="block text-xs text-muted-foreground mb-1">Name</label>
                            <input type="text" placeholder="e.g. Ravi Kumar" value={row.name}
                                onChange={e => updateRow(i, 'name', e.target.value)}
                                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-muted-foreground mb-1">Relationship</label>
                            <input type="text" placeholder="e.g. Son" value={row.relationship}
                                onChange={e => updateRow(i, 'relationship', e.target.value)}
                                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs text-muted-foreground mb-1">Age</label>
                            <input type="number" placeholder="—" value={row.age}
                                onChange={e => updateRow(i, 'age', e.target.value)}
                                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs text-muted-foreground mb-1">Living with patient?</label>
                            <select value={row.living_with_patient}
                                onChange={e => updateRow(i, 'living_with_patient', e.target.value)}
                                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm">
                                <option value="">—</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                        <div className="col-span-3">
                            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                            <input type="text" placeholder="Optional" value={row.notes}
                                onChange={e => updateRow(i, 'notes', e.target.value)}
                                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                        </div>
                        <div className="col-span-1 flex items-end pb-0.5">
                            <button type="button" onClick={() => removeRow(i)}
                                className="p-1.5 text-red-500 hover:bg-red-900/20 rounded">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <button type="button" onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
                <Plus className="h-4 w-4" /> Add Family Member
            </button>
        </div>
    );
}