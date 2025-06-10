#!/usr/bin/env python3
"""
Rule-based Table Extractor Without AI
Implements Task 6: Rule-based table extraction without AI

Features:
- PDF table detection using pdfplumber and camelot
- Multiple extraction strategies (lattice, stream, hybrid)
- Heuristic-based table validation and filtering
- Column type detection and normalization
- Table merging and consolidation
- CSV and Excel table processing
- Performance optimization for large documents
"""

import sys
import os
import json
import time
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import logging
from io import StringIO

# pdfplumber for PDF table extraction
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    print("[WARNING] pdfplumber not available, PDF table extraction limited", file=sys.stderr)
    PDFPLUMBER_AVAILABLE = False

# camelot for advanced PDF table extraction
try:
    import camelot
    CAMELOT_AVAILABLE = True
except ImportError:
    print("[WARNING] camelot not available, advanced PDF extraction disabled", file=sys.stderr)
    CAMELOT_AVAILABLE = False

# pandas for data processing
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    print("[WARNING] pandas not available, limited data processing", file=sys.stderr)
    PANDAS_AVAILABLE = False

# numpy for numerical operations
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    print("[WARNING] numpy not available, reduced numerical processing", file=sys.stderr)
    NUMPY_AVAILABLE = False


class TableExtractor:
    """Rule-based table extractor for documents"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Configuration parameters
        self.min_table_rows = self.config.get('min_table_rows', 3)
        self.min_table_cols = self.config.get('min_table_cols', 2)
        self.min_confidence = self.config.get('min_confidence', 0.7)
        self.extract_all_pages = self.config.get('extract_all_pages', True)
        self.merge_similar_tables = self.config.get('merge_similar_tables', True)
        self.detect_headers = self.config.get('detect_headers', True)
        self.normalize_data = self.config.get('normalize_data', True)
        self.filter_empty_rows = self.config.get('filter_empty_rows', True)
        
        # Table detection strategies
        self.use_lattice = self.config.get('use_lattice', True)
        self.use_stream = self.config.get('use_stream', True)
        self.use_pdfplumber = self.config.get('use_pdfplumber', True)
        
        print(f"[INFO] Table Extractor initialized", file=sys.stderr)
        print(f"[INFO] pdfplumber: {'✓' if PDFPLUMBER_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] camelot: {'✓' if CAMELOT_AVAILABLE else '✗'}", file=sys.stderr)
        print(f"[INFO] pandas: {'✓' if PANDAS_AVAILABLE else '✗'}", file=sys.stderr)
    
    def extract_tables_from_pdf(self, pdf_path: Path) -> Dict[str, Any]:
        """
        Extract tables from PDF using multiple strategies
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Dict containing extracted tables and metadata
        """
        start_time = time.time()
        
        print(f"[INFO] Extracting tables from PDF: {pdf_path}", file=sys.stderr)
        
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        result = {
            "file_path": str(pdf_path),
            "tables": [],
            "metadata": {
                "total_pages": 0,
                "pages_with_tables": 0,
                "total_tables": 0,
                "extraction_methods": [],
                "processing_time_ms": 0,
                "file_size_bytes": pdf_path.stat().st_size,
                "confidence_scores": []
            },
            "success": False,
            "error": None
        }
        
        try:
            # Get PDF info
            if PDFPLUMBER_AVAILABLE:
                with pdfplumber.open(pdf_path) as pdf:
                    result["metadata"]["total_pages"] = len(pdf.pages)
            else:
                # Fallback method to get page count
                result["metadata"]["total_pages"] = self._get_pdf_page_count(pdf_path)
            
            # Extract tables using different strategies
            all_tables = []
            
            # Strategy 1: Camelot lattice (for tables with borders)
            if self.use_lattice and CAMELOT_AVAILABLE:
                lattice_tables = self._extract_with_camelot_lattice(pdf_path)
                all_tables.extend(lattice_tables)
                if lattice_tables:
                    result["metadata"]["extraction_methods"].append("camelot_lattice")
            
            # Strategy 2: Camelot stream (for tables without borders)
            if self.use_stream and CAMELOT_AVAILABLE:
                stream_tables = self._extract_with_camelot_stream(pdf_path)
                all_tables.extend(stream_tables)
                if stream_tables:
                    result["metadata"]["extraction_methods"].append("camelot_stream")
            
            # Strategy 3: pdfplumber (general purpose)
            if self.use_pdfplumber and PDFPLUMBER_AVAILABLE:
                pdfplumber_tables = self._extract_with_pdfplumber(pdf_path)
                all_tables.extend(pdfplumber_tables)
                if pdfplumber_tables:
                    result["metadata"]["extraction_methods"].append("pdfplumber")
            
            # Process and validate tables
            valid_tables = self._process_and_validate_tables(all_tables)
            
            # Merge similar tables if enabled
            if self.merge_similar_tables:
                valid_tables = self._merge_similar_tables(valid_tables)
            
            # Final processing
            final_tables = []
            pages_with_tables = set()
            
            for table in valid_tables:
                processed_table = self._post_process_table(table)
                final_tables.append(processed_table)
                pages_with_tables.add(table.get("page", 1))
            
            result["tables"] = final_tables
            result["metadata"]["total_tables"] = len(final_tables)
            result["metadata"]["pages_with_tables"] = len(pages_with_tables)
            result["metadata"]["confidence_scores"] = [t.get("confidence", 0) for t in final_tables]
            result["success"] = True
            
            print(f"[INFO] Table extraction completed: {len(final_tables)} tables found", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)
            result["success"] = False
            print(f"[ERROR] Table extraction failed: {e}", file=sys.stderr)
        
        finally:
            result["metadata"]["processing_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result
    
    def _extract_with_camelot_lattice(self, pdf_path: Path) -> List[Dict[str, Any]]:
        """Extract tables using camelot lattice method"""
        
        print(f"[INFO] Extracting tables with camelot lattice", file=sys.stderr)
        
        tables = []
        
        try:
            # Extract from all pages or specific pages
            pages = "all" if self.extract_all_pages else "1"
            
            # Use lattice method for tables with borders
            camelot_tables = camelot.read_pdf(
                str(pdf_path),
                pages=pages,
                flavor='lattice',
                edge_tol=50,  # Tolerance for edge detection
                row_tol=2,    # Tolerance for row detection
                column_tol=0  # Tolerance for column detection
            )
            
            for i, table in enumerate(camelot_tables):
                if table.accuracy >= self.min_confidence * 100:  # camelot uses 0-100 scale
                    table_data = {
                        "method": "camelot_lattice",
                        "page": table.page,
                        "confidence": table.accuracy / 100.0,  # Convert to 0-1 scale
                        "data": table.df.values.tolist(),
                        "headers": table.df.columns.tolist() if self.detect_headers else None,
                        "shape": table.df.shape,
                        "parsing_report": {
                            "accuracy": table.accuracy,
                            "whitespace": table.whitespace,
                            "order": table.order,
                            "page": table.page
                        }
                    }
                    tables.append(table_data)
                    print(f"[INFO] Lattice table {i+1}: {table.df.shape} (accuracy: {table.accuracy:.1f}%)", file=sys.stderr)
                else:
                    print(f"[INFO] Skipping low-confidence lattice table: {table.accuracy:.1f}%", file=sys.stderr)
        
        except Exception as e:
            print(f"[WARNING] Camelot lattice extraction failed: {e}", file=sys.stderr)
        
        return tables
    
    def _extract_with_camelot_stream(self, pdf_path: Path) -> List[Dict[str, Any]]:
        """Extract tables using camelot stream method"""
        
        print(f"[INFO] Extracting tables with camelot stream", file=sys.stderr)
        
        tables = []
        
        try:
            # Extract from all pages
            pages = "all" if self.extract_all_pages else "1"
            
            # Use stream method for tables without clear borders
            camelot_tables = camelot.read_pdf(
                str(pdf_path),
                pages=pages,
                flavor='stream',
                edge_tol=500,   # Higher tolerance for stream
                row_tol=3,      # Row tolerance
                column_tol=0    # Column tolerance
            )
            
            for i, table in enumerate(camelot_tables):
                if table.accuracy >= self.min_confidence * 100:
                    table_data = {
                        "method": "camelot_stream",
                        "page": table.page,
                        "confidence": table.accuracy / 100.0,
                        "data": table.df.values.tolist(),
                        "headers": table.df.columns.tolist() if self.detect_headers else None,
                        "shape": table.df.shape,
                        "parsing_report": {
                            "accuracy": table.accuracy,
                            "whitespace": table.whitespace,
                            "order": table.order,
                            "page": table.page
                        }
                    }
                    tables.append(table_data)
                    print(f"[INFO] Stream table {i+1}: {table.df.shape} (accuracy: {table.accuracy:.1f}%)", file=sys.stderr)
                else:
                    print(f"[INFO] Skipping low-confidence stream table: {table.accuracy:.1f}%", file=sys.stderr)
        
        except Exception as e:
            print(f"[WARNING] Camelot stream extraction failed: {e}", file=sys.stderr)
        
        return tables
    
    def _extract_with_pdfplumber(self, pdf_path: Path) -> List[Dict[str, Any]]:
        """Extract tables using pdfplumber"""
        
        print(f"[INFO] Extracting tables with pdfplumber", file=sys.stderr)
        
        tables = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_tables = page.extract_tables()
                    
                    for table_idx, table in enumerate(page_tables):
                        if self._validate_table_structure(table):
                            # Calculate confidence based on data completeness
                            confidence = self._calculate_pdfplumber_confidence(table)
                            
                            if confidence >= self.min_confidence:
                                table_data = {
                                    "method": "pdfplumber",
                                    "page": page_num,
                                    "confidence": confidence,
                                    "data": table,
                                    "headers": table[0] if self.detect_headers and table else None,
                                    "shape": (len(table), len(table[0]) if table else 0),
                                    "parsing_report": {
                                        "page": page_num,
                                        "table_index": table_idx,
                                        "bbox": getattr(page, 'bbox', None)
                                    }
                                }
                                tables.append(table_data)
                                print(f"[INFO] pdfplumber table {table_idx+1} on page {page_num}: "
                                      f"{len(table)}x{len(table[0]) if table else 0} (confidence: {confidence:.1f})", file=sys.stderr)
                            else:
                                print(f"[INFO] Skipping low-confidence pdfplumber table: {confidence:.1f}", file=sys.stderr)
        
        except Exception as e:
            print(f"[WARNING] pdfplumber extraction failed: {e}", file=sys.stderr)
        
        return tables
    
    def _validate_table_structure(self, table: List[List[str]]) -> bool:
        """Validate table structure using heuristics"""
        
        if not table or len(table) < self.min_table_rows:
            return False
        
        # Check if table has consistent column count
        col_counts = [len(row) for row in table if row]
        if not col_counts:
            return False
        
        most_common_cols = max(set(col_counts), key=col_counts.count)
        if most_common_cols < self.min_table_cols:
            return False
        
        # Check if most rows have the expected column count
        consistent_rows = sum(1 for count in col_counts if count == most_common_cols)
        consistency_ratio = consistent_rows / len(col_counts)
        
        return consistency_ratio >= 0.7  # At least 70% of rows should be consistent
    
    def _calculate_pdfplumber_confidence(self, table: List[List[str]]) -> float:
        """Calculate confidence score for pdfplumber table"""
        
        if not table:
            return 0.0
        
        total_cells = 0
        non_empty_cells = 0
        
        for row in table:
            for cell in row:
                total_cells += 1
                if cell and str(cell).strip():
                    non_empty_cells += 1
        
        if total_cells == 0:
            return 0.0
        
        # Base confidence on data completeness
        completeness = non_empty_cells / total_cells
        
        # Bonus for consistent structure
        col_counts = [len(row) for row in table]
        most_common_cols = max(set(col_counts), key=col_counts.count)
        consistency = sum(1 for count in col_counts if count == most_common_cols) / len(col_counts)
        
        # Bonus for having numeric data (likely prices/quantities)
        numeric_cells = 0
        for row in table[1:]:  # Skip header row
            for cell in row:
                if cell and self._is_numeric_value(str(cell)):
                    numeric_cells += 1
        
        numeric_ratio = numeric_cells / max(1, total_cells - len(table[0]) if table else 1)
        
        # Combine factors
        confidence = (completeness * 0.5 + consistency * 0.3 + numeric_ratio * 0.2)
        
        return min(1.0, confidence)
    
    def _is_numeric_value(self, value: str) -> bool:
        """Check if a value appears to be numeric (price, quantity, etc.)"""
        
        # Clean the value
        cleaned = re.sub(r'[,\s$€£¥₹]', '', value.strip())
        
        # Check for decimal numbers
        if re.match(r'^\d+\.?\d*$', cleaned):
            return True
        
        # Check for percentages
        if re.match(r'^\d+\.?\d*%$', cleaned):
            return True
        
        # Check for fractions
        if re.match(r'^\d+/\d+$', cleaned):
            return True
        
        return False
    
    def _process_and_validate_tables(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process and validate extracted tables"""
        
        valid_tables = []
        
        for table in tables:
            try:
                # Apply filters
                if not self._is_valid_table_size(table):
                    continue
                
                if not self._has_sufficient_data(table):
                    continue
                
                # Clean and normalize data
                if self.normalize_data:
                    table = self._normalize_table_data(table)
                
                # Filter empty rows
                if self.filter_empty_rows:
                    table = self._filter_empty_rows(table)
                
                # Detect data types
                table["column_types"] = self._detect_column_types(table)
                
                # Add quality metrics
                table["quality_metrics"] = self._calculate_quality_metrics(table)
                
                valid_tables.append(table)
                
            except Exception as e:
                print(f"[WARNING] Failed to process table: {e}", file=sys.stderr)
        
        return valid_tables
    
    def _is_valid_table_size(self, table: Dict[str, Any]) -> bool:
        """Check if table meets minimum size requirements"""
        
        shape = table.get("shape", (0, 0))
        return shape[0] >= self.min_table_rows and shape[1] >= self.min_table_cols
    
    def _has_sufficient_data(self, table: Dict[str, Any]) -> bool:
        """Check if table has sufficient non-empty data"""
        
        data = table.get("data", [])
        if not data:
            return False
        
        total_cells = sum(len(row) for row in data)
        non_empty_cells = sum(1 for row in data for cell in row if cell and str(cell).strip())
        
        if total_cells == 0:
            return False
        
        completeness = non_empty_cells / total_cells
        return completeness >= 0.3  # At least 30% of cells should have data
    
    def _normalize_table_data(self, table: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize table data"""
        
        data = table.get("data", [])
        normalized_data = []
        
        for row in data:
            normalized_row = []
            for cell in row:
                if cell is None:
                    normalized_row.append("")
                else:
                    # Clean and normalize cell value
                    normalized_value = str(cell).strip()
                    # Remove excessive whitespace
                    normalized_value = re.sub(r'\s+', ' ', normalized_value)
                    normalized_row.append(normalized_value)
            normalized_data.append(normalized_row)
        
        table["data"] = normalized_data
        return table
    
    def _filter_empty_rows(self, table: Dict[str, Any]) -> Dict[str, Any]:
        """Filter out empty rows"""
        
        data = table.get("data", [])
        filtered_data = []
        
        for row in data:
            # Check if row has any non-empty cells
            if any(cell and str(cell).strip() for cell in row):
                filtered_data.append(row)
        
        table["data"] = filtered_data
        table["shape"] = (len(filtered_data), len(filtered_data[0]) if filtered_data else 0)
        
        return table
    
    def _detect_column_types(self, table: Dict[str, Any]) -> List[str]:
        """Detect column data types"""
        
        data = table.get("data", [])
        if not data:
            return []
        
        # Skip header row if detected
        start_row = 1 if table.get("headers") else 0
        num_cols = len(data[0]) if data else 0
        
        column_types = []
        
        for col_idx in range(num_cols):
            col_values = []
            for row_idx in range(start_row, len(data)):
                if col_idx < len(data[row_idx]):
                    value = data[row_idx][col_idx]
                    if value and str(value).strip():
                        col_values.append(str(value).strip())
            
            col_type = self._infer_column_type(col_values)
            column_types.append(col_type)
        
        return column_types
    
    def _infer_column_type(self, values: List[str]) -> str:
        """Infer column type from values"""
        
        if not values:
            return "empty"
        
        # Count different value types
        numeric_count = sum(1 for v in values if self._is_numeric_value(v))
        price_count = sum(1 for v in values if self._looks_like_price(v))
        date_count = sum(1 for v in values if self._looks_like_date(v))
        
        total_values = len(values)
        
        # Determine type based on majority
        if price_count / total_values > 0.6:
            return "price"
        elif numeric_count / total_values > 0.6:
            return "numeric"
        elif date_count / total_values > 0.6:
            return "date"
        else:
            return "text"
    
    def _looks_like_price(self, value: str) -> bool:
        """Check if value looks like a price"""
        
        # Common price patterns
        price_patterns = [
            r'^\$?\d+\.?\d*$',  # $123.45 or 123.45
            r'^\d+[,.]?\d*\s*(USD|EUR|IDR|SGD)$',  # 123.45 USD
            r'^\d+[,.]?\d*\s*$',  # Simple numbers
        ]
        
        for pattern in price_patterns:
            if re.match(pattern, value.strip(), re.IGNORECASE):
                return True
        
        return False
    
    def _looks_like_date(self, value: str) -> bool:
        """Check if value looks like a date"""
        
        date_patterns = [
            r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # MM/DD/YYYY or DD/MM/YYYY
            r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',    # YYYY/MM/DD
            r'\w{3,9}\s+\d{1,2},?\s+\d{4}',    # Month DD, YYYY
        ]
        
        for pattern in date_patterns:
            if re.search(pattern, value.strip()):
                return True
        
        return False
    
    def _calculate_quality_metrics(self, table: Dict[str, Any]) -> Dict[str, float]:
        """Calculate quality metrics for table"""
        
        data = table.get("data", [])
        if not data:
            return {"completeness": 0.0, "consistency": 0.0, "data_richness": 0.0}
        
        # Completeness: ratio of non-empty cells
        total_cells = sum(len(row) for row in data)
        non_empty_cells = sum(1 for row in data for cell in row if cell and str(cell).strip())
        completeness = non_empty_cells / total_cells if total_cells > 0 else 0.0
        
        # Consistency: ratio of rows with expected column count
        col_counts = [len(row) for row in data]
        most_common_cols = max(set(col_counts), key=col_counts.count) if col_counts else 0
        consistent_rows = sum(1 for count in col_counts if count == most_common_cols)
        consistency = consistent_rows / len(col_counts) if col_counts else 0.0
        
        # Data richness: variety of data types
        column_types = table.get("column_types", [])
        unique_types = len(set(column_types)) if column_types else 0
        data_richness = min(1.0, unique_types / 4.0)  # Normalize to 0-1
        
        return {
            "completeness": completeness,
            "consistency": consistency,
            "data_richness": data_richness
        }
    
    def _merge_similar_tables(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge tables that appear to be continuation of each other"""
        
        if len(tables) <= 1:
            return tables
        
        merged_tables = []
        used_indices = set()
        
        for i, table1 in enumerate(tables):
            if i in used_indices:
                continue
            
            merged_table = table1.copy()
            merged_data = list(table1.get("data", []))
            
            # Look for similar tables to merge
            for j, table2 in enumerate(tables[i+1:], i+1):
                if j in used_indices:
                    continue
                
                if self._are_tables_similar(table1, table2):
                    # Merge table2 into table1
                    table2_data = table2.get("data", [])
                    
                    # Skip header if it's similar to table1's header
                    start_idx = 1 if self._have_similar_headers(table1, table2) else 0
                    merged_data.extend(table2_data[start_idx:])
                    
                    used_indices.add(j)
                    print(f"[INFO] Merged table from page {table2.get('page')} into table from page {table1.get('page')}", file=sys.stderr)
            
            # Update merged table
            merged_table["data"] = merged_data
            merged_table["shape"] = (len(merged_data), len(merged_data[0]) if merged_data else 0)
            merged_table["merged_from_pages"] = [table1.get("page")]
            
            # Add pages from merged tables
            for j in used_indices:
                if j > i:
                    merged_table["merged_from_pages"].append(tables[j].get("page"))
            
            merged_tables.append(merged_table)
            used_indices.add(i)
        
        return merged_tables
    
    def _are_tables_similar(self, table1: Dict[str, Any], table2: Dict[str, Any]) -> bool:
        """Check if two tables are similar enough to merge"""
        
        # Check column count similarity
        shape1 = table1.get("shape", (0, 0))
        shape2 = table2.get("shape", (0, 0))
        
        if abs(shape1[1] - shape2[1]) > 1:  # Allow 1 column difference
            return False
        
        # Check column types similarity
        types1 = table1.get("column_types", [])
        types2 = table2.get("column_types", [])
        
        if types1 and types2:
            common_types = sum(1 for t1, t2 in zip(types1, types2) if t1 == t2)
            similarity = common_types / max(len(types1), len(types2))
            if similarity < 0.7:
                return False
        
        return True
    
    def _have_similar_headers(self, table1: Dict[str, Any], table2: Dict[str, Any]) -> bool:
        """Check if two tables have similar headers"""
        
        headers1 = table1.get("headers", [])
        headers2 = table2.get("headers", [])
        
        if not headers1 or not headers2:
            return False
        
        # Simple string similarity check
        common_headers = sum(1 for h1, h2 in zip(headers1, headers2) 
                           if h1 and h2 and str(h1).strip().lower() == str(h2).strip().lower())
        
        similarity = common_headers / max(len(headers1), len(headers2))
        return similarity > 0.8
    
    def _post_process_table(self, table: Dict[str, Any]) -> Dict[str, Any]:
        """Final post-processing of table"""
        
        # Add unique identifier
        table["table_id"] = f"{table.get('method', 'unknown')}_{table.get('page', 1)}_{id(table) % 10000}"
        
        # Calculate final confidence
        base_confidence = table.get("confidence", 0.5)
        quality_metrics = table.get("quality_metrics", {})
        
        # Adjust confidence based on quality
        quality_bonus = (
            quality_metrics.get("completeness", 0) * 0.3 +
            quality_metrics.get("consistency", 0) * 0.4 +
            quality_metrics.get("data_richness", 0) * 0.3
        )
        
        final_confidence = min(1.0, base_confidence + quality_bonus * 0.2)
        table["final_confidence"] = final_confidence
        
        return table
    
    def _get_pdf_page_count(self, pdf_path: Path) -> int:
        """Fallback method to get PDF page count"""
        
        try:
            # Try using PyPDF2 as fallback
            import PyPDF2
            with open(pdf_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                return len(reader.pages)
        except ImportError:
            pass
        
        # If no PDF library available, return 1
        return 1
    
    def extract_tables_from_excel(self, excel_path: Path) -> Dict[str, Any]:
        """Extract tables from Excel files (wrapper for consistency)"""
        
        print(f"[INFO] Processing Excel file as tables: {excel_path}", file=sys.stderr)
        
        # Use the Excel reader for this
        try:
            from .excel_reader import ExcelReader
            
            excel_reader = ExcelReader()
            excel_result = excel_reader.read_excel_file(excel_path)
            
            # Convert Excel sheets to table format
            tables = []
            for sheet_name, sheet_data in excel_result.get("sheets", {}).items():
                table = {
                    "method": "excel_sheet",
                    "page": sheet_name,
                    "confidence": 1.0,  # Excel data is always high confidence
                    "data": sheet_data.get("raw_data", []),
                    "headers": sheet_data.get("headers", []),
                    "shape": (sheet_data.get("row_count", 0), sheet_data.get("col_count", 0)),
                    "table_id": f"excel_{sheet_name}",
                    "column_types": ["text"] * sheet_data.get("col_count", 0),  # Default to text
                    "quality_metrics": {
                        "completeness": 1.0,
                        "consistency": 1.0,
                        "data_richness": 0.8
                    }
                }
                tables.append(table)
            
            return {
                "file_path": str(excel_path),
                "tables": tables,
                "metadata": {
                    "total_pages": excel_result.get("metadata", {}).get("total_sheets", 0),
                    "pages_with_tables": len(tables),
                    "total_tables": len(tables),
                    "extraction_methods": ["excel_sheet"],
                    "processing_time_ms": excel_result.get("metadata", {}).get("processing_time_ms", 0),
                    "file_size_bytes": excel_path.stat().st_size
                },
                "success": excel_result.get("success", False),
                "error": excel_result.get("error")
            }
            
        except ImportError:
            return {
                "file_path": str(excel_path),
                "tables": [],
                "metadata": {"total_tables": 0},
                "success": False,
                "error": "Excel reader not available"
            }


def main():
    """CLI interface for table extraction"""
    
    if len(sys.argv) < 2:
        print("Usage: python table_extractor.py <file_path> [output_json]", file=sys.stderr)
        sys.exit(1)
    
    file_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    
    # Configuration can be passed via environment variables
    config = {
        "min_table_rows": int(os.getenv("MIN_TABLE_ROWS", "3")),
        "min_table_cols": int(os.getenv("MIN_TABLE_COLS", "2")),
        "min_confidence": float(os.getenv("MIN_CONFIDENCE", "0.7")),
        "extract_all_pages": os.getenv("EXTRACT_ALL_PAGES", "true").lower() == "true",
        "merge_similar_tables": os.getenv("MERGE_SIMILAR_TABLES", "true").lower() == "true",
        "detect_headers": os.getenv("DETECT_HEADERS", "true").lower() == "true"
    }
    
    try:
        extractor = TableExtractor(config)
        
        # Determine file type and extract accordingly
        if file_path.suffix.lower() == '.pdf':
            result = extractor.extract_tables_from_pdf(file_path)
        elif file_path.suffix.lower() in ['.xlsx', '.xls']:
            result = extractor.extract_tables_from_excel(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")
        
        # Output result
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"[INFO] Results saved to {output_path}", file=sys.stderr)
        else:
            print(f"TABLE_EXTRACTION_RESULT:{json.dumps(result)}")
        
        # Summary to stderr
        metadata = result["metadata"]
        print(f"[SUMMARY] Tables: {metadata['total_tables']}, "
              f"Pages: {metadata.get('pages_with_tables', 0)}/{metadata.get('total_pages', 0)}, "
              f"Methods: {', '.join(metadata.get('extraction_methods', []))}, "
              f"Time: {metadata.get('processing_time_ms', 0)}ms", file=sys.stderr)
        
    except Exception as e:
        print(f"[ERROR] Table extraction failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()