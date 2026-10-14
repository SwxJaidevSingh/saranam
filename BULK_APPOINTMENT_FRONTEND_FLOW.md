# Bulk Appointment Frontend Flow - Comprehensive Plan

## Overview

A multi-step wizard interface for uploading, validating, and creating bulk appointments without LLM assistance.

---

## 🎨 UI/UX Design Philosophy

### Design Principles
1. **Progressive Disclosure** - Show complexity only when needed
2. **Clear Status Communication** - Color-coded categories (green/yellow/red)
3. **Batch Operations** - Allow resolving multiple conflicts at once
4. **Undo/Redo** - Allow users to go back and modify
5. **Real-time Feedback** - Show progress during processing
6. **Mobile Responsive** - Works on tablets for clinic staff

### Color Scheme
- 🟢 **Green** - Auto-approved (valid, no conflicts)
- 🟡 **Yellow** - Needs review (valid but has conflicts)
- 🔴 **Red** - Rejected (invalid data)
- 🔵 **Blue** - In progress
- ⚪ **Gray** - Skipped by user

---

## 📱 Screen-by-Screen Flow

### **Step 1: Entry Point**

**Location**: Appointments page (next to "Book Appointment" button)

```jsx
<div className="appointment-header-actions">
  <Button variant="primary" onClick={handleBookAppointment}>
    + Book Appointment
  </Button>
  <Button variant="secondary" onClick={handleBulkAppointment}>
    📁 Bulk Appointment
  </Button>
</div>
```

**Trigger**: Clicking "Bulk Appointment" opens modal/drawer

---

### **Step 2: Upload & Template Screen**

**Purpose**: Upload CSV/XLSX or download template

**Layout**:
```
┌─────────────────────────────────────────┐
│   Bulk Appointment Upload               │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  📥 Download CSV Template         │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │                                     ││
│  │     📁 Drag & Drop CSV/XLSX        ││
│  │         or Click to Browse         ││
│  │                                     ││
│  │   Supported: .csv, .xlsx (100MB)   ││
│  └─────────────────────────────────────┘│
│                                         │
│  Recent uploads:                        │
│  • bulk_appointments_march.csv (45 rows)│
│  • new_patients.xlsx (120 rows)         │
│                                         │
│  [Cancel]              [Upload & Next] │
└─────────────────────────────────────────┘
```

**Features**:
1. **Template Download**
   - One-click download with example data
   - Shows required vs optional fields
   - Opens in Excel/Sheets directly

2. **File Upload**
   - Drag & drop zone
   - File picker fallback
   - File validation (type, size)
   - Preview first 5 rows before upload

3. **Recent History**
   - Shows last 5 uploads
   - Click to re-process
   - Shows row count

**API Call**:
```javascript
POST /api/bulk-appointments/upload
- FormData with file
- Returns: { session_id, filename, total_rows }
```

**Next**: Auto-navigate to Processing screen

---

### **Step 3: Processing & Validation Screen**

**Purpose**: Show real-time validation progress

**Layout**:
```
┌─────────────────────────────────────────┐
│   Processing: appointments_march.csv    │
├─────────────────────────────────────────┤
│                                         │
│  ██████████░░░░░░░░░░ 65%              │
│                                         │
│  📊 Progress:                           │
│  • Parsed: 150/150 rows                 │
│  • Validated: 98/150 rows               │
│  • Provider matching: 45/98             │
│  • Conflict detection: 12/98            │
│                                         │
│  ⏱️ Estimated time: 15 seconds          │
│                                         │
│  [Cancel Processing]                    │
└─────────────────────────────────────────┘
```

**Features**:
1. **Real-time Progress Bar**
   - Shows percentage complete
   - Updates every 500ms

2. **Step Breakdown**
   - File parsing
   - Field validation
   - Provider fuzzy matching
   - Schedule validation
   - Conflict detection

3. **Cancel Option**
   - Abort long-running process
   - Clean up temporary data

**Technical Implementation**:
```javascript
// Poll for status
const pollProcessing = async (sessionId) => {
  const interval = setInterval(async () => {
    const status = await api.getSessionStatus(sessionId);

    if (status.status === 'validated') {
      clearInterval(interval);
      navigateToReview(sessionId);
    }

    updateProgress(status.progress);
  }, 500);
};
```

**API Call**:
```javascript
POST /api/bulk-appointments/process/{session_id}
- Returns: { total_rows, auto_approved, needs_review, rejected }

// Polling
GET /api/bulk-appointments/sessions/{session_id}
- Returns: { status, progress: { current, total, step } }
```

**Next**: Auto-navigate to Review screen when complete

---

### **Step 4: Review & Categorization Screen**

**Purpose**: Show validation results in 3 categories

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│   Review Results: 150 appointments                          │
├─────────────────────────────────────────────────────────────┤
│  Summary                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 🟢 Auto  │  │ 🟡 Review │  │ 🔴 Error │                 │
│  │   120    │  │    25     │  │    5     │                 │
│  │  Ready   │  │ Conflicts │  │ Invalid  │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│                                                             │
│  Tabs: [Auto-Approved] [Needs Review] [Rejected]           │
│                                                             │
│  🟡 Needs Review (25 items)                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Row 12 • Rajesh Kumar → Dr. Sharma                     ││
│  │ ⚠️ PROVIDER_TIME_OVERLAP                                ││
│  │ Requested: 2026-03-20 10:00 (30 min)                   ││
│  │ Conflict: Dr. Sharma has appointment with Priya Singh  ││
│  │                                                         ││
│  │ Suggestions:                                            ││
│  │ ○ 2026-03-20 10:45 (Same day, next slot)              ││
│  │ ○ 2026-03-21 10:00 (Next day, same time)              ││
│  │ ○ Skip this appointment                                ││
│  │                                                         ││
│  │ [Resolve] [Skip] [Manual Edit]                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ Row 15 • Amit Patel → Dr. Mehta                        ││
│  │ ⚠️ BREAK_TIME_OVERLAP                                   ││
│  │ ...                                                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Bulk Actions:                                              │
│  [Accept All Suggestions] [Skip All Conflicts] [Export]    │
│                                                             │
│  [Back]  [Download Error Report]  [Create Appointments] ──>│
└─────────────────────────────────────────────────────────────┘
```

**Features**:

1. **Summary Cards**
   - 3 cards showing counts
   - Click to filter
   - Color-coded

2. **Tabbed Interface**
   - Auto-Approved (green)
   - Needs Review (yellow)
   - Rejected (red)

3. **List View**
   - Expandable rows
   - Row number reference
   - Patient → Provider mapping
   - Conflict details
   - Action buttons

4. **Filters & Search**
   ```jsx
   <Filters>
     <Select label="Conflict Type">
       <Option value="all">All Conflicts</Option>
       <Option value="PROVIDER_TIME_OVERLAP">Time Overlap</Option>
       <Option value="BREAK_TIME_OVERLAP">Break Time</Option>
       <Option value="PATIENT_DOUBLE_BOOKING">Double Booking</Option>
     </Select>
     <Search placeholder="Search by patient name..." />
   </Filters>
   ```

5. **Bulk Actions**
   - Accept all first suggestions
   - Skip all conflicts
   - Export error report (CSV)

**Tab 1: Auto-Approved (120 items)**
```
┌─────────────────────────────────────────┐
│ 🟢 Auto-Approved (120)                  │
│                                         │
│ These will be created automatically:    │
│                                         │
│ ✓ Row 1  • Rajesh Kumar → Dr. Sharma   │
│   2026-03-20 09:00 (30 min)            │
│                                         │
│ ✓ Row 2  • Priya Singh → Dr. Mehta     │
│   2026-03-20 10:00 (45 min)            │
│                                         │
│ ✓ Row 3  • Amit Patel → Dr. Sharma     │
│   2026-03-21 14:00 (30 min)            │
│                                         │
│ [View All] [Export List]                │
└─────────────────────────────────────────┘
```

**Tab 2: Needs Review (25 items)**
```
┌─────────────────────────────────────────┐
│ 🟡 Needs Review (25)                    │
│                                         │
│ Resolve conflicts before creation:      │
│                                         │
│ Row 12 • Rajesh Kumar → Dr. Sharma      │
│ ⚠️ PROVIDER_TIME_OVERLAP                │
│ ┌─────────────────────────────────────┐ │
│ │ Requested: 2026-03-20 10:00         │ │
│ │ Conflict: Dr. Sharma busy           │ │
│ │                                     │ │
│ │ Pick a solution:                    │ │
│ │ ○ 10:45 (Same day, 45 min later)   │ │
│ │ ○ 2026-03-21 10:00 (Next day)      │ │
│ │ ○ Dr. Patel @ 10:00 (Alt provider) │ │
│ │ ○ Skip this appointment             │ │
│ │ ○ Manual: [Date] [Time] [Provider] │ │
│ │                                     │ │
│ │ [Apply]                             │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Tab 3: Rejected (5 items)**
```
┌─────────────────────────────────────────┐
│ 🔴 Rejected (5)                         │
│                                         │
│ Fix these errors and re-upload:         │
│                                         │
│ ❌ Row 45 • Invalid phone number        │
│    Patient: John Doe                    │
│    Phone: "invalid"                     │
│    → Must be 10-15 digits               │
│                                         │
│ ❌ Row 67 • Provider not found          │
│    Provider: "Dr. Unknown"              │
│    → Check provider name spelling       │
│                                         │
│ ❌ Row 89 • Past date                   │
│    Date: 2025-01-15                     │
│    → Must be future date                │
│                                         │
│ [Download Error Report] [Fix & Re-upload]│
└─────────────────────────────────────────┘
```

**API Calls**:
```javascript
// Get all items
GET /api/bulk-appointments/sessions/{session_id}/items?status=conflict&page=1&per_page=50

// Get single item
GET /api/bulk-appointments/sessions/{session_id}/items/{item_id}

// Resolve conflict
POST /api/bulk-appointments/sessions/{session_id}/items/{item_id}/resolve
{
  "action": "accept_suggestion",
  "data": { "suggestion_index": 0 }
}
```

**Next**: Click "Create Appointments" → Confirmation screen

---

### **Step 5: Conflict Resolution Detail Modal**

**Purpose**: Detailed view for resolving single conflict

**Layout**:
```
┌─────────────────────────────────────────────────┐
│   Resolve Conflict - Row 12                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  Patient Details:                               │
│  Name: Rajesh Kumar                             │
│  Phone: +91-9876543210                          │
│  Email: rajesh@example.com                      │
│                                                 │
│  Requested Appointment:                         │
│  Provider: Dr. Sharma (Cardiology)              │
│  Date: March 20, 2026                           │
│  Time: 10:00 AM                                 │
│  Duration: 30 minutes                           │
│  Type: Consultation                             │
│                                                 │
│  ⚠️ Conflict: PROVIDER_TIME_OVERLAP             │
│  Dr. Sharma already has an appointment with     │
│  Priya Singh at 10:00-10:45                     │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Choose a Solution:                             │
│                                                 │
│  ○ Option 1: Same Day, Next Available          │
│    March 20, 2026 at 10:45 AM                   │
│    Dr. Sharma (Cardiology)                      │
│    [Select]                                     │
│                                                 │
│  ○ Option 2: Next Day, Same Time                │
│    March 21, 2026 at 10:00 AM                   │
│    Dr. Sharma (Cardiology)                      │
│    [Select]                                     │
│                                                 │
│  ○ Option 3: Alternative Provider               │
│    March 20, 2026 at 10:00 AM                   │
│    Dr. Patel (Cardiology)                       │
│    [Select]                                     │
│                                                 │
│  ○ Option 4: Skip This Appointment              │
│    [Skip]                                       │
│                                                 │
│  ○ Option 5: Manual Override                    │
│    Date: [2026-03-20 ▼]                         │
│    Time: [10:00 ▼]                              │
│    Provider: [Dr. Sharma ▼]                     │
│    Reason: [Emergency _______________]          │
│    [Override]                                   │
│                                                 │
│  [Cancel]                      [Apply & Next] ─>│
└─────────────────────────────────────────────────┘
```

**Features**:
1. **Full Context Display**
   - Patient info
   - Requested slot
   - Conflict explanation
   - Existing appointment details

2. **Smart Suggestions**
   - Radio buttons for each option
   - Clear reasoning ("Next available", "Same time tomorrow")
   - Instant selection

3. **Manual Override**
   - For emergencies
   - Requires reason
   - Shows warning

4. **Navigation**
   - "Apply & Next" goes to next conflict
   - Progress indicator (Conflict 12 of 25)

---

### **Step 6: Confirmation Screen**

**Purpose**: Final review before creation

**Layout**:
```
┌─────────────────────────────────────────┐
│   Confirm Bulk Appointment Creation     │
├─────────────────────────────────────────┤
│                                         │
│  You are about to create:               │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 🟢 Auto-Approved:  120 appointments ││
│  │ 🟡 Resolved:        23 appointments ││
│  │ ⚪ Skipped:          2 appointments ││
│  │ ──────────────────────────────────  ││
│  │ Total to Create:  143 appointments  ││
│  │                                     ││
│  │ New Patients:      45               ││
│  │ Existing Patients: 98               ││
│  └─────────────────────────────────────┘│
│                                         │
│  ⚠️ This action cannot be undone        │
│  (but appointments can be cancelled     │
│   individually later)                   │
│                                         │
│  Breakdown by Provider:                 │
│  • Dr. Sharma: 67 appointments          │
│  • Dr. Mehta:  45 appointments          │
│  • Dr. Patel:  31 appointments          │
│                                         │
│  Breakdown by Date:                     │
│  • March 20: 52 appointments            │
│  • March 21: 48 appointments            │
│  • March 22: 43 appointments            │
│                                         │
│  [Back to Review]      [Create All] ──> │
└─────────────────────────────────────────┘
```

**Features**:
1. **Clear Summary**
   - Total counts by category
   - New vs existing patients
   - Grouped by provider
   - Grouped by date

2. **Warning Message**
   - Undo limitation
   - Cancellation option

3. **Final Actions**
   - Back to review (no changes saved)
   - Create all (start creation)

**API Call**:
```javascript
POST /api/bulk-appointments/sessions/{session_id}/create
- Returns: { statistics: { created, failed, skipped, patients_created } }
```

---

### **Step 7: Creation Progress Screen**

**Purpose**: Show appointment creation in real-time

**Layout**:
```
┌─────────────────────────────────────────┐
│   Creating Appointments...              │
├─────────────────────────────────────────┤
│                                         │
│  ████████████░░░░░░░░ 85%              │
│                                         │
│  📊 Progress:                           │
│  • Created: 122/143 appointments        │
│  • Failed: 0                            │
│  • Patients created: 38/45              │
│                                         │
│  Latest:                                │
│  ✓ Row 45: Rajesh Kumar → Dr. Sharma   │
│  ✓ Row 46: Priya Singh → Dr. Mehta     │
│  ✓ Row 47: Amit Patel → Dr. Sharma     │
│                                         │
│  ⏱️ Estimated time: 8 seconds           │
│                                         │
│  Please don't close this window...      │
└─────────────────────────────────────────┘
```

**Features**:
1. **Real-time Progress**
   - Progress bar
   - Count updates
   - Latest created items

2. **Error Handling**
   - Show failed items
   - Reason for failure
   - Option to retry

---

### **Step 8: Success/Results Screen**

**Purpose**: Show final results and next actions

**Layout**:
```
┌─────────────────────────────────────────┐
│   ✅ Bulk Appointments Created!         │
├─────────────────────────────────────────┤
│                                         │
│  Results Summary:                       │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ✅ Created:  143 appointments       ││
│  │ ❌ Failed:   0 appointments         ││
│  │ 👤 Patients: 45 new, 98 existing    ││
│  │                                     ││
│  │ Session ID: abc-123-def-456         ││
│  │ Created at: 2026-03-14 10:30 AM     ││
│  └─────────────────────────────────────┘│
│                                         │
│  Next Steps:                            │
│                                         │
│  📅 View Appointments in Calendar       │
│     [Go to Calendar] ──>                │
│                                         │
│  📊 Download Session Report (CSV)       │
│     [Download Report]                   │
│                                         │
│  📁 Upload Another File                 │
│     [New Bulk Upload]                   │
│                                         │
│  📧 Send Confirmation Emails (Optional) │
│     [Send to All Patients]              │
│                                         │
│  [Close]                                │
└─────────────────────────────────────────┘
```

**Features**:
1. **Success Message**
   - Clear confirmation
   - Final statistics
   - Session reference

2. **Quick Actions**
   - Jump to calendar
   - Download report
   - Start new upload
   - Send notifications

**Session Report (CSV)**:
```csv
session_id,row_number,status,patient_name,provider_name,date,time,created_appointment_id,notes
abc-123,1,created,Rajesh Kumar,Dr. Sharma,2026-03-20,09:00,appt-001,Auto-approved
abc-123,2,created,Priya Singh,Dr. Mehta,2026-03-20,10:00,appt-002,Auto-approved
abc-123,12,created,Amit Patel,Dr. Sharma,2026-03-20,10:45,appt-012,Resolved - accepted suggestion 1
abc-123,45,failed,John Doe,Dr. Unknown,,,,"Provider not found"
```

---

## 🎯 Key User Flows

### **Flow 1: Happy Path (All Auto-Approved)**

1. Click "Bulk Appointment"
2. Upload CSV (50 rows)
3. Wait 10 seconds (processing)
4. See: "50 auto-approved, 0 conflicts, 0 errors"
5. Click "Create Appointments"
6. Confirm
7. Done in **< 1 minute**

### **Flow 2: Some Conflicts**

1. Click "Bulk Appointment"
2. Upload CSV (100 rows)
3. Processing shows: "75 auto-approved, 20 conflicts, 5 errors"
4. Go to "Needs Review" tab
5. Bulk action: "Accept All Suggestions"
6. Review error report, fix 5 rows
7. Click "Create Appointments"
8. Done in **~3 minutes**

### **Flow 3: Manual Resolution**

1. Upload CSV
2. See conflict: Time overlap
3. Click "Resolve"
4. Review patient details
5. Choose "Option 2: Next day, same time"
6. Click "Apply & Next"
7. Repeat for all conflicts
8. Create appointments

---

## 🧩 Component Hierarchy

```
BulkAppointmentFlow (Main Component)
├── UploadScreen
│   ├── TemplateDownloadButton
│   ├── FileDropzone
│   └── RecentUploadslist
│
├── ProcessingScreen
│   ├── ProgressBar
│   ├── StepIndicator
│   └── CancelButton
│
├── ReviewScreen
│   ├── SummaryCards
│   │   ├── AutoApprovedCard
│   │   ├── NeedsReviewCard
│   │   └── RejectedCard
│   │
│   ├── TabsContainer
│   │   ├── AutoApprovedTab
│   │   │   └── AppointmentList
│   │   ├── NeedsReviewTab
│   │   │   ├── FilterBar
│   │   │   ├── ConflictList
│   │   │   │   └── ConflictItem
│   │   │   │       ├── ConflictDetails
│   │   │   │       ├── SuggestionsList
│   │   │   │       └── ActionButtons
│   │   │   └── BulkActions
│   │   └── RejectedTab
│   │       ├── ErrorList
│   │       └── DownloadReportButton
│   │
│   └── FooterActions
│
├── ConflictResolutionModal
│   ├── PatientDetails
│   ├── RequestedSlot
│   ├── ConflictExplanation
│   ├── SuggestionOptions
│   │   ├── SameDayOption
│   │   ├── NextDayOption
│   │   ├── AlternativeProviderOption
│   │   ├── SkipOption
│   │   └── ManualOverrideForm
│   └── ModalActions
│
├── ConfirmationScreen
│   ├── StatisticsSummary
│   ├── ProviderBreakdown
│   ├── DateBreakdown
│   └── ConfirmButton
│
├── CreationProgressScreen
│   ├── ProgressBar
│   ├── RealtimeUpdates
│   └── LatestCreatedList
│
└── SuccessScreen
    ├── ResultsSummary
    ├── QuickActions
    │   ├── GoToCalendarButton
    │   ├── DownloadReportButton
    │   ├── NewUploadButton
    │   └── SendNotificationsButton
    └── CloseButton
```

---

## 🎨 UI Components Library

### Custom Components to Build

1. **FileDropzone**
   ```jsx
   <FileDropzone
     accept=".csv,.xlsx"
     maxSize={100 * 1024 * 1024}
     onDrop={handleFileDrop}
     onError={handleError}
   />
   ```

2. **ProgressIndicator**
   ```jsx
   <ProgressIndicator
     current={65}
     total={100}
     step="Validating providers"
     timeRemaining={15}
   />
   ```

3. **ConflictCard**
   ```jsx
   <ConflictCard
     rowNumber={12}
     patient="Rajesh Kumar"
     provider="Dr. Sharma"
     conflictType="PROVIDER_TIME_OVERLAP"
     suggestions={suggestions}
     onResolve={handleResolve}
   />
   ```

4. **SuggestionOption**
   ```jsx
   <SuggestionOption
     type="same_day"
     date="2026-03-20"
     time="10:45"
     reason="Next available slot today"
     isSelected={selected === 0}
     onSelect={() => setSelected(0)}
   />
   ```

5. **StatCard**
   ```jsx
   <StatCard
     icon="✅"
     count={120}
     label="Auto-Approved"
     color="green"
     onClick={() => filterByStatus('approved')}
   />
   ```

---

## 📊 State Management

### Global State (Redux/Context)

```javascript
const bulkAppointmentState = {
  // Current session
  sessionId: 'abc-123',
  filename: 'appointments.csv',
  status: 'reviewing', // 'uploading', 'processing', 'reviewing', 'creating', 'completed'

  // Statistics
  stats: {
    totalRows: 150,
    autoApproved: 120,
    needsReview: 25,
    rejected: 5,
    created: 0,
    failed: 0,
    patientsCreated: 0
  },

  // Items
  items: {
    autoApproved: [...],
    needsReview: [...],
    rejected: [...]
  },

  // Current conflict being resolved
  currentConflict: {
    itemId: 'item-123',
    rowNumber: 12,
    selectedSuggestion: null,
    manualOverride: null
  },

  // UI state
  ui: {
    currentStep: 'review', // 'upload', 'processing', 'review', 'confirm', 'creating', 'success'
    activeTab: 'needsReview',
    filters: {
      conflictType: 'all',
      searchQuery: ''
    },
    isModalOpen: false
  }
};
```

### Actions

```javascript
// Upload
const uploadFile = (file) => async (dispatch) => {
  dispatch({ type: 'UPLOAD_START' });
  const response = await api.uploadBulkFile(file);
  dispatch({ type: 'UPLOAD_SUCCESS', payload: response });
  dispatch(startProcessing(response.session_id));
};

// Process
const startProcessing = (sessionId) => async (dispatch) => {
  dispatch({ type: 'PROCESSING_START' });
  await api.processBulkFile(sessionId);

  // Poll for status
  const pollInterval = setInterval(async () => {
    const status = await api.getSessionStatus(sessionId);
    dispatch({ type: 'PROCESSING_UPDATE', payload: status });

    if (status.status === 'validated') {
      clearInterval(pollInterval);
      dispatch({ type: 'PROCESSING_COMPLETE' });
      dispatch(loadItems(sessionId));
    }
  }, 500);
};

// Load items
const loadItems = (sessionId) => async (dispatch) => {
  const items = await api.getSessionItems(sessionId);
  dispatch({ type: 'ITEMS_LOADED', payload: items });
};

// Resolve conflict
const resolveConflict = (itemId, resolution) => async (dispatch) => {
  await api.resolveConflict(itemId, resolution);
  dispatch({ type: 'CONFLICT_RESOLVED', payload: { itemId, resolution } });
};

// Create appointments
const createAppointments = (sessionId) => async (dispatch) => {
  dispatch({ type: 'CREATION_START' });

  // Poll for creation progress
  const result = await api.createAppointments(sessionId);

  dispatch({ type: 'CREATION_COMPLETE', payload: result });
};
```

---

## 🔌 API Integration

### API Service Layer

```javascript
// services/bulkAppointmentApi.js

export const bulkAppointmentApi = {
  // Download template
  downloadTemplate: async () => {
    const response = await fetch('/api/bulk-appointments/template');
    const blob = await response.blob();
    downloadBlob(blob, 'bulk_appointment_template.csv');
  },

  // Upload file
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/bulk-appointments/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });

    return response.json();
  },

  // Process file
  processFile: async (sessionId) => {
    const response = await fetch(`/api/bulk-appointments/process/${sessionId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    return response.json();
  },

  // Get session status
  getSessionStatus: async (sessionId) => {
    const response = await fetch(`/api/bulk-appointments/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    return response.json();
  },

  // Get items
  getItems: async (sessionId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`/api/bulk-appointments/sessions/${sessionId}/items?${query}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    return response.json();
  },

  // Resolve conflict
  resolveConflict: async (sessionId, itemId, resolution) => {
    const response = await fetch(`/api/bulk-appointments/sessions/${sessionId}/items/${itemId}/resolve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resolution)
    });

    return response.json();
  },

  // Create appointments
  createAppointments: async (sessionId) => {
    const response = await fetch(`/api/bulk-appointments/sessions/${sessionId}/create`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    return response.json();
  }
};
```

---

## 🎭 Error Handling

### User-Friendly Error Messages

```javascript
const errorMessages = {
  // Upload errors
  'FILE_TOO_LARGE': 'File size exceeds 100MB. Please split into smaller files.',
  'INVALID_FILE_TYPE': 'Please upload a CSV or XLSX file.',
  'EMPTY_FILE': 'The file is empty. Please add appointment data.',

  // Processing errors
  'NO_PROVIDERS': 'No providers found in system. Please add providers first.',
  'ALL_ROWS_INVALID': 'All rows have errors. Please check your data format.',
  'SESSION_EXPIRED': 'Session expired. Please upload the file again.',

  // Creation errors
  'CREATION_FAILED': 'Failed to create some appointments. Please retry.',
  'DATABASE_ERROR': 'Database error. Please contact support.',

  // Network errors
  'NETWORK_ERROR': 'Network error. Please check your connection and retry.',
  'TIMEOUT': 'Request timed out. Please try again.'
};

const handleError = (error) => {
  const message = errorMessages[error.code] || 'An unexpected error occurred';
  toast.error(message);
  logError(error);
};
```

---

## 📱 Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 768px) {
  .bulk-flow-modal {
    width: 100%;
    height: 100vh;
    margin: 0;
  }

  .summary-cards {
    flex-direction: column;
  }

  .conflict-card {
    padding: 12px;
  }
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
  .bulk-flow-modal {
    width: 90%;
    max-width: 900px;
  }
}

/* Desktop */
@media (min-width: 1025px) {
  .bulk-flow-modal {
    width: 80%;
    max-width: 1200px;
  }
}
```

---

## 🚀 Performance Optimizations

### 1. **Virtual Scrolling**
For large lists (1000+ items):
```jsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ConflictCard data={items[index]} />
    </div>
  )}
</FixedSizeList>
```

### 2. **Debounced Search**
```javascript
const debouncedSearch = useMemo(
  () => debounce((query) => {
    dispatch(filterItems(query));
  }, 300),
  []
);
```

### 3. **Lazy Loading**
```jsx
const ConflictResolutionModal = lazy(() => import('./ConflictResolutionModal'));
```

### 4. **Memoization**
```jsx
const filteredItems = useMemo(() => {
  return items.filter(item =>
    item.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [items, searchQuery]);
```

---

## 🧪 Testing Strategy

### Unit Tests
```javascript
describe('ConflictResolution', () => {
  it('should accept first suggestion', () => {
    const { getByText } = render(<ConflictCard {...props} />);
    fireEvent.click(getByText('Select'));
    expect(mockResolve).toHaveBeenCalledWith({
      action: 'accept_suggestion',
      data: { suggestion_index: 0 }
    });
  });
});
```

### Integration Tests
```javascript
describe('Bulk Appointment Flow', () => {
  it('should complete happy path', async () => {
    // Upload file
    const file = createMockCSV();
    await uploadFile(file);

    // Wait for processing
    await waitFor(() => expect(screen.getByText('validated')).toBeInTheDocument());

    // Create appointments
    fireEvent.click(screen.getByText('Create Appointments'));

    // Verify success
    await waitFor(() => expect(screen.getByText('143 appointments created')).toBeInTheDocument());
  });
});
```

---

## 📖 Documentation for Users

### In-App Help Text

**Upload Screen**:
> Upload a CSV or Excel file with patient appointment details. Download our template for the correct format. Maximum file size: 100MB.

**Review Screen**:
> Green items will be created automatically. Yellow items need your review. Red items have errors and won't be created.

**Conflict Resolution**:
> This appointment conflicts with an existing booking. Choose one of the suggested alternatives or enter a custom time.

---

## 🎯 Success Metrics

Track these metrics:
1. **Upload Success Rate**: % of files successfully uploaded
2. **Auto-Approval Rate**: % of rows auto-approved
3. **Resolution Time**: Average time to resolve conflicts
4. **Creation Success Rate**: % of appointments successfully created
5. **User Satisfaction**: NPS score for bulk upload feature

---

## 🔮 Future Enhancements

### Phase 2 Features
1. **Recurring Appointments**
   - "Weekly for 8 weeks" pattern
   - Automatically generate series

2. **Waitlist Integration**
   - Auto-fill cancelled slots
   - Priority-based scheduling

3. **Email Notifications**
   - Send confirmation to patients
   - Customizable templates

4. **Advanced Filters**
   - Filter by provider specialization
   - Filter by appointment type
   - Date range filters

5. **Bulk Edit**
   - Change provider for multiple appointments
   - Reschedule entire day

6. **Smart Scheduling**
   - AI-powered time suggestions
   - Consider patient preferences
   - Optimize provider schedules

7. **Mobile App**
   - Native iOS/Android app
   - Upload from phone camera (scan form)
   - Push notifications

---

**This plan provides a complete, production-ready frontend flow for the bulk appointment system!**
