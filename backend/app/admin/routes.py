"""Manage Hospitals — PLATFORM ADMIN ONLY routes (`/api/admin`).

Saranam (platform) admins manage hospitals/orgs and their users from the MAIN
dashboard. This is the god-view counterpart to the org_admin self-service that
lives under /api/portal (see app.portal.admin_routes / invite_routes).

GATING — every handler is wrapped with @platform_admin_required, which itself
applies @jwt_required() and then verifies User.is_platform_admin (403 otherwise).
This is intentional defence-in-depth on top of the global realm gate in
app.__init__ (which already 403s non-platform JWTs on /api/* but lets token-less
requests through). See app/admin/__init__.py for the full auth model.

REUSE — we deliberately do not reinvent the Wave 2 logic:
  - invite token security (high-entropy token, store only sha256, 7-day TTL) and
    the PORTAL accept-link shape come straight from app.portal.invite_routes;
  - email sending + base URL come from app.portal.email_util (send_email,
    get_invite_base_url) — degrades gracefully when SMTP is unconfigured;
  - hospital-user creation mirrors app.portal.invite_routes.accept_invite
    (User role='viewer' on the main-app enum, is_approved/is_active True,
    is_platform_admin False) + an active OrganizationMembership.

HOSPITAL CATALOG SYNC — creating an org with a brand-new linked_hospital_code
APPENDS that code to the SystemSetting 'hospital_options' catalog (the same store
app.patients.uhid_service reads), so the portal's patient-create validation
(get_valid_hospital_codes) accepts it — exactly how KIMS/KIMS-style codes were
added. UHID generation is untouched (it never embeds hospital info).
"""
import hashlib
import json
import logging
import secrets
from datetime import datetime, timedelta
from functools import wraps
from uuid import UUID, uuid4

from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError, EXCLUDE

from app.extensions import db
from app.admin import admin_bp
from app.common.models import User
from app.organizations.models import (
    Organization, OrganizationMembership, OrganizationInvite,
)
# Shared Option B duplicate-account rules (same source of truth as the portal).
from app.organizations.email_realm import check_can_create_user, check_can_invite
# Reuse Wave 2 invite token + email helpers verbatim (do not reinvent).
from app.portal.email_util import send_email, get_invite_base_url

logger = logging.getLogger(__name__)

# Portal roles assignable to org users (membership.role). The User.role enum
# (admin|data_entry|viewer) is the MAIN-app role and is orthogonal — hospital
# users always get the least-privileged 'viewer' there.
ORG_ROLES = ('org_admin', 'org_data_entry', 'org_viewer')
ORG_TYPES = ('hospital', 'ngo', 'camp', 'internal')
ORG_STATUSES = ('pending_approval', 'active', 'suspended')

INVITE_TTL_DAYS = 7


# ─── Auth gate ───────────────────────────────────────────────────────────────
def platform_admin_required(fn):
    """Require a valid JWT whose User.is_platform_admin is True.

    Layers on top of the global realm gate: @jwt_required() turns token-less
    callers into 401 (the gate lets them through), and the is_platform_admin
    check 403s any non-platform identity that somehow reaches here. The resolved
    User is injected as the keyword arg `admin_user`.
    """
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        uid = get_jwt_identity()
        user = User.query.get(uid) if uid else None
        if user is None or not user.is_platform_admin:
            return jsonify({
                'message': 'Platform administrator access required',
                'error': 'platform_admin_required',
            }), 403
        kwargs['admin_user'] = user
        return fn(*args, **kwargs)
    return wrapper


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _coerce_uuid(value):
    """Validate a path/body UUID. Returns str(UUID) or None if malformed."""
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def _hash_token(raw_token):
    """Deterministic sha256 hex of the raw invite token (mirrors invite_routes)."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


def _get_org_or_404(org_id):
    """Resolve an org by id. Returns (org, None) or (None, (resp, status))."""
    coerced = _coerce_uuid(org_id)
    if not coerced:
        return None, (jsonify({'message': 'Invalid organization id',
                               'error': 'invalid_org_id'}), 400)
    org = Organization.query.get(coerced)
    if not org:
        return None, (jsonify({'message': 'Organization not found',
                               'error': 'org_not_found'}), 404)
    return org, None


def _ensure_hospital_code_in_catalog(code, name):
    """APPEND `code` to the 'hospital_options' catalog if not already present.

    Keeps the portal's patient-create validation (uhid_service
    .get_valid_hospital_codes) in sync so a freshly-created hospital org can
    immediately intake patients under its linked_hospital_code. Mirrors the
    write performed by the patients config routes (SystemSetting JSON array +
    cache invalidation). No-op when `code` is falsy or already catalogued.

    UHID generation is intentionally untouched — the catalog only governs the
    linked_hospital reference field, not the UHID counter.
    """
    if not code:
        return
    code = code.strip().upper()
    if not code:
        return

    # Lazy imports keep this module importable without a DB/app context.
    from app.reminders.models import SystemSetting
    from app.patients.uhid_service import (
        get_hospital_catalog, invalidate_hospital_catalog_cache,
    )

    # include_inactive=True so we never re-append a soft-deleted code.
    existing = get_hospital_catalog(include_inactive=True)
    if code in existing:
        return

    setting = db.session.query(SystemSetting).filter(
        SystemSetting.key == 'hospital_options'
    ).first()

    items = []
    if setting and setting.value:
        try:
            loaded = json.loads(setting.value)
            if isinstance(loaded, list):
                items = loaded
        except (json.JSONDecodeError, TypeError):
            items = []
    if not items:
        # Materialize from the current catalog (likely the in-code seed) so we
        # preserve existing entries (e.g. KMIO/KCGH) on first write.
        items = list(existing.values())

    items.append({
        'code': code,
        'name': (name or code).strip() or code,
        'homecare_prefix': f'KAGBA{code}',  # same default derivation as the config route
        'is_default': False,
        'is_active': True,
    })

    value = json.dumps(items)
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(
            id=uuid4(), key='hospital_options', value=value,
            description='Hospital master list for linked_hospital / base_hospital',
        )
        db.session.add(setting)
    # Caller owns the commit (kept in the same txn as the Organization insert),
    # but drop the request-scoped cache so later reads in this request see it.
    invalidate_hospital_catalog_cache()


def _member_summary(membership):
    """Membership row + its user's basic identity (for listings)."""
    out = membership.to_dict()
    user = User.query.get(membership.user_id) if membership.user_id else None
    out['user'] = {
        'id': str(user.id),
        'email': user.email,
        'full_name': user.full_name,
        'is_active': user.is_active,
        'is_approved': user.is_approved,
    } if user else None
    return out


def _active_admin_count(org_id, exclude_membership_id=None):
    """Count ACTIVE org_admin memberships for an org (used to avoid orphaning)."""
    q = OrganizationMembership.query.filter_by(
        organization_id=org_id, role='org_admin', is_active=True,
    )
    if exclude_membership_id is not None:
        q = q.filter(OrganizationMembership.id != exclude_membership_id)
    return q.count()


# ─── Schemas ─────────────────────────────────────────────────────────────────
class CreateOrgSchema(Schema):
    code = fields.Str(required=True, validate=validate.Length(min=2, max=16))
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    type = fields.Str(load_default='hospital', validate=validate.OneOf(ORG_TYPES))
    linked_hospital_code = fields.Str(
        required=False, allow_none=True, validate=validate.Length(max=10))
    status = fields.Str(load_default='active', validate=validate.OneOf(ORG_STATUSES))
    display_name = fields.Str(required=False, allow_none=True,
                              validate=validate.Length(max=255))
    accent_color = fields.Str(required=False, allow_none=True,
                              validate=validate.Length(max=16))
    logo_url = fields.Str(required=False, allow_none=True,
                          validate=validate.Length(max=500))
    can_view_org_directory = fields.Bool(load_default=False)
    show_referral_feedback = fields.Bool(load_default=False)


class UpdateOrgSchema(Schema):
    class Meta:
        # `code` is immutable but the shared frontend body always sends it (the
        # field is just disabled in the UI). Drop unknown fields rather than 400.
        unknown = EXCLUDE

    name = fields.Str(validate=validate.Length(min=1, max=255))
    type = fields.Str(validate=validate.OneOf(ORG_TYPES))
    display_name = fields.Str(allow_none=True, validate=validate.Length(max=255))
    status = fields.Str(validate=validate.OneOf(ORG_STATUSES))
    linked_hospital_code = fields.Str(allow_none=True, validate=validate.Length(max=10))
    can_view_org_directory = fields.Bool()
    show_referral_feedback = fields.Bool()
    logo_url = fields.Str(allow_none=True, validate=validate.Length(max=500))
    accent_color = fields.Str(allow_none=True, validate=validate.Length(max=16))


class CreateUserSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))
    full_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    role = fields.Str(required=True, validate=validate.OneOf(ORG_ROLES))


class CreateInviteSchema(Schema):
    email = fields.Email(required=True)
    role = fields.Str(required=True, validate=validate.OneOf(ORG_ROLES))


class UpdateMemberSchema(Schema):
    role = fields.Str(validate=validate.OneOf(ORG_ROLES))
    is_active = fields.Bool()


# ─── Orgs ────────────────────────────────────────────────────────────────────
@admin_bp.route('/orgs', methods=['GET'])
@platform_admin_required
def list_orgs(admin_user):
    """PLATFORM ADMIN: list all orgs with member + patient counts."""
    from app.patients.models import Patient

    orgs = Organization.query.order_by(Organization.created_at.asc()).all()
    items = []
    for org in orgs:
        member_count = OrganizationMembership.query.filter_by(
            organization_id=org.id, is_active=True,
        ).count()
        patient_count = Patient.query.filter_by(organization_id=org.id).count()
        data = org.to_dict()
        data['member_count'] = member_count
        data['patient_count'] = patient_count
        items.append(data)
    return jsonify({'organizations': items, 'total': len(items)}), 200


@admin_bp.route('/orgs', methods=['POST'])
@platform_admin_required
def create_org(admin_user):
    """PLATFORM ADMIN: create an org and keep the hospital catalog in sync.

    If `linked_hospital_code` is not already in the 'hospital_options' catalog it
    is APPENDED (so portal patient-create validation passes). Both the org insert
    and the catalog append commit in the same transaction.
    """
    schema = CreateOrgSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    code = data['code'].strip().upper()
    if Organization.query.filter_by(code=code).first():
        return jsonify({'message': f'Organization code {code} already exists',
                        'error': 'org_code_exists'}), 409

    linked = (data.get('linked_hospital_code') or '').strip().upper() or None

    try:
        org = Organization(
            code=code,
            name=data['name'].strip(),
            display_name=(data.get('display_name') or '').strip() or None,
            type=data.get('type', 'hospital'),
            status=data.get('status', 'active'),
            linked_hospital_code=linked,
            accent_color=(data.get('accent_color') or '').strip() or None,
            logo_url=(data.get('logo_url') or '').strip() or None,
            can_view_org_directory=data.get('can_view_org_directory', False),
            show_referral_feedback=data.get('show_referral_feedback', False),
            is_active=True,
        )
        db.session.add(org)

        # Keep the hospital catalog in sync so portal intake validation passes.
        if linked:
            _ensure_hospital_code_in_catalog(linked, org.name)

        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('create_org failed')
        return jsonify({'message': 'Could not create organization',
                        'error': 'org_create_failed'}), 500

    return jsonify({'message': 'Organization created',
                    'organization': org.to_dict()}), 201


@admin_bp.route('/orgs/<org_id>', methods=['GET'])
@platform_admin_required
def get_org(org_id, admin_user):
    """PLATFORM ADMIN: org detail + its members + pending invites."""
    org, err = _get_org_or_404(org_id)
    if err:
        return err

    members = (
        OrganizationMembership.query
        .filter_by(organization_id=org.id)
        .order_by(OrganizationMembership.created_at.asc())
        .all()
    )
    now = datetime.utcnow()
    pending = (
        OrganizationInvite.query
        .filter(
            OrganizationInvite.organization_id == org.id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.expires_at > now,
        )
        .order_by(OrganizationInvite.created_at.desc())
        .all()
    )

    data = org.to_dict()
    data['members'] = [_member_summary(m) for m in members]
    data['pending_invites'] = [i.to_dict() for i in pending]
    return jsonify({'organization': data}), 200


@admin_bp.route('/orgs/<org_id>', methods=['PUT'])
@platform_admin_required
def update_org(org_id, admin_user):
    """PLATFORM ADMIN: update org fields. Appends a new linked_hospital_code to
    the catalog (same sync as create) so intake validation keeps passing."""
    org, err = _get_org_or_404(org_id)
    if err:
        return err

    schema = UpdateOrgSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    if not data:
        return jsonify({'message': 'No updatable fields provided',
                        'error': 'no_fields'}), 400

    try:
        if 'name' in data:
            org.name = data['name'].strip()
        if 'type' in data:
            org.type = data['type']
        if 'display_name' in data:
            org.display_name = (data['display_name'] or '').strip() or None
        if 'status' in data:
            org.status = data['status']
        if 'can_view_org_directory' in data:
            org.can_view_org_directory = data['can_view_org_directory']
        if 'show_referral_feedback' in data:
            org.show_referral_feedback = data['show_referral_feedback']
        if 'logo_url' in data:
            org.logo_url = (data['logo_url'] or '').strip() or None
        if 'accent_color' in data:
            org.accent_color = (data['accent_color'] or '').strip() or None
        if 'linked_hospital_code' in data:
            linked = (data['linked_hospital_code'] or '').strip().upper() or None
            org.linked_hospital_code = linked
            if linked:
                _ensure_hospital_code_in_catalog(linked, org.name)

        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('update_org failed for %s', org_id)
        return jsonify({'message': 'Could not update organization',
                        'error': 'org_update_failed'}), 500

    return jsonify({'message': 'Organization updated',
                    'organization': org.to_dict()}), 200


# ─── Org users (direct create) ───────────────────────────────────────────────
@admin_bp.route('/orgs/<org_id>/users', methods=['POST'])
@platform_admin_required
def create_org_user(org_id, admin_user):
    """PLATFORM ADMIN: directly create a HOSPITAL user + active membership.

    Creates a portal/hospital User (is_platform_admin=False, is_approved=True,
    is_active=True, hashed password) and an active OrganizationMembership with
    the given org role. 409 on duplicate email. The main-app User.role enum is
    set to the least-privileged 'viewer' (the portal role lives on membership).
    """
    org, err = _get_org_or_404(org_id)
    if err:
        return err

    schema = CreateUserSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    email = data['email'].strip().lower()
    # Option B: any existing email blocks a direct create; message is realm- and
    # membership-aware (Saranam staff / already in this org / exists elsewhere).
    ok, err_code, err_msg = check_can_create_user(email, org.id)
    if not ok:
        return jsonify({'message': err_msg, 'error': err_code}), 409

    try:
        user = User(
            email=email,
            full_name=data['full_name'].strip(),
            role='viewer',            # main-app enum role; org role is on membership
            is_approved=True,         # admin-created users are pre-approved
            is_active=True,
            is_platform_admin=False,  # hospital user, NOT platform staff
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.flush()  # populate user.id for the membership FK

        membership = OrganizationMembership(
            user_id=user.id,
            organization_id=org.id,
            role=data['role'],
            is_active=True,
            invited_by=admin_user.id,
            joined_at=datetime.utcnow(),
        )
        db.session.add(membership)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('create_org_user failed for org %s', org_id)
        return jsonify({'message': 'Could not create user',
                        'error': 'user_create_failed'}), 500

    return jsonify({
        'message': 'User created',
        'user': user.to_dict(),
        'membership': membership.to_dict(),
    }), 201


# ─── Invites ─────────────────────────────────────────────────────────────────
@admin_bp.route('/orgs/<org_id>/invites', methods=['POST'])
@platform_admin_required
def create_invite(org_id, admin_user):
    """PLATFORM ADMIN: create an OrganizationInvite + email the PORTAL accept link.

    Token security mirrors app.portal.invite_routes: a high-entropy
    secrets.token_urlsafe(32) raw token is emailed; only its sha256 is stored;
    7-day expiry. The accept link points at the PORTAL accept-invite page.
    """
    org, err = _get_org_or_404(org_id)
    if err:
        return err

    schema = CreateInviteSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    email = data['email'].strip().lower()
    role = data['role']

    # Option B: block inviting Saranam staff or an existing member of THIS org;
    # an existing hospital user in another org IS allowed (extra membership).
    ok, err_code, err_msg = check_can_invite(email, org.id)
    if not ok:
        return jsonify({'message': err_msg, 'error': err_code}), 409

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(days=INVITE_TTL_DAYS)

    try:
        invite = OrganizationInvite(
            organization_id=org.id,
            email=email,
            role=role,
            token_hash=token_hash,
            expires_at=expires_at,
            invited_by=admin_user.id,
        )
        db.session.add(invite)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('create_invite failed for org %s', org_id)
        return jsonify({'message': 'Could not create invite',
                        'error': 'invite_failed'}), 500

    # Accept link points at the PORTAL accept-invite page (Wave 2 flow handles it).
    accept_link = f'{get_invite_base_url()}/accept-invite?token={raw_token}'
    org_name = org.display_name or org.name
    send_email(
        to=email,
        subject=f'You have been invited to join {org_name}',
        html_body=(
            f'<p>You have been invited to join <strong>{org_name}</strong> as '
            f'<strong>{role}</strong>.</p>'
            f'<p><a href="{accept_link}">Accept your invitation</a></p>'
            f'<p>This invitation expires in {INVITE_TTL_DAYS} days.</p>'
        ),
    )

    return jsonify({
        'message': 'Invite created',
        'invite': invite.to_dict(),  # NEVER includes token / token_hash
    }), 201


@admin_bp.route('/orgs/<org_id>/invites', methods=['GET'])
@platform_admin_required
def list_invites(org_id, admin_user):
    """PLATFORM ADMIN: list pending (unaccepted, unexpired) invites for an org."""
    org, err = _get_org_or_404(org_id)
    if err:
        return err

    now = datetime.utcnow()
    rows = (
        OrganizationInvite.query
        .filter(
            OrganizationInvite.organization_id == org.id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.expires_at > now,
        )
        .order_by(OrganizationInvite.created_at.desc())
        .all()
    )
    return jsonify({'invites': [i.to_dict() for i in rows],
                    'total': len(rows)}), 200


@admin_bp.route('/invites/<invite_id>', methods=['DELETE'])
@platform_admin_required
def revoke_invite(invite_id, admin_user):
    """PLATFORM ADMIN: revoke (delete) any invite by id."""
    coerced = _coerce_uuid(invite_id)
    if not coerced:
        return jsonify({'message': 'Invalid invite id',
                        'error': 'invalid_invite_id'}), 400

    invite = OrganizationInvite.query.get(coerced)
    if not invite:
        return jsonify({'message': 'Invite not found',
                        'error': 'invite_not_found'}), 404

    try:
        db.session.delete(invite)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('revoke_invite failed for %s', invite_id)
        return jsonify({'message': 'Could not revoke invite',
                        'error': 'revoke_failed'}), 500

    return jsonify({'message': 'Invite revoked'}), 200


# ─── Members ─────────────────────────────────────────────────────────────────
@admin_bp.route('/orgs/<org_id>/members', methods=['GET'])
@platform_admin_required
def list_members(org_id, admin_user):
    """PLATFORM ADMIN: list all memberships of an org (with user identity)."""
    org, err = _get_org_or_404(org_id)
    if err:
        return err

    members = (
        OrganizationMembership.query
        .filter_by(organization_id=org.id)
        .order_by(OrganizationMembership.created_at.asc())
        .all()
    )
    return jsonify({'members': [_member_summary(m) for m in members],
                    'total': len(members)}), 200


@admin_bp.route('/members/<membership_id>', methods=['PATCH'])
@platform_admin_required
def update_member(membership_id, admin_user):
    """PLATFORM ADMIN: change a membership's role / is_active.

    Guard: never deactivate or demote the LAST active org_admin of an org —
    that would orphan the org (409). Activation/role-up is always allowed.
    """
    coerced = _coerce_uuid(membership_id)
    if not coerced:
        return jsonify({'message': 'Invalid membership id',
                        'error': 'invalid_membership_id'}), 400

    membership = OrganizationMembership.query.get(coerced)
    if not membership:
        return jsonify({'message': 'Membership not found',
                        'error': 'membership_not_found'}), 404

    schema = UpdateMemberSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    if not data:
        return jsonify({'message': 'No updatable fields provided',
                        'error': 'no_fields'}), 400

    new_role = data.get('role', membership.role)
    new_active = data.get('is_active', membership.is_active)

    # Don't orphan the last active org_admin. If this row IS currently a live
    # org_admin and the change would stop it being one (demote or deactivate),
    # block it when it's the only active org_admin left.
    is_currently_live_admin = (membership.role == 'org_admin' and membership.is_active)
    would_stop_being_admin = (new_role != 'org_admin' or not new_active)
    if is_currently_live_admin and would_stop_being_admin:
        if _active_admin_count(membership.organization_id,
                               exclude_membership_id=membership.id) == 0:
            return jsonify({
                'message': 'Cannot remove the last active org admin for this organization',
                'error': 'last_org_admin',
            }), 409

    try:
        if 'role' in data:
            membership.role = new_role
        if 'is_active' in data:
            membership.is_active = new_active
            if new_active and membership.joined_at is None:
                membership.joined_at = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('update_member failed for %s', membership_id)
        return jsonify({'message': 'Could not update membership',
                        'error': 'member_update_failed'}), 500

    return jsonify({'message': 'Membership updated',
                    'membership': membership.to_dict()}), 200
