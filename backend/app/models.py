"""
Central models module - imports all models for SQLAlchemy registry.

This ensures all models are registered before any relationships are resolved,
preventing circular import issues.
"""

# Import all models in dependency order
from app.common.models import BaseModel, User
# Organizations: multi-tenant foundation (Hospital Portal Phase 1). Imported
# before Patient because patients.organization_id FKs to organizations.id.
from app.organizations.models import (
    Organization, OrganizationMembership, OrganizationInvite
)
from app.forms.models import Form
from app.patients.models import Patient, PatientCaregiver
from app.providers.models import HealthcareProvider, ProviderSchedule
from app.services.models import Service, ServiceProvider, ServiceSchedule, ServiceForm
from app.consent.models import ConsentArtifact, ConsentAccessLog
from app.encounters.models import Encounter
from app.appointments.models import AppointmentReminder
from app.observations.models import Observation
from app.diagnoses.models import Diagnosis
from app.submissions.models import FormSubmission, FormAnswer
from app.audit.models import AuditLog
from app.risk.models import FieldRiskRule, FormRiskLevel, SubmissionRiskScore, FieldSection
from app.ai.models import AIFormSession, AIGenerationLog
from app.cohorts.models import PatientCohort, CohortMember, CohortActivity, CohortOutcome
from app.ipd.models import Bed, IPDAdmission, BedAssignment, BedWaitingList, VitalsRecord
from app.form_configurations.models import FormConfiguration, ClinicalDocumentation
from app.analytics.models import PatientSymptom, PatientRiskAssessment, PatientLocation, NearbyHospital
from app.inventory.models import (
    MedicineMaster, InventoryLocation, InventoryStock, Supplier,
    PurchaseOrder, PurchaseOrderItem, MedicineBatch, StockMovement,
    DispensingRecord, MedicineRequisition, RequisitionItem, StockAlert
)
from app.opd.models import OPDPrescription, OPDPrescriptionItem, OPDLabOrder, OPDLabOrderItem
from app.reminders.models import SystemSetting, ReminderLog
from app.saranam.models.patient_visit import PatientVisit
from app.saranam.models.nursing_assessment import NursingAssessment
from app.saranam.models.doctor_assessment import DoctorAssessment
from app.saranam.models.psychological_assessment import PsychologicalAssessment
from app.saranam.models.physiotherapy_assessment import PhysiotherapyAssessment
from app.saranam.models.esas_score import EsasScore
from app.saranam.models.pps_score import PpsScore
from app.saranam.models.plan_of_care import PlanOfCare
from app.saranam.models.schedule_config import ScheduleConfig
from app.saranam.models.geographic_cluster import GeographicCluster
from app.saranam.models.vehicle import Vehicle
from app.saranam.models.weekly_schedule import WeeklySchedule
from app.saranam.models.schedule_day import ScheduleDay
from app.saranam.models.schedule_slot import ScheduleSlot
from app.saranam.models.schedule_team_assignment import ScheduleTeamAssignment
from app.saranam.models.patient_scheduling_meta import PatientSchedulingMeta
from app.saranam.models.schedule_audit_log import ScheduleAuditLog
from app.saranam.models.on_call_roster import OnCallRoster
from app.saranam.models.schedule_notification import ScheduleNotification
from app.saranam.models.procedures_record import ProceduresRecord
from app.saranam.models.daily_vehicle_schedule import DailyVehicleSchedule
from app.saranam.models.vehicle_log import VehicleLog

# Teleconsult module
from app.teleconsult.models.tele_session import TeleSession
from app.teleconsult.models.tele_notification import TeleNotification

__all__ = [
    'BaseModel',
    'User',
    'Organization',
    'OrganizationMembership',
    'OrganizationInvite',
    'Form',
    'Patient',
    'PatientCaregiver',
    'HealthcareProvider',
    'ProviderSchedule',
    'Service',
    'ServiceProvider',
    'ServiceSchedule',
    'ServiceForm',
    'ConsentArtifact',
    'ConsentAccessLog',
    'Encounter',
    'AppointmentReminder',
    'Observation',
    'Diagnosis',
    'FormSubmission',
    'FormAnswer',
    'AuditLog',
    'FieldRiskRule',
    'FormRiskLevel',
    'SubmissionRiskScore',
    'FieldSection',
    'AIFormSession',
    'AIGenerationLog',
    'PatientCohort',
    'CohortMember',
    'CohortActivity',
    'CohortOutcome',
    'Bed',
    'IPDAdmission',
    'BedAssignment',
    'BedWaitingList',
    'VitalsRecord',
    'FormConfiguration',
    'ClinicalDocumentation',
    'PatientSymptom',
    'PatientRiskAssessment',
    'PatientLocation',
    'NearbyHospital',
    'MedicineMaster',
    'InventoryLocation',
    'InventoryStock',
    'Supplier',
    'PurchaseOrder',
    'PurchaseOrderItem',
    'MedicineBatch',
    'StockMovement',
    'DispensingRecord',
    'MedicineRequisition',
    'RequisitionItem',
    'StockAlert',
    'OPDPrescription',
    'OPDPrescriptionItem',
    'OPDLabOrder',
    'OPDLabOrderItem',
    'PatientVisit',
    'NursingAssessment',
    'DoctorAssessment',
    'PsychologicalAssessment',
    'PhysiotherapyAssessment',
    'EsasScore',
    'PpsScore',
    'PlanOfCare',
    'ScheduleConfig',
    'GeographicCluster',
    'Vehicle',
    'WeeklySchedule',
    'ScheduleDay',
    'ScheduleSlot',
    'ScheduleTeamAssignment',
    'PatientSchedulingMeta',
    'ScheduleAuditLog',
    'OnCallRoster',
    'ScheduleNotification',
    'ProceduresRecord',
    'TeleSession',
    'TeleNotification',
]
