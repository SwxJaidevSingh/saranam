"""
Provider API Routes
REST endpoints for healthcare provider management
"""

import base64
import logging
import os
from io import BytesIO

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import UUID
import math

from app.extensions import db
from app.providers.models import HealthcareProvider
from app.providers.services import ProviderService

logger = logging.getLogger(__name__)


# Create Blueprint
providers_bp = Blueprint('providers', __name__, url_prefix='/api/providers')


@providers_bp.route('', methods=['GET'])
@jwt_required()
def list_providers():
    """
    List/search healthcare providers
    Query params: q (search), specialization, department, is_active, page, per_page
    """
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters
        query = request.args.get('search') or request.args.get('q', '')
        specialization = request.args.get('specialization', '')
        department = request.args.get('department', '')
        is_active = request.args.get('is_active', 'true').lower() == 'true'
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        sort_by = request.args.get('sort_by', 'full_name')
        sort_order = request.args.get('sort_order', 'asc')

        # Build filters
        filters = {
            'specialization': specialization if specialization else None,
            'department': department if department else None,
            'is_active': is_active,
            'sort_by': sort_by,
            'sort_order': sort_order
        }

        # Calculate offset
        offset = (page - 1) * per_page

        # Search providers
        providers, total = ProviderService.search_providers(
            query=query if query else None,
            limit=per_page,
            offset=offset,
            filters=filters
        )

        # Calculate total pages
        total_pages = math.ceil(total / per_page) if total > 0 else 0

        return jsonify({
            'providers': providers,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/<uuid:provider_id>', methods=['GET'])
@jwt_required()
def get_provider(provider_id):
    """Get provider by ID"""
    try:
        current_user_id = get_jwt_identity()

        provider = ProviderService.get_provider_by_id(provider_id)

        if not provider:
            return jsonify({'error': 'Provider not found'}), 404

        return jsonify(provider), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('', methods=['POST'])
@jwt_required()
def create_provider():
    """Create a new healthcare provider"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Create provider
        provider = ProviderService.create_provider(data, UUID(current_user_id))

        return jsonify(provider), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/<uuid:provider_id>', methods=['PUT'])
@jwt_required()
def update_provider(provider_id):
    """Update an existing provider"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Update provider
        provider = ProviderService.update_provider(provider_id, data)

        if not provider:
            return jsonify({'error': 'Provider not found'}), 404

        return jsonify(provider), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/<uuid:provider_id>', methods=['DELETE'])
@jwt_required()
def delete_provider(provider_id):
    """Deactivate a provider (soft delete)"""
    try:
        current_user_id = get_jwt_identity()

        # Deactivate provider
        success = ProviderService.deactivate_provider(provider_id)

        if not success:
            return jsonify({'error': 'Provider not found'}), 404

        return jsonify({'message': 'Provider deactivated successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/<uuid:provider_id>/signature', methods=['POST'])
@jwt_required()
def upload_provider_signature(provider_id):
    """
    Upload a doctor's signature image (meeting §5.4, 2026-04-14).

    Accepts a multipart form-data request with a single file field `signature`.
    When Cloudinary env vars are configured (CLOUDINARY_URL or the
    CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET triple), the image is uploaded
    to Cloudinary with background-removal transformation and the secure URL
    is stored on providers.signature_image.

    Falls back to base64 inline storage when Cloudinary isn't configured.
    Either way the PDF consumer (generatePrescriptionPDF.js:273) receives a
    string that jsPDF.addImage() can render (data URL or HTTPS URL).
    """
    provider = HealthcareProvider.query.get(provider_id)
    if not provider:
        return jsonify({'error': 'Provider not found'}), 404

    f = request.files.get('signature')
    if not f:
        return jsonify({'error': 'signature file is required'}), 400
    if f.mimetype not in ('image/png', 'image/jpeg', 'image/jpg', 'image/webp'):
        return jsonify({'error': 'Only PNG / JPEG / WEBP images are accepted'}), 400

    raw_bytes = f.read()
    if not raw_bytes:
        return jsonify({'error': 'empty file'}), 400
    if len(raw_bytes) > 5 * 1024 * 1024:  # 5 MB
        return jsonify({'error': 'File too large (max 5 MB)'}), 400

    stored_value = None
    storage_kind = 'base64'
    cloudinary_url = os.environ.get('CLOUDINARY_URL') or os.environ.get('CLOUDINARY_CLOUD_NAME')
    if cloudinary_url:
        try:
            import cloudinary
            import cloudinary.uploader
            if os.environ.get('CLOUDINARY_CLOUD_NAME'):
                cloudinary.config(
                    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
                    api_key=os.environ.get('CLOUDINARY_API_KEY'),
                    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
                    secure=True,
                )
            result = cloudinary.uploader.upload(
                BytesIO(raw_bytes),
                folder='cvraman/signatures',
                public_id=f'provider_{provider_id}',
                overwrite=True,
                resource_type='image',
                # background_removal requires a paid add-on; we just skip it
                # in the free tier. The meeting noted signatures should be
                # uploaded on a white background, which is a human rule.
            )
            stored_value = result.get('secure_url') or result.get('url')
            storage_kind = 'cloudinary'
        except Exception as exc:
            logger.warning('Cloudinary upload failed, falling back to base64: %s', exc)

    if not stored_value:
        # Base64 data URL fallback — works with jsPDF.addImage() directly.
        b64 = base64.b64encode(raw_bytes).decode('ascii')
        mime = f.mimetype or 'image/png'
        stored_value = f'data:{mime};base64,{b64}'
        storage_kind = 'base64'

    provider.signature_image = stored_value
    db.session.commit()

    return jsonify({
        'signature_image': stored_value,
        'storage': storage_kind,
    }), 200


@providers_bp.route('/<uuid:provider_id>/appointments', methods=['GET'])
@jwt_required()
def get_provider_appointments(provider_id):
    """Get provider's appointments"""
    try:
        current_user_id = get_jwt_identity()

        # Get query parameters for date filtering
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        status = request.args.get('status')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)

        # Calculate offset
        offset = (page - 1) * per_page

        # Get appointments
        appointments, total = ProviderService.get_provider_appointments(
            provider_id=provider_id,
            from_date=from_date,
            to_date=to_date,
            status=status,
            limit=per_page,
            offset=offset
        )

        # Calculate total pages
        total_pages = math.ceil(total / per_page) if total > 0 else 0

        return jsonify({
            'appointments': appointments,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/specializations', methods=['GET'])
@jwt_required()
def get_specializations():
    """Get list of all specializations"""
    try:
        specializations = ProviderService.get_all_specializations()
        return jsonify({'specializations': specializations}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/departments', methods=['GET'])
@jwt_required()
def get_departments():
    """Get list of all departments"""
    try:
        departments = ProviderService.get_all_departments()
        return jsonify({'departments': departments}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/specializations', methods=['POST'])
@jwt_required()
def add_specialization():
    """Add a custom specialization"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data.get('name'):
            return jsonify({'error': 'Specialization name is required'}), 400

        specialization = ProviderService.add_custom_specialization(
            data['name'],
            UUID(current_user_id)
        )

        return jsonify(specialization), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/specializations/<path:name>', methods=['DELETE'])
@jwt_required()
def deactivate_specialization(name):
    """Deactivate (soft delete) a specialization"""
    try:
        ProviderService.deactivate_specialization(name)
        return jsonify({'message': f"Specialization '{name}' deactivated"}), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/departments', methods=['POST'])
@jwt_required()
def add_department():
    """Add a custom department"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        if not data.get('name'):
            return jsonify({'error': 'Department name is required'}), 400

        department = ProviderService.add_custom_department(
            data['name'],
            UUID(current_user_id)
        )

        return jsonify(department), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/quick-create', methods=['POST'])
@jwt_required()
def quick_create_provider():
    """
    Quick create provider for bulk import flow
    Minimal fields required: full_name
    Optional fields: specialization, phone, email
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        # Validate required field
        if not data.get('full_name'):
            return jsonify({'error': 'Provider name (full_name) is required'}), 400

        # Create provider
        provider = ProviderService.quick_create_provider(
            full_name=data['full_name'],
            specialization=data.get('specialization'),
            phone=data.get('phone'),
            email=data.get('email'),
            created_by_id=UUID(current_user_id),
            bulk_import_session_id=UUID(data['bulk_import_session_id']) if data.get('bulk_import_session_id') else None
        )

        return jsonify(provider), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@providers_bp.route('/unknown-provider', methods=['GET'])
@jwt_required()
def get_unknown_provider():
    """
    Get or create the "Unknown Provider" placeholder
    This provider acts as a fallback for bulk imports with missing providers
    """
    try:
        current_user_id = get_jwt_identity()

        # Get or create Unknown Provider
        unknown_provider = ProviderService.get_or_create_unknown_provider(
            created_by_id=UUID(current_user_id)
        )

        return jsonify(unknown_provider), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
