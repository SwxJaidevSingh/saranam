# Service Booking Extension for Bulk Appointments

## Overview

This document extends the bulk appointment feature to support **service bookings** (IPD, OPD, Physiotherapy, Home Care) with service-specific fields and metadata.

## What's Added

### Service Types Supported

1. **IPD (In-Patient Department)**
   - Bed number assignment
   - Admission/discharge dates
   - Ward preferences
   - Insurance information

2. **OPD (Out-Patient Department)**
   - Standard consultation
   - Insurance information

3. **PHYSIOTHERAPY**
   - Therapy type (pain management, post-surgery, sports injury)
   - Number of sessions
   - Special equipment needs

4. **HOME_CARE**
   - **Home address (REQUIRED)**
   - Equipment provided
   - Visit frequency
   - Special requirements

---

## Enhanced Data Model

### Extended Extraction Schema

The LLM now extracts service-specific fields:

```python
class ExtractedServiceAppointment(ExtractedAppointment):
    """Extended schema for service bookings"""

    # Service identification
    service_name: Optional[str] = Field(None, description="Service name")
    service_type: Optional[str] = Field(None, description="IPD, OPD, PHYSIOTHERAPY, HOME_CARE")

    # Common service fields
    contact_number: str = Field(..., description="Contact phone number (REQUIRED for services)")
    insurance_info: Optional[str] = Field(None, description="Insurance provider and policy number")

    # IPD-specific
    bed_number: Optional[str] = Field(None, description="Bed or ward number")
    admission_date: Optional[str] = Field(None, description="Admission date (for IPD)")
    discharge_date: Optional[str] = Field(None, description="Expected discharge date (for IPD)")
    preferred_ward: Optional[str] = Field(None, description="Ward preference")
    emergency_contact_name: Optional[str] = Field(None, description="Emergency contact person")
    emergency_contact_number: Optional[str] = Field(None, description="Emergency contact phone")

    # Home Care-specific
    home_address: Optional[str] = Field(None, description="Service address (REQUIRED for HOME_CARE)")
    equipment_provided: Optional[str] = Field(None, description="Equipment like wheelchair, oxygen")
    visit_frequency: Optional[str] = Field(None, description="Visit frequency: daily, weekly, etc.")

    # Physiotherapy-specific
    therapy_type: Optional[str] = Field(None, description="Type of therapy needed")
    therapy_sessions: Optional[int] = Field(None, description="Number of sessions")
    special_requirements: Optional[str] = Field(None, description="Special needs or focus areas")
```

---

## Service-Specific Validation

### Validation Rules by Service Type

**ALL Services:**
- ✅ Patient name/ID
- ✅ Service name/type
- ✅ Date and time
- ✅ Chief complaint
- ✅ Contact number (REQUIRED)

**IPD Additional:**
- ⚠️ Warning if no admission_date (defaults to appointment date)
- ⚠️ Warning if no bed_number (assigned during admission)
- ℹ️ Insurance info recommended

**OPD:**
- No additional required fields
- ℹ️ Insurance info recommended

**PHYSIOTHERAPY:**
- ℹ️ Therapy type recommended
- ℹ️ Number of sessions recommended

**HOME_CARE:**
- ❌ ERROR if no home_address (REQUIRED)
- ℹ️ Visit frequency recommended

---

## Service Matching Logic

The system matches services using:

1. **Service Name Match** (fuzzy 80%+)
   - "Cardiology OPD" → matches "Cardiology Out-Patient"
   - "Physio" → matches "Physiotherapy"

2. **Service Type Detection**
   - Keywords: "inpatient", "ipd", "admission" → IPD
   - Keywords: "outpatient", "opd", "consultation" → OPD
   - Keywords: "physio", "therapy", "rehabilitation" → PHYSIOTHERAPY
   - Keywords: "home", "home care", "home visit" → HOME_CARE

3. **Auto-detect from Provider Department**
   - Provider in "Physiotherapy" dept → PHYSIOTHERAPY service type

---

## Enhanced File Format Support

### Sample CSV for Service Bookings

```csv
Patient Name,Phone,Service Type,Service,Provider,Date,Time,Contact,Home Address,Chief Complaint,Insurance
Rajesh Kumar,9876543210,IPD,General Ward,Dr. Sharma,2026-03-15,09:00,9876543210,,Cardiac surgery,ABC Insurance 123456
Anita Singh,9876543211,OPD,Cardiology Consult,Dr. Patel,2026-03-15,10:00,9876543211,,Chest pain,XYZ Insurance 789012
Mohammed Ali,9876543212,PHYSIOTHERAPY,Sports Injury,Dr. Verma,2026-03-16,11:00,9876543212,,Knee pain - football injury,
Sunita Devi,9876543213,HOME_CARE,Nursing Care,Nurse Kumar,2026-03-17,09:00,9876543213,"123 Main St, Bangalore",Post-surgery care,
```

### Sample with Service Metadata

```csv
Patient,Service Type,Service,Date,Time,Contact,Therapy Type,Sessions,Equipment,Ward,Bed
John Doe,PHYSIOTHERAPY,Rehab Center,2026-03-15,09:00,9876543210,Post-surgery,10,,,
Jane Smith,IPD,General Ward,2026-03-16,08:00,9876543211,,,General,B-204
Mark Johnson,HOME_CARE,Home Nursing,2026-03-17,10:00,9876543212,,,,Wheelchair;Oxygen,
```

---

## LLM Prompt Enhancement

### Service Booking Extraction Prompt

```
ADDITIONAL INSTRUCTIONS FOR SERVICE BOOKINGS:

1. SERVICE TYPE DETECTION:
   - Look for keywords: IPD, OPD, Physiotherapy, Home Care
   - Check department names
   - Infer from service descriptions (e.g., "admission" → IPD)

2. REQUIRED FIELDS BY TYPE:
   - ALL: contact_number (phone for appointment contact)
   - HOME_CARE: home_address (MUST extract full address)
   - IPD: admission_date (default to appointment date if not specified)

3. SERVICE METADATA:
   - Extract bed_number, ward info for IPD
   - Extract therapy_type, sessions for Physiotherapy
   - Extract equipment, visit_frequency for Home Care
   - Extract insurance details for all types

4. VALIDATION:
   - Mark extraction_confidence lower if missing required fields
   - Add extraction_notes if home_address missing for HOME_CARE
   - Note if contact_number not found (required for all services)
```

---

## API Changes

### Enhanced Upload Response

```json
{
  "session_id": "uuid",
  "extracted_data": [
    {
      "patient_name": "Rajesh Kumar",
      "service_type": "IPD",
      "service_name": "General Ward IPD",
      "admission_date": "2026-03-15",
      "bed_number": "B-204",
      "contact_number": "9876543210",
      "service_metadata": {
        "preferred_ward": "General",
        "insurance_info": "ABC Insurance 123456"
      }
    }
  ]
}
```

### Enhanced Validation Response

```json
{
  "validation_summary": {
    "errors": [
      {
        "row": 5,
        "field": "home_address",
        "message": "Home address is required for HOME_CARE services"
      }
    ],
    "warnings": [
      {
        "row": 3,
        "field": "bed_number",
        "message": "Bed number not specified for IPD service"
      }
    ]
  }
}
```

---

## Service Creation Flow

### Modified Appointment Creation

When creating service bookings, the system:

1. **Validates Service Fields**
   ```python
   if service_type == 'HOME_CARE':
       if not service_metadata.get('home_address'):
           raise ValidationError("Home address required for HOME_CARE")
   ```

2. **Builds Service Metadata**
   ```python
   service_metadata = {
       'service_type': service_type,
       'contact_number': contact_number
   }

   if service_type == 'IPD':
       service_metadata.update({
           'bed_number': bed_number,
           'admission_date': admission_date,
           'discharge_date': discharge_date,
           'preferred_ward': preferred_ward,
           'insurance_info': insurance_info
       })
   elif service_type == 'HOME_CARE':
       service_metadata.update({
           'home_address': home_address,
           'equipment_provided': equipment_provided,
           'visit_frequency': visit_frequency
       })
   # ... etc
   ```

3. **Creates Encounter with Service**
   ```python
   appointment_data = {
       'patient_id': patient_id,
       'provider_id': provider_id,
       'start_time': start_time,
       'service_id': matched_service_id,
       'service_status': 'REQUESTED',
       'service_metadata': service_metadata,
       'chief_complaint': chief_complaint
   }
   ```

---

## Calendar Integration

Service bookings created via bulk import automatically appear in the appointment calendar with:

- Color-coded by service type
- Service name displayed
- Patient and provider info
- Time slot information
- Service-specific icons

---

## Implementation Files to Update

### Backend Files to Modify

1. **`llm_service.py`**
   - Add `ExtractedServiceAppointment` schema
   - Update extraction prompts for services
   - Add service type detection logic

2. **`bulk_appointment_service.py`**
   - Add `_match_service()` method (fuzzy match services)
   - Add `_validate_service_fields()` method
   - Add `_build_service_metadata()` method
   - Update `_build_appointment_data()` to include service context

3. **`bulk_import_item.py` (model)**
   - Add `service_id` field (UUID, FK to services)
   - Add `service_match_type` field (exact, fuzzy, none)
   - Add `service_match_score` field (0-100)

4. **Migration**
   - Add service_id column to bulk_import_items table

### Frontend Files to Modify

1. **Preview Grid Component**
   - Add service type column
   - Show service-specific fields in expandable rows
   - Color-code by service type

2. **Validation Dashboard**
   - Group errors by service type
   - Show service-specific validation messages
   - Highlight missing required fields

---

## Example File Formats

### Format 1: Simple Service Bookings

```csv
Patient,Service,Date,Time,Contact,Address,Notes
Rajesh Kumar,Cardiology OPD,2026-03-15,09:00,9876543210,,Regular checkup
Anita Singh,General Ward IPD,2026-03-16,08:00,9876543211,,Cardiac surgery admission
Mohammed,Physiotherapy,2026-03-17,10:00,9876543212,,Sports injury rehab
Sunita Devi,Home Nursing,2026-03-18,14:00,9876543213,"123 Main St, Bangalore",Post-op care
```

### Format 2: Detailed Service Information

```csv
Patient,Phone,Service Type,Service,Provider,Date,Time,Therapy Type,Sessions,Home Address,Insurance
Rajesh,9876543210,OPD,Cardiology,Dr. Sharma,2026-03-15,09:00,,,,ABC Ins 123
Anita,9876543211,IPD,General Ward,Dr. Patel,2026-03-16,08:00,,,,XYZ Ins 456
Ali,9876543212,PHYSIOTHERAPY,Sports Rehab,Dr. Verma,2026-03-17,10:00,Sports injury,8,,
Sunita,9876543213,HOME_CARE,Nursing,Nurse Kumar,2026-03-18,14:00,,,123 Main St; Bangalore,
```

### Format 3: IPD-Specific

```csv
Patient,Service,Admission Date,Discharge Date,Bed,Ward,Provider,Contact,Insurance,Emergency Contact
Rajesh Kumar,General IPD,2026-03-15,2026-03-20,B-204,General,Dr. Sharma,9876543210,ABC Ins,John Doe: 9999999999
Anita Singh,ICU,2026-03-16,2026-03-18,ICU-5,ICU,Dr. Patel,9876543211,XYZ Ins,Jane Smith: 8888888888
```

---

## Validation Examples

### ✅ Valid Service Bookings

```csv
# Valid OPD
Rajesh Kumar,Cardiology OPD,2026-03-15,09:00,9876543210,Regular checkup

# Valid IPD (bed optional)
Anita Singh,General Ward IPD,2026-03-16,08:00,9876543211,Surgery admission

# Valid Physiotherapy
Mohammed Ali,Sports Rehab,2026-03-17,10:00,9876543212,Knee injury

# Valid Home Care (address required)
Sunita Devi,Home Nursing,2026-03-18,14:00,9876543213,Post-op care,"123 Main St, Bangalore"
```

### ❌ Invalid Service Bookings

```csv
# INVALID: Missing contact number
Rajesh Kumar,Cardiology OPD,2026-03-15,09:00,,Regular checkup

# INVALID: HOME_CARE without address
Sunita Devi,Home Nursing,2026-03-18,14:00,9876543213,Post-op care,
```

---

## Statistics & Reporting

### Enhanced Session Statistics

```json
{
  "total_rows": 100,
  "created_count": 85,
  "failed_count": 15,
  "service_breakdown": {
    "IPD": 20,
    "OPD": 40,
    "PHYSIOTHERAPY": 15,
    "HOME_CARE": 10
  },
  "services_matched": 75,
  "services_created": 0
}
```

---

## Next Steps for Implementation

### Phase 1: Backend Service Matching
1. Add service matching logic to `bulk_appointment_service.py`
2. Update LLM prompts for service extraction
3. Add service-specific validation rules
4. Test with sample service booking files

### Phase 2: Service Metadata
1. Build service metadata from extracted data
2. Validate required fields per service type
3. Store metadata in service_metadata JSONB field
4. Test metadata extraction and storage

### Phase 3: Frontend Updates
1. Add service type column to preview grid
2. Show service-specific fields
3. Add service validation indicators
4. Display service metadata in results

### Phase 4: Testing & Documentation
1. Create service booking sample files
2. Test each service type thoroughly
3. Update user documentation
4. Train staff on service bulk imports

---

## Benefits

- ✅ **Faster IPD Admissions** - Bulk import patient admissions
- ✅ **Home Care Scheduling** - Import weekly home visit schedules
- ✅ **Physiotherapy Sessions** - Create multi-session therapy plans
- ✅ **OPD Appointments** - Standard appointment bulk creation
- ✅ **Service Calendar** - All service bookings appear in unified calendar
- ✅ **Metadata Preserved** - Service-specific data captured accurately

---

**This extension is designed to seamlessly integrate with the existing bulk appointment system while adding full service booking capabilities!**
