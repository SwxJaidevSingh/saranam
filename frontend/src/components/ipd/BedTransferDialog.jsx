import { useState, useEffect } from 'react';
import { X, ArrowRight, Search } from 'lucide-react';
import ipdApi from '../../api/ipd';

export default function BedTransferDialog({ currentBed, onClose, onSuccess }) {
  const [availableBeds, setAvailableBeds] = useState([]);
  const [selectedNewBed, setSelectedNewBed] = useState(null);
  const [transferReason, setTransferReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBeds, setLoadingBeds] = useState(true);
  const [error, setError] = useState(null);
  const [bedFilter, setBedFilter] = useState('');

  useEffect(() => {
    loadAvailableBeds();
  }, []);

  const loadAvailableBeds = async () => {
    try {
      setLoadingBeds(true);
      const data = await ipdApi.searchAvailableBeds(currentBed.bed_type);
      setAvailableBeds(data.beds || []);
    } catch (err) {
      console.error('Failed to load available beds:', err);
      setError('Failed to load available beds');
    } finally {
      setLoadingBeds(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();

    if (!selectedNewBed) {
      setError('Please select a new bed');
      return;
    }

    if (!transferReason.trim()) {
      setError('Please provide a transfer reason');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await ipdApi.transferBed(
        currentBed.id,
        selectedNewBed.id,
        transferReason,
        notes
      );

      onSuccess();
    } catch (err) {
      console.error('Failed to transfer bed:', err);
      setError(err.response?.data?.error || 'Failed to transfer bed');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBeds = bedFilter
    ? availableBeds.filter(
        (bed) =>
          bed.bed_number.toLowerCase().includes(bedFilter.toLowerCase()) ||
          bed.ward_name.toLowerCase().includes(bedFilter.toLowerCase())
      )
    : availableBeds;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Transfer Patient</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleTransfer} className="p-6 space-y-6">
          {/* Current and New Bed Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Bed */}
            <div className="bg-red-500/10 p-4 rounded-lg border-2 border-red-500/20">
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-3">Current Bed</h3>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {currentBed.bed_number}
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-red-700 dark:text-red-400 font-medium">Ward:</span> {currentBed.ward_name}
                  </div>
                  <div>
                    <span className="text-red-700 dark:text-red-400 font-medium">Type:</span>{' '}
                    <span className="capitalize">{currentBed.bed_type?.replace('_', ' ')}</span>
                  </div>
                  {currentBed.room_number && (
                    <div>
                      <span className="text-red-700 dark:text-red-400 font-medium">Room:</span> {currentBed.room_number}
                    </div>
                  )}
                  {currentBed.current_patient && (
                    <div className="mt-2 pt-2 border-t border-red-500/20">
                      <span className="text-red-700 dark:text-red-400 font-medium">Patient:</span>{' '}
                      {currentBed.current_patient.patient_name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* New Bed */}
            <div className={`p-4 rounded-lg border-2 ${selectedNewBed ? 'bg-green-500/10 border-green-500/20' : 'bg-secondary border-border'}`}>
              <h3 className={`font-semibold mb-3 ${selectedNewBed ? 'text-green-900 dark:text-green-100' : 'text-foreground'}`}>
                New Bed {selectedNewBed && <ArrowRight className="inline h-5 w-5" />}
              </h3>
              {selectedNewBed ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {selectedNewBed.bed_number}
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-green-700 dark:text-green-400 font-medium">Ward:</span> {selectedNewBed.ward_name}
                    </div>
                    <div>
                      <span className="text-green-700 dark:text-green-400 font-medium">Type:</span>{' '}
                      <span className="capitalize">{selectedNewBed.bed_type?.replace('_', ' ')}</span>
                    </div>
                    {selectedNewBed.room_number && (
                      <div>
                        <span className="text-green-700 dark:text-green-400 font-medium">Room:</span> {selectedNewBed.room_number}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNewBed(null)}
                    className="mt-2 text-sm text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 underline"
                  >
                    Choose different bed
                  </button>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Select a new bed from the list below
                </div>
              )}
            </div>
          </div>

          {/* Available Beds */}
          {!selectedNewBed && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-foreground">
                  Available Beds ({filteredBeds.length})
                </h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                  <input
                    type="text"
                    placeholder="Filter beds..."
                    value={bedFilter}
                    onChange={(e) => setBedFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                {loadingBeds ? (
                  <div className="p-4 text-center text-muted-foreground">Loading available beds...</div>
                ) : filteredBeds.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No available beds of type "{currentBed.bed_type}" found
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredBeds.map((bed) => (
                      <button
                        key={bed.id}
                        type="button"
                        onClick={() => setSelectedNewBed(bed)}
                        className="w-full text-left p-3 hover:bg-primary/10 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-primary">{bed.bed_number}</div>
                            <div className="text-sm text-muted-foreground">
                              {bed.ward_name}
                              {bed.room_number && ` • Room ${bed.room_number}`}
                              {bed.floor && ` • Floor ${bed.floor}`}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {bed.has_oxygen && (
                              <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">O₂</span>
                            )}
                            {bed.has_ventilator && (
                              <span className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded">Vent</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transfer Reason */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Transfer Reason *
            </label>
            <select
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select reason...</option>
              <option value="Medical Requirement">Medical Requirement</option>
              <option value="Patient Request">Patient Request</option>
              <option value="Bed Upgrade">Bed Upgrade</option>
              <option value="Isolation Required">Isolation Required</option>
              <option value="Ward Transfer">Ward Transfer</option>
              <option value="Equipment Availability">Equipment Availability</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any additional transfer details..."
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
              disabled={isLoading || !selectedNewBed}
              className="px-4 py-2 bg-orange-600 dark:bg-orange-700 text-white rounded-lg hover:bg-orange-700 dark:hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? 'Transferring...' : 'Transfer Patient'}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
