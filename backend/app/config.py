"""Application configuration."""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Base configuration."""

    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 10,
        "pool_recycle": 3600,
        "pool_pre_ping": True,
        "max_overflow": 20,
    }

    # JWT
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 3600))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        seconds=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES", 2592000))
    )
    JWT_ERROR_MESSAGE_KEY = "message"

    # CORS
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:5174"
    ).split(",")

    # Pagination
    PAGINATION_PAGE_SIZE = int(os.environ.get("PAGINATION_PAGE_SIZE", 50))
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))

    # App Info
    APP_NAME = os.environ.get("APP_NAME", "CV Raman Health Care")
    APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")

    # LLM Configuration
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
    DEFAULT_LLM_PROVIDER = os.environ.get("DEFAULT_LLM_PROVIDER", "openai")

    # File Upload Configuration
    MAX_UPLOAD_SIZE_MB = int(os.environ.get("MAX_UPLOAD_SIZE_MB", 50))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    UPLOAD_FOLDER = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "uploads", "bulk_imports"
    )
    ALLOWED_EXTENSIONS = {"xlsx", "xls", "csv", "pdf"}

    # Bulk Import Settings
    MAX_APPOINTMENTS_PER_BATCH = int(os.environ.get("MAX_APPOINTMENTS_PER_BATCH", 1000))
    AUTO_CREATE_PATIENTS = (
        str(os.environ.get("AUTO_CREATE_PATIENTS", "true")).lower() == "true"
    )
    CONFLICT_RESOLUTION_ENABLED = (
        str(os.environ.get("CONFLICT_RESOLUTION_ENABLED", "true")).lower() == "true"
    )

    # Fuzzy Matching Threshold (0-100)
    FUZZY_MATCH_THRESHOLD = int(os.environ.get("FUZZY_MATCH_THRESHOLD", 80))


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True
    TESTING = False


class TestingConfig(Config):
    """Testing configuration."""

    DEBUG = False
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False
    TESTING = False

    # Stricter CORS in production
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")

    @classmethod
    def init_app(cls, app):
        # Ensure critical configs are set in production
        required_vars = ["DATABASE_URL", "SECRET_KEY"]
        missing = [var for var in required_vars if not os.environ.get(var)]
        if missing:
            import warnings

            warnings.warn(
                f"Missing recommended production environment variables: {', '.join(missing)}"
            )

        if os.environ.get("SECRET_KEY") == "dev-secret-key-change-in-production":
            app.logger.warning(
                "Using default SECRET_KEY in production! Change this immediately."
            )

        # Log to stderr
        import logging
        from logging import StreamHandler

        file_handler = StreamHandler()
        file_handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
        )
        file_handler.setFormatter(formatter)
        app.logger.addHandler(file_handler)


# Configuration dictionary
config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
