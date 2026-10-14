import { FileDown } from 'lucide-react';
import generateVisitPDF from '../../utils/generateVisitPDF';

export default function DownloadReportButton({ visit, visitType = 'OPD' }) {
  if (visit.status !== 'completed') return null;

  return (
    <button
      onClick={() => generateVisitPDF(visit, visitType)}
      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
    >
      <FileDown className="h-4 w-4" />
      Download Report
    </button>
  );
}
