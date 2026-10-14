# Feature Specification: Patient Portal (Self-Service)

## 📋 Overview

**Feature ID**: FEAT-009
**Priority**: High
**Complexity**: High
**Estimated Effort**: 4-5 weeks
**Dependencies**: Patient authentication system, ABHA integration

### Purpose
Empower patients with secure, 24/7 access to their health records, test results, appointments, and educational resources through a dedicated patient-facing portal.

### Business Value
- **Patient Engagement**: Patients actively participate in their care
- **Reduced Administrative Load**: Patients self-service reduces phone calls
- **Better Outcomes**: Engaged patients have better health outcomes
- **ABDM Compliance**: Meets India's health data sharing requirements
- **Competitive Advantage**: Modern digital experience attracts patients

---

## 👥 User Stories

### As a Patient
```
GIVEN I have registered on the patient portal
WHEN I log in with my ABHA credentials
THEN I can view my health records
  AND I can download lab reports
  AND I can book/cancel appointments
  AND I can update my contact information
  AND I can message my healthcare team
```

### As a Family Member/Caregiver
```
GIVEN I have authorized access to a patient's records
WHEN I log in to the portal
THEN I can view the patient's information
  AND I can book appointments on their behalf
  AND I receive notifications about their care
  BUT I cannot modify their medical records
```

### As a Healthcare Provider
```
GIVEN patients are using the portal
WHEN they access their records
THEN all access is logged for HIPAA/DPDPA compliance
  AND I can see portal engagement metrics
  AND I can push educational content to patients
```

---

## 🎯 Core Features

### 1. Patient Registration & Login

```
┌──────────────────────────────────────────────┐
│  Welcome to CV Raman Health Patient Portal  │
├──────────────────────────────────────────────┤
│                                              │
│  LOGIN                                       │
│  ┌────────────────────────────────────────┐ │
│  │ Login with ABHA                        │ │
│  │ [ABHA Address: user@abdm            ] │ │
│  │ [Password: **************           ] │ │
│  │                                        │ │
│  │ [ ] Remember me    [Forgot Password?] │ │
│  │                                        │ │
│  │ [Login with ABHA →]                   │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  OR                                          │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Login with Email                       │ │
│  │ [Email: patient@email.com          ]  │ │
│  │ [Password: **************           ] │ │
│  │                                        │ │
│  │ [Login →]                             │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  New Patient? [Register Here]               │
└──────────────────────────────────────────────┘
```

**Registration Flow**:
1. Enter ABHA Address (if available) or email
2. Verify identity via OTP (mobile/email)
3. Link to existing patient record (if hospital patient)
4. Set password and security questions
5. Complete profile (emergency contact, preferences)

### 2. Dashboard

```
Patient Portal - Welcome, Farzan!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK ACTIONS
[📅 Book Appointment]  [📋 View Reports]  [💊 Medications]  [📧 Messages]

UPCOMING APPOINTMENTS
┌─────────────────────────────────────────────────┐
│ March 15, 2024 at 10:00 AM                     │
│ Dr. Sharma - Cardiology Follow-up               │
│ Location: OPD Block, 2nd Floor                  │
│ [View Details]  [Reschedule]  [Cancel]         │
└─────────────────────────────────────────────────┘

RECENT LAB RESULTS
┌─────────────────────────────────────────────────┐
│ Complete Blood Count (Mar 1, 2024)             │
│ Status: Normal                                  │
│ [View Report] [Download PDF]                    │
├─────────────────────────────────────────────────┤
│ HbA1c (Feb 15, 2024)                           │
│ Status: 6.8% - Within target range             │
│ [View Report] [Download PDF]                    │
└─────────────────────────────────────────────────┘

HEALTH REMINDERS
⚠️ Annual physical exam due next month
💊 Prescription refill needed for Metformin
📊 Upload your home BP readings

RECENT ACTIVITY
- Appointment completed: Dr. Patel (Mar 1)
- Lab results received: CBC (Mar 1)
- Message from Dr. Sharma (Feb 28)
```

### 3. Health Records

```
My Health Records
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABS: [Medical History] [Lab Results] [Imaging] [Medications] [Immunizations]

┌─── MEDICAL HISTORY ────────────────────────────┐
│                                                │
│ Chronic Conditions                             │
│ ├── Type 2 Diabetes (since 2020)              │
│ └── Hypertension (since 2018)                 │
│                                                │
│ Allergies                                      │
│ ├── Penicillin - Severe reaction              │
│ └── Shellfish - Mild reaction                 │
│                                                │
│ Past Surgeries                                 │
│ └── Appendectomy (2015)                       │
│                                                │
│ Family History                                 │
│ ├── Father: Heart disease                     │
│ └── Mother: Diabetes                          │
│                                                │
│ [Request Records Update]                       │
└────────────────────────────────────────────────┘

┌─── LAB RESULTS ───────────────────────────────┐
│                                               │
│ Filter: [All Tests ▼]  [Last 6 months ▼]     │
│                                               │
│ HbA1c - 6.8%                     Mar 1, 2024 │
│ Reference: 4.0-6.0% (elevated)               │
│ Trend: ↓ Improving                           │
│ [View Details] [Download] [Share]            │
│                                               │
│ Complete Blood Count             Feb 15, 2024│
│ All values within normal range               │
│ [View Details] [Download] [Share]            │
│                                               │
│ Lipid Panel                      Jan 20, 2024│
│ Total Cholesterol: 210 mg/dL (borderline)    │
│ [View Details] [Download] [Share]            │
│                                               │
└───────────────────────────────────────────────┘
```

### 4. Appointments

```
My Appointments
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Book New Appointment]

UPCOMING
┌────────────────────────────────────────────────┐
│ Friday, March 15, 2024 • 10:00 AM            │
│ Dr. Sharma - Cardiology Follow-up             │
│ Location: OPD Block, 2nd Floor                │
│ Reason: Quarterly diabetes check              │
│                                                │
│ Prepare: Fasting required (8 hours)           │
│ Bring: Previous reports, current medications  │
│                                                │
│ [Add to Calendar]  [Get Directions]           │
│ [Reschedule]  [Cancel Appointment]            │
└────────────────────────────────────────────────┘

PAST APPOINTMENTS (Last 6 months)
┌────────────────────────────────────────────────┐
│ Mar 1, 2024 - Dr. Patel (Completed)          │
│ General Checkup                                │
│ [View Visit Summary]  [Download Report]        │
├────────────────────────────────────────────────┤
│ Feb 1, 2024 - Dr. Sharma (Completed)         │
│ Cardiology Follow-up                           │
│ [View Visit Summary]                           │
└────────────────────────────────────────────────┘

┌─── BOOK NEW APPOINTMENT ──────────────────────┐
│                                                │
│ Department: [Cardiology           ▼]          │
│ Physician:  [Dr. Sharma           ▼]          │
│ Reason:     [Follow-up visit      ▼]          │
│                                                │
│ Available Slots (March 2024)                  │
│                                                │
│ Mon 18    Tue 19    Wed 20    Thu 21          │
│ 10:00 AM  09:00 AM  10:00 AM  11:00 AM        │
│ 02:00 PM  02:00 PM  02:00 PM  03:00 PM        │
│ 04:00 PM  04:00 PM  -         04:00 PM        │
│                                                │
│ Selected: Tuesday, March 19 at 9:00 AM        │
│                                                │
│ Notes (optional):                              │
│ [Experiencing chest discomfort...]             │
│                                                │
│ [Confirm Booking]  [Cancel]                   │
└────────────────────────────────────────────────┘
```

### 5. Medications

```
My Medications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT MEDICATIONS
┌────────────────────────────────────────────────┐
│ Metformin 500mg                                │
│ Dosage: 1 tablet twice daily with meals       │
│ Prescribed: Jan 15, 2024 by Dr. Sharma        │
│ Refills: 2 remaining                           │
│ Next refill due: March 15, 2024                │
│                                                │
│ ⏰ Reminders: 8:00 AM, 8:00 PM                │
│ [Request Refill]  [Set Reminder]              │
├────────────────────────────────────────────────┤
│ Lisinopril 10mg                                │
│ Dosage: 1 tablet once daily in morning        │
│ Prescribed: Dec 1, 2023 by Dr. Patel          │
│ Refills: 5 remaining                           │
│                                                │
│ [Request Refill]  [Set Reminder]              │
└────────────────────────────────────────────────┘

MEDICATION HISTORY
[View past medications and discontinued drugs]

PRESCRIPTION REQUESTS
[Request new prescription from doctor]
```

### 6. Messages

```
Secure Messages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[+ New Message]

INBOX (3 unread)
┌────────────────────────────────────────────────┐
│ ● Dr. Sharma                        Mar 1, 10:15 AM│
│   Lab Results Review                           │
│   "Your recent HbA1c shows improvement..."     │
├────────────────────────────────────────────────┤
│   Appointment Reminder              Feb 28     │
│   System notification                          │
│   "Upcoming appointment on March 15..."        │
├────────────────────────────────────────────────┤
│ ● Pharmacy                          Feb 27     │
│   Prescription Ready                           │
│   "Your prescription is ready for pickup"      │
└────────────────────────────────────────────────┘

┌─── MESSAGE THREAD: Dr. Sharma ────────────────┐
│                                                │
│ Dr. Sharma           Mar 1, 2024 10:15 AM     │
│ ┌────────────────────────────────────────────┐│
│ │ Your recent HbA1c results show improvement││
│ │ from 7.2% to 6.8%. Keep up the good work │ │
│ │ with diet and exercise. See you at your  │ │
│ │ next appointment on March 15.             │ │
│ └────────────────────────────────────────────┘│
│                                                │
│ You                  Mar 1, 2024 02:30 PM     │
│ ┌────────────────────────────────────────────┐│
│ │ Thank you doctor. I have a question about ││
│ │ my medication timing...                    │ │
│ └────────────────────────────────────────────┘│
│                                                │
│ [Type your message...]                         │
│ [Send]                                         │
└────────────────────────────────────────────────┘
```

### 7. Profile & Settings

```
My Profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSONAL INFORMATION
┌────────────────────────────────────────────────┐
│ Full Name:      Farzan Manzer                  │
│ Date of Birth:  January 15, 1992 (32 years)   │
│ Gender:         Male                           │
│ ABHA Address:   farzan@abdm                    │
│ ABHA ID:        XX-XXXX-XXXX-5798             │
│                                                │
│ [Update Information]                           │
└────────────────────────────────────────────────┘

CONTACT INFORMATION
┌────────────────────────────────────────────────┐
│ Phone:          +91-9876543210                 │
│ Email:          farzan@example.com             │
│ Address:        123 Main Street                │
│                 Ranchi, Jharkhand 834001       │
│                                                │
│ [Edit Contact Info]                            │
└────────────────────────────────────────────────┘

EMERGENCY CONTACT
┌────────────────────────────────────────────────┐
│ Name:           John Doe                       │
│ Relationship:   Brother                        │
│ Phone:          +91-9876543211                 │
│                                                │
│ [Edit Emergency Contact]                       │
└────────────────────────────────────────────────┘

PREFERENCES
┌────────────────────────────────────────────────┐
│ Notifications                                  │
│ [x] Email notifications                        │
│ [x] SMS reminders                             │
│ [ ] Push notifications (enable mobile app)     │
│                                                │
│ Communication Preferences                      │
│ Preferred Language: [English ▼]               │
│ Appointment Reminders: [24 hours before ▼]    │
│                                                │
│ Privacy                                        │
│ [View Privacy Policy]                          │
│ [Manage Data Sharing]                          │
│ [Download My Data]                             │
│ [Delete My Account]                            │
│                                                │
│ [Save Preferences]                             │
└────────────────────────────────────────────────┘

FAMILY MEMBERS
┌────────────────────────────────────────────────┐
│ Jane Doe (Mother)                              │
│ Access Level: Full (can view all records)     │
│ [Manage Access]  [Remove]                     │
├────────────────────────────────────────────────┤
│ [+ Add Family Member]                          │
└────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

```sql
-- Patient portal users (extends Patient model)
CREATE TABLE patient_portal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE UNIQUE,

    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    abha_address VARCHAR(255) UNIQUE, -- Optional ABHA login
    abha_verified BOOLEAN DEFAULT FALSE,

    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE, -- Email verified
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,

    -- Security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    last_password_change TIMESTAMP,

    -- Preferences
    notification_preferences JSONB DEFAULT '{"email": true, "sms": true, "push": false}',
    language_preference VARCHAR(10) DEFAULT 'en',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family/caregiver access
CREATE TABLE patient_family_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    family_user_id UUID NOT NULL REFERENCES patient_portal_users(id) ON DELETE CASCADE,

    -- Relationship
    relationship VARCHAR(50) NOT NULL, -- 'spouse', 'child', 'parent', 'caregiver'
    relationship_verified BOOLEAN DEFAULT FALSE,

    -- Access control
    access_level VARCHAR(20) DEFAULT 'view_only', -- 'view_only', 'book_appointments', 'full'
    can_view_records BOOLEAN DEFAULT TRUE,
    can_book_appointments BOOLEAN DEFAULT FALSE,
    can_message_providers BOOLEAN DEFAULT FALSE,

    -- Consent
    consent_date TIMESTAMP,
    consent_expires TIMESTAMP,
    revoked_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_patient_family UNIQUE(patient_id, family_user_id)
);

-- Patient messages (secure messaging with providers)
CREATE TABLE patient_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID, -- For grouping related messages

    -- Participants
    sender_type VARCHAR(20) NOT NULL, -- 'patient', 'provider', 'system'
    sender_patient_id UUID REFERENCES patient_portal_users(id),
    sender_provider_id UUID REFERENCES users(id),

    recipient_type VARCHAR(20) NOT NULL,
    recipient_patient_id UUID REFERENCES patient_portal_users(id),
    recipient_provider_id UUID REFERENCES users(id),

    -- Message content
    subject VARCHAR(255),
    message TEXT NOT NULL,
    attachments JSONB, -- File references

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'

    -- Compliance
    is_encrypted BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient portal sessions (track login sessions)
CREATE TABLE patient_portal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES patient_portal_users(id) ON DELETE CASCADE,

    -- Session details
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'

    -- Timing
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,

    -- Security
    is_suspicious BOOLEAN DEFAULT FALSE
);

-- Patient portal activity log (audit trail)
CREATE TABLE patient_portal_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES patient_portal_users(id) ON DELETE CASCADE,

    -- Activity details
    activity_type VARCHAR(50) NOT NULL, -- 'view_record', 'download_report', 'book_appointment', 'send_message'
    resource_type VARCHAR(50), -- 'lab_result', 'appointment', 'medication'
    resource_id UUID,

    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointment bookings from portal
CREATE TABLE patient_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    booked_by_portal_user UUID REFERENCES patient_portal_users(id), -- Could be family member

    -- Appointment details
    provider_id UUID REFERENCES users(id), -- Physician
    department VARCHAR(100),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason VARCHAR(500),
    notes TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
    cancelled_by VARCHAR(20), -- 'patient', 'provider', 'system'
    cancellation_reason TEXT,

    -- Reminders
    reminder_sent_24h BOOLEAN DEFAULT FALSE,
    reminder_sent_2h BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medication refill requests
CREATE TABLE medication_refill_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES patient_portal_users(id),

    -- Medication details
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    prescribed_by UUID REFERENCES users(id), -- Original prescribing physician

    -- Request details
    request_reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_portal_users_email ON patient_portal_users(email);
CREATE INDEX idx_portal_users_abha ON patient_portal_users(abha_address);
CREATE INDEX idx_portal_sessions_user ON patient_portal_sessions(user_id);
CREATE INDEX idx_portal_sessions_token ON patient_portal_sessions(session_token);
CREATE INDEX idx_patient_messages_thread ON patient_messages(thread_id);
CREATE INDEX idx_patient_messages_recipient ON patient_messages(recipient_patient_id, recipient_provider_id);
CREATE INDEX idx_patient_appointments_date ON patient_appointments(appointment_date, appointment_time);
CREATE INDEX idx_patient_appointments_patient ON patient_appointments(patient_id);
```

---

## 🔌 API Endpoints

### Authentication

**POST /api/patient-portal/register**
```javascript
Request:
{
  email: "patient@email.com",
  password: "SecurePass123!",
  full_name: "Farzan Manzer",
  date_of_birth: "1992-01-15",
  phone: "+91-9876543210",
  abha_address: "farzan@abdm" // Optional
}

Response:
{
  user_id: "uuid",
  message: "Registration successful. Please verify your email.",
  verification_sent: true
}
```

**POST /api/patient-portal/login**
```javascript
Request:
{
  email: "patient@email.com",
  password: "SecurePass123!"
}

Response:
{
  access_token: "jwt_token",
  refresh_token: "refresh_token",
  user: {
    id: "uuid",
    full_name: "Farzan Manzer",
    email: "patient@email.com",
    patient_id: "uuid"
  },
  expires_in: 3600
}
```

### Patient Records

**GET /api/patient-portal/health-records**
```javascript
Response:
{
  medical_history: {
    chronic_conditions: [
      { name: "Type 2 Diabetes", since: "2020-01-01", status: "active" }
    ],
    allergies: [
      { name: "Penicillin", severity: "severe" }
    ],
    surgeries: [
      { procedure: "Appendectomy", date: "2015-06-10" }
    ],
    family_history: [
      { relation: "Father", condition: "Heart disease" }
    ]
  },
  lab_results: [
    {
      id: "uuid",
      test_name: "HbA1c",
      value: "6.8%",
      reference_range: "4.0-6.0%",
      date: "2024-03-01",
      status: "elevated",
      trend: "improving",
      report_url: "/reports/lab/uuid.pdf"
    }
  ],
  medications: [
    {
      id: "uuid",
      name: "Metformin 500mg",
      dosage: "1 tablet twice daily",
      prescribed_date: "2024-01-15",
      prescribed_by: "Dr. Sharma",
      refills_remaining: 2,
      next_refill_due: "2024-03-15"
    }
  ],
  immunizations: [
    {
      vaccine: "COVID-19 Booster",
      date: "2024-01-10",
      provider: "CV Raman Health"
    }
  ]
}
```

### Appointments

**GET /api/patient-portal/appointments/available-slots**
```javascript
Query: ?provider_id=uuid&date=2024-03-15

Response:
{
  provider: {
    id: "uuid",
    full_name: "Dr. Sharma",
    department: "Cardiology"
  },
  slots: [
    { time: "09:00", available: true },
    { time: "10:00", available: false },
    { time: "11:00", available: true }
  ]
}
```

**POST /api/patient-portal/appointments/book**
```javascript
Request:
{
  provider_id: "uuid",
  date: "2024-03-19",
  time: "09:00",
  reason: "Follow-up visit",
  notes: "Experiencing chest discomfort"
}

Response:
{
  appointment_id: "uuid",
  confirmation_number: "APT-20240319-001",
  message: "Appointment booked successfully",
  appointment_details: {
    provider: "Dr. Sharma",
    date: "2024-03-19",
    time: "09:00",
    location: "OPD Block, 2nd Floor"
  }
}
```

### Messages

**POST /api/patient-portal/messages/send**
```javascript
Request:
{
  recipient_provider_id: "uuid",
  subject: "Question about medication",
  message: "I have a question about my medication timing...",
  thread_id: "uuid" // Optional, for replies
}

Response:
{
  message_id: "uuid",
  thread_id: "uuid",
  message: "Message sent successfully"
}
```

**GET /api/patient-portal/messages**
```javascript
Response:
{
  threads: [
    {
      thread_id: "uuid",
      subject: "Lab Results Review",
      last_message: "Your recent HbA1c shows improvement...",
      last_message_date: "2024-03-01T10:15:00Z",
      unread_count: 1,
      participants: [
        { type: "provider", name: "Dr. Sharma" }
      ]
    }
  ],
  unread_total: 3
}
```

---

## 🎨 Frontend - Patient Portal App

### Separate Frontend Application
```
patient-portal/ (separate React app)
├── public/
├── src/
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── HealthRecords.jsx
│   │   ├── Appointments.jsx
│   │   ├── Messages.jsx
│   │   ├── Medications.jsx
│   │   └── Profile.jsx
│   ├── components/
│   │   ├── PortalLayout.jsx
│   │   ├── LabResultCard.jsx
│   │   ├── AppointmentCard.jsx
│   │   ├── MessageThread.jsx
│   │   └── MedicationList.jsx
│   ├── hooks/
│   │   ├── usePatientAuth.js
│   │   ├── useHealthRecords.js
│   │   └── useAppointments.js
│   └── utils/
│       ├── portalApi.js
│       └── authService.js
└── package.json
```

### Key Component: Dashboard.jsx
```jsx
import { usePatientAuth } from '../hooks/usePatientAuth';
import { Calendar, FileText, Pill, MessageSquare } from 'lucide-react';

export default function Dashboard() {
  const { user } = usePatientAuth();
  const { upcomingAppointments } = useAppointments();
  const { recentLabResults } = useHealthRecords();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">
        Welcome back, {user.full_name.split(' ')[0]}!
      </h1>
      <p className="text-gray-600 mb-8">Here's your health summary</p>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <QuickActionCard
          icon={Calendar}
          title="Book Appointment"
          href="/appointments/book"
        />
        <QuickActionCard
          icon={FileText}
          title="View Reports"
          href="/health-records"
        />
        <QuickActionCard
          icon={Pill}
          title="Medications"
          href="/medications"
        />
        <QuickActionCard
          icon={MessageSquare}
          title="Messages"
          href="/messages"
          badge={3}
        />
      </div>

      {/* Upcoming Appointments */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Upcoming Appointments</h2>
        {upcomingAppointments.map(apt => (
          <AppointmentCard key={apt.id} appointment={apt} />
        ))}
      </section>

      {/* Recent Lab Results */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent Lab Results</h2>
        {recentLabResults.map(result => (
          <LabResultCard key={result.id} result={result} />
        ))}
      </section>
    </div>
  );
}
```

---

## 🔐 Security Implementation

### Authentication & Authorization
```python
# backend/app/patient_portal/auth.py
from flask import request, jsonify
from functools import wraps
import jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv('PATIENT_PORTAL_SECRET')

def generate_token(user_id):
    """Generate JWT token for patient"""
    payload = {
        'user_id': str(user_id),
        'type': 'patient',
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def require_patient_auth(f):
    """Decorator to require patient authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')

        if not token:
            return jsonify({'error': 'Missing authentication token'}), 401

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            if payload.get('type') != 'patient':
                return jsonify({'error': 'Invalid token type'}), 403

            # Attach user to request
            request.patient_user_id = payload['user_id']
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

    return decorated
```

### Data Privacy
- **HIPAA/DPDPA Compliance**: All patient data encrypted at rest and in transit
- **Access Logging**: Every data access logged with timestamp, IP, user agent
- **Consent Management**: Explicit consent for data sharing
- **Right to Delete**: Patients can request account deletion
- **Data Export**: Patients can download all their data

---

## 📅 Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- Database schema + migrations
- Authentication system (login/register)
- Basic dashboard

### Phase 2: Core Features (Week 3-4)
- Health records view
- Appointments booking
- Messages

### Phase 3: Advanced Features (Week 5)
- Medication management
- Family access
- Profile management

### Week 6: Testing & Launch
- Security audit
- Load testing
- User acceptance testing
- Documentation

---

## ✅ Acceptance Criteria

- [ ] Patients can register and login securely
- [ ] ABHA integration for login works
- [ ] Patients can view lab results and download PDFs
- [ ] Appointment booking system functional
- [ ] Secure messaging with providers works
- [ ] Family member access control works
- [ ] Mobile-responsive design
- [ ] WCAG 2.1 AA accessibility compliant
- [ ] Security audit passed
- [ ] Load test: 1000 concurrent users

---

## 🚀 Future Enhancements

- **Mobile Apps**: iOS/Android native apps
- **Telemedicine**: Video consultations
- **Health Tracker**: Manual entry of vitals (BP, glucose, weight)
- **Educational Content**: Personalized health tips
- **Bill Payment**: Online payment integration
- **Insurance Claims**: Submit and track claims
- **Health Timeline**: Visual timeline of health journey
- **Wearable Integration**: Sync data from fitness trackers
