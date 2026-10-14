"""
Backend service for Distance Travelled (in kms) trend.
Decoupled PPT Charts service.
Queries the vehicle_logs table aggregated by calendar month and vehicle.
"""

from datetime import datetime
from collections import OrderedDict
from typing import Dict, Any, List
from app.extensions import db
from app.saranam.models.vehicle_log import VehicleLog
from app.saranam.models.vehicle import Vehicle
from .shared.filters.patient_filters import parse_filter_params, apply_date_range_filter

VEHICLE_COLORS = [
    '#2563eb',  # Blue (Vehicle 1)
    '#ea580c',  # Orange (Vehicle 2)
    '#10b981',  # Emerald
    '#8b5cf6',  # Violet
    '#f59e0b',  # Amber
    '#06b6d4',  # Cyan
]

def get_vehicle_distance_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch monthly distance travelled per vehicle from vehicle_logs.
    Filters: start_date, end_date (applied to vehicle_logs.date).
    Only live data from the database is returned.
    """
    filters = parse_filter_params(params)
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    query = (
        db.session.query(
            VehicleLog.date,
            VehicleLog.number_of_kms,
            VehicleLog.opening_kms,
            VehicleLog.closing_kms,
            VehicleLog.vehicle_id,
            Vehicle.name.label('vehicle_name')
        )
        .outerjoin(Vehicle, VehicleLog.vehicle_id == Vehicle.id)
    )

    if start_date or end_date:
        query = apply_date_range_filter(
            query, VehicleLog.date,
            start_date=start_date,
            end_date=end_date,
        )

    query = query.order_by(VehicleLog.date.asc())
    rows = query.all()

    # If no logs recorded in database for the given criteria, return empty live structure
    if not rows:
        return {
            'success': True,
            'data': [],
            'vehicles': [],
            'totals': {},
            'grand_total': 0,
        }


    # Discover and sort unique vehicles
    vehicle_map = OrderedDict()
    for row in rows:
        vid = str(row.vehicle_id) if row.vehicle_id else 'unknown'
        if vid not in vehicle_map:
            v_name = (row.vehicle_name or '').strip()
            if not v_name:
                v_name = f"Vehicle {len(vehicle_map) + 1}"
            vehicle_map[vid] = v_name

    # Build vehicle config
    vehicles: List[Dict[str, Any]] = []
    vid_to_key = {}
    for idx, (vid, raw_name) in enumerate(vehicle_map.items()):
        key = f"vehicle_{idx + 1}"
        vid_to_key[vid] = key
        # Format display name: ensure "(in kms)" is included if not present
        display_name = raw_name if '(in kms)' in raw_name.lower() else f"{raw_name} (in kms)"
        color = VEHICLE_COLORS[idx % len(VEHICLE_COLORS)]
        vehicles.append({
            'id': vid,
            'key': key,
            'name': display_name,
            'color': color,
        })

    # Group by calendar month
    monthly_data = OrderedDict()

    for row in rows:
        d = row.date
        if not d:
            continue
        if isinstance(d, str):
            try:
                d = datetime.strptime(d[:10], '%Y-%m-%d').date()
            except Exception:
                continue

        month_key = d.strftime('%Y-%m')
        month_label = d.strftime('%b-%y').upper()

        if month_key not in monthly_data:
            monthly_data[month_key] = {
                'month': month_label,
                'month_key': month_key,
            }
            for v in vehicles:
                monthly_data[month_key][v['key']] = 0

        # Calculate distance
        kms = 0
        if row.number_of_kms is not None:
            kms = float(row.number_of_kms)
        elif row.closing_kms is not None and row.opening_kms is not None:
            diff = float(row.closing_kms) - float(row.opening_kms)
            kms = diff if diff > 0 else 0

        vid = str(row.vehicle_id) if row.vehicle_id else 'unknown'
        vkey = vid_to_key.get(vid, 'vehicle_1')
        monthly_data[month_key][vkey] = round(monthly_data[month_key].get(vkey, 0) + kms)

    sorted_list = []
    totals = {v['key']: 0 for v in vehicles}

    for month_key, item in sorted(monthly_data.items(), key=lambda x: x[0]):
        row_dict = {
            'month': item['month'],
            'month_key': item['month_key'],
        }
        row_total = 0
        for v in vehicles:
            val = item.get(v['key'], 0)
            # If 0 distance recorded, keep as 0 or null depending on whether vehicle had any runs
            row_dict[v['key']] = val if val > 0 else (0 if val == 0 else None)
            if val:
                totals[v['key']] += val
                row_total += val
        row_dict['total'] = row_total
        sorted_list.append(row_dict)

    grand_total = sum(totals.values())
    totals['grand_total'] = grand_total

    return {
        'success': True,
        'data': sorted_list,
        'vehicles': vehicles,
        'totals': totals,
        'grand_total': grand_total,
    }
