"""Text formatting utilities"""

from typing import List, Dict, Any


def format_price(amount: float, currency: str = "IDR") -> str:
    """Format price with currency"""
    if currency == "IDR":
        # Format Indonesian Rupiah
        return f"{amount:,.0f} {currency}".replace(",", ".")
    else:
        return f"{amount:,.2f} {currency}"


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


def format_comparison_report(comparison_data: Dict[str, Any], supplier_name: str = None) -> str:
    """Format price comparison report"""
    lines = []
    
    # Header
    lines.append("📄 *Invoice Analysis*")
    if supplier_name:
        lines.append(f"Supplier: {supplier_name}")
    
    lines.append("\n*Price Comparison:*")
    
    # Product comparisons
    optimizable = []
    for comp in comparison_data['comparisons']:
        product = comp['product_name']
        current = format_price(comp['current_price'])
        best = format_price(comp['best_price'])
        
        if comp['can_optimize']:
            emoji = "⚠️"
            optimizable.append(comp)
            lines.append(
                f"{emoji} {product} - {current}\n"
                f"   Better price: {comp['best_supplier']} - {best} "
                f"(-{comp['savings_percent']:.0f}%)"
            )
        else:
            emoji = "✅"
            lines.append(f"{emoji} {product} - {current} (best price!)")
    
    # Summary
    lines.append("\n*Summary:*")
    total_current = format_price(comparison_data['total_current'])
    total_savings = format_price(comparison_data['total_savings'])
    
    lines.append(f"Total: {total_current}")
    
    if comparison_data['total_savings'] > 0:
        lines.append(f"💰 Potential savings: {total_savings} "
                    f"(-{comparison_data['total_savings_percent']:.0f}%)")
        
        # Recommendations
        if optimizable:
            lines.append("\n*Recommendations:*")
            for comp in optimizable[:3]:  # Top 3 savings
                lines.append(
                    f"• Switch {comp['product_name']} to {comp['best_supplier']} "
                    f"(save {format_price(comp['savings'])})"
                )
    else:
        lines.append("✅ All prices are optimal!")
    
    return "\n".join(lines)


def escape_markdown(text: str) -> str:
    """Escape special markdown characters"""
    special_chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    for char in special_chars:
        text = text.replace(char, f'\\{char}')
    return text