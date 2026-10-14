import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CriteriaBuilder } from '@/components/cohorts/CriteriaBuilder';
import { createCohort, getCohort, updateCohort } from '@/api/cohorts';

export default function CohortBuilder() {
  const navigate = useNavigate();
  const { cohortId } = useParams();
  const isEditing = !!cohortId;

  // Form state
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    criteria: {},
    auto_update: true,
    update_frequency: 'daily',
    is_active: true,
  });

  const [validationErrors, setValidationErrors] = useState({});

  // Load existing cohort if editing
  useEffect(() => {
    if (isEditing) {
      loadCohort();
    }
  }, [cohortId]);

  const loadCohort = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCohort(cohortId);
      setFormData({
        name: data.cohort.name,
        description: data.cohort.description || '',
        criteria: data.cohort.criteria || {},
        auto_update: data.cohort.auto_update,
        update_frequency: data.cohort.update_frequency,
        is_active: data.cohort.is_active,
      });
    } catch (err) {
      console.error('Error loading cohort:', err);
      setError(err.response?.data?.error || 'Failed to load cohort');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const { [field]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleCriteriaChange = (criteria) => {
    setFormData(prev => ({ ...prev, criteria }));
    if (validationErrors.criteria) {
      setValidationErrors(prev => {
        const { criteria: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const validate = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.length > 200) {
      errors.name = 'Name must be less than 200 characters';
    }

    if (formData.description && formData.description.length > 1000) {
      errors.description = 'Description must be less than 1000 characters';
    }

    if (!formData.criteria || Object.keys(formData.criteria).length === 0) {
      errors.criteria = 'At least one selection criterion is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing) {
        await updateCohort(cohortId, formData);
      } else {
        await createCohort(formData);
      }

      navigate('/cohorts');
    } catch (err) {
      console.error('Error saving cohort:', err);
      setError(err.response?.data?.error || 'Failed to save cohort');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/cohorts');
  };

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error && isEditing) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading cohort</p>
          <p className="text-sm mt-1">{error}</p>
          <Button onClick={loadCohort} variant="outline" className="mt-3" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Cohort' : 'Create New Cohort'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? 'Update cohort settings and selection criteria'
              : 'Define a new patient cohort with custom selection criteria'}
          </p>
        </div>
        {isEditing && (
          <Badge variant={formData.is_active ? 'default' : 'outline'}>
            {formData.is_active ? 'Active' : 'Inactive'}
          </Badge>
        )}
      </div>

      {/* Error Alert */}
      {error && !isEditing && (
        <div className="bg-danger-50 border border-danger-200 text-danger-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error saving cohort</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Give your cohort a descriptive name and purpose
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cohort-name">
              Cohort Name <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="cohort-name"
              placeholder="e.g., Diabetic Patients for Q1 Review"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={validationErrors.name ? 'border-danger-500' : ''}
            />
            {validationErrors.name && (
              <p className="text-sm text-danger-600 mt-1">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="cohort-description">Description</Label>
            <Textarea
              id="cohort-description"
              placeholder="Describe the purpose of this cohort and how it will be used..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className={validationErrors.description ? 'border-danger-500' : ''}
            />
            {validationErrors.description && (
              <p className="text-sm text-danger-600 mt-1">{validationErrors.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selection Criteria */}
      <Card>
        <CardHeader>
          <CardTitle>
            Selection Criteria <span className="text-danger-500">*</span>
          </CardTitle>
          <CardDescription>
            Define the rules that determine which patients belong to this cohort
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CriteriaBuilder value={formData.criteria} onChange={handleCriteriaChange} />
          {validationErrors.criteria && (
            <p className="text-sm text-danger-600 mt-3">{validationErrors.criteria}</p>
          )}
        </CardContent>
      </Card>

      {/* Auto-Update Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Update Settings</CardTitle>
          <CardDescription>
            Configure how often the cohort membership should be recalculated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Updates</Label>
              <p className="text-sm text-muted-foreground">
                Automatically recalculate membership based on schedule
              </p>
            </div>
            <Button
              variant={formData.auto_update ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleInputChange('auto_update', !formData.auto_update)}
            >
              {formData.auto_update ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {formData.auto_update && (
            <>
              <Separator />
              <div>
                <Label htmlFor="update-frequency">Update Frequency</Label>
                <Select
                  value={formData.update_frequency}
                  onValueChange={(val) => handleInputChange('update_frequency', val)}
                >
                  <SelectTrigger id="update-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Cohort will be automatically recalculated {formData.update_frequency}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cohort Status */}
      <Card>
        <CardHeader>
          <CardTitle>Cohort Status</CardTitle>
          <CardDescription>
            Control whether this cohort is active and available for use
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active Status</Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_active
                  ? 'Cohort is active and can be used in operations'
                  : 'Cohort is inactive and hidden from most views'}
              </p>
            </div>
            <Button
              variant={formData.is_active ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleInputChange('is_active', !formData.is_active)}
            >
              {formData.is_active ? 'Active' : 'Inactive'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 border rounded-lg shadow-lg">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isEditing ? 'Update Cohort' : 'Create Cohort'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
