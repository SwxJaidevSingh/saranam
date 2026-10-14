"""Notification services — Gmail SMTP (Email) + MSG91 (SMS) + iCal."""
import smtplib
import logging
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from uuid import uuid4

import requests
import pytz

logger = logging.getLogger(__name__)
IST = pytz.timezone('Asia/Kolkata')


class EmailService:
    """Send emails via Gmail SMTP."""

    @staticmethod
    def send(to_email, subject, body_html, settings, ics_content=None, recipients=None):
        """
        Send an email, optionally with .ics calendar invite.

        Args:
            to_email: Primary recipient email (or comma-separated list)
            subject: Email subject
            body_html: HTML email body
            settings: dict with smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_name
            ics_content: Optional .ics calendar string to attach
            recipients: Optional list of all recipient emails (for multi-send)
        """
        host = settings.get('smtp_host', 'smtp.gmail.com')
        port = int(settings.get('smtp_port', 587))
        username = settings.get('smtp_username')
        password = settings.get('smtp_password')
        from_name = settings.get('smtp_from_name', 'CV Raman Health')

        if not username or not password:
            return {'success': False, 'error': 'SMTP credentials not configured'}

        all_recipients = recipients or [to_email]

        try:
            msg = MIMEMultipart('mixed')
            msg['Subject'] = subject
            msg['From'] = f'{from_name} <{username}>'
            msg['To'] = to_email

            # HTML + plain text part
            body_part = MIMEMultipart('alternative')
            plain = re.sub(r'<[^>]+>', '', body_html.replace('<br>', '\n').replace('</p>', '\n'))
            body_part.attach(MIMEText(plain, 'plain'))
            body_part.attach(MIMEText(body_html, 'html'))
            msg.attach(body_part)

            # Attach .ics calendar invite if provided
            if ics_content:
                # Method 1: as text/calendar inline (Gmail shows Yes/No/Maybe)
                cal_part = MIMEText(ics_content, 'calendar', 'utf-8')
                cal_part.add_header('Content-Disposition', 'inline', filename='invite.ics')
                msg.attach(cal_part)

                # Method 2: as attachment fallback
                att = MIMEBase('application', 'ics')
                att.set_payload(ics_content.encode('utf-8'))
                encoders.encode_base64(att)
                att.add_header('Content-Disposition', 'attachment', filename='appointment.ics')
                msg.attach(att)

            with smtplib.SMTP(host, port, timeout=10) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(username, all_recipients, msg.as_string())

            logger.info(f'Email sent to {all_recipients}: {subject}')
            return {'success': True}

        except Exception as e:
            logger.error(f'Email failed to {to_email}: {e}')
            return {'success': False, 'error': str(e)}


class SMSService:
    """Send SMS via MSG91 REST API."""

    BASE_URL = 'https://control.msg91.com/api/v5/flow/'

    @staticmethod
    def send(phone_number, template_id, variables, settings):
        """
        Send SMS via MSG91 Flow API.

        Args:
            phone_number: Indian mobile number (10 digits, will be prefixed with 91)
            template_id: MSG91 DLT-registered template ID
            variables: dict of template variables e.g. {"patient_name": "John", "date": "20 Mar"}
            settings: dict with msg91_auth_key, msg91_sender_id
        """
        auth_key = settings.get('msg91_auth_key')
        if not auth_key:
            return {'success': False, 'error': 'MSG91 auth key not configured'}

        # Normalize phone: remove +, ensure 91 prefix
        phone = str(phone_number).replace('+', '').replace(' ', '').replace('-', '')
        if len(phone) == 10:
            phone = '91' + phone
        elif not phone.startswith('91'):
            phone = '91' + phone

        try:
            payload = {
                'template_id': template_id,
                'short_url': '0',
                'recipients': [
                    {
                        'mobiles': phone,
                        **{k: str(v) for k, v in variables.items()}
                    }
                ]
            }

            headers = {
                'authkey': auth_key,
                'Content-Type': 'application/json',
            }

            resp = requests.post(SMSService.BASE_URL, json=payload, headers=headers, timeout=10)
            data = resp.json()

            if resp.status_code == 200 and data.get('type') == 'success':
                logger.info(f'SMS sent to {phone}: template={template_id}')
                return {'success': True, 'request_id': data.get('request_id')}
            else:
                error = data.get('message', str(data))
                logger.error(f'SMS failed to {phone}: {error}')
                return {'success': False, 'error': error}

        except Exception as e:
            logger.error(f'SMS failed to {phone}: {e}')
            return {'success': False, 'error': str(e)}


class CalendarService:
    """Generate iCalendar (.ics) files for appointment invites."""

    @staticmethod
    def generate_ics(
        summary,
        start_dt,
        end_dt,
        description='',
        location='CV Raman Health Care',
        organizer_email='',
        attendee_emails=None,
        uid=None,
    ):
        """
        Generate an .ics calendar event string.

        Args:
            summary: Event title
            start_dt: datetime (timezone-aware or naive IST)
            end_dt: datetime
            description: Event description
            location: Event location
            organizer_email: Organizer's email
            attendee_emails: List of attendee emails
            uid: Unique event ID (auto-generated if None)
        """
        if uid is None:
            uid = f'{uuid4()}@cvraman.health'

        # Ensure UTC for iCal
        if start_dt.tzinfo is None:
            start_dt = IST.localize(start_dt)
        if end_dt.tzinfo is None:
            end_dt = IST.localize(end_dt)

        start_utc = start_dt.astimezone(pytz.utc)
        end_utc = end_dt.astimezone(pytz.utc)

        def fmt(dt):
            return dt.strftime('%Y%m%dT%H%M%SZ')

        lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CV Raman Health//Appointment System//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:REQUEST',
            'BEGIN:VEVENT',
            f'UID:{uid}',
            f'DTSTART:{fmt(start_utc)}',
            f'DTEND:{fmt(end_utc)}',
            f'DTSTAMP:{fmt(datetime.utcnow())}',
            f'SUMMARY:{summary}',
            f'DESCRIPTION:{description}',
            f'LOCATION:{location}',
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            # 30 min reminder
            'BEGIN:VALARM',
            'TRIGGER:-PT30M',
            'ACTION:DISPLAY',
            'DESCRIPTION:Appointment Reminder',
            'END:VALARM',
            # 2 hour reminder
            'BEGIN:VALARM',
            'TRIGGER:-PT2H',
            'ACTION:DISPLAY',
            'DESCRIPTION:Appointment in 2 hours',
            'END:VALARM',
        ]

        if organizer_email:
            lines.append(f'ORGANIZER;CN=CV Raman Health:mailto:{organizer_email}')

        for email in (attendee_emails or []):
            lines.append(f'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:{email}')

        lines.extend([
            'END:VEVENT',
            'END:VCALENDAR',
        ])

        return '\r\n'.join(lines)


class BookingNotificationService:
    """Send booking confirmation email with Google Calendar invite."""

    @staticmethod
    def send_booking_confirmation(
        patient_name,
        patient_email,
        provider_name,
        provider_email,
        appointment_date,
        appointment_time,
        start_dt,
        duration_minutes=30,
        chief_complaint='',
        clinic_name='CV Raman Health Care',
        settings=None,
        patient_phone=None,
        patient_address=None,
    ):
        """
        Send separate appointment emails to patient (blue) and provider (green).
        """
        if not settings:
            from app.reminders.scheduler import get_settings
            settings = get_settings()

        end_dt = start_dt + timedelta(minutes=duration_minutes)
        organizer = settings.get('smtp_username', '')
        attendees = [e for e in [patient_email, provider_email] if e]

        summary = f'Appointment — {patient_name} with {provider_name}'
        description = f'Patient: {patient_name}\\nDoctor: {provider_name}\\nChief Complaint: {chief_complaint}'

        ics = CalendarService.generate_ics(
            summary=summary,
            start_dt=start_dt,
            end_dt=end_dt,
            description=description,
            location=clinic_name,
            organizer_email=organizer,
            attendee_emails=attendees,
        )

        def _table_row(label, value):
            if not value:
                return ''
            return f'<tr><td style="padding: 10px 12px; color: #666; border-bottom: 1px solid #f3f4f6; width: 120px;">{label}</td><td style="padding: 10px 12px; font-weight: 600; border-bottom: 1px solid #f3f4f6;">{value}</td></tr>'

        results = {}

        # ── Patient Email (Blue theme) ──
        if patient_email:
            patient_body = f"""
            <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
                    <h2 style="margin: 0; font-size: 20px;">Your Appointment is Confirmed</h2>
                    <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">{clinic_name}</p>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #fff;">
                    <p style="color: #374151; margin: 0 0 16px;">Dear <strong>{patient_name}</strong>,</p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">Your appointment has been scheduled. Please arrive 15 minutes early.</p>
                    <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px; background: #f9fafb; border-radius: 8px; overflow: hidden;">
                        {_table_row('Doctor', provider_name)}
                        {_table_row('Date', appointment_date)}
                        {_table_row('Time', appointment_time)}
                        {_table_row('Concern', chief_complaint)}
                    </table>
                    <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0; text-align: center;">— {clinic_name}</p>
                </div>
            </div>
            """
            result = EmailService.send(
                to_email=patient_email,
                subject=f'Appointment Confirmed — {appointment_date} at {appointment_time}',
                body_html=patient_body,
                settings=settings,
                ics_content=ics,
            )
            results[patient_email] = result

        # ── Provider Email (Green theme) ──
        if provider_email:
            location_row = ''
            if patient_address:
                location_row = _table_row('Patient Address', patient_address)

            provider_body = f"""
            <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
                    <h2 style="margin: 0; font-size: 20px;">New Patient Appointment</h2>
                    <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">{clinic_name}</p>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #fff;">
                    <p style="color: #374151; margin: 0 0 16px;">Dear <strong>{provider_name}</strong>,</p>
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">A new appointment has been scheduled for you.</p>
                    <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px; background: #f0fdf4; border-radius: 8px; overflow: hidden;">
                        {_table_row('Patient', patient_name)}
                        {_table_row('Phone', patient_phone or '—')}
                        {_table_row('Date', appointment_date)}
                        {_table_row('Time', appointment_time)}
                        {_table_row('Chief Complaint', chief_complaint)}
                        {location_row}
                    </table>
                    <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0; text-align: center;">— {clinic_name}</p>
                </div>
            </div>
            """
            result = EmailService.send(
                to_email=provider_email,
                subject=f'New Appointment — {patient_name} on {appointment_date} at {appointment_time}',
                body_html=provider_body,
                settings=settings,
                ics_content=ics,
            )
            results[provider_email] = result

        return results


class ReminderTemplates:
    """Email and SMS templates for reminders."""

    @staticmethod
    def email_24h(patient_name, doctor_name, appointment_date, appointment_time, clinic_name='CV Raman Health'):
        subject = f'Appointment Reminder — Tomorrow at {appointment_time}'
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Appointment Reminder</h2>
            <p>Dear <strong>{patient_name}</strong>,</p>
            <p>This is a reminder that you have an appointment scheduled for <strong>tomorrow</strong>.</p>
            <table style="border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; color: #666;">Date:</td><td style="padding: 8px; font-weight: bold;">{appointment_date}</td></tr>
                <tr><td style="padding: 8px; color: #666;">Time:</td><td style="padding: 8px; font-weight: bold;">{appointment_time}</td></tr>
                <tr><td style="padding: 8px; color: #666;">Doctor:</td><td style="padding: 8px; font-weight: bold;">{doctor_name}</td></tr>
            </table>
            <p>Please arrive 15 minutes before your scheduled time.</p>
            <p style="color: #666; font-size: 12px;">— {clinic_name}</p>
        </div>
        """
        return subject, body

    @staticmethod
    def email_2h(patient_name, doctor_name, appointment_time, clinic_name='CV Raman Health'):
        subject = f'Appointment in 2 hours — {appointment_time}'
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Appointment Coming Up</h2>
            <p>Dear <strong>{patient_name}</strong>,</p>
            <p>Your appointment is in <strong>2 hours</strong> at <strong>{appointment_time}</strong> with <strong>{doctor_name}</strong>.</p>
            <p>Please make sure you are on your way to the clinic.</p>
            <p style="color: #666; font-size: 12px;">— {clinic_name}</p>
        </div>
        """
        return subject, body

    @staticmethod
    def sms_variables_24h(patient_name, doctor_name, appointment_date, appointment_time):
        """Variables for MSG91 DLT template (24h reminder)."""
        return {
            'patient_name': patient_name,
            'doctor_name': doctor_name,
            'date': appointment_date,
            'time': appointment_time,
        }

    @staticmethod
    def sms_variables_2h(patient_name, doctor_name, appointment_time):
        """Variables for MSG91 DLT template (2h reminder)."""
        return {
            'patient_name': patient_name,
            'doctor_name': doctor_name,
            'time': appointment_time,
        }
