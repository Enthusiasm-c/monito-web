"""Text formatting utilities"""

from typing import List, Dict, Any
import re


def format_price(amount: float, currency: str = "IDR") -> str:
    """Format price with currency"""
    if currency == "IDR":
        # Format Indonesian Rupiah
        return f"{amount:,.0f} {currency}".replace(",", ".")
    else:
        return f"{amount:,.2f} {currency}"


def format_short_price(amount: float) -> str:
    """Format price in short form for tables"""
    if amount >= 1000000:
        return f"{amount / 1000000:.1f}M"
    elif amount >= 1000:
        return f"{amount / 1000:.0f}K"
    return f"{amount:.0f}"


def truncate_product_name(name: str, max_length: int = 25) -> str:
    """Truncate long product names for display"""
    if len(name) <= max_length:
        return name
    return name[:max_length - 3] + "..."


def needs_translation(original_name: str, standardized_name: str) -> bool:
    """Detect if text is Indonesian and needs translation"""
    if not standardized_name or original_name.lower() == standardized_name.lower():
        return False
    
    # Check for common Indonesian words/patterns
    indonesian_patterns = [
        r'\b(merah|hijau|putih|kuning|biru)\b',  # colors
        r'\b(besar|kecil|sedang)\b',  # sizes
        r'\b(segar|organik|lokal)\b',  # descriptors
        r'\b(buah|sayur|daging|ikan)\b',  # categories
    ]
    
    return any(re.search(pattern, original_name, re.IGNORECASE) for pattern in indonesian_patterns)


def format_product_name_with_translation(original_name: str, standardized_name: str = None) -> str:
    """Format product name with translation if needed"""
    if not standardized_name or not needs_translation(original_name, standardized_name):
        return original_name
    return f"{original_name} / {standardized_name}"


def get_status_emoji(comparison: Dict[str, Any]) -> str:
    """Get status emoji for product"""
    if comparison.get('status') == 'not_found':
        return '🆕'
    
    analysis = comparison.get('price_analysis', {})
    if analysis.get('has_better_deals'):
        return '🔴'
    elif analysis.get('is_best_price'):
        return '🟢'
    return '⚪'


def calculate_diff_percent(comparison: Dict[str, Any]) -> float:
    """Calculate percentage difference from optimal price"""
    analysis = comparison.get('price_analysis', {})
    scanned_price = comparison.get('scanned_price', 0)
    min_price = analysis.get('min_price', scanned_price)
    
    if min_price == 0:
        return 0
    
    return ((scanned_price - min_price) / min_price) * 100


def format_product_prices(product: Dict[str, Any], limit: int = 5) -> str:
    """Format product prices for display"""
    lines = []
    
    # Product header
    lines.append(f"📊 *{product['standardized_name']}*")
    if product['name'] != product['standardized_name']:
        lines.append(f"_{product['name']}_")
    
    lines.append(f"Unit: {product['unit']}")
    if product['category']:
        lines.append(f"Category: {product['category']}")
    
    lines.append("\n*Best prices:*")
    
    # Price list
    prices = product.get('prices', [])[:limit]
    for i, price_info in enumerate(prices, 1):
        price = format_price(price_info['price'])
        supplier = price_info['supplier_name']
        lines.append(f"{i}. {supplier} - {price}")
    
    # Statistics
    if prices:
        avg_price = sum(p['price'] for p in prices) / len(prices)
        lines.append(f"\nAverage: {format_price(avg_price)}")
        lines.append(f"Suppliers: {len(prices)}")
    
    return "\n".join(lines)


def create_comparison_table(comparisons: List[Dict[str, Any]], max_rows: int = 10) -> str:
    """Create compact comparison table"""
    # Filter overpriced items and sort by highest overpayment
    overpriced_rows = []
    for comp in comparisons:
        analysis = comp.get('price_analysis', {})
        if comp.get('status') != 'not_found' and analysis.get('has_better_deals'):
            better_deals = analysis.get('better_deals', [])
            if better_deals:
                savings = better_deals[0].get('savings', 0)
                overpriced_rows.append((comp, savings))
    
    # Sort by highest savings and limit
    overpriced_rows.sort(key=lambda x: x[1], reverse=True)
    overpriced_rows = overpriced_rows[:max_rows]
    
    if not overpriced_rows:
        return '<pre>No overpriced items found!</pre>'
    
    header = 'Product               | You      | Min     '
    separator = '――――――――――――――――――――――――――――――――――――――――――――――'
    
    rows_formatted = []
    for comp, _ in overpriced_rows:
        product = truncate_product_name(comp['product_name'], 20).ljust(20)
        you_price = format_short_price(comp['scanned_price']).rjust(8)
        analysis = comp.get('price_analysis', {})
        min_price = format_short_price(analysis.get('min_price', 0)).rjust(7)
        rows_formatted.append(f"{product} | {you_price} | {min_price}")
    
    return '<pre>' + '\n'.join([header, separator] + rows_formatted) + '</pre>'


def format_comparison_report(comparison_data: Dict[str, Any], supplier_name: str = None) -> str:
    """Format enhanced price comparison report with summary-first approach"""
    lines = []
    comparisons = comparison_data.get('comparisons', [])
    
    # Calculate summary data
    total_potential_savings = 0
    total_scanned_price = 0
    overpriced_count = 0
    best_price_count = 0
    new_items_count = 0
    
    for comp in comparisons:
        if comp.get('status') == 'not_found':
            new_items_count += 1
            continue
            
        scanned_price = comp.get('scanned_price', 0)
        total_scanned_price += scanned_price
        
        analysis = comp.get('price_analysis', {})
        if analysis.get('has_better_deals'):
            better_deals = analysis.get('better_deals', [])
            if better_deals:
                total_potential_savings += better_deals[0].get('savings', 0)
                overpriced_count += 1
        elif analysis.get('is_best_price'):
            best_price_count += 1
    
    total_savings_percent = (total_potential_savings / total_scanned_price * 100) if total_scanned_price > 0 else 0
    
    # Summary-first header with emoji
    if total_potential_savings > 0:
        lines.append(f"💰 <b>Invoice Analysis - Save {format_price(total_potential_savings)} ({total_savings_percent:.0f}%)</b>")
    else:
        lines.append("✅ <b>Invoice Analysis - Optimal Pricing!</b>")
    
    if supplier_name:
        lines.append(f"Supplier: {supplier_name}")
    
    # Summary stats
    lines.append(f"📊 {overpriced_count} overpriced • {best_price_count} best price • {new_items_count} new items")
    lines.append("──────────")
    
    # Product list with status markers
    for i, comp in enumerate(comparisons, 1):
        emoji = get_status_emoji(comp)
        product_name = comp['product_name']
        current_price = format_price(comp['scanned_price'])
        
        # Check if we need to add translation
        matched_product = comp.get('matched_product') or {}
        standardized_name = matched_product.get('name', '') if matched_product else ''
        formatted_name = format_product_name_with_translation(product_name, standardized_name)
        
        if comp.get('status') == 'not_found':
            # New item with 🆕 badge
            lines.append(f"{emoji} <b>{formatted_name}</b> — {current_price}")
        else:
            analysis = comp.get('price_analysis', {})
            if analysis.get('has_better_deals'):
                # Overpriced item
                lines.append(f"{emoji} <b>{formatted_name}</b> — {current_price}")
                
                # Show up to 3 better deals
                better_deals = analysis.get('better_deals', [])[:3]
                for deal in better_deals:
                    deal_price = format_price(deal['price'])
                    supplier = deal['supplier']
                    product_name_deal = deal.get('product_name', '')
                    savings_pct = deal['savings_percent']
                    lines.append(f"  <i>• {deal_price} — {product_name_deal} ({supplier}) (-{savings_pct}%)</i>")
            else:
                # Best price
                lines.append(f"{emoji} <b>{formatted_name}</b> — {current_price}")
    
    # Compact comparison table
    if overpriced_count > 0:
        lines.append("\n<b>You vs Minimum:</b>")
        lines.append(create_comparison_table(comparisons))
    
    return "\n".join(lines)


def escape_markdown(text: str) -> str:
    """Escape special markdown characters"""
    special_chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    for char in special_chars:
        text = text.replace(char, f'\\{char}')
    return text