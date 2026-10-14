"""Portal email helper — thin env-configured wrapper over the app's SMTP sender.

The heavy SMTP plumbing (MIME assembly, STARTTLS on 587, login, sendmail) already
exists in `app.reminders.notification_service.EmailService.send`. We REUSE it here
rather than re-implement smtplib. This module only:

  - reads SMTP config from env (SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD/
    SMTP_FROM_NAME),
  - exposes a simple `send_email(to, subject, html_body, text_body=None)` signature,
  - DEGRADES GRACEFULLY: if SMTP isn't configured (no username/password) it logs a
    warning and returns False instead of raising — so an onboarding/invite request
    never 500s just because email isn't wired up in this environment.

`INVITE_BASE_URL` (default the portal dev URL) is used to build accept links.
"""
import os
import logging

from app.reminders.notification_service import EmailService

logger = logging.getLogger(__name__)

# Default portal dev URL — overridable via env for staging/prod.
DEFAULT_INVITE_BASE_URL = 'http://localhost:5174'
# Default MAIN dashboard dev URL — overridable via env for staging/prod.
DEFAULT_APP_BASE_URL = 'http://localhost:5173'


def get_invite_base_url():
    """Base URL the HOSPITAL PORTAL frontend serves the accept-invite page from.

    Trailing slash trimmed so callers can safely do f'{base}/accept-invite?...'.
    """
    return (os.environ.get('INVITE_BASE_URL') or DEFAULT_INVITE_BASE_URL).rstrip('/')


def get_app_base_url():
    """Base URL the MAIN DASHBOARD frontend serves from (accept-invite / reset).

    Used for platform-user invites and password resets, which target the main
    dashboard, not the hospital portal. Override via APP_BASE_URL in prod.
    """
    return (os.environ.get('APP_BASE_URL') or DEFAULT_APP_BASE_URL).rstrip('/')


def _smtp_settings():
    """Build the settings dict EmailService.send expects, from env vars."""
    return {
        'smtp_host': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        'smtp_port': os.environ.get('SMTP_PORT', '587'),
        'smtp_username': os.environ.get('SMTP_USERNAME'),
        'smtp_password': os.environ.get('SMTP_PASSWORD'),
        'smtp_from_name': os.environ.get('SMTP_FROM_NAME', 'CV Raman Health'),
    }


def send_email(to, subject, html_body, text_body=None):
    """Send an email via Gmail SMTP (STARTTLS on 587), reusing EmailService.

    Args:
        to: recipient email address.
        subject: email subject line.
        html_body: HTML body. EmailService also derives a plain-text part from it.
        text_body: optional explicit plain-text body (currently informational;
            EmailService strips tags from html_body for the text part).

    Returns:
        bool — True if SMTP accepted the message, False if SMTP is unconfigured
        or the send failed. NEVER raises into the request path.
    """
    settings = _smtp_settings()

    if not settings.get('smtp_username') or not settings.get('smtp_password'):
        # Not configured (common in dev / this validation env). Degrade quietly:
        # log enough to debug, but do not crash the calling request.
        logger.warning(
            'SMTP not configured (SMTP_USERNAME/SMTP_PASSWORD unset); '
            'skipping email to %s with subject %r', to, subject)
        return False

    try:
        result = EmailService.send(
            to_email=to,
            subject=subject,
            body_html=html_body,
            settings=settings,
        )
    except Exception:
        # EmailService.send already catches SMTP errors, but guard defensively
        # so onboarding/invite requests never bubble a 500 from email.
        logger.exception('send_email failed to %s', to)
        return False

    if not result.get('success'):
        logger.warning('send_email to %s failed: %s', to, result.get('error'))
        return False
    return True
