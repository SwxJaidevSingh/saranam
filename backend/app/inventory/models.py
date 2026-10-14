"""Medicine Inventory Management Models."""
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, Numeric, Text, ARRAY, Enum as SQLEnum, ForeignKey, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from app.extensions import db
from app.common.models import BaseModel
import enum


# Enums
class DosageForm(enum.Enum):
    TABLET = 'tablet'
    CAPSULE = 'capsule'
    INJECTION = 'injection'
    SYRUP = 'syrup'
    SUSPENSION = 'suspension'
    CREAM = 'cream'
    OINTMENT = 'ointment'
    DROPS = 'drops'
    INHALER = 'inhaler'
    PATCH = 'patch'


class DrugSchedule(enum.Enum):
    H = 'H'      # Prescription required
    H1 = 'H1'    # Habit forming
    X = 'X'      # Narcotic
    G = 'G'      # General (OTC)


class StockStatus(enum.Enum):
    OPTIMAL = 'optimal'
    LOW = 'low'
    CRITICAL = 'critical'
    OVERSTOCKED = 'overstocked'
    EXPIRED = 'expired'


class LocationType(enum.Enum):
    CENTRAL_STORE = 'central_store'
    PHARMACY = 'pharmacy'
    OPD = 'opd'
    IPD = 'ipd'
    WARD = 'ward'
    EMERGENCY = 'emergency'
    LAB = 'lab'


class MovementType(enum.Enum):
    PURCHASE = 'purchase'
    ISSUE = 'issue'
    RETURN = 'return'
    TRANSFER = 'transfer'
    ADJUSTMENT = 'adjustment'
    DISPOSAL = 'disposal'


class POStatus(enum.Enum):
    DRAFT = 'draft'
    PENDING_APPROVAL = 'pending_approval'
    APPROVED = 'approved'
    SENT = 'sent'
    PARTIAL_RECEIVED = 'partial_received'
    RECEIVED = 'received'
    CANCELLED = 'cancelled'


class DispensingStatus(enum.Enum):
    DISPENSED = 'dispensed'
    PARTIALLY_DISPENSED = 'partially_dispensed'
    RETURNED = 'returned'
    CANCELLED = 'cancelled'


class RequisitionStatus(enum.Enum):
    DRAFT = 'draft'
    PENDING_APPROVAL = 'pending_approval'
    APPROVED = 'approved'
    PARTIALLY_ISSUED = 'partially_issued'
    ISSUED = 'issued'
    REJECTED = 'rejected'


class AlertType(enum.Enum):
    LOW_STOCK = 'low_stock'
    EXPIRY_WARNING = 'expiry_warning'
    OVERSTOCK = 'overstock'
    STOCKOUT = 'stockout'


class BatchStatus(enum.Enum):
    ACTIVE = 'active'
    EXPIRED = 'expired'
    CONSUMED = 'consumed'
    DAMAGED = 'damaged'
    RECALLED = 'recalled'


# Models
class MedicineMaster(BaseModel):
    """Medicine Master table - core medicine information."""
    __tablename__ = 'medicine_master'

    # Basic Information
    medicine_code = Column(String(50), unique=True, nullable=False, index=True)
    medicine_name = Column(String(200), nullable=False)
    generic_name = Column(String(200), nullable=False, index=True)
    brand_name = Column(String(200))
    manufacturer = Column(String(200))

    # Classification
    therapeutic_category = Column(String(100))
    drug_class = Column(SQLEnum(DrugSchedule), name='drug_schedule_enum')
    controlled_substance = Column(Boolean, default=False)
    narcotic = Column(Boolean, default=False)

    # Formulation
    dosage_form = Column(SQLEnum(DosageForm), name='dosage_form_enum')
    strength = Column(String(50))          # derived display string, e.g. "500 mg / 2 ml"
    unit_of_measure = Column(String(20))   # countable stock unit, e.g. "Ampoule"
    pack_size = Column(Integer)

    # Structured strength (additive). `strength` above is derived from these for display.
    #   strength_components: [{ "value": <num>, "unit": "<str>" }, ...] (1+ active ingredients)
    #   strength_per_value/_unit: concentration denominator, e.g. 2 + "ml" for "500 mg / 2 ml"
    strength_components = Column(JSONB)
    strength_per_value = Column(Numeric(10, 3))
    strength_per_unit = Column(String(10))

    # Regulatory
    drug_license_number = Column(String(100))
    is_generic = Column(Boolean, default=True)
    is_essential = Column(Boolean, default=False, index=True)
    nlem_category = Column(String(20))
    who_atc_code = Column(String(20))

    # Storage
    storage_conditions = Column(String(200))
    special_storage = Column(JSONB)

    # Clinical
    pregnancy_category = Column(String(10))
    contraindications = Column(ARRAY(Text))
    side_effects = Column(ARRAY(Text))
    interactions = Column(ARRAY(Text))

    # Financial
    hsn_code = Column(String(20))
    gst_percentage = Column(Numeric(5, 2))

    # Status
    is_active = Column(Boolean, default=True, index=True)
    discontinued = Column(Boolean, default=False)
    discontinued_reason = Column(String(200))

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    updated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    inventory_stocks = relationship('InventoryStock', back_populates='medicine', lazy='dynamic')
    batches = relationship('MedicineBatch', back_populates='medicine', lazy='dynamic')
    stock_movements = relationship('StockMovement', back_populates='medicine', lazy='dynamic')

    # Indexes
    __table_args__ = (
        Index('idx_medicine_name', 'medicine_name'),
        Index('idx_medicine_category', 'therapeutic_category'),
    )

    def generate_code(self):
        """Generate unique medicine code."""
        import random
        import string
        prefix = 'MED'
        random_part = ''.join(random.choices(string.digits, k=6))
        return f"{prefix}{random_part}"


class InventoryLocation(BaseModel):
    """Inventory locations (stores, pharmacies, wards, etc.)."""
    __tablename__ = 'inventory_locations'

    location_code = Column(String(50), unique=True, nullable=False)
    location_name = Column(String(100), nullable=False)
    location_type = Column(SQLEnum(LocationType), nullable=False)

    # Hierarchy
    parent_location_id = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'))
    department_id = Column(UUID(as_uuid=True))
    ward_id = Column(UUID(as_uuid=True))

    # Physical Location
    building = Column(String(100))
    floor = Column(String(20))
    room = Column(String(50))
    shelf = Column(String(50))
    bin = Column(String(50))

    # Storage Capabilities
    has_cold_storage = Column(Boolean, default=False)
    has_controlled_storage = Column(Boolean, default=False)
    temperature_range = Column(String(50))
    humidity_control = Column(Boolean, default=False)

    # Provider Sub-Stock (when set, this location is a provider's portable stock)
    provider_id = Column(UUID(as_uuid=True), ForeignKey('healthcare_providers.id'), index=True)

    # Contact
    in_charge_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    contact_number = Column(String(20))
    email = Column(String(100))

    # Permissions
    can_receive_stock = Column(Boolean, default=True)
    can_issue_stock = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=False)

    # Status
    is_active = Column(Boolean, default=True)

    # Relationships
    parent_location = relationship('InventoryLocation', remote_side='InventoryLocation.id', backref='child_locations')
    provider = relationship('HealthcareProvider', foreign_keys=[provider_id])
    inventory_stocks = relationship('InventoryStock', back_populates='location', lazy='dynamic')


class InventoryStock(BaseModel):
    """Current stock levels at each location."""
    __tablename__ = 'inventory_stock'

    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'), nullable=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'), nullable=False)

    # Stock Levels
    current_stock = Column(Numeric(10, 2), nullable=False, default=0)
    allocated_stock = Column(Numeric(10, 2), default=0)

    # PAR Levels
    par_level = Column(Numeric(10, 2))
    reorder_level = Column(Numeric(10, 2))
    critical_level = Column(Numeric(10, 2))
    reorder_quantity = Column(Numeric(10, 2))

    # Economic Order Quantity
    eoq = Column(Numeric(10, 2))
    lead_time_days = Column(Integer)
    safety_stock = Column(Numeric(10, 2))

    # ABC-VED Analysis
    abc_category = Column(String(1))
    ved_category = Column(String(1))
    fsn_category = Column(String(1))
    xyz_category = Column(String(1))
    matrix_category = Column(String(2), index=True)

    # Consumption Tracking
    average_monthly_consumption = Column(Numeric(10, 2))
    last_consumption_date = Column(Date)
    consumption_trend = Column(String(20))

    # Cost
    unit_cost = Column(Numeric(10, 2))
    last_purchase_price = Column(Numeric(10, 2))
    average_cost = Column(Numeric(10, 2))

    # Status
    stock_status = Column(SQLEnum(StockStatus), index=True)
    last_stock_check = Column(Date)
    last_audit_date = Column(Date)

    # Relationships
    medicine = relationship('MedicineMaster', back_populates='inventory_stocks')
    location = relationship('InventoryLocation', back_populates='inventory_stocks')

    # Constraints
    __table_args__ = (
        Index('idx_inventory_location', 'location_id'),
        Index('idx_inventory_medicine', 'medicine_id'),
        Index('idx_inventory_status', 'stock_status'),
        CheckConstraint('current_stock >= 0', name='check_stock_non_negative'),
    )

    @hybrid_property
    def available_stock(self):
        """Calculate available stock."""
        return self.current_stock - (self.allocated_stock or 0)

    @hybrid_property
    def total_value(self):
        """Calculate total inventory value."""
        return self.current_stock * (self.average_cost or 0)


class Supplier(BaseModel):
    """Medicine suppliers."""
    __tablename__ = 'suppliers'

    supplier_code = Column(String(50), unique=True, nullable=False)
    supplier_name = Column(String(200), nullable=False)
    company_name = Column(String(200))
    supplier_type = Column(String(50))

    # Registration
    drug_license_number = Column(String(100))
    gst_number = Column(String(20))
    pan_number = Column(String(20))
    registration_date = Column(Date)
    license_expiry_date = Column(Date)

    # Contact
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    country = Column(String(100), default='India')
    phone = Column(String(20))
    mobile = Column(String(20))
    email = Column(String(100))
    website = Column(String(200))

    # Business Terms
    payment_terms = Column(String(100))
    credit_limit = Column(Numeric(12, 2))
    discount_percentage = Column(Numeric(5, 2))
    delivery_lead_days = Column(Integer)
    minimum_order_value = Column(Numeric(10, 2))

    # Banking
    bank_name = Column(String(100))
    account_number = Column(String(50))
    ifsc_code = Column(String(20))

    # Performance
    rating = Column(Numeric(3, 2))
    on_time_delivery_rate = Column(Numeric(5, 2))
    quality_score = Column(Numeric(5, 2))
    total_orders = Column(Integer, default=0)
    total_business_value = Column(Numeric(15, 2), default=0)

    # Categories
    medicine_categories = Column(ARRAY(Text))
    preferred_supplier = Column(Boolean, default=False)
    blacklisted = Column(Boolean, default=False)
    blacklist_reason = Column(Text)

    # Documents
    documents = Column(JSONB)

    # Status
    is_active = Column(Boolean, default=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    updated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Relationships
    purchase_orders = relationship('PurchaseOrder', back_populates='supplier', lazy='dynamic')


class PurchaseOrder(BaseModel):
    """Purchase orders for medicines."""
    __tablename__ = 'purchase_orders'

    po_number = Column(String(50), unique=True, nullable=False, index=True)
    po_date = Column(Date, nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey('suppliers.id'), nullable=False)

    # Delivery
    expected_delivery_date = Column(Date)
    actual_delivery_date = Column(Date)
    delivery_location_id = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'))

    # Financial
    subtotal = Column(Numeric(12, 2))
    discount_amount = Column(Numeric(10, 2))
    tax_amount = Column(Numeric(10, 2))
    shipping_charges = Column(Numeric(10, 2))
    total_amount = Column(Numeric(12, 2))

    # Status
    status = Column(SQLEnum(POStatus), nullable=False, default=POStatus.DRAFT, index=True)
    approval_status = Column(String(50))
    approved_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    approved_at = Column(DateTime)

    # Payment
    payment_status = Column(String(50))
    payment_terms = Column(String(100))
    payment_due_date = Column(Date)

    # Notes
    internal_notes = Column(Text)
    supplier_notes = Column(Text)
    terms_conditions = Column(Text)

    # Tracking
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    attachments = Column(JSONB)

    # Relationships
    supplier = relationship('Supplier', back_populates='purchase_orders')
    items = relationship('PurchaseOrderItem', back_populates='purchase_order', cascade='all, delete-orphan')


class PurchaseOrderItem(BaseModel):
    """Purchase order line items."""
    __tablename__ = 'purchase_order_items'

    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey('purchase_orders.id', ondelete='CASCADE'), nullable=False)
    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'))

    # Quantity
    ordered_quantity = Column(Numeric(10, 2), nullable=False)
    received_quantity = Column(Numeric(10, 2), default=0)
    bonus_quantity = Column(Numeric(10, 2), default=0)

    # Pricing
    unit_price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2))
    discount_amount = Column(Numeric(10, 2))
    tax_percentage = Column(Numeric(5, 2))
    tax_amount = Column(Numeric(10, 2))
    total_amount = Column(Numeric(12, 2))

    # Specifications
    pack_size = Column(Integer)
    manufacturer = Column(String(200))
    batch_number = Column(String(100))
    expiry_date = Column(Date)

    # Receipt Status
    receipt_status = Column(String(50))
    grn_id = Column(UUID(as_uuid=True))

    # Relationships
    purchase_order = relationship('PurchaseOrder', back_populates='items')
    medicine = relationship('MedicineMaster')

    @hybrid_property
    def pending_quantity(self):
        """Calculate pending quantity."""
        return self.ordered_quantity - (self.received_quantity or 0)


class MedicineBatch(BaseModel):
    """Medicine batch tracking with expiry management."""
    __tablename__ = 'medicine_batches'

    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'), nullable=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'), nullable=False)

    # Batch Information
    batch_number = Column(String(100), nullable=False, index=True)
    lot_number = Column(String(100))
    serial_number = Column(String(100))
    barcode = Column(String(200))
    qr_code = Column(String(500))

    # Dates
    manufacture_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False, index=True)
    received_date = Column(Date, nullable=False)

    # Quantity
    initial_quantity = Column(Numeric(10, 2), nullable=False)
    current_quantity = Column(Numeric(10, 2), nullable=False)
    consumed_quantity = Column(Numeric(10, 2), default=0)
    damaged_quantity = Column(Numeric(10, 2), default=0)
    returned_quantity = Column(Numeric(10, 2), default=0)

    # Source
    supplier_id = Column(UUID(as_uuid=True), ForeignKey('suppliers.id'))
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey('purchase_orders.id'))
    grn_number = Column(String(100))
    invoice_number = Column(String(100))

    # Cost
    purchase_price = Column(Numeric(10, 2))
    mrp = Column(Numeric(10, 2))
    selling_price = Column(Numeric(10, 2))

    # Quality
    quality_check_status = Column(String(50))
    quality_check_date = Column(Date)
    quality_check_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    quality_notes = Column(Text)

    # Status
    status = Column(SQLEnum(BatchStatus), default=BatchStatus.ACTIVE, index=True)

    # Disposal
    disposal_date = Column(Date)
    disposal_method = Column(String(100))
    disposal_certificate_number = Column(String(100))
    disposal_notes = Column(Text)

    # Relationships
    medicine = relationship('MedicineMaster', back_populates='batches')
    location = relationship('InventoryLocation')
    supplier = relationship('Supplier')

    # Indexes
    __table_args__ = (
        Index('idx_batch_medicine_location', 'medicine_id', 'location_id'),
        Index('idx_batch_status', 'status'),
    )

    @hybrid_property
    def days_to_expiry(self):
        """Calculate days to expiry."""
        if self.expiry_date > date.today():
            return (self.expiry_date - date.today()).days
        return 0


class StockMovement(BaseModel):
    """Stock movement transactions."""
    __tablename__ = 'stock_movements'

    movement_type = Column(SQLEnum(MovementType), nullable=False, index=True)
    movement_direction = Column(String(10), nullable=False)

    # References
    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey('medicine_batches.id'))
    from_location_id = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'))
    to_location_id = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'))

    # Quantity
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_cost = Column(Numeric(10, 2))
    total_cost = Column(Numeric(12, 2))

    # Stock Levels (snapshot)
    stock_before = Column(Numeric(10, 2))
    stock_after = Column(Numeric(10, 2))

    # Context
    reference_type = Column(String(50))
    reference_id = Column(UUID(as_uuid=True))
    reference_number = Column(String(100))

    # For Patient Dispensing
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id'))
    encounter_id = Column(UUID(as_uuid=True))
    prescription_id = Column(UUID(as_uuid=True))

    # For Department Requisitions
    department_id = Column(UUID(as_uuid=True))
    requisition_id = Column(UUID(as_uuid=True))
    approved_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Reason & Notes
    reason = Column(String(200))
    notes = Column(Text)

    # Tracking
    performed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    performed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    verified_at = Column(DateTime)

    # Audit
    ip_address = Column(INET)
    user_agent = Column(Text)

    # Relationships
    medicine = relationship('MedicineMaster', back_populates='stock_movements')
    batch = relationship('MedicineBatch')
    from_location = relationship('InventoryLocation', foreign_keys=[from_location_id])
    to_location = relationship('InventoryLocation', foreign_keys=[to_location_id])

    # Indexes
    __table_args__ = (
        Index('idx_movement_medicine', 'medicine_id'),
        Index('idx_movement_date', 'performed_at'),
        Index('idx_movement_patient', 'patient_id'),
    )


class DispensingRecord(BaseModel):
    """Medicine dispensing records."""
    __tablename__ = 'dispensing_records'

    # Patient Information
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id'), nullable=False)
    encounter_id = Column(UUID(as_uuid=True))
    admission_id = Column(UUID(as_uuid=True))

    # Prescription Reference
    prescription_id = Column(UUID(as_uuid=True))
    prescribed_by = Column(Integer)
    prescription_date = Column(Date)

    # Medicine Details
    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey('medicine_batches.id'))

    # Quantity
    prescribed_quantity = Column(Numeric(10, 2))
    dispensed_quantity = Column(Numeric(10, 2), nullable=False)
    returned_quantity = Column(Numeric(10, 2), default=0)

    # Dosage Instructions
    dosage = Column(String(100))
    frequency = Column(String(50))
    duration_days = Column(Integer)
    route = Column(String(50))
    special_instructions = Column(Text)

    # Financial
    unit_price = Column(Numeric(10, 2))
    total_price = Column(Numeric(10, 2))
    discount_amount = Column(Numeric(10, 2))
    net_amount = Column(Numeric(10, 2))
    payment_status = Column(String(50))

    # Dispensing Details
    dispensed_from_location = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'))
    dispensed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    dispensed_at = Column(DateTime, default=datetime.utcnow)

    # Verification
    verified_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    verified_at = Column(DateTime)

    # Status
    status = Column(SQLEnum(DispensingStatus))

    # Relationships
    medicine = relationship('MedicineMaster')
    batch = relationship('MedicineBatch')
    location = relationship('InventoryLocation', foreign_keys=[dispensed_from_location])

    # Indexes
    __table_args__ = (
        Index('idx_dispensing_patient', 'patient_id'),
        Index('idx_dispensing_medicine', 'medicine_id'),
        Index('idx_dispensing_date', 'dispensed_at'),
    )


class MedicineRequisition(BaseModel):
    """Medicine requisitions from departments/wards."""
    __tablename__ = 'medicine_requisitions'

    requisition_number = Column(String(50), unique=True, nullable=False)

    # Request Details
    requested_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    requested_for_location = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'), nullable=False)
    request_date = Column(Date, nullable=False)
    required_by_date = Column(Date)
    priority = Column(String(20))

    # Approval Workflow
    status = Column(SQLEnum(RequisitionStatus), default=RequisitionStatus.DRAFT)
    approved_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    approved_at = Column(DateTime)
    rejection_reason = Column(Text)

    # Issue Details
    issued_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    issued_at = Column(DateTime)

    # Notes
    purpose = Column(Text)
    notes = Column(Text)

    # Relationships
    location = relationship('InventoryLocation', foreign_keys=[requested_for_location])
    items = relationship('RequisitionItem', back_populates='requisition', cascade='all, delete-orphan')


class RequisitionItem(BaseModel):
    """Requisition line items."""
    __tablename__ = 'requisition_items'

    requisition_id = Column(UUID(as_uuid=True), ForeignKey('medicine_requisitions.id', ondelete='CASCADE'), nullable=False)
    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'), nullable=False)

    requested_quantity = Column(Numeric(10, 2), nullable=False)
    approved_quantity = Column(Numeric(10, 2))
    issued_quantity = Column(Numeric(10, 2), default=0)

    # Relationships
    requisition = relationship('MedicineRequisition', back_populates='items')
    medicine = relationship('MedicineMaster')


class StockAlert(BaseModel):
    """Stock alerts for low stock, expiry, etc."""
    __tablename__ = 'stock_alerts'

    alert_type = Column(SQLEnum(AlertType), nullable=False, index=True)
    severity = Column(String(20), nullable=False)

    medicine_id = Column(UUID(as_uuid=True), ForeignKey('medicine_master.id'))
    location_id = Column(UUID(as_uuid=True), ForeignKey('inventory_locations.id'))
    batch_id = Column(UUID(as_uuid=True), ForeignKey('medicine_batches.id'))

    # Alert Details
    current_value = Column(Numeric(10, 2))
    threshold_value = Column(Numeric(10, 2))
    message = Column(Text, nullable=False)

    # Resolution
    status = Column(String(50), default='active', index=True)
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    acknowledged_at = Column(DateTime)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)

    # Notifications
    notification_sent = Column(Boolean, default=False)
    notification_sent_at = Column(DateTime)
    notification_recipients = Column(ARRAY(Integer))

    expires_at = Column(DateTime)

    # Relationships
    medicine = relationship('MedicineMaster')
    location = relationship('InventoryLocation')
    batch = relationship('MedicineBatch')

    # Indexes
    __table_args__ = (
        Index('idx_alerts_active', 'status'),
        Index('idx_alerts_type', 'alert_type'),
    )
