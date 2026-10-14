# Patient Data Auto-Fill Feature

## Overview
Form fields are now automatically pre-filled with patient data when a patient is selected before form submission.

## How It Works

### 1. Patient Selection
When a user selects a patient using the PatientSelector component, the patient's information is stored.

### 2. Smart Field Matching
The system intelligently matches patient fields to form fields based on:
- **Label matching**: Field labels like "Full Name", "Phone Number", "Email Address"
- **Field type**: Email fields, phone fields, date fields
- **Case-insensitive**: Works with variations like "full name", "Full Name", "FULL NAME"

### 3. Auto-Fill Mapping

| Patient Field | Matches Form Fields |
|--------------|---------------------|
| `full_name` | Full Name, Patient Name, Name, Member Name |
| `contact` | Phone, Contact, Mobile, Phone Number, Contact Number |
| `email` | Email, Email Address, E-mail, Email ID |
| `date_of_birth` | Date of Birth, Birth Date, DOB, Birthday |
| `gender` | Gender, Sex |
| `address` | Address, Street Address, Full Address |
| `city` | City, Town |
| `state` | State, Province, Region |
| `postal_code` | Postal Code, ZIP Code, PIN Code, Pincode |
| `blood_group` | Blood Group, Blood Type |
| `emergency_contact_name` | Emergency Contact, Next of Kin |
| `emergency_contact_phone` | Emergency Phone, Emergency Contact Phone |

### 4. Editable Values
✅ All pre-filled values are **fully editable**
✅ Users can modify any auto-filled field
✅ Changes do NOT affect the patient's master record

### 5. Data Isolation
✅ Form edits only update the form submission
✅ Patient record remains unchanged
✅ Complete data integrity guaranteed

## Example Usage

### Gym Feedback Template
When patient "Farzan Manzer" (Male, 22y) is selected:

**Auto-filled fields**:
- Full Name → "Farzan Manzer"
- Email Address → "farzan@example.com" (if in patient record)
- Phone Number → "+91-9876543210" (if in patient record)

**Manual fields** (not in patient record):
- Membership Duration → User fills manually

## Technical Implementation

### Files Created/Modified
1. **Created**: `frontend/src/utils/patientFormMapper.js`
   - Smart field matching algorithm
   - Field type formatters
   - Multi-page form support

2. **Modified**: `frontend/src/pages/forms/FormSubmit.jsx`
   - Import mapper utility
   - Add useEffect for auto-fill
   - Pass defaultValues to FormRenderer

### Code Flow
```javascript
Patient Selected
    ↓
mapPatientToFormFields(patient, formSchema)
    ↓
Extract all fields from schema
    ↓
Match each field to patient data
    ↓
Format values for field types
    ↓
Return { fieldId: value } object
    ↓
Pass to FormRenderer as defaultValues
    ↓
User can edit pre-filled values
    ↓
Submit form (patient record unchanged)
```

## Field Type Handling

### Date Fields
- Patient DOB: `"1990-01-15T00:00:00Z"`
- Form field: `"1990-01-15"` (YYYY-MM-DD format)

### Phone Fields
- Patient contact: `"+91-9876543210"`
- Form field: Same format (already compatible)

### Text Fields
- Direct string copy
- Trimmed of whitespace

## Benefits

### For Users
✅ **Faster form filling**: Common fields pre-populated
✅ **Fewer errors**: Data from validated patient records
✅ **Full control**: Can edit or override any value
✅ **Transparency**: Clear which fields are pre-filled

### For Data Quality
✅ **Consistency**: Same patient data across forms
✅ **Accuracy**: Reduces manual entry errors
✅ **Integrity**: Patient master record protected

### For Developers
✅ **Automatic**: Works with any form template
✅ **Extensible**: Easy to add new field mappings
✅ **Maintainable**: Centralized mapping logic

## Configuration

### Adding New Field Mappings
Edit `frontend/src/utils/patientFormMapper.js`:

```javascript
const PATIENT_FIELD_MAPPINGS = [
  // Add your custom mapping
  {
    patientField: 'custom_field',
    labelPatterns: ['custom label', 'another label'],
    fieldTypes: ['text'] // optional
  }
];
```

## Testing

### Test Scenario 1: Create Patient & Submit Form
1. Go to Patients → Add Patient
2. Fill: Name, Email, Phone, DOB, Gender
3. Go to Forms → Select any form → Submit
4. Select the patient you just created
5. Verify fields are pre-filled
6. Edit some values
7. Submit form
8. Verify patient record unchanged

### Test Scenario 2: Existing Patient
1. Go to Patients → Select existing patient
2. Note their details (name, email, phone)
3. Go to Forms → Gym Feedback Template → Submit
4. Select the patient
5. Verify fields match patient record
6. Submit without editing
7. View patient detail → Verify no changes

## Future Enhancements

### Potential Additions
- Visual indicators for auto-filled fields (badge/icon)
- "Pre-fill from patient" toggle option
- Field mapping preview before form
- Custom mapping rules per form template
- Auto-fill history/audit log

## Troubleshooting

### Issue: Fields Not Auto-Filling
**Check**:
- Is patient selected before form loads?
- Do field labels match mapping patterns?
- Check browser console for mapper output

### Issue: Wrong Field Mapping
**Solution**:
- Update label patterns in `patientFormMapper.js`
- Add more specific label patterns
- Check field type matching

### Issue: Date Format Issues
**Solution**:
- Verify patient DOB is valid date
- Check date field accepts YYYY-MM-DD format

## Summary

The auto-fill feature provides intelligent, automatic pre-filling of form fields from patient data while maintaining complete data integrity and user control. It works seamlessly with any form template and reduces data entry time significantly.

**Key Points**:
✅ Automatic and intelligent
✅ Fully editable values
✅ Patient record protected
✅ Works with all forms
✅ Zero configuration required
