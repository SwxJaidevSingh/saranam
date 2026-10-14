import React, { useState, useEffect } from 'react';
import { useServiceBooking } from '../ServiceBookingContext';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import appointmentsApi from '@/api/appointments';
import { format, addDays, isWeekend, startOfDay } from 'date-fns';
import { Clock, Calendar as CalendarIcon, User, AlertCircle, Loader2 } from 'lucide-react';

const ScheduleStep = () => {
  const { updateBookingData, bookingData } = useServiceBooking();
  const [selectedDate, setSelectedDate] = useState(
    bookingData.schedule.date ? new Date(bookingData.schedule.date) : null
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(bookingData.schedule.timeSlot);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate next 30 days for calendar
  const minDate = startOfDay(new Date());
  const maxDate = addDays(minDate, 30);

  useEffect(() => {
    if (selectedDate) {
      // Try to use real API if service and provider are selected
      if (!bookingData.service || !bookingData.provider) {
        console.log('Service or provider not selected, generating mock slots');
        generateMockTimeSlots();
      } else {
        console.log('Fetching real availability from API');
        fetchAvailableSlots();
      }
    }
  }, [selectedDate, bookingData.service, bookingData.provider]);

  const fetchAvailableSlots = async () => {
    setLoading(true);
    setError('');
    setAvailableSlots([]); // Clear previous slots while loading
    try {
      console.log('Fetching availability for:', {
        provider: bookingData.provider.id,
        date: format(selectedDate, 'yyyy-MM-dd')
      });

      const response = await appointmentsApi.getAvailableSlots(
        bookingData.provider.id,
        format(selectedDate, 'yyyy-MM-dd')
      );

      console.log('Availability response:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', response ? Object.keys(response) : 'null');

      // Try different response structures
      let availableSlots = [];

      // Check if response is directly an array
      if (Array.isArray(response)) {
        availableSlots = response;
      }
      // Check for nested data structures
      else if (response?.data) {
        if (Array.isArray(response.data)) {
          availableSlots = response.data;
        } else if (response.data.slots) {
          availableSlots = response.data.slots;
        } else if (response.data.available_slots) {
          availableSlots = response.data.available_slots;
        }
      }
      // Check for direct properties
      else if (response?.slots) {
        availableSlots = response.slots;
      } else if (response?.available_slots) {
        availableSlots = response.available_slots;
      }

      console.log('Extracted slots:', availableSlots);
      console.log('Slots count:', availableSlots.length);

      // Transform API slots to UI format if needed
      if (!availableSlots || availableSlots.length === 0) {
        console.log('No slots from API or empty response, generating mock slots as fallback');
        generateMockTimeSlots();
      } else {
        console.log('Processing slots from API:', availableSlots);

        // The backend now returns slots with 'time' field and 'available' flag
        if (availableSlots[0]?.time) {
          // Slots are already in the correct format from the backend
          const processedSlots = availableSlots.map(slot => ({
            time: slot.start_time, // Backend returns start_time
            available: slot.is_available, // Backend returns is_available
            formatted_time: formatTime(slot.start_time),
            capacity: slot.capacity || 0
          }));

          console.log('Processed slots:', processedSlots);
          setAvailableSlots(processedSlots);
        } else {
          // Fallback to mock data if format is unexpected
          console.log('Unexpected slot format, using mock data');
          generateMockTimeSlots();
        }
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      // Generate mock time slots as fallback
      generateMockTimeSlots();
    } finally {
      setLoading(false);
    }
  };

  const generateMockTimeSlots = () => {
    console.log('Generating mock time slots');
    // Generate time slots from 9 AM to 6 PM
    const slots = [];
    const slotDuration = 30; // 30 minute slots

    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        // All slots available when using mock data (no real bookings)
        const isAvailable = true;

        slots.push({
          time,
          available: isAvailable,
          formatted_time: formatTime(time)
        });
      }
    }

    console.log(`Generated ${slots.length} time slots`);
    setAvailableSlots(slots);
    setError(''); // Clear any error
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    updateBookingData('schedule.date', date ? format(date, 'yyyy-MM-dd') : null);
    setSelectedTimeSlot(null); // Reset time slot when date changes
    updateBookingData('schedule.timeSlot', null);

    // Don't clear slots immediately, let the useEffect handle it
    if (date) {
      setError('');
      // The useEffect will trigger and fetch/generate new slots
    } else {
      setAvailableSlots([]);
    }
  };

  const handleTimeSlotSelect = (slot) => {
    setSelectedTimeSlot(slot.time);
    updateBookingData('schedule.timeSlot', slot.time);
    updateBookingData('schedule.duration', bookingData.service?.duration || 30);
  };

  const isDateDisabled = (date) => {
    // Disable past dates
    if (date < minDate) return true;

    // Disable dates beyond 30 days
    if (date > maxDate) return true;

    // Check provider's available days
    const dayName = format(date, 'EEEE');
    const providerDays = bookingData.provider?.available_days || [];

    if (providerDays.length > 0 && !providerDays.includes(dayName)) {
      return true;
    }

    return false;
  };

  const getSlotStatus = (slot) => {
    if (!slot.available) return 'unavailable';
    if (selectedTimeSlot === slot.time) return 'selected';
    return 'available';
  };

  const getSlotClassName = (status) => {
    switch (status) {
      case 'unavailable':
        return 'bg-muted text-muted-foreground cursor-not-allowed';
      case 'selected':
        return 'bg-primary-600 dark:bg-primary-500 text-white ring-2 ring-primary-600 dark:ring-primary-500';
      case 'available':
        return 'bg-card hover:bg-primary-50 dark:hover:bg-primary-950 border-border hover:border-primary-400 dark:hover:border-primary-600 cursor-pointer';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider and Service Info */}
      <div className="bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-primary-700 dark:text-primary-300">Service:</p>
            <p className="font-semibold text-primary-900 dark:text-primary-100">
              {bookingData.service?.name}
            </p>
            {bookingData.service?.duration && (
              <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                Duration: {bookingData.service.duration} minutes
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-primary-700 dark:text-primary-300">Provider:</p>
            <p className="font-semibold text-primary-900 dark:text-primary-100">
              {bookingData.provider?.full_name}
            </p>
            {bookingData.provider?.specialization && (
              <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                {bookingData.provider.specialization}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <CalendarIcon className="mr-2 h-5 w-5" />
            Select Date
          </h3>
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                className="rounded-md"
                initialFocus
              />

              {bookingData.provider?.available_days && (
                <div className="mt-4 p-3 bg-accent rounded-md">
                  <p className="text-sm text-muted-foreground flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Available on: {bookingData.provider.available_days.join(', ')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Time Slots */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Select Time
          </h3>

          {!selectedDate ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Please select a date first</p>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="p-8 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
                <span className="ml-3 text-muted-foreground">Loading available slots...</span>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-danger-400 dark:text-danger-500" />
                <p className="text-danger-600 dark:text-danger-400">{error}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[400px] overflow-hidden">
              <CardContent className="p-4 h-full">
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 h-full overflow-y-auto">
                    {availableSlots.map(slot => {
                      const status = getSlotStatus(slot);
                      return (
                        <button
                          key={slot.time}
                          onClick={() => status === 'available' && handleTimeSlotSelect(slot)}
                          disabled={status === 'unavailable'}
                          className={`px-3 py-2 rounded-md border text-sm font-medium transition-all ${getSlotClassName(status)}`}
                        >
                          {slot.formatted_time || formatTime(slot.time)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p>No time slots available</p>
                    <p className="text-sm mt-2">Please try selecting a different date</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Selected Schedule Summary */}
          {selectedDate && selectedTimeSlot && (
            <div className="mt-4 p-4 bg-success-50 dark:bg-success-950 border border-success-200 dark:border-success-800 rounded-lg">
              <p className="text-sm text-success-700 dark:text-success-300">Selected Schedule:</p>
              <p className="font-semibold text-success-900 dark:text-success-100">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')} at {formatTime(selectedTimeSlot)}
              </p>
              {bookingData.service?.duration && (
                <p className="text-sm text-success-700 dark:text-success-300 mt-1">
                  Duration: {bookingData.service.duration} minutes
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleStep;