#!/usr/bin/env python3
"""
Generate HTML report from markdown gap analysis
"""
import markdown
from pathlib import Path

def generate_html_report():
    """Convert markdown gap analysis to HTML with print-friendly styling"""

    # Read markdown file
    md_file = Path("PALLIATIVE_CARE_GAP_ANALYSIS.md")
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Convert markdown to HTML
    html_body = markdown.markdown(
        md_content,
        extensions=['tables', 'fenced_code', 'toc', 'attr_list']
    )

    # Create full HTML with professional styling
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palliative Care HMIS Gap Analysis Report - CV Raman Health</title>
    <style>
        /* Print-optimized styles */
        @page {{
            size: A4;
            margin: 2cm 1.5cm;
        }}

        @media print {{
            body {{
                font-size: 10pt;
                line-height: 1.4;
            }}

            h1 {{
                page-break-before: always;
                font-size: 18pt;
            }}

            h1:first-of-type {{
                page-break-before: avoid;
            }}

            h2 {{
                page-break-after: avoid;
                font-size: 14pt;
            }}

            h3, h4 {{
                page-break-after: avoid;
            }}

            table {{
                page-break-inside: avoid;
                font-size: 9pt;
            }}

            thead {{
                display: table-header-group;
            }}

            tr {{
                page-break-inside: avoid;
            }}

            .no-print {{
                display: none;
            }}

            a {{
                text-decoration: none;
                color: #000;
            }}
        }}

        /* Screen styles */
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
        }}

        .container {{
            max-width: 1000px;
            margin: 0 auto;
            background-color: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }}

        h1 {{
            color: #2c3e50;
            font-size: 28px;
            border-bottom: 4px solid #3498db;
            padding-bottom: 12px;
            margin: 40px 0 20px 0;
        }}

        h1:first-of-type {{
            margin-top: 0;
        }}

        h2 {{
            color: #34495e;
            font-size: 22px;
            border-bottom: 2px solid #95a5a6;
            padding-bottom: 8px;
            margin: 35px 0 15px 0;
        }}

        h3 {{
            color: #2c3e50;
            font-size: 18px;
            margin: 25px 0 12px 0;
            font-weight: 600;
        }}

        h4 {{
            color: #555;
            font-size: 14px;
            margin: 20px 0 10px 0;
            font-weight: 600;
        }}

        p {{
            margin: 10px 0;
            text-align: justify;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 10pt;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}

        thead {{
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
        }}

        th {{
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 9pt;
            letter-spacing: 0.5px;
        }}

        td {{
            padding: 10px;
            border: 1px solid #e0e0e0;
            vertical-align: top;
        }}

        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}

        tr:hover {{
            background-color: #e8f4f8;
        }}

        code {{
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', 'Monaco', monospace;
            font-size: 10pt;
            color: #c7254e;
        }}

        pre {{
            background-color: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border-left: 4px solid #3498db;
        }}

        pre code {{
            background-color: transparent;
            padding: 0;
            color: #333;
        }}

        blockquote {{
            border-left: 4px solid #3498db;
            padding-left: 20px;
            margin: 15px 0;
            color: #555;
            font-style: italic;
            background-color: #f9f9f9;
            padding: 15px 15px 15px 20px;
            border-radius: 0 4px 4px 0;
        }}

        ul, ol {{
            margin: 15px 0;
            padding-left: 30px;
        }}

        li {{
            margin: 8px 0;
        }}

        /* Status indicators */
        td:contains("✅"), td:contains("Implemented") {{
            color: #27ae60;
        }}

        td:contains("❌"), td:contains("Missing") {{
            color: #e74c3c;
        }}

        td:contains("🔄"), td:contains("Adaptable") {{
            color: #f39c12;
        }}

        hr {{
            border: none;
            border-top: 2px solid #ddd;
            margin: 30px 0;
        }}

        /* Header styling */
        .report-header {{
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 4px double #3498db;
        }}

        .report-header h1 {{
            border: none;
            margin: 10px 0;
            font-size: 32px;
            color: #2c3e50;
        }}

        .report-subtitle {{
            font-size: 16px;
            color: #7f8c8d;
            font-weight: normal;
            margin: 10px 0;
        }}

        .report-meta {{
            font-size: 12px;
            color: #95a5a6;
            margin-top: 15px;
        }}

        /* Print button */
        .no-print {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }}

        .no-print:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }}

        /* Badges */
        .badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            margin: 0 5px;
        }}

        .badge-critical {{
            background-color: #e74c3c;
            color: white;
        }}

        .badge-high {{
            background-color: #f39c12;
            color: white;
        }}

        .badge-medium {{
            background-color: #3498db;
            color: white;
        }}

        .badge-low {{
            background-color: #95a5a6;
            color: white;
        }}

        /* Executive summary box */
        .summary-box {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 8px;
            margin: 30px 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}

        .summary-box h3 {{
            color: white;
            margin-top: 0;
        }}

        /* Highlight boxes */
        .highlight {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}

        .success {{
            background-color: #d4edda;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}

        .danger {{
            background-color: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}

        .info {{
            background-color: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }}
    </style>
</head>
<body>
    <button class="no-print" onclick="window.print()">📄 Print / Save as PDF</button>

    <div class="container">
        <div class="report-header">
            <h1>Palliative Care HMIS Gap Analysis Report</h1>
            <p class="report-subtitle">CV Raman Health Product vs Palliative Care PRD Requirements</p>
            <div class="report-meta">
                <strong>Version:</strong> 1.0 |
                <strong>Date:</strong> March 17, 2026 |
                <strong>Prepared For:</strong> CV Raman Health Product Team
            </div>
        </div>

        {html_body}

        <hr>
        <footer style="text-align: center; color: #95a5a6; font-size: 10pt; margin-top: 40px;">
            <p><strong>End of Gap Analysis Report</strong></p>
            <p>Prepared by Claude Code | Date: March 17, 2026 | Version: 1.0</p>
            <p style="margin-top: 10px; font-size: 9pt;">© 2026 CV Raman Health - Confidential and Proprietary</p>
        </footer>
    </div>

    <script>
        // Enhance tables with tooltips and interactions
        document.addEventListener('DOMContentLoaded', function() {{
            // Add hover effects
            const tables = document.querySelectorAll('table');
            tables.forEach(table => {{
                table.style.cursor = 'default';
            }});

            // Add status colors
            const cells = document.querySelectorAll('td, th');
            cells.forEach(cell => {{
                const text = cell.textContent.trim();
                if (text.includes('✅') || text.toLowerCase().includes('implemented')) {{
                    cell.style.color = '#27ae60';
                    cell.style.fontWeight = 'bold';
                }}
                if (text.includes('❌') || text.toLowerCase().includes('missing')) {{
                    cell.style.color = '#e74c3c';
                    cell.style.fontWeight = 'bold';
                }}
                if (text.includes('🔄') || text.toLowerCase().includes('adaptable')) {{
                    cell.style.color = '#f39c12';
                    cell.style.fontWeight = 'bold';
                }}
            }});
        }});
    </script>
</body>
</html>
"""

    # Write HTML file
    output_file = "PALLIATIVE_CARE_GAP_ANALYSIS_REPORT.html"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"✅ HTML report generated successfully: {output_file}")
    print(f"📄 Open the file in your browser and use Print → Save as PDF to create a PDF version")
    return output_file

if __name__ == "__main__":
    generate_html_report()
