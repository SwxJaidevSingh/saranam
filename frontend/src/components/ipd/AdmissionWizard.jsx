import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  FileText,
  Stethoscope,
  Bed,
  Check,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  AlertCircle
} from 'lucide-react';
import patientsApi from '../../api/patients';
import ipdApi from '../../api/ipd';
import servicesApi from '../../api/services';
import formConfigurationsApi from '../../api/formConfigurations';
import FormRenderer from '../forms/FormRenderer';

const STEPS = [
  { id: 1, name: 'Select Patient', icon: User },
  { id: 2, name: 'Admission Details', icon: FileText },
  { id: 3, name: 'Encounter', icon: Stethoscope },
  { id: 4, name: 'Bed Assignment', icon: Bed },
  { id: 5, name: 'Review & Submit', icon: Check }
];

export default function AdmissionWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Patient
    patient_id: '',
    patient: null,

    // Step 2: Admission Details
    admission_type: 'elective',
    admission_source: 'opd',
    admitting_doctor_id: '',
    admission_diagnosis: '',
    admission_notes: '',
    estimated_length_of_stay_days: '',
    service_id: '',

    // Step 3: Encounter
    create_new_encounter: true,
    encounter_id: '',
    chief_complaint: '',

    // Step 4: Bed Assignment
    bed_id: '',
    bed: null,
    add_to_waiting_list: false,
    waiting_list_priority: 'routine',
    requested_bed_type: 'general'
  });

  // Search states
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  const [availableBeds, setAvailableBeds] = useState([]);
  const [loadingBeds, setLoadingBeds] = useState(false);

  // Services state
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Dynamic form state
  const [admissionFormConfig, setAdmissionFormConfig] = useState(null);
  const [admissionFormData, setAdmissionFormData] = useState({});
  const [loadingForm, setLoadingForm] = useState(false);
  const [useDynamicForm, setUseDynamicForm] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (patientSearch.length >= 2) {
      searchPatients();
    } else {
      setPatients([]);
    }
  }, [patientSearch]);

  useEffect(() => {
    if (currentStep === 4 && formData.requested_bed_type) {
      loadAvailableBeds();
    }
  }, [currentStep, formData.requested_bed_type]);

  // Load admission form configuration when service_id is available
  useEffect(() => {
    if (formData.service_id && currentStep === 2) {
      loadAdmissionForm();
    }
  }, [formData.service_id, currentStep]);

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const data = await servicesApi.list({ limit: 100 });
      setServices(data.services || []);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  const loadAdmissionForm = async () => {
    try {
      setLoadingForm(true);
      const data = await formConfigurationsApi.getForService(
        formData.service_id,
        'ADMISSION'
      );
      if (data.configuration && data.form) {
        setAdmissionFormConfig(data);
        setUseDynamicForm(true);
      } else {
        // No dynamic form configured, use static form
        setUseDynamicForm(false);
      }
    } catch (err) {
      console.log('No dynamic admission form configured, using static form');
      setUseDynamicForm(false);
    } finally {
      setLoadingForm(false);
    }
  };

  const searchPatients = async () => {
    try {
      setSearchingPatients(true);
      const data = await patientsApi.search(patientSearch);
      setPatients(data.patients || []);
    } catch (err) {
      console.error('Failed to search patients:', err);
    } finally {
      setSearchingPatients(false);
    }
  };

  const loadAvailableBeds = async () => {
    try {
      setLoadingBeds(true);
      const data = await ipdApi.searchAvailableBeds(formData.requested_bed_type);
      setAvailableBeds(data.beds || []);
    } catch (err) {
      console.error('Failed to load beds:', err);
    } finally {
      setLoadingBeds(false);
    }
  };

  const handleNext = () => {
    setError(null);

    // Validation for each step
    if (currentStep === 1 && !formData.patient_id) {
      setError('Please select a patient');
      return;
    }

    if (currentStep === 2) {
      if (!formData.admission_type) {
        setError('Please select admission type');
        return;
      }
      if (!formData.admission_diagnosis) {
        setError('Please enter admission diagnosis');
        return;
      }
    }

    if (currentStep === 3) {
      if (formData.create_new_encounter && !formData.chief_complaint) {
        setError('Please enter chief complaint for new encounter');
        return;
      }
      if (!formData.create_new_encounter) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!formData.encounter_id || !uuidRegex.test(formData.encounter_id)) {
          setError('Please enter a valid Encounter ID (UUID format, e.g., 123e4567-e89b-12d3-a456-426614174000)');
          return;
        }
      }
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const admissionData = {
        patient_id: formData.patient_id,
        admission_type: formData.admission_type,
        admission_source: formData.admission_source,
        admitting_doctor_id: formData.admitting_doctor_id || null,
        admission_diagnosis: formData.admission_diagnosis,
        admission_notes: formData.admission_notes,
        estimated_length_of_stay_days: formData.estimated_length_of_stay_days ? parseInt(formData.estimated_length_of_stay_days) : null,
        service_id: formData.service_id || null,
        create_new_encounter: formData.create_new_encounter,
        encounter_id: formData.encounter_id || null,
        chief_complaint: formData.chief_complaint,
        bed_id: formData.bed_id || null,
        // Dynamic form data
        admission_form_id: formData.admission_form_id || null,
        form_data: formData.form_data || null
      };

      const admission = await ipdApi.admitPatient(admissionData);

      // If no bed available but patient wants to be added to waiting list
      if (!formData.bed_id && formData.add_to_waiting_list) {
        await ipdApi.addToWaitingList({
          patient_id: formData.patient_id,
          requested_bed_type: formData.requested_bed_type,
          priority: formData.waiting_list_priority,
          service_id: formData.service_id || null,
          notes: `Added during admission process. Admission ID: ${admission.id}`
        });
      }

      // Navigate to admission detail page
      navigate(`/ipd/admissions/${admission.id}`);
    } catch (err) {
      console.error('Failed to admit patient:', err);
      setError(err.response?.data?.error || 'Failed to admit patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div>
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-green-600 dark:bg-green-700 border-green-600 dark:border-green-700 text-white'
                      : 'bg-card border-border text-muted-foreground/70'
                  }`}
                >
                  {isCompleted ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-sm font-medium ${
                      isActive ? 'text-primary' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                    }`}
                  >
                    {step.name}
                  </div>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    isCompleted ? 'bg-green-600 dark:bg-green-700' : 'bg-accent'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Select Patient</h2>
        <p className="text-muted-foreground">Search for and select the patient to admit</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Search Patient *
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Search by name, ABHA ID, or phone..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {searchingPatients && (
          <div className="mt-2 text-sm text-muted-foreground">Searching...</div>
        )}

        {patients.length > 0 && !formData.patient && (
          <div className="mt-2 border border-border rounded-lg max-h-64 overflow-y-auto">
            {patients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    patient_id: patient.id,
                    patient: patient
                  }));
                  setPatientSearch(patient.full_name);
                  setPatients([]);
                }}
                className="w-full text-left p-4 hover:bg-primary/10 border-b border-border last:border-b-0 transition-colors"
              >
                <div className="font-medium text-foreground">{patient.full_name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {patient.age && `${patient.age}y`} {patient.gender}
                  {patient.phone && ` • ${patient.phone}`}
                  {patient.city && ` • ${patient.city}`}
                </div>
              </button>
            ))}
          </div>
        )}

        {formData.patient && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <User className="h-6 w-6 text-green-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100">{formData.patient.full_name}</h3>
                  <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                    {formData.patient.age && `${formData.patient.age} years old`} • {formData.patient.gender}
                  </div>
                  {formData.patient.phone && (
                    <div className="text-sm text-green-700 dark:text-green-300">{formData.patient.phone}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    patient_id: '',
                    patient: null
                  }));
                  setPatientSearch('');
                }}
                className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (loadingForm) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading admission form...</p>
          </div>
        </div>
      );
    }

    if (useDynamicForm && admissionFormConfig?.form) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Admission Details</h2>
            <p className="text-muted-foreground">Complete the admission form</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <FormRenderer
              schema={admissionFormConfig.form.schema}
              defaultValues={admissionFormData}
              onSubmit={(data) => {
                setAdmissionFormData(data);
                // Store form ID for submission
                setFormData(prev => ({
                  ...prev,
                  admission_form_id: admissionFormConfig.form.id,
                  form_data: data
                }));
              }}
              submitButtonText="Save & Continue"
              showSubmitButton={false}
            />
          </div>

          <div className="text-sm text-muted-foreground italic">
            Using custom form: {admissionFormConfig.form.name}
          </div>
        </div>
      );
    }

    // Fallback to static form if no dynamic form configured
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Admission Details</h2>
          <p className="text-muted-foreground">Enter admission information</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Admission Type *
            </label>
            <select
              value={formData.admission_type}
              onChange={(e) => setFormData(prev => ({ ...prev, admission_type: e.target.value }))}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="elective">Elective</option>
              <option value="emergency">Emergency</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Admission Source
            </label>
            <select
              value={formData.admission_source}
              onChange={(e) => setFormData(prev => ({ ...prev, admission_source: e.target.value }))}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="opd">OPD</option>
              <option value="emergency_room">Emergency Room</option>
              <option value="referral">Referral</option>
              <option value="direct">Direct</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Service / Department
          </label>
          <select
            value={formData.service_id}
            onChange={(e) => setFormData(prev => ({ ...prev, service_id: e.target.value }))}
            disabled={loadingServices}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="">Select Service...</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Optional: Select a service to use custom admission forms and enable progress notes/nursing assessments
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Admission Diagnosis *
          </label>
          <textarea
            value={formData.admission_diagnosis}
            onChange={(e) => setFormData(prev => ({ ...prev, admission_diagnosis: e.target.value }))}
            rows={3}
            placeholder="Enter primary admission diagnosis..."
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Admission Notes
          </label>
          <textarea
            value={formData.admission_notes}
            onChange={(e) => setFormData(prev => ({ ...prev, admission_notes: e.target.value }))}
            rows={3}
            placeholder="Additional admission notes..."
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Estimated Length of Stay (days)
          </label>
          <input
            type="number"
            value={formData.estimated_length_of_stay_days}
            onChange={(e) => setFormData(prev => ({ ...prev, estimated_length_of_stay_days: e.target.value }))}
            min="1"
            placeholder="e.g., 3"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Encounter Setup</h2>
        <p className="text-muted-foreground">Create new encounter or link to existing</p>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-secondary transition-colors">
          <input
            type="radio"
            checked={formData.create_new_encounter}
            onChange={() => setFormData(prev => ({ ...prev, create_new_encounter: true, encounter_id: '' }))}
            className="mt-1"
          />
          <div>
            <div className="font-medium text-foreground">Create New Encounter</div>
            <div className="text-sm text-muted-foreground mt-1">
              Start a fresh IPD encounter for this admission
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-secondary transition-colors">
          <input
            type="radio"
            checked={!formData.create_new_encounter}
            onChange={() => setFormData(prev => ({ ...prev, create_new_encounter: false }))}
            className="mt-1"
          />
          <div>
            <div className="font-medium text-foreground">Link to Existing Encounter</div>
            <div className="text-sm text-muted-foreground mt-1">
              Convert an existing OPD or ER encounter to IPD
            </div>
          </div>
        </label>
      </div>

      {formData.create_new_encounter ? (
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Chief Complaint *
          </label>
          <textarea
            value={formData.chief_complaint}
            onChange={(e) => setFormData(prev => ({ ...prev, chief_complaint: e.target.value }))}
            rows={3}
            placeholder="Enter the patient's chief complaint..."
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Existing Encounter ID *
          </label>
          <input
            type="text"
            value={formData.encounter_id}
            onChange={(e) => setFormData(prev => ({ ...prev, encounter_id: e.target.value }))}
            placeholder="Enter encounter ID..."
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Bed Assignment</h2>
        <p className="text-muted-foreground">Assign a bed or add to waiting list</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Requested Bed Type
        </label>
        <select
          value={formData.requested_bed_type}
          onChange={(e) => setFormData(prev => ({ ...prev, requested_bed_type: e.target.value, bed_id: '', bed: null }))}
          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="general">General</option>
          <option value="icu">ICU</option>
          <option value="semi_private">Semi-Private</option>
          <option value="private">Private</option>
          <option value="isolation">Isolation</option>
        </select>
      </div>

      {loadingBeds ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading available beds...</p>
        </div>
      ) : availableBeds.length > 0 ? (
        <div>
          <h3 className="font-semibold text-foreground mb-3">
            Available Beds ({availableBeds.length})
          </h3>
          <div className="border border-border rounded-lg max-h-96 overflow-y-auto">
            {availableBeds.map((bed) => (
              <label
                key={bed.id}
                className={`flex items-center p-4 border-b border-border last:border-b-0 cursor-pointer hover:bg-primary/10 transition-colors ${
                  formData.bed_id === bed.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                }`}
              >
                <input
                  type="radio"
                  checked={formData.bed_id === bed.id}
                  onChange={() => setFormData(prev => ({ ...prev, bed_id: bed.id, bed, add_to_waiting_list: false }))}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{bed.bed_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {bed.ward_name}
                    {bed.room_number && ` • Room ${bed.room_number}`}
                    {bed.floor && ` • Floor ${bed.floor}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  {bed.has_oxygen && (
                    <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">O₂</span>
                  )}
                  {bed.has_ventilator && (
                    <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">Vent</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">No Beds Available</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                There are no available beds of type "{formData.requested_bed_type.replace('_', ' ')}".
                You can add the patient to the waiting list.
              </p>
            </div>
          </div>
        </div>
      )}

      {availableBeds.length === 0 && (
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.add_to_waiting_list}
              onChange={(e) => setFormData(prev => ({ ...prev, add_to_waiting_list: e.target.checked }))}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-muted-foreground">Add to waiting list</span>
          </label>

          {formData.add_to_waiting_list && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Priority
              </label>
              <select
                value={formData.waiting_list_priority}
                onChange={(e) => setFormData(prev => ({ ...prev, waiting_list_priority: e.target.value }))}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Review & Submit</h2>
        <p className="text-muted-foreground">Review all information before submitting</p>
      </div>

      <div className="space-y-4">
        {/* Patient Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <User className="h-5 w-5" />
            Patient Information
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <div className="font-medium">{formData.patient?.full_name}</div>
            <div>{formData.patient?.age && `${formData.patient.age}y`} {formData.patient?.gender}</div>
          </div>
        </div>

        {/* Admission Details */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Admission Details
          </h3>
          <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
            <div><span className="font-medium">Type:</span> <span className="capitalize">{formData.admission_type}</span></div>
            <div><span className="font-medium">Source:</span> <span className="capitalize">{formData.admission_source.replace('_', ' ')}</span></div>
            {formData.service_id && (
              <div><span className="font-medium">Service:</span> {services.find(s => s.id === formData.service_id)?.name || 'Selected'}</div>
            )}
            <div><span className="font-medium">Diagnosis:</span> {formData.admission_diagnosis}</div>
            {formData.estimated_length_of_stay_days && (
              <div><span className="font-medium">Est. LOS:</span> {formData.estimated_length_of_stay_days} days</div>
            )}
          </div>
        </div>

        {/* Encounter */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Encounter
          </h3>
          <div className="text-sm text-purple-800 dark:text-purple-200">
            {formData.create_new_encounter ? (
              <>
                <div>New IPD Encounter</div>
                <div className="mt-1"><span className="font-medium">Chief Complaint:</span> {formData.chief_complaint}</div>
              </>
            ) : (
              <div>Link to Encounter ID: {formData.encounter_id}</div>
            )}
          </div>
        </div>

        {/* Bed Assignment */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2 flex items-center gap-2">
            <Bed className="h-5 w-5" />
            Bed Assignment
          </h3>
          <div className="text-sm text-orange-800 dark:text-orange-200">
            {formData.bed ? (
              <>
                <div className="font-medium">{formData.bed.bed_number}</div>
                <div>{formData.bed.ward_name}</div>
              </>
            ) : formData.add_to_waiting_list ? (
              <>
                <div>No bed assigned - Added to waiting list</div>
                <div className="mt-1">
                  <span className="font-medium">Type:</span> <span className="capitalize">{formData.requested_bed_type.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="font-medium">Priority:</span> <span className="capitalize">{formData.waiting_list_priority}</span>
                </div>
              </>
            ) : (
              <div className="text-orange-600 dark:text-orange-400">No bed assigned</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">IPD Admission Process</h1>
              <p className="text-muted-foreground mt-1">Complete the steps below to admit a patient to the In-Patient Department.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this admission? All progress will be lost.')) {
                  navigate('/ipd');
                }
              }}
              className="px-4 py-2 flex items-center text-sm font-medium rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel Admission
            </button>
          </div>

          {/* Progress Bar Container */}
          <div className="bg-card py-6 px-12 rounded-2xl shadow-sm border border-border mb-8">
            {renderStepIndicator()}
          </div>
        </div>

        {error && (
          <div className="mb-8 bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="text-destructive font-medium">{error}</div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="border border-border shadow-lg bg-card rounded-3xl overflow-hidden">
          {/* Step Title Header */}
          <div className="bg-accent px-8 py-6 flex justify-between items-center border-b border-border">
            <div>
              <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Step {currentStep} of 5</span>
              <h2 className="text-xl font-semibold mt-1 text-foreground">
                {STEPS.find(s => s.id === currentStep)?.name}
              </h2>
            </div>
            <div className="bg-primary/10 px-3 py-1 rounded-full text-xs font-medium text-primary">
              {Math.round((currentStep / 5) * 100)}% Complete
            </div>
          </div>

          <div className="p-8 min-h-[450px]">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
          </div>

          {/* Navigation Buttons */}
          <div className="px-8 py-6 bg-accent border-t border-border flex justify-between items-center">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-6 py-2.5 bg-secondary border border-border text-foreground rounded-xl hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm transition-all"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </button>

            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 flex items-center gap-2 font-medium shadow-lg transition-all"
              >
                Continue
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg transition-all"
              >
                {isSubmitting ? 'Admitting Patient...' : 'Complete Admission'}
                <Check className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
