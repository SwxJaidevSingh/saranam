/**
 * ProviderForm Page
 * Form for creating and editing healthcare providers
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Alert } from '../../components/ui/alert';
import {
  ArrowLeft,
  Save,
  Loader2,
  User,
  Stethoscope,
  Building2,
  Award,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import providersApi from '../../api/providers';
import AddOptionDialog from '../../components/providers/AddOptionDialog';

const ProviderForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [specializations, setSpecializations] = useState([]);
  // const [departments, setDepartments] = useState([]);
  const [showAddSpecialization, setShowAddSpecialization] = useState(false);
  const [showManageSpecializations, setShowManageSpecializations] = useState(false);
  const [deletingSpec, setDeletingSpec] = useState(null);
  // const [showAddDepartment, setShowAddDepartment] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    full_name: '',
    specialization: '',
    // department: '', // Commented out - not needed for now
    license_number: '',
    license_expiry_date: '',
    hpr_id: '',
    qualification: '',
    designation: '',
    signature_image: '', // base64 data URI rendered on prescription PDFs
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    consultation_duration: 30,
    is_active: true,
  });
  const [signatureError, setSignatureError] = useState('');

  // Fetch specializations, departments, and provider data (if editing)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch specializations (departments commented out for now)
        const specsResponse = await providersApi.getSpecializations();
        // const deptsResponse = await providersApi.getDepartments();

        setSpecializations(specsResponse.specializations || []);
        // setDepartments(deptsResponse.departments || []);

        // If editing, fetch provider data
        if (isEditMode) {
          const providerResponse = await providersApi.getById(id);
          setFormData({
            full_name: providerResponse.full_name || '',
            specialization: providerResponse.specialization || '',
            // department: providerResponse.department || '', // Commented out - not needed for now
            license_number: providerResponse.license_number || '',
            license_expiry_date: providerResponse.license_expiry_date || '',
            hpr_id: providerResponse.hpr_id || '',
            qualification: providerResponse.qualification || '',
            designation: providerResponse.designation || '',
            signature_image: providerResponse.signature_image || '',
            email: providerResponse.email || '',
            phone: providerResponse.phone || '',
            address: providerResponse.address || '',
            city: providerResponse.city || '',
            state: providerResponse.state || '',
            postal_code: providerResponse.postal_code || '',
            consultation_duration: providerResponse.consultation_duration || 30,
            is_active: providerResponse.is_active !== undefined ? providerResponse.is_active : true,
          });
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load form data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      // Validate required fields
      if (!formData.full_name || !formData.specialization) {
        setError('Please fill in all required fields');
        return;
      }

      if (isEditMode) {
        await providersApi.update(id, formData);
      } else {
        await providersApi.create(formData);
      }

      // Navigate back to providers list
      navigate('/providers');
    } catch (err) {
      console.error('Error saving provider:', err);
      setError(err.response?.data?.error || 'Failed to save provider. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/providers');
  };

  const handleAddSpecialization = async (name) => {
    try {
      await providersApi.addSpecialization(name);
      // Refresh specializations list
      const response = await providersApi.getSpecializations();
      setSpecializations(response.specializations || []);
      // Auto-select the newly added specialization
      handleChange('specialization', name);
    } catch (error) {
      throw error; // Re-throw to be handled by dialog
    }
  };

  const handleDeleteSpecialization = async (name) => {
    try {
      setDeletingSpec(name);
      await providersApi.deleteSpecialization(name);
      const response = await providersApi.getSpecializations();
      setSpecializations(response.specializations || []);
      // Clear selection if the deleted spec was selected
      if (formData.specialization === name) {
        handleChange('specialization', '');
      }
    } catch (error) {
      console.error('Failed to delete specialization:', error);
    } finally {
      setDeletingSpec(null);
    }
  };

  // const handleAddDepartment = async (name) => {
  //   try {
  //     await providersApi.addDepartment(name);
  //     // Refresh departments list
  //     const response = await providersApi.getDepartments();
  //     setDepartments(response.departments || []);
  //     // Auto-select the newly added department
  //     handleChange('department', name);
  //   } catch (error) {
  //     throw error; // Re-throw to be handled by dialog
  //   }
  // };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">
            {isEditMode ? 'Edit Provider' : 'Add New Provider'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode ? 'Update provider information' : 'Create a new healthcare provider profile'}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  placeholder="Dr. John Smith"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="specialization">Specialization *</Label>
                  <button
                    type="button"
                    onClick={() => setShowManageSpecializations(true)}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    <Settings className="h-3 w-3" />
                    Manage
                  </button>
                </div>
                <Select
                  value={formData.specialization}
                  onValueChange={(value) => {
                    if (value === '__add_new__') {
                      setShowAddSpecialization(true);
                    } else {
                      handleChange('specialization', value);
                    }
                  }}
                  required
                >
                  <SelectTrigger id="specialization">
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add_new__" className="font-medium text-blue-600">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add New Specialization...
                      </div>
                    </SelectItem>
                    {specializations.length > 0 && (
                      <div className="border-t my-1" />
                    )}
                    {specializations.map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department field commented out - not needed for now */}
              {/* <div>
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => {
                    if (value === '__add_new__') {
                      setShowAddDepartment(true);
                    } else {
                      handleChange('department', value);
                    }
                  }}
                  required
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add_new__" className="font-medium text-blue-600">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add New Department...
                      </div>
                    </SelectItem>
                    {departments.length > 0 && (
                      <div className="border-t my-1" />
                    )}
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div> */}

              <div>
                <Label htmlFor="qualification">Qualification</Label>
                <Input
                  id="qualification"
                  type="text"
                  value={formData.qualification}
                  onChange={(e) => handleChange('qualification', e.target.value)}
                  placeholder="MBBS, MD"
                />
              </div>

              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  type="text"
                  value={formData.designation}
                  onChange={(e) => handleChange('designation', e.target.value)}
                  placeholder="Senior Consultant"
                />
              </div>
            </div>
          </Card>

          {/* Signature — uploaded once per doctor, rendered on the prescription PDF */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Prescription Signature
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload this doctor's signature as a PNG or JPG image (max 500 KB).
              It will appear above the doctor's name on every prescription PDF they issue.
            </p>

            {formData.signature_image ? (
              <div className="space-y-3">
                <div className="border border-border rounded-lg p-4 bg-background inline-block">
                  <img
                    src={formData.signature_image}
                    alt="Doctor's signature"
                    className="max-h-24 max-w-xs object-contain"
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleChange('signature_image', '');
                      setSignatureError('');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Remove signature
                  </Button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="signature_upload"
                className="cursor-pointer inline-flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 hover:border-primary-400 transition-colors"
              >
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">Click to upload signature</span>
                <span className="text-xs text-muted-foreground mt-1">PNG or JPG, max 500 KB</span>
                <input
                  id="signature_upload"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    setSignatureError('');
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      setSignatureError('File must be a PNG or JPG image');
                      return;
                    }
                    if (file.size > 500 * 1024) {
                      setSignatureError(`File is too large (${(file.size / 1024).toFixed(0)} KB). Max is 500 KB.`);
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      handleChange('signature_image', reader.result);
                    };
                    reader.onerror = () => {
                      setSignatureError('Failed to read file — please try a different image');
                    };
                    reader.readAsDataURL(file);
                    // Reset the input so re-uploading the same file still fires
                    e.target.value = '';
                  }}
                />
              </label>
            )}

            {signatureError && (
              <p className="text-sm text-danger-600 mt-2">{signatureError}</p>
            )}
          </Card>

          {/* Professional Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Award className="h-5 w-5" />
              Professional Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  type="text"
                  value={formData.license_number}
                  onChange={(e) => handleChange('license_number', e.target.value)}
                  placeholder="FM-2026-001"
                />
              </div>

              <div>
                <Label htmlFor="license_expiry_date">License Expiry Date</Label>
                <Input
                  id="license_expiry_date"
                  type="date"
                  value={formData.license_expiry_date}
                  onChange={(e) => handleChange('license_expiry_date', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="hpr_id">HPR ID</Label>
                <Input
                  id="hpr_id"
                  type="text"
                  value={formData.hpr_id}
                  onChange={(e) => handleChange('hpr_id', e.target.value)}
                  placeholder="HPR-123456"
                />
              </div>

              <div>
                <Label htmlFor="consultation_duration">Consultation Duration (minutes)</Label>
                <Input
                  id="consultation_duration"
                  type="number"
                  min="15"
                  max="120"
                  step="15"
                  value={formData.consultation_duration}
                  onChange={(e) => handleChange('consultation_duration', parseInt(e.target.value))}
                />
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="doctor@example.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+91-9876543210"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Street address"
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Bangalore"
                />
              </div>

              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="Karnataka"
                />
              </div>

              <div>
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  placeholder="560001"
                />
              </div>
            </div>
          </Card>

          {/* Status */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Status</h2>
            <div>
              <Label htmlFor="is_active">Active Status</Label>
              <Select
                value={formData.is_active ? 'active' : 'inactive'}
                onValueChange={(value) => handleChange('is_active', value === 'active')}
              >
                <SelectTrigger id="is_active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleBack} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Update Provider' : 'Create Provider'}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Add Specialization Dialog */}
      <AddOptionDialog
        open={showAddSpecialization}
        onClose={() => setShowAddSpecialization(false)}
        onAdd={handleAddSpecialization}
        title="Add New Specialization"
        fieldName="Specialization"
        placeholder="e.g., Cardiology, Neurology"
      />

      {/* Add Department Dialog - commented out for now */}
      {/* <AddOptionDialog
        open={showAddDepartment}
        onClose={() => setShowAddDepartment(false)}
        onAdd={handleAddDepartment}
        title="Add New Department"
        fieldName="Department"
        placeholder="e.g., Emergency Department, ICU"
      /> */}

      {/* Manage Specializations Dialog */}
      {showManageSpecializations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Manage Specializations</h3>
              <button onClick={() => setShowManageSpecializations(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-500 mb-3">
                Removing a specialization hides it from dropdowns. Existing providers and assignments are not affected.
              </p>
              <div className="space-y-1">
                {specializations.map((spec) => (
                  <div key={spec} className="flex items-center justify-between py-2 px-3 rounded hover:bg-slate-50 dark:hover:bg-slate-800 group">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{spec}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSpecialization(spec)}
                      disabled={deletingSpec === spec}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all disabled:opacity-50"
                    >
                      {deletingSpec === spec ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
                {specializations.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">No specializations found</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t">
              <Button variant="outline" className="w-full" onClick={() => setShowManageSpecializations(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderForm;
