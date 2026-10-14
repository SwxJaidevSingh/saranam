/**
 * ProcedureCheckboxGroup — shared checkbox grid for procedures,
 * with support for adding custom (free-text) procedures.
 *
 * `selected` is an array of strings: predefined keys (matching `procedures[].key`)
 * plus any custom free-text entries typed by the user.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function ProcedureCheckboxGroup({ title, color, procedures, selected, onChange }) {
    const [customInput, setCustomInput] = useState('');

    const predefinedKeys = procedures.map(p => p.key);
    const customEntries = selected.filter(s => !predefinedKeys.includes(s));

    const toggle = (key) => {
        const set = new Set(selected);
        if (set.has(key)) set.delete(key); else set.add(key);
        onChange([...set]);
    };

    const addCustom = () => {
        const value = customInput.trim();
        if (!value) return;
        if (selected.includes(value)) {
            setCustomInput('');
            return;
        }
        onChange([...selected, value]);
        setCustomInput('');
    };

    const removeCustom = (value) => {
        onChange(selected.filter(s => s !== value));
    };

    return (
        <div>
            <h5 className={`text-xs font-bold ${color} mb-2`}>{title}</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
                {procedures.map(p => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={selected.includes(p.key)}
                            onChange={() => toggle(p.key)}
                            className="h-3.5 w-3.5 rounded border-border text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-foreground group-hover:text-blue-600 transition-colors">{p.label}</span>
                    </label>
                ))}
            </div>

            {/* Custom procedure entries */}
            {customEntries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {customEntries.map(entry => (
                        <span key={entry} className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border border-border bg-muted/30 text-foreground">
                            {entry}
                            <button onClick={() => removeCustom(entry)} className="hover:text-red-500">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Add custom procedure */}
            <div className="flex items-center gap-2 mt-2">
                <input
                    type="text"
                    placeholder="Add custom procedure..."
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                    className="flex-1 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs"
                />
                <button onClick={addCustom} type="button"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-border text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add
                </button>
            </div>
        </div>
    );
}