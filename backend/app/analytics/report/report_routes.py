"""
Report Routes: API endpoints for custom analytics reporting, live preview,
and direct file downloads (.xlsx, .csv).
"""
import io
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, Response, send_file
from app.auth.decorators import require_auth
from app.analytics.report.report_service import ReportService

logger = logging.getLogger(__name__)


def register_report_routes(bp: Blueprint):
    """Register all reporting routes onto the parent analytics blueprint."""

    @bp.route('/reports/datasets', methods=['GET'])
    @require_auth
    def get_report_datasets(current_user):
        """Return available report datasets, date field options, and column schemas."""
        try:
            data = ReportService.get_dataset_schemas()
            return jsonify({'success': True, 'data': data}), 200
        except Exception as e:
            logger.exception("Error in get_report_datasets: %s", e)
            return jsonify({'success': False, 'error': str(e)}), 500

    @bp.route('/reports/preview', methods=['POST'])
    @require_auth
    def get_report_preview(current_user):
        """
        Generate live preview data (sample 10 rows + dynamic visualization)
        based on selected dataset, time range, filters, and columns.
        """
        try:
            body = request.get_json() or {}
            dataset = body.get('dataset', 'patients')
            date_field = body.get('date_field')
            start_date = body.get('start_date')
            end_date = body.get('end_date')
            filters = body.get('filters', {})
            columns = body.get('columns', [])
            custom_hospital_code = body.get('custom_hospital_code')

            preview = ReportService.generate_preview(
                dataset=dataset,
                date_field=date_field,
                start_date=start_date,
                end_date=end_date,
                filters=filters,
                columns=columns,
                custom_hospital_code=custom_hospital_code
            )

            return jsonify({'success': True, 'data': preview}), 200
        except Exception as e:
            logger.exception("Error in get_report_preview: %s", e)
            return jsonify({'success': False, 'error': str(e)}), 500

    @bp.route('/reports/export', methods=['POST'])
    @require_auth
    def export_report_file(current_user):
        """
        Export custom dataset in Excel (.xlsx) or CSV (.csv) format
        with only the columns the user specified.
        """
        try:
            body = request.get_json() or {}
            dataset = body.get('dataset', 'patients')
            date_field = body.get('date_field')
            start_date = body.get('start_date')
            end_date = body.get('end_date')
            filters = body.get('filters', {})
            columns = body.get('columns', [])
            format_type = body.get('format', 'csv').lower()
            custom_hospital_code = body.get('custom_hospital_code')

            # Fetch dataset schemas to resolve column labels
            schemas = ReportService.get_dataset_schemas()
            curr_schema = next((d for d in schemas.get('datasets', []) if d['id'] == dataset), None)
            column_labels = {}
            if curr_schema:
                column_labels = {c['id']: c['label'] for c in curr_schema.get('columns', [])}

            # Fetch all records
            records = ReportService.fetch_data_records(
                dataset=dataset,
                date_field=date_field,
                start_date=start_date,
                end_date=end_date,
                filters=filters,
                selected_columns=columns,
                custom_hospital_code=custom_hospital_code
            )

            if not columns and records:
                columns = list(records[0].keys())

            date_str = datetime.now().strftime('%Y-%m-%d')
            filename_base = f"{dataset}_report_{date_str}"

            if format_type == 'xlsx':
                xlsx_bytes = ReportService.export_xlsx(
                    records=records,
                    columns=columns,
                    column_labels=column_labels,
                    sheet_title=curr_schema['name'] if curr_schema else "Report"
                )
                return send_file(
                    io.BytesIO(xlsx_bytes),
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    as_attachment=True,
                    download_name=f"{filename_base}.xlsx"
                )
            else:
                csv_str = ReportService.export_csv(
                    records=records,
                    columns=columns,
                    column_labels=column_labels
                )
                # Add UTF-8 BOM so Excel opens non-ASCII characters properly
                csv_bytes = ('\ufeff' + csv_str).encode('utf-8')
                return send_file(
                    io.BytesIO(csv_bytes),
                    mimetype='text/csv; charset=utf-8',
                    as_attachment=True,
                    download_name=f"{filename_base}.csv"
                )

        except Exception as e:
            logger.exception("Error in export_report_file: %s", e)
            return jsonify({'success': False, 'error': str(e)}), 500
