"""
Pure Logic Validation Engine
No LLM - only deterministic validation rules
"""

import re
import phonenumbers
from datetime import datetime, date, time, timedelta
from typing import Dict, List, Tuple, Optional, Any
from dateutil import parser as date_parser
import logging

logger = logging.getLogger(__name__)


class FieldValidationError:
    """Structured validation error"""
    def __init__(self, field: str, message: str, severity: str = 'error'):
        self.field = field
        self.message = message
        self.severity = severity

    def to_dict(self):
        return {
            'field': self.field,
            'message': self.message,
            'severity': self.severity
        }


class FieldValidators:
    """Collection of field-level validators"""

    @staticmethod
    def validate_patient_name(value: Any) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validate patient name

        Returns:
            (is_valid, cleaned_value, error_message)
        """
        if not value or str(value).strip() == '':
            return False, None, "Patient name is required"

        name = str(value).strip()

        if len(name) < 2:
            return False, None, "Patient name must be at least 2 characters"

        if len(name) > 100:
            return False, None, "Patient name must not exceed 100 characters"

        # Check for valid characters (letters, spaces, dots, apostrophes)
        if not re.match(r"^[a-zA-Z\s.'-]+$", name):
            return False, None, "Patient name contains invalid characters"

        return True, name, None

    @staticmethod
    def validate_phone_number(value: Any, country: str = 'IN') -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validate phone number

        Returns:
            (is_valid, cleaned_value, error_message)
        """
        if not value or str(value).strip() == '':
            return False, None, "Phone number is required"

        phone = str(value).strip()

        # Remove common separators
        phone = re.sub(r'[\s\-\(\)]', '', phone)

        # Try to parse with phonenumbers library
        try:
            if not phone.startswith('+'):
                # Assume Indian number if no country code
                if country == 'IN' and len(phone) == 10:
                    phone = '+91' + phone

            parsed = phonenumbers.parse(phone, None)

            if not phonenumbers.is_valid_number(parsed):
                return False, None, "Invalid phone number format"

            # Return in E.164 format
            formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            return True, formatted, None

        except Exception as e:
            # Fallback: Simple validation for 10-15 digit numbers
            digits_only = re.sub(r'\D', '', str(value))
            if 10 <= len(digits_only) <= 15:
                return True, digits_only, None

            return False, None, f"Invalid phone number: {str(e)}"

    @staticmethod
    def validate_email(value: Any) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validate email (optional field)

        Returns:
            (is_valid, cleaned_value, error_message)
        """
        if not value or str(value).strip() == '':
            return True, None, None  # Email is optional

        email = str(value).strip().lower()

        # RFC 5322 compliant regex (simplified)
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

        if not re.match(email_regex, email):
            return False, None, "Invalid email format"

        if len(email) > 255:
            return False, None, "Email too long (max 255 characters)"

        return True, email, None

    @staticmethod
    def validate_date_of_birth(value: Any) -> Tuple[bool, Optional[date], Optional[str]]:
        """
        Validate date of birth

        Returns:
            (is_valid, parsed_date, error_message)
        """
        if not value or str(value).strip() == '':
            return True, None, None  # DOB is optional

        try:
            # Try parsing various date formats
            parsed_date = DateTimeParser.parse_date(str(value))

            if not parsed_date:
                return False, None, "Could not parse date format"

            # Check if date is reasonable (not in future, not too old)
            today = date.today()
            if parsed_date > today:
                return False, None, "Date of birth cannot be in the future"

            age = (today - parsed_date).days // 365
            if age > 150:
                return False, None, "Date of birth seems too old (>150 years)"

            return True, parsed_date, None

        except Exception as e:
            return False, None, f"Invalid date format: {str(e)}"

    @staticmethod
    def validate_appointment_date(value: Any) -> Tuple[bool, Optional[date], Optional[str]]:
        """
        Validate appointment date

        Returns:
            (is_valid, parsed_date, error_message)
        """
        if not value or str(value).strip() == '':
            return False, None, "Appointment date is required"

        try:
            parsed_date = DateTimeParser.parse_date(str(value))

            if not parsed_date:
                return False, None, "Could not parse date format"

            # Must be future date or today
            today = date.today()
            if parsed_date < today:
                # Warning instead of error for past dates
                return True, parsed_date, "WARNING: Appointment is in the past"

            # Check not too far in future (2 years)
            max_future = today + timedelta(days=730)
            if parsed_date > max_future:
                return False, None, "Appointment date too far in future (>2 years)"

            return True, parsed_date, None

        except Exception as e:
            return False, None, f"Invalid date format: {str(e)}"

    @staticmethod
    def validate_appointment_time(value: Any) -> Tuple[bool, Optional[time], Optional[str]]:
        """
        Validate appointment time

        Returns:
            (is_valid, parsed_time, error_message)
        """
        if not value or str(value).strip() == '':
            return False, None, "Appointment time is required"

        try:
            parsed_time = DateTimeParser.parse_time(str(value))

            if not parsed_time:
                return False, None, "Could not parse time format (use HH:MM)"

            return True, parsed_time, None

        except Exception as e:
            return False, None, f"Invalid time format: {str(e)}"

    @staticmethod
    def validate_duration(value: Any) -> Tuple[bool, Optional[int], Optional[str]]:
        """
        Validate duration in minutes

        Returns:
            (is_valid, duration_int, error_message)
        """
        if not value or str(value).strip() == '':
            return True, None, None  # Duration is optional

        try:
            duration = int(value)

            if duration <= 0:
                return False, None, "Duration must be positive"

            if duration > 480:  # 8 hours
                return False, None, "Duration too long (max 480 minutes)"

            # Check if it's a reasonable slot duration
            valid_durations = [15, 30, 45, 60, 90, 120, 180, 240]
            if duration not in valid_durations:
                # Return warning but allow
                return True, duration, f"WARNING: Unusual duration {duration} mins"

            return True, duration, None

        except ValueError:
            return False, None, "Duration must be a number"

    @staticmethod
    def validate_appointment_type(value: Any) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validate appointment type

        Returns:
            (is_valid, cleaned_value, error_message)
        """
        if not value or str(value).strip() == '':
            return True, None, None  # Optional field

        appt_type = str(value).strip().lower()

        valid_types = [
            'consultation', 'followup', 'follow-up', 'follow_up',
            'procedure', 'emergency', 'routine', 'checkup', 'check-up'
        ]

        # Normalize
        type_map = {
            'follow-up': 'followup',
            'follow_up': 'followup',
            'check-up': 'checkup',
            'checkup': 'consultation'
        }

        normalized = type_map.get(appt_type, appt_type)

        if normalized not in ['consultation', 'followup', 'procedure', 'emergency', 'routine']:
            return True, appt_type, f"WARNING: Unrecognized appointment type '{appt_type}'"

        return True, normalized, None


class DateTimeParser:
    """Utility class for parsing dates and times in various formats"""

    @staticmethod
    def parse_date(date_str: str) -> Optional[date]:
        """
        Parse date from various formats:
        - YYYY-MM-DD (ISO)
        - DD/MM/YYYY
        - DD-MM-YYYY
        - DD.MM.YYYY
        - MM/DD/YYYY (US format)
        - Various others supported by dateutil
        """
        if not date_str:
            return None

        date_str = str(date_str).strip()

        # Try common formats first for better performance
        common_formats = [
            '%Y-%m-%d',      # 2026-03-20
            '%d/%m/%Y',      # 20/03/2026
            '%d-%m-%Y',      # 20-03-2026
            '%d.%m.%Y',      # 20.03.2026
            '%Y/%m/%d',      # 2026/03/20
            '%m/%d/%Y',      # 03/20/2026 (US format)
        ]

        for fmt in common_formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue

        # Fallback to dateutil parser (more flexible but slower)
        try:
            # dayfirst=True for DD/MM/YYYY preference
            parsed = date_parser.parse(date_str, dayfirst=True)
            return parsed.date()
        except Exception:
            return None

    @staticmethod
    def parse_time(time_str: str) -> Optional[time]:
        """
        Parse time from various formats:
        - HH:MM (24-hour)
        - HH:MM:SS
        - H:MM AM/PM
        """
        if not time_str:
            return None

        time_str = str(time_str).strip()

        # Try common formats
        common_formats = [
            '%H:%M',         # 14:30
            '%H:%M:%S',      # 14:30:00
            '%I:%M %p',      # 02:30 PM
            '%I:%M%p',       # 02:30PM
        ]

        for fmt in common_formats:
            try:
                return datetime.strptime(time_str, fmt).time()
            except ValueError:
                continue

        # Fallback to dateutil parser
        try:
            parsed = date_parser.parse(time_str)
            return parsed.time()
        except Exception:
            return None


class RowValidator:
    """Validates an entire row from CSV/XLSX"""

    def __init__(self):
        self.field_validators = FieldValidators()

    def validate_row(self, row_data: Dict[str, Any]) -> Tuple[bool, List[FieldValidationError], List[FieldValidationError]]:
        """
        Validate entire row

        Returns:
            (is_valid, errors, warnings)
        """
        errors = []
        warnings = []

        # Validate patient_name (required)
        is_valid, cleaned, error_msg = self.field_validators.validate_patient_name(
            row_data.get('patient_name')
        )
        if not is_valid:
            errors.append(FieldValidationError('patient_name', error_msg, 'error'))
        elif error_msg and 'WARNING' in error_msg:
            warnings.append(FieldValidationError('patient_name', error_msg, 'warning'))

        # Validate patient_phone (required)
        is_valid, cleaned, error_msg = self.field_validators.validate_phone_number(
            row_data.get('patient_phone')
        )
        if not is_valid:
            errors.append(FieldValidationError('patient_phone', error_msg, 'error'))
        elif error_msg and 'WARNING' in error_msg:
            warnings.append(FieldValidationError('patient_phone', error_msg, 'warning'))

        # Validate patient_email (optional)
        is_valid, cleaned, error_msg = self.field_validators.validate_email(
            row_data.get('patient_email')
        )
        if not is_valid:
            errors.append(FieldValidationError('patient_email', error_msg, 'error'))

        # Validate patient_dob (optional)
        is_valid, cleaned, error_msg = self.field_validators.validate_date_of_birth(
            row_data.get('patient_dob')
        )
        if not is_valid:
            errors.append(FieldValidationError('patient_dob', error_msg, 'error'))
        elif error_msg and 'WARNING' in error_msg:
            warnings.append(FieldValidationError('patient_dob', error_msg, 'warning'))

        # Validate appointment_date (required)
        is_valid, cleaned, error_msg = self.field_validators.validate_appointment_date(
            row_data.get('appointment_date')
        )
        if not is_valid:
            errors.append(FieldValidationError('appointment_date', error_msg, 'error'))
        elif error_msg and 'WARNING' in error_msg:
            warnings.append(FieldValidationError('appointment_date', error_msg, 'warning'))

        # Validate appointment_time (required)
        is_valid, cleaned, error_msg = self.field_validators.validate_appointment_time(
            row_data.get('appointment_time')
        )
        if not is_valid:
            errors.append(FieldValidationError('appointment_time', error_msg, 'error'))

        # Validate duration (optional)
        is_valid, cleaned, error_msg = self.field_validators.validate_duration(
            row_data.get('duration_minutes')
        )
        if not is_valid:
            errors.append(FieldValidationError('duration_minutes', error_msg, 'error'))
        elif error_msg and 'WARNING' in error_msg:
            warnings.append(FieldValidationError('duration_minutes', error_msg, 'warning'))

        # Validate appointment_type (optional)
        is_valid, cleaned, error_msg = self.field_validators.validate_appointment_type(
            row_data.get('appointment_type')
        )
        if not is_valid:
            errors.append(FieldValidationError('appointment_type', error_msg, 'error'))
        elif error_msg and 'WARNING' in error_msg:
            warnings.append(FieldValidationError('appointment_type', error_msg, 'warning'))

        # Provider name check (required)
        if not row_data.get('provider_name') or str(row_data.get('provider_name')).strip() == '':
            errors.append(FieldValidationError('provider_name', 'Provider name is required', 'error'))

        # Overall validation
        is_valid = len(errors) == 0

        return is_valid, errors, warnings
