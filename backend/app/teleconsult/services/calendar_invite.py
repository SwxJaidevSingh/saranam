"""ICSGenerator — produces an iCalendar VEVENT with VALARMs at 24h and 15min.

Google Calendar / Outlook respect VALARM blocks → users get NATIVE reminders
without depending on our APScheduler. Our APScheduler-driven WA reminders
are a second, independent layer.

Refs: RFC 5545 (https://datatracker.ietf.org/doc/html/rfc5545)
"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional


def _fmt_local(dt: datetime, tz: str) -> str:
    """Format a naive datetime as YYYYMMDDTHHMMSS for use with TZID=tz."""
    return dt.strftime("%Y%m%dT%H%M%S")


def _fmt_utc(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _escape(s: Optional[str]) -> str:
    """Escape iCal text values (commas, semicolons, newlines, backslashes)."""
    if not s:
        return ""
    return (
        s.replace("\\", "\\\\")
        .replace(",", "\\,")
        .replace(";", "\\;")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def build_ics(
    *,
    uid: str,
    summary: str,
    description: str,
    start: datetime,
    end: Optional[datetime] = None,
    join_url: Optional[str] = None,
    organizer_name: str,
    organizer_email: str,
    attendee_name: Optional[str] = None,
    attendee_email: Optional[str] = None,
    method: str = "REQUEST",  # REQUEST | CANCEL
    sequence: int = 0,
    timezone: str = "Asia/Kolkata",
    duration_minutes: int = 30,
) -> str:
    """Return an iCal VCALENDAR string.

    Attach via EmailService.send(... ics_content=build_ics(...)).
    Gmail will render an inline RSVP card and let recipients add it to Google
    Calendar in one click.
    """
    if end is None:
        end = start + timedelta(minutes=duration_minutes)

    status = "CANCELLED" if method == "CANCEL" else "CONFIRMED"

    lines = [
        "BEGIN:VCALENDAR",
        "PRODID:-//Saranam Palliative Care//Teleconsult//EN",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        f"METHOD:{method}",
        # Minimal VTIMEZONE — using a named-zone reference is enough for
        # Google Calendar / Outlook on the receiving end.
        "BEGIN:VTIMEZONE",
        f"TZID:{timezone}",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        "TZOFFSETFROM:+0530",
        "TZOFFSETTO:+0530",
        "TZNAME:IST",
        "END:STANDARD",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        f"UID:{_escape(uid)}",
        f"DTSTAMP:{_fmt_utc(datetime.utcnow())}",
        f"DTSTART;TZID={timezone}:{_fmt_local(start, timezone)}",
        f"DTEND;TZID={timezone}:{_fmt_local(end, timezone)}",
        f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(description)}",
    ]
    if join_url:
        lines.append(f"URL:{_escape(join_url)}")
        lines.append(f"LOCATION:{_escape(join_url)}")
    lines.append(f"ORGANIZER;CN={_escape(organizer_name)}:mailto:{organizer_email}")
    if attendee_email:
        lines.append(
            f"ATTENDEE;CN={_escape(attendee_name or attendee_email)};"
            f"RSVP=TRUE:mailto:{attendee_email}"
        )
    lines.append(f"STATUS:{status}")
    lines.append(f"SEQUENCE:{sequence}")

    if method == "REQUEST":
        # 24-hour reminder
        lines += [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            "DESCRIPTION:Teleconsult tomorrow",
            "TRIGGER:-PT24H",
            "END:VALARM",
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            "DESCRIPTION:Teleconsult starting in 15 minutes",
            "TRIGGER:-PT15M",
            "END:VALARM",
        ]

    lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
