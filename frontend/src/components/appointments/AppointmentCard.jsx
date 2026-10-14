/**
 * AppointmentCard Component
 * Displays a single appointment in card format
 */
import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  MoreVertical
} from 'lucide-react';
import moment from 'moment';

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

const AppointmentCard = ({ appointment, onClick, variant = 'default' }) => {
  if (!appointment) return null;

  const statusColor = STATUS_COLORS[appointment.status] || 'bg-secondary text-muted-foreground';
  const isCompact = variant === 'compact';

  return (
    <Card
      className={`${
        isCompact ? 'p-3' : 'p-4'
      } hover:shadow-md transition-shadow cursor-pointer border-l-4 ${
        appointment.status === 'cancelled' ? 'border-l-red-500 dark:border-l-red-400' :
        appointment.status === 'completed' ? 'border-l-border' :
        appointment.status === 'checked_in' ? 'border-l-amber-500 dark:border-l-amber-400' :
        'border-l-blue-500 dark:border-l-blue-400'
      }`}
      onClick={() => onClick && onClick(appointment)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          {/* Header: Patient Name and Status */}
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold ${isCompact ? 'text-sm' : 'text-base'} text-foreground`}>
              <User className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} inline mr-2`} />
              {appointment.patient_name}
            </h3>
            <Badge className={`${statusColor} ${isCompact ? 'text-xs px-2 py-0' : ''}`}>
              {appointment.status.replace(/-/g, ' ').toUpperCase()}
            </Badge>
          </div>

          {/* Date and Time */}
          <div className={`flex items-center gap-4 ${isCompact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
            <div className="flex items-center gap-1">
              <Calendar className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'}`} />
              <span>{moment(appointment.start_time).format('MMM D, YYYY')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'}`} />
              <span>
                {moment(appointment.start_time).format('h:mm A')}
                {appointment.duration && ` (${appointment.duration} min)`}
              </span>
            </div>
          </div>

          {/* Provider */}
          {appointment.provider_name && !isCompact && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Stethoscope className="h-4 w-4" />
              <span>
                {appointment.provider_name}
                {appointment.provider_specialization && (
                  <span className="text-muted-foreground/70"> • {appointment.provider_specialization}</span>
                )}
              </span>
            </div>
          )}

          {/* Appointment Type */}
          {appointment.appointment_type && !isCompact && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="capitalize">{appointment.appointment_type.replace(/_/g, ' ')}</span>
            </div>
          )}

          {/* Chief Complaint */}
          {appointment.chief_complaint && !isCompact && (
            <div className="text-sm text-foreground bg-secondary rounded p-2 mt-2">
              <span className="font-medium">Chief Complaint:</span> {appointment.chief_complaint}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isCompact && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onClick && onClick(appointment);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};

export default AppointmentCard;
