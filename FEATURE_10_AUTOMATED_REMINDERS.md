# Feature Specification: Automated Reminders (SMS/Email)

## 📋 Overview

**Feature ID**: FEAT-010  
**Priority**: High  
**Complexity**: Medium  
**Estimated Effort**: 2-3 weeks  
**Dependencies**: Patient contact info, SMS/Email service providers, Notification queue system

### Purpose
Reduce no-shows, improve medication adherence, and enhance patient engagement through automated, timely reminders sent via SMS and email.

### Business Value
- **Reduced No-Shows**: Appointment reminders reduce no-show rates by 20-30%
- **Better Health Outcomes**: Medication reminders improve adherence by 15-25%
- **Operational Efficiency**: Auto-reminders reduce manual staff workload
- **Patient Satisfaction**: Patients appreciate proactive communication
- **Revenue Protection**: Fewer missed appointments = better revenue

---

## 👥 User Stories

### As a Patient
```
GIVEN I have an upcoming appointment
WHEN the appointment is 24 hours away
THEN I receive an SMS and email reminder
  AND the reminder includes date, time, location, and physician name
  AND I can confirm or reschedule via a link
```

### As a Healthcare Admin
```
GIVEN I want to configure reminder settings
WHEN I access the reminder configuration panel
THEN I can set timing (24h, 2h, etc.)
  AND I can customize message templates
  AND I can choose SMS/email/both
  AND I can view reminder delivery statistics
```

### As a Physician
```
GIVEN my patients are on medication schedules
WHEN medication refills are due
THEN patients receive automatic refill reminders
  AND I can track medication adherence rates
  AND I can see which patients need follow-up
```

---

## 🎯 Reminder Types

### 1. Appointment Reminders
```
Timing Options:
├── 7 days before
├── 24 hours before (DEFAULT)
├── 2 hours before
└── 30 minutes before (SMS only for urgent)

Content:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Appointment Reminder - CV Raman Health

Dear Farzan,

This is a reminder of your upcoming appointment:

📅 Date: March 15, 2024
⏰ Time: 10:00 AM
👨‍⚕️ Provider: Dr. Sharma (Cardiology)
📍 Location: OPD Block, 2nd Floor

Please arrive 15 minutes early.

Confirm: https://cvraman.health/apt/confirm/abc123
Reschedule: https://cvraman.health/apt/reschedule/abc123

Call us: +91-XXX-XXX-XXXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SMS Version (160 chars):
"Appt Reminder: Mar 15, 10AM with Dr. Sharma at CV Raman. 
Confirm: bit.ly/abc123"
```

### 2. Medication Reminders
```
Daily Medication Reminder:

Good Morning, Farzan!

💊 Time to take your medications:

- Metformin 500mg (1 tablet with breakfast)
- Lisinopril 10mg (1 tablet)

⏰ Take at: 8:00 AM
📱 Log taken: https://cvraman.health/med/log/xyz789

Refill Reminder (7 days before):

Hi Farzan,

Your prescription for Metformin is running low.

📋 Medication: Metformin 500mg
📅 Refills Left: 1
🔔 Due Date: March 20, 2024

Request Refill: https://cvraman.health/refill/xyz789
```

### 3. Lab Test Reminders
```
Lab Test Due:

Hello Farzan,

Your periodic HbA1c test is due.

🩺 Test: HbA1c (Diabetes Monitoring)
📅 Last Test: December 1, 2023
⏰ Due: March 1, 2024
📍 Location: Lab - Ground Floor

Schedule Test: https://cvraman.health/lab/schedule
View History: https://cvraman.health/lab/results
```

### 4. Follow-up Care Reminders
```
Follow-up Reminder:

Dear Farzan,

Based on your recent visit, a follow-up is recommended.

👨‍⚕️ With: Dr. Sharma (Cardiology)
📅 Recommended: Within 2 weeks
📋 Reason: Post-procedure check

Book Now: https://cvraman.health/apt/book?dr=sharma

Questions? Call: +91-XXX-XXX-XXXX
```

### 5. Health Screening Reminders
```
Annual Checkup Due:

Hi Farzan,

It's time for your annual health checkup!

📅 Last Checkup: March 2023
🩺 Tests Included:
   - Complete Blood Count
   - Lipid Panel
   - HbA1c
   - Blood Pressure Screening

Schedule Now: https://cvraman.health/annual-checkup

Stay healthy!
```

### 6. Form Completion Reminders
```
Pending Form Reminder:

Hello Farzan,

You have an incomplete health assessment form.

📋 Form: Pre-Surgical Assessment
⏰ Started: March 1, 2024
🔔 Status: 40% complete

Complete Form: https://cvraman.health/forms/submit/abc123

This form is required before your surgery on March 20.
```

---

## 🗄️ Database Schema

```sql
-- Reminder templates
CREATE TABLE reminder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    reminder_type VARCHAR(50) NOT NULL, -- 'appointment', 'medication', 'lab_test', 'follow_up', 'screening', 'form'
    
    -- Channel-specific content
    email_subject VARCHAR(500),
    email_body TEXT, -- HTML template
    sms_content VARCHAR(160), -- SMS character limit
    
    -- Variables supported (for dynamic content)
    supported_variables JSONB, -- {patient_name, appointment_date, provider_name, etc.}
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reminder schedules (when to send reminders)
CREATE TABLE reminder_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_type VARCHAR(50) NOT NULL,
    template_id UUID REFERENCES reminder_templates(id),
    
    -- Timing configuration
    send_before_hours INTEGER, -- e.g., 24 for "24 hours before"
    send_at_time TIME, -- Optional: specific time to send (e.g., 9:00 AM)
    
    -- Channels
    enable_email BOOLEAN DEFAULT TRUE,
    enable_sms BOOLEAN DEFAULT TRUE,
    
    -- Repeat settings (for medication reminders)
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly'
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reminder queue (pending reminders to be sent)
CREATE TABLE reminder_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES reminder_templates(id),
    schedule_id UUID REFERENCES reminder_schedules(id),
    
    -- Recipient
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    email_address VARCHAR(255),
    phone_number VARCHAR(20),
    
    -- Reminder context
    reminder_type VARCHAR(50) NOT NULL,
    related_resource_type VARCHAR(50), -- 'appointment', 'prescription', 'lab_order'
    related_resource_id UUID, -- ID of appointment, prescription, etc.
    
    -- Content (rendered from template with variables)
    rendered_email_subject VARCHAR(500),
    rendered_email_body TEXT,
    rendered_sms_content VARCHAR(160),
    personalization_data JSONB, -- Variables used for rendering
    
    -- Delivery scheduling
    scheduled_send_time TIMESTAMP NOT NULL,
    send_via_email BOOLEAN DEFAULT TRUE,
    send_via_sms BOOLEAN DEFAULT TRUE,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Engagement tracking
    email_opened_at TIMESTAMP,
    sms_clicked_at TIMESTAMP,
    action_taken VARCHAR(50), -- 'confirmed', 'rescheduled', 'cancelled'
    action_taken_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reminder delivery log
CREATE TABLE reminder_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID REFERENCES reminder_queue(id) ON DELETE CASCADE,
    
    -- Delivery details
    channel VARCHAR(20) NOT NULL, -- 'email', 'sms'
    delivery_status VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
    
    -- Provider details
    provider_name VARCHAR(100), -- 'Twilio', 'SendGrid', etc.
    provider_message_id VARCHAR(255), -- External provider's message ID
    provider_response JSONB,
    
    -- Metadata
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    error_message TEXT
);

-- Patient reminder preferences
CREATE TABLE patient_reminder_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Channel preferences
    enable_email_reminders BOOLEAN DEFAULT TRUE,
    enable_sms_reminders BOOLEAN DEFAULT TRUE,
    
    -- Reminder type preferences
    appointment_reminders BOOLEAN DEFAULT TRUE,
    medication_reminders BOOLEAN DEFAULT TRUE,
    lab_test_reminders BOOLEAN DEFAULT TRUE,
    follow_up_reminders BOOLEAN DEFAULT TRUE,
    screening_reminders BOOLEAN DEFAULT TRUE,
    
    -- Timing preferences
    preferred_time_start TIME DEFAULT '09:00:00',
    preferred_time_end TIME DEFAULT '18:00:00',
    
    -- Quiet hours (no reminders)
    do_not_disturb_start TIME,
    do_not_disturb_end TIME,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_reminder_queue_scheduled_time ON reminder_queue(scheduled_send_time) WHERE status = 'pending';
CREATE INDEX idx_reminder_queue_patient ON reminder_queue(patient_id);
CREATE INDEX idx_reminder_queue_status ON reminder_queue(status);
CREATE INDEX idx_reminder_delivery_log_queue ON reminder_delivery_log(queue_id);
```

---

## 🔌 API Endpoints

### For Admins

**GET /api/reminders/templates**
```javascript
Response:
{
  templates: [
    {
      id: "uuid",
      name: "Appointment Reminder - 24h",
      reminder_type: "appointment",
      email_subject: "Appointment Reminder - {{appointment_date}}",
      sms_content: "Appt: {{date}} {{time}} with {{provider}}...",
      is_active: true
    }
  ]
}
```

**POST /api/reminders/templates**
```javascript
Request:
{
  name: "Custom Appointment Reminder",
  reminder_type: "appointment",
  email_subject: "Don't forget your appointment!",
  email_body: "<html>...</html>",
  sms_content: "Reminder: {{date}} {{time}} at {{location}}",
  supported_variables: ["date", "time", "provider", "location"]
}

Response:
{
  template_id: "uuid",
  message: "Template created successfully"
}
```

**GET /api/reminders/stats**
```javascript
Response:
{
  summary: {
    total_sent_last_30d: 1234,
    delivery_rate: 98.5,
    open_rate_email: 45.2,
    click_rate_sms: 23.1,
    appointment_confirmation_rate: 67.8
  },
  by_type: [
    {
      type: "appointment",
      sent: 856,
      delivered: 843,
      opened: 389,
      action_taken: 581
    }
  ]
}
```

### For System (Background Workers)

**GET /api/reminders/queue/pending**
```javascript
Query: ?due_before=2024-03-01T10:00:00Z&limit=100

Response:
{
  reminders: [
    {
      id: "uuid",
      patient_id: "uuid",
      email: "patient@email.com",
      phone: "+91-9876543210",
      reminder_type: "appointment",
      scheduled_send_time: "2024-03-01T09:00:00Z",
      rendered_email_subject: "Appointment Reminder - March 15",
      rendered_email_body: "<html>...</html>",
      rendered_sms_content: "Appt: Mar 15 10AM Dr.Sharma",
      send_via_email: true,
      send_via_sms: true
    }
  ]
}
```

**POST /api/reminders/queue/:id/mark-sent**
```javascript
Request:
{
  channel: "email",
  provider_message_id: "msg_abc123",
  sent_at: "2024-03-01T09:00:15Z"
}

Response:
{
  message: "Reminder marked as sent"
}
```

---

## 🔧 Backend Implementation

### Reminder Service
```python
# backend/app/reminders/services.py
from datetime import datetime, timedelta
from app.models import ReminderQueue, Patient, PatientAppointment
from app.extensions import db
from app.services.email_service import send_email
from app.services.sms_service import send_sms

class ReminderService:
    
    @staticmethod
    def schedule_appointment_reminder(appointment_id, hours_before=24):
        """Schedule a reminder for an appointment"""
        from app.models import PatientAppointment, ReminderTemplate
        
        appointment = PatientAppointment.query.get(appointment_id)
        if not appointment:
            raise ValueError("Appointment not found")
        
        # Get patient
        patient = Patient.query.get(appointment.patient_id)
        if not patient:
            return
        
        # Get patient preferences
        prefs = patient.reminder_preferences or {
            'enable_email_reminders': True,
            'enable_sms_reminders': True
        }
        
        # Get template
        template = ReminderTemplate.query.filter_by(
            reminder_type='appointment',
            is_active=True
        ).first()
        
        if not template:
            print("No active appointment reminder template found")
            return
        
        # Calculate send time
        appointment_datetime = datetime.combine(
            appointment.appointment_date,
            appointment.appointment_time
        )
        send_time = appointment_datetime - timedelta(hours=hours_before)
        
        # Don't schedule if send time is in the past
        if send_time <= datetime.utcnow():
            return
        
        # Render template with appointment data
        context = {
            'patient_name': patient.full_name.split()[0],  # First name
            'appointment_date': appointment.appointment_date.strftime('%B %d, %Y'),
            'appointment_time': appointment.appointment_time.strftime('%I:%M %p'),
            'provider_name': appointment.provider.full_name if appointment.provider else 'Your doctor',
            'location': 'OPD Block, 2nd Floor',  # Could be from appointment.location
            'confirm_link': f"https://cvraman.health/apt/confirm/{appointment.id}",
            'reschedule_link': f"https://cvraman.health/apt/reschedule/{appointment.id}"
        }
        
        email_subject = ReminderService._render_template(template.email_subject, context)
        email_body = ReminderService._render_template(template.email_body, context)
        sms_content = ReminderService._render_template(template.sms_content, context)
        
        # Create reminder queue entry
        reminder = ReminderQueue(
            template_id=template.id,
            patient_id=patient.id,
            email_address=patient.get_contact() if '@' in (patient.get_contact() or '') else None,
            phone_number=patient.get_contact() if '+' in (patient.get_contact() or '') else None,
            reminder_type='appointment',
            related_resource_type='appointment',
            related_resource_id=appointment.id,
            rendered_email_subject=email_subject,
            rendered_email_body=email_body,
            rendered_sms_content=sms_content,
            personalization_data=context,
            scheduled_send_time=send_time,
            send_via_email=prefs.get('enable_email_reminders', True),
            send_via_sms=prefs.get('enable_sms_reminders', True)
        )
        
        db.session.add(reminder)
        db.session.commit()
        
        return reminder
    
    @staticmethod
    def _render_template(template_string, context):
        """Simple template rendering (replace {{variable}} with values)"""
        result = template_string
        for key, value in context.items():
            result = result.replace(f'{{{{{key}}}}}', str(value))
        return result
    
    @staticmethod
    def process_pending_reminders():
        """Background job to send pending reminders"""
        from app.models import ReminderQueue, ReminderDeliveryLog
        
        # Get reminders due to be sent
        now = datetime.utcnow()
        pending_reminders = ReminderQueue.query.filter(
            ReminderQueue.status == 'pending',
            ReminderQueue.scheduled_send_time <= now
        ).limit(100).all()
        
        for reminder in pending_reminders:
            try:
                # Send email
                if reminder.send_via_email and reminder.email_address:
                    email_result = send_email(
                        to=reminder.email_address,
                        subject=reminder.rendered_email_subject,
                        html_content=reminder.rendered_email_body
                    )
                    
                    # Log delivery
                    log = ReminderDeliveryLog(
                        queue_id=reminder.id,
                        channel='email',
                        delivery_status='sent' if email_result.get('success') else 'failed',
                        provider_name='SendGrid',
                        provider_message_id=email_result.get('message_id'),
                        provider_response=email_result,
                        sent_at=datetime.utcnow(),
                        error_message=email_result.get('error')
                    )
                    db.session.add(log)
                
                # Send SMS
                if reminder.send_via_sms and reminder.phone_number:
                    sms_result = send_sms(
                        to=reminder.phone_number,
                        message=reminder.rendered_sms_content
                    )
                    
                    # Log delivery
                    log = ReminderDeliveryLog(
                        queue_id=reminder.id,
                        channel='sms',
                        delivery_status='sent' if sms_result.get('success') else 'failed',
                        provider_name='Twilio',
                        provider_message_id=sms_result.get('sid'),
                        provider_response=sms_result,
                        sent_at=datetime.utcnow(),
                        error_message=sms_result.get('error')
                    )
                    db.session.add(log)
                
                # Update reminder status
                reminder.status = 'sent'
                reminder.sent_at = datetime.utcnow()
                
            except Exception as e:
                reminder.retry_count += 1
                if reminder.retry_count >= reminder.max_retries:
                    reminder.status = 'failed'
                    reminder.failed_reason = str(e)
                print(f"Error sending reminder {reminder.id}: {e}")
            
            db.session.commit()
        
        return len(pending_reminders)
```

### Background Worker (Celery Task)
```python
# backend/app/tasks/reminders.py
from celery import Celery
from app.reminders.services import ReminderService

celery = Celery('reminders')

@celery.task
def process_reminders():
    """Celery task to process pending reminders"""
    count = ReminderService.process_pending_reminders()
    print(f"Processed {count} reminders")
    return count

# Schedule this task to run every 5 minutes
celery.conf.beat_schedule = {
    'process-reminders': {
        'task': 'app.tasks.reminders.process_reminders',
        'schedule': 300.0,  # 5 minutes
    },
}
```

---

## 📊 Admin Dashboard

```
Reminders Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERVIEW (Last 30 Days)
┌────────────────────────────────────────────────┐
│ 📨 Total Sent     ✅ Delivered    📧 Opened   │
│    1,234             1,215 (98.5%)   551 (45%)│
│                                                │
│ 📱 SMS Sent       ✅ Delivered    🔗 Clicked  │
│    856               843 (98.5%)    198 (23%) │
└────────────────────────────────────────────────┘

PERFORMANCE BY TYPE
┌────────────────────────────────────────────────┐
│ Type           Sent  Delivered  Action Rate   │
├────────────────────────────────────────────────┤
│ Appointments   856   843 (98%)   581 (68%)    │
│ Medications    234   231 (99%)   189 (82%)    │
│ Lab Tests      89    88 (99%)    67 (76%)     │
│ Follow-ups     55    53 (96%)    34 (64%)     │
└────────────────────────────────────────────────┘

TEMPLATES
[+ Create Template]

┌────────────────────────────────────────────────┐
│ Appointment Reminder - 24h                     │
│ Status: Active  |  Last Used: 2 hours ago     │
│ [Edit] [Preview] [Deactivate]                 │
├────────────────────────────────────────────────┤
│ Medication Reminder - Daily                    │
│ Status: Active  |  Last Used: 5 minutes ago   │
│ [Edit] [Preview] [Deactivate]                 │
└────────────────────────────────────────────────┘

UPCOMING REMINDERS (Next 24 Hours)
┌────────────────────────────────────────────────┐
│ 234 reminders scheduled                        │
│ - 156 appointment reminders                    │
│ - 67 medication reminders                      │
│ - 11 lab test reminders                        │
│                                                │
│ [View Queue]                                   │
└────────────────────────────────────────────────┘
```

---

## 🔒 Security & Compliance

### Consent & Opt-Out
- **Opt-in Required**: Patients must explicitly consent to reminders
- **Easy Opt-Out**: Every message includes "Reply STOP to unsubscribe"
- **Preference Management**: Patients can choose channels and types

### Data Privacy
- **No PHI in SMS**: Avoid detailed medical info in SMS (use generic terms)
- **Secure Links**: Use short, secure links with expiration
- **Encryption**: All patient data encrypted in transit and at rest

---

## 📅 Implementation Timeline

### Week 1: Database & Templates
- Database schema
- Template management UI
- Admin dashboard

### Week 2: Core Reminder Logic
- Reminder scheduling service
- Template rendering engine
- Queue management

### Week 3: Integration & Testing
- Email/SMS provider integration
- Background worker setup
- Testing with real providers

---

## ✅ Acceptance Criteria

- [ ] Appointment reminders sent 24h before
- [ ] SMS character limit enforced (160 chars)
- [ ] Email delivery rate > 95%
- [ ] SMS delivery rate > 95%
- [ ] Patients can opt-out easily
- [ ] Admin can view delivery stats
- [ ] Background worker processes queue every 5 minutes

---

## 🚀 Future Enhancements

- **Smart Timing**: ML to determine best send time per patient
- **A/B Testing**: Test different message templates
- **Multi-language**: Send in patient's preferred language
- **Voice Calls**: IVR reminders for critical appointments
- **WhatsApp**: Reminders via WhatsApp Business API
