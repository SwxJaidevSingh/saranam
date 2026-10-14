"""Org-scoped analytics endpoints for the Hospital Portal (`/api/portal/analytics/*`).

ISOLATION (security-critical): EVERY aggregate in this module is built on top of
the org scope so a regular org user's counts include ONLY their org's patients.
The single base is `_scoped_count_query(tenant_ctx)` →
`apply_org_scope(db.session.query(...), Patient, ctx)`, which mirrors
`scoped_patient_query` but on a `db.session.query(...)` so we can select raw
aggregate expressions instead of whole Patient rows. A platform admin in unscoped
god view (no active org) sees all orgs; acting-as-org (X-Org-Id) sees just that
org. NEVER write a raw unscoped `Patient.query` here.

The ONE cross-org endpoint, `GET /analytics/by-org`, is restricted to platform
admins (403 otherwise) — it is the only place that may span organizations.

Efficiency: counts/trends/breakdowns use SQL aggregates (`func.count`,
`func.date_trunc`, grouped `CASE`) — no Python loops over patient rows.

Reuse: age-band bucketing reuses `app.analytics.age_bands` (AGE_BANDS labels +
ordering) so the portal and the main dashboard share one WHO scheme; the bands
are translated into a SQL `CASE` so bucketing stays in the database. The geo
helper in `app.analytics.geo_analytics` is NOT reused — it joins PatientLocation
and runs unscoped — so geography here is a fresh org-scoped group-by on
`Patient.geographic_cluster`.
"""
from datetime import datetime, timedelta

from flask import jsonify, request
from sqlalchemy import func, case

from app.extensions import db
from app.patients.models import Patient
from app.organizations.models import Organization
from app.portal import portal_bp
from app.portal.context import portal_auth
from app.portal.scoping import apply_org_scope
from app.analytics.age_bands import AGE_BANDS, UNKNOWN_DOB_LABEL


# ── Scoped base query ─────────────────────────────────────────────────────────

def _scoped_count_query(ctx, *entities):
    """A `db.session.query(*entities)` scoped to the caller's org.

    This is the SINGLE isolation chokepoint for every analytics aggregate. It
    delegates to `apply_org_scope(query, Patient, ctx)`, which:
      - returns the query UNCHANGED for an unscoped platform-admin god view, and
      - otherwise filters `Patient.organization_id == ctx.active_org_id`.

    Because `active_org_id` is only ever set to an org the caller has an active
    membership in (context.resolve_tenant_context), this can never leak another
    org's rows. Defaults to selecting `func.count(Patient.id)` when no explicit
    entities are given.
    """
    if not entities:
        entities = (func.count(Patient.id),)
    query = db.session.query(*entities).select_from(Patient)
    return apply_org_scope(query, Patient, ctx)


# ── Age-band SQL CASE (reuses app.analytics.age_bands.AGE_BANDS) ──────────────

def _age_expr():
    """Integer age in whole years from `date_of_birth`, computed in SQL.

    Uses Postgres `age()`/`date_part` so bucketing happens in the database, not
    a Python loop. NULL DOB stays NULL → lands in the Unknown band.
    """
    return func.date_part('year', func.age(Patient.date_of_birth))


def _age_band_case():
    """A SQL CASE mapping age → WHO band label, reusing AGE_BANDS bounds/order.

    Mirrors `age_bands.bucket_for_age`: NULL DOB → Unknown; otherwise the first
    band where min <= age <= max (the open-ended final band has max=None).
    """
    age = _age_expr()
    whens = []
    for label, lo, hi in AGE_BANDS:
        if hi is None:
            cond = age >= lo
        else:
            cond = (age >= lo) & (age <= hi)
        whens.append((cond, label))
    return case(*whens, else_=UNKNOWN_DOB_LABEL)


def _ordered_band_labels():
    """Band labels in display order, then Unknown — for zero-filling output."""
    return [label for label, _, _ in AGE_BANDS] + [UNKNOWN_DOB_LABEL]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@portal_bp.route('/analytics/summary', methods=['GET'])
@portal_auth()
def analytics_summary(tenant_ctx):
    """Headline counts for the caller's org (god view = all orgs).

    Shape: {
      total_patients, active, inactive, deceased,
      new_this_week, new_this_month
    }
    'active'/'inactive' use care_status combined with is_active; 'deceased' uses
    is_deceased. New-counts are by created_at.
    """
    now = datetime.utcnow()
    week_start = now - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total = _scoped_count_query(tenant_ctx).scalar() or 0
    deceased = _scoped_count_query(tenant_ctx).filter(
        Patient.is_deceased.is_(True)
    ).scalar() or 0
    # Active = alive AND care_status active AND row active.
    active = _scoped_count_query(tenant_ctx).filter(
        Patient.is_active.is_(True),
        Patient.is_deceased.is_(False),
        Patient.care_status == 'active',
    ).scalar() or 0
    # Inactive = everyone not deceased and not counted as active above.
    inactive = max(total - deceased - active, 0)

    new_this_week = _scoped_count_query(tenant_ctx).filter(
        Patient.created_at >= week_start
    ).scalar() or 0
    new_this_month = _scoped_count_query(tenant_ctx).filter(
        Patient.created_at >= month_start
    ).scalar() or 0

    return jsonify({
        'total_patients': total,
        'active': active,
        'inactive': inactive,
        'deceased': deceased,
        'new_this_week': new_this_week,
        'new_this_month': new_this_month,
    }), 200


@portal_bp.route('/analytics/intake-trend', methods=['GET'])
@portal_auth()
def analytics_intake_trend(tenant_ctx):
    """Time series of patient creations, grouped by day|week|month.

    Query params: period=day|week|month (default month); periods=<int> number
    of trailing periods to include (default 12, clamped 1..60).

    Shape: { period, series: [{ bucket: 'YYYY-MM-DD', count }] } — buckets are
    truncated period starts (ISO date), oldest → newest, only periods with data.
    Uses func.date_trunc so the grouping happens in SQL.
    """
    period = request.args.get('period', 'month').lower()
    if period not in ('day', 'week', 'month'):
        period = 'month'

    try:
        periods = int(request.args.get('periods', 12))
    except (TypeError, ValueError):
        periods = 12
    periods = max(1, min(periods, 60))

    # Sensible trailing window per period granularity.
    span_days = {'day': periods, 'week': periods * 7, 'month': periods * 31}[period]
    start = datetime.utcnow() - timedelta(days=span_days)

    bucket = func.date_trunc(period, Patient.created_at).label('bucket')
    rows = (
        _scoped_count_query(tenant_ctx, bucket, func.count(Patient.id))
        .filter(Patient.created_at >= start)
        .group_by(bucket)
        .order_by(bucket)
        .all()
    )

    series = [
        {
            'bucket': row.bucket.date().isoformat() if row.bucket else None,
            'count': row[1],
        }
        for row in rows
    ]
    return jsonify({'period': period, 'series': series}), 200


@portal_bp.route('/analytics/origin-breakdown', methods=['GET'])
@portal_auth()
def analytics_origin_breakdown(tenant_ctx):
    """Patient counts grouped by origin_type, including a 'none' (NULL) bucket.

    Shape: { breakdown: [{ origin_type, count }], total } — sorted by count desc.
    """
    rows = (
        _scoped_count_query(tenant_ctx, Patient.origin_type, func.count(Patient.id))
        .group_by(Patient.origin_type)
        .all()
    )
    breakdown = [
        {'origin_type': (row[0] if row[0] else 'none'), 'count': row[1]}
        for row in rows
    ]
    breakdown.sort(key=lambda r: r['count'], reverse=True)
    return jsonify({
        'breakdown': breakdown,
        'total': sum(r['count'] for r in breakdown),
    }), 200


@portal_bp.route('/analytics/top-sources', methods=['GET'])
@portal_auth()
def analytics_top_sources(tenant_ctx):
    """Top referral sources by patient count.

    Grouped by COALESCE(origin_source_code, origin_source_name) so a source is
    identified by its catalog code, falling back to the free-text name. Sources
    with neither are bucketed as 'Unknown source'.

    Query param: limit (default 10, clamped 1..50).
    Shape: { sources: [{ source, count }] } — count desc.
    """
    try:
        limit = int(request.args.get('limit', 10))
    except (TypeError, ValueError):
        limit = 10
    limit = max(1, min(limit, 50))

    source = func.coalesce(
        func.nullif(Patient.origin_source_code, ''),
        func.nullif(Patient.origin_source_name, ''),
    ).label('source')

    rows = (
        _scoped_count_query(tenant_ctx, source, func.count(Patient.id))
        .group_by(source)
        .order_by(func.count(Patient.id).desc())
        .limit(limit)
        .all()
    )
    sources = [
        {'source': (row[0] if row[0] else 'Unknown source'), 'count': row[1]}
        for row in rows
    ]
    return jsonify({'sources': sources}), 200


@portal_bp.route('/analytics/demographics', methods=['GET'])
@portal_auth()
def analytics_demographics(tenant_ctx):
    """Age-band distribution (WHO scheme) + gender distribution.

    Age bands reuse app.analytics.age_bands.AGE_BANDS (labels + order), bucketed
    in SQL via a CASE on date_part(age(dob)). Gender is collapsed
    case-insensitively (Title case) to merge 'Male'/'male'/'MALE'.

    Shape: {
      age_bands: [{ band, count }]    # full scheme, zero-filled, in order
      gender:    [{ gender, count }]  # count desc
    }
    """
    # Age bands — grouped CASE so the database does the bucketing.
    band = _age_band_case().label('band')
    age_rows = (
        _scoped_count_query(tenant_ctx, band, func.count(Patient.id))
        .group_by(band)
        .all()
    )
    counts = {row[0]: row[1] for row in age_rows}
    age_bands = [
        {'band': label, 'count': counts.get(label, 0)}
        for label in _ordered_band_labels()
    ]

    # Gender — case-insensitive collapse to Title case. Lowercase + group in SQL,
    # then title-case the small result set (a handful of distinct values).
    gkey = func.lower(func.trim(Patient.gender)).label('g')
    gender_rows = (
        _scoped_count_query(tenant_ctx, gkey, func.count(Patient.id))
        .filter(Patient.gender.isnot(None), func.trim(Patient.gender) != '')
        .group_by(gkey)
        .all()
    )
    gbuckets = {}
    for row in gender_rows:
        label = (row[0] or '').title()
        if not label:
            continue
        gbuckets[label] = gbuckets.get(label, 0) + row[1]
    gender = [
        {'gender': k, 'count': v}
        for k, v in sorted(gbuckets.items(), key=lambda kv: -kv[1])
    ]

    return jsonify({'age_bands': age_bands, 'gender': gender}), 200


@portal_bp.route('/analytics/geography', methods=['GET'])
@portal_auth()
def analytics_geography(tenant_ctx):
    """Patient counts by geographic_cluster (org-scoped).

    NOTE: app.analytics.geo_analytics.GeoAnalyticsService is NOT reused — it
    joins PatientLocation and queries unscoped, which would break org isolation.
    This is a fresh org-scoped group-by on Patient.geographic_cluster, with NULL
    cluster bucketed as 'Unknown'.

    Shape: { clusters: [{ cluster, count }] } — count desc.
    """
    rows = (
        _scoped_count_query(tenant_ctx, Patient.geographic_cluster, func.count(Patient.id))
        .group_by(Patient.geographic_cluster)
        .all()
    )
    clusters = [
        {'cluster': (row[0] if row[0] else 'Unknown'), 'count': row[1]}
        for row in rows
    ]
    clusters.sort(key=lambda r: r['count'], reverse=True)
    return jsonify({'clusters': clusters}), 200


@portal_bp.route('/analytics/by-org', methods=['GET'])
@portal_auth()
def analytics_by_org(tenant_ctx):
    """Cross-org patient counts — PLATFORM ADMIN ONLY (403 otherwise).

    This is the ONLY analytics endpoint allowed to span organizations, and only
    for platform admins. A regular org user (even an org_admin) gets 403 — they
    must never see other orgs' counts.

    Shape: { organizations: [{ organization_id, code, name, count }] } —
    count desc. Includes orgs with zero patients via an outer join.
    """
    if not tenant_ctx.is_platform_admin:
        return jsonify({
            'message': 'Cross-organization analytics are restricted to platform admins.',
            'error': 'platform_admin_required',
        }), 403

    # Deliberately UNSCOPED — platform-admin-only cross-org comparison. Outer
    # join so orgs with no patients still appear with count 0.
    rows = (
        db.session.query(
            Organization.id,
            Organization.code,
            Organization.name,
            func.count(Patient.id).label('count'),
        )
        .outerjoin(Patient, Patient.organization_id == Organization.id)
        .group_by(Organization.id, Organization.code, Organization.name)
        .order_by(func.count(Patient.id).desc())
        .all()
    )
    organizations = [
        {
            'organization_id': str(row[0]),
            'code': row[1],
            'name': row[2],
            'count': row[3],
        }
        for row in rows
    ]
    return jsonify({'organizations': organizations}), 200


def _get_scoped_deaths_by_month(tenant_ctx, months: int = 12) -> list:
    """Return a zero-filled month skeleton for deceased patients, scoped to organization."""
    from datetime import date
    today = date.today()

    skeleton = []
    year, month = today.year, today.month
    start_year, start_month = year, month
    for _ in range(months - 1):
        start_month -= 1
        if start_month == 0:
            start_month = 12
            start_year -= 1

    y, m = start_year, start_month
    for _ in range(months):
        skeleton.append({'month': f'{y:04d}-{m:02d}', 'count': 0})
        m += 1
        if m == 13:
            m = 1
            y += 1

    lower_bound = date(start_year, start_month, 1)

    query = db.session.query(Patient).filter(
        Patient.is_deceased.is_(True),
        Patient.date_of_death.isnot(None)
    )
    query = apply_org_scope(query, Patient, tenant_ctx)

    deceased = (
        query
        .filter(Patient.date_of_death >= lower_bound)
        .filter(Patient.date_of_death <= today)
        .all()
    )

    by_key = {b['month']: b for b in skeleton}
    for p in deceased:
        key = f'{p.date_of_death.year:04d}-{p.date_of_death.month:02d}'
        if key in by_key:
            by_key[key]['count'] += 1

    return skeleton


@portal_bp.route('/analytics/deaths', methods=['GET'])
@portal_auth()
def analytics_deaths(tenant_ctx):
    """Palliative outcome KPIs and map coordinates scoped to the caller's org.

    Query Parameters:
    - window_days (optional, default 30): rolling window for death count.

    Shape: {
      window_days,
      deaths_in_window,
      avg_visits_before_death,
      deceased_patients: [{
        patient_id, name, date_of_death, visit_count, gender, zone,
        latitude, longitude, address
      }],
      deaths_by_month: [{ month: 'YYYY-MM', count }]
    }
    """
    from datetime import date
    from app.saranam.models.patient_visit import PatientVisit
    from app.analytics.models import PatientLocation

    try:
        window_days = int(request.args.get('window_days', 30))
    except (TypeError, ValueError):
        window_days = 30
    window_days = max(1, min(window_days, 3650))

    today = date.today()
    window_start = today - timedelta(days=window_days)

    query = db.session.query(Patient).filter(
        Patient.is_deceased.is_(True),
        Patient.date_of_death.isnot(None)
    )
    query = apply_org_scope(query, Patient, tenant_ctx)

    deceased = (
        query
        .filter(Patient.date_of_death >= window_start)
        .filter(Patient.date_of_death <= today)
        .order_by(Patient.date_of_death.desc())
        .all()
    )

    deceased_list = []
    visit_counts = []
    for p in deceased:
        visit_count = (
            db.session.query(PatientVisit)
            .filter(PatientVisit.patient_id == p.id)
            .filter(PatientVisit.status == 'completed')
            .filter(PatientVisit.visit_date <= p.date_of_death)
            .count()
        )
        visit_counts.append(visit_count)

        loc = db.session.query(PatientLocation).filter(PatientLocation.patient_id == p.id).first()

        lat = float(loc.latitude) if (loc and loc.latitude is not None) else None
        lng = float(loc.longitude) if (loc and loc.longitude is not None) else None
        if lat is None or lng is None:
            meta = p.external_metadata or {}
            try:
                lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
            except (ValueError, TypeError):
                lat, lng = None, None

        deceased_list.append({
            'patient_id': str(p.id),
            'name': p.full_name,
            'date_of_death': p.date_of_death.isoformat(),
            'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else None,
            'visit_count': visit_count,
            'gender': p.gender or 'Unknown',
            'zone': p.geographic_cluster or 'Central',
            'bsc_status': p.bsc_status,
            'latitude': lat,
            'longitude': lng,
            'address': loc.address_full if loc else (p.external_metadata or {}).get('address'),
        })

    avg_visits = round(sum(visit_counts) / len(visit_counts), 1) if visit_counts else 0.0
    deaths_by_month = _get_scoped_deaths_by_month(tenant_ctx, months=12)

    return jsonify({
        'window_days': window_days,
        'deaths_in_window': len(deceased),
        'avg_visits_before_death': avg_visits,
        'deceased_patients': deceased_list,
        'deaths_by_month': deaths_by_month,
    }), 200


@portal_bp.route('/analytics/patient-locations', methods=['GET'])
@portal_auth()
def analytics_patient_locations(tenant_ctx):
    """Get active patient locations with risk levels for mapping, scoped to the organization."""
    from app.analytics.models import PatientLocation, PatientRiskAssessment

    # Subquery to get latest risk assessment date per patient
    subquery = db.session.query(
        PatientRiskAssessment.patient_id,
        func.max(PatientRiskAssessment.assessment_date).label('max_date')
    ).group_by(PatientRiskAssessment.patient_id).subquery()

    risk_query = db.session.query(
        PatientRiskAssessment.patient_id,
        PatientRiskAssessment.risk_level
    ).join(
        subquery,
        (PatientRiskAssessment.patient_id == subquery.c.patient_id) &
        (PatientRiskAssessment.assessment_date == subquery.c.max_date)
    ).subquery()

    query = db.session.query(
        Patient.id,
        Patient.full_name,
        Patient.date_of_birth,
        Patient.gender,
        Patient.external_metadata,
        PatientLocation.latitude,
        PatientLocation.longitude,
        PatientLocation.district,
        PatientLocation.address_full,
        Patient.geographic_cluster,
        Patient.bsc_status,
        risk_query.c.risk_level,
        Patient.is_deceased
    ).outerjoin(
        PatientLocation,
        PatientLocation.patient_id == Patient.id
    ).outerjoin(
        risk_query,
        risk_query.c.patient_id == Patient.id
    ).filter(
        Patient.is_active == True
    )

    query = apply_org_scope(query, Patient, tenant_ctx)
    patients = query.all()

    data = []
    for p in patients:
        meta = p.external_metadata or {}
        lat = p.latitude
        lng = p.longitude
        if lat is None or lng is None:
            try:
                lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
            except (ValueError, TypeError):
                lat, lng = None, None

        address = p.address_full or meta.get('address') or meta.get('full_address')

        data.append({
            'patient_id': str(p.id),
            'patient_name': p.full_name,
            'date_of_birth': p.date_of_birth.isoformat() if p.date_of_birth else None,
            'gender': p.gender or 'Unknown',
            'latitude': lat,
            'longitude': lng,
            'district': p.district or meta.get('location') or meta.get('base_location'),
            'address': address,
            'zone': p.geographic_cluster,
            'bsc_status': p.bsc_status,
            'risk_level': p.risk_level or 'Low',
            'is_deceased': p.is_deceased
        })

    return jsonify({'success': True, 'data': data}), 200


def _get_scoped_initial_and_latest_visits(tenant_ctx):
    from app.saranam.models.patient_visit import PatientVisit
    from app.patients.models import Patient
    from sqlalchemy import and_

    # Get patient IDs scoped to organization
    scoped_patients = db.session.query(Patient.id)
    scoped_patients = apply_org_scope(scoped_patients, Patient, tenant_ctx)
    scoped_pids = [r[0] for r in scoped_patients.all()]

    if not scoped_pids:
        return {}, {}

    # Subquery: min visit number per patient (initial)
    initial_sq = (
        db.session.query(
            PatientVisit.patient_id,
            func.min(PatientVisit.visit_number).label('min_num'),
        )
        .filter(PatientVisit.status.in_(['completed', 'in_progress']))
        .filter(PatientVisit.patient_id.in_(scoped_pids))
        .group_by(PatientVisit.patient_id)
        .subquery()
    )

    # Subquery: max visit number per patient (latest)
    latest_sq = (
        db.session.query(
            PatientVisit.patient_id,
            func.max(PatientVisit.visit_number).label('max_num'),
        )
        .filter(PatientVisit.status.in_(['completed', 'in_progress']))
        .filter(PatientVisit.patient_id.in_(scoped_pids))
        .group_by(PatientVisit.patient_id)
        .having(func.count(PatientVisit.id) >= 2)
        .subquery()
    )

    # Fetch initial visits
    initial_visits = (
        db.session.query(PatientVisit)
        .join(initial_sq, and_(
            PatientVisit.patient_id == initial_sq.c.patient_id,
            PatientVisit.visit_number == initial_sq.c.min_num,
        ))
        .join(latest_sq, PatientVisit.patient_id == latest_sq.c.patient_id)
        .all()
    )

    # Fetch latest visits
    latest_visits = (
        db.session.query(PatientVisit)
        .join(latest_sq, and_(
            PatientVisit.patient_id == latest_sq.c.patient_id,
            PatientVisit.visit_number == latest_sq.c.max_num,
        ))
        .all()
    )

    initial_map = {str(v.patient_id): v for v in initial_visits}
    latest_map = {str(v.patient_id): v for v in latest_visits}

    return initial_map, latest_map


@portal_bp.route('/analytics/vitals/summary', methods=['GET'])
@portal_auth()
def analytics_vitals_summary(tenant_ctx):
    """Get population-level vitals summary scoped to the organization."""
    from app.analytics.vitals_analytics import VITAL_COLUMN_MAP, REFERENCE_RANGES, _classify_change, _num

    try:
        initial_map, latest_map = _get_scoped_initial_and_latest_visits(tenant_ctx)
        patient_ids = set(initial_map.keys()) & set(latest_map.keys())

        vitals_summary = {}
        for vital_key, col_name in VITAL_COLUMN_MAP.items():
            counts = {'improved': 0, 'stable': 0, 'deteriorated': 0}
            initial_vals = []
            latest_vals = []

            for pid in patient_ids:
                init_val = getattr(initial_map[pid], col_name)
                lat_val = getattr(latest_map[pid], col_name)
                classification = _classify_change(vital_key, init_val, lat_val)
                if classification:
                    counts[classification] += 1
                init_num = _num(init_val)
                if init_num is not None:
                    initial_vals.append(init_num)
                lat_num = _num(lat_val)
                if lat_num is not None:
                    latest_vals.append(lat_num)

            total_classified = sum(counts.values())
            avg_initial = round(sum(initial_vals) / len(initial_vals), 1) if initial_vals else None
            avg_latest = round(sum(latest_vals) / len(latest_vals), 1) if latest_vals else None
            avg_change = round(avg_latest - avg_initial, 1) if avg_initial is not None and avg_latest is not None else None

            vitals_summary[vital_key] = {
                **counts,
                'total_classified': total_classified,
                'avg_initial': avg_initial,
                'avg_latest': avg_latest,
                'avg_change': avg_change,
                'unit': REFERENCE_RANGES[vital_key]['unit'],
            }

        # Overall improvement rate
        total_improved = sum(v['improved'] for v in vitals_summary.values())
        total_classified = sum(v['total_classified'] for v in vitals_summary.values())
        overall_improvement_rate = round(total_improved / total_classified * 100, 1) if total_classified > 0 else 0

        return jsonify({
            'success': True,
            'data': {
                'total_patients_with_vitals': len(patient_ids),
                'vitals_summary': vitals_summary,
                'overall_improvement_rate': overall_improvement_rate,
                'reference_ranges': REFERENCE_RANGES,
            }
        }), 200
    except Exception as e:
        print(f"Error in analytics_vitals_summary: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@portal_bp.route('/analytics/vitals/distribution', methods=['GET'])
@portal_auth()
def analytics_vitals_distribution(tenant_ctx):
    """Get distribution of latest vital values scoped to the organization."""
    from app.saranam.models.patient_visit import PatientVisit
    from app.patients.models import Patient
    from app.analytics.vitals_analytics import VITAL_COLUMN_MAP, DISTRIBUTION_BUCKETS, REFERENCE_RANGES, _num
    from sqlalchemy import and_

    try:
        # Get patient IDs scoped to organization
        scoped_patients = db.session.query(Patient.id)
        scoped_patients = apply_org_scope(scoped_patients, Patient, tenant_ctx)
        scoped_pids = [r[0] for r in scoped_patients.all()]

        if not scoped_pids:
            return jsonify({'success': True, 'data': {}}), 200

        # Subquery: max visit number per patient (latest)
        latest_sq = (
            db.session.query(
                PatientVisit.patient_id,
                func.max(PatientVisit.visit_number).label('max_num'),
            )
            .filter(PatientVisit.status.in_(['completed', 'in_progress']))
            .filter(PatientVisit.patient_id.in_(scoped_pids))
            .group_by(PatientVisit.patient_id)
            .subquery()
        )

        latest_visits = (
            db.session.query(PatientVisit)
            .join(latest_sq, and_(
                PatientVisit.patient_id == latest_sq.c.patient_id,
                PatientVisit.visit_number == latest_sq.c.max_num,
            ))
            .all()
        )

        distribution = {}
        for vital_key, col_name in VITAL_COLUMN_MAP.items():
            buckets = DISTRIBUTION_BUCKETS[vital_key]
            bucket_counts = {b[2]: 0 for b in buckets}

            for visit in latest_visits:
                val = _num(getattr(visit, col_name))
                if val is None:
                    continue
                for low, high, label in buckets:
                    if low <= val < high:
                        bucket_counts[label] += 1
                        break

            distribution[vital_key] = {
                'buckets': [{'range': label, 'count': count} for label, count in bucket_counts.items()],
                'total': sum(bucket_counts.values()),
                'unit': REFERENCE_RANGES[vital_key]['unit'],
                'normal_range': f"{REFERENCE_RANGES[vital_key]['min']}-{REFERENCE_RANGES[vital_key]['max']}",
            }

        return jsonify({'success': True, 'data': distribution}), 200
    except Exception as e:
        print(f"Error in analytics_vitals_distribution: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@portal_bp.route('/analytics/vitals/locations', methods=['GET'])
@portal_auth()
def analytics_vitals_locations(tenant_ctx):
    """Get latest vitals and coordinates for all active patients, scoped to organization."""
    from app.analytics.models import PatientLocation
    from app.saranam.models.patient_visit import PatientVisit
    from app.patients.models import Patient
    from sqlalchemy import and_

    try:
        # Get patient IDs scoped to organization
        scoped_patients = db.session.query(Patient.id)
        scoped_patients = apply_org_scope(scoped_patients, Patient, tenant_ctx)
        scoped_pids = [r[0] for r in scoped_patients.all()]

        if not scoped_pids:
            return jsonify({'success': True, 'data': []}), 200

        # Subquery for latest completed/in_progress visit per patient
        latest_sq = (
            db.session.query(
                PatientVisit.patient_id,
                func.max(PatientVisit.visit_number).label('max_num')
            )
            .filter(PatientVisit.status.in_(['completed', 'in_progress']))
            .filter(PatientVisit.patient_id.in_(scoped_pids))
            .group_by(PatientVisit.patient_id)
            .subquery()
        )

        results = (
            db.session.query(
                Patient.id,
                Patient.full_name,
                Patient.date_of_birth,
                Patient.external_metadata,
                PatientLocation.latitude,
                PatientLocation.longitude,
                PatientLocation.district,
                PatientLocation.address_full,
                Patient.gender,
                Patient.geographic_cluster,
                Patient.bsc_status,
                PatientVisit.vitals_bp_systolic,
                PatientVisit.vitals_bp_diastolic,
                PatientVisit.vitals_pr,
                PatientVisit.vitals_spo2,
                PatientVisit.vitals_temperature,
                PatientVisit.vitals_rr,
                PatientVisit.vitals_grbs
            )
            .outerjoin(PatientLocation, PatientLocation.patient_id == Patient.id)
            .join(latest_sq, latest_sq.c.patient_id == Patient.id)
            .join(
                PatientVisit,
                and_(
                     PatientVisit.patient_id == Patient.id,
                     PatientVisit.visit_number == latest_sq.c.max_num
                )
            )
            .filter(
                Patient.is_active == True
            )
            .all()
        )

        data = []
        for r in results:
            def _coerce_val(val):
                if val is None:
                    return None
                try:
                    return float(val)
                except:
                    return None

            meta = r.external_metadata or {}
            lat = r.latitude
            lng = r.longitude
            if lat is None or lng is None:
                try:
                    lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                    lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

            data.append({
                'patient_id': str(r.id),
                'patient_name': r.full_name,
                'date_of_birth': r.date_of_birth.isoformat() if r.date_of_birth else None,
                'latitude': lat,
                'longitude': lng,
                'district': r.district or meta.get('location') or meta.get('base_location'),
                'address': r.address_full if r.address_full else (meta.get('address') or r.district or meta.get('location') or meta.get('base_location')),
                'gender': r.gender or 'Unknown',
                'zone': r.geographic_cluster or 'Central',
                'bsc_status': r.bsc_status,
                'vitals': {
                    'bp_systolic': _coerce_val(r.vitals_bp_systolic),
                    'bp_diastolic': _coerce_val(r.vitals_bp_diastolic),
                    'pr': _coerce_val(r.vitals_pr),
                    'spo2': _coerce_val(r.vitals_spo2),
                    'temperature': _coerce_val(r.vitals_temperature),
                    'rr': _coerce_val(r.vitals_rr),
                    'grbs': _coerce_val(r.vitals_grbs)
                }
            })

        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        print(f"Error in analytics_vitals_locations: {e}")
        return jsonify({'error': str(e)}), 500


@portal_bp.route('/analytics/diseases/diagnoses', methods=['GET'])
@portal_auth()
def analytics_diseases_diagnoses(tenant_ctx):
    """Get patient diagnoses coordinates and stats, scoped to organization."""
    from app.analytics.models import PatientLocation
    from app.patients.models import Patient
    from app.saranam.models.doctor_assessment import DoctorAssessment
    from sqlalchemy import and_, func

    try:
        # Subquery to find the latest DoctorAssessment per patient
        latest_doc_sq = (
            db.session.query(
                DoctorAssessment.patient_id,
                func.max(DoctorAssessment.created_at).label('max_created')
            )
            .group_by(DoctorAssessment.patient_id)
            .subquery()
        )

        # Query active patients with coordinates and diagnosis, scoped to organization
        query = db.session.query(
            Patient.id,
            Patient.full_name,
            Patient.external_metadata,
            PatientLocation.latitude,
            PatientLocation.longitude,
            PatientLocation.district,
            Patient.diagnosis.label('patient_diag'),
            DoctorAssessment.diagnosis.label('doc_diag'),
            Patient.bsc_status
        ).outerjoin(PatientLocation, PatientLocation.patient_id == Patient.id) \
         .outerjoin(latest_doc_sq, latest_doc_sq.c.patient_id == Patient.id) \
         .outerjoin(
             DoctorAssessment,
             and_(
                 DoctorAssessment.patient_id == Patient.id,
                 DoctorAssessment.created_at == latest_doc_sq.c.max_created
             )
         )

        query = apply_org_scope(query, Patient, tenant_ctx)
        results = query.filter(Patient.is_active == True).all()

        data = []
        diagnoses_counts = {}

        for r in results:
            diag = r.doc_diag or r.patient_diag or 'Not Specified'
            if diag != 'Not Specified':
                diag = " ".join(diag.split()).title()
            meta = r.external_metadata or {}
            lat = r.latitude
            lng = r.longitude
            if lat is None or lng is None:
                try:
                    lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                    lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

            data.append({
                'patient_id': str(r.id),
                'patient_name': r.full_name,
                'latitude': lat,
                'longitude': lng,
                'district': r.district or meta.get('location') or meta.get('base_location'),
                'diagnosis': diag,
                'bsc_status': r.bsc_status
            })
            diagnoses_counts[diag] = diagnoses_counts.get(diag, 0) + 1

        # Format stats for chart without backend Top 5 truncation
        stats = []
        sorted_diags = sorted(diagnoses_counts.items(), key=lambda x: x[1], reverse=True)
        
        valid_total = sum(count for name, count in sorted_diags if name not in ['Not Specified', 'None', 'Null', ''])

        for name, count in sorted_diags:
            if name in ['Not Specified', 'None', 'Null', '']:
                continue
            pct = round((count / valid_total) * 100, 1) if valid_total else 0
            stats.append({'name': name, 'count': count, 'percentage': pct})

        return jsonify({'success': True, 'data': data, 'stats': stats}), 200
    except Exception as e:
        print(f"Error in analytics_diseases_diagnoses: {e}")
        return jsonify({'error': str(e)}), 500


@portal_bp.route('/analytics/diseases/complaints', methods=['GET'])
@portal_auth()
def analytics_diseases_complaints(tenant_ctx):
    """Get patient chief complaints coordinates and stats, scoped to organization."""
    from app.analytics.models import PatientLocation
    from app.patients.models import Patient
    from app.encounters.models import Encounter
    from app.saranam.models.doctor_assessment import DoctorAssessment
    from sqlalchemy import and_, func

    try:
        # Get patient IDs scoped to organization
        scoped_patients = db.session.query(Patient.id)
        scoped_patients = apply_org_scope(scoped_patients, Patient, tenant_ctx)
        scoped_pids = [r[0] for r in scoped_patients.all()]

        if not scoped_pids:
            return jsonify({'success': True, 'data': [], 'stats': []}), 200

        # Subquery for latest encounter start_time per patient
        latest_enc_sq = (
            db.session.query(
                Encounter.patient_id,
                func.max(Encounter.start_time).label('max_date')
            )
            .filter(Encounter.patient_id.in_(scoped_pids))
            .group_by(Encounter.patient_id)
            .subquery()
        )

        # Subquery for latest DoctorAssessment created_at per patient
        latest_doc_sq = (
            db.session.query(
                DoctorAssessment.patient_id,
                func.max(DoctorAssessment.created_at).label('max_created')
            )
            .filter(DoctorAssessment.patient_id.in_(scoped_pids))
            .group_by(DoctorAssessment.patient_id)
            .subquery()
        )

        # Query active patients with coordinates, latest Encounter chief complaint, and latest DoctorAssessment chief complaints
        results = (
            db.session.query(
                Patient.id,
                Patient.full_name,
                Patient.external_metadata,
                PatientLocation.latitude,
                PatientLocation.longitude,
                PatientLocation.district,
                Encounter.chief_complaint.label('enc_complaint'),
                DoctorAssessment.chief_complaints.label('doc_complaint'),
                Patient.bsc_status
            )
            .outerjoin(PatientLocation, PatientLocation.patient_id == Patient.id)
            .outerjoin(latest_enc_sq, latest_enc_sq.c.patient_id == Patient.id)
            .outerjoin(
                Encounter,
                and_(
                    Encounter.patient_id == Patient.id,
                    Encounter.start_time == latest_enc_sq.c.max_date
                )
            )
            .outerjoin(latest_doc_sq, latest_doc_sq.c.patient_id == Patient.id)
            .outerjoin(
                DoctorAssessment,
                and_(
                    DoctorAssessment.patient_id == Patient.id,
                    DoctorAssessment.created_at == latest_doc_sq.c.max_created
                )
            )
            .filter(
                Patient.is_active == True,
                Patient.id.in_(scoped_pids)
            )
            .all()
        )

        data = []
        complaints_counts = {}

        for r in results:
            complaint = r.doc_complaint or r.enc_complaint or 'No Complaint Recorded'
            if complaint != 'No Complaint Recorded':
                complaint = " ".join(complaint.split()).title()
            meta = r.external_metadata or {}
            lat = r.latitude
            lng = r.longitude
            if lat is None or lng is None:
                try:
                    lat = float(meta.get('latitude')) if meta.get('latitude') is not None else None
                    lng = float(meta.get('longitude')) if meta.get('longitude') is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

            data.append({
                'patient_id': str(r.id),
                'patient_name': r.full_name,
                'latitude': lat,
                'longitude': lng,
                'district': r.district or meta.get('location') or meta.get('base_location'),
                'chief_complaint': complaint,
                'bsc_status': r.bsc_status
            })
            complaints_counts[complaint] = complaints_counts.get(complaint, 0) + 1

        # Format stats for chart without backend Top 5 truncation
        stats = []
        sorted_complaints = sorted(complaints_counts.items(), key=lambda x: x[1], reverse=True)
        
        valid_total = sum(count for name, count in sorted_complaints if name not in ['No Complaint Recorded', 'None', 'Null', 'Not Specified', ''])

        for name, count in sorted_complaints:
            if name in ['No Complaint Recorded', 'None', 'Null', 'Not Specified', '']:
                continue
            pct = round((count / valid_total) * 100, 1) if valid_total else 0
            stats.append({'name': name, 'count': count, 'percentage': pct})

        return jsonify({'success': True, 'data': data, 'stats': stats}), 200
    except Exception as e:
        print(f"Error in analytics_diseases_complaints: {e}")
        return jsonify({'error': str(e)}), 500


