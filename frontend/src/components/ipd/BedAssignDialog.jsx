import { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import ipdApi from '../../api/ipd';
import patientsApi from '../../api/patients';

export default function BedAssignDialog({ bed, onClose, onSuccess }) {
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [admissionId, setAdmissionId] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (patientSearch.length >= 2) {
      searchPatients();
    } else {
      setPatients([]);
    }
  }, [patientSearch]);

  const searchPatients = async () => {
    try {
      setSearching(true);
      const data = await patientsApi.search(patientSearch);
      setPatients(data.patients || []);
    } catch (err) {
      console.error('Failed to search patients:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();

    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await ipdApi.assignBed(bed.id, {
        patient_id: selectedPatient.id,
        admission_id: admissionId || null,
        notes
      });

      onSuccess();
    } catch (err) {
      console.error('Failed to assign bed:', err);
      setError(err.response?.data?.error || 'Failed to assign bed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            Assign Bed {bed.bed_number}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleAssign} className="p-6 space-y-6">
          {/* Bed Details */}
          <div className="bg-primary/10 p-4 rounded-lg">
            <h3 className="font-semibold text-primary mb-2">Bed Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-primary">Ward:</span> {bed.ward_name}
              </div>
              <div>
                <span className="text-primary">Type:</span> <span className="capitalize">{bed.bed_type?.replace('_', ' ')}</span>
              </div>
              {bed.room_number && (
                <div>
                  <span className="text-primary">Room:</span> {bed.room_number}
                </div>
              )}
              {bed.floor && (
                <div>
                  <span className="text-primary">Floor:</span> {bed.floor}
                </div>
              )}
            </div>
          </div>

          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Search Patient *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by name, ABHA ID, or phone..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Search Results */}
            {searching && (
              <div className="mt-2 text-sm text-muted-foreground">Searching...</div>
            )}

            {patients.length > 0 && !selectedPatient && (
              <div className="mt-2 border border-border rounded-lg max-h-48 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatient(patient);
                      setPatientSearch(patient.full_name);
                      setPatients([]);
                    }}
                    className="w-full text-left p-3 hover:bg-secondary border-b border-border last:border-b-0"
                  >
                    <div className="font-medium text-foreground">{patient.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {patient.age && `${patient.age}y`} {patient.gender}
                      {patient.phone && ` • ${patient.phone}`}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Patient */}
            {selectedPatient && (
              <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <div className="font-medium text-green-900 dark:text-green-100">{selectedPatient.full_name}</div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      {selectedPatient.age && `${selectedPatient.age}y`} {selectedPatient.gender}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientSearch('');
                  }}
                  className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Admission ID (Optional) */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Admission ID (Optional)
            </label>
            <input
              type="text"
              value={admissionId}
              onChange={(e) => setAdmissionId(e.target.value)}
              placeholder="Link to existing admission"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If patient has an active IPD admission, enter the admission ID to link this bed assignment
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any relevant notes..."
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
              disabled={isLoading || !selectedPatient}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Assigning...' : 'Assign Bed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
