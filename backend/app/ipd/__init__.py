"""IPD (In-Patient Department) module."""
from app.ipd.models import Bed, IPDAdmission, BedAssignment, BedWaitingList, VitalsRecord

__all__ = ['Bed', 'IPDAdmission', 'BedAssignment', 'BedWaitingList', 'VitalsRecord']
