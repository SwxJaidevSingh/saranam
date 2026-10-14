/**
 * Confirm Step - Final confirmation before creating appointments
 */
import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import pureLogicBulkApi from '../../api/pureLogicBulk';

const ConfirmStep = ({ sessionData, statistics, onNext, onBack, onError }) => {
  const [creating, setCreating] = useState(false);

  const totalToCreate = (statistics?.auto_approved_count || 0) +
                       (statistics?.needs_review_count || 0);

  const handleCreateAppointments = async () => {
    try {
      setCreating(true);
      onError(null);

      const response = await pureLogicBulkApi.createAppointments(sessionData.id);

      onNext({
        results: response
      });

    } catch (error) {
      onError('Failed to create appointments: ' + (error.response?.data?.error || error.message));
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <div className="ml-2">
          <p className="font-medium">Ready to Create Appointments</p>
          <p className="text-sm text-muted-foreground mt-1">
            Review the summary below and click "Create Appointments" to proceed.
          </p>
        </div>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="text-3xl font-bold text-green-700 mb-2">
            {totalToCreate}
          </div>
          <div className="text-sm text-green-600 mb-1">Appointments to Create</div>
          <div className="text-xs text-muted-foreground">
            All validations passed
          </div>
        </Card>

        <Card className="p-6 border-blue-200 bg-blue-50">
          <div className="text-3xl font-bold text-blue-700 mb-2">
            {statistics?.auto_approved_count || 0}
          </div>
          <div className="text-sm text-blue-600 mb-1">Auto-Approved</div>
          <div className="text-xs text-muted-foreground">
            No conflicts detected
          </div>
        </Card>

        {statistics?.needs_review_count > 0 && (
          <Card className="p-6 border-yellow-200 bg-yellow-50">
            <div className="text-3xl font-bold text-yellow-700 mb-2">
              {statistics.needs_review_count}
            </div>
            <div className="text-sm text-yellow-600 mb-1">With Minor Conflicts</div>
            <div className="text-xs text-muted-foreground">
              Will be created as-is
            </div>
          </Card>
        )}

        {statistics?.rejected_count > 0 && (
          <Card className="p-6 border-red-200 bg-red-50">
            <div className="text-3xl font-bold text-red-700 mb-2">
              {statistics.rejected_count}
            </div>
            <div className="text-sm text-red-600 mb-1">Rejected</div>
            <div className="text-xs text-muted-foreground">
              Will not be created
            </div>
          </Card>
        )}
      </div>

      {/* Warning if there are rejected items */}
      {statistics?.rejected_count > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <div className="ml-2">
            <p className="font-medium">Some appointments will be skipped</p>
            <p className="text-sm text-muted-foreground mt-1">
              {statistics.rejected_count} appointment(s) have validation errors and will not be created.
              You can download the error report after completion.
            </p>
          </div>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={creating}>
          Back
        </Button>
        <Button
          onClick={handleCreateAppointments}
          disabled={creating || totalToCreate === 0}
          size="lg"
        >
          {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {creating ? 'Creating Appointments...' : `Create ${totalToCreate} Appointments`}
        </Button>
      </div>

      {creating && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="ml-2">
            <p className="font-medium">Creating appointments...</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment. Please don't close this window.
            </p>
          </div>
        </Alert>
      )}
    </div>
  );
};

export default ConfirmStep;
