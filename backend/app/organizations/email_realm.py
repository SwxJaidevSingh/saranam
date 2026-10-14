"""Email-realm classification + duplicate-account rules (Option B).

Single source of truth for "can this email be created / invited into a
hospital?", shared by the platform-admin (`app/admin`) and org-admin
(`app/portal`) user-management paths so both enforce the SAME rules.

Realms
------
Every email maps to one of three realms:
  - 'platform'  → an existing Saranam/platform-admin User (is_platform_admin).
  - 'hospital'  → an existing non-platform User (a hospital/portal user).
  - None        → no User owns this email yet (free to create/invite).

Option B rules (what the client asked for)
------------------------------------------
DIRECT CREATE (admin makes a brand-new hospital account in org X) — any
existing email blocks, with a realm/membership-aware message:
  | platform email                 | ❌ already a Saranam staff account
  | hospital email, member of X    | ❌ already in this hospital
  | hospital email, in another org | ❌ exists — use Invite to add them
  | new email                      | ✅ create

INVITE (add an email to org X) — multi-org membership is allowed:
  | platform email                 | ❌ Saranam staff can't join a hospital
  | hospital email, member of X    | ❌ already a member
  | hospital email, in another org | ✅ allow (extra membership)
  | new email                      | ✅ invite

ACCEPT — a platform email can NEVER be linked into a hospital (defense in
depth on top of the realm gate); see `classify_email(...).realm`.
"""
from app.common.models import User
from app.organizations.models import OrganizationMembership


def classify_email(email):
    """Look up which realm/account (if any) already owns `email`.

    Returns a dict:
      - exists  : bool                       — a User with this email exists
      - realm   : 'platform'|'hospital'|None — see module docstring
      - user    : User|None                  — the matched row
      - org_ids : set[str]                   — orgs the user is an ACTIVE
                                               member of (stringified UUIDs)
    """
    email = (email or '').strip().lower()
    user = User.query.filter_by(email=email).first() if email else None

    if user is None:
        return {'exists': False, 'realm': None, 'user': None, 'org_ids': set()}

    realm = 'platform' if user.is_platform_admin else 'hospital'
    org_ids = {
        str(m.organization_id)
        for m in OrganizationMembership.query.filter_by(
            user_id=user.id, is_active=True,
        ).all()
    }
    return {'exists': True, 'realm': realm, 'user': user, 'org_ids': org_ids}


def check_can_add_platform_user(email):
    """Rule for adding `email` as a MAIN-DASHBOARD (platform) user — create OR invite.

    Any existing email blocks, with a realm-aware message so the admin knows WHY
    (already a main-dashboard user vs. belongs to the Hospital Portal).

    Returns (ok: bool, error_code: str|None, message: str|None).
    """
    info = classify_email(email)
    if not info['exists']:
        return True, None, None

    if info['realm'] == 'platform':
        return (False, 'email_exists_platform',
                'This email is already a main-dashboard user.')

    # realm == 'hospital' — registered through the Hospital Portal.
    return (False, 'email_is_hospital',
            'This email is registered to a Hospital Portal user and cannot be '
            'added to the main dashboard.')


def check_can_create_user(email, org_id):
    """Rule for DIRECTLY creating a brand-new hospital account in `org_id`.

    Returns (ok: bool, error_code: str|None, message: str|None). Any existing
    email blocks creation; the message/code differ by realm + membership.
    """
    info = classify_email(email)
    if not info['exists']:
        return True, None, None

    if info['realm'] == 'platform':
        return (False, 'email_exists_platform',
                'This email already belongs to a Saranam staff account and '
                'cannot be added to an Organisation.')

    if str(org_id) in info['org_ids']:
        return (False, 'email_exists_member',
                'This user is already a member of this Organisation.')

    return (False, 'email_exists_other_org',
            'A user with this email already exists. Use “Invite” to add them '
            'to this Organisation.')


def check_can_invite(email, org_id):
    """Rule for INVITING `email` into `org_id` (multi-org membership allowed).

    Returns (ok: bool, error_code: str|None, message: str|None).
    """
    info = classify_email(email)
    if not info['exists']:
        return True, None, None

    if info['realm'] == 'platform':
        return (False, 'email_is_platform',
                'This email belongs to a Saranam staff account and cannot be '
                'invited to an Organisation.')

    if str(org_id) in info['org_ids']:
        return (False, 'already_member',
                'This user is already a member of this Organisation.')

    # Existing hospital user in a DIFFERENT org → allow the extra membership.
    return True, None, None
