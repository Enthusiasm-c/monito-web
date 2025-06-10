#!/usr/bin/env python3
"""
Enhanced PDF Processor
Dual extraction approach: Camelot (lattice + stream) + pdfplumber
"""

import sys
import json
import requests
import tempfile
import os
from typing import Dict, List, Any, Optional, Tuple
import traceback

try:
    import camelot
    import pdfplumber
    import pandas as pd
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Missing dependencies: {e}", file=sys.stderr)
    DEPENDENCIES_AVAILABLE = False

class EnhancedPdfProcessor:
    def __init__(self):
        self.debug_mode = '--debug' in sys.argv
        self.enhanced_mode = '--enhanced' in sys.argv
        
    def log(self, message: str, level: str = 'INFO'):
        """Enhanced logging with levels"""
        prefix = f"[{level}]"
        print(f"{prefix} {message}", file=sys.stderr if level == 'ERROR' else sys.stdout)

    def process_pdf(self, pdf_url: str) -> Dict[str, Any]:
        """Main processing method with multiple extraction approaches"""
        
        if not DEPENDENCIES_AVAILABLE:
            return {
                "supplier": None,
                "products": [],
                "errors": ["Required Python dependencies not available"],
                "metrics": {
                    "totalRowsDetected": 0,
                    "totalRowsProcessed": 0,
                    "tokensUsed": 0,
                    "costUsd": 0.0
                },
                "extractionMethods": {"bestMethod": "none"}
            }

        try:
            # Download PDF to temp file
            self.log(f"📥 Downloading PDF from: {pdf_url}")
            temp_path = self.download_pdf(pdf_url)
            
            if not temp_path:
                raise Exception("Failed to download PDF")

            # Try multiple extraction methods
            results = {}
            
            # Method 1: Camelot Lattice (for tables with borders)
            self.log("🔧 Trying Camelot Lattice extraction...")
            results['camelot_lattice'] = self.extract_with_camelot(temp_path, flavor='lattice')
            
            # Method 2: Camelot Stream (for tables without borders)
            self.log("🔧 Trying Camelot Stream extraction...")
            results['camelot_stream'] = self.extract_with_camelot(temp_path, flavor='stream')
            
            # Method 3: pdfplumber (for text-based extraction)
            self.log("🔧 Trying pdfplumber extraction...")
            results['pdfplumber'] = self.extract_with_pdfplumber(temp_path)
            
            # Choose best result
            best_result = self.choose_best_result(results)
            
            # Extract supplier info
            supplier_info = self.extract_supplier_info(temp_path)
            
            # Clean up
            os.unlink(temp_path)
            
            # Format final result
            final_result = {
                "supplier": supplier_info,
                "products": best_result['products'],
                "errors": [],
                "metrics": {
                    "totalRowsDetected": best_result['total_rows'],
                    "totalRowsProcessed": len(best_result['products']),
                    "tokensUsed": 0,  # TODO: Implement token tracking
                    "costUsd": 0.0
                },
                "extractionMethods": {
                    "camelotLattice": {
                        "tables": results['camelot_lattice']['tables_count'],
                        "rows": results['camelot_lattice']['total_rows']
                    } if results['camelot_lattice'] else None,
                    "camelotStream": {
                        "tables": results['camelot_stream']['tables_count'],
                        "rows": results['camelot_stream']['total_rows']
                    } if results['camelot_stream'] else None,
                    "pdfPlumber": {
                        "pages": results['pdfplumber']['pages_count'],
                        "rows": results['pdfplumber']['total_rows']
                    } if results['pdfplumber'] else None,
                    "bestMethod": best_result['method']
                }
            }
            
            return final_result
            
        except Exception as e:
            self.log(f"❌ Processing failed: {str(e)}", 'ERROR')
            if self.debug_mode:
                traceback.print_exc()
            
            return {
                "supplier": None,
                "products": [],
                "errors": [str(e)],
                "metrics": {
                    "totalRowsDetected": 0,
                    "totalRowsProcessed": 0,
                    "tokensUsed": 0,
                    "costUsd": 0.0
                },
                "extractionMethods": {"bestMethod": "error"}
            }

    def download_pdf(self, url: str) -> Optional[str]:
        """Download PDF to temporary file"""
        try:
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Create temp file
            temp_fd, temp_path = tempfile.mkstemp(suffix='.pdf')
            
            with os.fdopen(temp_fd, 'wb') as temp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
            
            self.log(f"✅ PDF downloaded to: {temp_path}")
            return temp_path
            
        except Exception as e:
            self.log(f"❌ Download failed: {e}", 'ERROR')
            return None

    def extract_with_camelot(self, pdf_path: str, flavor: str) -> Optional[Dict[str, Any]]:
        """Extract tables using Camelot with specified flavor"""
        try:
            self.log(f"🔍 Camelot {flavor} extraction starting...")
            
            # Read tables with Camelot
            tables = camelot.read_pdf(pdf_path, flavor=flavor, pages='all')
            
            if not tables:
                self.log(f"⚠️ No tables found with Camelot {flavor}")
                return None
                
            self.log(f"📊 Found {len(tables)} tables with Camelot {flavor}")
            
            all_products = []
            total_rows = 0
            
            for i, table in enumerate(tables):
                self.log(f"📄 Processing table {i+1}/{len(tables)}")
                
                # Convert to pandas DataFrame
                df = table.df
                total_rows += len(df)
                
                # Process table data
                products = self.process_table_dataframe(df, f"camelot_{flavor}_table_{i+1}")
                all_products.extend(products)
                
                self.log(f"✅ Table {i+1}: {len(products)} products from {len(df)} rows")
            
            result = {
                'method': f'camelot_{flavor}',
                'tables_count': len(tables),
                'total_rows': total_rows,
                'products': all_products
            }
            
            # Apply AI validation if enabled
            if os.getenv('AI_VALIDATION_ENABLED') == 'true' and all_products:
                result = self.apply_ai_validation(result)
            
            return result
            
        except Exception as e:
            self.log(f"❌ Camelot {flavor} extraction failed: {e}", 'ERROR')
            return None

    def extract_with_pdfplumber(self, pdf_path: str) -> Optional[Dict[str, Any]]:
        """Extract text using pdfplumber"""
        try:
            self.log("🔍 pdfplumber extraction starting...")
            
            all_products = []
            total_rows = 0
            pages_processed = 0
            
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    self.log(f"📄 Processing page {page_num + 1}/{len(pdf.pages)}")
                    
                    # Try to extract tables
                    tables = page.extract_tables()
                    
                    if tables:
                        for table_num, table in enumerate(tables):
                            if table and len(table) > 1:  # Skip empty or single-row tables
                                df = pd.DataFrame(table[1:], columns=table[0] if table[0] else None)
                                total_rows += len(df)
                                
                                products = self.process_table_dataframe(df, f"pdfplumber_page_{page_num+1}_table_{table_num+1}")
                                all_products.extend(products)
                    
                    pages_processed += 1
            
            self.log(f"✅ pdfplumber: {len(all_products)} products from {pages_processed} pages")
            
            return {
                'method': 'pdfplumber',
                'pages_count': pages_processed,
                'total_rows': total_rows,
                'products': all_products
            }
            
        except Exception as e:
            self.log(f"❌ pdfplumber extraction failed: {e}", 'ERROR')
            return None

    def process_table_dataframe(self, df: pd.DataFrame, source: str) -> List[Dict[str, Any]]:
        """Process pandas DataFrame to extract products"""
        products = []
        
        if df.empty:
            return products
        
        # Strategy 1: Traditional column-based approach
        name_col = self.find_name_column(df)
        price_col = self.find_price_column(df)
        
        if name_col is not None and price_col is not None:
            self.log(f"✅ Found name column {name_col} and price column {price_col} in {source}")
            products = self.extract_products_traditional(df, name_col, price_col, source)
        
        # Strategy 2: Mixed content extraction (fallback)
        if not products:
            self.log(f"🔄 Trying mixed content extraction for {source}")
            products = self.extract_products_mixed_content(df, source)
        
        return products

    def extract_products_traditional(self, df: pd.DataFrame, name_col: int, price_col: int, source: str) -> List[Dict[str, Any]]:
        """Traditional extraction with separate name and price columns"""
        products = []
        
        # Extract products from rows
        for idx, row in df.iterrows():
            try:
                name = str(row.iloc[name_col]).strip() if name_col < len(row) else ""
                price_str = str(row.iloc[price_col]).strip() if price_col < len(row) else ""
                
                # Enhanced product name validation
                if not self.is_valid_product_name(name):
                    continue
                    
                price = self.parse_price(price_str)
                if price <= 0:
                    continue
                
                # Try to find unit
                unit = "pcs"  # default
                for col_idx, cell in enumerate(row):
                    cell_str = str(cell).lower()
                    if any(u in cell_str for u in ['kg', 'gr', 'ltr', 'pcs', 'box']):
                        unit = cell_str
                        break
                
                product = {
                    "name": name,
                    "price": float(price),
                    "unit": unit,
                    "sourceMethod": source,
                    "category": None,
                    "description": None
                }
                
                products.append(product)
                
            except Exception as e:
                self.log(f"⚠️ Error processing row in {source}: {e}")
                continue
        
        return products

    def extract_products_mixed_content(self, df: pd.DataFrame, source: str) -> List[Dict[str, Any]]:
        """Extract products from mixed content where names and prices are in same cells"""
        products = []
        
        # Product keywords to identify product names
        product_keywords = [
            'YOGURT', 'CREAM', 'CHEESE', 'MILK', 'KEFIR', 'MASCARPONE', 
            'RICOTTA', 'CAKE', 'CARDAMOM', 'COCONUT', 'MANGO', 'VANILLA',
            'STRAWBERRY', 'BLUEBERRY', 'RASPBERRY', 'PLAIN', 'GREEK', 'FRENCH'
        ]
        
        # Collect all text from all cells
        all_texts = []
        for col_idx in range(df.shape[1]):
            for row_idx in range(df.shape[0]):
                cell = df.iloc[row_idx, col_idx]
                if pd.notna(cell) and str(cell).strip():
                    all_texts.append(str(cell).strip())
        
        self.log(f"📝 Analyzing {len(all_texts)} text cells for mixed content")
        
        # Strategy 1: Find lines with both product keywords and prices
        for text in all_texts:
            if self.contains_product_keyword(text, product_keywords) and 'IDR' in text.upper():
                product = self.extract_product_from_mixed_text(text, source)
                if product:
                    products.append(product)
        
        # Strategy 2: Find adjacent product-price pairs
        for i, text in enumerate(all_texts):
            if self.contains_product_keyword(text, product_keywords) and 'IDR' not in text.upper():
                # Look for price in next few items
                for j in range(i+1, min(i+4, len(all_texts))):
                    next_text = all_texts[j]
                    if 'IDR' in next_text.upper():
                        price = self.parse_price(next_text)
                        if price > 0:
                            product = self.create_product_from_pair(text, next_text, price, source)
                            if product:
                                products.append(product)
                            break
        
        # Remove duplicates
        unique_products = []
        seen_names = set()
        
        for product in products:
            name_key = product['name'].upper().strip()
            if name_key not in seen_names and len(name_key) > 2:
                seen_names.add(name_key)
                unique_products.append(product)
        
        self.log(f"🛍️ Mixed content extraction found {len(unique_products)} unique products")
        return unique_products
    
    def contains_product_keyword(self, text: str, keywords: List[str]) -> bool:
        """Check if text contains product keywords"""
        text_upper = text.upper()
        return any(keyword in text_upper for keyword in keywords)
    
    def extract_product_from_mixed_text(self, text: str, source: str) -> Optional[Dict[str, Any]]:
        """Extract product from text containing both name and price"""
        import re
        
        # Extract price
        price = self.parse_price(text)
        if price <= 0:
            return None
        
        # Extract product name (remove price parts)
        name = text
        # Remove IDR prices
        name = re.sub(r'\d+(?:,\d{3})*\s*IDR\s*\d+(?:,\d{3})*', '', name, flags=re.IGNORECASE)
        name = re.sub(r'IDR\s*\d+(?:,\d{3})*', '', name, flags=re.IGNORECASE)
        # Remove unit measurements
        name = re.sub(r'\d+(?:ML|L|KG|GR|G|PCS)', '', name, flags=re.IGNORECASE)
        # Clean up whitespace
        name = re.sub(r'\s+', ' ', name).strip()
        
        if len(name) < 3:
            return None
        
        # Extract unit
        unit = self.extract_unit_from_text(text)
        category = self.determine_category(name)
        
        return {
            "name": name,
            "price": float(price),
            "unit": unit,
            "sourceMethod": source,
            "category": category,
            "description": None
        }
    
    def create_product_from_pair(self, name_text: str, price_text: str, price: float, source: str) -> Optional[Dict[str, Any]]:
        """Create product from separate name and price texts"""
        name = name_text.strip()
        if len(name) < 3:
            return None
        
        unit = self.extract_unit_from_text(price_text) or self.extract_unit_from_text(name_text) or "pcs"
        category = self.determine_category(name)
        
        return {
            "name": name,
            "price": float(price),
            "unit": unit,
            "sourceMethod": source,
            "category": category,
            "description": None
        }
    
    def extract_unit_from_text(self, text: str) -> str:
        """Extract unit from text"""
        import re
        
        # Look for common units
        unit_patterns = [
            (r'\d+\s*(ML|L)\b', 'ml'),
            (r'\d+\s*(KG|KILO)\b', 'kg'),
            (r'\d+\s*(GR|G|GRAM)\b', 'gr'),
            (r'\d+\s*(PCS|PC|PIECE)\b', 'pcs'),
        ]
        
        text_upper = text.upper()
        for pattern, unit in unit_patterns:
            if re.search(pattern, text_upper):
                return unit
        
        return "pcs"  # default
    
    def is_valid_product_name(self, name: str) -> bool:
        """Validate if a string is a proper product name"""
        if not name or len(name) < 2:
            return False
        
        name = name.strip()
        
        # Reject pure numbers (row numbers)
        if name.isdigit():
            return False
        
        # Reject very short strings with numbers (like "10", "1A")
        if len(name) <= 3 and any(c.isdigit() for c in name):
            return False
        
        # Reject pure unit descriptions without product names
        unit_only_patterns = [
            r'^\d+\s*(x\s*)?\d*\s*(kg|gr|g|ltr|l|ml|pcs|pc|pack|box|bottle)s?$',
            r'^\d+\s*kg$', r'^\d+\s*gr$', r'^\d+\s*ltr$', r'^\d+\s*ml$'
        ]
        
        import re
        for pattern in unit_only_patterns:
            if re.match(pattern, name.lower()):
                return False
        
        # Reject pure measurements
        if re.match(r'^\d+[.,]?\d*\s*(x\s*\d+[.,]?\d*\s*)?[a-z]+$', name.lower()):
            return False
        
        # Must contain at least some alphabetic characters
        if not any(c.isalpha() for c in name):
            return False
        
        # Good product names usually have meaningful length
        if len(name) >= 3:
            return True
        
        return False

    def determine_category(self, name: str) -> str:
        """Determine product category from name"""
        name_upper = name.upper()
        
        if any(word in name_upper for word in ['YOGURT', 'KEFIR']):
            return 'dairy'
        elif any(word in name_upper for word in ['CHEESE', 'MASCARPONE', 'RICOTTA']):
            return 'dairy'
        elif any(word in name_upper for word in ['MILK', 'CREAM']):
            return 'dairy'
        elif any(word in name_upper for word in ['CAKE']):
            return 'bakery'
        else:
            return 'other'

    def find_name_column(self, df: pd.DataFrame) -> Optional[int]:
        """Find column most likely to contain product names with improved logic"""
        if df.empty:
            return None
            
        # Check first row for headers
        if len(df) > 0:
            first_row = df.iloc[0]
            for idx, cell in enumerate(first_row):
                cell_str = str(cell).lower()
                if any(word in cell_str for word in ['name', 'nama', 'product', 'item', 'description']):
                    return idx
        
        # Analyze each column for product-like content
        column_scores = []
        
        for col_idx in range(min(df.shape[1], 10)):
            score = 0
            non_empty_count = 0
            
            for cell in df.iloc[:20, col_idx]:  # Check first 20 rows
                cell_str = str(cell).strip()
                if not cell_str or cell_str in ['', 'nan', 'None']:
                    continue
                    
                non_empty_count += 1
                
                # Strong penalty for just numbers (likely row numbers or prices)
                if cell_str.replace('.', '').replace(',', '').isdigit():
                    score -= 5  # Increased penalty
                    continue
                
                # Strong penalty for very short numeric strings
                if len(cell_str) <= 3 and any(c.isdigit() for c in cell_str):
                    score -= 3
                    continue
                
                # Skip if it looks like a price (contains currency or price patterns)
                if any(pattern in cell_str.lower() for pattern in ['rp', 'idr', 'usd', '$']):
                    score -= 2
                    continue
                
                # Positive indicators for product names
                if len(cell_str) > 5:  # Reasonable length for product names
                    score += 1
                    
                if any(c.isalpha() for c in cell_str):  # Contains letters
                    score += 1
                    
                # Check for food/product-related words
                food_keywords = ['milk', 'cheese', 'yogurt', 'cream', 'flour', 'sugar', 'honey', 'oil', 'nuts', 'seeds', 'organic', 'natural']
                if any(keyword in cell_str.lower() for keyword in food_keywords):
                    score += 3
                
                # Bonus for mixed alphanumeric (product codes + names)
                if any(c.isalpha() for c in cell_str) and any(c.isdigit() for c in cell_str):
                    score += 1
            
            # Normalize score by non-empty entries
            if non_empty_count > 0:
                normalized_score = score / non_empty_count
                column_scores.append((col_idx, normalized_score, non_empty_count))
            else:
                column_scores.append((col_idx, -10, 0))  # Penalize empty columns
        
        if column_scores:
            # Sort by score, then by content count
            best_column = max(column_scores, key=lambda x: (x[1], x[2]))
            if best_column[1] > 0:  # Only return if score is positive
                return best_column[0]
        
        # Fallback: find column with longest meaningful text
        text_lengths = []
        for col_idx in range(min(df.shape[1], 10)):
            meaningful_lengths = []
            for cell in df.iloc[:20, col_idx]:
                cell_str = str(cell).strip()
                # Only count if it has letters and reasonable length
                if any(c.isalpha() for c in cell_str) and len(cell_str) > 3:
                    meaningful_lengths.append(len(cell_str))
            
            avg_length = sum(meaningful_lengths) / len(meaningful_lengths) if meaningful_lengths else 0
            text_lengths.append((col_idx, avg_length))
        
        if text_lengths:
            best = max(text_lengths, key=lambda x: x[1])
            if best[1] > 5:  # Only if average length is meaningful
                return best[0]
        
        return 1 if df.shape[1] > 1 else 0  # Default to second column (first might be row numbers)

    def find_price_column(self, df: pd.DataFrame) -> Optional[int]:
        """Find column most likely to contain prices with improved logic"""
        if df.empty:
            return None
        
        # Check first row for headers
        if len(df) > 0:
            first_row = df.iloc[0]
            for idx, cell in enumerate(first_row):
                cell_str = str(cell).lower()
                if any(word in cell_str for word in ['price', 'harga', 'cost', 'total', 'amount']):
                    return idx
        
        # Analyze each column for price-like content
        column_scores = []
        
        for col_idx in range(min(df.shape[1], 10)):
            score = 0
            valid_prices = 0
            non_empty_count = 0
            
            for cell in df.iloc[:20, col_idx]:  # Check first 20 rows
                cell_str = str(cell).strip()
                if not cell_str or cell_str in ['', 'nan', 'None']:
                    continue
                    
                non_empty_count += 1
                
                # Test if this cell contains a valid price
                parsed_price = self.parse_price(cell_str)
                if parsed_price > 0:
                    valid_prices += 1
                    score += 3  # Strong indicator
                    
                    # Bonus for typical price ranges (IDR)
                    if 1000 <= parsed_price <= 1000000:
                        score += 2
                
                # Look for currency indicators
                if any(currency in cell_str.upper() for currency in ['IDR', 'RP', 'USD', '$']):
                    score += 2
                
                # Look for number patterns with commas (price formatting)
                if ',' in cell_str and any(c.isdigit() for c in cell_str):
                    score += 1
                
                # Penalize if it looks like a product name
                if len(cell_str) > 30 and any(keyword in cell_str.lower() for keyword in ['milk', 'cheese', 'yogurt', 'cream']):
                    score -= 3
                
                # Penalize if it's just sequential numbers (likely row numbers)
                if cell_str.isdigit() and len(cell_str) <= 3:
                    score -= 1
            
            # Calculate price ratio
            price_ratio = valid_prices / non_empty_count if non_empty_count > 0 else 0
            
            # Bonus for high price ratio
            if price_ratio > 0.7:
                score += 5
            elif price_ratio > 0.5:
                score += 3
            elif price_ratio > 0.3:
                score += 1
            
            # Normalize score by content count
            if non_empty_count > 0:
                normalized_score = score / non_empty_count
                column_scores.append((col_idx, normalized_score, valid_prices, price_ratio))
            else:
                column_scores.append((col_idx, -10, 0, 0))  # Penalize empty columns
        
        if column_scores:
            # Sort by score, then by valid prices count, then by price ratio
            best_column = max(column_scores, key=lambda x: (x[1], x[2], x[3]))
            if best_column[1] > 0 and best_column[2] > 0:  # Must have positive score and valid prices
                return best_column[0]
        
        # Fallback: look for rightmost column with numbers (prices often at end)
        for col_idx in range(min(df.shape[1], 10) - 1, -1, -1):
            numeric_count = 0
            for cell in df.iloc[:10, col_idx]:
                if self.parse_price(str(cell)) > 0:
                    numeric_count += 1
            if numeric_count >= 3:  # At least 3 valid prices
                return col_idx
        
        return None

    def parse_price(self, price_str: str) -> float:
        """Parse price from string with improved patterns"""
        if not price_str:
            return 0.0
        
        import re
        
        # Try to find IDR price patterns first
        # Pattern 1: "1000ML IDR 104,000" or "IDR 104,000"
        idr_match = re.search(r'IDR\s*(\d+(?:,\d{3})*)', price_str, re.IGNORECASE)
        if idr_match:
            price_text = idr_match.group(1).replace(',', '')
            try:
                return float(price_text)
            except:
                pass
        
        # Pattern 2: Numbers with IDR after "1000ML IDR 104,000"
        before_idr_match = re.search(r'(\d+(?:,\d{3})*)\s*IDR', price_str, re.IGNORECASE)
        if before_idr_match:
            price_text = before_idr_match.group(1).replace(',', '')
            try:
                return float(price_text)
            except:
                pass
        
        # Fallback: extract any large number (likely price)
        numbers = re.findall(r'\d+(?:,\d{3})*', price_str)
        for num_str in numbers:
            try:
                num = float(num_str.replace(',', ''))
                if num >= 1000:  # Reasonable price threshold for IDR
                    return num
            except:
                continue
        
        # Legacy method as final fallback
        cleaned = price_str.replace('Rp', '').replace('$', '').replace(',', '').strip()
        
        # Remove non-numeric characters except decimals
        cleaned = re.sub(r'[^\d.]', '', cleaned)
        
        try:
            return float(cleaned) if cleaned else 0.0
        except:
            return 0.0

    def extract_supplier_info(self, pdf_path: str) -> Optional[Dict[str, str]]:
        """Extract supplier information from PDF with improved logic"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if pdf.pages:
                    text = pdf.pages[0].extract_text()
                    if text:
                        lines = text.split('\n')
                        
                        # Skip "To:" lines and look for actual supplier name
                        for line in lines[:20]:  # Check first 20 lines
                            line = line.strip()
                            
                            # Skip empty lines
                            if not line:
                                continue
                            
                            # Skip "To:" recipient lines
                            if line.lower().startswith('to :') or line.lower().startswith('to:'):
                                continue
                            
                            # Skip common header words
                            skip_words = ['quotation', 'proposal', 'price', 'request', 'regards', 'inquiry', 'delighted', 'offer']
                            if any(word in line.lower() for word in skip_words):
                                continue
                            
                            # Look for company-like names (proper nouns, reasonable length)
                            if (len(line) >= 5 and len(line) <= 50 and 
                                any(c.isupper() for c in line) and
                                not line.isdigit() and
                                line.count(' ') <= 5):  # Not too many spaces
                                
                                # Additional validation for supplier names
                                if self.is_valid_supplier_name(line):
                                    return {"name": line}
                        
                        # Fallback: look for text in all caps (often company names)
                        for line in lines[:20]:
                            line = line.strip()
                            if (len(line) >= 5 and line.isupper() and 
                                not line.startswith('TO') and
                                'PRICE' not in line and 'QUOTATION' not in line):
                                return {"name": line}
        except:
            pass
        
        return None
    
    def is_valid_supplier_name(self, name: str) -> bool:
        """Validate if text looks like a supplier name"""
        name = name.strip()
        
        # Must have reasonable length
        if len(name) < 3 or len(name) > 100:
            return False
        
        # Should contain letters
        if not any(c.isalpha() for c in name):
            return False
        
        # Skip date-like patterns
        import re
        if re.match(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', name):
            return False
        
        # Skip date patterns like "Denpasar, 9 June 2025"
        if re.search(r'\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}', name.lower()):
            return False
        
        # Skip location + date patterns
        if ',' in name and any(month in name.lower() for month in ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']):
            return False
        
        # Skip email-like patterns
        if '@' in name and '.' in name:
            return False
        
        # Skip phone-like patterns
        if re.match(r'^[+]?[\d\s\-\(\)]{10,}$', name):
            return False
        
        return True
    
    def apply_ai_validation(self, extraction_result: Dict[str, Any]) -> Dict[str, Any]:
        """Apply AI validation to extracted products using GPT-4.1-mini"""
        products = extraction_result.get('products', [])
        
        if not products:
            return extraction_result
        
        try:
            self.log(f"🤖 Applying AI validation to {len(products)} products...")
            
            # Get API key
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                self.log("⚠️ No OpenAI API key found, skipping AI validation")
                return extraction_result
            
            # Import subprocess for calling AI validator
            import subprocess
            import tempfile
            
            # Save products to temp file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                json.dump(products, temp_file, indent=2)
                temp_file_path = temp_file.name
            
            try:
                # Call AI validator
                validator_path = os.path.join(os.path.dirname(__file__), 'ai_product_validator.py')
                result = subprocess.run([
                    'python3', validator_path, temp_file_path, api_key, 'Unknown Supplier'
                ], capture_output=True, text=True, timeout=120)
                
                if result.returncode == 0:
                    # Parse validation results
                    output = result.stdout
                    start_marker = '=== AI_VALIDATION_JSON_START ==='
                    end_marker = '=== AI_VALIDATION_JSON_END ==='
                    
                    start_idx = output.find(start_marker) + len(start_marker)
                    end_idx = output.find(end_marker)
                    
                    if start_idx > len(start_marker) - 1 and end_idx > start_idx:
                        validation_data = json.loads(output[start_idx:end_idx].strip())
                        validated_products = validation_data.get('validated_products', products)
                        validation_stats = validation_data.get('validation_stats', {})
                        
                        self.log(f"✅ AI validation: {validation_stats.get('valid_products', 0)}/{validation_stats.get('total_input', 0)} products valid")
                        self.log(f"🧹 Cleaned: {validation_stats.get('cleaned_products', 0)} products")
                        self.log(f"💰 Validation cost: ${validation_stats.get('cost_usd', 0):.4f}")
                        
                        # Update extraction result
                        extraction_result['products'] = validated_products
                        extraction_result['ai_validation'] = validation_stats
                        
                        return extraction_result
                else:
                    self.log(f"❌ AI validation failed: {result.stderr}")
                    
            finally:
                # Clean up temp file
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
        except Exception as e:
            self.log(f"❌ AI validation error: {e}")
        
        # Return original result if validation fails
        return extraction_result

    def choose_best_result(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Choose the best extraction result based on product count and quality"""
        
        best = None
        best_score = 0
        
        for method, result in results.items():
            if not result:
                continue
                
            # Score based on number of products and total rows processed
            score = len(result['products']) * 2 + result['total_rows'] * 0.1
            
            self.log(f"📊 {method}: {len(result['products'])} products, {result['total_rows']} rows, score: {score:.1f}")
            
            if score > best_score:
                best_score = score
                best = result
        
        if best:
            self.log(f"🏆 Best method: {best['method']} with score {best_score:.1f}")
            return best
        else:
            self.log("⚠️ No successful extraction methods")
            return {
                'method': 'none',
                'total_rows': 0,
                'products': []
            }

def main():
    if len(sys.argv) < 2:
        print("Usage: python enhanced_pdf_processor.py <pdf_url> [--enhanced] [--debug]", file=sys.stderr)
        sys.exit(1)
    
    pdf_url = sys.argv[1]
    processor = EnhancedPdfProcessor()
    
    try:
        result = processor.process_pdf(pdf_url)
        
        if '--enhanced' in sys.argv:
            # Enhanced output format with markers
            print("=== ENHANCED_JSON_START ===")
            print(json.dumps(result, indent=2))
            print("=== ENHANCED_JSON_END ===")
        else:
            # Legacy output format
            print(json.dumps(result))
            
    except Exception as e:
        error_result = {
            "supplier": None,
            "products": [],
            "errors": [str(e)],
            "metrics": {"totalRowsDetected": 0, "totalRowsProcessed": 0},
            "extractionMethods": {"bestMethod": "error"}
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()