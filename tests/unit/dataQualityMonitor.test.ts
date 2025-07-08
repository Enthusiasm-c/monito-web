import { DataQualityMonitor } from '../../app/services/dataQualityMonitor';

describe('Data Quality Monitor', () => {
  let monitor: DataQualityMonitor;

  beforeEach(() => {
    monitor = new DataQualityMonitor();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('null price detection', () => {
    test('should flag null prices as critical', () => {
      monitor.checkProductQuality({
        name: 'Apple Fuji',
        price: null,
        unit: 'kg'
      });

      const issues = monitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'null_price',
        severity: 'critical',
        productName: 'Apple Fuji'
      });
    });

    test('should flag undefined prices as critical', () => {
      monitor.checkProductQuality({
        name: 'Banana',
        price: undefined as any,
        unit: 'kg'
      });

      const issues = monitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('null_price');
    });
  });

  describe('price range validation', () => {
    test('should flag prices below 100 as warning', () => {
      monitor.checkProductQuality({
        name: 'Test Product',
        price: 50,
        unit: 'pcs'
      });

      const issues = monitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'out_of_range_price',
        severity: 'warning',
        details: { price: 50 }
      });
    });

    test('should flag prices above 10M as warning', () => {
      monitor.checkProductQuality({
        name: 'Expensive Item',
        price: 15000000,
        unit: 'pcs'
      });

      const issues = monitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('out_of_range_price');
    });

    test('should accept valid price ranges', () => {
      monitor.checkProductQuality({
        name: 'Normal Product',
        price: 50000,
        unit: 'kg'
      });

      expect(monitor.getIssues()).toHaveLength(0);
    });
  });

  describe('zero quantity detection', () => {
    test('should flag zero quantity as critical', () => {
      monitor.checkProductQuality({
        name: 'Zero Qty Product',
        price: 1000,
        unit: 'kg',
        quantity: 0
      });

      const issues = monitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'zero_quantity',
        severity: 'critical'
      });
    });
  });

  describe('invalid unit detection', () => {
    test('should flag unknown units as warning', () => {
      monitor.checkProductQuality({
        name: 'Unknown Unit Product',
        price: 5000,
        unit: 'xyz',
        standardizedUnit: 'xyz'
      });

      const issues = monitor.getIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'invalid_unit',
        severity: 'warning',
        details: { unit: 'xyz', standardizedUnit: 'xyz' }
      });
    });

    test('should accept valid standardized units', () => {
      const validUnits = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'box'];
      
      validUnits.forEach(unit => {
        const newMonitor = new DataQualityMonitor();
        newMonitor.checkProductQuality({
          name: `Product with ${unit}`,
          price: 5000,
          unit: unit,
          standardizedUnit: unit
        });
        
        expect(newMonitor.getIssues()).toHaveLength(0);
      });
    });
  });

  describe('quality report generation', () => {
    test('should generate comprehensive report', () => {
      // Add various issues
      monitor.checkProductQuality({ name: 'Null Price', price: null, unit: 'kg' });
      monitor.checkProductQuality({ name: 'Invalid Unit', price: 5000, unit: 'xyz' });
      monitor.checkProductQuality({ name: 'Out of Range', price: 50, unit: 'pcs' });
      monitor.checkProductQuality({ name: 'Zero Qty', price: 1000, unit: 'kg', quantity: 0 });
      monitor.checkProductQuality({ name: 'Valid Product', price: 5000, unit: 'kg' });

      const report = monitor.generateReport(5);

      expect(report).toEqual({
        totalProducts: 5,
        nullPrices: 1,
        invalidUnits: 1,
        outOfRangePrices: 1,
        zeroQuantities: 1,
        criticalIssues: expect.arrayContaining([
          expect.objectContaining({ type: 'null_price' }),
          expect.objectContaining({ type: 'zero_quantity' })
        ]),
        needsReview: true
      });
    });

    test('should flag for review with >10% issues', () => {
      // Add 2 issues out of 10 products (20%)
      monitor.checkProductQuality({ name: 'Bad 1', price: null, unit: 'kg' });
      monitor.checkProductQuality({ name: 'Bad 2', price: 5000, unit: 'invalid' });

      const report = monitor.generateReport(10);
      expect(report.needsReview).toBe(true);
    });

    test('should not flag for review with <10% issues', () => {
      // Add 1 warning out of 20 products (5%)
      monitor.checkProductQuality({ name: 'Warning', price: 5000, unit: 'unknown' });

      const report = monitor.generateReport(20);
      expect(report.needsReview).toBe(false);
    });
  });

  describe('monitor reset', () => {
    test('should clear all issues on reset', () => {
      monitor.checkProductQuality({ name: 'Test', price: null, unit: 'kg' });
      expect(monitor.getIssues()).toHaveLength(1);

      monitor.reset();
      expect(monitor.getIssues()).toHaveLength(0);
    });
  });
});