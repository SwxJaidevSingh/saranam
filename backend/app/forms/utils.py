"""Form utility functions."""
from flask import request


def get_client_ip():
    """
    Get the client's IP address from the request.
    Handles proxies, load balancers, and CDNs properly.

    Returns:
        str: The client's IP address
    """
    # Check for common proxy headers (in order of reliability)
    headers_to_check = [
        'X-Forwarded-For',      # Standard proxy header
        'X-Real-IP',            # Nginx proxy header
        'CF-Connecting-IP',     # Cloudflare
        'True-Client-IP',       # Cloudflare Enterprise
        'X-Client-IP',          # Some proxies
        'Forwarded',            # RFC 7239
    ]

    for header in headers_to_check:
        ip = request.headers.get(header)
        if ip:
            # X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
            # Take the first one (the original client)
            if ',' in ip:
                ip = ip.split(',')[0].strip()
            return ip

    # Fallback to direct connection IP
    return request.remote_addr or 'Unknown'


def get_geolocation_data(form_data):
    """
    Extract and validate geolocation data from form submission.

    Args:
        form_data (dict): Form submission data

    Returns:
        dict: Validated geolocation data or None
    """
    geo_data = {}

    # Extract GPS coordinates if present
    if isinstance(form_data, dict):
        if 'lat' in form_data and 'lng' in form_data:
            try:
                geo_data['latitude'] = float(form_data['lat'])
                geo_data['longitude'] = float(form_data['lng'])

                # Validate coordinates
                if not (-90 <= geo_data['latitude'] <= 90):
                    geo_data.pop('latitude', None)
                if not (-180 <= geo_data['longitude'] <= 180):
                    geo_data.pop('longitude', None)

                # Add accuracy if present
                if 'accuracy' in form_data:
                    try:
                        geo_data['accuracy_meters'] = float(form_data['accuracy'])
                    except (ValueError, TypeError):
                        pass

            except (ValueError, TypeError):
                pass

        # Extract IP address
        if 'ip' in form_data:
            geo_data['ip_address'] = str(form_data['ip'])

        # Extract manual address
        if 'address' in form_data:
            geo_data['address'] = str(form_data['address'])

        # Extract timestamp
        if 'timestamp' in form_data:
            geo_data['captured_at'] = str(form_data['timestamp'])

    return geo_data if geo_data else None
