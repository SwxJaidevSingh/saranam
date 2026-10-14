import { useState } from 'react';
import { X } from 'lucide-react';
import ipdApi from '../../api/ipd';

export default function CreateBedDialog({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    bed_number: '',
    ward_name: '',
    room_number: '',
    floor: '',
    building: '',
    bed_type: 'general',
    has_oxygen: false,
    has_ventilator: false,
    notes: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      setError(null);

      await ipdApi.createBed(formData);
      onSuccess();
    } catch (err) {
      console.error('Failed to create bed:', err);
      setError(err.response?.data?.error || 'Failed to create bed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Add New Bed</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Bed Number */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Bed Number *
            </label>
            <input
              type="text"
              value={formData.bed_number}
              onChange={(e) => handleChange('bed_number', e.target.value)}
              placeholder="e.g., ICU-101, GW-A-205"
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Unique identifier for this bed
            </p>
          </div>

          {/* Ward Name */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Ward Name *
            </label>
            <input
              type="text"
              value={formData.ward_name}
              onChange={(e) => handleChange('ward_name', e.target.value)}
              placeholder="e.g., General Ward A, ICU"
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Location Details - Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Room Number
              </label>
              <input
                type="text"
                value={formData.room_number}
                onChange={(e) => handleChange('room_number', e.target.value)}
                placeholder="e.g., 205"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Floor
              </label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => handleChange('floor', e.target.value)}
                placeholder="e.g., 2, Ground"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Building
              </label>
              <input
                type="text"
                value={formData.building}
                onChange={(e) => handleChange('building', e.target.value)}
                placeholder="e.g., Main Block"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Bed Type */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Bed Type *
            </label>
            <select
              value={formData.bed_type}
              onChange={(e) => handleChange('bed_type', e.target.value)}
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="general">General</option>
              <option value="icu">ICU</option>
              <option value="semi_private">Semi-Private</option>
              <option value="private">Private</option>
              <option value="isolation">Isolation</option>
            </select>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-3">
              Equipment Available
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.has_oxygen}
                  onChange={(e) => handleChange('has_oxygen', e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Oxygen Supply</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.has_ventilator}
                  onChange={(e) => handleChange('has_ventilator', e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Ventilator</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              placeholder="Add any additional information about this bed..."
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-secondary text-foreground rounded-lg hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Bed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
