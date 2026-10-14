# Medicine Inventory Management System - Remaining Work Plan
**CV Raman Health Platform**
**Created:** March 18, 2026
**Status:** Implementation Phase - 85% Backend Complete, 50% Frontend Complete
**Target Completion:** 6-8 weeks

---

## Executive Summary

### Current State Analysis
- ✅ **Backend:** 3,020 lines of code, 11 tables, 50+ APIs (85% complete)
- ✅ **Database:** All schemas created with proper relationships
- ⚠️ **Frontend:** 5 pages implemented, 5 pages placeholder/missing (50% complete)
- ❌ **Critical Features:** FIFO/FEFO, alerts automation, analytics (0-20% complete)
- ❌ **Testing:** No test suite (0% complete)

### What Works Today
1. Medicine Master (Full CRUD, search, filters) ✅
2. Stock Management (View only, PAR levels display) ✅
3. Inventory Dashboard (Stats cards, navigation) ✅
4. Backend APIs (All core operations) ✅
5. Supplier/PO/Batch/Dispensing/Requisition backends ✅

### Critical Gaps (Production Blockers)
1. **Purchase Order UI** - Cannot purchase medicines ❌
2. **Dispensing UI** - Cannot dispense to patients ❌
3. **FIFO/FEFO Logic** - Regulatory compliance issue ❌
4. **Alert Automation** - Patient safety risk ❌
5. **Batch Selection** - Expiry management missing ❌

---

## Implementation Strategy

### Approach: **Critical Path First → Nice-to-Haves Later**

**Phase Breakdown:**
1. **Sprint 1-2 (Weeks 1-2):** Critical UI - PO & Dispensing
2. **Sprint 3 (Week 3):** Batch Logic & FIFO/FEFO
3. **Sprint 4 (Week 4):** Alert Automation & Background Jobs
4. **Sprint 5-6 (Weeks 5-6):** Remaining UIs & Features
5. **Sprint 7 (Week 7):** Analytics & Reports
6. **Sprint 8 (Week 8):** Testing, Integration & Deployment

---

## SPRINT 1: Purchase Order UI (Week 1, 5 days)

### Objective
Complete Purchase Order management interface to enable medicine procurement workflow.

### Backend Status: ✅ COMPLETE
```
✅ Models: PurchaseOrder, PurchaseOrderItem, Supplier
✅ APIs: Create PO, Approve, Receive, List, Filter
✅ Workflow: Draft → Pending → Approved → Sent → Received
```

### Frontend Tasks (5 days)

#### Day 1: Supplier Selection Component
**File:** `/frontend/src/components/inventory/SupplierSelector.jsx`
```jsx
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem } from '@/components/ui/select';
import inventoryAPI from '@/api/inventory';

// Features:
// - Search suppliers by name
// - Display contact info, rating, lead time
// - Show preferred suppliers first
// - Filter by active status
```
**Deliverable:** Reusable supplier dropdown with search

#### Day 2: PO Creation Wizard (Part 1 - Basic Info)
**File:** `/frontend/src/pages/inventory/PurchaseOrderWizard.jsx`
```jsx
// Step 1: Basic Information
{
  supplier_id: UUID,
  expected_delivery_date: Date,
  delivery_location_id: UUID,
  internal_notes: String
}

// Components needed:
// - SupplierSelector
// - LocationSelector (from stock mgmt)
// - DatePicker (shadcn)
// - NotesTextarea
```
**Pattern:** Follow `/frontend/src/components/ipd/AdmissionWizard.jsx` structure

#### Day 3: PO Creation Wizard (Part 2 - Item Selection)
**File:** `/frontend/src/components/inventory/POItemsTable.jsx`
```jsx
// Features:
// - Medicine search/autocomplete
// - Add/remove line items
// - Quantity, unit price, tax % input
// - Auto-calculate: discount, tax, total per line
// - Show grand total at bottom

// Table columns:
// Medicine | Qty | Unit Price | Discount % | Tax % | Total | Actions
```
**Pattern:** Similar to existing MedicinesList table

#### Day 4: PO List & Detail View
**File:** `/frontend/src/pages/inventory/PurchaseOrdersList.jsx`
```jsx
// Features:
// - Paginated table with filters
// - Status chips (Draft, Pending, Approved, Received)
// - Search by PO number, supplier
// - Filter by status, date range
// - Quick actions: View, Approve, Receive

// Table columns:
// PO # | Date | Supplier | Items | Amount | Status | Actions
```

**File:** `/frontend/src/pages/inventory/PurchaseOrderDetail.jsx`
```jsx
// Features:
// - PO header info (supplier, dates, status)
// - Items table (read-only)
// - Financial summary
// - Status timeline (created → approved → received)
// - Action buttons based on status
// - Print/Export option
```

#### Day 5: PO Approval & Goods Receipt
**File:** `/frontend/src/components/inventory/POApprovalDialog.jsx`
```jsx
// Features:
// - Review PO details
// - Approval notes field
// - Approve/Reject buttons
// - Email notification trigger
```

**File:** `/frontend/src/components/inventory/GoodsReceiptDialog.jsx`
```jsx
// Features:
// - List ordered items
// - Input received quantity (can differ from ordered)
// - Input batch details per item:
//   - Batch number
//   - Manufacture date
//   - Expiry date
//   - Barcode (optional)
// - Mark items as received
// - Auto-create batches
// - Update stock levels
```
**Critical:** This creates medicine_batches records

### Routes to Add
```javascript
// In App.jsx
<Route path="inventory/purchase-orders" element={<PurchaseOrdersList />} />
<Route path="inventory/purchase-orders/new" element={<PurchaseOrderWizard />} />
<Route path="inventory/purchase-orders/:id" element={<PurchaseOrderDetail />} />
```

### Testing Checklist
- [ ] Create PO with 3 items
- [ ] Calculate totals correctly (discount, tax)
- [ ] Save as draft
- [ ] Submit for approval
- [ ] Approve PO (different user if possible)
- [ ] Receive goods partially (2 of 3 items)
- [ ] Verify batches created
- [ ] Verify stock updated
- [ ] Receive remaining item
- [ ] Verify PO status = RECEIVED

### Success Criteria
✅ Can create complete purchase order
✅ Approval workflow functional
✅ Goods receipt creates batches
✅ Stock levels auto-update
✅ Financial calculations accurate

---

## SPRINT 2: Dispensing UI (Week 2, 5 days)

### Objective
Complete medicine dispensing interface to enable patient medication workflow.

### Backend Status: ✅ COMPLETE
```
✅ Models: DispensingRecord
✅ APIs: Validate Rx, Check availability, Dispense, History
✅ Patient linking via patient_id, encounter_id
```

### Frontend Tasks (5 days)

#### Day 1: Patient & Prescription Search
**File:** `/frontend/src/components/inventory/DispensingPatientSearch.jsx`
```jsx
// Reuse existing PatientSearch component
import PatientSearch from '@/components/patients/PatientSearch';

// Additional fields:
// - Encounter selection (if multiple active)
// - Prescription ID (future integration)
// - Prescribed by (healthcare provider)
```

**File:** `/frontend/src/components/inventory/MedicineSearchAutocomplete.jsx`
```jsx
// Features:
// - Type-ahead search (generic name, brand name)
// - Show: Name, strength, form, stock availability
// - Display stock level badge (in stock / low / out)
// - Show multiple locations if applicable
```

#### Day 2: Batch Selection with FIFO/FEFO
**File:** `/frontend/src/components/inventory/BatchSelector.jsx`
```jsx
// CRITICAL COMPONENT - This implements FIFO/FEFO

// Features:
// - List all available batches for selected medicine
// - Sort by:
//   - FEFO: Expiry date (earliest first) - DEFAULT
//   - FIFO: Received date (earliest first)
// - Display per batch:
//   - Batch number
//   - Expiry date (with color coding)
//   - Available qty
//   - Days to expiry
// - Auto-select batch by strategy
// - Allow manual override
// - Validate qty available
// - Warn if near expiry (<30 days)

// Color coding:
// - Green: >180 days
// - Yellow: 90-180 days
// - Orange: 30-90 days
// - Red: <30 days
// - Gray: Expired (cannot select)

// Algorithm (implemented here):
function selectBatch(batches, requestedQty, strategy = 'FEFO') {
  // Filter: active, not expired, has qty
  let available = batches.filter(b =>
    b.status === 'active' &&
    b.expiry_date > new Date() &&
    b.current_quantity > 0
  );

  // Sort by strategy
  if (strategy === 'FEFO') {
    available.sort((a, b) =>
      new Date(a.expiry_date) - new Date(b.expiry_date)
    );
  } else { // FIFO
    available.sort((a, b) =>
      new Date(a.received_date) - new Date(b.received_date)
    );
  }

  // Allocate quantity
  let allocations = [];
  let remaining = requestedQty;

  for (let batch of available) {
    if (remaining <= 0) break;

    let allocateQty = Math.min(batch.current_quantity, remaining);
    allocations.push({
      batch_id: batch.id,
      batch_number: batch.batch_number,
      quantity: allocateQty,
      expiry_date: batch.expiry_date
    });
    remaining -= allocateQty;
  }

  return {
    allocations,
    fulfilled: remaining === 0,
    shortfall: remaining
  };
}
```
**This is the MOST CRITICAL component for regulatory compliance**

#### Day 3: Dispensing Form
**File:** `/frontend/src/pages/inventory/DispensingPage.jsx`
```jsx
// Main dispensing interface

// Layout (3 columns):
// Left: Patient search & selection
// Center: Medicine selection & batch allocation
// Right: Cart summary & finalization

// Flow:
// 1. Search & select patient
// 2. Search medicine
// 3. Enter quantity needed
// 4. Auto-select batch (FEFO)
// 5. Review allocation
// 6. Add to cart
// 7. Repeat for multiple medicines
// 8. Enter dosage instructions
// 9. Calculate billing (if applicable)
// 10. Confirm & dispense
// 11. Print label (optional)

// Fields:
{
  patient_id: UUID,
  encounter_id: UUID, // optional
  items: [
    {
      medicine_id: UUID,
      quantity: Number,
      batch_allocations: [
        { batch_id: UUID, quantity: Number }
      ],
      dosage: String,
      frequency: String, // BD, TDS, OD, QID
      duration_days: Number,
      route: String, // Oral, IV, IM
      special_instructions: String
    }
  ],
  dispensed_from_location: UUID,
  payment_status: String // pending, paid, insurance, free
}
```

#### Day 4: Dispensing History & Returns
**File:** `/frontend/src/components/inventory/DispensingHistory.jsx`
```jsx
// Features:
// - View patient's medication history
// - Filter by date range
// - Show: Medicine, quantity, date, dispensed by
// - Link to original dispensing record
// - Return button (if within X days)

// Table columns:
// Date | Medicine | Qty | Batch | Expiry | Dispensed By | Actions
```

**File:** `/frontend/src/components/inventory/DispensingReturnDialog.jsx`
```jsx
// Features:
// - Select original dispensing record
// - Enter return quantity (≤ dispensed qty)
// - Enter return reason
// - Return to stock (add back to batch)
// - Create reverse stock movement
// - Update dispensing record status
```

#### Day 5: Label Printing & Integration
**File:** `/frontend/src/components/inventory/DispensingLabel.jsx`
```jsx
// Printable label component

// Label content:
// - Patient name, age
// - Medicine name, strength
// - Dosage instructions
// - Frequency & duration
// - Special instructions
// - Dispensed date
// - Expiry date
// - Batch number
// - Pharmacist name

// Print using window.print() or react-to-print library
```

**Integration Tasks:**
- Connect to PatientContext for patient data
- Link to encounter if from OPD/IPD
- Future: Connect to prescription system
- Future: Send to billing system

### Routes to Add
```javascript
<Route path="inventory/dispense" element={<DispensingPage />} />
<Route path="inventory/dispensing-history" element={<DispensingHistory />} />
```

### Testing Checklist
- [ ] Search and select patient
- [ ] Add 3 medicines to cart
- [ ] Verify FEFO batch selection
- [ ] Check stock availability validation
- [ ] Enter dosage for each
- [ ] Complete dispensing
- [ ] Verify stock reduced
- [ ] Verify dispensing record created
- [ ] View patient history
- [ ] Process return
- [ ] Verify stock added back
- [ ] Print label

### Success Criteria
✅ Can dispense medicines to patients
✅ FEFO batch selection automatic
✅ Stock validation prevents over-dispensing
✅ Dosage instructions captured
✅ Returns processed correctly
✅ Patient history accurate

---

## SPRINT 3: Batch Logic & FIFO/FEFO (Week 3, 5 days)

### Objective
Implement backend batch selection logic and expiry management automation.

### Backend Tasks (5 days)

#### Day 1: Batch Selection Service
**File:** `/backend/app/inventory/batch_service.py` (NEW)
```python
"""Batch selection logic for dispensing."""
from datetime import date, timedelta
from sqlalchemy import and_
from app.inventory.models import MedicineBatch, BatchStatus
from app.extensions import db

class BatchSelectionStrategy:
    FIFO = 'fifo'  # First In First Out
    FEFO = 'fefo'  # First Expiry First Out
    LIFO = 'lifo'  # Last In First Out (rarely used)

class BatchSelector:
    """Service for intelligent batch selection."""

    def __init__(self, strategy=BatchSelectionStrategy.FEFO):
        self.strategy = strategy

    def select_batches(self, medicine_id, location_id, quantity):
        """
        Select optimal batches for dispensing.

        Args:
            medicine_id: UUID of medicine
            location_id: UUID of location
            quantity: Required quantity

        Returns:
            {
                'allocations': [
                    {
                        'batch_id': UUID,
                        'batch_number': str,
                        'quantity': float,
                        'expiry_date': date,
                        'days_to_expiry': int
                    }
                ],
                'fulfilled': bool,
                'shortfall': float,
                'warnings': [str]
            }
        """
        # Get available batches
        batches = self._get_available_batches(medicine_id, location_id)

        # Sort by strategy
        sorted_batches = self._sort_batches(batches)

        # Allocate quantity
        allocations = []
        remaining = quantity
        warnings = []

        for batch in sorted_batches:
            if remaining <= 0:
                break

            # Check if near expiry
            if batch.days_to_expiry <= 30:
                warnings.append(
                    f"Batch {batch.batch_number} expires in "
                    f"{batch.days_to_expiry} days"
                )

            # Allocate from this batch
            allocate_qty = min(batch.current_quantity, remaining)

            allocations.append({
                'batch_id': batch.id,
                'batch_number': batch.batch_number,
                'quantity': allocate_qty,
                'expiry_date': batch.expiry_date,
                'days_to_expiry': batch.days_to_expiry
            })

            remaining -= allocate_qty

        return {
            'allocations': allocations,
            'fulfilled': remaining == 0,
            'shortfall': remaining,
            'warnings': warnings
        }

    def _get_available_batches(self, medicine_id, location_id):
        """Get all available batches for medicine at location."""
        today = date.today()

        return MedicineBatch.query.filter(
            and_(
                MedicineBatch.medicine_id == medicine_id,
                MedicineBatch.location_id == location_id,
                MedicineBatch.status == BatchStatus.ACTIVE,
                MedicineBatch.expiry_date > today,
                MedicineBatch.current_quantity > 0
            )
        ).all()

    def _sort_batches(self, batches):
        """Sort batches by strategy."""
        if self.strategy == BatchSelectionStrategy.FEFO:
            # Earliest expiry first
            return sorted(batches, key=lambda b: b.expiry_date)
        elif self.strategy == BatchSelectionStrategy.FIFO:
            # Earliest received first
            return sorted(batches, key=lambda b: b.received_date)
        elif self.strategy == BatchSelectionStrategy.LIFO:
            # Latest received first
            return sorted(batches, key=lambda b: b.received_date, reverse=True)
        return batches
```

#### Day 2: Integrate Batch Selection into Dispensing
**File:** `/backend/app/inventory/services.py` (UPDATE)
```python
# Add to dispense_medicine function

from app.inventory.batch_service import BatchSelector, BatchSelectionStrategy

def dispense_medicine(data, user_id):
    """Process medicine dispensing with automatic batch selection."""

    patient_id = data.get('patient_id')
    location_id = data.get('dispensed_from_location')
    items = data.get('items', [])

    dispensing_records = []

    for item in items:
        medicine_id = item['medicine_id']
        quantity = item['quantity']

        # Auto-select batches if not specified
        if 'batch_allocations' not in item or not item['batch_allocations']:
            selector = BatchSelector(strategy=BatchSelectionStrategy.FEFO)
            result = selector.select_batches(medicine_id, location_id, quantity)

            if not result['fulfilled']:
                raise ValueError(
                    f"Insufficient stock for medicine {medicine_id}. "
                    f"Shortfall: {result['shortfall']}"
                )

            item['batch_allocations'] = result['allocations']

        # Create dispensing record for each batch allocation
        for allocation in item['batch_allocations']:
            dispensing = DispensingRecord(
                patient_id=patient_id,
                medicine_id=medicine_id,
                batch_id=allocation['batch_id'],
                dispensed_quantity=allocation['quantity'],
                dosage=item.get('dosage'),
                frequency=item.get('frequency'),
                duration_days=item.get('duration_days'),
                route=item.get('route'),
                special_instructions=item.get('special_instructions'),
                dispensed_from_location=location_id,
                dispensed_by=user_id,
                status=DispensingStatus.DISPENSED
            )
            db.session.add(dispensing)

            # Update batch quantity
            batch = MedicineBatch.query.get(allocation['batch_id'])
            batch.current_quantity -= allocation['quantity']
            batch.consumed_quantity += allocation['quantity']

            # Create stock movement
            create_stock_movement({
                'movement_type': MovementType.ISSUE,
                'movement_direction': 'out',
                'medicine_id': medicine_id,
                'batch_id': allocation['batch_id'],
                'from_location_id': location_id,
                'quantity': allocation['quantity'],
                'patient_id': patient_id,
                'reference_type': 'dispensing'
            }, user_id)

            dispensing_records.append(dispensing)

    db.session.commit()
    return dispensing_records
```

#### Day 3: Expiry Alert Generation Service
**File:** `/backend/app/inventory/alert_service.py` (NEW)
```python
"""Alert generation and management service."""
from datetime import date, timedelta
from app.inventory.models import (
    MedicineBatch, InventoryStock, StockAlert,
    AlertType, BatchStatus, StockStatus
)
from app.extensions import db

class AlertService:
    """Service for generating and managing stock alerts."""

    # Alert thresholds (days before expiry)
    CRITICAL_EXPIRY_DAYS = 7
    HIGH_EXPIRY_DAYS = 30
    MEDIUM_EXPIRY_DAYS = 90
    LOW_EXPIRY_DAYS = 180

    def generate_expiry_alerts(self):
        """Generate alerts for expiring batches."""
        today = date.today()
        alerts_created = 0

        # Get active batches
        batches = MedicineBatch.query.filter(
            BatchStatus.status == BatchStatus.ACTIVE,
            MedicineBatch.expiry_date > today
        ).all()

        for batch in batches:
            days_to_expiry = (batch.expiry_date - today).days

            severity = None
            message = None

            if days_to_expiry <= self.CRITICAL_EXPIRY_DAYS:
                severity = 'critical'
                message = (
                    f"URGENT: Batch {batch.batch_number} expires in "
                    f"{days_to_expiry} days. Immediate action required."
                )
            elif days_to_expiry <= self.HIGH_EXPIRY_DAYS:
                severity = 'high'
                message = (
                    f"WARNING: Batch {batch.batch_number} expires in "
                    f"{days_to_expiry} days. Stop dispensing."
                )
            elif days_to_expiry <= self.MEDIUM_EXPIRY_DAYS:
                severity = 'medium'
                message = (
                    f"Batch {batch.batch_number} expires in "
                    f"{days_to_expiry} days. Prioritize usage."
                )
            elif days_to_expiry <= self.LOW_EXPIRY_DAYS:
                severity = 'low'
                message = (
                    f"Batch {batch.batch_number} expires in "
                    f"{days_to_expiry} days. Monitor."
                )

            if severity:
                # Check if alert already exists
                existing = StockAlert.query.filter_by(
                    batch_id=batch.id,
                    alert_type=AlertType.EXPIRY_WARNING,
                    status='active'
                ).first()

                if not existing:
                    alert = StockAlert(
                        alert_type=AlertType.EXPIRY_WARNING,
                        severity=severity,
                        medicine_id=batch.medicine_id,
                        location_id=batch.location_id,
                        batch_id=batch.id,
                        current_value=days_to_expiry,
                        message=message,
                        status='active'
                    )
                    db.session.add(alert)
                    alerts_created += 1

        db.session.commit()
        return alerts_created

    def generate_low_stock_alerts(self):
        """Generate alerts for low stock items."""
        alerts_created = 0

        # Get all stock items
        stock_items = InventoryStock.query.filter(
            InventoryStock.current_stock > 0
        ).all()

        for stock in stock_items:
            # Check if below reorder level
            if stock.reorder_level and stock.current_stock <= stock.reorder_level:
                severity = 'critical' if stock.current_stock <= (stock.critical_level or 0) else 'high'

                message = (
                    f"Stock for {stock.medicine.medicine_name} at "
                    f"{stock.location.location_name} is {severity}. "
                    f"Current: {stock.current_stock}, "
                    f"Reorder level: {stock.reorder_level}"
                )

                # Check if alert already exists
                existing = StockAlert.query.filter_by(
                    medicine_id=stock.medicine_id,
                    location_id=stock.location_id,
                    alert_type=AlertType.LOW_STOCK,
                    status='active'
                ).first()

                if not existing:
                    alert = StockAlert(
                        alert_type=AlertType.LOW_STOCK,
                        severity=severity,
                        medicine_id=stock.medicine_id,
                        location_id=stock.location_id,
                        current_value=stock.current_stock,
                        threshold_value=stock.reorder_level,
                        message=message,
                        status='active'
                    )
                    db.session.add(alert)
                    alerts_created += 1

        db.session.commit()
        return alerts_created
```

#### Day 4: Scheduled Background Jobs
**File:** `/backend/app/inventory/tasks.py` (NEW)
```python
"""Background tasks for inventory management."""
from apscheduler.schedulers.background import BackgroundScheduler
from app.inventory.alert_service import AlertService

# Initialize scheduler
scheduler = BackgroundScheduler()

def run_daily_expiry_check():
    """Daily job to check for expiring batches."""
    print("Running daily expiry check...")
    alert_service = AlertService()

    # Generate expiry alerts
    expiry_alerts = alert_service.generate_expiry_alerts()
    print(f"Created {expiry_alerts} expiry alerts")

    # Generate low stock alerts
    stock_alerts = alert_service.generate_low_stock_alerts()
    print(f"Created {stock_alerts} low stock alerts")

    # TODO: Send email notifications
    # TODO: Send SMS for critical alerts

# Schedule jobs
scheduler.add_job(
    run_daily_expiry_check,
    'cron',
    hour=6,  # Run at 6 AM daily
    minute=0,
    id='daily_expiry_check'
)

def start_scheduler():
    """Start the background scheduler."""
    if not scheduler.running:
        scheduler.start()
        print("Inventory background scheduler started")

def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.stop()
        print("Inventory background scheduler stopped")
```

**File:** `/backend/run.py` (UPDATE)
```python
# Add to startup

from app.inventory.tasks import start_scheduler

if __name__ == '__main__':
    # Start background scheduler
    start_scheduler()

    # Run Flask app
    app.run(debug=True, host='0.0.0.0', port=5002)
```

#### Day 5: API Endpoints for Batch Selection
**File:** `/backend/app/inventory/routes.py` (ADD)
```python
@inventory_bp.route('/batches/select', methods=['POST'])
@admin_required
def select_batches_for_dispensing():
    """Select batches for dispensing based on strategy."""
    data = request.get_json()
    medicine_id = data.get('medicine_id')
    location_id = data.get('location_id')
    quantity = data.get('quantity')
    strategy = data.get('strategy', 'FEFO')

    from app.inventory.batch_service import BatchSelector

    selector = BatchSelector(strategy=strategy)
    result = selector.select_batches(medicine_id, location_id, quantity)

    return jsonify(result)

@inventory_bp.route('/alerts/generate', methods=['POST'])
@admin_required
def generate_alerts_manually():
    """Manually trigger alert generation."""
    from app.inventory.alert_service import AlertService

    alert_service = AlertService()
    expiry_alerts = alert_service.generate_expiry_alerts()
    stock_alerts = alert_service.generate_low_stock_alerts()

    return jsonify({
        'message': 'Alerts generated successfully',
        'expiry_alerts': expiry_alerts,
        'stock_alerts': stock_alerts
    })
```

### Testing Checklist
- [ ] Run batch selector with FEFO strategy
- [ ] Verify earliest expiry selected first
- [ ] Test with insufficient stock
- [ ] Test across multiple batches
- [ ] Run alert generation manually
- [ ] Verify expiry alerts created (30, 90, 180 days)
- [ ] Verify low stock alerts created
- [ ] Test background scheduler
- [ ] Verify job runs at scheduled time

### Success Criteria
✅ FEFO batch selection working
✅ Multi-batch allocation functional
✅ Expiry alerts auto-generated
✅ Low stock alerts auto-generated
✅ Background jobs running

---

## SPRINT 4: Alert Automation & Notifications (Week 4, 5 days)

### Objective
Complete alert management system with notifications and dashboard display.

### Tasks (5 days)

#### Day 1: Alert Dashboard UI
**File:** `/frontend/src/pages/inventory/AlertsDashboard.jsx`
```jsx
// Features:
// - Alert summary cards (critical, high, medium, low)
// - Grouped by type (expiry, low stock, overstock)
// - Filterable table
// - Color-coded severity
// - Action buttons (acknowledge, resolve)
// - Auto-refresh every 60 seconds

// Columns:
// Type | Medicine | Location | Severity | Message | Created | Status | Actions
```

#### Day 2: Alert Notifications
**File:** `/backend/app/inventory/notification_service.py` (NEW)
```python
"""Notification service for alerts."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.inventory.models import StockAlert

class NotificationService:
    """Send notifications for stock alerts."""

    def send_alert_email(self, alert, recipients):
        """Send email notification for alert."""
        # Email configuration
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', 587))
        sender_email = os.getenv('SENDER_EMAIL')
        sender_password = os.getenv('SENDER_PASSWORD')

        # Create message
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = ', '.join(recipients)
        msg['Subject'] = f"[{alert.severity.upper()}] Stock Alert - {alert.alert_type}"

        # Email body
        body = f"""
        <html>
        <body>
            <h2 style="color: {'red' if alert.severity == 'critical' else 'orange'};">
                Stock Alert - {alert.severity.upper()}
            </h2>

            <p><strong>Alert Type:</strong> {alert.alert_type}</p>
            <p><strong>Medicine:</strong> {alert.medicine.medicine_name if alert.medicine else 'N/A'}</p>
            <p><strong>Location:</strong> {alert.location.location_name if alert.location else 'N/A'}</p>
            <p><strong>Message:</strong> {alert.message}</p>
            <p><strong>Created:</strong> {alert.created_at}</p>

            <p style="margin-top: 20px;">
                Please take immediate action to resolve this alert.
            </p>

            <p>
                <a href="{os.getenv('APP_URL')}/inventory/alerts">
                    View in Dashboard
                </a>
            </p>
        </body>
        </html>
        """

        msg.attach(MIMEText(body, 'html'))

        # Send email
        try:
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            server.quit()

            # Update alert
            alert.notification_sent = True
            alert.notification_sent_at = datetime.utcnow()

            return True
        except Exception as e:
            print(f"Failed to send email: {str(e)}")
            return False

    def send_critical_alerts(self):
        """Send emails for all active critical alerts."""
        critical_alerts = StockAlert.query.filter_by(
            severity='critical',
            status='active',
            notification_sent=False
        ).all()

        # Get admin emails
        from app.common.models import User
        admins = User.query.filter_by(role='admin').all()
        recipient_emails = [admin.email for admin in admins if admin.email]

        for alert in critical_alerts:
            self.send_alert_email(alert, recipient_emails)
```

#### Day 3: Stock Status Visualization
**File:** `/frontend/src/components/inventory/StockStatusWidget.jsx`
```jsx
// Real-time stock status widget for dashboard

// Features:
// - Donut chart: Optimal / Low / Critical / Overstocked
// - Count per category
// - Click to filter
// - Auto-refresh

// Uses recharts PieChart
```

**File:** `/frontend/src/components/inventory/ExpiryCalendar.jsx`
```jsx
// Calendar view of expiring medicines

// Features:
// - Calendar with date cells
// - Color-code dates with expiring batches
// - Hover to show batch details
// - Click to filter table
// - Month/year navigation
```

#### Day 4: Integration with Dashboard
**Update:** `/frontend/src/pages/inventory/InventoryDashboard.jsx`
```jsx
// Add sections:
// 1. Critical Alerts Banner (red, top)
// 2. Alert Summary Cards (4 cards by severity)
// 3. Stock Status Widget
// 4. Recent Alerts Table (top 10)
// 5. Expiry Calendar (next 90 days)
```

#### Day 5: Email Configuration & Testing
```bash
# Add to .env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=pharmacy@cvraman.health
SENDER_PASSWORD=<app_password>
APP_URL=http://localhost:3000
```

**Testing:**
- Manual trigger of alert generation
- Verify emails sent for critical alerts
- Test alert acknowledgement
- Test alert resolution
- Verify dashboard updates

### Success Criteria
✅ Alert dashboard functional
✅ Email notifications for critical alerts
✅ Dashboard shows real-time alerts
✅ Alert actions working (ack, resolve)
✅ Background jobs send emails

---

## SPRINT 5: Remaining UIs (Week 5, 5 days)

### Day 1: Batch Management UI
**File:** `/frontend/src/pages/inventory/BatchManagement.jsx`

### Day 2: Supplier Management UI
**File:** `/frontend/src/pages/inventory/SuppliersList.jsx`
**File:** `/frontend/src/pages/inventory/SupplierForm.jsx`

### Day 3: Requisitions UI
**File:** `/frontend/src/pages/inventory/RequisitionsList.jsx`
**File:** `/frontend/src/pages/inventory/RequisitionForm.jsx`

### Day 4: Stock Transfer UI
**File:** `/frontend/src/pages/inventory/StockTransfer.jsx`

### Day 5: Stock Adjustment UI
**File:** `/frontend/src/pages/inventory/StockAdjustment.jsx`

---

## SPRINT 6: Analytics Implementation (Week 6, 5 days)

### Day 1-2: ABC-VED Analysis
**File:** `/backend/app/inventory/analytics_service.py`
```python
def calculate_abc_ved_matrix(location_id=None):
    """Calculate ABC-VED matrix for inventory."""
    # ABC: Cost-based (70%, 20%, 10%)
    # VED: Criticality (Vital, Essential, Desirable)
    # Returns 9-category matrix
```

### Day 3-4: Analytics Dashboard
**File:** `/frontend/src/pages/inventory/AnalyticsDashboard.jsx`
```jsx
// Features:
// - Consumption trends (line chart)
// - Stock turnover (bar chart)
// - ABC-VED matrix (heatmap)
// - Top 20 medicines (table)
// - Expiry forecast
```

### Day 5: Report Generation
**File:** `/backend/app/inventory/report_service.py`
```python
# Reports:
# 1. Stock Status Report
# 2. Expiry Report
# 3. Movement Report
# 4. Consumption Report
# 5. Purchase Analysis
```

---

## SPRINT 7: Integration & Polish (Week 7, 5 days)

### Day 1: OPD Integration
- Link prescriptions to dispensing
- Auto-populate from encounter

### Day 2: IPD Integration
- Ward requisition workflow
- Bedside medication administration

### Day 3: Billing Integration
- Calculate medicine charges
- Link to patient billing

### Day 4: Audit Triggers
**File:** `/backend/migrations/versions/xxx_add_audit_triggers.py`
```sql
CREATE OR REPLACE FUNCTION audit_inventory_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        table_name, operation, user_id,
        old_data, new_data, timestamp
    ) VALUES (
        TG_TABLE_NAME, TG_OP,
        current_setting('app.current_user_id')::UUID,
        to_jsonb(OLD), to_jsonb(NEW),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_medicine_master
AFTER INSERT OR UPDATE OR DELETE ON medicine_master
FOR EACH ROW EXECUTE FUNCTION audit_inventory_changes();
```

### Day 5: Performance Optimization
- Add database indexes
- Implement query caching
- Optimize slow queries

---

## SPRINT 8: Testing & Deployment (Week 8, 5 days)

### Day 1-2: Unit Testing
```python
# Backend tests
# /backend/tests/test_inventory.py

def test_medicine_crud():
    pass

def test_batch_selection_fefo():
    pass

def test_dispensing_workflow():
    pass

def test_alert_generation():
    pass
```

### Day 3: Integration Testing
- End-to-end workflows
- User acceptance testing

### Day 4: Bug Fixes
- Fix identified issues
- Code review

### Day 5: Deployment
- Production database migration
- Deploy backend & frontend
- Smoke testing
- Documentation

---

## Resource Requirements

### Team Structure
| Role | Allocation | Weeks |
|------|-----------|-------|
| Senior Full-Stack Developer | 100% | 8 weeks |
| Frontend Developer | 100% | 4 weeks (Sprints 1-2, 5) |
| Backend Developer | 50% | 4 weeks (Sprints 3-4, 6) |
| QA Engineer | 50% | 2 weeks (Sprint 8) |

### Technology Stack
```json
{
  "backend": {
    "new": [
      "apscheduler==3.10.1",
      "python-barcode==0.15.1",
      "reportlab==4.0.4"
    ]
  },
  "frontend": {
    "new": [
      "react-to-print==2.15.1",
      "recharts==2.10.0",
      "date-fns==2.30.0"
    ]
  }
}
```

---

## Success Metrics

### Functional Metrics
- ✅ 100% of planned APIs working
- ✅ All 10 UI pages complete
- ✅ FEFO compliance: 100%
- ✅ Alert generation: Daily automated
- ✅ Test coverage: >80%

### Performance Metrics
- Response time <200ms for APIs
- Dashboard load time <2s
- Concurrent users: 50+
- Data accuracy: 99.9%

### Business Metrics
- Stock-out reduction: 80%
- Expiry waste reduction: 70%
- Procurement cycle time: -40%
- Dispensing errors: <0.1%

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Complexity of FEFO logic | Test extensively, start simple |
| Email delivery issues | Use reliable SMTP, have fallback |
| Performance with large data | Index optimization, pagination |
| User adoption | Training, documentation |
| Integration conflicts | API-first design, versioning |

---

## Dependencies & Prerequisites

### Before Starting Sprint 1
- [x] Backend APIs deployed
- [x] Database tables created
- [x] Frontend navigation setup
- [ ] SMTP credentials configured
- [ ] Test data populated

### Before Sprint 3
- [ ] Purchase Order UI complete
- [ ] Dispensing UI complete
- [ ] Background job framework tested

---

## Deliverables Timeline

| Week | Sprint | Deliverables |
|------|--------|-------------|
| 1 | 1 | PO UI (5 pages), PO workflow complete |
| 2 | 2 | Dispensing UI (4 pages), FEFO in frontend |
| 3 | 3 | Batch service, Alert service, Background jobs |
| 4 | 4 | Alert dashboard, Email notifications |
| 5 | 5 | 5 additional UIs (Batch, Supplier, Requisition, Transfer, Adjustment) |
| 6 | 6 | Analytics dashboard, Reports |
| 7 | 7 | Integrations, Audit triggers, Performance |
| 8 | 8 | Testing, Bug fixes, Deployment |

---

## Next Steps (Immediate)

### Week 1 - Day 1 Tasks
1. Create branch: `feature/inventory-po-dispensing-ui`
2. Install dependencies: `react-to-print`, `date-fns`
3. Create files:
   - `/frontend/src/components/inventory/SupplierSelector.jsx`
   - `/frontend/src/pages/inventory/PurchaseOrderWizard.jsx`
4. Start implementing PO wizard step 1
5. Test with existing backend APIs

### Verification Commands
```bash
# Backend
cd backend
python -c "from app.inventory.models import PurchaseOrder; print('Models OK')"

# Frontend
cd frontend
npm list react-to-print date-fns recharts

# Test API
curl -X GET http://localhost:5002/api/inventory/suppliers \
  -H "Authorization: Bearer $TOKEN"
```

---

**This plan is ready for immediate execution. Start with Sprint 1, Day 1.**

**Estimated Total: 6-8 weeks to production-ready system** ✅
