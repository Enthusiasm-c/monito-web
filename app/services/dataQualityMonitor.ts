/**
 * Data Quality Monitor
 * Tracks and reports on data quality issues during processing
 */

import { standardizeUnit } from './standardization';

interface QualityIssue {
  type: 'null_price' | 'invalid_unit' | 'out_of_range_price' | 'zero_quantity';
  severity: 'critical' | 'warning';
  productName: string;
  details: any;
  timestamp: Date;
}

interface QualityReport {
  totalProducts: number;
  nullPrices: number;
  invalidUnits: number;
  outOfRangePrices: number;
  zeroQuantities: number;
  criticalIssues: QualityIssue[];
  needsReview: boolean;
}

export class DataQualityMonitor {
  private issues: QualityIssue[] = [];
  private validUnitWhitelist: Set<string>;
  
  constructor() {
    // Initialize whitelist of valid standardized units
    this.validUnitWhitelist = new Set([
      'kg', 'g', 'mg', 'lb', 'oz',
      'L', 'mL', 
      'pcs', 'sheet', 
      'pack', 'box', 'carton', 'bottle', 'can', 'bag',
      'bunch', 'bundle',
      '1000', 'dozen', 'score', 'gross', 'ream'
    ]);
  }
  
  /**
   * Check product data quality and log issues
   */
  checkProductQuality(product: {
    name: string;
    price: number | null;
    unit: string;
    standardizedUnit?: string;
    quantity?: number;
  }): void {
    // Check for null price
    if (product.price === null || product.price === undefined) {
      this.logIssue({
        type: 'null_price',
        severity: 'critical',
        productName: product.name,
        details: { price: product.price },
        timestamp: new Date()
      });
    }
    
    // Check for out of range price
    if (product.price !== null && (product.price < 100 || product.price > 10000000)) {
      this.logIssue({
        type: 'out_of_range_price',
        severity: 'warning',
        productName: product.name,
        details: { price: product.price },
        timestamp: new Date()
      });
    }
    
    // Check for zero quantity
    if (product.quantity === 0) {
      this.logIssue({
        type: 'zero_quantity',
        severity: 'critical',
        productName: product.name,
        details: { quantity: product.quantity },
        timestamp: new Date()
      });
    }
    
    // Check for invalid unit
    const standardized = product.standardizedUnit || standardizeUnit(product.unit);
    if (!this.validUnitWhitelist.has(standardized)) {
      this.logIssue({
        type: 'invalid_unit',
        severity: 'warning',
        productName: product.name,
        details: { 
          unit: product.unit, 
          standardizedUnit: standardized 
        },
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Log a quality issue
   */
  private logIssue(issue: QualityIssue): void {
    this.issues.push(issue);
    
    // Log to console with appropriate emoji
    const emoji = issue.severity === 'critical' ? '🚨' : '⚠️';
    console.log(`${emoji} Data quality issue [${issue.type}]: ${issue.productName} - ${JSON.stringify(issue.details)}`);
  }
  
  /**
   * Generate quality report
   */
  generateReport(totalProducts: number): QualityReport {
    const nullPrices = this.issues.filter(i => i.type === 'null_price').length;
    const invalidUnits = this.issues.filter(i => i.type === 'invalid_unit').length;
    const outOfRangePrices = this.issues.filter(i => i.type === 'out_of_range_price').length;
    const zeroQuantities = this.issues.filter(i => i.type === 'zero_quantity').length;
    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    
    const needsReview = criticalIssues.length > 0 || 
                       (nullPrices + invalidUnits) > totalProducts * 0.1; // More than 10% issues
    
    return {
      totalProducts,
      nullPrices,
      invalidUnits,
      outOfRangePrices,
      zeroQuantities,
      criticalIssues,
      needsReview
    };
  }
  
  /**
   * Reset monitor for new processing batch
   */
  reset(): void {
    this.issues = [];
  }
  
  /**
   * Get all issues
   */
  getIssues(): QualityIssue[] {
    return [...this.issues];
  }
  
  /**
   * Check if upload needs review based on quality issues
   */
  needsReview(): boolean {
    const criticalCount = this.issues.filter(i => i.severity === 'critical').length;
    return criticalCount > 0;
  }
}

// Export singleton instance
export const dataQualityMonitor = new DataQualityMonitor();