# Service Booking Integration Guide

## Overview

This guide shows how to integrate the **Service Booking Extension** with the base bulk appointment feature to support IPD, OPD, Physiotherapy, and Home Care service bookings.

---

## Prerequisites

- Base bulk appointment feature installed (see [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md))
- Services module active in your system
- Service types configured (IPD, OPD, PHYSIOTHERAPY, HOME_CARE)

---

## Integration Steps

### Step 1: Add Service Fields to Database (5 minutes)

```bash
cd backend

# Create migration
flask db revision -m "Add service support to bulk imports"

# Copy content from:
# features/bulk-appointments-ai/backend/migrations/add_service_support_to_bulk_imports.py

# Run migration
flask db upgrade
```

**This adds to `bulk_import_items` table:**
- `service_id` - Foreign key to services table
- `service_match_type` - How service was matched (exact, fuzzy, type_only)
- `service_match_score` - Match confidence (0-100)

---

### Step 2: Update LLM Service (10 minutes)

**Option A: Replace Entire File (Recommended)**

```bash
cp features/bulk-appointments-ai/backend/services/llm_service_with_services.py \
   backend/app/bulk_imports/services/llm_service.py
```

**Option B: Merge Changes**

Add to your existing `llm_service.py`:

```python
# Add service-specific fields to ExtractedAppointment schema

class ExtractedAppointment(BaseModel):
    # ... existing fields ...

    # Service-specific fields
    service_name: Optional[str] = None
    service_type: Optional[str] = None
    contact_number: Optional[str] = None
    insurance_info: Optional[str] = None

    # IPD fields
    bed_number: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    preferred_ward: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None

    # HOME_CARE fields
    home_address: Optional[str] = None
    equipment_provided: Optional[str] = None
    visit_frequency: Optional[str] = None

    # PHYSIOTHERAPY fields
    therapy_type: Optional[str] = None
    therapy_sessions: Optional[int] = None
    special_requirements: Optional[str] = None
```

Update system prompt to include service extraction instructions (see `llm_service_with_services.py`).

---

### Step 3: Add Service Booking Extension (5 minutes)

Copy the service extension file:

```bash
cp features/bulk-appointments-ai/backend/services/bulk_service_appointment_extension.py \
   backend/app/bulk_imports/services/
```

---

### Step 4: Update Bulk Appointment Service (15 minutes)

Edit `backend/app/bulk_imports/services/bulk_appointment_service.py`:

**1. Import the extension:**

```python
from app.bulk_imports.services.bulk_service_appointment_extension import ServiceBookingExtension
```

**2. Add service matching in `_validate_appointment_item()`:**

```python
def _validate_appointment_item(self, item: BulkImportItem) -> Tuple[bool, List[Dict], List[Dict]]:
    errors = []
    warnings = []
    data = item.extracted_data

    # ... existing validation ...

    # MATCH SERVICE (if service booking)
    if data.get('service_name') or data.get('service_type'):
        service = ServiceBookingExtension.match_service(data)
        if service:
            item.service_id = service['id']
            item.service_match_type = service['match_type']
            item.service_match_score = service.get('match_score')

            # Validate service-specific fields
            service_errors, service_warnings = ServiceBookingExtension.validate_service_fields(
                item,
                service['service_type']
            )
            errors.extend(service_errors)
            warnings.extend(service_warnings)
        else:
            warnings.append({
                'field': 'service',
                'message': f"Service '{data.get('service_name')}' not found"
            })

    # ... rest of validation ...
```

**3. Update `_build_appointment_data()` for service bookings:**

```python
def _build_appointment_data(self, item: BulkImportItem) -> Dict:
    # If service booking, use service extension
    if item.service_id:
        # Get service to determine type
        from app.services.models import Service
        service = Service.query.get(item.service_id)
        if service:
            return ServiceBookingExtension.build_service_appointment_data(
                item,
                item.service_id,
                service.service_type.value
            )

    # Otherwise, use regular appointment data
    # ... existing code ...
```

**4. Add service statistics to session:**

```python
def validate_appointments(self, session_id: UUID) -> BulkImportSession:
    # ... existing code ...

    # After validation loop, add service stats
    service_stats = ServiceBookingExtension.get_service_statistics(session.import_items)

    # Update session validation summary
    if session.validation_summary:
        session.validation_summary['service_statistics'] = service_stats
    else:
        session.validation_summary = {'service_statistics': service_stats}

    # ... rest of method ...
```

---

### Step 5: Update Model (2 minutes)

Edit `backend/app/bulk_imports/models/bulk_import_item.py`:

Add fields to model:

```python
class BulkImportItem(BaseModel):
    # ... existing fields ...

    # Service matching (ADD THESE)
    service_id = Column(UUID(as_uuid=True), ForeignKey('services.id'), nullable=True)
    service_match_type = Column(String(50), nullable=True)
    service_match_score = Column(Integer, nullable=True)

    # ... rest of model ...

    # Add to relationships
    service = relationship('Service')
```

Update `to_dict()` method:

```python
def to_dict(self):
    return {
        # ... existing fields ...

        'service_match': {
            'service_id': str(self.service_id) if self.service_id else None,
            'match_type': self.service_match_type,
            'match_score': self.service_match_score
        } if self.service_id else None,

        # ... rest of dict ...
    }
```

---

### Step 6: Test Service Bookings (10 minutes)

**Test File Upload:**

```bash
cd backend
python -m flask shell

>>> from app.bulk_imports.services.bulk_appointment_service import BulkAppointmentService
>>> from uuid import UUID
>>> import os

# Set your user ID
>>> user_id = UUID('your-user-id-here')

# Create service
>>> service = BulkAppointmentService(user_id, llm_provider='openai')

# Upload test file
>>> session = service.process_file_upload(
...     file_path='features/bulk-appointments-ai/examples/sample-service-bookings.csv',
...     filename='sample-service-bookings.csv',
...     file_type='csv'
... )

# Extract
>>> session = service.extract_appointments(session.id)
>>> print(f"Extracted {session.extracted_count} appointments")

# Validate
>>> session = service.validate_appointments(session.id)
>>> print(session.validation_summary)

# Check service stats
>>> print(session.validation_summary['service_statistics'])
```

---

## Verification Checklist

After integration, verify:

- [ ] Database migration applied successfully
- [ ] LLM extracts service-specific fields
- [ ] Services are matched by name/type
- [ ] Service-specific validation works:
  - [ ] HOME_CARE requires home_address
  - [ ] All services require contact_number
  - [ ] IPD warnings for missing bed/admission info
- [ ] Service metadata is built correctly
- [ ] Appointments created with service_id
- [ ] Service bookings appear in calendar

---

## Testing Different Service Types

### Test IPD Booking

```csv
Patient,Service Type,Provider,Date,Time,Contact,Bed,Ward,Insurance
John Doe,IPD,Dr. Smith,2026-03-15,08:00,9876543210,B-204,General,ABC Ins 123
```

**Expected:**
- Service matched as IPD type
- Bed number extracted
- Admission date defaults to appointment date
- Warning if no emergency contact

### Test OPD Booking

```csv
Patient,Service Type,Provider,Date,Time,Contact,Chief Complaint
Jane Smith,OPD,Dr. Patel,2026-03-15,09:00,9876543211,Regular checkup
```

**Expected:**
- Service matched as OPD type
- Standard appointment created
- No service-specific warnings

### Test HOME_CARE Booking

```csv
Patient,Service Type,Provider,Date,Time,Contact,Home Address
Mark Johnson,HOME_CARE,Nurse Kumar,2026-03-15,14:00,9876543212,"123 Main St, Bangalore"
```

**Expected:**
- Service matched as HOME_CARE type
- Home address validated (REQUIRED)
- ERROR if home_address missing

### Test PHYSIOTHERAPY Booking

```csv
Patient,Service Type,Provider,Date,Time,Contact,Therapy Type,Sessions
Sarah Lee,PHYSIOTHERAPY,Dr. Verma,2026-03-15,10:00,9876543213,Sports injury,8
```

**Expected:**
- Service matched as PHYSIOTHERAPY type
- Therapy type and sessions extracted
- Metadata stored in service_metadata

---

## API Response Examples

### Extraction Response (with services)

```json
{
  "session_id": "uuid",
  "extracted_data": [
    {
      "id": "item-uuid",
      "row_number": 1,
      "extracted_data": {
        "patient_name": "John Doe",
        "service_name": "General Ward IPD",
        "service_type": "IPD",
        "admission_date": "2026-03-15",
        "bed_number": "B-204",
        "contact_number": "9876543210"
      },
      "service_match": {
        "service_id": "service-uuid",
        "match_type": "fuzzy_name_with_type",
        "match_score": 95
      }
    }
  ]
}
```

### Validation Response (with service stats)

```json
{
  "validation_summary": {
    "errors": [
      {
        "row": 5,
        "field": "home_address",
        "message": "Home address is REQUIRED for HOME_CARE services"
      }
    ],
    "service_statistics": {
      "total_service_bookings": 15,
      "by_service_type": {
        "IPD": 5,
        "OPD": 6,
        "PHYSIOTHERAPY": 3,
        "HOME_CARE": 1
      },
      "services_matched": 14,
      "missing_services": 1
    }
  }
}
```

---

## Troubleshooting

### "Service not found" warnings

**Cause:** Service name doesn't match any service in database
**Fix:**
1. Check service names in database
2. Lower fuzzy match threshold (currently 75%)
3. Use exact service names in file

### "Home address required" errors for HOME_CARE

**Cause:** HOME_CARE booking without home_address field
**Fix:** Ensure home address column present in file

### Services not being detected

**Cause:** LLM not extracting service_type
**Fix:**
1. Verify service type keywords in data
2. Check LLM prompt includes service instructions
3. Use explicit "Service Type" column in CSV

### Service metadata not stored

**Cause:** service_id not set on appointment
**Fix:** Verify service matching is working and service_id being set

---

## File Format Examples

See **[examples/sample-service-bookings.csv](./examples/sample-service-bookings.csv)** for complete examples.

**Minimum required columns:**
- Patient Name
- Service Type (or Service Name)
- Date, Time
- Contact Number
- **Home Address** (for HOME_CARE only)

**Recommended columns:**
- Provider
- Chief Complaint
- Insurance
- Bed/Ward (for IPD)
- Therapy Type/Sessions (for PHYSIOTHERAPY)

---

## Next Steps

After successful integration:

1. **Create Service Templates** - Save common file formats
2. **Train Staff** - Show how to prepare service booking files
3. **Monitor Stats** - Track service booking success rates
4. **Optimize Matching** - Adjust fuzzy match thresholds
5. **Add Service Icons** - Show service type in UI

---

## Support

- Service booking extension: [SERVICE_BOOKING_EXTENSION.md](./SERVICE_BOOKING_EXTENSION.md)
- Base implementation: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- Quick start: [QUICK_START.md](./QUICK_START.md)

---

**Integration Time Estimate: 45 minutes total**

**When complete, you'll have full service booking support in bulk imports!** 🎉
