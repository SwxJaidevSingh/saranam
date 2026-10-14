"""
UHID (Unique Health ID) generation service.

UHID format: ``YYYY + ZZ + NNNN``
- ``YYYY``: 4-digit year of registration (e.g. ``2026``)
- ``ZZ``:  2-digit zone code (South=01, East=02, North=03, West=04, Central=05)
- ``NNNN``: zero-padded 4-digit sequence; grows to 5/6/etc digits when overflowing 9999

Examples: ``2026010001``, ``2026019999``, ``20260110000``

Counter scope: per ``(year, zone)``. Each combination has its own counter that
resets on a new year. Generated only for Bangalore-resident patients with a
``geographic_cluster`` set; non-Bangalore patients have ``uhid = None`` permanently.

Concurrency: uses ``INSERT … ON CONFLICT … DO UPDATE … RETURNING`` on the
counters table — single statement, atomic, no SELECT-then-INSERT race window.
A retry loop on ``IntegrityError`` provides defense-in-depth against the
``UNIQUE`` constraint on ``patients.uhid`` in the unlikely event of a clash.

Immutability contract: ``generate_uhid`` is called from
``VisitService.update_visit`` when a patient's initial assessment visit
transitions to ``status='completed'`` and the patient has no UHID yet.
The bulk-import path (``import_kidwai_patients.py``) sets UHIDs directly
from Excel without calling ``generate_uhid``. ``PatientService.create_patient``
does NOT assign a UHID — pre-baseline patients have ``uhid=NULL``.
``PatientService.update_patient`` does NOT regenerate UHID, even if
``geographic_cluster`` is changed. Admin-only ``regenerate_uhid`` is the
sole supported way to change a UHID after assignment, and it always logs to
``uhid_history``.

Zone code stability: the ``ZONE_CODES`` mapping is **append-only forever**.
Existing UHIDs embed historical zone codes; remapping a zone code would
silently invalidate the meaning of every prior UHID. If new zones are added,
add new code values; never reassign an existing one.
"""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError

from app.extensions import db


# ─── Constants ────────────────────────────────────────────────────────────────
# Single source of truth — schemas.py validator imports these names too.
ZONE_CODES = {
    'South':   '01',
    'East':    '02',
    'North':   '03',
    'West':    '04',
    'Central': '05',
}

# Public set used by the schemas validator
VALID_ZONE_NAMES = tuple(ZONE_CODES.keys())

# ─── Hospital catalog (DB-backed, admin-editable) ────────────────────────────
# Authoritative store: SystemSetting key 'hospital_options' (JSON array of
# {code, name, homecare_prefix, is_default, is_active, lat?, lng?}).
# Mutated via /api/patients/config/hospital-options routes.
#
# Immutability contract: the order of codes & their `homecare_prefix` must
# NEVER change retroactively — UHID numbers embed no hospital info, but the
# derived Homecare UHID Code prefix ('KAGBAKMIO' etc.) is displayed on
# historical records and PDFs. The PUT handler enforces this.
#
# The seed below is an internal fallback. It is used ONLY when the
# SystemSetting row is missing or empty (fresh install / migration pending)
# so the app can boot without a DB setup step. First successful POST/PUT
# materializes the row and the seed stops being consulted.
_SEED_HOSPITAL_CATALOG = {
    'KMIO': {
        'code': 'KMIO',
        'name': 'Kidwai Memorial Institute of Oncology',
        'homecare_prefix': 'KAGBAKMIO',  # KA + GBA + KMIO
        'is_default': True,
        'is_active': True,
    },
    'KCGH': {
        'code': 'KCGH',
        'name': 'KC General Hospital',
        'homecare_prefix': 'KAGBAKCGH',
        'is_default': False,
        'is_active': True,
    },
    'KIMS': {
        'code': 'KIMS',
        'name': 'Kempegowda Institute of Medical Sciences',
        'homecare_prefix': 'KAGBAKIMS',
        'is_default': False,
        'is_active': True,
    },
}

_MAX_RETRIES = 3


def get_hospital_catalog(include_inactive: bool = False) -> dict:
    """
    Return the hospital catalog as ``{code: {...}}``.

    Reads from ``SystemSetting.key == 'hospital_options'`` (JSON array of
    objects), falling back to ``_SEED_HOSPITAL_CATALOG`` when the row is
    missing or empty. Result is cached on ``flask.g`` for the current
    request so repeated reads during a single API call hit the DB once.

    Args:
        include_inactive: When True, soft-deleted entries (``is_active=False``)
            are included. Default False — dropdown callers get only live rows.

    Returns:
        Dict keyed by uppercase ``code``. Each value dict has keys
        ``code``, ``name``, ``homecare_prefix``, ``is_default``, ``is_active``
        (plus optional ``lat``, ``lng``).
    """
    from flask import g, has_app_context
    import json as _json
    from app.reminders.models import SystemSetting

    cache_key = '_hospital_catalog_all' if include_inactive else '_hospital_catalog_active'
    if has_app_context():
        cached = getattr(g, cache_key, None)
        if cached is not None:
            return cached

    try:
        setting = db.session.query(SystemSetting).filter(
            SystemSetting.key == 'hospital_options'
        ).first()
        items = None
        if setting and setting.value:
            try:
                items = _json.loads(setting.value)
            except (_json.JSONDecodeError, TypeError):
                items = None
        if not items:
            # Fall back to seed — fresh install or broken JSON.
            items = list(_SEED_HOSPITAL_CATALOG.values())
    except Exception:
        # DB unreachable — still return seed so read paths don't crash.
        items = list(_SEED_HOSPITAL_CATALOG.values())

    catalog = {}
    for entry in items:
        code = (entry.get('code') or '').upper()
        if not code:
            continue
        if not include_inactive and entry.get('is_active', True) is False:
            continue
        catalog[code] = {
            'code': code,
            'name': entry.get('name') or code,
            'homecare_prefix': entry.get('homecare_prefix') or f'KAGBA{code}',
            'is_default': bool(entry.get('is_default', False)),
            'is_active': bool(entry.get('is_active', True)),
            'lat': entry.get('lat'),
            'lng': entry.get('lng'),
        }

    if has_app_context():
        setattr(g, cache_key, catalog)
    return catalog


def invalidate_hospital_catalog_cache() -> None:
    """Drop any cached catalog on ``flask.g`` — call after POST/PUT/DELETE."""
    from flask import g, has_app_context
    if has_app_context():
        for key in ('_hospital_catalog_active', '_hospital_catalog_all'):
            if hasattr(g, key):
                delattr(g, key)


def get_valid_hospital_codes() -> tuple:
    """
    Return the tuple of codes that are acceptable in patient/vehicle inputs.

    Includes all currently-active catalog codes **plus** any code that is
    still referenced by live ``patients.linked_hospital`` or
    ``vehicles.base_hospital`` rows — this prevents validation failures
    when editing a patient whose hospital was soft-deleted.
    """
    active_codes = set(get_hospital_catalog(include_inactive=False).keys())
    try:
        from app.patients.models import Patient
        from app.saranam.models.vehicle import Vehicle
        referenced_patient = {
            r[0] for r in db.session.query(Patient.linked_hospital)
            .filter(Patient.linked_hospital.isnot(None))
            .distinct().all()
            if r[0]
        }
        referenced_vehicle = {
            r[0] for r in db.session.query(Vehicle.base_hospital)
            .filter(Vehicle.base_hospital.isnot(None))
            .distinct().all()
            if r[0]
        }
        active_codes |= referenced_patient | referenced_vehicle
    except Exception:
        # If DB query fails, fall back to active-only codes.
        pass
    return tuple(sorted(active_codes))


def get_default_hospital_code() -> str:
    """Return the code flagged ``is_default``; else first active; else 'KMIO'."""
    catalog = get_hospital_catalog(include_inactive=False)
    for entry in catalog.values():
        if entry.get('is_default'):
            return entry['code']
    if catalog:
        return next(iter(catalog.values()))['code']
    return 'KMIO'


def _format_uhid(year: int, zone_code: str, sequence: int) -> str:
    """Format the UHID string. Sequence pads to 4 digits but grows beyond when needed."""
    seq_str = f'{sequence:04d}' if sequence < 10000 else str(sequence)
    return f'{year}{zone_code}{seq_str}'


def generate_uhid(geographic_cluster: Optional[str], year: Optional[int] = None) -> Optional[str]:
    """
    Generate the next UHID for the given (year, zone) bucket.

    Atomic via UPSERT + RETURNING. Caller is responsible for the surrounding
    transaction commit; the increment commits together with whatever the
    caller adds to the same session.

    Args:
        geographic_cluster: Zone name (one of ``VALID_ZONE_NAMES``).
        year: Year to generate for. Defaults to current year.

    Returns:
        Formatted UHID string, or ``None`` if cluster is missing/invalid.
    """
    if not geographic_cluster or geographic_cluster not in ZONE_CODES:
        return None

    year = year or date.today().year
    zone_code = ZONE_CODES[geographic_cluster]

    last_err: Optional[Exception] = None
    for _attempt in range(_MAX_RETRIES):
        try:
            # Single-statement atomic upsert. The DO UPDATE clause is what
            # increments an existing row; the INSERT branch handles the
            # never-seen-before bucket case (the migration also seeds rows
            # for the current year × 5 zones, so this branch is rare).
            result = db.session.execute(
                text("""
                    INSERT INTO uhid_counters (year, zone_code, last_sequence, created_at, updated_at)
                    VALUES (:year, :zone, 1, NOW(), NOW())
                    ON CONFLICT (year, zone_code)
                    DO UPDATE SET
                        last_sequence = uhid_counters.last_sequence + 1,
                        updated_at = NOW()
                    RETURNING last_sequence
                """),
                {'year': year, 'zone': zone_code},
            )
            row = result.first()
            if row is None:
                # Should be impossible with RETURNING, but guard anyway.
                raise RuntimeError('UHID counter upsert returned no row')
            sequence = int(row[0])
            return _format_uhid(year, zone_code, sequence)
        except (IntegrityError, OperationalError) as exc:  # pragma: no cover - rare race
            last_err = exc
            db.session.rollback()
            continue

    # Exhausted retries — bubble up so caller's transaction fails loudly.
    raise RuntimeError(f'Failed to generate UHID after {_MAX_RETRIES} attempts') from last_err


def regenerate_uhid(patient, replaced_by: Optional[UUID], reason: Optional[str] = None) -> Optional[str]:
    """
    Admin-only: replace a patient's UHID with a fresh one for the current
    ``(year, zone)`` bucket. Records the change in ``uhid_history``.

    The old UHID number is **abandoned forever** — never reused, gap in the
    old zone/year sequence. Searching by old UHID still finds the patient
    via the history table join.

    Args:
        patient: Patient instance (must already be loaded in the session).
        replaced_by: User UUID performing the regeneration.
        reason: Optional human-readable reason for the audit log.

    Returns:
        The new UHID string, or ``None`` if the patient has no zone (in which
        case nothing is changed and history is not written).

    Raises:
        ValueError: if the patient is not Bangalore-resident or has no cluster.
    """
    from app.patients.models import UhidHistory  # local import to avoid cycle

    if not patient:
        raise ValueError('Patient instance is required')
    if not patient.is_bangalore_resident or not patient.geographic_cluster:
        raise ValueError('Cannot regenerate UHID for non-Bangalore patient or patient without zone')

    # Take a row lock on the patient row to serialize concurrent regenerate
    # requests for the same patient (prevents two admins clobbering each other).
    db.session.execute(
        text('SELECT id FROM patients WHERE id = :pid FOR UPDATE'),
        {'pid': str(patient.id)},
    )

    old_uhid = patient.uhid
    new_uhid = generate_uhid(patient.geographic_cluster)
    if new_uhid is None:
        raise ValueError(f'Could not generate UHID for cluster {patient.geographic_cluster!r}')

    # Record the replacement (only if there was an old value to replace)
    if old_uhid:
        history_row = UhidHistory(
            patient_id=patient.id,
            old_uhid=old_uhid,
            new_uhid=new_uhid,
            replaced_by=replaced_by,
            replaced_at=datetime.utcnow(),
            reason=reason,
        )
        db.session.add(history_row)

    patient.uhid = new_uhid
    return new_uhid


def get_homecare_code(hospital_code: Optional[str]) -> Optional[str]:
    """
    Return the 'KAGBAKMIO'-style Homecare UHID Code prefix for a hospital.

    Reads from the DB-backed catalog (with seed fallback). When the code
    isn't in the catalog at all (e.g. a patient referencing a hospital
    that's been hard-deleted), we still derive ``KAGBA + code`` so that
    historical PDFs/records continue to render a plausible prefix.

    Args:
        hospital_code: Hospital code string (e.g. ``'KMIO'``) or None.

    Returns:
        The prefix string (e.g. ``'KAGBAKMIO'``), or ``None`` if the
        code is empty.
    """
    if not hospital_code:
        return None
    code = hospital_code.upper()
    entry = get_hospital_catalog(include_inactive=True).get(code)
    if entry:
        return entry['homecare_prefix']
    # Unknown code — last-resort derivation so display never breaks.
    return f'KAGBA{code}'


def peek_next_uhid(
    geographic_cluster: Optional[str],
    hospital_code: Optional[str] = None,
    year: Optional[int] = None,
) -> Optional[dict]:
    """
    Read-only preview of the next UHID for a ``(year, zone)`` bucket.

    Does NOT lock or increment the counter — it's a best-effort peek intended
    for UX display while a user is filling the registration form. Another
    user creating a patient concurrently may consume the previewed number;
    the actual value is only known at create time. Callers should surface
    this as a *probable* UHID to avoid misleading users.

    Args:
        geographic_cluster: Zone name (one of ``VALID_ZONE_NAMES``).
        hospital_code: Optional hospital code for the derived Homecare Code
            prefix. If None, ``homecare_code``/``full_display`` are left None.
        year: Optional year override; defaults to current year.

    Returns:
        Dict with keys ``homecare_code``, ``next_uhid``, ``full_display``,
        ``year``, ``zone_code`` — or ``None`` if zone is missing/invalid.
    """
    if not geographic_cluster or geographic_cluster not in ZONE_CODES:
        return None

    year = year or date.today().year
    zone_code = ZONE_CODES[geographic_cluster]

    # Read current counter without locking. Defaults to 0 if no row exists
    # (rare — the migration seeds counter rows for the current year × 5 zones).
    row = db.session.execute(
        text("""
            SELECT last_sequence
            FROM uhid_counters
            WHERE year = :year AND zone_code = :zone
        """),
        {'year': year, 'zone': zone_code},
    ).first()

    last_sequence = int(row[0]) if row else 0
    next_sequence = last_sequence + 1
    next_uhid = _format_uhid(year, zone_code, next_sequence)

    homecare_code = get_homecare_code(hospital_code)
    full_display = (
        f'{homecare_code} {next_uhid}' if homecare_code else next_uhid
    )

    return {
        'homecare_code': homecare_code,
        'next_uhid': next_uhid,
        'full_display': full_display,
        'year': year,
        'zone_code': zone_code,
        'is_preview': True,
    }
