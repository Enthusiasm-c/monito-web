#!/usr/bin/env python3
"""Simple wrapper for valenta_pdf_extractor to match expected interface"""

from valenta_pdf_extractor import ValentaStyleExtractor

def extract_valenta_products(pdf_path: str):
    """Extract products from VALENTA PDF"""
    extractor = ValentaStyleExtractor()
    return extractor.extract_from_pdf(pdf_path)