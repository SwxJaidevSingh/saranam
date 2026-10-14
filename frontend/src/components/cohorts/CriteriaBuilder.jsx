import { useState, useEffect } from 'react';
import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * CriteriaBuilder - Visual query builder for cohort criteria
 * Supports: age, gender, location, last_visit, forms_completed
 */
export function CriteriaBuilder({ value = {}, onChange }) {
  // Initialize criteria state from value prop
  const [criteria, setCriteria] = useState(value);

  // Update parent when criteria changes (but avoid initial call)
  useEffect(() => {
    // Only call onChange if criteria actually changed from initial value
    if (JSON.stringify(criteria) !== JSON.stringify(value)) {
      onChange(criteria);
    }
  }, [criteria]);

  // Age criteria handlers
  const handleAgeChange = (field, val) => {
    setCriteria(prev => ({
      ...prev,
      age: {
        ...prev.age,
        [field]: val === '' ? undefined : parseInt(val)
      }
    }));
  };

  const removeAgeCriteria = () => {
    const { age, ...rest } = criteria;
    setCriteria(rest);
  };

  // Gender criteria handlers
  const handleGenderChange = (genders) => {
    if (genders && genders.length > 0) {
      setCriteria(prev => ({
        ...prev,
        gender: genders
      }));
    } else {
      const { gender, ...rest } = criteria;
      setCriteria(rest);
    }
  };

  const toggleGender = (gender) => {
    const current = criteria.gender || [];
    if (current.includes(gender)) {
      handleGenderChange(current.filter(g => g !== gender));
    } else {
      handleGenderChange([...current, gender]);
    }
  };

  // Location criteria handlers
  const handleLocationChange = (field, val) => {
    if (val) {
      setCriteria(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [field]: val
        }
      }));
    } else {
      if (criteria.location) {
        const { [field]: removed, ...rest } = criteria.location;
        if (Object.keys(rest).length === 0) {
          const { location, ...restCriteria } = criteria;
          setCriteria(restCriteria);
        } else {
          setCriteria(prev => ({ ...prev, location: rest }));
        }
      }
    }
  };

  const removeLocationCriteria = () => {
    const { location, ...rest } = criteria;
    setCriteria(rest);
  };

  // Last visit criteria handlers
  const handleLastVisitChange = (field, val) => {
    setCriteria(prev => ({
      ...prev,
      last_visit: {
        ...prev.last_visit,
        [field]: val || undefined
      }
    }));
  };

  const removeLastVisitCriteria = () => {
    const { last_visit, ...rest } = criteria;
    setCriteria(rest);
  };

  // Forms completed criteria handlers
  const handleFormsCompletedChange = (field, val) => {
    setCriteria(prev => ({
      ...prev,
      forms_completed: {
        ...prev.forms_completed,
        [field]: val === '' ? undefined : parseInt(val)
      }
    }));
  };

  const removeFormsCompletedCriteria = () => {
    const { forms_completed, ...rest } = criteria;
    setCriteria(rest);
  };

  // Add new criteria
  const addCriteria = (type) => {
    switch (type) {
      case 'age':
        setCriteria(prev => ({ ...prev, age: { min: '', max: '' } }));
        break;
      case 'gender':
        setCriteria(prev => ({ ...prev, gender: [] }));
        break;
      case 'location':
        setCriteria(prev => ({ ...prev, location: {} }));
        break;
      case 'last_visit':
        setCriteria(prev => ({ ...prev, last_visit: { operator: 'within_days', days: '' } }));
        break;
      case 'forms_completed':
        setCriteria(prev => ({ ...prev, forms_completed: { min: '', max: '' } }));
        break;
    }
  };

  const availableFilters = [
    { value: 'age', label: 'Age Range', disabled: !!criteria.age },
    { value: 'gender', label: 'Gender', disabled: !!criteria.gender },
    { value: 'location', label: 'Location', disabled: !!criteria.location },
    { value: 'last_visit', label: 'Last Visit', disabled: !!criteria.last_visit },
    { value: 'forms_completed', label: 'Forms Completed', disabled: !!criteria.forms_completed },
  ];

  const activeCriteriaCount = Object.keys(criteria).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Selection Criteria</h3>
          <p className="text-sm text-muted-foreground">
            Define rules to identify patients for this cohort
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          {activeCriteriaCount} {activeCriteriaCount === 1 ? 'filter' : 'filters'} active
        </Badge>
      </div>

      {/* Active Criteria */}
      <div className="space-y-3">
        {/* Age Criteria */}
        {criteria.age && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Age Range</CardTitle>
                  <CardDescription>Filter patients by age</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={removeAgeCriteria}>
                  <Trash2 className="h-4 w-4 text-danger-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age-min">Minimum Age</Label>
                  <Input
                    id="age-min"
                    type="number"
                    placeholder="0"
                    value={criteria.age.min ?? ''}
                    onChange={(e) => handleAgeChange('min', e.target.value)}
                    min="0"
                    max="150"
                  />
                </div>
                <div>
                  <Label htmlFor="age-max">Maximum Age</Label>
                  <Input
                    id="age-max"
                    type="number"
                    placeholder="150"
                    value={criteria.age.max ?? ''}
                    onChange={(e) => handleAgeChange('max', e.target.value)}
                    min="0"
                    max="150"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gender Criteria */}
        {criteria.gender && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Gender</CardTitle>
                  <CardDescription>Filter by patient gender</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleGenderChange([])}>
                  <Trash2 className="h-4 w-4 text-danger-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['male', 'female', 'other'].map((gender) => (
                  <Button
                    key={gender}
                    variant={criteria.gender.includes(gender) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleGender(gender)}
                    className="capitalize"
                  >
                    {gender}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location Criteria */}
        {criteria.location && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Location</CardTitle>
                  <CardDescription>Filter by patient location</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={removeLocationCriteria}>
                  <Trash2 className="h-4 w-4 text-danger-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location-city">City</Label>
                  <Input
                    id="location-city"
                    placeholder="e.g., Chennai"
                    value={criteria.location.city ?? ''}
                    onChange={(e) => handleLocationChange('city', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="location-state">State</Label>
                  <Input
                    id="location-state"
                    placeholder="e.g., Tamil Nadu"
                    value={criteria.location.state ?? ''}
                    onChange={(e) => handleLocationChange('state', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last Visit Criteria */}
        {criteria.last_visit && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Last Visit</CardTitle>
                  <CardDescription>Filter by patient visit recency</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={removeLastVisitCriteria}>
                  <Trash2 className="h-4 w-4 text-danger-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="last-visit-operator">Condition</Label>
                  <Select
                    value={criteria.last_visit.operator || 'within_days'}
                    onValueChange={(val) => handleLastVisitChange('operator', val)}
                  >
                    <SelectTrigger id="last-visit-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="within_days">Within last</SelectItem>
                      <SelectItem value="before_days">More than</SelectItem>
                      <SelectItem value="between">Between</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="last-visit-days">Days</Label>
                  <Input
                    id="last-visit-days"
                    type="number"
                    placeholder="30"
                    value={criteria.last_visit.days ?? ''}
                    onChange={(e) => handleLastVisitChange('days', e.target.value)}
                    min="0"
                  />
                </div>
              </div>
              {criteria.last_visit.operator === 'between' && (
                <div className="mt-4">
                  <Label htmlFor="last-visit-end-days">End Days</Label>
                  <Input
                    id="last-visit-end-days"
                    type="number"
                    placeholder="60"
                    value={criteria.last_visit.end_days ?? ''}
                    onChange={(e) => handleLastVisitChange('end_days', e.target.value)}
                    min="0"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Forms Completed Criteria */}
        {criteria.forms_completed && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Forms Completed</CardTitle>
                  <CardDescription>Filter by number of completed forms</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={removeFormsCompletedCriteria}>
                  <Trash2 className="h-4 w-4 text-danger-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="forms-min">Minimum</Label>
                  <Input
                    id="forms-min"
                    type="number"
                    placeholder="0"
                    value={criteria.forms_completed.min ?? ''}
                    onChange={(e) => handleFormsCompletedChange('min', e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="forms-max">Maximum</Label>
                  <Input
                    id="forms-max"
                    type="number"
                    placeholder="100"
                    value={criteria.forms_completed.max ?? ''}
                    onChange={(e) => handleFormsCompletedChange('max', e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Criteria Dropdown */}
      {availableFilters.some(f => !f.disabled) && (
        <div>
          <Select onValueChange={addCriteria}>
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Add Filter</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableFilters.map((filter) => (
                <SelectItem
                  key={filter.value}
                  value={filter.value}
                  disabled={filter.disabled}
                >
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Help Text */}
      {activeCriteriaCount === 0 && (
        <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
          <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">No filters selected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add at least one filter to define your cohort. Patients matching all active
              filters will be included.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
