"""Flask application factory."""
import os
from flask import Flask, jsonify
from app.config import config
from app.extensions import init_extensions


def create_app(config_name=None):
    """Create Flask application."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Werkzeug caps non-file form fields at 500 KB by default, which 413s
    # multipart requests carrying a larger JSON metadata field (e.g. a
    # prescription snapshot). Raise it so such fields aren't rejected opaquely.
    # (Total request size is still bounded by MAX_CONTENT_LENGTH.)
    try:
        app.request_class.max_form_memory_size = 10 * 1024 * 1024  # 10 MB
    except Exception:
        pass

    # Initialize extensions
    init_extensions(app)

    # Import all models to register with SQLAlchemy
    # This must happen AFTER init_extensions but BEFORE blueprints
    with app.app_context():
        from app import models  # noqa: F401

    # Register blueprints
    register_blueprints(app)

    # Register error handlers
    register_error_handlers(app)

    # ── Realm gate ───────────────────────────────────────────────────────────
    # The main-app API is for Saranam/platform staff only. A Hospital-Portal
    # user's (valid) JWT must NOT be able to read the unscoped main-app data
    # (e.g. GET /api/patients returns ALL patients). Block non-platform JWTs on
    # main-app /api routes. Exempt: auth, the portal's own org-scoped API, public
    # routes, and the shared reference lookups the portal's intake form uses.
    # Token-less requests pass straight through (webhooks/integrations + each
    # route's own auth handle those) — we only ever reject a *non-platform* JWT.
    _GATE_EXEMPT = (
        '/api/auth/', '/api/portal/', '/api/public/',
        '/api/patients/config', '/api/patients/zones', '/api/patients/duplicate-check',
    )

    @app.before_request
    def _main_app_platform_gate():
        from flask import request
        if request.method == 'OPTIONS':
            return None
        path = request.path
        if not path.startswith('/api/') or any(path.startswith(p) for p in _GATE_EXEMPT):
            return None
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        try:
            verify_jwt_in_request(optional=True)
            uid = get_jwt_identity()
        except Exception:
            uid = None
        if uid:
            from app.common.models import User
            user = User.query.get(uid)
            if user is not None and not user.is_platform_admin:
                return jsonify({
                    'message': 'Hospital portal accounts cannot access the main application. '
                               'Please use the Hospital Portal.',
                    'error': 'platform_admin_required',
                }), 403
        return None

    # Initialize reminder scheduler
    from app.reminders.scheduler import init_scheduler, scheduler as _reminder_scheduler
    init_scheduler(app)

    # Teleconsult reminder/dispatch tick (rides the same APScheduler instance)
    from app.teleconsult.services.reminder_scheduler import init_teleconsult_scheduler
    init_teleconsult_scheduler(app)
    # If the legacy reminder scheduler didn't auto-start (e.g. SCHEDULER_ENABLED
    # is true but no legacy job ran), make sure it's running so the teleconsult
    # tick fires. start() is idempotent — it's a no-op if already running.
    if os.environ.get('SCHEDULER_ENABLED', 'false').lower() == 'true':
        try:
            if not _reminder_scheduler.running:
                _reminder_scheduler.start()
        except Exception:
            pass

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': app.config.get('APP_NAME'),
            'version': app.config.get('APP_VERSION')
        })

    return app


def register_blueprints(app):
    """Register application blueprints."""
    from app.auth import auth_bp
    from app.users import users_bp
    from app.forms.routes import forms_bp
    from app.submissions.routes import submissions_bp
    from app.analytics.routes import analytics_bp
    from app.public.routes import public_bp
    from app.risk.routes import bp as risk_bp
    from app.ai.routes import ai_bp
    from app.patients.routes import patients_bp
    from app.cohorts.routes import cohorts_bp
    from app.providers.routes import providers_bp
    from app.providers.schedule_routes import schedule_bp
    from app.appointments.routes import appointments_bp
    from app.services.routes import services_bp, bookings_bp
    from app.bulk_imports.routes.bulk_routes import bulk_bp
    from app.bulk_imports.routes.pure_logic_routes import pure_logic_bp
    from app.ipd.routes import ipd_bp
    from app.form_configurations.routes import form_configs_bp
    from app.external import external_bp
    from app.opd import opd_bp
    from app.physiotherapy import physio_bp
    from app.homecare import homecare_bp
    from app.reminders import reminders_bp
    from app.call_logs.routes import exotel_bp
    from app.teleconsult.routes import teleconsult_bp
    from app.portal import portal_bp
    from app.admin import admin_bp
    from app.media.routes import media_bp
    from app.inventory_app import inventory_app_bp
    from app.homecare_dispatch import homecare_dispatch_bp

    from app.analytics.ppt_charts.routes import ppt_charts_bp
    app.register_blueprint(ppt_charts_bp, url_prefix='/api/ppt-charts')

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(forms_bp, url_prefix='/api/forms')
    app.register_blueprint(submissions_bp, url_prefix='/api/submissions')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(public_bp, url_prefix='/api/public')
    app.register_blueprint(risk_bp)
    app.register_blueprint(ai_bp, url_prefix='/api')
    app.register_blueprint(patients_bp)
    app.register_blueprint(cohorts_bp, url_prefix='/api/cohorts')
    app.register_blueprint(providers_bp)
    app.register_blueprint(schedule_bp)
    app.register_blueprint(appointments_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(bulk_bp)
    app.register_blueprint(pure_logic_bp)
    app.register_blueprint(ipd_bp)
    app.register_blueprint(form_configs_bp, url_prefix='/api/form-configurations')
    app.register_blueprint(external_bp)  # URL prefix defined in blueprint
    app.register_blueprint(opd_bp)        # OPD module blueprint
    app.register_blueprint(physio_bp)     # Physiotherapy module blueprint
    app.register_blueprint(homecare_bp)   # Home Care module blueprint
    app.register_blueprint(reminders_bp)  # Reminder system
    app.register_blueprint(exotel_bp)     # Exotel module blueprint
    app.register_blueprint(teleconsult_bp, url_prefix='/api/teleconsult')  # Teleconsult (EnableX video/voice/WA + scheduling)
    app.register_blueprint(portal_bp)     # Hospital Portal (multi-tenant, org-scoped /api/portal)
    app.register_blueprint(admin_bp)      # Manage Hospitals (main-dashboard, platform-admin-only /api/admin)
    app.register_blueprint(media_bp)       # Media uploads / optimization
    app.register_blueprint(inventory_app_bp)  # Inventory (Saranam inventory app parity)
    app.register_blueprint(homecare_dispatch_bp)  # Homecare dispatch (Saranam scheduling)


    # Saranam palliative care module
    from app.saranam import init_saranam
    init_saranam(app)


def register_error_handlers(app):
    """Register error handlers."""

    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({'message': 'Resource not found', 'error': 'not_found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'message': 'Internal server error', 'error': 'internal_error'}), 500

    @app.errorhandler(400)
    def bad_request_error(error):
        return jsonify({'message': 'Bad request', 'error': 'bad_request'}), 400

    @app.errorhandler(403)
    def forbidden_error(error):
        return jsonify({'message': 'Access forbidden', 'error': 'forbidden'}), 403

    @app.errorhandler(401)
    def unauthorized_error(error):
        return jsonify({'message': 'Unauthorized', 'error': 'unauthorized'}), 401
