"""Reminder system API routes."""
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from uuid import uuid4, UUID

from app.reminders import reminders_bp
from app.reminders.models import SystemSetting, ReminderLog
from app.reminders.notification_service import EmailService, SMSService
from app.reminders.scheduler import get_settings
from app.extensions import db


# ─── Settings ─────────────────────────────────────────────────────────────────

MASKED_KEYS = {'smtp_password', 'msg91_auth_key'}


@reminders_bp.route('/settings', methods=['GET'])
@jwt_required()
def get_reminder_settings():
    """Get all reminder settings (admin only). Passwords are masked."""
    settings = get_settings()
    safe = {}
    for k, v in settings.items():
        if k in MASKED_KEYS and v:
            safe[k] = v[:3] + '****' + v[-2:] if len(v) > 5 else '***'
        else:
            safe[k] = v
    return jsonify({'settings': safe}), 200


@reminders_bp.route('/settings', methods=['PUT'])
@jwt_required()
def update_reminder_settings():
    """Update reminder settings. Accepts key-value pairs."""
    data = request.get_json() or {}
    for key, value in data.items():
        existing = db.session.query(SystemSetting).filter(SystemSetting.key == key).first()
        if existing:
            existing.value = str(value) if value is not None else ''
        else:
            setting = SystemSetting(id=uuid4(), key=key, value=str(value) if value is not None else '')
            db.session.add(setting)
    db.session.commit()
    return jsonify({'message': 'Settings updated'}), 200


# ─── Test Send ────────────────────────────────────────────────────────────────

@reminders_bp.route('/test', methods=['POST'])
@jwt_required()
def test_send():
    """Send a test email or SMS."""
    data = request.get_json() or {}
    channel = data.get('channel', 'email')
    recipient = data.get('recipient', '')
    settings = get_settings()

    if channel == 'email':
        if not recipient or '@' not in recipient:
            return jsonify({'error': 'Valid email address required'}), 400
        result = EmailService.send(
            to_email=recipient,
            subject='Test Reminder — CV Raman Health',
            body_html='<h2>Test Reminder</h2><p>If you received this, email reminders are working.</p>',
            settings=settings
        )
    elif channel == 'sms':
        if not recipient or len(recipient.replace('+', '').replace(' ', '')) < 10:
            return jsonify({'error': 'Valid phone number required'}), 400
        template_id = settings.get('msg91_24h_template_id')
        if not template_id:
            return jsonify({'error': 'MSG91 template ID not configured'}), 400
        result = SMSService.send(
            phone_number=recipient,
            template_id=template_id,
            variables={'patient_name': 'Test Patient', 'doctor_name': 'Dr Test', 'date': 'Today', 'time': '10:00 AM'},
            settings=settings
        )
    else:
        return jsonify({'error': f'Unknown channel: {channel}'}), 400

    if result.get('success'):
        return jsonify({'message': f'Test {channel} sent successfully to {recipient}'}), 200
    else:
        return jsonify({'error': result.get('error', 'Unknown error')}), 500


# ─── Logs ─────────────────────────────────────────────────────────────────────

@reminders_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_reminder_logs():
    """List reminder logs with optional filters."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    encounter_id = request.args.get('encounter_id')
    status = request.args.get('status')
    channel = request.args.get('channel')

    query = db.session.query(ReminderLog)
    if encounter_id:
        query = query.filter(ReminderLog.encounter_id == UUID(encounter_id))
    if status:
        query = query.filter(ReminderLog.status == status)
    if channel:
        query = query.filter(ReminderLog.channel == channel)

    total = query.count()
    logs = query.order_by(ReminderLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'logs': [l.to_dict() for l in logs],
        'total': total,
        'page': page,
        'per_page': per_page
    }), 200


# ─── Per-encounter status ─────────────────────────────────────────────────────

@reminders_bp.route('/encounter/<uuid:encounter_id>/status', methods=['GET'])
@jwt_required()
def get_encounter_reminder_status(encounter_id):
    """Get reminder status for a specific encounter."""
    logs = db.session.query(ReminderLog).filter(
        ReminderLog.encounter_id == encounter_id
    ).order_by(ReminderLog.created_at.desc()).all()

    status = {
        '24h_email': 'pending',
        '24h_sms': 'pending',
        '2h_email': 'pending',
        '2h_sms': 'pending',
    }
    for log in logs:
        key = f'{log.reminder_type}_{log.channel}'
        if key in status:
            if log.status == 'sent':
                status[key] = 'sent'
            elif log.status == 'failed' and status[key] == 'pending':
                status[key] = 'failed'
            elif log.status == 'skipped' and status[key] == 'pending':
                status[key] = 'skipped'

    return jsonify({
        'status': status,
        'logs': [l.to_dict() for l in logs]
    }), 200
