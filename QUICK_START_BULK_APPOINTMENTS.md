# Quick Start: Pure Logic Bulk Appointments

## 5-Minute Setup Guide

### Step 1: Download Template (10 seconds)

```bash
curl -O http://localhost:5000/api/bulk-appointments/template
# or visit in browser: http://localhost:5000/api/bulk-appointments/template
```

Save as: `my_appointments.csv`

### Step 2: Fill Template (2 minutes)

Open `my_appointments.csv` in Excel/Google Sheets and fill:

| Required | Field | Example |
|----------|-------|---------|
| ✅ | patient_name | Rajesh Kumar |
| ✅ | patient_phone | 9876543210 |
| ✅ | provider_name | Dr. Sharma |
| ✅ | appointment_date | 2026-03-20 |
| ✅ | appointment_time | 14:30 |
| ❌ | patient_email | rajesh@example.com |
| ❌ | duration_minutes | 30 |
| ❌ | appointment_type | consultation |

**Important Rules:**
- Date format: YYYY-MM-DD (e.g., 2026-03-20)
- Time format: HH:MM in 24-hour (e.g., 14:30, not 2:30 PM)
- Provider name must exist in your system
- Future dates only

### Step 3: Upload File (30 seconds)

Using Postman/Insomnia/curl:

```bash
curl -X POST http://localhost:5000/api/bulk-appointments/upload \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "file=@my_appointments.csv"
```

**Response:**
```json
{
  "session_id": "abc-123-def-456",
  "filename": "my_appointments.csv",
  "status": "uploaded"
}
```

Save the `session_id`!

### Step 4: Process File (1 minute)

```bash
curl -X POST http://localhost:5000/api/bulk-appointments/process/abc-123-def-456 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**
```json
{
  "total_rows": 100,
  "auto_approved": 85,    ← These will be created automatically
  "needs_review": 10,     ← These have conflicts, need your decision
  "rejected": 5           ← These have errors, cannot process
}
```

### Step 5: Review Conflicts (optional, 1 minute)

If you have items in "needs_review":

```bash
curl http://localhost:5000/api/bulk-appointments/sessions/abc-123-def-456/items?status=conflict \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

You'll see conflicts like:
```json
{
  "row_number": 12,
  "conflict_type": "PROVIDER_TIME_OVERLAP",
  "message": "Dr. Sharma already has appointment at 10:00",
  "suggested_alternatives": [
    {
      "time": "10:45",
      "reason": "Next available slot today"
    },
    {
      "date": "2026-03-21",
      "time": "10:00",
      "reason": "Same time tomorrow"
    }
  ]
}
```

To accept first suggestion:
```bash
curl -X POST http://localhost:5000/api/bulk-appointments/sessions/abc-123-def-456/items/ITEM_ID/resolve \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "accept_suggestion", "data": {"suggestion_index": 0}}'
```

Or skip:
```bash
curl -X POST http://localhost:5000/api/bulk-appointments/sessions/abc-123-def-456/items/ITEM_ID/resolve \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "skip"}'
```

### Step 6: Create Appointments (30 seconds)

```bash
curl -X POST http://localhost:5000/api/bulk-appointments/sessions/abc-123-def-456/create \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**
```json
{
  "message": "Appointments created successfully",
  "statistics": {
    "created": 95,
    "failed": 0,
    "skipped": 5,
    "patients_created": 23
  }
}
```

Done! 🎉

## Common Scenarios

### Scenario 1: All Appointments Auto-Approved

If all appointments are valid and have no conflicts:

```bash
# Upload
curl -X POST .../upload -F "file=@appointments.csv"
# Process
curl -X POST .../process/SESSION_ID
# Create (no review needed!)
curl -X POST .../sessions/SESSION_ID/create
```

Total time: ~1 minute

### Scenario 2: Some Conflicts

If some appointments have conflicts:

```bash
# Upload & Process (same as above)
curl -X POST .../upload -F "file=@appointments.csv"
curl -X POST .../process/SESSION_ID

# Review conflicts
curl .../sessions/SESSION_ID/items?status=conflict

# Resolve each conflict
curl -X POST .../items/ITEM_ID/resolve -d '{"action": "accept_suggestion", "data": {"suggestion_index": 0}}'

# Create all (including resolved)
curl -X POST .../sessions/SESSION_ID/create
```

Total time: ~3 minutes (depends on number of conflicts)

### Scenario 3: Some Errors

If some rows have data errors:

1. Download error report (future feature) or check API response
2. Fix errors in CSV
3. Upload corrected file as new session
4. Process and create

## Troubleshooting

### Error: "Provider not found"

**Problem**: Provider name in CSV doesn't match database

**Solution**:
1. Check exact provider names in your system
2. Use fuzzy matching (system tolerates minor differences)
3. Common issues:
   - "Dr Sharma" vs "Dr. Sharma" → ✅ Works (fuzzy match)
   - "Dr. Sharma" vs "Dr. Kumar" → ❌ Different person
   - "sharma" vs "Dr. Sharma" → ⚠️ Might work (75% threshold)

### Error: "Appointment time outside working hours"

**Problem**: Time not within provider's schedule

**Solution**:
1. Check provider's working hours in system
2. Use times within provider's schedule
3. Example:
   - Provider works: Monday 09:00-17:00
   - Your appointment: Monday 18:00 → ❌ Outside hours
   - Change to: Monday 16:00 → ✅ Within hours

### Error: "Provider does not work on Saturday"

**Problem**: Provider doesn't work on that day

**Solution**:
1. Check provider's working days
2. Pick a different day
3. Or assign to different provider who works Saturdays

### Conflict: "Provider already has appointment"

**Problem**: Time slot already booked

**Solution** (3 options):
1. Accept auto-suggestion (easiest)
2. Set manual time
3. Skip this appointment

## Tips for Success

### 1. Prepare Good Data

✅ **Good CSV:**
```csv
patient_name,patient_phone,provider_name,appointment_date,appointment_time
Rajesh Kumar,9876543210,Dr. Sharma,2026-03-20,09:00
Priya Singh,9123456789,Dr. Sharma,2026-03-20,10:00
```

❌ **Bad CSV:**
```csv
patient_name,patient_phone,provider_name,appointment_date,appointment_time
,9876543210,Dr. Sharma,2026-03-20,09:00           ← Missing name
Rajesh,invalid,Dr. Sharma,2026-03-20,09:00         ← Bad phone
Priya,9123456789,Unknown,yesterday,25:00           ← Everything wrong!
```

### 2. Match Provider Names Correctly

✅ Use exact names from your system
✅ Fuzzy matching helps with minor differences
❌ Don't use nicknames or abbreviations

### 3. Use Reasonable Time Slots

✅ Align with provider's slot duration
✅ Avoid break times
✅ Stay within working hours

### 4. Review Suggestions

The system suggests:
1. Same day, next available slot (fastest)
2. Next working day, same time (convenient)
3. Alternative provider, same time (if available)

Choose what works best for your patients!

### 5. Start Small

First time? Try with 10-20 appointments to get familiar with the process.

## Advanced Usage

### Batch Resolve All Break Conflicts

```bash
# Get all break conflicts
curl .../sessions/SESSION_ID/items?status=conflict | \
  jq '.items[] | select(.conflict_type == "BREAK_TIME_OVERLAP")' | \
  # For each, accept first suggestion
  xargs -I {} curl -X POST .../items/{}/resolve -d '{"action": "accept_suggestion", "data": {"suggestion_index": 0}}'
```

### Skip All Duplicates

```bash
# Get all duplicates
curl .../sessions/SESSION_ID/items?status=conflict | \
  jq '.items[] | select(.conflict_type == "DUPLICATE")' | \
  # For each, skip
  xargs -I {} curl -X POST .../items/{}/resolve -d '{"action": "skip"}'
```

## Need Help?

1. Check error messages - they tell you exactly what's wrong
2. Review the full documentation: `PURE_LOGIC_BULK_APPOINTMENTS.md`
3. Check logs: `backend/logs/app.log`
4. Verify provider schedules in database

## Summary

**Minimum Steps:**
1. Download template
2. Fill with data
3. Upload file
4. Process file
5. Create appointments

**Time:** 1-5 minutes depending on conflicts

**Result:** Hundreds of appointments created systematically!
