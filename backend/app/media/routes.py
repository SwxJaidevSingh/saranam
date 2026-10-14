"""
Media Optimization API Routes
Endpoints for handling optimized image uploads via Cloudinary
"""

import base64
import logging
import os
from io import BytesIO

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

logger = logging.getLogger(__name__)

# Create Blueprint with prefix /api/media
media_bp = Blueprint("media", __name__, url_prefix="/api/media")

ALLOWED_IMAGE_MIMETYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
}


def _cfg():
    """Ensure the cloudinary SDK is configured and return the module.

    CLOUDINARY_URL (if set) auto-configures the SDK on import; otherwise fall
    back to the explicit cloud_name/api_key/api_secret triple.
    """
    import cloudinary

    if os.getenv("CLOUDINARY_CLOUD_NAME"):
        cloudinary.config(
            cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
            api_key=os.getenv("CLOUDINARY_API_KEY"),
            api_secret=os.getenv("CLOUDINARY_API_SECRET"),
            secure=True,
        )
    return cloudinary


@media_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_media():
    """
    Upload an image, convert to AVIF during upload/storage (to save Cloudinary space),
    and generate a dynamic, highly compressed WebP delivery URL.
    """
    try:
        f = request.files.get("image")
        if not f:
            return jsonify({"error": "Image file is required"}), 400

        if f.mimetype not in ALLOWED_IMAGE_MIMETYPES:
            return (
                jsonify(
                    {"error": "Only PNG, JPEG, WEBP, and HEIC/HEIF images are accepted"}
                ),
                400,
            )

        raw_bytes = f.read()
        if not raw_bytes:
            return jsonify({"error": "Empty file"}), 400

        # Max file upload size limit: 10 MB
        if len(raw_bytes) > 10 * 1024 * 1024:
            return jsonify({"error": "File size exceeds maximum limit of 10MB"}), 400

        # Check if Cloudinary is configured
        cloudinary_url = os.environ.get("CLOUDINARY_URL") or os.environ.get(
            "CLOUDINARY_CLOUD_NAME"
        )

        if not cloudinary_url:
            logger.warning(
                "Cloudinary not configured. Falling back to base64 encoding."
            )
            # Fallback to local Base64 storage
            b64 = base64.b64encode(raw_bytes).decode("ascii")
            mime = f.mimetype or "image/png"
            stored_value = f"data:{mime};base64,{b64}"
            return (
                jsonify(
                    {
                        "public_id": None,
                        "original_url": stored_value,
                        "optimized_url": stored_value,
                        "storage": "base64",
                    }
                ),
                200,
            )

        # Initialize Cloudinary
        cloudinary = _cfg()
        import cloudinary.uploader
        import cloudinary.utils

        # 1. Convert to AVIF and upload for storage
        result = cloudinary.uploader.upload(
            BytesIO(raw_bytes),
            folder="cvraman/genograms",
            format="avif",  # Store directly as AVIF for storage efficiency
            resource_type="image",
        )

        public_id = result.get("public_id")
        original_url = result.get("secure_url") or result.get("url")

        # 2. Generate dynamic WebP URL with auto quality for delivery
        optimized_url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            format="webp",  # Transcode and serve as WebP
            quality="auto",  # Apply auto-quality compression (q_auto)
            secure=True,
        )

        return (
            jsonify(
                {
                    "public_id": public_id,
                    "original_url": original_url,
                    "optimized_url": optimized_url,
                    "storage": "cloudinary",
                }
            ),
            200,
        )

    except Exception as exc:
        logger.exception("Failed to upload image to Cloudinary: %s", exc)
        return jsonify({"error": f"Failed to upload to Cloudinary: {str(exc)}"}), 500
