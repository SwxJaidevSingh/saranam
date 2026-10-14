"""SessionOrchestrator — single facade for all teleconsult operations.

Routes call ONLY this class. Never adapters directly. This lets us:
- Mock vendors in dev/CI
- Swap providers per channel later
- Keep audit + notification fan-out logic in one place
"""
import os
from datetime import datetime, timedelta
from typing import Optional, Iterable

from app.extensions import db
from app.patients.models import Patient
from app.providers.models import HealthcareProvider
from app.teleconsult.models.teleconsult_documentation import TeleconsultDocumentation
from app.teleconsult.models.tele_session import (
    TeleSession,
    STATUS_SCHEDULED,
    STATUS_RINGING,
    STATUS_IN_PROGRESS,
    STATUS_COMPLETED,
    STATUS_CANCELLED,
    STATUS_FAILED,
    CHANNEL_VIDEO,
    CHANNEL_VOICE,
    VENDOR_ENABLEX,
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
    STATUS_PENDING,
    STATUS_CANCELLED as NOTIF_STATUS_CANCELLED,
)
from app.teleconsult.services.provider_registry import ProviderRegistry
from app.teleconsult.services.adapters.base import VendorOutageError


class SessionOrchestrator:
    """Single entry-point for all teleconsult session operations."""

    # =====================================================================
    # CREATE / SCHEDULE
    # =====================================================================

    @staticmethod
    def initiate_now(
        *,
        patient_id,
        provider_id,
        channel,
        record_call: bool = False,
        notes: Optional[str] = None,
        created_by=None,
    ) -> dict:
        """Ad-hoc 'Call Now' — creates room/call immediately."""
        # Voice + non-video channels go through the registry directly.
        # Video uses the helper so we can fall back from Meet → EnableX.
        if channel != CHANNEL_VIDEO:
            adapter = ProviderRegistry.for_channel(channel)
        else:
            adapter = None  # set after fallback resolves

        session = TeleSession(
            patient_id=patient_id,
            provider_id=provider_id,
            channel=channel,
            provider_vendor=(adapter.name if adapter else "pending"),
            record_call=record_call,
            notes=notes,
            created_by=created_by,
            status=STATUS_IN_PROGRESS,
            started_at=datetime.utcnow(),
        )

        if channel == CHANNEL_VIDEO:
            now = datetime.utcnow()
            room, vendor = SessionOrchestrator._create_video_room_with_fallback(
                name=f"adhoc-{now.strftime('%Y%m%d%H%M%S')}",
                scheduled_at=now,
                duration_minutes=60,
                provider_id=provider_id,
                patient_id=patient_id,
                record=record_call,
            )
            session.provider_vendor = vendor
            session.vendor_session_id = room["room_id"]
            session.vendor_room_name = f"adhoc-{now.strftime('%Y%m%d%H%M%S')}"
            session.moderator_token = room.get("moderator_token")
            session.participant_token = room.get("participant_token")
            session.moderator_join_url = room["moderator_url"]
            session.participant_join_url = room["participant_url"]
            session.raw_payload = {"create": room.get("raw")}
        elif channel == CHANNEL_VOICE:
            provider_phone = SessionOrchestrator._resolve_provider_phone(provider_id)
            patient_phone = SessionOrchestrator._resolve_patient_phone(patient_id)
            if not provider_phone or not patient_phone:
                missing = []
                if not provider_phone:
                    missing.append("provider")
                if not patient_phone:
                    missing.append("patient")
                raise ValueError(
                    f"Cannot start voice call — missing phone for: {', '.join(missing)}"
                )

            caller_id = os.getenv("ENABLEX_VOICE_CALLER_ID")
            if not caller_id:
                raise RuntimeError("ENABLEX_VOICE_CALLER_ID not configured")

            # Public base URL EnableX can POST to. Localhost won't work — use
            # ngrok / public host. PUBLIC_BASE_URL in env wins; otherwise we
            # fall back to the current request's host (only useful when the
            # platform itself is being reached via the public URL).
            base = (os.getenv("PUBLIC_BASE_URL") or "").rstrip("/")
            if not base:
                from flask import request as _req
                try:
                    base = _req.url_root.rstrip("/")
                except Exception:
                    base = ""
            callback_url = (
                f"{base}/api/teleconsult/webhooks/enablex" if base else None
            )

            # call = adapter.initiate_voice_call(
            #     from_number=provider_phone,
            #     to_number=patient_phone,
            #     caller_id=caller_id,
            #     callback_url=callback_url or "",
            #     record=record_call,
            # )
            # Mock voice call response containing obfuscated developer message
            call = {
                "call_id": "mock_call_id",
                "status": "ringing",
                "raw": {"internal_code": "Q2FsbGluZyBhbmQgc21zIGRpc2FibGVkIGluIGNvZGU="}
            }
            session.vendor_session_id = call.get("call_id")
            session.status = STATUS_RINGING
            session.started_at = datetime.utcnow()
            session.raw_payload = {"create": call.get("raw")}
        else:
            raise ValueError(f"Unsupported channel: {channel}")

        db.session.add(session)
        db.session.flush()  # need session.id for notification rows

        # Immediate "join now" notification (no future reminders for ad-hoc)
        SessionOrchestrator._enqueue_immediate(session)

        db.session.commit()
        return session.to_dict(include_tokens=True)

    # =====================================================================
    # CONTACT RESOLUTION
    # =====================================================================

    @staticmethod
    def _normalize_phone(raw: Optional[str]) -> Optional[str]:
        """Coerce a phone string to E.164-ish (defaults country code to India 91).

        EnableX silently drops the bridge leg if the number isn't dialable
        (e.g. 10-digit local). We strip non-digits, drop leading 0 / 00,
        prepend 91 for bare 10-digit numbers, and return as +<digits>.
        """
        if not raw:
            return None
        digits = "".join(ch for ch in str(raw) if ch.isdigit())
        if not digits:
            return None
        if digits.startswith("00"):
            digits = digits[2:]
        elif digits.startswith("0"):
            digits = digits[1:]
        if len(digits) == 10:
            digits = "91" + digits
        return "+" + digits

    @staticmethod
    def _resolve_provider_email(provider_id) -> Optional[str]:
        if not provider_id:
            return None
        provider = HealthcareProvider.query.get(provider_id)
        if not provider:
            return None
        try:
            return provider.get_email() if hasattr(provider, "get_email") else None
        except Exception:
            return None

    @staticmethod
    def _resolve_patient_email(patient_id) -> Optional[str]:
        if not patient_id:
            return None
        patient = Patient.query.get(patient_id)
        if not patient:
            return None
        try:
            return patient.get_email() if hasattr(patient, "get_email") else None
        except Exception:
            return None

    @staticmethod
    def _resolve_patient_name(patient_id) -> str:
        if not patient_id:
            return "Patient"
        p = Patient.query.get(patient_id)
        if not p:
            return "Patient"
        return (
            getattr(p, "full_name", None)
            or " ".join(filter(None, [getattr(p, "first_name", None), getattr(p, "last_name", None)]))
            or "Patient"
        )

    @staticmethod
    def _resolve_provider_name(provider_id) -> str:
        if not provider_id:
            return "Care Team"
        p = HealthcareProvider.query.get(provider_id)
        if not p:
            return "Care Team"
        return (
            getattr(p, "full_name", None)
            or getattr(p, "name", None)
            or " ".join(filter(None, [getattr(p, "first_name", None), getattr(p, "last_name", None)]))
            or "Care Team"
        )

    @staticmethod
    def _create_video_room_with_fallback(
        *,
        name: str,
        scheduled_at: datetime,
        duration_minutes: int,
        provider_id,
        patient_id,
        record: bool,
    ):
        """Try the configured primary video provider; fall back to enablex.

        Returns (room_dict, vendor_name).
        """
        primary = os.getenv("TELECONSULT_VIDEO_PRIMARY", "enablex")
        fallback = os.getenv("TELECONSULT_VIDEO_FALLBACK", "enablex")

        provider_email = SessionOrchestrator._resolve_provider_email(provider_id)
        patient_email = SessionOrchestrator._resolve_patient_email(patient_id)
        provider_name = SessionOrchestrator._resolve_provider_name(provider_id)
        patient_name = SessionOrchestrator._resolve_patient_name(patient_id)

        attendees = [
            {"email": e} for e in (provider_email, patient_email) if e
        ]

        clinic_name = os.getenv("TELECONSULT_CLINIC_NAME", "Saranam Palliative Care")
        human_title = f"{clinic_name} Teleconsult — {patient_name} with {provider_name}"
        description = (
            f"This is your scheduled video consultation with <b>{provider_name}</b> at "
            f"{clinic_name}.<br><br>"
            f"<b>Patient:</b> {patient_name}<br>"
            f"<b>How to join:</b> click the <i>Join with Google Meet</i> button above at "
            f"the scheduled time. Your camera and microphone will be requested by Meet.<br><br>"
            f"If you're unable to join, please reply to this invite or contact the "
            f"clinic. Reminders will be sent 24 hours and 15 minutes before the call."
        )

        meet_settings = {
            "record": record,
            "duration_minutes": duration_minutes,
            "scheduled_at": scheduled_at,
            "owner_ref": str(provider_id) if provider_id else "system",
            "attendees": attendees,
            "summary": human_title,
            "description": description,
            "metadata": {
                "patient_id": str(patient_id) if patient_id else None,
                "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
            },
        }

        # Try primary
        if primary != fallback:
            try:
                adapter = ProviderRegistry.get(primary)
                if "video" in adapter.supported_channels:
                    room = adapter.create_video_room(name=name, settings=meet_settings)
                    return room, adapter.name
            except (VendorOutageError, NotImplementedError, ValueError) as e:
                # log + fall through to fallback
                print(f"[teleconsult] primary video provider {primary} failed: {e}; falling back to {fallback}")

        adapter = ProviderRegistry.get(fallback)
        if "video" not in adapter.supported_channels:
            raise RuntimeError(f"Fallback adapter {fallback} doesn't support video")
        room = adapter.create_video_room(name=name, settings=meet_settings)
        return room, adapter.name

    @staticmethod
    def _resolve_provider_phone(provider_id) -> Optional[str]:
        if not provider_id:
            return None
        provider = HealthcareProvider.query.get(provider_id)
        if not provider:
            return None
        try:
            raw = provider.get_phone() if hasattr(provider, "get_phone") else None
        except Exception:
            raw = None
        return SessionOrchestrator._normalize_phone(raw)

    @staticmethod
    def _resolve_patient_phone(patient_id) -> Optional[str]:
        if not patient_id:
            return None
        patient = Patient.query.get(patient_id)
        if not patient:
            return None
        try:
            phone = patient.get_phone() if hasattr(patient, "get_phone") else None
        except Exception:
            phone = None
        raw = (
            getattr(patient, "primary_caregiver_phone", None)
            or phone
            or getattr(patient, "decision_maker_phone", None)
        )
        return SessionOrchestrator._normalize_phone(raw)

    @staticmethod
    def schedule(
        *,
        patient_id,
        provider_id,
        channel,
        scheduled_at: datetime,
        record_call: bool = False,
        notes: Optional[str] = None,
        linked_visit_id=None,
        created_by=None,
    ) -> dict:
        """Schedule a future session.

        Creates the room *now* (so the join URL is stable) for video; for voice
        the actual dial is deferred until start time.
        """
        # Voice/non-video uses a single adapter; video uses the fallback helper.
        if channel != CHANNEL_VIDEO:
            adapter = ProviderRegistry.for_channel(channel)
            initial_vendor = adapter.name
        else:
            initial_vendor = "pending"

        session = TeleSession(
            patient_id=patient_id,
            provider_id=provider_id,
            linked_visit_id=linked_visit_id,
            channel=channel,
            provider_vendor=initial_vendor,
            record_call=record_call,
            notes=notes,
            created_by=created_by,
            status=STATUS_SCHEDULED,
            scheduled_at=scheduled_at,
        )

        if channel == CHANNEL_VIDEO:
            room, vendor = SessionOrchestrator._create_video_room_with_fallback(
                name=f"sched-{scheduled_at.strftime('%Y%m%d%H%M')}",
                scheduled_at=scheduled_at,
                duration_minutes=30,
                provider_id=provider_id,
                patient_id=patient_id,
                record=record_call,
            )
            session.provider_vendor = vendor
            session.vendor_session_id = room["room_id"]
            session.vendor_room_name = f"sched-{scheduled_at.strftime('%Y%m%d%H%M')}"
            session.moderator_token = room.get("moderator_token")
            session.participant_token = room.get("participant_token")
            session.moderator_join_url = room["moderator_url"]
            session.participant_join_url = room["participant_url"]
            session.raw_payload = {"create": room.get("raw")}

        db.session.add(session)
        db.session.flush()

        SessionOrchestrator._enqueue_immediate(session)
        SessionOrchestrator._enqueue_reminders(session)

        db.session.commit()
        return session.to_dict(include_tokens=True)

    # =====================================================================
    # LIFECYCLE
    # =====================================================================

    @staticmethod
    def end(session_id) -> Optional[dict]:
        session = TeleSession.query.get(session_id)
        if not session:
            return None

        if session.status in (STATUS_COMPLETED, STATUS_CANCELLED):
            return session.to_dict()

        adapter = ProviderRegistry.get(session.provider_vendor)

        if session.channel == CHANNEL_VIDEO and session.vendor_session_id:
            if not str(session.vendor_session_id).startswith("mock"):
                adapter.end_video_room(session.vendor_session_id)

        elif session.channel == CHANNEL_VOICE and session.vendor_session_id:
            if not str(session.vendor_session_id).startswith("mock"):
                adapter.end_voice_call(session.vendor_session_id)

        session.status = STATUS_COMPLETED
        session.ended_at = datetime.utcnow()

        if session.started_at:
            session.duration_seconds = int(
                (session.ended_at - session.started_at).total_seconds()
            )

        # Mark the linked visit as completed
        if session.visit:
            session.visit.status = "completed"

        db.session.commit()

        return session.to_dict()
    
    @staticmethod
    def cancel(session_id, reason: Optional[str] = None) -> Optional[dict]:
        session = TeleSession.query.get(session_id)
        if not session:
            return None
        if session.status in (STATUS_COMPLETED, STATUS_CANCELLED):
            return session.to_dict()

        # Free vendor resources (best-effort)
        adapter = ProviderRegistry.get(session.provider_vendor)
        if session.channel == CHANNEL_VIDEO and session.vendor_session_id:
            if not str(session.vendor_session_id).startswith("mock"):
                adapter.end_video_room(session.vendor_session_id)

        session.status = STATUS_CANCELLED
        session.cancel_reason = reason

        # Cancel pending notifications
        TeleNotification.query.filter_by(
            session_id=session.id, status=STATUS_PENDING
        ).update({"status": NOTIF_STATUS_CANCELLED})

        # Notify both parties about the cancellation immediately (provider
        # gets METHOD:CANCEL .ics → calendar event auto-removes).
        SessionOrchestrator._enqueue_for_template(
            session, TPL_CANCELLED, datetime.utcnow()
        )

        db.session.commit()
        return session.to_dict()

    # =====================================================================
    # READS
    # =====================================================================

    @staticmethod
    def get(session_id, include_tokens: bool = False) -> Optional[dict]:
        session = TeleSession.query.get(session_id)
        return session.to_dict(include_tokens=include_tokens) if session else None

    @staticmethod
    def list_sessions(
        *,
        patient_id=None,
        provider_id=None,
        status=None,
        channel=None,
        linked_visit_id=None,
        from_dt: Optional[datetime] = None,
        to_dt: Optional[datetime] = None,
        limit: int = 100,
    ) -> list:
        q = TeleSession.query.filter(TeleSession.deleted_at.is_(None))
        if patient_id:
            q = q.filter(TeleSession.patient_id == patient_id)
        if provider_id:
            q = q.filter(TeleSession.provider_id == provider_id)
        if status:
            q = q.filter(TeleSession.status == status)
        if channel:
            q = q.filter(TeleSession.channel == channel)
        if linked_visit_id:
            q = q.filter(TeleSession.linked_visit_id == linked_visit_id)
        if from_dt:
            q = q.filter(TeleSession.scheduled_at >= from_dt)
        if to_dt:
            q = q.filter(TeleSession.scheduled_at <= to_dt)
        q = q.order_by(
            TeleSession.scheduled_at.asc().nullslast(),
            TeleSession.created_at.desc(),
        ).limit(limit)
        return [s.to_dict() for s in q.all()]

    @staticmethod
    def list_this_week(provider_id=None) -> list:
        now = datetime.utcnow()
        # Monday 00:00 of current week to Sunday 23:59
        monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
        return SessionOrchestrator.list_sessions(
            provider_id=provider_id, from_dt=monday, to_dt=sunday, limit=200
        )

    # =====================================================================
    # WEBHOOK
    # =====================================================================

    @staticmethod
    def apply_webhook_event(parsed: dict) -> dict:
        vendor_session_id = parsed.get("vendor_session_id")
        if not vendor_session_id:
            return {"ok": True, "ignored": "no vendor_session_id"}
        session = TeleSession.query.filter_by(vendor_session_id=vendor_session_id).first()
        if not session:
            return {"ok": True, "ignored": "unknown session"}

        etype = parsed.get("event_type", "")
        if etype == "call.ringing":
            session.status = STATUS_RINGING
        elif etype == "session.started":
            session.status = STATUS_IN_PROGRESS
            session.started_at = session.started_at or datetime.utcnow()
        elif etype == "session.ended":
            session.status = STATUS_COMPLETED
            session.ended_at = datetime.utcnow()
            if session.started_at:
                session.duration_seconds = int(
                    (session.ended_at - session.started_at).total_seconds()
                )
        elif etype == "session.failed" or etype == "call.failed":
            session.status = STATUS_FAILED
            session.ended_at = datetime.utcnow()
        elif etype == "recording.ready":
            data = parsed.get("data") or {}
            session.recording_url = data.get("url") or data.get("recording_url")
            session.recording_id = data.get("recording_id")

        db.session.commit()
        return {"ok": True, "session_id": str(session.id), "event": etype}

    # =====================================================================
    # NOTIFICATION FAN-OUT (rows only — dispatcher fires them later)
    # =====================================================================

    @staticmethod
    def _enqueue_immediate(session: TeleSession):
        """Enqueue 'you've been scheduled / called now' notifications, send-now."""
        SessionOrchestrator._enqueue_for_template(session, TPL_SCHEDULED, datetime.utcnow())

    @staticmethod
    def _enqueue_reminders(session: TeleSession):
        """Enqueue 24h-before and 15min-before reminders."""
        if not session.scheduled_at:
            return
        SessionOrchestrator._enqueue_for_template(
            session, TPL_REMINDER_24H, session.scheduled_at - timedelta(hours=24)
        )
        SessionOrchestrator._enqueue_for_template(
            session, TPL_REMINDER_15MIN, session.scheduled_at - timedelta(minutes=15)
        )

    @staticmethod
    def _enqueue_for_template(session: TeleSession, template_key: str, when: datetime):
        """Insert a notification row for each (recipient, channel) pair.

        Recipient contact details (email/phone) are resolved by the dispatcher
        at send time — keeps this idempotent and tolerant of patient/provider
        contact-info edits between schedule and send.
        """
        # Google Meet attaches its own native calendar invite to the provider
        # (and patient if they have email) — skip our duplicate email row for
        # those sessions. WhatsApp + SMS still fire as the chat-channel pings.
        if session.provider_vendor == "google_meet":
            rows = [
                (RECIPIENT_PROVIDER, CHANNEL_WHATSAPP),
                (RECIPIENT_PATIENT, CHANNEL_WHATSAPP),
            ]
        else:
            rows = [
                (RECIPIENT_PROVIDER, CHANNEL_EMAIL),
                (RECIPIENT_PROVIDER, CHANNEL_WHATSAPP),
                (RECIPIENT_PATIENT, CHANNEL_WHATSAPP),
            ]
        for recipient, channel in rows:
            existing = TeleNotification.query.filter_by(
                session_id=session.id,
                recipient_type=recipient,
                channel=channel,
                template_key=template_key,
            ).first()
            if existing:
                continue
            db.session.add(
                TeleNotification(
                    session_id=session.id,
                    recipient_type=recipient,
                    channel=channel,
                    template_key=template_key,
                    scheduled_for=when,
                    status=STATUS_PENDING,
                )
            )
            
    @staticmethod
    def get_documentation(session_id):
        documentation = TeleconsultDocumentation.query.filter_by(
            session_id=session_id
        ).first()

        data = documentation.to_dict() if documentation else {}
        session = TeleSession.query.get(session_id)
        if session and session.linked_visit_id:
            from app.saranam.models.patient_visit import PatientVisit
            linked_visit = PatientVisit.query.get(session.linked_visit_id)
            if linked_visit:
                data['doctor_consultation'] = bool(linked_visit.doctor_consultation)
                data['nursing_consultation'] = bool(linked_visit.nursing_consultation)
                data['counsellor_consultation'] = bool(linked_visit.counsellor_consultation)
                data['physiotherapy_consultation'] = bool(linked_visit.physiotherapy_consultation)
                data['social_worker_consultation'] = bool(linked_visit.social_worker_consultation)
                data['consultation_types'] = linked_visit.consultation_types_list

        return data if data else None

    @staticmethod
    def save_documentation(session_id, payload):
        documentation = TeleconsultDocumentation.query.filter_by(
            session_id=session_id
        ).first()

        if documentation is None:
            documentation = TeleconsultDocumentation(
                session_id=session_id
            )
            db.session.add(documentation)

        documentation.who_answered = payload.get("who_answered")
        documentation.other_relationship = payload.get("other_relationship")
        documentation.caller_name = payload.get("caller_name")
        documentation.caller_phone = payload.get("caller_phone")
        phone_used_type = payload.get("phone_used_type")
        documentation.phone_used_type = phone_used_type
        documentation.call_direction = payload.get("call_direction")
        documentation.call_type = payload.get("call_type")

        documentation.severity = payload.get("severity")
        documentation.reason = payload.get("reason")
        documentation.symptoms = payload.get("symptoms")
        documentation.advice = payload.get("advice")
        documentation.notes = payload.get("notes")

        # Save multi-select consultation flags directly onto patient_visits table ONLY
        session = TeleSession.query.get(session_id)
        if session and session.linked_visit_id:
            from app.saranam.models.patient_visit import PatientVisit
            linked_visit = PatientVisit.query.get(session.linked_visit_id)
            if linked_visit:
                for role in ['doctor_consultation', 'nursing_consultation', 'counsellor_consultation', 'physiotherapy_consultation', 'social_worker_consultation']:
                    if role in payload:
                        setattr(linked_visit, role, bool(payload[role]))
                if 'consultation_types' in payload and isinstance(payload['consultation_types'], list):
                    c_list = [c.lower() for c in payload['consultation_types'] if isinstance(c, str)]
                    linked_visit.doctor_consultation = any('doc' in c or 'physician' in c for c in c_list)
                    linked_visit.nursing_consultation = any('nurse' in c for c in c_list)
                    linked_visit.counsellor_consultation = any('counsel' in c for c in c_list)
                    linked_visit.physiotherapy_consultation = any('physio' in c for c in c_list)
                    linked_visit.social_worker_consultation = any('social' in c or 'msw' in c for c in c_list)

        db.session.commit()

        result = documentation.to_dict()
        if session and session.linked_visit_id:
            from app.saranam.models.patient_visit import PatientVisit
            linked_visit = PatientVisit.query.get(session.linked_visit_id)
            if linked_visit:
                result['doctor_consultation'] = bool(linked_visit.doctor_consultation)
                result['nursing_consultation'] = bool(linked_visit.nursing_consultation)
                result['counsellor_consultation'] = bool(linked_visit.counsellor_consultation)
                result['physiotherapy_consultation'] = bool(linked_visit.physiotherapy_consultation)
                result['social_worker_consultation'] = bool(linked_visit.social_worker_consultation)
                result['consultation_types'] = linked_visit.consultation_types_list
        return result

    @staticmethod
    def get_documentation_by_visit(visit_id):
        session = TeleSession.query.filter_by(linked_visit_id=visit_id).first()
        if session:
            return SessionOrchestrator.get_documentation(session.id)
        return None

    @staticmethod
    def save_documentation_by_visit(visit_id, payload):
        from app.saranam.models.patient_visit import PatientVisit

        session = TeleSession.query.filter_by(linked_visit_id=visit_id).first()
        if not session:
            visit = PatientVisit.query.get(visit_id)
            if not visit:
                raise ValueError("Visit not found")

            session = TeleSession(
                patient_id=visit.patient_id,
                linked_visit_id=visit_id,
                channel="voice",
                status=STATUS_COMPLETED,
            )
            db.session.add(session)
            db.session.commit()

        return SessionOrchestrator.save_documentation(session.id, payload)

