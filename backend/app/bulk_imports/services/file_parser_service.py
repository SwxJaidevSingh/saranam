"""
File Parser Service
Handles parsing of Excel, CSV, and PDF files for bulk appointment import
"""

import os
import logging
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from io import BytesIO

# Excel parsing
try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

# PDF parsing
try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

# OCR for scanned PDFs
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


logger = logging.getLogger(__name__)


class FileParserService:
    """
    Service for parsing various file formats
    """

    SUPPORTED_EXTENSIONS = {'xlsx', 'xls', 'csv', 'pdf'}

    def __init__(self):
        """Initialize file parser"""
        self.validate_dependencies()

    def validate_dependencies(self):
        """Check if required packages are available"""
        if not OPENPYXL_AVAILABLE:
            logger.warning("openpyxl not available. Excel parsing will be limited.")
        if not PDF_AVAILABLE:
            logger.warning("pdfplumber not available. PDF parsing disabled.")
        if not OCR_AVAILABLE:
            logger.warning("pytesseract not available. OCR disabled.")

    @staticmethod
    def get_file_extension(filename: str) -> str:
        """Extract file extension"""
        return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

    @staticmethod
    def is_supported_file(filename: str) -> bool:
        """Check if file type is supported"""
        ext = FileParserService.get_file_extension(filename)
        return ext in FileParserService.SUPPORTED_EXTENSIONS

    def parse_file(self, file_path: str, file_type: Optional[str] = None) -> Tuple[List[Dict], Dict]:
        """
        Parse file and extract structured data

        Args:
            file_path: Path to file
            file_type: File type (xlsx, csv, pdf) - auto-detected if None

        Returns:
            Tuple of (rows_data, metadata)
        """
        if file_type is None:
            file_type = self.get_file_extension(file_path)

        if file_type in ['xlsx', 'xls']:
            return self.parse_excel(file_path)
        elif file_type == 'csv':
            return self.parse_csv(file_path)
        elif file_type == 'pdf':
            return self.parse_pdf(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def parse_excel(self, file_path: str) -> Tuple[List[Dict], Dict]:
        """
        Parse Excel file (.xlsx, .xls)

        Args:
            file_path: Path to Excel file

        Returns:
            Tuple of (rows, metadata)
        """
        try:
            # Read Excel file
            df = pd.read_excel(file_path, sheet_name=0)  # Read first sheet

            # Get metadata
            wb = openpyxl.load_workbook(file_path, read_only=True)
            sheet_names = wb.sheetnames
            active_sheet = wb.active.title

            metadata = {
                'file_type': 'excel',
                'sheet_names': sheet_names,
                'active_sheet': active_sheet,
                'total_sheets': len(sheet_names),
                'total_rows': len(df),
                'total_columns': len(df.columns),
                'headers': list(df.columns),
                'parser': 'pandas+openpyxl'
            }

            # Convert to list of dicts
            rows = self._dataframe_to_rows(df)

            wb.close()

            logger.info(f"Parsed Excel file: {len(rows)} rows")
            return rows, metadata

        except Exception as e:
            logger.error(f"Error parsing Excel file: {str(e)}")
            raise ValueError(f"Failed to parse Excel file: {str(e)}")

    def parse_csv(self, file_path: str) -> Tuple[List[Dict], Dict]:
        """
        Parse CSV file

        Args:
            file_path: Path to CSV file

        Returns:
            Tuple of (rows, metadata)
        """
        try:
            # Try different encodings
            encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']

            df = None
            used_encoding = None

            for encoding in encodings:
                try:
                    df = pd.read_csv(file_path, encoding=encoding)
                    used_encoding = encoding
                    break
                except UnicodeDecodeError:
                    continue

            if df is None:
                raise ValueError("Could not decode CSV file with any supported encoding")

            metadata = {
                'file_type': 'csv',
                'encoding': used_encoding,
                'total_rows': len(df),
                'total_columns': len(df.columns),
                'headers': list(df.columns),
                'parser': 'pandas'
            }

            rows = self._dataframe_to_rows(df)

            logger.info(f"Parsed CSV file: {len(rows)} rows")
            return rows, metadata

        except Exception as e:
            logger.error(f"Error parsing CSV file: {str(e)}")
            raise ValueError(f"Failed to parse CSV file: {str(e)}")

    def parse_pdf(self, file_path: str) -> Tuple[List[Dict], Dict]:
        """
        Parse PDF file (tables and text)

        Args:
            file_path: Path to PDF file

        Returns:
            Tuple of (rows, metadata)
        """
        if not PDF_AVAILABLE:
            raise ImportError("pdfplumber not installed. Run: pip install pdfplumber")

        try:
            rows = []
            all_text = []

            with pdfplumber.open(file_path) as pdf:
                metadata = {
                    'file_type': 'pdf',
                    'total_pages': len(pdf.pages),
                    'parser': 'pdfplumber'
                }

                # Try to extract tables first
                tables_found = False
                for page_num, page in enumerate(pdf.pages, 1):
                    # Extract tables
                    tables = page.extract_tables()
                    if tables:
                        tables_found = True
                        for table in tables:
                            if not table:
                                continue

                            # First row as headers
                            headers = table[0]
                            # Clean headers
                            headers = [str(h).strip() if h else f'Column_{i}' for i, h in enumerate(headers)]

                            # Data rows
                            for row in table[1:]:
                                if not row or all(cell is None or str(cell).strip() == '' for cell in row):
                                    continue
                                row_dict = {headers[i]: str(cell).strip() if cell else ''
                                           for i, cell in enumerate(row) if i < len(headers)}
                                rows.append(row_dict)

                    # Extract text for non-table content
                    text = page.extract_text()
                    if text:
                        all_text.append(text)

                if tables_found:
                    metadata['extraction_method'] = 'table'
                    metadata['total_rows'] = len(rows)
                    metadata['headers'] = list(rows[0].keys()) if rows else []
                else:
                    # No tables found, return raw text for LLM processing
                    metadata['extraction_method'] = 'text'
                    combined_text = '\n\n'.join(all_text)
                    rows = [{'raw_text': combined_text}]
                    metadata['requires_llm'] = True

                logger.info(f"Parsed PDF file: {len(rows)} rows")
                return rows, metadata

        except Exception as e:
            logger.error(f"Error parsing PDF file: {str(e)}")
            raise ValueError(f"Failed to parse PDF file: {str(e)}")

    def parse_pdf_with_ocr(self, file_path: str) -> Tuple[List[Dict], Dict]:
        """
        Parse scanned PDF using OCR

        Args:
            file_path: Path to PDF file

        Returns:
            Tuple of (rows, metadata)
        """
        if not OCR_AVAILABLE:
            raise ImportError("pytesseract not installed. Run: pip install pytesseract pillow")

        try:
            import pdf2image

            # Convert PDF to images
            images = pdf2image.convert_from_path(file_path)

            all_text = []
            for i, image in enumerate(images):
                # Perform OCR
                text = pytesseract.image_to_string(image)
                all_text.append(text)

            combined_text = '\n\n'.join(all_text)

            metadata = {
                'file_type': 'pdf',
                'total_pages': len(images),
                'extraction_method': 'ocr',
                'requires_llm': True,
                'parser': 'pytesseract'
            }

            rows = [{'raw_text': combined_text}]

            logger.info(f"Parsed PDF with OCR: {len(images)} pages")
            return rows, metadata

        except Exception as e:
            logger.error(f"Error in OCR parsing: {str(e)}")
            raise ValueError(f"Failed to parse PDF with OCR: {str(e)}")

    def _dataframe_to_rows(self, df: pd.DataFrame) -> List[Dict]:
        """
        Convert pandas DataFrame to list of dictionaries

        Args:
            df: Pandas DataFrame

        Returns:
            List of row dictionaries
        """
        # Replace NaN with None
        df = df.where(pd.notnull(df), None)

        # Convert to dict
        rows = df.to_dict('records')

        # Clean up: convert numpy types to Python types
        cleaned_rows = []
        for row in rows:
            cleaned_row = {}
            for key, value in row.items():
                # Convert to string for consistency
                if value is not None and not isinstance(value, str):
                    if pd.isna(value):
                        cleaned_row[key] = None
                    else:
                        cleaned_row[key] = str(value)
                else:
                    cleaned_row[key] = value
            cleaned_rows.append(cleaned_row)

        return cleaned_rows

    def detect_headers(self, rows: List[Dict]) -> Optional[List[str]]:
        """
        Detect column headers from data

        Args:
            rows: List of row dictionaries

        Returns:
            List of detected headers or None
        """
        if not rows:
            return None

        # If rows already have keys, those are headers
        if isinstance(rows[0], dict):
            return list(rows[0].keys())

        return None

    def preview_data(self, file_path: str, max_rows: int = 10) -> Dict:
        """
        Get preview of file data

        Args:
            file_path: Path to file
            max_rows: Maximum rows to preview

        Returns:
            Preview data with sample rows
        """
        rows, metadata = self.parse_file(file_path)

        preview = {
            'metadata': metadata,
            'total_rows': len(rows),
            'sample_rows': rows[:max_rows],
            'headers': metadata.get('headers', [])
        }

        return preview

    @staticmethod
    def validate_file_size(file_path: str, max_size_mb: int = 50) -> bool:
        """
        Validate file size

        Args:
            file_path: Path to file
            max_size_mb: Maximum size in MB

        Returns:
            True if valid, raises ValueError if too large
        """
        size_bytes = os.path.getsize(file_path)
        size_mb = size_bytes / (1024 * 1024)

        if size_mb > max_size_mb:
            raise ValueError(f"File size ({size_mb:.2f} MB) exceeds maximum allowed ({max_size_mb} MB)")

        return True

    @staticmethod
    def get_file_info(file_path: str) -> Dict:
        """
        Get basic file information

        Args:
            file_path: Path to file

        Returns:
            File information dictionary
        """
        stat = os.stat(file_path)

        return {
            'filename': os.path.basename(file_path),
            'size_bytes': stat.st_size,
            'size_mb': round(stat.st_size / (1024 * 1024), 2),
            'extension': FileParserService.get_file_extension(file_path),
            'modified_at': stat.st_mtime
        }
