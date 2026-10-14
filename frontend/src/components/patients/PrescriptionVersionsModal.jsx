/**
 * PrescriptionVersionsModal — shows a patient's last 10 issued prescription PDFs
 * (immutable versions) and lets the user re-download any of them. Each download
 * is logged on the backend (analytics + medico-legal trail).
 */
import { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';
import { saranamApi } from '../../api/saranam';

const VISIT_TYPE_LABELS = {
  initial_assessment: 'Initial Assessment',
  follow_up: 'Follow-up',
  follow_up_visit: 'Follow-up',
  opd: 'OPD',
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PrescriptionVersionsModal({ patientId, patientName, open, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (!open || !patientId) return;
    let active = true;
    setLoading(true);
    setError('');
    saranamApi.listPrescriptionVersions(patientId, 10)
      .then((res) => { if (active) setVersions(res?.versions || []); })
      .catch(() => { if (active) setError('Could not load prescription PDFs.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, patientId]);

  const handleDownload = async (v) => {
    setDownloadingId(v.id);
    try {
      await saranamApi.downloadPrescriptionVersion(
        v.id,
        `Prescription_${(patientName || 'Patient').replace(/\s+/g, '_')}_v${v.version_number}.pdf`,
      );
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-foreground">Prescription PDFs</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          )}
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          {!loading && versions.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No prescription PDFs yet.</p>
              <p className="text-xs mt-1">Saving a prescription generates a downloadable version here.</p>
            </div>
          )}
          {!loading && versions.length > 0 && (
            <ul className="space-y-2">
              {versions.map((v) => {
                const doc = v.prescribing_doctor || {};
                const label = VISIT_TYPE_LABELS[v.visit_type] || v.visit_type || 'Prescription';
                return (
                  <li key={v.id}
                      className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                          v{v.version_number}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate">{label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {fmtDate(v.created_at)}
                        {doc.name ? ` · ${doc.name}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(v)}
                      disabled={downloadingId === v.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 transition-colors"
                    >
                      {downloadingId === v.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                      Download
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
