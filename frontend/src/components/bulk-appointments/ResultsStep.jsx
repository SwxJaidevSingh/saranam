/**
 * Results Step - Show creation results and summary
 */
import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { CheckCircle2, XCircle, PartyPopper } from 'lucide-react';

const ResultsStep = ({ sessionData, onComplete }) => {
  // Get results from session data (passed through onNext)
  const results = sessionData?.results || {};

  const handleClose = () => {
    if (onComplete) {
      onComplete(results);
    }
  };

  const createdCount = results.created_count || 0;
  const failedCount = results.failed_count || 0;
  const patientsCreated = results.patients_created || 0;

  return (
    <div className="space-y-6">
      {createdCount > 0 ? (
        <Alert className="border-green-200 bg-green-50">
          <PartyPopper className="h-5 w-5 text-green-600" />
          <div className="ml-2">
            <p className="font-bold text-lg text-green-700">Success!</p>
            <p className="text-sm text-green-600 mt-1">
              Appointments have been created successfully.
            </p>
          </div>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <XCircle className="h-5 w-5" />
          <div className="ml-2">
            <p className="font-bold text-lg">No Appointments Created</p>
            <p className="text-sm mt-1">
              No appointments could be created. Please review the errors below.
            </p>
          </div>
        </Alert>
      )}

      {/* Results Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="text-4xl font-bold text-green-700 mb-2">
            {createdCount}
          </div>
          <div className="text-sm text-green-600 mb-1">Appointments Created</div>
          <div className="text-xs text-muted-foreground">
            Successfully added to calendar
          </div>
        </Card>

        {patientsCreated > 0 && (
          <Card className="p-6 border-blue-200 bg-blue-50">
            <div className="text-4xl font-bold text-blue-700 mb-2">
              {patientsCreated}
            </div>
            <div className="text-sm text-blue-600 mb-1">New Patients Created</div>
            <div className="text-xs text-muted-foreground">
              Added to patient database
            </div>
          </Card>
        )}

        {failedCount > 0 && (
          <Card className="p-6 border-red-200 bg-red-50">
            <div className="text-4xl font-bold text-red-700 mb-2">
              {failedCount}
            </div>
            <div className="text-sm text-red-600 mb-1">Failed</div>
            <div className="text-xs text-muted-foreground">
              Could not be created
            </div>
          </Card>
        )}
      </div>

      {/* Session Details */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Import Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Rows Processed:</span>
            <span className="font-medium">{results.total_processed || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto-Approved:</span>
            <span className="font-medium text-green-600">{results.auto_approved || 0}</span>
          </div>
          {results.needs_review > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">With Minor Conflicts:</span>
              <span className="font-medium text-yellow-600">{results.needs_review}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="font-medium text-green-600">{createdCount}</span>
          </div>
          {failedCount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failed:</span>
              <span className="font-medium text-red-600">{failedCount}</span>
            </div>
          )}
          {patientsCreated > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Patients:</span>
              <span className="font-medium text-blue-600">{patientsCreated}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Next Steps */}
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <div className="ml-2">
          <p className="font-medium">Next Steps</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 ml-2 space-y-1">
            <li>View created appointments in the calendar</li>
            <li>Send confirmation messages to patients</li>
            {failedCount > 0 && <li>Review failed appointments and retry if needed</li>}
          </ul>
        </div>
      </Alert>

      {/* Close Button */}
      <div className="flex justify-center">
        <Button onClick={handleClose} size="lg">
          Close & View Appointments
        </Button>
      </div>
    </div>
  );
};

export default ResultsStep;
