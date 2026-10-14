# Implementation Guide: AI Bulk Appointment Creation

This guide provides step-by-step instructions to integrate the bulk appointment feature into your CV Raman Health application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [Database Migration](#database-migration)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Deployment](#deployment)

## Prerequisites

### Python Packages

Install required packages:

```bash
cd backend
pip install openai==1.12.0
pip install anthropic==0.18.1
pip install openpyxl==3.1.2
pip install pandas==2.2.0
pip install pdfplumber==0.10.3
pip install pytesseract==0.3.10
pip install rapidfuzz==3.6.1
pip install python-dateutil==2.8.2
```

### Node Packages

Install required packages:

```bash
cd frontend
npm install react-dropzone
npm install ag-grid-react ag-grid-community
npm install react-stepper-horizontal
npm install xlsx
npm install papaparse
npm install date-fns
```

### System Dependencies

For OCR support (optional):

```bash
# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# Windows
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
```

## Backend Setup

### Step 1: Copy Backend Files

```bash
# From the features folder, copy to main backend
cp -r features/bulk-appointments-ai/backend/models/* backend/app/bulk_imports/models/
cp -r features/bulk-appointments-ai/backend/services/* backend/app/bulk_imports/services/
cp -r features/bulk-appointments-ai/backend/routes/* backend/app/bulk_imports/routes/
cp -r features/bulk-appointments-ai/backend/schemas/* backend/app/bulk_imports/schemas/
```

### Step 2: Create Bulk Imports Module

Create the module structure:

```bash
mkdir -p backend/app/bulk_imports
mkdir -p backend/app/bulk_imports/models
mkdir -p backend/app/bulk_imports/services
mkdir -p backend/app/bulk_imports/routes
mkdir -p backend/app/bulk_imports/schemas
```

Create `__init__.py` files:

```python
# backend/app/bulk_imports/__init__.py
from .routes.bulk_routes import bulk_bp

# backend/app/bulk_imports/models/__init__.py
from .bulk_import_session import BulkImportSession
from .bulk_import_item import BulkImportItem

# backend/app/bulk_imports/services/__init__.py
from .llm_service import LLMService
from .file_parser_service import FileParserService
from .bulk_appointment_service import BulkAppointmentService
from .conflict_resolver import ConflictResolverService

# backend/app/bulk_imports/schemas/__init__.py
from .bulk_request_schemas import *
from .bulk_response_schemas import *
```

### Step 3: Register Blueprint

Edit `backend/app/__init__.py`:

```python
from app.bulk_imports import bulk_bp

def create_app(config_name='development'):
    # ... existing code ...

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(patients_bp)
    app.register_blueprint(appointments_bp)
    app.register_blueprint(bulk_bp)  # Add this line

    return app
```

### Step 4: Add Configuration

Edit `backend/config.py`:

```python
class Config:
    # ... existing config ...

    # LLM Configuration
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
    DEFAULT_LLM_PROVIDER = os.getenv('DEFAULT_LLM_PROVIDER', 'openai')

    # File Upload Configuration
    MAX_UPLOAD_SIZE_MB = int(os.getenv('MAX_UPLOAD_SIZE_MB', 50))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads', 'bulk_imports')
    ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv', 'pdf'}

    # Bulk Import Settings
    MAX_APPOINTMENTS_PER_BATCH = int(os.getenv('MAX_APPOINTMENTS_PER_BATCH', 1000))
    AUTO_CREATE_PATIENTS = os.getenv('AUTO_CREATE_PATIENTS', 'true').lower() == 'true'
    CONFLICT_RESOLUTION_ENABLED = os.getenv('CONFLICT_RESOLUTION_ENABLED', 'true').lower() == 'true'

    # Fuzzy Matching Threshold (0-100)
    FUZZY_MATCH_THRESHOLD = int(os.getenv('FUZZY_MATCH_THRESHOLD', 80))
```

### Step 5: Update Environment Variables

Edit `backend/.env`:

```bash
# LLM Configuration
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
DEFAULT_LLM_PROVIDER=openai

# File Upload
MAX_UPLOAD_SIZE_MB=50
ALLOWED_FILE_TYPES=xlsx,xls,csv,pdf

# Bulk Import Settings
MAX_APPOINTMENTS_PER_BATCH=1000
AUTO_CREATE_PATIENTS=true
CONFLICT_RESOLUTION_ENABLED=true
FUZZY_MATCH_THRESHOLD=80
```

### Step 6: Create Upload Directory

```bash
mkdir -p backend/uploads/bulk_imports
```

Add to `.gitignore`:

```
# Uploads
uploads/
```

## Database Migration

### Step 1: Run Migration

```bash
cd backend
python -m flask db revision -m "Add bulk import tables"
```

Copy the migration content from `features/bulk-appointments-ai/backend/migrations/add_bulk_import_tables.py` into the generated migration file.

### Step 2: Apply Migration

```bash
python -m flask db upgrade
```

### Step 3: Verify Tables

```bash
python -m flask shell
>>> from app import db
>>> from app.bulk_imports.models import BulkImportSession, BulkImportItem
>>> db.engine.table_names()
```

You should see `bulk_import_sessions` and `bulk_import_items` in the list.

## Frontend Setup

### Step 1: Copy Frontend Files

```bash
# Copy all frontend files
cp -r features/bulk-appointments-ai/frontend/pages/* frontend/src/pages/appointments/
cp -r features/bulk-appointments-ai/frontend/components/* frontend/src/components/bulk-import/
cp features/bulk-appointments-ai/frontend/api/bulkAppointments.js frontend/src/api/
cp features/bulk-appointments-ai/frontend/hooks/useBulkImport.js frontend/src/hooks/
```

### Step 2: Create Component Directory

```bash
mkdir -p frontend/src/components/bulk-import
mkdir -p frontend/src/pages/appointments
mkdir -p frontend/src/hooks
```

### Step 3: Add Route

Edit `frontend/src/App.js`:

```javascript
import BulkAppointmentImport from './pages/appointments/BulkAppointmentImport';

function App() {
  return (
    <Routes>
      {/* ... existing routes ... */}
      <Route path="/appointments/bulk-import" element={<BulkAppointmentImport />} />
    </Routes>
  );
}
```

### Step 4: Add Navigation Menu Item

Edit your sidebar/navigation component to add:

```javascript
<MenuItem
  icon={<UploadFileIcon />}
  onClick={() => navigate('/appointments/bulk-import')}
>
  Bulk Import
</MenuItem>
```

## Configuration

### Backend Config Validation

Test your configuration:

```python
# backend/test_config.py
from app import create_app
from config import Config

app = create_app()

print("LLM Provider:", Config.DEFAULT_LLM_PROVIDER)
print("OpenAI Key:", "✓" if Config.OPENAI_API_KEY else "✗")
print("Anthropic Key:", "✓" if Config.ANTHROPIC_API_KEY else "✗")
print("Upload Folder:", Config.UPLOAD_FOLDER)
print("Max Upload Size:", Config.MAX_UPLOAD_SIZE_MB, "MB")
```

Run:

```bash
cd backend
python test_config.py
```

### Frontend API Base URL

Edit `frontend/src/api/client.js` if needed:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';
```

## Testing

### Backend Unit Tests

```bash
cd backend
python -m pytest tests/test_bulk_imports.py -v
```

### Test File Upload

```bash
# Create a test CSV
cat > test_appointments.csv << EOF
Patient Name,Phone,Date,Time,Provider,Type,Notes
John Doe,9876543210,2026-03-15,09:00,Dr. Smith,consultation,Follow-up
Jane Smith,9876543211,2026-03-15,10:00,Dr. Smith,consultation,New patient
EOF

# Upload test
curl -X POST http://localhost:5002/api/appointments/bulk/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test_appointments.csv" \
  -F "llm_provider=openai"
```

### Frontend Testing

Start both servers:

```bash
# Terminal 1: Backend
cd backend
python run.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

Navigate to: `http://localhost:5173/appointments/bulk-import`

Test workflow:
1. Upload `examples/sample-appointments.csv`
2. Verify extraction results
3. Edit if needed
4. Validate
5. Resolve conflicts
6. Create appointments
7. Check results

## Deployment

### Production Checklist

- [ ] Set production LLM API keys
- [ ] Configure file upload size limits (reverse proxy)
- [ ] Set up file storage (S3 or persistent volume)
- [ ] Enable rate limiting on bulk endpoints
- [ ] Configure logging for audit trail
- [ ] Set up monitoring for LLM API usage
- [ ] Test with production data samples
- [ ] Train staff on usage
- [ ] Prepare rollback procedures

### Nginx Configuration (if using)

```nginx
# Increase upload size
client_max_body_size 50M;

# Increase timeout for bulk processing
proxy_read_timeout 300s;
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
```

### Environment Variables (Production)

```bash
# Use production LLM keys
OPENAI_API_KEY=sk-prod-xxx
ANTHROPIC_API_KEY=sk-ant-prod-xxx

# Tighten limits
MAX_APPOINTMENTS_PER_BATCH=500
MAX_UPLOAD_SIZE_MB=25

# Enable strict validation
AUTO_CREATE_PATIENTS=false  # Require manual approval
```

## Troubleshooting

### Issue: "LLM API Key not found"

**Solution**: Verify `.env` file has correct API keys and restart Flask server.

### Issue: "File upload fails"

**Solution**:
1. Check `UPLOAD_FOLDER` exists and has write permissions
2. Verify `MAX_CONTENT_LENGTH` in Flask config
3. Check reverse proxy upload limits

### Issue: "Tesseract not found" (OCR)

**Solution**: Install tesseract-ocr system package or disable OCR in PDF parser.

### Issue: "Import fails silently"

**Solution**: Check logs at `backend/logs/` for detailed error messages.

### Issue: "Conflicts not resolving"

**Solution**: Verify provider schedules are set up correctly in database.

## Next Steps

After successful integration:

1. Create sample templates for your team
2. Train staff on bulk import workflow
3. Set up monitoring for import success rates
4. Gather feedback and iterate
5. Consider adding custom field mappings for specific use cases

## Support

For issues during implementation:
- Check [API Documentation](./docs/API.md)
- Review [Architecture Guide](./docs/ARCHITECTURE.md)
- See [User Guide](./docs/USER_GUIDE.md) for usage patterns

---

**Ready to integrate?** Follow the steps above sequentially and test after each major step!
