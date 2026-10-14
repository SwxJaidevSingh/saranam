"""Prescription versioning service — Cloudinary PDF storage + version chain.

PDFs are stored privately in Cloudinary (type='private'): they are not publicly
deliverable and can only be fetched via a short-lived signed URL minted
server-side. The backend fetches + streams the bytes itself (see routes), so the
Cloudinary URL is never exposed to clients and every download is logged.
"""
import hashlib
import json
import logging
import os
from io import BytesIO

from app.extensions import db
from app.saranam.models.prescription_version import (
    PrescriptionVersion, PrescriptionPdfDownload,
)

logger = logging.getLogger(__name__)


def _prescription_folder():
    """Dedicated folder for prescription PDFs, under the configured base folder.

    e.g. CLOUDINARY_FOLDER=nashik-dc -> 'nashik-dc/prescriptions'. Falls back to
    'cvraman/prescriptions' when CLOUDINARY_FOLDER isn't set.
    """
    base = (os.environ.get('CLOUDINARY_FOLDER') or 'cvraman').strip().rstrip('/')
    return f'{base}/prescriptions'


def cloudinary_ready():
    return bool(os.environ.get('CLOUDINARY_URL') or os.environ.get('CLOUDINARY_CLOUD_NAME'))


def _cfg():
    """Ensure the cloudinary SDK is configured and return the module.

    CLOUDINARY_URL (if set) auto-configures the SDK on import; otherwise fall
    back to the explicit cloud_name/api_key/api_secret triple.
    """
    import cloudinary
    if os.environ.get('CLOUDINARY_CLOUD_NAME'):
        cloudinary.config(
            cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
            api_key=os.environ.get('CLOUDINARY_API_KEY'),
            api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
            secure=True,
        )
    return cloudinary


def content_hash(snapshot, doctor):
    """Stable hash of the prescription content + prescriber, for re-issue dedupe."""
    payload = json.dumps({'s': snapshot or {}, 'd': doctor or {}}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def upload_pdf(pdf_bytes, public_id):
    """Upload a prescription PDF privately to Cloudinary. Returns the result dict."""
    cloudinary = _cfg()
    import cloudinary.uploader
    return cloudinary.uploader.upload(
        BytesIO(pdf_bytes),
        folder=_prescription_folder(),
        public_id=public_id,
        resource_type='raw',
        type='private',         # not publicly deliverable; signed fetch only
        overwrite=False,        # versions are immutable — never overwrite
    )


def fetch_pdf_bytes(version):
    """Fetch the stored PDF bytes for a version (Cloudinary or DB fallback)."""
    # DB fallback (no Cloudinary configured).
    if version.storage_kind == 'db' or (not version.cloudinary_public_id and version.pdf_data):
        return bytes(version.pdf_data) if version.pdf_data else b''

    import requests
    cloudinary = _cfg()
    import cloudinary.utils
    public_id = version.cloudinary_public_id
    rtype = version.cloudinary_resource_type or 'raw'
    # Signed delivery URL for the private asset.
    url, _opts = cloudinary.utils.cloudinary_url(
        public_id, resource_type=rtype, type='private', sign_url=True, secure=True,
    )
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def next_version_number(patient_id):
    last = (PrescriptionVersion.query
            .filter_by(patient_id=patient_id)
            .order_by(PrescriptionVersion.version_number.desc())
            .first())
    return (last.version_number + 1) if last else 1


def latest_version(patient_id):
    return (PrescriptionVersion.query
            .filter_by(patient_id=patient_id)
            .order_by(PrescriptionVersion.version_number.desc())
            .first())


def issue_version(*, patient_id, visit_id, plan_of_care_id, visit_type,
                  snapshot, doctor, pdf_bytes, created_by):
    """Create the next immutable version for a patient (dedupe unchanged re-issues).

    Returns (version, created: bool). If the content + doctor is identical to the
    patient's latest version, returns that version with created=False (no new PDF).
    """
    chash = content_hash(snapshot, doctor)
    latest = latest_version(patient_id)
    if latest is not None and latest.content_hash == chash:
        return latest, False

    vnum = next_version_number(patient_id)
    version = PrescriptionVersion(
        patient_id=patient_id,
        visit_id=visit_id,
        plan_of_care_id=plan_of_care_id,
        version_number=vnum,
        visit_type=visit_type,
        snapshot=snapshot,
        prescribing_doctor=doctor,
        content_hash=chash,
        created_by=created_by,
    )

    version.file_bytes = len(pdf_bytes) if pdf_bytes else None
    if cloudinary_ready():
        try:
            public_id = f'rx_{patient_id}_v{vnum}'
            result = upload_pdf(pdf_bytes, public_id)
            version.storage_kind = 'cloudinary'
            version.cloudinary_public_id = result.get('public_id')
            version.cloudinary_url = result.get('secure_url') or result.get('url')
            version.cloudinary_resource_type = result.get('resource_type') or 'raw'
            version.file_bytes = result.get('bytes') or version.file_bytes
        except Exception:
            logger.exception('Cloudinary prescription upload failed (patient %s v%s)', patient_id, vnum)
            raise
    else:
        # No Cloudinary configured — keep the PDF in the DB so the feature still
        # works end-to-end. Switches to Cloudinary automatically once creds exist.
        version.storage_kind = 'db'
        version.pdf_data = pdf_bytes

    db.session.add(version)
    db.session.commit()
    return version, True


def record_download(version, user_id):
    """Log a PDF download (analytics + medico-legal trail)."""
    dl = PrescriptionPdfDownload(
        version_id=version.id,
        patient_id=version.patient_id,
        downloaded_by=user_id,
    )
    db.session.add(dl)
    db.session.commit()
    return dl
