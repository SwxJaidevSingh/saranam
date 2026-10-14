import { useState } from 'react';
import { X, Mail, Download, Calendar, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const BULK_ACTIONS = [
  {
    id: 'send_email',
    label: 'Send Email',
    description: 'Send a bulk email to all selected patients',
    icon: Mail,
    requiresInput: true,
  },
  {
    id: 'export_csv',
    label: 'Export to CSV',
    description: 'Download patient data as CSV file',
    icon: Download,
    requiresInput: false,
  },
  {
    id: 'schedule_followup',
    label: 'Schedule Follow-up',
    description: 'Create follow-up reminders for selected patients',
    icon: Calendar,
    requiresInput: true,
  },
  {
    id: 'generate_report',
    label: 'Generate Report',
    description: 'Create a summary report for selected patients',
    icon: FileText,
    requiresInput: false,
  },
];

export function BulkActionDialog({ cohortId, selectedPatients, onClose, onComplete }) {
  const [selectedAction, setSelectedAction] = useState(null);
  const [actionInput, setActionInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleActionSelect = (actionId) => {
    setSelectedAction(actionId);
    setActionInput('');
    setError(null);
  };

  const handleExecute = async () => {
    if (!selectedAction) return;

    const action = BULK_ACTIONS.find(a => a.id === selectedAction);
    if (action.requiresInput && !actionInput.trim()) {
      setError('Please provide the required input');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      // Simulate API call for bulk action
      // In a real implementation, you would call the appropriate API endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Handle different actions
      switch (selectedAction) {
        case 'send_email':
          console.log('Sending email to patients:', selectedPatients, 'Message:', actionInput);
          alert(`Email sent to ${selectedPatients.length} patients successfully!`);
          break;

        case 'export_csv':
          console.log('Exporting CSV for patients:', selectedPatients);
          // Create and download CSV
          const csvData = generateCSV(selectedPatients);
          downloadCSV(csvData, `cohort-${cohortId}-patients-${new Date().toISOString().split('T')[0]}.csv`);
          break;

        case 'schedule_followup':
          console.log('Scheduling follow-ups for patients:', selectedPatients, 'Notes:', actionInput);
          alert(`Follow-up scheduled for ${selectedPatients.length} patients!`);
          break;

        case 'generate_report':
          console.log('Generating report for patients:', selectedPatients);
          alert(`Report generated for ${selectedPatients.length} patients!`);
          break;
      }

      onComplete();
    } catch (err) {
      console.error('Error executing bulk action:', err);
      setError(err.message || 'Failed to execute action');
    } finally {
      setProcessing(false);
    }
  };

  const generateCSV = (patientIds) => {
    // In a real implementation, you would fetch patient data from the API
    const headers = ['Patient ID', 'Action', 'Date'];
    const rows = patientIds.map(id => [id, selectedAction, new Date().toISOString()]);
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  };

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const selectedActionData = BULK_ACTIONS.find(a => a.id === selectedAction);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Actions</DialogTitle>
          <DialogDescription>
            Perform actions on {selectedPatients.length} selected{' '}
            {selectedPatients.length === 1 ? 'patient' : 'patients'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Selection */}
          <div>
            <Label className="mb-2 block">Select an action</Label>
            <div className="grid grid-cols-2 gap-3">
              {BULK_ACTIONS.map((action) => {
                const Icon = action.icon;
                const isSelected = selectedAction === action.id;
                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionSelect(action.id)}
                    className={`p-4 border rounded-lg text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary-50 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Input */}
          {selectedActionData && selectedActionData.requiresInput && (
            <>
              <Separator />
              <div>
                <Label htmlFor="action-input">
                  {selectedAction === 'send_email' ? 'Email Message' : 'Notes'}
                </Label>
                <Textarea
                  id="action-input"
                  placeholder={
                    selectedAction === 'send_email'
                      ? 'Enter your email message...'
                      : 'Enter notes or instructions...'
                  }
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
            </>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Summary */}
          {selectedAction && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Action Summary</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{selectedPatients.length} patients</Badge>
                <span>will be processed with action:</span>
                <Badge>{selectedActionData.label}</Badge>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            disabled={!selectedAction || processing}
            className="gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Execute Action'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
