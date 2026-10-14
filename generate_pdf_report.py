#!/usr/bin/env python3
"""
Generate PDF report from markdown gap analysis
"""
import markdown
from weasyprint import HTML, CSS
from pathlib import Path

def generate_pdf_report():
    """Convert markdown gap analysis to PDF"""

    # Read markdown file
    md_file = Path("PALLIATIVE_CARE_GAP_ANALYSIS.md")
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Convert markdown to HTML
    html_content = markdown.markdown(
        md_content,
        extensions=['tables', 'fenced_code', 'toc']
    )

    # Add CSS styling for professional look
    css = """
    @page {
        size: A4;
        margin: 2cm;
        @top-center {
            content: "Palliative Care HMIS Gap Analysis";
            font-size: 10px;
            color: #666;
        }
        @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10px;
            color: #666;
        }
    }

    body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        font-size: 11px;
        line-height: 1.6;
        color: #333;
    }

    h1 {
        color: #2c3e50;
        font-size: 24px;
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
        margin-top: 30px;
        page-break-before: always;
    }

    h1:first-of-type {
        page-break-before: avoid;
    }

    h2 {
        color: #34495e;
        font-size: 18px;
        border-bottom: 2px solid #95a5a6;
        padding-bottom: 5px;
        margin-top: 25px;
    }

    h3 {
        color: #2c3e50;
        font-size: 14px;
        margin-top: 20px;
    }

    h4 {
        color: #555;
        font-size: 12px;
        margin-top: 15px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        font-size: 10px;
        page-break-inside: avoid;
    }

    th {
        background-color: #3498db;
        color: white;
        padding: 8px;
        text-align: left;
        font-weight: bold;
    }

    td {
        padding: 8px;
        border: 1px solid #ddd;
    }

    tr:nth-child(even) {
        background-color: #f9f9f9;
    }

    code {
        background-color: #f4f4f4;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 10px;
    }

    pre {
        background-color: #f4f4f4;
        padding: 10px;
        border-radius: 5px;
        overflow-x: auto;
        page-break-inside: avoid;
    }

    blockquote {
        border-left: 4px solid #3498db;
        padding-left: 15px;
        margin-left: 0;
        color: #555;
        font-style: italic;
    }

    ul, ol {
        margin: 10px 0;
        padding-left: 25px;
    }

    li {
        margin: 5px 0;
    }

    .status-implemented {
        color: #27ae60;
        font-weight: bold;
    }

    .status-missing {
        color: #e74c3c;
        font-weight: bold;
    }

    .status-adaptable {
        color: #f39c12;
        font-weight: bold;
    }

    hr {
        border: none;
        border-top: 1px solid #ddd;
        margin: 20px 0;
    }
    """

    # Wrap HTML content with proper structure
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Palliative Care HMIS Gap Analysis Report</title>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """

    # Generate PDF
    output_file = "PALLIATIVE_CARE_GAP_ANALYSIS_REPORT.pdf"
    HTML(string=full_html).write_pdf(
        output_file,
        stylesheets=[CSS(string=css)]
    )

    print(f"✅ PDF report generated successfully: {output_file}")
    return output_file

if __name__ == "__main__":
    generate_pdf_report()
