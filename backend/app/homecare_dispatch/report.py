"""Daily dispatch completion report: metrics, CSV and PDF.

Port of the Saranam Streamlit ``pages/report/service.py``.
"""
import csv
import html
import io
from datetime import date
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.homecare_dispatch import logic
from app.homecare_dispatch.repository import FALLBACK_DEPOT


def _is_initial(r) -> bool:
    return (r.get("visit_type") == "initial" or r.get("patient_type_at_visit") == "new") and r.get("visit_type") != "bereavement"


def _is_followup(r) -> bool:
    return (r.get("visit_type") in ("follow_up", "normal", None) and r.get("patient_type_at_visit") != "new") and r.get("visit_type") != "bereavement"


def _is_bereavement(r) -> bool:
    return r.get("visit_type") == "bereavement"


def compile_report_metrics(
    report_rows: List[Dict[str, Any]],
    hospitals: Optional[Dict[str, tuple]] = None,
    shorten: Callable[[str], str] = logic.shorten_url,
    save_route: Optional[Callable[..., None]] = None,
) -> Tuple[Dict[str, Any], Dict[str, Dict[str, Any]]]:
    """KPI statistics and rows grouped by vehicle.

    Vehicles with no stored route links get round-trip and one-way links built,
    shortened and (through ``save_route``) stored, as the Streamlit report does.
    """
    total_patients = len(report_rows)
    completed_count = sum(1 for r in report_rows if r["status"] == "completed")
    failed_count = sum(1 for r in report_rows if r["status"] == "failed")
    pending_count = sum(1 for r in report_rows if r["status"] in ("pending", "active"))

    unique_vehicles: Dict[str, Dict[str, Any]] = {}
    for r in report_rows:
        v_name = r["vehicle_name"]
        if v_name not in unique_vehicles:
            unique_vehicles[v_name] = {
                "reg": r["vehicle_reg_number"],
                "vehicle_id": str(r.get("vehicle_id")) if r.get("vehicle_id") else None,
                "base_hospital": r.get("base_hospital"),
                "slots": [],
                "completed": 0,
                "failed": 0,
                "pending": 0,
                "round_trip_url": r.get("round_trip_url") or "",
                "one_way_url": r.get("one_way_url") or "",
                "round_trip_short_url": r.get("round_trip_short_url") or "",
                "one_way_short_url": r.get("one_way_short_url") or "",
            }
        unique_vehicles[v_name]["slots"].append(r)
        if r["status"] == "completed":
            unique_vehicles[v_name]["completed"] += 1
        elif r["status"] == "failed":
            unique_vehicles[v_name]["failed"] += 1
        else:
            unique_vehicles[v_name]["pending"] += 1

    for v_info in unique_vehicles.values():
        if v_info.get("round_trip_short_url") or v_info.get("round_trip_url"):
            continue
        stops_coords = [
            (s["lat"], s["lon"]) for s in v_info["slots"]
            if s.get("lat") is not None and s.get("lon") is not None
        ]
        if not stops_coords:
            continue
        depot = (hospitals or {}).get(v_info.get("base_hospital")) or FALLBACK_DEPOT
        url_rt, url_ow = logic.google_maps_route_urls(depot[0], depot[1], stops_coords)
        short_rt, short_ow = shorten(url_rt), shorten(url_ow)
        v_info.update({
            "round_trip_url": url_rt, "one_way_url": url_ow,
            "round_trip_short_url": short_rt, "one_way_short_url": short_ow,
        })
        if save_route and v_info.get("vehicle_id") and report_rows:
            try:
                save_route(report_rows[0]["schedule_date"], v_info["vehicle_id"], url_rt, url_ow, short_rt, short_ow)
            except Exception as e:
                print(f"Error persisting route to DB during report compilation: {e}")

    completion_rate = 0.0
    completed_or_failed = completed_count + failed_count
    if completed_or_failed > 0:
        completion_rate = (completed_count / completed_or_failed) * 100.0

    def count(pred, status=None):
        return sum(1 for r in report_rows if (status is None or r["status"] == status) and pred(r))

    metrics = {
        "total_patients": total_patients,
        "completed": completed_count,
        "failed": failed_count,
        "pending": pending_count,
        "total_vehicles": len(unique_vehicles),
        "completion_rate": completion_rate,
        "initial_count": count(_is_initial),
        "followup_count": count(_is_followup),
        "bereavement_count": count(_is_bereavement),
        "completed_initial": count(_is_initial, "completed"),
        "completed_followup": count(_is_followup, "completed"),
        "completed_bereavement": count(_is_bereavement, "completed"),
        "failed_initial": count(_is_initial, "failed"),
        "failed_followup": count(_is_followup, "failed"),
        "failed_bereavement": count(_is_bereavement, "failed"),
    }
    return metrics, unique_vehicles


def generate_csv_data(report_rows: List[Dict[str, Any]], unique_vehicles: Optional[Dict[str, Any]] = None) -> str:
    """Spreadsheet export of a date's stops, including route map links."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Vehicle Name", "Vehicle Reg", "Stop Order",
        "Patient Name", "Patient UHID", "Visit Type", "Patient Zone", "Status",
        "Priority At Visit", "Urgency Score", "Drive Distance (km)", "Drive Duration (mins)",
        "Round Trip Map URL", "One Way Map URL",
    ])
    for r in report_rows:
        rt_link = r.get("round_trip_short_url") or r.get("round_trip_url") or ""
        ow_link = r.get("one_way_short_url") or r.get("one_way_url") or ""
        if not rt_link and unique_vehicles and r.get("vehicle_name") in unique_vehicles:
            v_i = unique_vehicles[r["vehicle_name"]]
            rt_link = v_i.get("round_trip_short_url") or v_i.get("round_trip_url") or ""
            ow_link = v_i.get("one_way_short_url") or v_i.get("one_way_url") or ""

        vt_raw = r.get("visit_type") or ("initial" if r.get("patient_type_at_visit") == "new" else "follow_up")
        vt_label = {
            "initial": "Initial Visit",
            "follow_up": "Follow-up Visit",
            "bereavement": "Bereavement Visit",
            "normal": "Normal Visit",
        }.get(str(vt_raw).lower(), str(vt_raw).title())

        writer.writerow([
            r["schedule_date"],
            r["vehicle_name"],
            r["vehicle_reg_number"],
            r["slot_order"],
            r["patient_name"],
            r["patient_uhid"],
            vt_label,
            r["patient_zone"],
            r["status"].title(),
            r["priority_at_visit"] or "N/A",
            r["urgency_score_at_visit"] or "N/A",
            f"{r['drive_distance_km']:.2f}" if r["drive_distance_km"] is not None else "0.00",
            f"{r['drive_duration_min']:.1f}" if r["drive_duration_min"] is not None else "0.0",
            rt_link,
            ow_link,
        ])
    return output.getvalue()


def generate_pdf_report(selected_date: date, metrics: Dict[str, Any], unique_vehicles: Dict[str, Any]) -> bytes:
    """Daily Dispatch & Completion Report PDF, laid out like the Streamlit export."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (
        HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    def style(name, font, size, leading, color, align=0):
        return ParagraphStyle(name, parent=styles['Normal'], fontName=font, fontSize=size,
                              leading=leading, alignment=align, textColor=colors.HexColor(color) if color.startswith('#') else getattr(colors, color))

    title_style = style('DocTitle', 'Helvetica-Bold', 20, 24, '#0F172A')
    subtitle_style = style('DocSubtitle', 'Helvetica', 9.5, 13, '#64748B')
    kpi_num_style = style('KpiNum', 'Helvetica-Bold', 16, 18, '#0F172A', 1)
    kpi_label_style = style('KpiLabel', 'Helvetica-Bold', 8, 10, '#64748B', 1)
    v_header_left = style('VHeaderLeft', 'Helvetica-Bold', 10.5, 13, 'white')
    v_header_right = style('VHeaderRight', 'Helvetica-Bold', 9.5, 13, '#E2E8F0', 2)
    map_link_style = style('MapLink', 'Helvetica', 8.5, 12, '#1E293B')
    cell_style = style('CellText', 'Helvetica', 8.5, 11, '#1E293B')
    cell_bold = style('CellBold', 'Helvetica-Bold', 8.5, 11, '#0F172A')
    status_completed = style('StatusCompleted', 'Helvetica-Bold', 8, 10, '#065F46', 1)
    status_failed = style('StatusFailed', 'Helvetica-Bold', 8, 10, '#991B1B', 1)
    status_pending = style('StatusPending', 'Helvetica-Bold', 8, 10, '#92400E', 1)
    section_title = style('SecTitle', 'Helvetica-Bold', 12, 15, '#0F172A')

    story = []
    date_str = selected_date.strftime("%A, %B %d, %Y")
    export_str = date.today().strftime("%Y-%m-%d")
    story.append(Paragraph("SARANAM INDIA HEALTH — HOMECARE OPERATIONS", subtitle_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Daily Dispatch & Completion Report", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"Run Date: <b>{html.escape(date_str)}</b>  |  Exported on {export_str}", subtitle_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F172A"), spaceBefore=2, spaceAfter=12))

    kpi_table = Table([
        [
            Paragraph(str(metrics["total_patients"]), kpi_num_style),
            Paragraph(f"<font color='#059669'>{metrics['completed']}</font>", kpi_num_style),
            Paragraph(f"<font color='#DC2626'>{metrics['failed']}</font>", kpi_num_style),
            Paragraph(str(metrics["total_vehicles"]), kpi_num_style),
            Paragraph(f"<font color='#2563EB'>{metrics['completion_rate']:.1f}%</font>", kpi_num_style),
        ],
        [
            Paragraph("SCHEDULED PATIENTS", kpi_label_style),
            Paragraph("COMPLETED VISITS", kpi_label_style),
            Paragraph("FAILED / ABSENT", kpi_label_style),
            Paragraph("ACTIVE VEHICLES", kpi_label_style),
            Paragraph("COMPLETION RATE", kpi_label_style),
        ],
    ], colWidths=[108, 108, 108, 108, 108])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
        ('TOPPADDING', (0, 1), (-1, 1), 2),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 16))
    story.append(Paragraph("Vehicle Itineraries & Execution Logs", section_title))
    story.append(Spacer(1, 8))

    for v_name, v_info in unique_vehicles.items():
        v_elements = []
        v_total = v_info["completed"] + v_info["failed"] + v_info["pending"]
        v_rate = (v_info["completed"] / v_total * 100.0) if v_total > 0 else 0.0

        banner_table = Table([[
            Paragraph(f"<b>Vehicle:</b> {html.escape(str(v_name))} ({html.escape(str(v_info.get('reg') or 'Unregistered'))})", v_header_left),
            Paragraph(f"Completion: <b>{v_rate:.1f}%</b> ({v_info['completed']}/{v_total} runs)", v_header_right),
        ]], colWidths=[340, 200])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1E293B')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        v_elements.append(banner_table)

        map_rows = []
        rt_url, ow_url = v_info.get("round_trip_url"), v_info.get("one_way_url")
        if rt_url:
            rt_disp = v_info.get("round_trip_short_url") or rt_url
            map_rows.append([Paragraph(
                f"<b>Round-Trip Route (Base ➔ Stops ➔ Base):</b> "
                f"<a href='{html.escape(rt_url)}' color='#0284C7'><u>{html.escape(rt_disp)}</u></a>", map_link_style)])
        if ow_url:
            ow_disp = v_info.get("one_way_short_url") or ow_url
            map_rows.append([Paragraph(
                f"<b>One-Way Route (Base ➔ Stops ➔ Last Patient):</b> "
                f"<a href='{html.escape(ow_url)}' color='#0284C7'><u>{html.escape(ow_disp)}</u></a>", map_link_style)])
        if not map_rows:
            map_rows.append([Paragraph("<i>No coordinates available for route mapping.</i>", map_link_style)])
        maps_table = Table(map_rows, colWidths=[540])
        maps_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        v_elements.append(maps_table)

        table_data = [[Paragraph(f"<b>{h}</b>", cell_bold) for h in
                       ("Stop", "Patient Name", "UHID", "Zone", "Priority", "Visit Type", "Status", "Drive Info")]]
        for slot in v_info["slots"]:
            status = slot["status"].lower()
            if status == "completed":
                st_p = Paragraph("<font color='#065F46'><b>Completed</b></font>", status_completed)
            elif status == "failed":
                st_p = Paragraph("<font color='#991B1B'><b>Absent/Failed</b></font>", status_failed)
            else:
                st_p = Paragraph(f"<font color='#92400E'><b>{html.escape(status.title())}</b></font>", status_pending)

            dist_km, dur_min = slot.get('drive_distance_km'), slot.get('drive_duration_min')
            dist_str = f"+{dist_km:.2f}km ({dur_min:.0f}m)" if dist_km is not None and dur_min is not None else "Start / Depot"

            vt_val = str(slot.get("visit_type") or ("initial" if slot.get("patient_type_at_visit") == "new" else "follow_up")).lower()
            if vt_val == "bereavement":
                vt_p = Paragraph("<font color='#7C3AED'><b>Bereavement</b></font>", cell_style)
            elif vt_val == "initial":
                vt_p = Paragraph("<font color='#2563EB'><b>Initial</b></font>", cell_style)
            else:
                vt_p = Paragraph("<font color='#059669'><b>Follow-up</b></font>", cell_style)

            table_data.append([
                Paragraph(f"#{slot.get('slot_order', '-')}", cell_bold),
                Paragraph(html.escape(str(slot.get('patient_name', ''))), cell_style),
                Paragraph(html.escape(str(slot.get('patient_uhid') or 'N/A')), cell_style),
                Paragraph(html.escape(str(slot.get('patient_zone', ''))), cell_style),
                Paragraph(html.escape(str(slot.get('priority_at_visit') or 'N/A')), cell_style),
                vt_p,
                st_p,
                Paragraph(dist_str, cell_style),
            ])
        stops_table = Table(table_data, colWidths=[32, 110, 60, 60, 58, 75, 75, 70])
        stops_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ]))
        v_elements.append(stops_table)
        v_elements.append(Spacer(1, 14))
        story.append(KeepTogether(v_elements))

    doc.build(story)
    return buf.getvalue()
