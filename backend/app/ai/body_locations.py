"""Body-location zone library + merge logic for AI patient-summary highlights.

Mirrors the frontend `bodyZones.js` enum. Slugs are validated server-side
to defend against the AI emitting an invalid slug despite the structured-
output schema constraint (Gemini occasionally violates schema; see plan §5.2).

Per plan §4.3: each slug names ONE zone on ONE view. Coordinates live on the
frontend (the line-art PNGs are the visual source of truth); the backend
only needs the slug enum + human label for the prompt.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable
from uuid import uuid4


# Keep in sync with frontend/src/utils/bodyZones.js BODY_ZONES.
# Slug -> human label (used in the AI prompt).
BODY_ZONES_LABELS: dict[str, str] = {
    # Head/neck
    'head':           'Head',
    'neck':           'Neck',
    'throat':         'Throat',
    # Trunk front
    'chest':          'Chest',
    'upper_abdomen':  'Upper abdomen',
    'lower_abdomen':  'Lower abdomen',
    'pelvis':         'Pelvis',
    # Trunk back
    'upper_back':     'Upper back',
    'mid_back':       'Mid back',
    'lower_back':     'Lower back',
    'sacrum':         'Sacrum',
    # Shoulders / hips
    'left_shoulder':  'Left shoulder',
    'right_shoulder': 'Right shoulder',
    'left_hip':       'Left hip',
    'right_hip':      'Right hip',
    # Arms
    'left_upper_arm':  'Left upper arm',
    'right_upper_arm': 'Right upper arm',
    'left_elbow':      'Left elbow',
    'right_elbow':     'Right elbow',
    'left_forearm':    'Left forearm',
    'right_forearm':   'Right forearm',
    'left_hand':       'Left hand',
    'right_hand':      'Right hand',
    # Legs
    'left_thigh':     'Left thigh',
    'right_thigh':    'Right thigh',
    'left_knee':      'Left knee',
    'right_knee':     'Right knee',
    'left_shin':      'Left shin',
    'right_shin':     'Right shin',
    'left_foot':      'Left foot',
    'right_foot':     'Right foot',
}

BODY_ZONE_SLUGS: tuple[str, ...] = tuple(BODY_ZONES_LABELS.keys())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_ai_locations(items: Iterable[dict]) -> list[dict]:
    """Drop items with unknown slugs or missing label. Defensive validation —
    Gemini occasionally violates the response schema, so we belt-and-suspender."""
    out: list[dict] = []
    for item in items or []:
        slug = (item.get('slug') or '').strip()
        label = (item.get('label') or '').strip()
        if not slug or slug not in BODY_ZONES_LABELS:
            continue
        if not label:
            continue
        out.append({'slug': slug, 'label': label[:50]})
    return out


def merge_ai_body_locations(
    old_locations: list[dict] | None,
    ai_response: list[dict],
) -> tuple[list[dict], dict]:
    """Merge AI's new list with existing stored body_locations.

    Rules (plan §5.3):
    - User-edited entries (`userEdited=true`) are preserved verbatim AND
      not removed even if the AI omits the slug from its new list.
    - Non-edited entries:
        * If still in AI's list — update text to the new label, bump updatedAt.
        * If absent — silently dropped.
    - New slugs in AI's list — added as fresh entries.

    Returns (new_list, diff_stats).
    """
    old_locations = old_locations or []
    ai_response = validate_ai_locations(ai_response)

    old_by_slug: dict[str, dict] = {}
    for loc in old_locations:
        slug = loc.get('zoneSlug')
        if slug:
            old_by_slug[slug] = loc

    ai_by_slug: dict[str, dict] = {item['slug']: item for item in ai_response}

    new_list: list[dict] = []
    added = removed = updated = kept_user = 0

    for slug, ai_item in ai_by_slug.items():
        existing = old_by_slug.get(slug)
        if existing is None:
            new_list.append({
                'id': str(uuid4()),
                'zoneSlug': slug,
                'text': ai_item['label'],
                'userEdited': False,
                'createdAt': _now_iso(),
                'updatedAt': _now_iso(),
            })
            added += 1
        elif existing.get('userEdited'):
            # preserve user's edit verbatim — don't even bump updatedAt
            new_list.append({**existing})
            kept_user += 1
        else:
            text_changed = existing.get('text') != ai_item['label']
            new_list.append({
                'id': existing.get('id') or str(uuid4()),
                'zoneSlug': slug,
                'text': ai_item['label'],
                'userEdited': False,
                'createdAt': existing.get('createdAt') or _now_iso(),
                'updatedAt': _now_iso() if text_changed else (existing.get('updatedAt') or _now_iso()),
            })
            if text_changed:
                updated += 1

    # entries in old that AI dropped
    for slug, existing in old_by_slug.items():
        if slug in ai_by_slug:
            continue
        if existing.get('userEdited'):
            new_list.append({**existing})
            kept_user += 1
        else:
            removed += 1  # silently dropped

    return new_list, {
        'added': added,
        'removed': removed,
        'updated': updated,
        'kept_user': kept_user,
    }
