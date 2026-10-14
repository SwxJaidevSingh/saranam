"""Org invites — create/list/revoke (org_admin) + accept (PUBLIC).

Token security model:
  - On create we generate a high-entropy token with secrets.token_urlsafe(32)
    (>=256 bits). The RAW token is emailed to the invitee and otherwise NEVER
    stored or logged.
  - We persist ONLY sha256(raw token) in OrganizationInvite.token_hash. sha256 is
    used (not bcrypt) precisely because we need a deterministic value to look the
    invite up by; the token's own entropy — not a slow KDF — is what protects it.
  - Acceptance enforces: not expired (expires_at > now), not already accepted
    (accepted_at is None), and exact hash match. Lookup is by hash equality and we
    additionally hmac.compare_digest the stored vs computed hash to avoid leaking
    timing on the final compare. Single-use is enforced by stamping accepted_at.

Auth boundaries:
  - POST/GET /invites and DELETE /invites/<id> : @portal_auth('org_admin'),
    strictly scoped to the caller's active org (X-Org-Id, membership-validated).
  - POST /invites/accept : PUBLIC (creates/links an account), so it validates hard
    and returns generic errors to avoid token/account enumeration.
"""
import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta

from flask import jsonify, request
from flask_jwt_extended import create_access_token, create_refresh_token
from marshmallow import Schema, fields, validate, ValidationError

from app.extensions import db
from app.common.models import User
from app.organizations.models import OrganizationMembership, OrganizationInvite
from app.organizations.email_realm import check_can_invite, classify_email
from app.portal import portal_bp
from app.portal.context import portal_auth
from app.portal.email_util import send_email, get_invite_base_url

logger = logging.getLogger(__name__)

# Roles that may be assigned via an invite.
INVITABLE_ROLES = ('org_admin', 'org_data_entry', 'org_viewer')
INVITE_TTL_DAYS = 7


def _hash_token(raw_token):
    """Deterministic sha256 hex of the raw token (what we store / look up by)."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


class CreateInviteSchema(Schema):
    email = fields.Email(required=True)
    role = fields.Str(required=True, validate=validate.OneOf(INVITABLE_ROLES))


class AcceptInviteSchema(Schema):
    token = fields.Str(required=True, validate=validate.Length(min=1))
    password = fields.Str(required=True, validate=validate.Length(min=8))
    full_name = fields.Str(required=False, validate=validate.Length(min=2, max=255))


@portal_bp.route('/invites', methods=['POST'])
@portal_auth('org_admin')
def create_invite(tenant_ctx):
    """ORG ADMIN (active org): create an invite + email the accept link."""
    schema = CreateInviteSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    org_id = tenant_ctx.active_org_id
    if org_id is None:
        # A platform admin in god view (no X-Org-Id) has no concrete org to scope
        # the invite to. Require an active org.
        return jsonify({
            'message': 'X-Org-Id is required to create an invite',
            'error': 'org_required',
        }), 400

    email = data['email'].strip().lower()
    role = data['role']

    # Option B: block inviting Saranam staff or an existing member of THIS org;
    # an existing hospital user in another org IS allowed (extra membership).
    ok, err_code, err_msg = check_can_invite(email, org_id)
    if not ok:
        return jsonify({'message': err_msg, 'error': err_code}), 409

    # Generate token + store ONLY its hash. Raw token never persisted/logged.
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(days=INVITE_TTL_DAYS)

    try:
        invite = OrganizationInvite(
            organization_id=org_id,
            email=email,
            role=role,
            token_hash=token_hash,
            expires_at=expires_at,
            invited_by=tenant_ctx.user.id,
        )
        db.session.add(invite)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('create_invite failed')
        return jsonify({'message': 'Could not create invite', 'error': 'invite_failed'}), 500

    accept_link = f'{get_invite_base_url()}/accept-invite?token={raw_token}'
    org_name = tenant_ctx.organization.name if tenant_ctx.organization else 'an organization'
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
        'invite': invite.to_dict(),  # NOTE: never includes token / token_hash
    }), 201


@portal_bp.route('/invites', methods=['GET'])
@portal_auth('org_admin')
def list_invites(tenant_ctx):
    """ORG ADMIN (active org): list pending (unaccepted, unexpired) invites."""
    org_id = tenant_ctx.active_org_id
    if org_id is None:
        return jsonify({
            'message': 'X-Org-Id is required to list invites',
            'error': 'org_required',
        }), 400

    now = datetime.utcnow()
    rows = (
        OrganizationInvite.query
        .filter(
            OrganizationInvite.organization_id == org_id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.expires_at > now,
        )
        .order_by(OrganizationInvite.created_at.desc())
        .all()
    )
    return jsonify({
        'invites': [i.to_dict() for i in rows],
        'total': len(rows),
    }), 200


@portal_bp.route('/invites/<invite_id>', methods=['DELETE'])
@portal_auth('org_admin')
def revoke_invite(invite_id, tenant_ctx):
    """ORG ADMIN (active org): revoke an invite belonging to the active org.

    Scoped lookup (organization_id == active org) so an org_admin can never touch
    another org's invite — a mismatched org returns 404, not 403, to avoid
    confirming existence cross-org.
    """
    org_id = tenant_ctx.active_org_id
    if org_id is None:
        return jsonify({
            'message': 'X-Org-Id is required to revoke an invite',
            'error': 'org_required',
        }), 400

    invite = OrganizationInvite.query.filter_by(
        id=invite_id,
        organization_id=org_id,
    ).first()
    if not invite:
        return jsonify({'message': 'Invite not found', 'error': 'invite_not_found'}), 404

    try:
        db.session.delete(invite)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('revoke_invite failed')
        return jsonify({'message': 'Could not revoke invite', 'error': 'revoke_failed'}), 500

    return jsonify({'message': 'Invite revoked'}), 200


@portal_bp.route('/invites/accept', methods=['POST'])
def accept_invite():
    """PUBLIC: accept an invite — create/link a user + active membership.

    Generic error message for any not-found/expired/used case to avoid leaking
    whether a given token ever existed. Single-use enforced via accepted_at.
    """
    schema = AcceptInviteSchema()
    try:
        data = schema.load(request.get_json(silent=True) or {})
    except ValidationError as e:
        return jsonify({'message': 'Validation error', 'errors': e.messages}), 400

    raw_token = data['token']
    token_hash = _hash_token(raw_token)

    invite = OrganizationInvite.query.filter_by(token_hash=token_hash).first()

    # Constant-time confirm on the final compare; combined with the validity
    # checks below. All failure modes collapse to one generic 400.
    generic_invalid = (jsonify({
        'message': 'This invitation is invalid or has expired',
        'error': 'invalid_invite',
    }), 400)

    if not invite or not hmac.compare_digest(invite.token_hash, token_hash):
        return generic_invalid
    if invite.accepted_at is not None:
        return generic_invalid
    if invite.expires_at <= datetime.utcnow():
        return generic_invalid

    invite_email = invite.email.strip().lower()

    # Option B hardening: a Saranam/platform email can NEVER be linked into a
    # hospital, even with a valid token (defense in depth over the realm gate).
    if classify_email(invite_email)['realm'] == 'platform':
        return jsonify({
            'message': 'This email belongs to a Saranam staff account and '
                       'cannot join an Organisation.',
            'error': 'email_is_platform',
        }), 409

    try:
        # Create the user, or link an existing user by the invite email.
        user = User.query.filter_by(email=invite_email).first()
        if user is None:
            user = User(
                email=invite_email,
                full_name=(data.get('full_name') or invite_email).strip(),
                role='viewer',          # main-app role; portal role on membership
                is_approved=True,       # invited users are pre-approved
                is_active=True,
            )
            user.set_password(data['password'])
            db.session.add(user)
            db.session.flush()
        # (Existing users keep their current password — accepting an invite
        #  links them to the org, it does not reset their credentials.)

        # Active membership with the invite's pre-assigned role. Guard against a
        # duplicate membership (e.g. user already in this org).
        existing = OrganizationMembership.query.filter_by(
            user_id=user.id,
            organization_id=invite.organization_id,
        ).first()
        if existing is None:
            membership = OrganizationMembership(
                user_id=user.id,
                organization_id=invite.organization_id,
                role=invite.role,
                is_active=True,
                invited_by=invite.invited_by,
                joined_at=datetime.utcnow(),
            )
            db.session.add(membership)
        else:
            # Already a member — reactivate at the invited role rather than error.
            existing.is_active = True
            existing.role = invite.role

        # Single-use: stamp accepted_at so the token can't be reused.
        invite.accepted_at = datetime.utcnow()

        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception('accept_invite failed')
        return jsonify({'message': 'Could not accept invitation', 'error': 'accept_failed'}), 500

    # Optionally issue tokens so the invitee is signed in immediately.
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'email': user.email, 'role': user.role,
                           'full_name': user.full_name},
    )
    refresh_token = create_refresh_token(
        identity=str(user.id),
        additional_claims={'email': user.email},
    )

    return jsonify({
        'message': 'Invitation accepted',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
        'organization_id': str(invite.organization_id),
        'role': invite.role,
    }), 200
