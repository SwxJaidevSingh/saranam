"""
Bulk Service Appointment Extension
Extends bulk appointment service to handle service bookings
(IPD, OPD, Physiotherapy, Home Care)
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
from rapidfuzz import fuzz, process

from app import db
from app.services.models import Service, ServiceType
from app.bulk_imports.models import BulkImportItem


logger = logging.getLogger(__name__)


class ServiceBookingExtension:
    """
    Extension methods for handling service bookings in bulk imports
    """

    @staticmethod
    def match_service(data: Dict) -> Optional[Dict]:
        """
        Match service by name, type, or department

        Args:
            data: Extracted appointment data with service info

        Returns:
            Service match info or None
        """
        service_name = data.get('service_name')
        service_type = data.get('service_type')
        department = data.get('provider_department')

        if not service_name and not service_type:
            return None

        # Get all active services
        services = Service.query.filter(Service.is_active == True).all()
        if not services:
            return None

        # Try exact service type match first
        if service_type:
            # Normalize service type
            service_type_normalized = ServiceBookingExtension._normalize_service_type(service_type)

            if service_type_normalized:
                # Filter by service type
                type_services = [s for s in services if s.service_type.value == service_type_normalized]

                if type_services:
                    # If service name provided, fuzzy match within type
                    if service_name:
                        service_names = {s.id: s.name for s in type_services}
                        match = process.extractOne(
                            service_name,
                            service_names,
                            scorer=fuzz.ratio,
                            score_cutoff=80
                        )

                        if match:
                            matched_name, score, service_id = match
                            return {
                                'id': service_id,
                                'match_type': 'fuzzy_name_with_type',
                                'match_score': score,
                                'service_type': service_type_normalized
                            }

                    # No name match, return first service of this type
                    return {
                        'id': type_services[0].id,
                        'match_type': 'type_only',
                        'match_score': 100,
                        'service_type': service_type_normalized
                    }

        # Try fuzzy name match across all services
        if service_name:
            service_names = {s.id: s.name for s in services}
            match = process.extractOne(
                service_name,
                service_names,
                scorer=fuzz.ratio,
                score_cutoff=75
            )

            if match:
                matched_name, score, service_id = match
                matched_service = next(s for s in services if s.id == service_id)
                return {
                    'id': service_id,
                    'match_type': 'fuzzy_name',
                    'match_score': score,
                    'service_type': matched_service.service_type.value
                }

        # Try department match
        if department:
            dept_services = [s for s in services if s.department and
                           fuzz.ratio(s.department.lower(), department.lower()) > 75]

            if dept_services:
                return {
                    'id': dept_services[0].id,
                    'match_type': 'department',
                    'match_score': 75,
                    'service_type': dept_services[0].service_type.value
                }

        return None

    @staticmethod
    def _normalize_service_type(service_type_str: str) -> Optional[str]:
        """
        Normalize service type string to enum value

        Args:
            service_type_str: Service type from data

        Returns:
            Normalized service type or None
        """
        service_type_lower = service_type_str.lower().strip()

        # Direct matches
        type_map = {
            'ipd': 'IPD',
            'in-patient': 'IPD',
            'inpatient': 'IPD',
            'admission': 'IPD',
            'opd': 'OPD',
            'out-patient': 'OPD',
            'outpatient': 'OPD',
            'consultation': 'OPD',
            'physiotherapy': 'PHYSIOTHERAPY',
            'physio': 'PHYSIOTHERAPY',
            'therapy': 'PHYSIOTHERAPY',
            'rehabilitation': 'PHYSIOTHERAPY',
            'rehab': 'PHYSIOTHERAPY',
            'home care': 'HOME_CARE',
            'home_care': 'HOME_CARE',
            'homecare': 'HOME_CARE',
            'home visit': 'HOME_CARE',
            'home service': 'HOME_CARE'
        }

        # Check direct matches
        for key, value in type_map.items():
            if key in service_type_lower:
                return value

        # Try exact enum match
        try:
            return ServiceType[service_type_str.upper()].value
        except (KeyError, AttributeError):
            pass

        return None

    @staticmethod
    def validate_service_fields(item: BulkImportItem, service_type: str) -> Tuple[List[Dict], List[Dict]]:
        """
        Validate service-specific required fields

        Args:
            item: Bulk import item
            service_type: Service type (IPD, OPD, PHYSIOTHERAPY, HOME_CARE)

        Returns:
            Tuple of (errors, warnings)
        """
        errors = []
        warnings = []
        data = item.extracted_data

        # All services require contact number
        if not data.get('contact_number') and not data.get('patient_phone'):
            errors.append({
                'field': 'contact_number',
                'message': 'Contact number is required for service bookings'
            })

        # Service-specific validation
        if service_type == 'HOME_CARE':
            # Home address is REQUIRED for HOME_CARE
            if not data.get('home_address'):
                errors.append({
                    'field': 'home_address',
                    'message': 'Home address is REQUIRED for HOME_CARE services'
                })

            # Warn if no visit frequency
            if not data.get('visit_frequency'):
                warnings.append({
                    'field': 'visit_frequency',
                    'message': 'Visit frequency not specified (daily, weekly, etc.)'
                })

        elif service_type == 'IPD':
            # Admission date defaults to appointment date
            if not data.get('admission_date'):
                warnings.append({
                    'field': 'admission_date',
                    'message': 'Admission date not specified, will default to appointment date'
                })

            # Bed number optional but recommended
            if not data.get('bed_number'):
                warnings.append({
                    'field': 'bed_number',
                    'message': 'Bed number not assigned, can be assigned during admission'
                })

            # Emergency contact recommended for IPD
            if not data.get('emergency_contact_name') or not data.get('emergency_contact_number'):
                warnings.append({
                    'field': 'emergency_contact',
                    'message': 'Emergency contact information recommended for IPD admissions'
                })

        elif service_type == 'PHYSIOTHERAPY':
            # Therapy type recommended
            if not data.get('therapy_type'):
                warnings.append({
                    'field': 'therapy_type',
                    'message': 'Therapy type not specified (pain management, sports injury, etc.)'
                })

            # Number of sessions helpful
            if not data.get('therapy_sessions'):
                warnings.append({
                    'field': 'therapy_sessions',
                    'message': 'Number of therapy sessions not specified'
                })

        # Insurance recommended for all
        if not data.get('insurance_info'):
            warnings.append({
                'field': 'insurance_info',
                'message': 'Insurance information not provided'
            })

        return errors, warnings

    @staticmethod
    def build_service_metadata(data: Dict, service_type: str) -> Dict:
        """
        Build service metadata from extracted data

        Args:
            data: Extracted appointment data
            service_type: Service type

        Returns:
            Service metadata dictionary
        """
        metadata = {
            'service_type': service_type,
            'contact_number': data.get('contact_number') or data.get('patient_phone')
        }

        # Insurance info (common to all)
        if data.get('insurance_info'):
            metadata['insurance_info'] = data.get('insurance_info')

        # Service-specific metadata
        if service_type == 'IPD':
            if data.get('bed_number'):
                metadata['bed_number'] = data.get('bed_number')
            if data.get('preferred_ward'):
                metadata['preferred_ward'] = data.get('preferred_ward')
            if data.get('emergency_contact_name'):
                metadata['emergency_contact_name'] = data.get('emergency_contact_name')
            if data.get('emergency_contact_number'):
                metadata['emergency_contact_number'] = data.get('emergency_contact_number')
            if data.get('notes'):
                metadata['admission_notes'] = data.get('notes')

        elif service_type == 'HOME_CARE':
            # Home address is required
            metadata['home_address'] = data.get('home_address')

            if data.get('equipment_provided'):
                # Parse equipment list
                equipment = data.get('equipment_provided')
                if isinstance(equipment, str):
                    # Split by comma or semicolon
                    equipment_list = [e.strip() for e in equipment.replace(';', ',').split(',')]
                    metadata['equipment_provided'] = equipment_list
                else:
                    metadata['equipment_provided'] = equipment

            if data.get('visit_frequency'):
                metadata['visit_frequency'] = data.get('visit_frequency')

            if data.get('special_requirements'):
                metadata['special_requirements'] = data.get('special_requirements')

        elif service_type == 'PHYSIOTHERAPY':
            if data.get('therapy_type'):
                metadata['therapy_type'] = data.get('therapy_type')
            if data.get('therapy_sessions'):
                metadata['therapy_sessions'] = data.get('therapy_sessions')
            if data.get('special_requirements'):
                metadata['special_requirements'] = data.get('special_requirements')

        # OPD doesn't have much service-specific metadata beyond contact and insurance

        return metadata

    @staticmethod
    def build_service_appointment_data(item: BulkImportItem, service_id: UUID, service_type: str) -> Dict:
        """
        Build appointment data for service booking

        Args:
            item: Bulk import item
            service_id: Matched service ID
            service_type: Service type

        Returns:
            Appointment data dictionary
        """
        from datetime import datetime, timedelta

        data = item.extracted_data

        # Build service metadata
        service_metadata = ServiceBookingExtension.build_service_metadata(data, service_type)

        # Parse date/time
        from dateutil import parser
        date = parser.parse(data['appointment_date']).date()
        time = parser.parse(data['appointment_time']).time()
        start_time = datetime.combine(date, time)

        # Build base appointment data
        appointment_data = {
            'patient_id': str(item.patient_id),
            'provider_id': str(item.provider_id) if item.provider_id else None,
            'start_time': start_time.isoformat(),
            'duration': data.get('duration_minutes', 30),
            'appointment_type': data.get('appointment_type', 'consultation'),
            'encounter_type': data.get('encounter_type', 'OPD'),
            'chief_complaint': data.get('chief_complaint'),
            'notes': data.get('notes'),
            'booking_source': 'staff',

            # Service-specific fields
            'service_id': str(service_id),
            'service_status': 'REQUESTED',
            'service_metadata': service_metadata
        }

        # IPD-specific fields
        if service_type == 'IPD':
            # Admission date defaults to appointment date
            admission_date = data.get('admission_date')
            if admission_date:
                appointment_data['admission_date'] = parser.parse(admission_date).isoformat()
            else:
                appointment_data['admission_date'] = start_time.isoformat()

            # Discharge date if provided
            if data.get('discharge_date'):
                appointment_data['discharge_date'] = parser.parse(data['discharge_date']).isoformat()

            # Bed number if provided
            if data.get('bed_number'):
                appointment_data['bed_number'] = data.get('bed_number')

        return appointment_data

    @staticmethod
    def get_service_statistics(items: List[BulkImportItem]) -> Dict:
        """
        Get service booking statistics

        Args:
            items: List of bulk import items

        Returns:
            Statistics dictionary
        """
        stats = {
            'total_service_bookings': 0,
            'by_service_type': {
                'IPD': 0,
                'OPD': 0,
                'PHYSIOTHERAPY': 0,
                'HOME_CARE': 0
            },
            'services_matched': 0,
            'missing_services': 0
        }

        for item in items:
            data = item.extracted_data
            if data.get('service_name') or data.get('service_type'):
                stats['total_service_bookings'] += 1

                if item.service_id:
                    stats['services_matched'] += 1

                    # Get service to determine type
                    service = Service.query.get(item.service_id)
                    if service:
                        service_type = service.service_type.value
                        stats['by_service_type'][service_type] = \
                            stats['by_service_type'].get(service_type, 0) + 1
                else:
                    stats['missing_services'] += 1

        return stats
