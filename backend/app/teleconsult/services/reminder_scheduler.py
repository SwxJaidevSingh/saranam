"""Reminder scheduler — APScheduler tick that drains the tele_notifications queue.

Hooks into the existing BackgroundScheduler in app.reminders.scheduler so
both the legacy reminder check and the teleconsult tick share one process.
"""
import logging
import os
from datetime import datetime

from app.teleconsult.models.tele_notification import (
    TeleNotification,
    STATUS_PENDING,
)
from app.teleconsult.services.notifications import NotificationService

logger = logging.getLogger(__name__)


def teleconsult_reminder_tick(app):
    """Pick up pending notifications whose scheduled_for <= NOW and dispatch them."""
    with app.app_context():
        try:
            rows = (
                TeleNotification.query
                .filter(TeleNotification.status == STATUS_PENDING)
                .filter(TeleNotification.scheduled_for <= datetime.utcnow())
                .order_by(TeleNotification.scheduled_for.asc())
                .limit(50)
                .all()
            )
        except Exception as e:
            logger.exception("teleconsult tick query failed: %s", e)
            return

        if not rows:
            return

        logger.info("teleconsult tick: dispatching %d notification(s)", len(rows))
        for row in rows:
            try:
                NotificationService.dispatch(row)
            except Exception:
                logger.exception(
                    "teleconsult dispatch crashed for notification %s", row.id
                )


def init_teleconsult_scheduler(app):
    """Register the teleconsult tick with the existing background scheduler."""
    enabled = os.environ.get("SCHEDULER_ENABLED", "false").lower() == "true"
    interval_seconds = int(os.environ.get("TELECONSULT_TICK_INTERVAL_SECONDS", "60"))

    if not enabled:
        logger.info(
            "Teleconsult reminder scheduler disabled (SCHEDULER_ENABLED != true)"
        )
        return

    from app.reminders.scheduler import scheduler  # shared instance

    scheduler.add_job(
        func=teleconsult_reminder_tick,
        trigger="interval",
        seconds=interval_seconds,
        args=[app],
        id="teleconsult_reminder_tick",
        name="Teleconsult — drain pending notifications",
        replace_existing=True,
        max_instances=1,
    )
    logger.info(
        "Teleconsult reminder scheduler registered (every %ss)", interval_seconds
    )
