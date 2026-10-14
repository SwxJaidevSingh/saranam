"""Submissions module."""
from app.submissions.models import FormSubmission

# Backward compatibility
Submission = FormSubmission

__all__ = ['Submission', 'FormSubmission']