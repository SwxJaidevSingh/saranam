/**
 * AppointmentCalendar Component
 * Full-featured calendar view for appointments using react-big-calendar
 * Supports day, week, and month views with drag-drop rescheduling
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './AppointmentCalendar.css';
import appointmentsApi from '../../api/appointments';
import servicesApi from '../../api/services';
import { Alert } from '../ui/alert';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { getEventColors } from '../../utils/serviceColors';
import { useTheme } from '../../context/ThemeContext';

// Setup localizer for calendar
const localizer = momentLocalizer(moment);

// Theme-aware status color mapping
const STATUS_COLORS_LIGHT = {
  scheduled: '#3b82f6',    // blue
  confirmed: '#10b981',    // green
  checked_in: '#f59e0b',   // amber
  'in-progress': '#8b5cf6', // purple
  completed: '#6b7280',    // gray
  cancelled: '#ef4444',    // red
  'no-show': '#dc2626',    // dark red
  rescheduled: '#06b6d4'   // cyan
};

const STATUS_COLORS_DARK = {
  scheduled: '#60a5fa',    // blue-400
  confirmed: '#4ade80',    // green-400
  checked_in: '#fbbf24',   // amber-400
  'in-progress': '#a78bfa', // purple-400
  completed: '#9ca3af',    // gray-400
  cancelled: '#f87171',    // red-400
  'no-show': '#ef4444',    // red-500
  rescheduled: '#22d3ee'   // cyan-400
};

const AppointmentCalendar = ({
  providerId = null,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  enableDragDrop = false,
  defaultView = 'week',
  eventTypeFilter = 'all', // 'all', 'appointments', 'services'
  serviceTypeFilter = null // null or specific service type (IPD, OPD, etc.)
}) => {
  const { theme } = useTheme();
  const STATUS_COLORS = theme === 'dark' ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState(defaultView);
  const [date, setDate] = useState(new Date());

  // Fetch appointments and service bookings based on current date range
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range based on current view
      let fromDate, toDate;
      const mDate = moment(date);

      switch (view) {
        case 'day':
          fromDate = moment(mDate).startOf('day').toISOString();
          toDate = moment(mDate).endOf('day').toISOString();
          break;
        case 'week':
          fromDate = moment(mDate).startOf('week').toISOString();
          toDate = moment(mDate).endOf('week').toISOString();
          break;
        case 'month':
          fromDate = moment(mDate).startOf('month').subtract(7, 'days').toISOString();
          toDate = moment(mDate).endOf('month').add(7, 'days').toISOString();
          break;
        default:
          fromDate = moment(mDate).startOf('week').toISOString();
          toDate = moment(mDate).endOf('week').toISOString();
      }

      // Fetch both appointments and service bookings in parallel
      const promises = [];

      // Fetch regular appointments if needed
      if (eventTypeFilter === 'all' || eventTypeFilter === 'appointments') {
        const params = {
          from_date: fromDate,
          to_date: toDate,
          provider_id: providerId
        };
        promises.push(appointmentsApi.list(params));
      } else {
        promises.push(Promise.resolve({ appointments: [] }));
      }

      // Fetch service bookings if needed
      if (eventTypeFilter === 'all' || eventTypeFilter === 'services') {
        const serviceParams = serviceTypeFilter ? { service_type: serviceTypeFilter } : {};
        promises.push(servicesApi.getBookingsCalendar(fromDate, toDate, serviceParams));
      } else {
        promises.push(Promise.resolve({ bookings: [] }));
      }

      const [appointmentsResponse, bookingsResponse] = await Promise.all(promises);

      // Transform appointments to calendar events format
      const appointmentEvents = (appointmentsResponse.appointments || []).map(apt => ({
        id: apt.id,
        title: `${apt.patient_name} - ${apt.appointment_type}`,
        start: new Date(apt.start_time),
        end: new Date(apt.end_time),
        resource: {
          ...apt,
          type: 'appointment',
          color: STATUS_COLORS[apt.status] || '#6b7280'
        }
      }));

      // Transform service bookings to calendar events format
      const serviceEvents = (bookingsResponse.bookings || []).map(booking => {
        const colors = getEventColors('service', booking.service?.type);
        return {
          id: booking.id,
          title: booking.title || `${booking.patient?.name} - ${booking.service?.name}`,
          start: new Date(booking.start_time),
          end: new Date(booking.end_time),
          resource: {
            ...booking,
            type: 'service',
            color: colors.backgroundColor
          }
        };
      });

      // Combine both types of events
      const allEvents = [...appointmentEvents, ...serviceEvents];
      setAppointments(allEvents);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [date, view, providerId, eventTypeFilter, serviceTypeFilter]);

  // Fetch appointments when date, view, or provider changes
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Handle event selection (clicking on an appointment)
  const handleSelectEvent = useCallback((event) => {
    if (onSelectEvent) {
      onSelectEvent(event.resource);
    }
  }, [onSelectEvent]);

  // Handle slot selection (clicking on empty time slot)
  const handleSelectSlot = useCallback((slotInfo) => {
    if (onSelectSlot) {
      onSelectSlot({
        start: slotInfo.start,
        end: slotInfo.end,
        slots: slotInfo.slots
      });
    }
  }, [onSelectSlot]);

  // Handle event drop (drag-and-drop rescheduling)
  const handleEventDrop = useCallback(async ({ event, start, end }) => {
    if (!enableDragDrop) return;

    try {
      // Optimistically update UI
      const updatedEvents = appointments.map(apt =>
        apt.id === event.id
          ? { ...apt, start, end }
          : apt
      );
      setAppointments(updatedEvents);

      // Call API to reschedule
      if (onEventDrop) {
        await onEventDrop({
          appointmentId: event.id,
          newStartTime: start.toISOString(),
          duration: Math.round((end - start) / 60000) // minutes
        });
      }

      // Refresh appointments
      await fetchAppointments();
    } catch (err) {
      console.error('Error rescheduling appointment:', err);
      setError('Failed to reschedule appointment.');
      // Revert optimistic update
      await fetchAppointments();
    }
  }, [appointments, enableDragDrop, onEventDrop, fetchAppointments]);

  // Custom event style based on appointment status
  const eventStyleGetter = useCallback((event) => {
    const backgroundColor = event.resource?.color || '#6b7280';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.95,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: view === 'month' ? '0.7rem' : '0.875rem',
        padding: view === 'month' ? '2px 4px' : '2px 5px',
        fontWeight: '500',
        lineHeight: '1.2',
        cursor: 'pointer'
      }
    };
  }, [view]);

  // Custom event component for better display in month view
  const CustomEvent = ({ event }) => {
    return (
      <div style={{
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%'
      }}>
        <strong>{event.title}</strong>
      </div>
    );
  };

  // Custom toolbar for navigation and view selection
  const CustomToolbar = (toolbar) => {
    const goToBack = () => {
      const newDate = moment(toolbar.date).subtract(1, toolbar.view === 'month' ? 'months' : toolbar.view === 'week' ? 'weeks' : 'days').toDate();
      toolbar.onNavigate('prev', newDate);
      setDate(newDate);
    };

    const goToNext = () => {
      const newDate = moment(toolbar.date).add(1, toolbar.view === 'month' ? 'months' : toolbar.view === 'week' ? 'weeks' : 'days').toDate();
      toolbar.onNavigate('next', newDate);
      setDate(newDate);
    };

    const goToToday = () => {
      const today = new Date();
      toolbar.onNavigate('TODAY', today);
      setDate(today);
    };

    const label = () => {
      const date = moment(toolbar.date);
      return toolbar.view === 'month'
        ? date.format('MMMM YYYY')
        : toolbar.view === 'week'
        ? `${date.startOf('week').format('MMM D')} - ${date.endOf('week').format('MMM D, YYYY')}`
        : date.format('MMMM D, YYYY');
    };

    return (
      <div className="rbc-toolbar">
        <span className="rbc-btn-group">
          <Button onClick={goToBack} variant="outline" size="sm">←</Button>
          <Button onClick={goToToday} variant="outline" size="sm">Today</Button>
          <Button onClick={goToNext} variant="outline" size="sm">→</Button>
        </span>
        <span className="rbc-toolbar-label">{label()}</span>
        <span className="rbc-btn-group">
          <Button
            onClick={() => {
              toolbar.onView('day');
              setView('day');
            }}
            variant={toolbar.view === 'day' ? 'default' : 'outline'}
            size="sm"
          >
            Day
          </Button>
          <Button
            onClick={() => {
              toolbar.onView('week');
              setView('week');
            }}
            variant={toolbar.view === 'week' ? 'default' : 'outline'}
            size="sm"
          >
            Week
          </Button>
          <Button
            onClick={() => {
              toolbar.onView('month');
              setView('month');
            }}
            variant={toolbar.view === 'month' ? 'default' : 'outline'}
            size="sm"
          >
            Month
          </Button>
        </span>
      </div>
    );
  };

  // Calendar configuration
  const calendarConfig = useMemo(() => ({
    localizer,
    events: appointments,
    defaultView,
    view,
    date,
    onNavigate: (newDate) => setDate(newDate),
    onView: (newView) => setView(newView),
    onSelectEvent: handleSelectEvent,
    onSelectSlot: handleSelectSlot,
    onEventDrop: enableDragDrop ? handleEventDrop : undefined,
    eventPropGetter: eventStyleGetter,
    selectable: true,
    resizable: enableDragDrop,
    draggableAccessor: () => enableDragDrop,
    step: 15,
    timeslots: 4,
    defaultDate: new Date(),
    min: new Date(2024, 0, 1, 8, 0, 0),  // 8 AM
    max: new Date(2024, 0, 1, 20, 0, 0), // 8 PM
    components: {
      toolbar: CustomToolbar,
      event: CustomEvent
    },
    formats: {
      timeGutterFormat: 'h:mm A',
      eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
        localizer.format(start, 'h:mm A', culture) + ' - ' +
        localizer.format(end, 'h:mm A', culture),
      agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
        localizer.format(start, 'h:mm A', culture) + ' - ' +
        localizer.format(end, 'h:mm A', culture),
    }
  }), [appointments, date, view, defaultView, handleSelectEvent, handleSelectSlot, handleEventDrop, eventStyleGetter, enableDragDrop]);

  if (loading && appointments.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading appointments...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {error && (
        <Alert variant="destructive" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Calendar Legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="text-sm font-medium text-foreground">Status:</div>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-muted-foreground capitalize">
              {status.replace(/-/g, ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="appointment-calendar" style={{ height: '700px' }}>
        <Calendar {...calendarConfig} />
      </div>

      {/* Stats */}
      <div className="mt-4 flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Showing {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
        </div>
        {enableDragDrop && (
          <div className="text-xs text-muted-foreground/70">
            Tip: Drag and drop appointments to reschedule
          </div>
        )}
      </div>
    </Card>
  );
};

export default AppointmentCalendar;
