"""APScheduler integration — periodic reminder checking."""
import logging
import json
from datetime import datetime, timedelta
from uuid import uuid4

import pytz
from apscheduler.schedulers.background import BackgroundScheduler

from app.extensions import db
from app.encounters.models import Encounter
from app.patients.models import Patient
from app.reminders.models import SystemSetting, ReminderLog
from app.reminders.notification_service import EmailService, SMSService, ReminderTemplates

logger = logging.getLogger(__name__)

IST = pytz.timezone('Asia/Kolkata')

scheduler = BackgroundScheduler(daemon=True)


def get_settings():
    """Load all reminder-related settings from DB, fallback to env."""
    import os
    settings = {}
    try:
        rows = db.session.query(SystemSetting).all()
        for row in rows:
            settings[row.key] = row.value
    except Exception:
        pass  # DB not ready yet

    # Fallback to environment variables
    env_map = {
        'smtp_host': 'SMTP_HOST',
        'smtp_port': 'SMTP_PORT',
        'smtp_username': 'SMTP_USERNAME',
        'smtp_password': 'SMTP_PASSWORD',
        'smtp_from_name': 'SMTP_FROM_NAME',
        'msg91_auth_key': 'MSG91_AUTH_KEY',
        'msg91_sender_id': 'MSG91_SENDER_ID',
        'msg91_24h_template_id': 'MSG91_24H_TEMPLATE_ID',
        'msg91_2h_template_id': 'MSG91_2H_TEMPLATE_ID',
        'reminder_enabled': 'REMINDER_ENABLED',
    }
    for key, env_key in env_map.items():
        if key not in settings or not settings[key]:
            settings[key] = os.environ.get(env_key, '')

    return settings


def _already_sent(encounter_id, reminder_type, channel):
    """Check if a specific reminder was already sent."""
    return db.session.query(ReminderLog).filter(
        ReminderLog.encounter_id == encounter_id,
        ReminderLog.reminder_type == reminder_type,
        ReminderLog.channel == channel,
        ReminderLog.status == 'sent'
    ).first() is not None


def _log_reminder(encounter_id, reminder_type, channel, status, recipient='', error_message=None):
    """Write a reminder log entry."""
    log = ReminderLog(
        id=uuid4(),
        encounter_id=encounter_id,
        reminder_type=reminder_type,
        channel=channel,
        status=status,
        recipient=recipient,
        error_message=error_message,
        sent_at=datetime.utcnow() if status == 'sent' else None
    )
    db.session.add(log)
    db.session.commit()


def _get_patient_contact(patient):
    """Get phone and email from patient's encrypted contact."""
    try:
        raw = patient.get_contact()
        if not raw:
            return None, None
        # Try JSON first: {"phone": "...", "email": "..."}
        try:
            data = json.loads(raw)
            return data.get('phone'), data.get('email')
        except (json.JSONDecodeError, TypeError):
            # Legacy: plain phone number string
            if '@' in raw:
                return None, raw
            return raw, None
    except Exception:
        return None, None


def _mask(value):
    """Mask phone/email for audit logging."""
    if not value:
        return ''
    if '@' in value:
        parts = value.split('@')
        return parts[0][:2] + '***@' + parts[1]
    return value[:3] + '****' + value[-2:] if len(value) > 5 else '***'


def check_and_send_reminders(app):
    """Main scheduler job: scan upcoming appointments and send reminders."""
    with app.app_context():
        settings = get_settings()

        if settings.get('reminder_enabled', '').lower() != 'true':
            return

        now_utc = datetime.utcnow()
        now_ist = pytz.utc.localize(now_utc).astimezone(IST)

        # Find appointments in the next 25 hours that are still scheduled
        window_end = now_utc + timedelta(hours=25)
        upcoming = db.session.query(Encounter).filter(
            Encounter.status.in_(['scheduled', 'confirmed']),
            Encounter.encounter_type == 'OPD',
            Encounter.start_time >= now_utc,
            Encounter.start_time <= window_end
        ).all()

        for encounter in upcoming:
            try:
                _process_encounter(encounter, now_utc, settings)
            except Exception as e:
                logger.error(f'Reminder error for encounter {encounter.id}: {e}')


def _process_encounter(encounter, now_utc, settings):
    """Process a single encounter for pending reminders."""
    start = encounter.start_time
    if start.tzinfo is None:
        # Assume stored as IST (naive), convert to UTC-aware for comparison
        start_ist = IST.localize(start)
    else:
        start_ist = start.astimezone(IST)

    start_utc = start_ist.astimezone(pytz.utc).replace(tzinfo=None)
    hours_until = (start_utc - now_utc).total_seconds() / 3600

    # Determine which reminders are due
    reminders_due = []
    if hours_until <= 24 and not _already_sent(encounter.id, '24h', 'email'):
        reminders_due.append(('24h', 'email'))
    if hours_until <= 24 and not _already_sent(encounter.id, '24h', 'sms'):
        reminders_due.append(('24h', 'sms'))
    if hours_until <= 2 and not _already_sent(encounter.id, '2h', 'email'):
        reminders_due.append(('2h', 'email'))
    if hours_until <= 2 and not _already_sent(encounter.id, '2h', 'sms'):
        reminders_due.append(('2h', 'sms'))

    if not reminders_due:
        return

    # Get patient contact
    patient = encounter.patient
    if not patient:
        patient = db.session.query(Patient).filter(Patient.id == encounter.patient_id).first()
    if not patient:
        return

    phone, email = _get_patient_contact(patient)
    patient_name = patient.full_name or 'Patient'

    # Get provider name
    provider_name = 'Doctor'
    if encounter.provider:
        provider_name = encounter.provider.full_name or 'Doctor'

    # Format date/time in IST
    appt_date = start_ist.strftime('%d %b %Y')
    appt_time = start_ist.strftime('%I:%M %p')

    for rtype, channel in reminders_due:
        if channel == 'email':
            if not email:
                _log_reminder(encounter.id, rtype, channel, 'skipped', error_message='No email on file')
                continue
            if rtype == '24h':
                subject, body = ReminderTemplates.email_24h(patient_name, provider_name, appt_date, appt_time)
            else:
                subject, body = ReminderTemplates.email_2h(patient_name, provider_name, appt_time)
            result = EmailService.send(email, subject, body, settings)
            _log_reminder(
                encounter.id, rtype, channel,
                'sent' if result['success'] else 'failed',
                recipient=_mask(email),
                error_message=result.get('error')
            )

        elif channel == 'sms':
            if not phone:
                _log_reminder(encounter.id, rtype, channel, 'skipped', error_message='No phone on file')
                continue
            template_key = f'msg91_{rtype}_template_id'
            template_id = settings.get(template_key)
            if not template_id:
                _log_reminder(encounter.id, rtype, channel, 'skipped', error_message=f'No MSG91 template for {rtype}')
                continue
            if rtype == '24h':
                variables = ReminderTemplates.sms_variables_24h(patient_name, provider_name, appt_date, appt_time)
            else:
                variables = ReminderTemplates.sms_variables_2h(patient_name, provider_name, appt_time)
            result = SMSService.send(phone, template_id, variables, settings)
            _log_reminder(
                encounter.id, rtype, channel,
                'sent' if result['success'] else 'failed',
                recipient=_mask(phone),
                error_message=result.get('error')
            )

    # Check if all reminders done → mark encounter
    all_24h = _already_sent(encounter.id, '24h', 'email') or not email
    all_2h = _already_sent(encounter.id, '2h', 'email') or not email
    if all_24h and all_2h:
        encounter.reminder_sent = True
        db.session.commit()


def init_scheduler(app):
    """Initialize APScheduler with the Flask app."""
    import os
    enabled = os.environ.get('SCHEDULER_ENABLED', 'false').lower() == 'true'
    interval = int(os.environ.get('REMINDER_CHECK_INTERVAL_MINUTES', '15'))

    if not enabled:
        logger.info('Reminder scheduler disabled (SCHEDULER_ENABLED != true)')
        return

    scheduler.add_job(
        func=check_and_send_reminders,
        trigger='interval',
        minutes=interval,
        args=[app],
        id='reminder_check',
        name='Check and send appointment reminders',
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info(f'Reminder scheduler started (every {interval} minutes)')
