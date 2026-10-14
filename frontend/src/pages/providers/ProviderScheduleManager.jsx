import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { 
  ArrowLeft, 
  Save, 
  Clock,
  Calendar,
  AlertCircle
} from 'lucide-react';
import providersApi from '../../api/providers';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' }
];

export default function ProviderScheduleManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [provider, setProvider] = useState(null);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const getInitialSchedules = () => {
    const initial = {};
    DAYS_OF_WEEK.forEach(day => {
      initial[day.value] = {
        day_of_week: day.value,
        is_active: false,
        start_time: '09:00',
        end_time: '17:00',
        slot_duration: 30,
        max_appointments_per_slot: 1
      };
    });
    return initial;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch provider details
        const providerData = await providersApi.getById(id);
        setProvider(providerData);

        // Fetch existing schedules
        const scheduleResponse = await providersApi.getSchedule(id);
        
        const loadedSchedules = getInitialSchedules();
        
        if (scheduleResponse && scheduleResponse.schedules && scheduleResponse.schedules.length > 0) {
          scheduleResponse.schedules.forEach(sched => {
            // Reformat times slightly for HTML inputs
            const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '';
            
            loadedSchedules[sched.day_of_week] = {
              ...sched,
              start_time: formatTime(sched.start_time),
              end_time: formatTime(sched.end_time)
            };
          });
        } else {
          // If no schedule exists on server, default standard days (Mon-Fri) to active
          for (let i = 0; i < 5; i++) {
              loadedSchedules[i].is_active = true;
          }
        }
        
        setSchedules(loadedSchedules);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load schedule data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleScheduleChange = (dayValue, field, value) => {
    setSchedules(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        [field]: value
      }
    }));
  };

  const toggleDayActive = (dayValue) => {
    setSchedules(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        is_active: !prev[dayValue].is_active
      }
    }));
  };

  const applyScheduleToAllActive = (sourceDayValue) => {
    const sourceData = schedules[sourceDayValue];
    setSchedules(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key].is_active && parseInt(key) !== sourceDayValue) {
          updated[key] = {
            ...updated[key],
            start_time: sourceData.start_time,
            end_time: sourceData.end_time,
            slot_duration: sourceData.slot_duration,
            max_appointments_per_slot: sourceData.max_appointments_per_slot
          };
        }
      });
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Format payload for API
      const payloadSchedules = Object.values(schedules);

      await providersApi.createBulkSchedule(id, payloadSchedules);
      setSuccess(true);
      
      // Auto-hide success message
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving schedules:', err);
      setError(err.response?.data?.error || 'Failed to save schedules. Please check your inputs.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg shadow-sm">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            onClick={() => navigate(`/providers/${id}`)}
            className="w-fit mb-2 text-muted-foreground hover:text-foreground px-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Provider Profile
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Schedule Manager</h1>
            {provider?.is_active ? 
              <Badge variant="success">Active</Badge> : 
              <Badge variant="error" className="bg-red-100 text-red-800">Inactive Provider</Badge>
            }
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Managing schedule for <span className="font-medium text-foreground">{provider?.full_name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {success && (
            <Badge variant="success" className="h-10 text-sm px-4 flex items-center bg-green-100 text-green-800">
              Saved Successfully
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Schedule'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="bg-red-50 text-red-800 border-red-200">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      <Card className="p-6">
        <div className="grid gap-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-lg font-medium">Weekly Working Hours</h3>
              <p className="text-sm text-muted-foreground">Define the days and times this provider is available for appointments.</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Header sequence - hidden on smaller screens */}
            <div className="hidden xl:grid grid-cols-10 gap-4 text-sm font-medium text-muted-foreground px-4">
              <div className="col-span-2">Day</div>
              <div className="col-span-4 pl-4">Working Hours</div>
              <div className="col-span-4">Configuration</div>
            </div>

            {DAYS_OF_WEEK.map((day) => {
              const sched = schedules[day.value];
              if (!sched) return null;

              return (
                <div key={day.value} className={`flex flex-col xl:grid xl:grid-cols-10 gap-4 xl:items-center p-4 border rounded-lg transition-colors ${sched.is_active ? 'bg-card border-primary/20 shadow-sm' : 'bg-secondary border-border'}`}>
                  {/* Day Toggle */}
                  <div className="col-span-1 xl:col-span-2 flex items-center justify-between xl:justify-start pb-4 xl:pb-0 border-b xl:border-0 border-border mb-2 xl:mb-0">
                    <span className={`font-medium ${sched.is_active ? 'text-foreground' : 'text-muted-foreground/70'}`}>
                      {day.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleDayActive(day.value)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ml-4 ${
                        sched.is_active ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          sched.is_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Active Fields */}
                  {sched.is_active ? (
                    <>
                      {/* Working Hours */}
                      <div className="col-span-1 xl:col-span-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <span className="xl:hidden text-xs text-muted-foreground font-medium w-24">Working Hours:</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={sched.start_time}
                            onChange={(e) => handleScheduleChange(day.value, 'start_time', e.target.value)}
                            className="w-32 text-sm"
                          />
                          <span className="text-muted-foreground/70">to</span>
                          <Input
                            type="time"
                            value={sched.end_time}
                            onChange={(e) => handleScheduleChange(day.value, 'end_time', e.target.value)}
                            className="w-32 text-sm"
                          />
                        </div>
                      </div>

                      {/* Configuration & Actions */}
                      <div className="col-span-1 xl:col-span-4 flex flex-col sm:flex-row xl:flex-col gap-3 pt-2 xl:pt-0 border-t xl:border-0 border-border xl:px-4">
                        <div className="flex flex-wrap gap-4 items-center">
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-muted-foreground w-16">Duration:</label>
                            <select
                              value={sched.slot_duration.toString()}
                              onChange={(e) => handleScheduleChange(day.value, 'slot_duration', parseInt(e.target.value))}
                              className="w-24 text-sm h-9 rounded-md border border-input bg-transparent px-3 py-1 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="15">15 min</option>
                              <option value="20">20 min</option>
                              <option value="30">30 min</option>
                              <option value="45">45 min</option>
                              <option value="60">60 min</option>
                            </select>
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-muted-foreground w-24">Capacity/Slot:</label>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={sched.max_appointments_per_slot}
                              onChange={(e) => handleScheduleChange(day.value, 'max_appointments_per_slot', parseInt(e.target.value) || 1)}
                              className="w-16 text-sm h-9"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end xl:justify-start w-full mt-1 xl:mt-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => applyScheduleToAllActive(day.value)}
                            className="text-xs h-8 text-primary hover:text-primary-700 p-0 flex items-center"
                            title="Copy this row's settings to all other active days"
                          >
                            Apply to All Active Days
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="xl:col-span-8 text-muted-foreground/70 text-sm italic pt-2 xl:pt-0">
                      Provider is not scheduled to work on this day.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
