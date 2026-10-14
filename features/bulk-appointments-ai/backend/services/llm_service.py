"""
LLM Service
Multi-provider LLM service for intelligent data extraction
Supports OpenAI, Anthropic Claude, and local models
"""

import json
import os
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging

# LLM providers
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


# Pydantic models for structured output
class ExtractedAppointment(BaseModel):
    """Structured appointment data extracted by LLM"""
    # Patient information
    patient_name: str = Field(..., description="Full name of the patient")
    patient_phone: Optional[str] = Field(None, description="Patient phone number")
    patient_email: Optional[str] = Field(None, description="Patient email address")
    patient_dob: Optional[str] = Field(None, description="Patient date of birth (YYYY-MM-DD)")
    patient_gender: Optional[str] = Field(None, description="Patient gender (Male/Female/Other)")
    patient_abha_id: Optional[str] = Field(None, description="14-digit ABHA ID")

    # Provider information
    provider_name: Optional[str] = Field(None, description="Name of the healthcare provider/doctor")
    provider_specialization: Optional[str] = Field(None, description="Provider specialization")
    provider_department: Optional[str] = Field(None, description="Department name")

    # Appointment details
    appointment_date: str = Field(..., description="Appointment date (YYYY-MM-DD)")
    appointment_time: str = Field(..., description="Appointment time (HH:MM in 24-hour format)")
    appointment_type: Optional[str] = Field(None, description="Type: consultation, follow_up, teleconsultation, procedure, etc.")
    duration_minutes: Optional[int] = Field(30, description="Appointment duration in minutes")

    # Clinical information
    chief_complaint: Optional[str] = Field(None, description="Reason for visit / chief complaint")
    notes: Optional[str] = Field(None, description="Additional notes")

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
                "appointment_type": "consultation",
                "chief_complaint": "Follow-up checkup"
            }
        }


class LLMService:
    """
    Multi-provider LLM service for appointment data extraction
    """

    def __init__(self, provider: str = 'openai'):
        """
        Initialize LLM service

        Args:
            provider: LLM provider (openai, anthropic, local)
        """
        self.provider = provider.lower()
        self.openai_client = None
        self.anthropic_client = None

        # Initialize clients based on provider
        if self.provider == 'openai':
            if not OPENAI_AVAILABLE:
                raise ImportError("OpenAI package not installed. Run: pip install openai")
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY not set in environment")
            self.openai_client = openai.OpenAI(api_key=api_key)

        elif self.provider == 'anthropic':
            if not ANTHROPIC_AVAILABLE:
                raise ImportError("Anthropic package not installed. Run: pip install anthropic")
            api_key = os.getenv('ANTHROPIC_API_KEY')
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not set in environment")
            self.anthropic_client = anthropic.Anthropic(api_key=api_key)

        elif self.provider == 'local':
            # For local models (Ollama, LM Studio)
            # Would use requests or specific SDK
            pass

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

        # Track usage
        self.total_tokens = 0
        self.total_calls = 0

    def extract_appointments_from_text(
        self,
        text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> tuple[List[Dict], Dict]:
        """
        Extract appointment data from unstructured text

        Args:
            text: Raw text containing appointment information
            context: Additional context (file type, headers, etc.)

        Returns:
            Tuple of (extracted_appointments, metadata)
        """
        if self.provider == 'openai':
            return self._extract_with_openai(text, context)
        elif self.provider == 'anthropic':
            return self._extract_with_anthropic(text, context)
        elif self.provider == 'local':
            return self._extract_with_local(text, context)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def _extract_with_openai(self, text: str, context: Optional[Dict] = None) -> tuple[List[Dict], Dict]:
        """Extract using OpenAI GPT-4"""
        try:
            prompt = self._build_extraction_prompt(text, context)

            response = self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert medical appointment data extraction assistant for a healthcare facility.
Your task is to extract structured appointment information from various formats (spreadsheets, PDFs, text).

IMPORTANT INSTRUCTIONS:
1. Extract ALL appointments found in the data
2. Normalize dates to YYYY-MM-DD format
3. Convert times to 24-hour HH:MM format
4. Infer missing information when reasonable (e.g., duration = 30 mins if not specified)
5. Match common abbreviations (Dr. = Doctor, pt = patient, appt = appointment)
6. For recurring appointments, extract the pattern
7. If patient DOB is not found, leave it null
8. Always include extraction_confidence (0-1) based on data quality
9. Add extraction_notes for any ambiguities

Return a JSON array of appointment objects following the schema."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.1,  # Low temperature for consistent extraction
            )

            # Parse response
            result = json.loads(response.choices[0].message.content)

            # Update usage
            self.total_tokens += response.usage.total_tokens
            self.total_calls += 1

            metadata = {
                'provider': 'openai',
                'model': 'gpt-4-turbo-preview',
                'tokens_used': response.usage.total_tokens,
                'finish_reason': response.choices[0].finish_reason
            }

            # Extract appointments array
            appointments = result.get('appointments', [])

            return appointments, metadata

        except Exception as e:
            logger.error(f"OpenAI extraction error: {str(e)}")
            raise

    def _extract_with_anthropic(self, text: str, context: Optional[Dict] = None) -> tuple[List[Dict], Dict]:
        """Extract using Anthropic Claude"""
        try:
            prompt = self._build_extraction_prompt(text, context)

            message = self.anthropic_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                temperature=0,
                system="""You are an expert medical appointment data extraction assistant for a healthcare facility.
Your task is to extract structured appointment information from various formats (spreadsheets, PDFs, text).

IMPORTANT INSTRUCTIONS:
1. Extract ALL appointments found in the data
2. Normalize dates to YYYY-MM-DD format
3. Convert times to 24-hour HH:MM format
4. Infer missing information when reasonable (e.g., duration = 30 mins if not specified)
5. Match common abbreviations (Dr. = Doctor, pt = patient, appt = appointment)
6. For recurring appointments, extract the pattern
7. If patient DOB is not found, leave it null
8. Always include extraction_confidence (0-1) based on data quality
9. Add extraction_notes for any ambiguities

Return ONLY a valid JSON object with an "appointments" array containing the extracted appointment objects.
Do not include any markdown formatting or code blocks, just pure JSON.""",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Parse response
            content = message.content[0].text

            # Remove markdown code blocks if present
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()

            result = json.loads(content)

            # Update usage
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
            logger.error(f"Anthropic extraction error: {str(e)}")
            raise

    def _extract_with_local(self, text: str, context: Optional[Dict] = None) -> tuple[List[Dict], Dict]:
        """Extract using local model (Ollama/LM Studio)"""
        # Placeholder for local model implementation
        # Would use requests to call local API
        raise NotImplementedError("Local model extraction not yet implemented")

    def _build_extraction_prompt(self, text: str, context: Optional[Dict] = None) -> str:
        """Build extraction prompt with context"""
        prompt_parts = []

        if context:
            prompt_parts.append(f"File Information:")
            if context.get('file_type'):
                prompt_parts.append(f"- File type: {context['file_type']}")
            if context.get('headers'):
                prompt_parts.append(f"- Column headers: {', '.join(context['headers'])}")
            if context.get('sheet_name'):
                prompt_parts.append(f"- Sheet name: {context['sheet_name']}")
            prompt_parts.append("")

        prompt_parts.append("Data to extract:")
        prompt_parts.append("```")
        prompt_parts.append(text)
        prompt_parts.append("```")
        prompt_parts.append("")
        prompt_parts.append("Extract all appointments as a JSON object with an 'appointments' array.")

        return "\n".join(prompt_parts)

    def suggest_conflict_resolution(
        self,
        conflict_details: Dict,
        provider_schedule: Optional[Dict] = None
    ) -> Dict:
        """
        Use LLM to suggest alternative time slots for scheduling conflicts

        Args:
            conflict_details: Details about the conflict
            provider_schedule: Provider's available schedule

        Returns:
            Suggestions with alternative slots
        """
        if self.provider == 'openai':
            return self._suggest_with_openai(conflict_details, provider_schedule)
        elif self.provider == 'anthropic':
            return self._suggest_with_anthropic(conflict_details, provider_schedule)
        else:
            return {'suggestions': [], 'recommendation': 'Manual resolution required'}

    def _suggest_with_openai(self, conflict_details: Dict, provider_schedule: Optional[Dict]) -> Dict:
        """Generate suggestions using OpenAI"""
        prompt = f"""
Appointment Conflict:
{json.dumps(conflict_details, indent=2)}

Provider Schedule:
{json.dumps(provider_schedule, indent=2) if provider_schedule else 'Not provided'}

Suggest 3 alternative time slots that:
1. Are closest to the requested time
2. Fall within provider's schedule
3. Don't conflict with existing appointments

Return JSON with structure:
{{
  "suggestions": [
    {{"time": "HH:MM", "date": "YYYY-MM-DD", "reason": "...", "confidence": 0.9}}
  ],
  "recommendation": "Best option explanation"
}}
"""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are a medical appointment scheduling assistant."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error generating suggestions: {e}")
            return {'suggestions': [], 'recommendation': 'Error generating suggestions'}

    def _suggest_with_anthropic(self, conflict_details: Dict, provider_schedule: Optional[Dict]) -> Dict:
        """Generate suggestions using Anthropic"""
        # Similar implementation for Anthropic
        return {'suggestions': [], 'recommendation': 'Not implemented for Anthropic yet'}

    def get_usage_stats(self) -> Dict:
        """Get LLM usage statistics"""
        return {
            'provider': self.provider,
            'total_tokens': self.total_tokens,
            'total_calls': self.total_calls,
            'estimated_cost': self._estimate_cost()
        }

    def _estimate_cost(self) -> str:
        """Estimate API cost based on usage"""
        if self.provider == 'openai':
            # GPT-4 Turbo pricing (approximate)
            input_cost = 0.01  # per 1K tokens
            output_cost = 0.03  # per 1K tokens
            # Rough estimate (assume 60/40 split)
            total_cost = (self.total_tokens / 1000) * 0.02
            return f"${total_cost:.2f}"
        elif self.provider == 'anthropic':
            # Claude pricing (approximate)
            cost = (self.total_tokens / 1000) * 0.015
            return f"${cost:.2f}"
        return "$0.00"
