"""Saranam routes."""


def register_routes(bp):
    """Register all Saranam route modules."""
    from app.saranam.routes import visits  # noqa: F401
    from app.saranam.routes import assessments  # noqa: F401
    from app.saranam.routes import patient_summary  # noqa: F401
    from app.saranam.routes import followup_summary  # noqa: F401
    from app.saranam.routes import prescriptions  # noqa: F401
