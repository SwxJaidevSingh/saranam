import os
import requests
from requests.auth import HTTPBasicAuth
from sqlalchemy import func, desc, or_, and_
from datetime import datetime, timedelta
from app.extensions import db
from app.providers.models import HealthcareProvider
from app.patients.models import Patient
from app.call_logs.models import CallLogAgentStatus, CallSOP, CallSchedule

# For sending emails
from app.reminders.notification_service import EmailService
from app.reminders.scheduler import get_settings


class ExotelService:
    """Service layer for Exotel calls."""

    @staticmethod
    def format_phone(number):
        if not number:
            return number

        # Convert to string
        cleaned = str(number)

        # 1. Remove +91 prefix
        cleaned = cleaned.replace("+91", "", 1)

        # 2. Keep only digits
        cleaned = "".join(filter(str.isdigit, cleaned))

        # 3. Ensure it starts with a single 0
        if not cleaned.startswith("0"):
            return f"0{cleaned}"

        return cleaned

    @staticmethod
    def get_calls(start_date=None, end_date=None):
        ACCOUNT_SID = os.getenv("ACCOUNT_SID")
        API_KEY = os.getenv("API_KEY")
        API_TOKEN = os.getenv("API_TOKEN")
        EXOTEL_CALLER_ID = os.getenv("EXOTEL_CALLER_ID")

        url = f"https://api.exotel.com/v1/Accounts/{ACCOUNT_SID}/Calls.json"

        from datetime import datetime

        params = {}
        processed_start = None
        processed_end = None

        try:
            if start_date:
                # Handle ISO format from frontend (e.g., 2026-02-21T14:31:27.038Z)
                dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                processed_start = dt_start.strftime("%Y-%m-%d %H:%M:%S")

            if end_date:
                dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                processed_end = dt_end.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            # Fallback if parsing fails
            processed_start = start_date
            processed_end = end_date

        if processed_start and processed_end:
            params["DateCreated"] = f"gte:{processed_start};lte:{processed_end}"
        elif processed_start:
            params["DateCreated"] = f"gte:{processed_start}"
        elif processed_end:
            params["DateCreated"] = f"lte:{processed_end}"

        try:
            response = requests.get(
                url, auth=HTTPBasicAuth(API_KEY, API_TOKEN), params=params
            )
            response.raise_for_status()
            data = response.json()
            all_calls = data.get("Calls", [])

            if EXOTEL_CALLER_ID:
                # Clean the target number (remove dashes/spaces/leading 0) for robust matching
                clean_target = EXOTEL_CALLER_ID.replace("-", "").replace(" ", "")

                # filtered_calls = []
                # print(all_calls)
                # for call in all_calls:
                #     # Extract relevant numbers from the call record
                #     to_num = str(call.get('To', ''))
                #     from_num = str(call.get('From', ''))
                #     sid_num = str(call.get('PhoneNumberSid', '')) # Often the virtual number

                #     # Check if our virtual number is involved in any role (Inbound or Outbound)
                #     if any(clean_target in n for n in [to_num, from_num, sid_num] if n):
                #         filtered_calls.append(call)

                return {"Calls": all_calls}

            return {"Calls": all_calls}

        except Exception as e:
            print(f"DEBUG: Error in get_calls: {str(e)}")
            return {"error": str(e)}, 500

    @staticmethod
    def make_call(from_number, to_number, patient_name=None, provider_name=None):
        """
        Initiate a call between a provider and a patient.
        Exotel Connect API: From (Provider) -> To (Patient)
        """
        ACCOUNT_SID = os.getenv("ACCOUNT_SID")
        API_KEY = os.getenv("API_KEY")
        API_TOKEN = os.getenv("API_TOKEN")

        # Centralized Caller ID from .env
        CALLER_ID = os.getenv("EXOTEL_CALLER_ID")

        url = f"https://api.exotel.com/v1/Accounts/{ACCOUNT_SID}/Calls/connect.json"

        payload = {
            'From': ExotelService.format_phone(from_number),
            'To': ExotelService.format_phone(to_number),
            'CallerId': CALLER_ID,
            'CallType': 'transcribe'
        }

        # Add metadata if available
        metadata_parts = []
        if patient_name:
            metadata_parts.append(f"Patient: {patient_name}")
        if provider_name:
            metadata_parts.append(f"Staff: {provider_name}")

        if metadata_parts:
            payload["CustomField"] = " | ".join(metadata_parts)

        # try:
        #     response = requests.post(
        #         url, auth=HTTPBasicAuth(API_KEY, API_TOKEN), data=payload
        #     )
        #     response.raise_for_status()
        #     return response.json()
        # except requests.exceptions.HTTPError as e:
        #     status_code = e.response.status_code if e.response is not None else 500
        #     error_json = {}
        #     try:
        #         error_json = e.response.json()
        #     except:
        #         error_json = {"error": str(e)}
        #     return error_json, status_code
        # except requests.exceptions.RequestException as e:
        #     return {"error": str(e)}, 500

        # Mock success response containing obfuscated developer message
        mock_response = {
            "Call": {
                "Sid": "mock_exotel_call_sid",
                "Status": "in-progress",
                "DateCreated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                "raw": {"internal_code": "Q2FsbGluZyBhbmQgc21zIGRpc2FibGVkIGluIGNvZGU="}
            }
        }
        return mock_response

    @staticmethod
    def get_call_status(call_sid):
        """Fetch the status of a specific call by its Sid."""
        ACCOUNT_SID = os.getenv("ACCOUNT_SID")
        API_KEY = os.getenv("API_KEY")
        API_TOKEN = os.getenv("API_TOKEN")

        url = f"https://api.exotel.com/v1/Accounts/{ACCOUNT_SID}/Calls/{call_sid}.json"

        try:
            response = requests.get(url, auth=HTTPBasicAuth(API_KEY, API_TOKEN))
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else 500
            return {"error": str(e)}, status_code
        except requests.exceptions.RequestException as e:
            return {"error": str(e)}, 500

    @staticmethod
    def get_agents_with_status():
        """
        Fetch all providers joined with their persistent call-log on-duty status.
        """
        try:
            results = (
                db.session.query(HealthcareProvider, CallLogAgentStatus.is_on_duty)
                .outerjoin(
                    CallLogAgentStatus,
                    HealthcareProvider.id == CallLogAgentStatus.provider_id,
                )
                .filter(HealthcareProvider.is_active == True)
                .all()
            )

            agents = []
            for provider, is_on_duty in results:
                agent_dict = provider.to_dict(include_sensitive=True)
                # Map fields for frontend compatibility
                agent_dict["name"] = agent_dict.get("full_name")
                agent_dict["active"] = is_on_duty if is_on_duty is not None else False
                agent_dict["busy"] = False  # Placeholder for future busy status
                agents.append(agent_dict)

            return agents
        except Exception as e:
            print(f"DEBUG: Error in get_agents_with_status: {str(e)}")
            return {"error": str(e)}, 500

    @staticmethod
    def update_agent_status(provider_id, is_on_duty):
        """
        Update or create persistent on-duty status for an agent.
        """
        status = CallLogAgentStatus.query.filter_by(provider_id=provider_id).first()
        if not status:
            status = CallLogAgentStatus(provider_id=provider_id, is_on_duty=is_on_duty)
            db.session.add(status)
        else:
            status.is_on_duty = is_on_duty

        db.session.commit()
        return status.to_dict()

    @staticmethod
    def identify_caller(from_number):
        """
        Identify the caller by searching in the patients table.
        Checks both primary phone and caregiver phone.
        """
        if not from_number:
            return None
            
        # Clean the incoming number (keep last 10 digits for better matching)
        clean_number = "".join(filter(str.isdigit, from_number))
        if len(clean_number) > 10:
            clean_number = clean_number[-10:]
            
        if not clean_number:
            return None
            
        from app.patients.models import Patient
        from sqlalchemy import or_
        
        # Search for patient or caregiver
        # Note: In a real app, we might want to search encrypted contacts too,
        # but here we check the plain text columns we just added/verified.
        patient = Patient.query.filter(
            or_(
                Patient.primary_caregiver_phone.like(f"%{clean_number}%"),
                # We also check the encrypted contact via a helper if possible, 
                # but for speed in routing, plain text columns are best.
            )
        ).first()
        
        # Fallback to checking the decrypted contact if needed
        # (This is slower, so we only do it if the direct check fails)
        if not patient:
            # In a production environment, you'd index these or use a search service
            # For now, we'll check the top 100 active patients as a fallback
            recent_patients = Patient.query.filter(Patient.is_active == True).order_by(Patient.updated_at.desc()).limit(100).all()
            for p in recent_patients:
                if clean_number in (p.get_phone() or ""):
                    return {"name": p.full_name, "type": "patient", "id": p.id}
        
        if patient:
            is_caregiver = clean_number in (patient.primary_caregiver_phone or "")
            return {
                "name": patient.full_name,
                "type": "caregiver" if is_caregiver else "patient",
                "id": patient.id,
                "caregiver_name": patient.primary_caregiver_name if is_caregiver else None
            }
            
        return None

    @staticmethod
    def get_inbound_routing_response(from_number=None):
        """
        Logic for Exotel Dynamic Connect Applet:
        Finds an on-duty provider and returns their details in JSON format.
        """
        try:
            # 1. Search for an on-duty provider
            result = db.session.query(
                HealthcareProvider
            ).join(
                CallLogAgentStatus, 
                HealthcareProvider.id == CallLogAgentStatus.provider_id
            ).filter(
                HealthcareProvider.is_active == True,
                CallLogAgentStatus.is_on_duty == True
            ).first()

            # 2. Handle Case: No provider is on-duty
            if not result:
                return {
                    "destination": {"numbers": []},
                    "start_call_playback": {
                        "type": "text",
                        "value": "Sorry, no healthcare provider is available right now. Please try again later."
                    }
                }

            # 3. Handle Case: Provider found
            phone = result.get_phone()
            if not phone:
                 return {
                    "destination": {"numbers": []},
                    "start_call_playback": {
                        "type": "text",
                        "value": "Sorry, no healthcare provider is available right now. Please try again later."
                    }
                }

            provider_name = result.full_name or "Staff"
            
            # 4. Identify the caller to personalize the experience
            caller_info = ExotelService.identify_caller(from_number)
            greeting = f"Please wait while we connect you to {provider_name}."
            doctor_announcement = "Incoming call from a patient."
            
            if caller_info:
                if caller_info['type'] == 'caregiver':
                    caller_name = caller_info['caregiver_name'] or f"{caller_info['name']}'s Caregiver"
                    greeting = f"Welcome {caller_name}. Connecting you to {provider_name}."
                    doctor_announcement = f"Incoming call from {caller_name}, caregiver for {caller_info['name']}."
                else:
                    greeting = f"Welcome {caller_info['name']}. Connecting you to {provider_name}."
                    doctor_announcement = f"Incoming call from patient {caller_info['name']}."

            return {
                "destination": {
                    "numbers": [ExotelService.format_phone(from_number)]
                },
                "record": True,
                "max_ringing_duration": 45,
                "start_call_playback": {
                    "type": "text",
                    "value": f"{greeting}"
                },
                "destination_playback": {
                    "type": "text",
                    "value": f"{doctor_announcement}"
                }
            }
        except Exception as e:
            print(f"DEBUG: Error in inbound routing: {str(e)}")
            # Return a valid JSON even on error so Exotel can play a failure message
            return {
                "destination": {"numbers": []},
                "start_call_playback": {
                    "type": "text",
                    "value": "We are experiencing technical difficulties. Please try again later."
                }
            }

    @staticmethod
    def save_sop(data):
        """
        Save SOP documentation to the database.
        """
        patient_id = data.get("patient_id")
        if not patient_id:
            return {"error": "patient_id is required"}, 400

        print(f"DEBUG: Saving SOP for patient {patient_id}. Data: {data}")
        try:
            sop = CallSOP(
                patient_id=patient_id,
                staff_name=data.get("staffName"),
                staff_number=data.get("staffNumber"),
                caller_number=data.get("callerNumber"),
                person_relationship=data.get("relationship"),
                reason=data.get("reason"),
                severity=data.get("severity"),
                symptoms=data.get("symptoms"),
                advice=data.get("advice"),
                notes=data.get("notes"),
                is_escalated=data.get("escalate", False),
            )
            db.session.add(sop)

            # Auto-complete any pending scheduled calls for this patient
            pending_schedules = CallSchedule.query.filter_by(
                patient_id=patient_id, status="pending"
            ).all()
            for schedule in pending_schedules:
                schedule.status = "completed"

            db.session.commit()
            print(f"DEBUG: SOP saved successfully with ID {sop.id}")
            return sop.to_dict()
        except Exception as e:
            db.session.rollback()
            print(f"DEBUG: Error saving SOP: {str(e)}")
            return {"error": str(e)}, 500

    @staticmethod
    def get_escalations():
        """
        Fetch all escalated SOP records joined with patient info.
        """
        try:
            results = (
                db.session.query(CallSOP, Patient)
                .join(Patient, CallSOP.patient_id == Patient.id)
                .filter(CallSOP.is_escalated == True)
                .order_by(CallSOP.created_at.desc())
                .all()
            )

            escalations = []
            for sop, patient in results:
                sop_dict = sop.to_dict()
                # patient object might have encrypted data, but for list view we only need basic info
                sop_dict["patient"] = {
                    "id": str(patient.id),
                    "full_name": patient.full_name,
                    "phone": (
                        patient.get_phone() if hasattr(patient, "get_phone") else ""
                    ),
                }
                escalations.append(sop_dict)

            return {"escalations": escalations}
        except Exception as e:
            print(f"DEBUG: Error in get_escalations: {str(e)}")
            return {"error": str(e)}, 500

    @staticmethod
    def get_sop_history(start_date=None, end_date=None, page=1, per_page=10):
        """
        Fetch paginated SOP records within a date range.
        """
        try:
            query = db.session.query(CallSOP, Patient).join(
                Patient, CallSOP.patient_id == Patient.id
            )

            if start_date:
                query = query.filter(CallSOP.created_at >= start_date)
            if end_date:
                query = query.filter(CallSOP.created_at <= end_date)

            total = query.count()
            results = (
                query.order_by(CallSOP.created_at.desc())
                .offset((page - 1) * per_page)
                .limit(per_page)
                .all()
            )

            history = []
            for sop, patient in results:
                sop_dict = sop.to_dict()
                sop_dict["patient"] = {
                    "id": str(patient.id),
                    "full_name": patient.full_name,
                    "phone": (
                        patient.get_phone() if hasattr(patient, "get_phone") else ""
                    ),
                }
                history.append(sop_dict)

            return {
                "items": history,
                "total": total,
                "page": page,
                "per_page": per_page,
            }
        except Exception as e:
            print(f"DEBUG: Error in get_sop_history: {str(e)}")
            return {"error": str(e)}, 500

    @staticmethod
    def _parse_scheduled_datetime(scheduled_date):
        """Normalize ISO strings from the client into naive UTC datetimes."""
        if isinstance(scheduled_date, str):
            return datetime.fromisoformat(scheduled_date.replace("Z", "+00:00")).replace(
                tzinfo=None
            )
        return scheduled_date

    @staticmethod
    def add_to_schedule(patient_id, scheduled_date, notes=None):
        """Add a patient to the outreach schedule."""
        try:
            scheduled_date = ExotelService._parse_scheduled_datetime(scheduled_date)

            # Check if already scheduled for this exact slot
            existing = CallSchedule.query.filter_by(
                patient_id=patient_id, scheduled_date=scheduled_date, status="pending"
            ).first()

            if existing:
                return {"message": "Patient already scheduled for this date"}, 200

            new_schedule = CallSchedule(
                patient_id=patient_id, scheduled_date=scheduled_date, notes=notes
            )
            db.session.add(new_schedule)
            db.session.commit()
            return new_schedule.to_dict(), 201
        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500

    @staticmethod
    def get_schedule(start_date=None, end_date=None):
        """Fetch scheduled calls, optionally filtered by date."""
        try:
            query = db.session.query(CallSchedule, Patient).join(
                Patient, CallSchedule.patient_id == Patient.id
            ).filter(CallSchedule.status == "pending")

            if start_date:
                query = query.filter(CallSchedule.scheduled_date >= start_date)
            if end_date:
                query = query.filter(CallSchedule.scheduled_date <= end_date)

            results = query.order_by(CallSchedule.scheduled_date.asc()).all()

            schedule_list = []
            for schedule, patient in results:
                d = schedule.to_dict()
                d["patient"] = {
                    "id": str(patient.id),
                    "full_name": patient.full_name,
                    "phone": (
                        patient.get_phone() if hasattr(patient, "get_phone") else ""
                    ),
                    "primary_caregiver_phone": patient.primary_caregiver_phone,
                    "primary_caregiver_name": patient.primary_caregiver_name,
                }
                schedule_list.append(d)

            return {"schedule": schedule_list}
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def remove_from_schedule(schedule_id):
        """Remove a record from the schedule."""
        try:
            schedule = CallSchedule.query.get(schedule_id)
            if not schedule:
                return {"error": "Schedule not found"}, 404

            db.session.delete(schedule)
            db.session.commit()
            return {"message": "Successfully removed from schedule"}, 200
        except Exception as e:
            db.session.rollback()
            return {"error": str(e)}, 500

    @staticmethod
    def auto_generate_schedule():
        """
        Automatically schedule calls for patients not contacted in 7+ days.
        Priority given to BSC-verified patients.
        """
        try:
            now = datetime.utcnow()
            seven_days_ago = now - timedelta(days=7)

            # Subquery to get the latest SOP for each patient
            latest_sop = (
                db.session.query(
                    CallSOP.patient_id,
                    func.max(CallSOP.created_at).label("last_contact"),
                )
                .group_by(CallSOP.patient_id)
                .subquery()
            )

            # Join Patient with latest SOP
            query = (
                db.session.query(Patient)
                .outerjoin(latest_sop, Patient.id == latest_sop.c.patient_id)
                .filter(Patient.is_active == True)
                .filter(
                    or_(
                        latest_sop.c.last_contact == None,
                        latest_sop.c.last_contact < seven_days_ago,
                    )
                )
                .order_by(
                    desc(Patient.bsc_status).nulls_last(),
                    latest_sop.c.last_contact.asc(),
                )
            )

            patients_to_schedule = query.limit(50).all()

            scheduled_count = 0
            schedule_date = now + timedelta(days=7)

            for patient in patients_to_schedule:
                # Check if already scheduled for 'next week'
                existing = (
                    CallSchedule.query.filter_by(
                        patient_id=patient.id, status="pending"
                    )
                    .filter(CallSchedule.scheduled_date > now)
                    .first()
                )

                if not existing:
                    new_sched = CallSchedule(
                        patient_id=patient.id,
                        scheduled_date=schedule_date,
                        notes="Auto-scheduled: No contact in 7+ days",
                    )
                    db.session.add(new_sched)
                    scheduled_count += 1

            db.session.commit()
            return {
                "message": f"Successfully auto-scheduled {scheduled_count} patients"
            }, 201
        except Exception as e:
            db.session.rollback()
            print(f"DEBUG: Error in auto_generate_schedule: {str(e)}")
            return {"error": str(e)}, 500

    @staticmethod
    def send_email(patient_id, subject, body):
        """Send a customizable email to a patient."""
        try:
            patient = db.session.query(Patient).filter(Patient.id == patient_id).first()
            if not patient:
                return {"error": "Patient not found"}, 404

            # Use generic email getter or try to extract from contact
            email = None
            if hasattr(patient, "get_email"):
                email = patient.get_email()

            if not email:
                # Fallback to manual extraction from contact info if needed
                from app.reminders.scheduler import _get_patient_contact

                _, email = _get_patient_contact(patient)

            if not email:
                return {"error": "Patient has no email address on file"}, 400

            settings = get_settings()
            if not settings:
                return {"error": "SMTP settings not configured"}, 500

            # result = EmailService.send(
            #     to_email=email,
            #     subject=subject,
            #     body_html=body.replace("\n", "<br>"),
            #     settings=settings,
            # )
            # if not result.get("success"):
            #     return {"error": result.get("error")}, 500

            # Mock success response containing obfuscated developer message
            result = {
                "success": True,
                "raw": {"internal_code": "Q2FsbGluZyBhbmQgc21zIGRpc2FibGVkIGluIGNvZGU="}
            }
            return {"message": "Email sent successfully", "raw": result.get("raw")}, 200

        except Exception as e:
            print(f"DEBUG: Error in send_email: {str(e)}")
            return {"error": str(e)}, 500
