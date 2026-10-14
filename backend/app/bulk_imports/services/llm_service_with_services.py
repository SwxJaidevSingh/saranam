"""
LLM Service - Extended for Service Bookings
This file extends the base LLM service to support healthcare service bookings
(IPD, OPD, Physiotherapy, Home Care)
"""

import json
import os
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging

# LLM providers (same as base)
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)


# Extended Pydantic model for service bookings
class ExtractedServiceAppointment(BaseModel):
    """Structured service appointment data extracted by LLM"""

    # Patient information (same as base)
    patient_name: str = Field(..., description="Full name of the patient")
    patient_phone: Optional[str] = Field(None, description="Patient phone number")
    patient_email: Optional[str] = Field(None, description="Patient email address")
    patient_dob: Optional[str] = Field(None, description="Patient date of birth (YYYY-MM-DD)")
    patient_gender: Optional[str] = Field(None, description="Patient gender (Male/Female/Other)")
    patient_abha_id: Optional[str] = Field(None, description="14-digit ABHA ID")

    # Provider information (same as base)
    provider_name: Optional[str] = Field(None, description="Name of the healthcare provider/doctor")
    provider_specialization: Optional[str] = Field(None, description="Provider specialization")
    provider_department: Optional[str] = Field(None, description="Department name")

    # Appointment details (same as base)
    appointment_date: str = Field(..., description="Appointment date (YYYY-MM-DD)")
    appointment_time: str = Field(..., description="Appointment time (HH:MM in 24-hour format)")
    appointment_type: Optional[str] = Field(None, description="Type: consultation, follow_up, teleconsultation, procedure, etc.")
    duration_minutes: Optional[int] = Field(30, description="Appointment duration in minutes")

    # Clinical information (same as base)
    chief_complaint: Optional[str] = Field(None, description="Reason for visit / chief complaint")
    notes: Optional[str] = Field(None, description="Additional notes")

    # ===== SERVICE-SPECIFIC FIELDS =====

    # Service identification
    service_name: Optional[str] = Field(None, description="Name of the healthcare service")
    service_type: Optional[str] = Field(None, description="Service type: IPD, OPD, PHYSIOTHERAPY, HOME_CARE")

    # Common service fields (REQUIRED for all service bookings)
    contact_number: Optional[str] = Field(None, description="Contact phone number for appointment (REQUIRED for services)")
    insurance_info: Optional[str] = Field(None, description="Insurance provider name and policy number")

    # IPD (In-Patient Department) specific
    bed_number: Optional[str] = Field(None, description="Assigned bed or ward number")
    admission_date: Optional[str] = Field(None, description="Patient admission date (YYYY-MM-DD)")
    discharge_date: Optional[str] = Field(None, description="Expected discharge date (YYYY-MM-DD)")
    preferred_ward: Optional[str] = Field(None, description="Preferred ward type (General, ICU, Private, etc.)")
    emergency_contact_name: Optional[str] = Field(None, description="Emergency contact person name")
    emergency_contact_number: Optional[str] = Field(None, description="Emergency contact phone number")

    # HOME_CARE specific
    home_address: Optional[str] = Field(None, description="Complete home service address (REQUIRED for HOME_CARE)")
    equipment_provided: Optional[str] = Field(None, description="Medical equipment provided (wheelchair, oxygen, etc.)")
    visit_frequency: Optional[str] = Field(None, description="Visit frequency: daily, weekly, bi-weekly, etc.")

    # PHYSIOTHERAPY specific
    therapy_type: Optional[str] = Field(None, description="Type of therapy: pain management, post-surgery, sports injury, etc.")
    therapy_sessions: Optional[int] = Field(None, description="Number of therapy sessions planned")
    special_requirements: Optional[str] = Field(None, description="Special requirements or focus areas for therapy")

    # Metadata
    encounter_type: Optional[str] = Field("OPD", description="Encounter type: OPD, IPD, Emergency, Teleconsultation")
    booking_source: Optional[str] = Field("staff", description="How appointment was booked")

    # Recurrence (if mentioned)
    is_recurring: bool = Field(False, description="Whether this is a recurring appointment")
    recurrence_pattern: Optional[str] = Field(None, description="Recurrence pattern (e.g., 'weekly for 8 weeks')")

    # Confidence and notes
    extraction_confidence: float = Field(1.0, description="Confidence score 0-1")
    extraction_notes: Optional[str] = Field(None, description="Any ambiguities or issues during extraction")

    class Config:
        json_schema_extra = {
            "example": {
                "patient_name": "John Doe",
                "patient_phone": "9876543210",
                "appointment_date": "2026-03-15",
                "appointment_time": "09:00",
                "provider_name": "Dr. Smith",
                "service_name": "Cardiology OPD",
                "service_type": "OPD",
                "contact_number": "9876543210",
                "chief_complaint": "Chest pain checkup"
            }
        }


class ServiceAwareLLMService:
    """
    Extended LLM service with service booking support
    """

    def __init__(self, provider: str = 'openai'):
        """Initialize LLM service"""
        self.provider = provider.lower()
        self.openai_client = None
        self.anthropic_client = None

        # Initialize clients
        if self.provider == 'openai':
            if not OPENAI_AVAILABLE:
                raise ImportError("OpenAI package not installed")
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY not set")
            self.openai_client = openai.OpenAI(api_key=api_key)

        elif self.provider == 'anthropic':
            if not ANTHROPIC_AVAILABLE:
                raise ImportError("Anthropic package not installed")
            api_key = os.getenv('ANTHROPIC_API_KEY')
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not set")
            self.anthropic_client = anthropic.Anthropic(api_key=api_key)

        # Track usage
        self.total_tokens = 0
        self.total_calls = 0

    def extract_service_appointments(
        self,
        text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> tuple[List[Dict], Dict]:
        """
        Extract service appointment data from unstructured text

        Args:
            text: Raw text containing appointment information
            context: Additional context (file type, headers, etc.)

        Returns:
            Tuple of (extracted_appointments, metadata)
        """
        if self.provider == 'openai':
            return self._extract_services_with_openai(text, context)
        elif self.provider == 'anthropic':
            return self._extract_services_with_anthropic(text, context)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def _extract_services_with_openai(self, text: str, context: Optional[Dict] = None) -> tuple[List[Dict], Dict]:
        """Extract service appointments using OpenAI GPT-4"""
        try:
            prompt = self._build_service_extraction_prompt(text, context)

            response = self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {
                        "role": "system",
                        "content": self._get_service_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            result = json.loads(response.choices[0].message.content)

            self.total_tokens += response.usage.total_tokens
            self.total_calls += 1

            metadata = {
                'provider': 'openai',
                'model': 'gpt-4-turbo-preview',
                'tokens_used': response.usage.total_tokens,
                'finish_reason': response.choices[0].finish_reason
            }

            appointments = result.get('appointments', [])
            return appointments, metadata

        except Exception as e:
            logger.error(f"OpenAI service extraction error: {str(e)}")
            raise

    def _extract_services_with_anthropic(self, text: str, context: Optional[Dict] = None) -> tuple[List[Dict], Dict]:
        """Extract service appointments using Anthropic Claude"""
        try:
            prompt = self._build_service_extraction_prompt(text, context)

            message = self.anthropic_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                temperature=0,
                system=self._get_service_system_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            content = message.content[0].text

            # Remove markdown if present
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()

            result = json.loads(content)

            self.total_tokens += message.usage.input_tokens + message.usage.output_tokens
            self.total_calls += 1

            metadata = {
                'provider': 'anthropic',
                'model': 'claude-3-5-sonnet-20241022',
                'tokens_used': message.usage.input_tokens + message.usage.output_tokens,
                'stop_reason': message.stop_reason
            }

            appointments = result.get('appointments', [])
            return appointments, metadata

        except Exception as e:
            logger.error(f"Anthropic service extraction error: {str(e)}")
            raise

    def _get_service_system_prompt(self) -> str:
        """Get system prompt for service extraction"""
        return """You are an expert medical appointment data extraction assistant for a healthcare facility that offers multiple services: IPD (In-Patient), OPD (Out-Patient), Physiotherapy, and Home Care.

Your task is to extract structured appointment information from various formats, with special attention to SERVICE-SPECIFIC fields.

CRITICAL INSTRUCTIONS:

1. EXTRACT ALL APPOINTMENTS found in the data

2. IDENTIFY SERVICE TYPE:
   - Look for keywords: IPD, OPD, Physiotherapy, Home Care, admission, consultation, therapy, home visit
   - Check department/service names
   - Infer from context (e.g., "bed number" → IPD, "home visit" → HOME_CARE)
   - Service types: IPD, OPD, PHYSIOTHERAPY, HOME_CARE

3. SERVICE-SPECIFIC REQUIRED FIELDS:

   ALL Services REQUIRE:
   - contact_number: Phone number for appointment contact (CRITICAL)

   HOME_CARE REQUIRES:
   - home_address: MUST extract complete home service address (CRITICAL)

   IPD SHOULD HAVE:
   - admission_date: When admitted (default to appointment_date if not specified)
   - bed_number: Bed/ward assignment (extract if mentioned)
   - preferred_ward: Ward preference (General, ICU, Private, etc.)
   - emergency_contact_name and emergency_contact_number

   PHYSIOTHERAPY SHOULD HAVE:
   - therapy_type: Type of therapy (pain management, sports injury, post-surgery)
   - therapy_sessions: Number of sessions

   ALL Services OPTIONALLY:
   - insurance_info: Insurance provider and policy number

4. DATA NORMALIZATION:
   - Normalize dates to YYYY-MM-DD format
   - Convert times to 24-hour HH:MM format
   - Standardize service types to: IPD, OPD, PHYSIOTHERAPY, HOME_CARE
   - Extract full addresses for HOME_CARE services

5. CONFIDENCE SCORING:
   - Set extraction_confidence to 1.0 for complete data
   - Lower to 0.8-0.9 if some optional fields missing
   - Lower to 0.6-0.7 if required service fields missing
   - Add extraction_notes explaining any issues

6. METADATA EXTRACTION:
   - Capture bed_number, ward info for IPD
   - Capture therapy_type, sessions for Physiotherapy
   - Capture equipment_provided, visit_frequency for Home Care
   - Extract insurance details for all types

Return ONLY a valid JSON object with an "appointments" array containing the extracted appointment objects.
Do not include any markdown formatting or code blocks, just pure JSON."""

    def _build_service_extraction_prompt(self, text: str, context: Optional[Dict] = None) -> str:
        """Build extraction prompt with service context"""
        prompt_parts = []

        if context:
            prompt_parts.append("File Information:")
            if context.get('file_type'):
                prompt_parts.append(f"- File type: {context['file_type']}")
            if context.get('headers'):
                prompt_parts.append(f"- Column headers: {', '.join(context['headers'])}")
            prompt_parts.append("")

        prompt_parts.append("Data to extract (includes SERVICE BOOKINGS):")
        prompt_parts.append("```")
        prompt_parts.append(text)
        prompt_parts.append("```")
        prompt_parts.append("")
        prompt_parts.append("Extract all appointments with service information as a JSON object with an 'appointments' array.")
        prompt_parts.append("")
        prompt_parts.append("IMPORTANT: Identify service types and extract service-specific fields!")

        return "\n".join(prompt_parts)

    def get_usage_stats(self) -> Dict:
        """Get LLM usage statistics"""
        return {
            'provider': self.provider,
            'total_tokens': self.total_tokens,
            'total_calls': self.total_calls,
            'estimated_cost': self._estimate_cost()
        }

    def _estimate_cost(self) -> str:
        """Estimate API cost"""
        if self.provider == 'openai':
            total_cost = (self.total_tokens / 1000) * 0.02
            return f"${total_cost:.2f}"
        elif self.provider == 'anthropic':
            cost = (self.total_tokens / 1000) * 0.015
            return f"${cost:.2f}"
        return "$0.00"
