# AI-Powered Bulk Appointment Creation System

## Overview

This feature allows healthcare staff to upload files (Excel, CSV, PDF) containing multiple appointment records and automatically create appointments in bulk using AI-powered data extraction.

## Key Features

### 🤖 Intelligent Data Extraction
- **Multi-format support**: Excel (.xlsx, .xls), CSV, PDF documents
- **LLM-powered extraction**: Flexible data parsing using OpenAI, Anthropic Claude, or local models
- **Natural language understanding**: Handles unstructured data and various date formats
- **OCR support**: Extract data from scanned PDFs and images

### 🔍 Smart Matching & Auto-Creation
- **Patient matching**: Fuzzy search by name, phone number, or ABHA ID
- **Auto-create patients**: Automatically create patient records if not found
- **Provider matching**: Match by name, specialization, or department
- **Service type detection**: Auto-detect service types from appointment descriptions

### ⚡ Intelligent Conflict Resolution
- **Automatic conflict detection**: Check all appointments for scheduling conflicts
- **AI-powered suggestions**: LLM suggests nearest available time slots
- **Batch validation**: Validate all appointments before creation
- **Visual conflict dashboard**: Color-coded status indicators

### 📊 Advanced Capabilities
- **Recurring appointments**: "Weekly physiotherapy for 8 weeks"
- **Natural language input**: "10 appointments with Dr. Smith, Mon-Fri 9am"
- **Session management**: Track imports, rollback if needed
- **Detailed reporting**: Export success/failure reports
- **Template library**: Reusable templates for common formats

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ File Upload  │→ │ Preview Grid │→ │   Validation │      │
│  │  Component   │  │  (Editable)  │  │   Dashboard  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │                 │                 │              │
└───────────┼─────────────────┼─────────────────┼──────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Flask)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ File Parsers │→ │  LLM Service │→ │ Bulk Service │      │
│  │ (xlsx/csv/   │  │ (Multi-LLM)  │  │  (Matching & │      │
│  │  pdf)        │  │              │  │  Creation)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ encounters | patients | providers | bulk_sessions    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Python 3.11+**
- **Flask** - Web framework
- **SQLAlchemy** - ORM
- **Pydantic** - Data validation
- **OpenAI SDK** - GPT-4 integration
- **Anthropic SDK** - Claude integration
- **openpyxl** - Excel parsing
- **pandas** - Data manipulation
- **pdfplumber** - PDF extraction
- **pytesseract** - OCR
- **rapidfuzz** - Fuzzy string matching

### Frontend
- **React 18**
- **Material-UI (MUI)** - UI components
- **AG Grid** - Editable data grid
- **react-dropzone** - File upload
- **axios** - HTTP client
- **papaparse** - CSV parsing
- **xlsx** - Excel preview

## Workflow

```
1. UPLOAD
   ├─ User uploads Excel/CSV/PDF file
   └─ File stored temporarily on server

2. EXTRACTION (AI-Powered)
   ├─ Parse file content (structured/unstructured)
   ├─ LLM extracts appointment data
   │  ├─ Patient info (name, phone, DOB, etc.)
   │  ├─ Provider name
   │  ├─ Date & time (various formats)
   │  ├─ Appointment type
   │  └─ Notes/chief complaint
   └─ Return structured JSON

3. PREVIEW & EDIT
   ├─ Display extracted data in editable grid
   ├─ User can modify any field
   └─ Add/remove rows

4. VALIDATION
   ├─ Match patients (fuzzy search)
   │  ├─ Found: Link to existing patient
   │  └─ Not found: Auto-create new patient
   ├─ Match providers by name/dept
   ├─ Check date/time validity
   ├─ Detect scheduling conflicts
   └─ Show validation results

5. CONFLICT RESOLUTION
   ├─ LLM suggests nearest available slots
   ├─ User accepts/rejects suggestions
   └─ Manual override option

6. CREATION
   ├─ Create all valid appointments in transaction
   ├─ Track success/failure for each
   └─ Generate import session record

7. RESULTS
   ├─ Show summary (created, failed, warnings)
   ├─ Export detailed report
   └─ Option to rollback if needed
```

## File Structure

```
features/bulk-appointments-ai/
├── README.md                          # This file
├── IMPLEMENTATION_GUIDE.md            # Integration instructions
├── backend/
│   ├── models/
│   │   ├── bulk_import_session.py     # Import session tracking
│   │   └── bulk_import_item.py        # Individual import items
│   ├── services/
│   │   ├── llm_service.py             # Multi-provider LLM service
│   │   ├── file_parser_service.py     # File parsing (xlsx/csv/pdf)
│   │   ├── bulk_appointment_service.py # Core bulk logic
│   │   └── conflict_resolver.py       # AI conflict resolution
│   ├── routes/
│   │   └── bulk_routes.py             # API endpoints
│   ├── schemas/
│   │   ├── bulk_request_schemas.py    # Request schemas
│   │   └── bulk_response_schemas.py   # Response schemas
│   └── migrations/
│       └── add_bulk_import_tables.py  # Database migration
├── frontend/
│   ├── pages/
│   │   └── BulkAppointmentImport.jsx  # Main page
│   ├── components/
│   │   ├── FileUploader.jsx           # File upload component
│   │   ├── AppointmentPreviewGrid.jsx # Editable grid
│   │   ├── ValidationDashboard.jsx    # Validation results
│   │   ├── ConflictResolver.jsx       # Conflict resolution UI
│   │   ├── ImportResults.jsx          # Results summary
│   │   └── ImportWizard.jsx           # Stepper component
│   ├── api/
│   │   └── bulkAppointments.js        # API client
│   └── hooks/
│       └── useBulkImport.js           # Custom hook
├── examples/
│   ├── sample-appointments.xlsx       # Sample Excel file
│   ├── sample-appointments.csv        # Sample CSV file
│   ├── sample-template.xlsx           # Template file
│   └── format-guide.md                # Format documentation
├── docs/
│   ├── API.md                         # API documentation
│   ├── USER_GUIDE.md                  # End-user guide
│   ├── ARCHITECTURE.md                # Technical details
│   └── PROMPTS.md                     # LLM prompt templates
└── requirements.txt                   # Python dependencies
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL database
- LLM API key (OpenAI, Anthropic, or local model)

### Installation

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for detailed instructions.

## Usage Example

### Upload File
```javascript
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('llm_provider', 'openai');

const response = await bulkAppointmentsApi.upload(formData);
// Returns: { session_id, extracted_data, preview }
```

### Validate Data
```javascript
const validation = await bulkAppointmentsApi.validate({
  session_id: sessionId,
  appointments: editedAppointments
});
// Returns: { valid, conflicts, errors, warnings }
```

### Resolve Conflicts
```javascript
const suggestions = await bulkAppointmentsApi.resolveConflicts({
  session_id: sessionId,
  conflicts: conflictList
});
// Returns: { suggestions: [{ original, suggested_slots }] }
```

### Create Appointments
```javascript
const result = await bulkAppointmentsApi.create({
  session_id: sessionId,
  appointments: finalAppointments
});
// Returns: { created, failed, session_id, report }
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# LLM Configuration
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
DEFAULT_LLM_PROVIDER=openai  # openai | anthropic | local

# File Upload
MAX_UPLOAD_SIZE_MB=50
ALLOWED_FILE_TYPES=xlsx,xls,csv,pdf

# Bulk Import Settings
MAX_APPOINTMENTS_PER_BATCH=1000
AUTO_CREATE_PATIENTS=true
CONFLICT_RESOLUTION_ENABLED=true
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/appointments/bulk/upload` | Upload file and extract data |
| POST | `/api/appointments/bulk/validate` | Validate appointments |
| POST | `/api/appointments/bulk/resolve-conflicts` | Get conflict suggestions |
| POST | `/api/appointments/bulk/create` | Create appointments |
| GET | `/api/appointments/bulk/sessions` | List import sessions |
| GET | `/api/appointments/bulk/sessions/:id` | Get session details |
| POST | `/api/appointments/bulk/rollback/:id` | Rollback import |
| GET | `/api/appointments/bulk/export/:id` | Export results CSV |

## Success Metrics

- ✅ Process 1000+ appointments in single upload
- ✅ 95%+ accuracy in AI extraction
- ✅ Auto-resolve 80%+ conflicts
- ✅ Sub-30s processing for 100 appointments
- ✅ Clear error reporting for all failures

## Support

For issues or questions, see:
- [Implementation Guide](./IMPLEMENTATION_GUIDE.md)
- [User Guide](./docs/USER_GUIDE.md)
- [API Documentation](./docs/API.md)

## License

Part of CV Raman Health platform.
