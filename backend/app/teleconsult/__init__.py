"""Teleconsult module — voice/video consultations + scheduling + reminders.

Architecture overview:
- Routes call SessionOrchestrator (single facade), never adapters directly.
- ProviderRegistry picks the adapter (EnableX primary, Exotel fallback, Mock for tests).
- Notifications and reminders flow through tele_notifications queue, processed
  by an APScheduler tick.

See docs/Saranam/plans/telecounications/ for the full plan.
"""
