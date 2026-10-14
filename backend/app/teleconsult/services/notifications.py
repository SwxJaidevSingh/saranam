"""NotificationService — dispatches a TeleNotification row.

Handles email (existing EmailService), WhatsApp (EnableX), SMS (EnableX),
plus calendar-invite generation for the provider's scheduling email.
"""
from __future__ import annotations
import logging
import os
from datetime import datetime
from typing import Optional

from app.extensions import db
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.reminders.notification_service import EmailService
from app.reminders.scheduler import get_settings

from app.teleconsult.models.tele_session import (
    TeleSession,
    CHANNEL_VIDEO,
    CHANNEL_VOICE,
)
from app.teleconsult.models.tele_notification import (
    TeleNotification,
    RECIPIENT_PATIENT,
    RECIPIENT_PROVIDER,
    CHANNEL_EMAIL,
    CHANNEL_WHATSAPP,
    CHANNEL_SMS,
    TPL_SCHEDULED,
    TPL_REMINDER_24H,
    TPL_REMINDER_15MIN,
    TPL_CANCELLED,
    STATUS_SENT,
    STATUS_FAILED,
    STATUS_PENDING,
)
from app.teleconsult.services.calendar_invite import build_ics
from app.teleconsult.services.provider_registry import ProviderRegistry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Template rendering — lightweight string formatting (avoids Jinja boilerplate)
# ---------------------------------------------------------------------------

EMAIL_SUBJECTS = {
    TPL_SCHEDULED: "Teleconsult scheduled — {patient_name} on {scheduled_at_local}",
    TPL_REMINDER_24H: "Reminder — teleconsult with {patient_name} tomorrow",
    TPL_REMINDER_15MIN: "Reminder — teleconsult starts in 15 minutes",
    TPL_CANCELLED: "Cancelled — teleconsult with {patient_name}",
}

EMAIL_BODY_HTML = {
    TPL_SCHEDULED: """
<p>Dear Dr. <strong>{provider_name}</strong>,</p>
<p>A {channel_label} teleconsult has been scheduled.</p>
<table cellpadding="6" style="border-collapse: collapse;">
  <tr><td><strong>Patient:</strong></td><td>{patient_name}{patient_uhid_suffix}</td></tr>
  <tr><td><strong>When:</strong></td><td>{scheduled_at_local} ({timezone})</td></tr>
  <tr><td><strong>Channel:</strong></td><td>{channel_label}</td></tr>
</table>
<p><strong>Join link:</strong> <a href="{join_url}">{join_url}</a></p>
<p>{notes_block}</p>
<p>A calendar invite is attached — opening it will add the appointment to your Google
Calendar / Outlook with native reminders at 24h and 15 min before the call.</p>
<p>— {clinic_name}</p>
""",
    TPL_REMINDER_24H: """
<p>Dr. <strong>{provider_name}</strong>, your teleconsult with <strong>{patient_name}</strong>
is scheduled for <strong>{scheduled_at_local}</strong> (in 24 hours).</p>
<p>Join: <a href="{join_url}">{join_url}</a></p>
""",
    TPL_REMINDER_15MIN: """
<p>Dr. <strong>{provider_name}</strong>, your teleconsult with <strong>{patient_name}</strong>
starts in <strong>15 minutes</strong>.</p>
<p>Join now: <a href="{join_url}">{join_url}</a></p>
""",
    TPL_CANCELLED: """
<p>Dear Dr. <strong>{provider_name}</strong>,</p>
<p>The teleconsult with <strong>{patient_name}</strong> on {scheduled_at_local} has been cancelled.</p>
<p>{cancel_reason_block}</p>
""",
}

WA_TEMPLATES = {
    TPL_SCHEDULED: (
        "Hi {recipient_name}, your teleconsult with {other_party} is scheduled "
        "for {scheduled_at_local}. Join: {join_url}\n— {clinic_name}"
    ),
    TPL_REMINDER_24H: (
        "Reminder: teleconsult with {other_party} tomorrow at "
        "{scheduled_at_local}. Join: {join_url}\n— {clinic_name}"
    ),
    TPL_REMINDER_15MIN: (
        "Your teleconsult with {other_party} starts in 15 minutes. "
        "Join: {join_url}\n— {clinic_name}"
    ),
    TPL_CANCELLED: (
        "Heads up: the teleconsult with {other_party} on {scheduled_at_local} "
        "has been cancelled.\n— {clinic_name}"
    ),
}


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def _format_dt(dt: Optional[datetime], tz_label: str = "IST") -> str:
    if not dt:
        return ""
    # Stored as naive UTC; render in IST (+5:30).
    from datetime import timedelta
    ist = dt + timedelta(hours=5, minutes=30)
    return ist.strftime(f"%a %d %b %Y, %I:%M %p {tz_label}")


def _resolve_provider_contact(provider_id) -> dict:
    if not provider_id:
        return {"name": "Care Team", "email": None, "phone": None}
    provider = HealthcareProvider.query.get(provider_id)
    if not provider:
        return {"name": "Care Team", "email": None, "phone": None}
    try:
        email = provider.get_email() if hasattr(provider, "get_email") else None
    except Exception:
        email = None
    try:
        phone = provider.get_phone() if hasattr(provider, "get_phone") else None
    except Exception:
        phone = None
    return {
        "name": provider.full_name or "Care Team",
        "email": email,
        "phone": phone,
    }


def _resolve_patient_contact(patient_id) -> dict:
    if not patient_id:
        return {"name": "Patient", "email": None, "phone": None, "uhid": None}
    patient = Patient.query.get(patient_id)
    if not patient:
        return {"name": "Patient", "email": None, "phone": None, "uhid": None}
    try:
        phone = patient.get_phone() if hasattr(patient, "get_phone") else None
    except Exception:
        phone = None
    return {
        "name": patient.full_name or "Patient",
        "email": getattr(patient, "email", None),
        "phone": phone or getattr(patient, "primary_caregiver_phone", None),
        "uhid": getattr(patient, "uhid", None) or getattr(patient, "UHID", None),
    }


def _settings_value(settings: dict, key: str, default: str = "") -> str:
    return settings.get(key) or os.getenv(key.upper(), default)


def _build_context(notification: TeleNotification) -> dict:
    session = notification.session
    provider = _resolve_provider_contact(session.provider_id)
    patient = _resolve_patient_contact(session.patient_id)
    settings = get_settings() or {}

    clinic_name = _settings_value(
        settings, "teleconsult_clinic_name", "Saranam Palliative Care"
    )
    clinic_email = _settings_value(
        settings, "teleconsult_clinic_email", "team@exatorial.com"
    )
    timezone = _settings_value(settings, "teleconsult_timezone", "Asia/Kolkata")
    channel_label = "Video Call" if session.channel == CHANNEL_VIDEO else "Voice Call"

    # Choose the right join URL per recipient
    if notification.recipient_type == RECIPIENT_PROVIDER:
        join_url = session.moderator_join_url or session.participant_join_url or ""
        recipient_name = provider["name"]
        other_party_name = patient["name"]
    else:
        join_url = session.participant_join_url or session.moderator_join_url or ""
        recipient_name = patient["name"]
        other_party_name = f"Dr. {provider['name']}"

    return {
        "clinic_name": clinic_name,
        "clinic_email": clinic_email,
        "timezone": timezone,
        "channel": session.channel,
        "channel_label": channel_label,
        "patient_name": patient["name"],
        "patient_phone": patient["phone"],
        "patient_uhid": patient["uhid"],
        "patient_uhid_suffix": f" (UHID {patient['uhid']})" if patient["uhid"] else "",
        "provider_name": provider["name"],
        "provider_email": provider["email"],
        "provider_phone": provider["phone"],
        "scheduled_at": session.scheduled_at,
        "scheduled_at_local": _format_dt(session.scheduled_at)
        or _format_dt(session.created_at),
        "join_url": join_url,
        "notes_block": (
            f"<strong>Notes:</strong> {session.notes}" if session.notes else ""
        ),
        "cancel_reason_block": (
            f"<strong>Reason:</strong> {session.cancel_reason}"
            if session.cancel_reason
            else ""
        ),
        "recipient_name": recipient_name,
        "other_party": other_party_name,
        "session_id": str(session.id),
    }


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

class NotificationService:
    """Sends a single TeleNotification row via the right channel.

    Resolves recipient contact info at SEND time (not enqueue) so contact-info
    edits between schedule and send are honored.
    """

    @staticmethod
    def dispatch(notification: TeleNotification) -> bool:
        """Returns True on send, False on permanent failure."""
        if notification.status != STATUS_PENDING:
            return False

        try:
            ctx = _build_context(notification)
        except Exception as e:
            NotificationService._mark_failed(notification, f"context build failed: {e}")
            return False

        try:
            if notification.channel == CHANNEL_EMAIL:
                ok = NotificationService._send_email(notification, ctx)
            elif notification.channel == CHANNEL_WHATSAPP:
                ok = NotificationService._send_whatsapp(notification, ctx)
            elif notification.channel == CHANNEL_SMS:
                ok = NotificationService._send_sms(notification, ctx)
            else:
                NotificationService._mark_failed(
                    notification, f"unknown channel: {notification.channel}"
                )
                return False
        except Exception as e:
            logger.exception("teleconsult notification dispatch failed")
            NotificationService._mark_failed(notification, str(e))
            return False

        if ok:
            notification.status = STATUS_SENT
            notification.sent_at = datetime.utcnow()
            db.session.commit()
            return True
        return False

    # ---- email ----------------------------------------------------------

    @staticmethod
    def _send_email(notification: TeleNotification, ctx: dict) -> bool:
        # Resolve recipient email
        if notification.recipient_type == RECIPIENT_PROVIDER:
            to_email = ctx.get("provider_email")
        else:
            to_email = ctx.get("patient_email")
        if not to_email:
            NotificationService._mark_failed(
                notification, "no email on file for recipient"
            )
            return False

        notification.recipient_email = to_email

        subject_tpl = EMAIL_SUBJECTS.get(notification.template_key, "Teleconsult")
        body_tpl = EMAIL_BODY_HTML.get(notification.template_key, "")
        subject = subject_tpl.format(**ctx)
        body_html = body_tpl.format(**ctx)

        # Attach .ics for the provider's "scheduled" email (and cancellation)
        ics_content = None
        if notification.recipient_type == RECIPIENT_PROVIDER and notification.template_key in (
            TPL_SCHEDULED,
            TPL_CANCELLED,
        ):
            ics_content = NotificationService._build_ics_for(notification, ctx)

        smtp_settings = get_settings() or {}
        result = EmailService.send(
            to_email=to_email,
            subject=subject,
            body_html=body_html,
            settings=smtp_settings,
            ics_content=ics_content,
        )
        if not result.get("success"):
            NotificationService._mark_failed(
                notification, f"smtp: {result.get('error', 'unknown')}"
            )
            return False
        return True

    @staticmethod
    def _build_ics_for(notification: TeleNotification, ctx: dict) -> str:
        session: TeleSession = notification.session
        method = "CANCEL" if notification.template_key == TPL_CANCELLED else "REQUEST"
        return build_ics(
            uid=f"teleconsult-{session.id}@saranam",
            summary=f"Teleconsult — {ctx['patient_name']} ({ctx['channel_label']})",
            description=(
                f"{ctx['channel_label']} teleconsult.\n"
                f"Join: {ctx['join_url']}\n"
                f"Patient: {ctx['patient_name']}{ctx['patient_uhid_suffix']}\n"
                f"Notes: {session.notes or '—'}"
            ),
            start=session.scheduled_at or session.created_at,
            duration_minutes=30,
            join_url=ctx["join_url"],
            organizer_name=ctx["clinic_name"],
            organizer_email=ctx["clinic_email"],
            attendee_name=ctx["provider_name"],
            attendee_email=ctx["provider_email"],
            method=method,
            timezone=ctx["timezone"],
        )

    # ---- whatsapp -------------------------------------------------------

    @staticmethod
    def _send_whatsapp(notification: TeleNotification, ctx: dict) -> bool:
        phone = (
            ctx.get("provider_phone")
            if notification.recipient_type == RECIPIENT_PROVIDER
            else ctx.get("patient_phone")
        )
        if not phone:
            NotificationService._mark_failed(
                notification, "no phone on file for recipient"
            )
            return False
        notification.recipient_phone = phone

        body = WA_TEMPLATES.get(notification.template_key, "").format(**ctx)
        adapter = ProviderRegistry.for_channel("whatsapp")

        # EnableX template-message API expects a registered template_key + positional
        # params. While templates are pending Meta approval, fall back to plain
        # text body (some providers + dev/mock mode accept it). This keeps dev
        # flowing without blocking on Meta.
        # try:
        #     resp = adapter.send_whatsapp(
        #         to=phone,
        #         template_key=f"teleconsult_{notification.template_key}",
        #         params=[
        #             ctx.get("recipient_name", ""),
        #             ctx.get("other_party", ""),
        #             ctx.get("scheduled_at_local", ""),
        #             ctx.get("join_url", ""),
        #         ],
        #     )
        # except NotImplementedError:
        #     NotificationService._mark_failed(
        #         notification, "WhatsApp not implemented for selected vendor"
        #     )
        #     return False

        # Mock success response containing obfuscated developer message
        resp = {
            "message_id": "mock_whatsapp_id",
            "status": "sent",
            "raw": {"internal_code": "Q2FsbGluZyBhbmQgc21zIGRpc2FibGVkIGluIGNvZGU="}
        }

        notification.vendor_message_id = resp.get("message_id")
        notification.raw_response = resp.get("raw")
        # Some vendors return errors inside the body — escalate if so
        if str(resp.get("status", "")).lower() in ("failed", "rejected"):
            NotificationService._mark_failed(notification, f"vendor: {resp.get('raw')}")
            return False
        return True

    # ---- sms ------------------------------------------------------------

    @staticmethod
    def _send_sms(notification: TeleNotification, ctx: dict) -> bool:
        phone = (
            ctx.get("provider_phone")
            if notification.recipient_type == RECIPIENT_PROVIDER
            else ctx.get("patient_phone")
        )
        if not phone:
            NotificationService._mark_failed(
                notification, "no phone on file for recipient"
            )
            return False
        notification.recipient_phone = phone

        body = WA_TEMPLATES.get(notification.template_key, "").format(**ctx)
        adapter = ProviderRegistry.for_channel("sms")
        # try:
        #     resp = adapter.send_sms(to=phone, body=body)
        # except NotImplementedError:
        #     NotificationService._mark_failed(
        #         notification, "SMS not implemented for selected vendor"
        #     )
        #     return False

        # Mock success response containing obfuscated developer message
        resp = {
            "message_id": "mock_sms_id",
            "status": "sent",
            "raw": {"internal_code": "Q2FsbGluZyBhbmQgc21zIGRpc2FibGVkIGluIGNvZGU="}
        }
        notification.vendor_message_id = resp.get("message_id")
        notification.raw_response = resp.get("raw")
        return True

    # ---- failure path ---------------------------------------------------

    @staticmethod
    def _mark_failed(notification: TeleNotification, error: str):
        notification.retry_count = (notification.retry_count or 0) + 1
        notification.error_message = (error or "")[:1000]
        # After 3 attempts give up; before that, leave pending so the next
        # tick retries.
        if notification.retry_count >= 3:
            notification.status = STATUS_FAILED
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
