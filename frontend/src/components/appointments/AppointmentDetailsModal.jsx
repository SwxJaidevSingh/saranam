/**
 * AppointmentDetailsModal Component
 * Displays full appointment details with actions (check-in, reschedule, cancel, complete)
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Alert } from '../ui/alert';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save
} from 'lucide-react';
import moment from 'moment';
import appointmentsApi from '../../api/appointments';

const STATUS_COLORS = {
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  confirmed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  checked_in: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'in-progress': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-secondary text-muted-foreground',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  'no-show': 'bg-red-500/10 text-red-600 dark:text-red-400',
  rescheduled: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
};

const AppointmentDetailsModal = ({ open, onClose, appointment, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  if (!appointment) return null;

  const handleCheckIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await appointmentsApi.checkIn(appointment.id);

      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (err) {
      console.error('Error checking in:', err);
      setError(err.response?.data?.message || 'Failed to check in patient');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      setError('Please provide a reason for cancellation');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await appointmentsApi.cancel(appointment.id, cancellationReason);

      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setError(err.response?.data?.message || 'Failed to cancel appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      setError(null);
      await appointmentsApi.complete(appointment.id, completionNotes || null);

      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (err) {
      console.error('Error completing appointment:', err);
      setError(err.response?.data?.message || 'Failed to complete appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = () => {
    // TODO: Open reschedule modal
    alert('Reschedule functionality coming soon! You can cancel this appointment and create a new one.');
  };

  const canCheckIn = appointment.status === 'scheduled' || appointment.status === 'confirmed';
  const canComplete = appointment.status === 'checked_in' || appointment.status === 'in-progress';
  const canCancel = !['completed', 'cancelled', 'no-show'].includes(appointment.status);

  // Show cancel form
  if (showCancelForm) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this appointment.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Cancellation Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for cancellation..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelForm(false);
                setCancellationReason('');
                setError(null);
              }}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show complete form
  if (showCompleteForm) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Complete Appointment
            </DialogTitle>
            <DialogDescription>
              Mark this appointment as completed and add any final notes.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-4">
              {error}
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Completion Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Enter any notes about the appointment..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCompleteForm(false);
                setCompletionNotes('');
                setError(null);
              }}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              onClick={handleComplete}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              {loading ? 'Completing...' : 'Mark as Completed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Main details view
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Appointment Details</span>
            <Badge className={STATUS_COLORS[appointment.status] || 'bg-secondary text-muted-foreground'}>
              {appointment.status.replace(/-/g, ' ').toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {moment(appointment.start_time).format('MMMM D, YYYY [at] h:mm A')}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="space-y-6 py-4">
          {/* Patient Information */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              Patient Information
            </h4>
            <div className="bg-secondary rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{appointment.patient_name}</p>
                </div>
                {appointment.patient_mrn && (
                  <div>
                    <p className="text-xs text-muted-foreground">MRN</p>
                    <p className="font-medium">{appointment.patient_mrn}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Provider Information */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <Stethoscope className="h-4 w-4" />
              Healthcare Provider
            </h4>
            <div className="bg-secondary rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{appointment.provider_name || 'Not assigned'}</p>
                </div>
                {appointment.provider_specialization && (
                  <div>
                    <p className="text-xs text-muted-foreground">Specialization</p>
                    <p className="font-medium">{appointment.provider_specialization}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Appointment Details
            </h4>
            <div className="bg-secondary rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{appointment.appointment_type?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{appointment.duration || 30} minutes</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{moment(appointment.start_time).format('MMMM D, YYYY')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {moment(appointment.start_time).format('h:mm A')} - {moment(appointment.end_time).format('h:mm A')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Chief Complaint */}
          {appointment.chief_complaint && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                Chief Complaint
              </h4>
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-sm text-foreground">{appointment.chief_complaint}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                Notes
              </h4>
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-sm text-foreground">{appointment.notes}</p>
              </div>
            </div>
          )}

          {/* Cancellation Info */}
          {appointment.status === 'cancelled' && appointment.cancellation_reason && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                Cancellation Reason
              </h4>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{appointment.cancellation_reason}</p>
                {appointment.cancelled_at && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Cancelled on {moment(appointment.cancelled_at).format('MMMM D, YYYY [at] h:mm A')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {/* Action buttons based on status */}
          {canCheckIn && (
            <Button
              onClick={handleCheckIn}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Check In Patient
            </Button>
          )}

          {canComplete && (
            <Button
              onClick={() => setShowCompleteForm(true)}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark as Completed
            </Button>
          )}

          {canCancel && (
            <>
              <Button
                variant="outline"
                onClick={handleReschedule}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reschedule
              </Button>

              <Button
                variant="destructive"
                onClick={() => setShowCancelForm(true)}
                disabled={loading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Appointment
              </Button>
            </>
          )}

          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailsModal;
