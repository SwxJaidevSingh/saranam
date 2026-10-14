# Medicine Inventory Management System - Mermaid Diagrams
**CV Raman Health Platform**
**Version:** 1.0
**Date:** March 18, 2025

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Database Entity Relationships](#2-database-entity-relationships)
3. [Core Workflows](#3-core-workflows)
4. [Integration Architecture](#4-integration-architecture)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [User Journey Maps](#6-user-journey-maps)
7. [State Diagrams](#7-state-diagrams)
8. [Analytics Architecture](#8-analytics-architecture)

---

## 1. System Architecture Overview

### 1.1 High-Level Module Architecture

```mermaid
graph TB
    subgraph "Medicine Inventory Management System"
        MIM[Medicine Inventory<br/>Core Module]

        MIM --> MM[Medicine Master<br/>Management]
        MIM --> IM[Inventory<br/>Management]
        MIM --> PO[Purchase Order<br/>Management]
        MIM --> DM[Dispensing<br/>Management]
        MIM --> EM[Expiry<br/>Management]
        MIM --> SM[Stock Movement<br/>& Transfers]
        MIM --> AN[Analytics &<br/>Reporting]
        MIM --> AL[Alerts &<br/>Notifications]
    end

    subgraph "External Integrations"
        EXT[External<br/>Systems]
        OPD[OPD Module]
        IPD[IPD Module]
        HOME[Home Care]
        PAT[Patient Module]
        BILLING[Billing System]
        LAB[Laboratory]
    end

    subgraph "Data Storage"
        DB[(PostgreSQL<br/>Database)]
        CACHE[(Redis<br/>Cache)]
        FILES[File Storage<br/>Documents]
    end

    MM --> DB
    IM --> DB
    PO --> DB
    DM --> DB
    EM --> DB
    SM --> DB
    AN --> DB
    AL --> CACHE

    OPD --> MIM
    IPD --> MIM
    HOME --> MIM
    PAT --> MIM
    BILLING -.->|Future| MIM
    LAB -.->|Future| MIM

    classDef core fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    classDef module fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef external fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef storage fill:#e8f5e9,stroke:#388e3c,stroke-width:2px

    class MIM core
    class MM,IM,PO,DM,EM,SM,AN,AL module
    class OPD,IPD,HOME,PAT,BILLING,LAB,EXT external
    class DB,CACHE,FILES storage
```

### 1.2 Detailed Component Architecture

```mermaid
graph LR
    subgraph "Presentation Layer"
        WEB[Web Interface]
        MOBILE[Mobile App]
        API[REST API]
    end

    subgraph "Application Layer"
        AUTH[Authentication<br/>& Authorization]
        BL[Business Logic]
        VAL[Validation Engine]
        WORK[Workflow Engine]
    end

    subgraph "Service Layer"
        MED_SVC[Medicine<br/>Service]
        INV_SVC[Inventory<br/>Service]
        PO_SVC[Purchase<br/>Service]
        DISP_SVC[Dispensing<br/>Service]
        ALERT_SVC[Alert<br/>Service]
        REPORT_SVC[Report<br/>Service]
    end

    subgraph "Data Access Layer"
        ORM[SQLAlchemy ORM]
        CACHE_MGR[Cache Manager]
        AUDIT[Audit Logger]
    end

    subgraph "Infrastructure"
        DB[(PostgreSQL)]
        REDIS[(Redis)]
        QUEUE[Message Queue]
        STORAGE[Object Storage]
    end

    WEB --> AUTH
    MOBILE --> AUTH
    API --> AUTH

    AUTH --> BL
    BL --> VAL
    VAL --> WORK

    WORK --> MED_SVC
    WORK --> INV_SVC
    WORK --> PO_SVC
    WORK --> DISP_SVC
    WORK --> ALERT_SVC
    WORK --> REPORT_SVC

    MED_SVC --> ORM
    INV_SVC --> ORM
    PO_SVC --> ORM
    DISP_SVC --> ORM
    ALERT_SVC --> CACHE_MGR
    REPORT_SVC --> ORM

    ORM --> DB
    CACHE_MGR --> REDIS
    AUDIT --> DB
    ALERT_SVC --> QUEUE
    REPORT_SVC --> STORAGE
```

---

## 2. Database Entity Relationships

### 2.1 Core Entity Relationships

```mermaid
erDiagram
    MEDICINE_MASTER ||--o{ INVENTORY_STOCK : has
    MEDICINE_MASTER ||--o{ MEDICINE_BATCHES : contains
    MEDICINE_MASTER ||--o{ STOCK_MOVEMENTS : tracked_in
    MEDICINE_MASTER ||--o{ DISPENSING_RECORDS : dispensed_as
    MEDICINE_MASTER ||--o{ PO_ITEMS : ordered_in

    INVENTORY_LOCATIONS ||--o{ INVENTORY_STOCK : stores
    INVENTORY_LOCATIONS ||--o{ MEDICINE_BATCHES : holds
    INVENTORY_LOCATIONS ||--o{ STOCK_MOVEMENTS : involved_in

    SUPPLIERS ||--o{ PURCHASE_ORDERS : supplies
    PURCHASE_ORDERS ||--o{ PO_ITEMS : contains
    PURCHASE_ORDERS ||--o{ MEDICINE_BATCHES : creates

    MEDICINE_BATCHES ||--o{ STOCK_MOVEMENTS : moved_in
    MEDICINE_BATCHES ||--o{ DISPENSING_RECORDS : dispensed_from

    PATIENTS ||--o{ DISPENSING_RECORDS : receives
    ENCOUNTERS ||--o{ DISPENSING_RECORDS : linked_to

    USERS ||--o{ PURCHASE_ORDERS : creates
    USERS ||--o{ STOCK_MOVEMENTS : performs
    USERS ||--o{ DISPENSING_RECORDS : processes

    MEDICINE_REQUISITIONS ||--o{ STOCK_MOVEMENTS : generates
    STOCK_ALERTS }o--|| MEDICINE_MASTER : alerts_for

    MEDICINE_MASTER {
        uuid id PK
        string medicine_code UK
        string medicine_name
        string generic_name
        string brand_name
        string therapeutic_category
        boolean is_essential
        string storage_conditions
    }

    INVENTORY_STOCK {
        uuid id PK
        uuid medicine_id FK
        uuid location_id FK
        decimal current_stock
        decimal par_level
        decimal reorder_level
        char abc_category
        char ved_category
    }

    MEDICINE_BATCHES {
        uuid id PK
        uuid medicine_id FK
        uuid location_id FK
        string batch_number
        date expiry_date
        decimal current_quantity
        string status
    }

    STOCK_MOVEMENTS {
        uuid id PK
        uuid medicine_id FK
        uuid batch_id FK
        string movement_type
        decimal quantity
        uuid patient_id FK
        timestamp performed_at
    }

    DISPENSING_RECORDS {
        uuid id PK
        uuid patient_id FK
        uuid medicine_id FK
        uuid batch_id FK
        decimal dispensed_quantity
        timestamp dispensed_at
    }
```

### 2.2 Purchase & Supply Chain ERD

```mermaid
erDiagram
    SUPPLIERS ||--o{ PURCHASE_ORDERS : receives
    PURCHASE_ORDERS ||--o{ PO_ITEMS : contains
    PO_ITEMS }o--|| MEDICINE_MASTER : orders
    PURCHASE_ORDERS ||--o{ GOODS_RECEIPTS : fulfilled_by
    GOODS_RECEIPTS ||--o{ GR_ITEMS : contains
    GR_ITEMS ||--|| MEDICINE_BATCHES : creates

    SUPPLIERS {
        uuid id PK
        string supplier_code UK
        string supplier_name
        string gst_number
        string drug_license
        decimal rating
        boolean preferred
    }

    PURCHASE_ORDERS {
        uuid id PK
        string po_number UK
        uuid supplier_id FK
        date po_date
        string status
        decimal total_amount
        uuid approved_by FK
    }

    PO_ITEMS {
        uuid id PK
        uuid po_id FK
        uuid medicine_id FK
        decimal ordered_quantity
        decimal unit_price
        decimal received_quantity
    }

    GOODS_RECEIPTS {
        uuid id PK
        string grn_number UK
        uuid po_id FK
        date receipt_date
        string quality_status
    }

    GR_ITEMS {
        uuid id PK
        uuid grn_id FK
        uuid po_item_id FK
        string batch_number
        date expiry_date
        decimal received_quantity
    }

    MEDICINE_BATCHES {
        uuid id PK
        uuid grn_item_id FK
        string batch_number
        date expiry_date
        decimal current_quantity
    }
```

---

## 3. Core Workflows

### 3.1 Purchase Order Workflow

```mermaid
flowchart TD
    Start([Stock Check Trigger])

    Start --> CheckStock{Stock Level<br/>Check}
    CheckStock -->|Below Reorder| GenerateReq[Generate Purchase<br/>Requisition]
    CheckStock -->|Above Reorder| End1([No Action])

    GenerateReq --> SelectSupplier[Select Best Supplier<br/>Based on:]
    SelectSupplier --> Criteria[- Price<br/>- Lead Time<br/>- Rating<br/>- Availability]

    Criteria --> CreatePO[Create Purchase<br/>Order Draft]
    CreatePO --> AddItems[Add Medicine Items<br/>with Quantities]

    AddItems --> CalculateEOQ{Calculate<br/>EOQ}
    CalculateEOQ --> AdjustQty[Adjust Order<br/>Quantities]

    AdjustQty --> SubmitPO[Submit PO<br/>for Approval]
    SubmitPO --> CheckValue{Order Value<br/>> Threshold?}

    CheckValue -->|Yes| RequireApproval[Requires Manager<br/>Approval]
    CheckValue -->|No| AutoApprove[Auto-Approve]

    RequireApproval --> ManagerReview[Manager<br/>Reviews PO]
    ManagerReview --> Decision{Approve?}

    Decision -->|Yes| ApprovedPO[PO Approved]
    Decision -->|No| Rejected[PO Rejected]
    Rejected --> ModifyPO[Modify PO]
    ModifyPO --> SubmitPO

    AutoApprove --> ApprovedPO
    ApprovedPO --> SendToSupplier[Send to Supplier<br/>via Email/Portal]

    SendToSupplier --> AwaitDelivery[Await Delivery]
    AwaitDelivery --> GoodsReceived[Goods Received]

    GoodsReceived --> QualityCheck{Quality<br/>Check}
    QualityCheck -->|Pass| AcceptGoods[Accept Goods]
    QualityCheck -->|Fail| RejectGoods[Reject Goods]

    RejectGoods --> ReturnProcess[Return to Supplier]
    ReturnProcess --> SupplierCredit[Get Credit Note]

    AcceptGoods --> CreateGRN[Create Goods<br/>Receipt Note]
    CreateGRN --> UpdateInventory[Update Inventory<br/>Stock Levels]

    UpdateInventory --> CreateBatches[Create Batch<br/>Records]
    CreateBatches --> SetExpiry[Set Expiry<br/>Tracking]

    SetExpiry --> UpdateFinance[Update Accounts<br/>Payable]
    UpdateFinance --> CompletePO[Complete PO]

    CompletePO --> End2([Purchase Complete])
    SupplierCredit --> End3([Return Processed])

    style Start fill:#e1f5fe
    style End1,End2,End3 fill:#c8e6c9
    style Rejected fill:#ffcdd2
    style ApprovedPO fill:#dcedc8
```

### 3.2 Dispensing Workflow

```mermaid
flowchart TD
    Start([Patient Arrives with<br/>Prescription])

    Start --> VerifyPatient[Verify Patient<br/>Identity]
    VerifyPatient --> ScanPrescription[Scan/Enter<br/>Prescription]

    ScanPrescription --> ValidateRx{Validate<br/>Prescription}
    ValidateRx -->|Invalid| RejectRx[Reject with<br/>Reason]
    ValidateRx -->|Valid| CheckMedicines[Check Each<br/>Medicine]

    CheckMedicines --> Loop{For Each<br/>Medicine}
    Loop --> CheckAvailability[Check Stock<br/>Availability]

    CheckAvailability --> InStock{In Stock?}
    InStock -->|No| CheckAlternative{Generic<br/>Alternative?}
    CheckAlternative -->|Yes| SuggestGeneric[Suggest Generic<br/>Option]
    CheckAlternative -->|No| OutOfStock[Mark Out<br/>of Stock]

    SuggestGeneric --> PatientConsent{Patient<br/>Accepts?}
    PatientConsent -->|Yes| SelectAlternative[Select Alternative]
    PatientConsent -->|No| OutOfStock

    InStock -->|Yes| SelectBatch[Select Batch<br/>FIFO/FEFO]
    SelectAlternative --> SelectBatch

    SelectBatch --> CheckExpiry{Check<br/>Expiry}
    CheckExpiry -->|Expired| NextBatch[Try Next<br/>Batch]
    NextBatch --> CheckExpiry
    CheckExpiry -->|Valid| AllocateStock[Allocate Stock<br/>from Batch]

    AllocateStock --> MoreMedicines{More<br/>Medicines?}
    MoreMedicines -->|Yes| Loop
    MoreMedicines -->|No| PrepareDispensing[Prepare<br/>Dispensing]

    OutOfStock --> CreateBackorder[Create Backorder]
    CreateBackorder --> MoreMedicines

    PrepareDispensing --> PrintLabels[Print Medicine<br/>Labels]
    PrintLabels --> PackMedicines[Pack Medicines]

    PackMedicines --> DoubleCheck[Pharmacist<br/>Double Check]
    DoubleCheck --> Verified{Verified?}

    Verified -->|No| CorrectError[Correct Error]
    CorrectError --> PackMedicines
    Verified -->|Yes| PatientCounseling[Patient Counseling]

    PatientCounseling --> Instructions[Provide Instructions:<br/>- Dosage<br/>- Timing<br/>- Storage<br/>- Side Effects]

    Instructions --> RecordDispensing[Record Dispensing<br/>in System]
    RecordDispensing --> UpdateStock[Update Stock<br/>Levels]

    UpdateStock --> GenerateBill[Generate Bill]
    GenerateBill --> Payment{Payment<br/>Required?}

    Payment -->|Yes| ProcessPayment[Process Payment]
    Payment -->|No| FreeDispensing[Free/Insurance<br/>Covered]

    ProcessPayment --> Receipt[Generate Receipt]
    FreeDispensing --> Receipt

    Receipt --> HandoverMedicines[Handover Medicines<br/>to Patient]
    HandoverMedicines --> End([Dispensing Complete])

    RejectRx --> End2([Prescription Rejected])

    style Start fill:#e1f5fe
    style End,End2 fill:#c8e6c9
    style RejectRx,OutOfStock fill:#ffcdd2
    style PatientCounseling fill:#fff3e0
```

### 3.3 Stock Transfer Workflow

```mermaid
flowchart TD
    Start([Transfer Request<br/>Initiated])

    Start --> RequestSource{Request<br/>Source}
    RequestSource -->|Ward| WardRequest[Ward Stock<br/>Request]
    RequestSource -->|Emergency| EmergencyRequest[Emergency<br/>Request]
    RequestSource -->|Scheduled| ScheduledTransfer[Scheduled<br/>Transfer]

    WardRequest --> CreateRequisition[Create Transfer<br/>Requisition]
    EmergencyRequest --> PriorityFlag[Mark High<br/>Priority]
    ScheduledTransfer --> CreateRequisition
    PriorityFlag --> CreateRequisition

    CreateRequisition --> SelectSource[Select Source<br/>Location]
    SelectSource --> SelectDestination[Select Destination<br/>Location]

    SelectDestination --> AddMedicines[Add Medicines<br/>to Transfer List]
    AddMedicines --> CheckSourceStock{Check Source<br/>Stock Levels}

    CheckSourceStock -->|Insufficient| PartialFulfillment{Partial<br/>Fulfillment?}
    PartialFulfillment -->|Yes| AdjustQuantities[Adjust Transfer<br/>Quantities]
    PartialFulfillment -->|No| RejectTransfer[Reject Transfer<br/>Request]

    CheckSourceStock -->|Sufficient| CreateTransferOrder[Create Transfer<br/>Order]
    AdjustQuantities --> CreateTransferOrder

    CreateTransferOrder --> ApprovalRequired{Approval<br/>Required?}
    ApprovalRequired -->|Yes| SendForApproval[Send for<br/>Approval]
    ApprovalRequired -->|No| AutoApprove[Auto-Approve]

    SendForApproval --> ManagerReview[Manager<br/>Reviews]
    ManagerReview --> ApprovalDecision{Approved?}

    ApprovalDecision -->|No| TransferRejected[Transfer<br/>Rejected]
    ApprovalDecision -->|Yes| ProcessTransfer[Process<br/>Transfer]

    AutoApprove --> ProcessTransfer
    ProcessTransfer --> GeneratePickList[Generate<br/>Pick List]

    GeneratePickList --> PhysicalPicking[Physical Picking<br/>from Source]
    PhysicalPicking --> PackForTransfer[Pack for<br/>Transfer]

    PackForTransfer --> GenerateTransferNote[Generate Transfer<br/>Note/Challan]
    GenerateTransferNote --> PhysicalTransport[Physical Transport<br/>to Destination]

    PhysicalTransport --> ReceiveAtDestination[Receive at<br/>Destination]
    ReceiveAtDestination --> VerifyItems[Verify Items<br/>& Quantities]

    VerifyItems --> ItemsMatch{Items<br/>Match?}
    ItemsMatch -->|No| RecordDiscrepancy[Record<br/>Discrepancy]
    ItemsMatch -->|Yes| AcceptTransfer[Accept<br/>Transfer]

    RecordDiscrepancy --> InvestigateDiscrepancy[Investigate<br/>Discrepancy]
    InvestigateDiscrepancy --> ResolveDiscrepancy[Resolve<br/>Discrepancy]
    ResolveDiscrepancy --> AcceptTransfer

    AcceptTransfer --> UpdateSourceStock[Update Source<br/>Stock (-)]
    UpdateSourceStock --> UpdateDestStock[Update Destination<br/>Stock (+)]

    UpdateDestStock --> RecordMovement[Record Stock<br/>Movement]
    RecordMovement --> NotifyStakeholders[Notify<br/>Stakeholders]

    NotifyStakeholders --> End([Transfer Complete])
    RejectTransfer --> End2([Transfer Cancelled])
    TransferRejected --> End2

    style Start fill:#e1f5fe
    style End,End2 fill:#c8e6c9
    style RejectTransfer,TransferRejected fill:#ffcdd2
    style EmergencyRequest fill:#fff3e0
```

### 3.4 Expiry Management Workflow

```mermaid
flowchart TD
    Start([Daily Expiry Check<br/>Scheduled Job])

    Start --> ScanAllBatches[Scan All Active<br/>Medicine Batches]
    ScanAllBatches --> CalculateDaysToExpiry[Calculate Days<br/>to Expiry]

    CalculateDaysToExpiry --> CategorizeByExpiry[Categorize by<br/>Expiry Timeline]

    CategorizeByExpiry --> Expired{Already<br/>Expired?}
    Expired -->|Yes| MarkExpired[Mark Status:<br/>EXPIRED]
    Expired -->|No| CheckDays{Days to<br/>Expiry}

    MarkExpired --> StopAllDispensing[Stop All<br/>Dispensing]
    StopAllDispensing --> QuarantineBatch[Quarantine<br/>Batch]

    CheckDays -->|< 7 days| CriticalAlert[🔴 Critical Alert:<br/>Expiring This Week]
    CheckDays -->|7-30 days| HighAlert[🟠 High Alert:<br/>Expiring This Month]
    CheckDays -->|31-90 days| MediumAlert[🟡 Medium Alert:<br/>Expiring in 3 Months]
    CheckDays -->|91-180 days| LowAlert[🔵 Low Alert:<br/>Monitor]
    CheckDays -->|> 180 days| NoAction[✅ No Action<br/>Required]

    CriticalAlert --> StopNewDispensing[Stop New<br/>Dispensing]
    StopNewDispensing --> PrioritizeExisting[Prioritize for<br/>Existing Patients]

    HighAlert --> SetFEFO[Set FEFO<br/>Priority High]
    MediumAlert --> SetFEFO2[Set FEFO<br/>Priority Medium]
    LowAlert --> AddToWatchlist[Add to<br/>Watch List]

    PrioritizeExisting --> CheckUsage{Can Be<br/>Used?}
    CheckUsage -->|Yes| FastTrackDispensing[Fast-Track<br/>Dispensing]
    CheckUsage -->|No| PrepareDisposal[Prepare for<br/>Disposal]

    SetFEFO --> UpdateDispenseLogic[Update Dispensing<br/>Priority Logic]
    SetFEFO2 --> UpdateDispenseLogic

    QuarantineBatch --> PrepareDisposal
    PrepareDisposal --> GenerateDisposalList[Generate Disposal<br/>List]

    GenerateDisposalList --> GetApproval[Get Disposal<br/>Approval]
    GetApproval --> DisposalMethod{Disposal<br/>Method}

    DisposalMethod -->|Return to Supplier| ReturnToSupplier[Initiate Return<br/>Process]
    DisposalMethod -->|Destroy| DestroyMedicine[Schedule<br/>Destruction]
    DisposalMethod -->|Donate| DonateIfAllowed[Donate to<br/>Approved Org]

    ReturnToSupplier --> GetCreditNote[Get Credit<br/>Note]
    DestroyMedicine --> GetCertificate[Get Destruction<br/>Certificate]
    DonateIfAllowed --> GetDonationReceipt[Get Donation<br/>Receipt]

    GetCreditNote --> RecordDisposal[Record Disposal<br/>in System]
    GetCertificate --> RecordDisposal
    GetDonationReceipt --> RecordDisposal

    RecordDisposal --> UpdateStock[Update Stock<br/>Records]
    UpdateStock --> UpdateFinancials[Update Financial<br/>Records]

    UpdateDispenseLogic --> GenerateReport[Generate Expiry<br/>Report]
    AddToWatchlist --> GenerateReport
    NoAction --> GenerateReport
    UpdateFinancials --> GenerateReport
    FastTrackDispensing --> GenerateReport

    GenerateReport --> NotifyStakeholders[Notify<br/>Stakeholders]
    NotifyStakeholders --> End([Expiry Check Complete])

    style Start fill:#e1f5fe
    style End fill:#c8e6c9
    style CriticalAlert,MarkExpired fill:#ffcdd2
    style HighAlert fill:#ffe0b2
    style MediumAlert fill:#fff9c4
    style LowAlert fill:#e3f2fd
    style NoAction fill:#c8e6c9
```

---

## 4. Integration Architecture

### 4.1 Module Integration Flow

```mermaid
flowchart LR
    subgraph "Clinical Modules"
        OPD[OPD Module]
        IPD[IPD Module]
        ER[Emergency]
        LAB[Laboratory]
    end

    subgraph "Service Modules"
        HOME[Home Care]
        DIET[Dietary]
        PHYSIO[Physiotherapy]
    end

    subgraph "Medicine Inventory"
        CORE[Inventory Core]
        DISP[Dispensing]
        STOCK[Stock Management]
        PURCH[Purchasing]
    end

    subgraph "Support Modules"
        BILL[Billing]
        REP[Reports]
        ALERT[Alerts]
    end

    OPD -->|Prescriptions| DISP
    IPD -->|Ward Requisitions| STOCK
    ER -->|Urgent Requests| STOCK
    LAB -->|Reagent Requests| STOCK

    HOME -->|Medicine Kits| DISP
    DIET -->|Supplements| STOCK
    PHYSIO -->|Medical Supplies| STOCK

    DISP -->|Charges| BILL
    STOCK -->|Usage Data| REP
    CORE -->|Stock Alerts| ALERT
    PURCH -->|Order Status| ALERT

    DISP --> CORE
    STOCK --> CORE
    PURCH --> CORE

    style CORE fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
```

### 4.2 API Integration Architecture

```mermaid
sequenceDiagram
    participant OPD as OPD Module
    participant API as Inventory API
    participant AUTH as Auth Service
    participant VAL as Validator
    participant CORE as Core Service
    participant DB as Database
    participant CACHE as Cache
    participant ALERT as Alert Service

    OPD->>API: POST /api/dispensing/opd-prescription
    API->>AUTH: Validate Token
    AUTH-->>API: Token Valid

    API->>VAL: Validate Prescription Data
    VAL-->>API: Data Valid

    API->>CORE: Process Prescription
    CORE->>DB: Check Medicine Master
    DB-->>CORE: Medicine Details

    CORE->>CACHE: Check Stock Levels
    CACHE-->>CORE: Current Stock

    alt Stock Available
        CORE->>DB: Reserve Stock
        DB-->>CORE: Stock Reserved
        CORE->>DB: Create Dispensing Record
        DB-->>CORE: Record Created
        CORE-->>API: Success Response
        API-->>OPD: Dispensing Ready
    else Stock Unavailable
        CORE->>ALERT: Send Low Stock Alert
        ALERT-->>CORE: Alert Sent
        CORE-->>API: Stock Unavailable
        API-->>OPD: Out of Stock Response
    end

    CORE->>CACHE: Update Stock Cache
    CACHE-->>CORE: Cache Updated
```

---

## 5. Data Flow Diagrams

### 5.1 Stock Level Data Flow

```mermaid
flowchart TD
    subgraph "Input Sources"
        PO[Purchase Orders]
        DISP[Dispensing]
        TRANS[Transfers]
        ADJ[Adjustments]
        RET[Returns]
    end

    subgraph "Processing"
        CALC[Stock Calculator]
        VAL[Validation]
        RULES[Business Rules]
    end

    subgraph "Data Storage"
        CURRENT[(Current Stock)]
        HISTORY[(Stock History)]
        MOVEMENT[(Movements)]
    end

    subgraph "Outputs"
        REPORT[Reports]
        ALERT[Alerts]
        DASH[Dashboard]
        API[API Response]
    end

    PO -->|Add Stock| CALC
    DISP -->|Reduce Stock| CALC
    TRANS -->|Move Stock| CALC
    ADJ -->|Adjust Stock| CALC
    RET -->|Add Stock| CALC

    CALC --> VAL
    VAL --> RULES

    RULES --> CURRENT
    RULES --> HISTORY
    RULES --> MOVEMENT

    CURRENT --> REPORT
    CURRENT --> ALERT
    CURRENT --> DASH
    CURRENT --> API

    HISTORY --> REPORT
    MOVEMENT --> REPORT
```

### 5.2 ABC-VED Analysis Flow

```mermaid
flowchart LR
    subgraph "Data Collection"
        COST[Cost Data]
        USAGE[Usage Data]
        CRITICAL[Criticality Data]
        MOVEMENT[Movement Data]
    end

    subgraph "Analysis Engine"
        ABC[ABC Analysis<br/>Cost-based]
        VED[VED Analysis<br/>Criticality]
        FSN[FSN Analysis<br/>Movement]
        MATRIX[Matrix Generation]
    end

    subgraph "Output"
        CAT[Categories]
        PAR[PAR Levels]
        REORDER[Reorder Points]
        REPORT[Analysis Report]
    end

    COST --> ABC
    USAGE --> ABC
    CRITICAL --> VED
    MOVEMENT --> FSN

    ABC --> MATRIX
    VED --> MATRIX
    FSN --> MATRIX

    MATRIX --> CAT
    MATRIX --> PAR
    MATRIX --> REORDER
    MATRIX --> REPORT

    style MATRIX fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
```

---

## 6. User Journey Maps

### 6.1 Pharmacist Daily Workflow

```mermaid
journey
    title Pharmacist Daily Workflow Journey

    section Morning Setup
      Login to System: 5: Pharmacist
      Check Alerts: 3: Pharmacist
      Review Expired Items: 2: Pharmacist
      Check Low Stock: 3: Pharmacist

    section Prescription Processing
      Receive Prescriptions: 5: Pharmacist
      Validate Prescriptions: 4: Pharmacist
      Check Stock: 5: Pharmacist
      Prepare Medicines: 5: Pharmacist
      Dispense to Patients: 5: Pharmacist

    section Stock Management
      Process Requisitions: 4: Pharmacist
      Receive Deliveries: 4: Pharmacist
      Update Stock: 5: Pharmacist
      Arrange Medicines: 4: Pharmacist

    section End of Day
      Generate Reports: 5: Pharmacist
      Check Tomorrow's Orders: 4: Pharmacist
      Final Stock Check: 4: Pharmacist
      Logout: 5: Pharmacist
```

### 6.2 Procurement Officer Journey

```mermaid
journey
    title Procurement Officer Journey

    section Planning
      Review Stock Levels: 5: Officer
      Check Reorder Points: 4: Officer
      Analyze Consumption: 4: Officer
      Forecast Demand: 3: Officer

    section Ordering
      Create Purchase Orders: 5: Officer
      Select Suppliers: 4: Officer
      Negotiate Prices: 3: Officer
      Submit for Approval: 5: Officer
      Send to Suppliers: 5: Officer

    section Receiving
      Track Deliveries: 4: Officer
      Receive Goods: 5: Officer
      Quality Check: 4: Officer
      Update Inventory: 5: Officer

    section Analysis
      Supplier Performance: 4: Officer
      Cost Analysis: 4: Officer
      Generate Reports: 5: Officer
```

---

## 7. State Diagrams

### 7.1 Medicine Batch Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Ordered: Purchase Order Created

    Ordered --> InTransit: Shipped by Supplier
    InTransit --> Received: Goods Received

    Received --> QualityCheck: Start QC
    QualityCheck --> Approved: QC Passed
    QualityCheck --> Rejected: QC Failed

    Rejected --> Returned: Return to Supplier
    Returned --> [*]

    Approved --> Active: Added to Stock

    Active --> NearExpiry: < 90 days to expiry
    NearExpiry --> Expiring: < 30 days to expiry
    Expiring --> Expired: Expiry Date Reached

    Active --> Consumed: Fully Dispensed
    NearExpiry --> Consumed: Fully Dispensed

    Expired --> Quarantined: Moved to Quarantine
    Quarantined --> Disposed: Disposal Completed

    Consumed --> [*]
    Disposed --> [*]

    note right of Active
        Main operational state
        Available for dispensing
    end note

    note right of Expired
        Cannot be dispensed
        Must be disposed
    end note
```

### 7.2 Purchase Order States

```mermaid
stateDiagram-v2
    [*] --> Draft: Create PO

    Draft --> Submitted: Submit for Approval

    Submitted --> UnderReview: Manager Reviews
    UnderReview --> Approved: Manager Approves
    UnderReview --> Rejected: Manager Rejects

    Rejected --> Draft: Revise PO
    Rejected --> Cancelled: Cancel PO

    Approved --> Sent: Send to Supplier

    Sent --> Acknowledged: Supplier Confirms
    Acknowledged --> PartialDelivered: Partial Delivery
    Acknowledged --> Delivered: Full Delivery

    PartialDelivered --> Delivered: Remaining Delivered

    Delivered --> Completed: All Items Received
    Delivered --> Disputed: Quality Issues

    Disputed --> Resolved: Issues Resolved
    Resolved --> Completed: Settlement Done

    Completed --> Closed: Payment Processed

    Cancelled --> [*]
    Closed --> [*]
```

### 7.3 Stock Alert Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active: Alert Created

    Active --> Notified: Notification Sent

    Notified --> Acknowledged: User Acknowledges
    Notified --> Escalated: No Response

    Escalated --> Acknowledged: Manager Acknowledges

    Acknowledged --> InProgress: Action Started

    InProgress --> Resolved: Issue Fixed
    InProgress --> Ignored: False Alert

    Resolved --> Closed: Alert Closed
    Ignored --> Closed: Alert Closed

    Closed --> [*]

    Active --> AutoResolved: System Auto-Resolves
    AutoResolved --> Closed: Alert Closed

    note right of Escalated
        Escalated to manager
        after timeout
    end note
```

---

## 8. Analytics Architecture

### 8.1 Analytics Data Pipeline

```mermaid
flowchart TB
    subgraph "Data Sources"
        TRANS[Transactional<br/>Database]
        LOGS[System Logs]
        EXT[External Data]
    end

    subgraph "ETL Pipeline"
        EXTRACT[Extract]
        TRANSFORM[Transform]
        LOAD[Load]
    end

    subgraph "Data Warehouse"
        FACT[Fact Tables]
        DIM[Dimension Tables]
        AGG[Aggregated Data]
    end

    subgraph "Analytics Layer"
        OLAP[OLAP Cubes]
        ML[ML Models]
        REPORT[Report Engine]
    end

    subgraph "Presentation"
        DASH[Dashboards]
        VIZ[Visualizations]
        EXPORT[Reports Export]
        API[Analytics API]
    end

    TRANS --> EXTRACT
    LOGS --> EXTRACT
    EXT --> EXTRACT

    EXTRACT --> TRANSFORM
    TRANSFORM --> LOAD

    LOAD --> FACT
    LOAD --> DIM
    FACT --> AGG
    DIM --> AGG

    AGG --> OLAP
    AGG --> ML
    AGG --> REPORT

    OLAP --> DASH
    ML --> VIZ
    REPORT --> EXPORT
    OLAP --> API

    style TRANSFORM fill:#e3f2fd
    style ML fill:#fff3e0
```

### 8.2 KPI Dashboard Architecture

```mermaid
flowchart LR
    subgraph "Real-time Metrics"
        STOCK[Stock Levels]
        ALERT[Active Alerts]
        DISP[Dispensing Rate]
    end

    subgraph "Calculated Metrics"
        TURN[Turnover Ratio]
        EXPIRE[Expiry Rate]
        FULFILL[Fulfillment Rate]
    end

    subgraph "Predictive Metrics"
        FORECAST[Demand Forecast]
        RISK[Stockout Risk]
        TREND[Trend Analysis]
    end

    subgraph "Dashboard Components"
        CARDS[Metric Cards]
        CHARTS[Charts]
        TABLES[Data Tables]
        FILTERS[Filters]
    end

    STOCK --> CARDS
    ALERT --> CARDS
    DISP --> CARDS

    TURN --> CHARTS
    EXPIRE --> CHARTS
    FULFILL --> CHARTS

    FORECAST --> CHARTS
    RISK --> TABLES
    TREND --> CHARTS

    CARDS --> FILTERS
    CHARTS --> FILTERS
    TABLES --> FILTERS
```

---

## 9. System Integration Patterns

### 9.1 Event-Driven Architecture

```mermaid
flowchart TB
    subgraph "Event Producers"
        P1[Stock Update]
        P2[New Order]
        P3[Dispensing]
        P4[Expiry Alert]
    end

    subgraph "Message Broker"
        QUEUE[Event Queue]
        TOPICS[Topics]
    end

    subgraph "Event Consumers"
        C1[Alert Service]
        C2[Report Generator]
        C3[Analytics Engine]
        C4[Notification Service]
    end

    P1 --> QUEUE
    P2 --> QUEUE
    P3 --> QUEUE
    P4 --> QUEUE

    QUEUE --> TOPICS

    TOPICS -->|stock.updated| C1
    TOPICS -->|order.created| C2
    TOPICS -->|medicine.dispensed| C3
    TOPICS -->|batch.expiring| C4

    C1 --> ACTION1[Check Thresholds]
    C2 --> ACTION2[Update Reports]
    C3 --> ACTION3[Calculate Metrics]
    C4 --> ACTION4[Send Notifications]
```

### 9.2 Microservices Communication

```mermaid
graph TB
    subgraph "API Gateway"
        GW[Gateway]
    end

    subgraph "Core Services"
        MED[Medicine Service]
        INV[Inventory Service]
        PO[Purchase Service]
        DISP[Dispensing Service]
    end

    subgraph "Support Services"
        AUTH[Auth Service]
        NOTIF[Notification Service]
        REPORT[Report Service]
    end

    subgraph "Data Layer"
        DB[(Database)]
        CACHE[(Redis)]
        SEARCH[(Elasticsearch)]
    end

    GW --> AUTH
    GW --> MED
    GW --> INV
    GW --> PO
    GW --> DISP

    MED --> DB
    INV --> DB
    PO --> DB
    DISP --> DB

    INV --> CACHE
    MED --> SEARCH

    INV --> NOTIF
    PO --> NOTIF
    DISP --> REPORT

    style GW fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
```

---

## 10. Security Architecture

### 10.1 Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Auth
    participant RBAC
    participant Resource

    User->>Frontend: Login Credentials
    Frontend->>API: POST /auth/login
    API->>Auth: Validate Credentials

    Auth->>Auth: Check User
    Auth->>Auth: Verify Password
    Auth-->>API: Generate JWT Token
    API-->>Frontend: Return Token
    Frontend-->>User: Login Success

    User->>Frontend: Access Inventory
    Frontend->>API: GET /inventory (Token)
    API->>Auth: Validate Token
    Auth-->>API: Token Valid

    API->>RBAC: Check Permissions
    RBAC->>RBAC: Get User Role
    RBAC->>RBAC: Check Resource Access
    RBAC-->>API: Permission Granted

    API->>Resource: Fetch Data
    Resource-->>API: Return Data
    API-->>Frontend: Return Response
    Frontend-->>User: Show Inventory
```

---

## Summary

These comprehensive Mermaid diagrams cover all aspects of the Medicine Inventory Management System:

1. **System Architecture** - Module structure and component layers
2. **Database Relationships** - Complete ERD with all entities
3. **Core Workflows** - Purchase, Dispensing, Transfer, and Expiry management
4. **Integration Points** - How inventory connects with other modules
5. **Data Flows** - Movement of data through the system
6. **User Journeys** - Daily workflows for different roles
7. **State Machines** - Lifecycle of batches, POs, and alerts
8. **Analytics Pipeline** - From data collection to visualization
9. **Security Architecture** - Authentication and authorization flows

Each diagram is designed to be:
- **Clear and readable** - Proper hierarchy and flow
- **Comprehensive** - Covers all major scenarios
- **Implementation-ready** - Can be used by developers
- **Color-coded** - Visual distinction between components

These diagrams serve as visual documentation for developers, stakeholders, and users to understand the complete system architecture and workflows.

---

**Document Version:** 1.0
**Last Updated:** March 18, 2025
**Author:** CV Raman Health Development Team