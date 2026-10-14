# Bulk Appointment Import - File Format Guide

## Supported File Formats

1. **Excel (.xlsx, .xls)** - Recommended for structured data
2. **CSV (.csv)** - Best for exports from other systems
3. **PDF (.pdf)** - Tables or scanned documents (requires OCR)

---

## Recommended Column Structure

The AI can understand various column names, but these are recommended:

### Required Fields
| Column Name | Format | Example | Notes |
|-------------|--------|---------|-------|
| Patient Name | Text | "Rajesh Kumar" | Full name of patient |
| Date | YYYY-MM-DD or DD/MM/YYYY | "2026-03-15" or "15/03/2026" | Appointment date |
| Time | HH:MM or HH:MM AM/PM | "09:00" or "9:00 AM" | Appointment time |

### Highly Recommended
| Column Name | Format | Example | Notes |
|-------------|--------|---------|-------|
| Phone | 10 digits or +91-XXXXXXXXXX | "9876543210" | For patient matching |
| Provider | Text | "Dr. Priya Sharma" | Doctor name |
| Type | Text | "consultation" | appointment_type |

### Optional but Useful
| Column Name | Format | Example | Notes |
|-------------|--------|---------|-------|
| Email | email@domain.com | "patient@email.com" | Patient email |
| Date of Birth | YYYY-MM-DD | "1990-01-15" | Patient DOB |
| Gender | Male/Female/Other | "Male" | Patient gender |
| Department | Text | "Cardiology" | Department name |
| Duration | Number (minutes) | "30" | Default: 30 mins |
| Chief Complaint | Text | "Chest pain" | Reason for visit |
| Notes | Text | "Follow-up" | Additional notes |
| ABHA ID | 14 digits | "12345678901234" | ABHA health ID |

---

## Flexible Column Names

The AI will understand variations like:

**Patient Name:**
- "Patient Name", "Patient", "Name", "Full Name", "PatientName"

**Phone:**
- "Phone", "Mobile", "Phone Number", "Contact", "Telephone"

**Provider/Doctor:**
- "Doctor", "Provider", "Physician", "Dr", "Doctor Name"

**Date:**
- "Date", "Appointment Date", "Visit Date", "Scheduled Date"

**Time:**
- "Time", "Appointment Time", "Slot", "Scheduled Time"

---

## Date Formats Supported

The AI can parse various formats:

- `2026-03-15` (ISO format - recommended)
- `15/03/2026` (DD/MM/YYYY)
- `03/15/2026` (MM/DD/YYYY)
- `15-Mar-2026` (DD-Mon-YYYY)
- `March 15, 2026` (Full text)

---

## Time Formats Supported

- `09:00` (24-hour - recommended)
- `9:00 AM` (12-hour with AM/PM)
- `0900` (Military time)
- `9:00` (Will assume AM if before 12)

---

## Appointment Types

Valid values for Type column:

- `consultation` - Regular doctor consultation
- `follow_up` - Follow-up visit
- `teleconsultation` - Virtual consultation
- `procedure` - Medical procedure
- `lab_test` - Laboratory test
- `imaging` - Radiology/imaging
- `therapy` - Therapy session
- `vaccination` - Vaccination

---

## Example Files

### 1. Simple CSV (Minimum Fields)

```csv
Patient Name,Date,Time,Provider
Rajesh Kumar,2026-03-15,09:00,Dr. Sharma
Anita Singh,2026-03-15,10:00,Dr. Patel
Mohammed Ali,2026-03-15,11:00,Dr. Sharma
```

### 2. Complete CSV (All Fields)

See `sample-appointments.csv` for a complete example with all recommended fields.

### 3. Excel Format

Same structure as CSV, but with additional benefits:
- Multiple sheets (will use first sheet)
- Formatted dates automatically recognized
- Can include formulas (values will be extracted)

### 4. Unstructured Text (PDF or Text)

The AI can even understand unstructured formats like:

```
Dr. Sharma - Cardiology
- March 15, 9am: Rajesh Kumar (9876543210) - Chest pain
- March 15, 10am: Anita Singh (9876543211) - Fever
- March 15, 11am: Mohammed Ali (9876543212) - BP check

Dr. Patel - General Medicine
- March 16, 9am: Vikram Rao - Annual checkup
- March 16, 10am: Sanjay Desai - Diabetes
```

---

## Patient Matching Logic

When processing appointments, the system will:

1. **Try exact ABHA ID match** (if provided)
2. **Try phone number match** (if provided)
3. **Try fuzzy name match** (80%+ similarity)
4. **Auto-create new patient** if no match found

### Auto-Created Patients

If a patient doesn't exist, the system will create them with:
- Name from file
- Phone from file (if provided)
- Email from file (if provided)
- DOB from file (if provided)
- Gender from file (if provided)
- Default country: India

You'll see a warning: "Patient will be auto-created"

---

## Provider Matching Logic

1. **Fuzzy name match** (75%+ similarity)
2. **Department match** (if name not found)
3. **Warning if not found** (appointment can still be created without provider)

---

## Conflict Handling

If a provider already has an appointment at the requested time:

1. System detects conflict
2. AI suggests 3 nearest available slots
3. You can:
   - Accept AI suggestion
   - Manually choose different time
   - Override (double-book) with warning
   - Skip appointment

---

## Tips for Best Results

### ✅ DO:
- Use consistent date format throughout file
- Include phone numbers for accurate patient matching
- Use provider full names or common abbreviations
- Include department names
- Keep one appointment per row

### ❌ DON'T:
- Mix date formats in same file
- Leave required fields empty
- Use merged cells in Excel
- Include header rows in middle of data
- Use special characters in names

---

## Common Issues & Solutions

### "Patient not found"
**Solution:** Provide phone number or ABHA ID for better matching, or allow auto-creation

### "Provider not found"
**Solution:** Use exact provider names from your system, check spelling

### "Invalid date format"
**Solution:** Use YYYY-MM-DD format, check for typos

### "Scheduling conflict"
**Solution:** Accept AI suggestions or manually adjust times

### "File too large"
**Solution:** Split into batches of max 1000 appointments

---

## Testing Your File

Before bulk import:

1. Test with 5-10 rows first
2. Review extracted data in preview
3. Check validation results
4. Resolve any conflicts
5. If all looks good, upload full file

---

## Questions?

- See main [README.md](../README.md) for feature overview
- See [IMPLEMENTATION_GUIDE.md](../IMPLEMENTATION_GUIDE.md) for setup
- Check validation messages for specific issues
- Export results to see what succeeded/failed

---

*Last Updated: 2026-03-09*
