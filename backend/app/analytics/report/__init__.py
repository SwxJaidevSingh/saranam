"""
Report module package.
Self-contained reporting engine for analytics dashboard exports.
"""
from app.analytics.report.report_routes import register_report_routes

__all__ = ['register_report_routes']
