from flask import Blueprint, jsonify, Request,request,Response
from flask_jwt_extended import jwt_required
from app.call_logs.service import ExotelService

exotel_bp = Blueprint("exotel", __name__)


@exotel_bp.route("/api/exotel/calls", methods=["GET"])
def get_calls():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    result = ExotelService.get_calls(start_date, end_date)

    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]

    return jsonify(result), 200


@exotel_bp.route("/api/exotel/make-call", methods=["POST"])
def make_call():
    data = request.get_json()
    
    from_number = data.get('from')
    to_number = data.get('to')
    patient_name = data.get('patient_name')
    provider_name = data.get('provider_name')
    
    if not from_number or not to_number:
        return jsonify({"error": "Missing from or to number"}), 400
        
    result = ExotelService.make_call(from_number, to_number, patient_name, provider_name)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 200


@exotel_bp.route("/api/exotel/agents", methods=["GET"])
@jwt_required()
def get_agents():
    """Fetch all providers with their call-log on-duty status."""
    result = ExotelService.get_agents_with_status()
    return jsonify(result), 200


@exotel_bp.route("/api/exotel/agent-status", methods=["PUT"])
@jwt_required()
def update_agent_status():
    """Update on-duty status for an agent."""
    data = request.get_json()
    provider_id = data.get('provider_id')
    is_on_duty = data.get('is_on_duty')
    
    if not provider_id or is_on_duty is None:
        return jsonify({"error": "Missing provider_id or is_on_duty"}), 400
        
    result = ExotelService.update_agent_status(provider_id, is_on_duty)
    return jsonify(result), 200


@exotel_bp.route("/api/exotel/inbound", methods=["GET", "POST"])
def inbound_routing():
    """Exotel Dynamic Routing endpoint."""
    # Exotel sends parameters in GET for Passthru and POST for Dynamic Connect
    from_number = request.args.get('From') or request.form.get('From')
    response = ExotelService.get_inbound_routing_response(from_number)
    
    # If the service returns a dictionary, send it as JSON (required for Connect Applet)
    if isinstance(response, dict):
        return jsonify(response)
        
    # If it's a string, send it as XML (for standard Passthru)
    return Response(response, mimetype="application/xml", status=200)


@exotel_bp.route("/api/exotel/call-status/<call_sid>", methods=["GET"])
def get_call_status(call_sid):
    result = ExotelService.get_call_status(call_sid)
    
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 200


@exotel_bp.route("/api/exotel/sop", methods=["GET", "POST"])
@jwt_required()
def handle_sop():
    """Handle SOP documentation (GET for escalations, POST for saving)."""
    if request.method == "POST":
        data = request.get_json()
        result = ExotelService.save_sop(data)
        if isinstance(result, tuple):
            return jsonify(result[0]), result[1]
        return jsonify(result), 201
    else:
        # GET request - fetch escalations
        result = ExotelService.get_escalations()
        if isinstance(result, tuple):
            return jsonify(result[0]), result[1]
        return jsonify(result), 200


@exotel_bp.route("/api/exotel/sop/history", methods=["GET"])
@jwt_required()
def get_sop_history():
    """Fetch paginated SOP records."""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))
    
    result = ExotelService.get_sop_history(start_date, end_date, page, per_page)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 200


@exotel_bp.route("/api/exotel/scheduler", methods=["GET"])
@jwt_required()
def get_scheduler():
    """Fetch scheduled calls."""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    result = ExotelService.get_schedule(start_date, end_date)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 200


@exotel_bp.route("/api/exotel/scheduler", methods=["POST"])
@jwt_required()
def add_to_scheduler():
    """Add a patient to the schedule."""
    data = request.get_json()
    patient_id = data.get("patient_id")
    scheduled_date = data.get("scheduled_date") # Expected in ISO format or similar
    notes = data.get("notes")
    
    if not patient_id or not scheduled_date:
        return jsonify({"error": "patient_id and scheduled_date are required"}), 400
        
    result = ExotelService.add_to_schedule(patient_id, scheduled_date, notes)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 201


@exotel_bp.route("/api/exotel/scheduler/<uuid:schedule_id>", methods=["DELETE"])
@jwt_required()
def remove_from_scheduler(schedule_id):
    """Remove a record from the schedule."""
    result = ExotelService.remove_from_schedule(schedule_id)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 200


@exotel_bp.route("/api/exotel/scheduler/auto-generate", methods=["POST"])
@jwt_required()
def auto_generate_scheduler():
    """Trigger auto-generation of call schedules."""
    result = ExotelService.auto_generate_schedule()
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 201

@exotel_bp.route("/api/exotel/send-email", methods=["POST"])
@jwt_required()
def send_email():
    """Send a customizable email to a patient."""
    data = request.get_json()
    patient_id = data.get("patient_id")
    subject = data.get("subject")
    body = data.get("body")
    
    if not patient_id or not subject or not body:
        return jsonify({"error": "patient_id, subject, and body are required"}), 400
        
    result = ExotelService.send_email(patient_id, subject, body)
    
    if isinstance(result, tuple):
        return jsonify(result[0]), result[1]
        
    return jsonify(result), 200