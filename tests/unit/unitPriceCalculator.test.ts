import { calculateUnitPrice } from '../../app/lib/utils/unit-price-calculator';

describe('Unit Price Calculator', () => {
  describe('normal calculations', () => {
    test('should calculate unit price for weight units', () => {
      expect(calculateUnitPrice(50000, 5, 'kg')).toBe(10000); // 50000 / 5kg = 10000/kg
      expect(calculateUnitPrice(2000, 500, 'g')).toBe(4000); // 2000 / (500g * 0.001) = 4000/kg
      expect(calculateUnitPrice(1500, 100, 'gr')).toBe(15000); // 1500 / (100g * 0.001) = 15000/kg
    });

    test('should calculate unit price for volume units', () => {
      expect(calculateUnitPrice(30000, 2, 'L')).toBe(15000); // 30000 / 2L = 15000/L
      expect(calculateUnitPrice(5000, 500, 'ml')).toBe(10000); // 5000 / (500ml * 0.001) = 10000/L
    });

    test('should calculate unit price for count units', () => {
      expect(calculateUnitPrice(25000, 10, 'pcs')).toBe(2500); // 25000 / 10pcs = 2500/pcs
      expect(calculateUnitPrice(15000, 5, 'piece')).toBe(3000); // 15000 / 5pcs = 3000/pcs
    });
  });

  describe('missing quantity handling', () => {
    test('should default to 1 when quantity is null/undefined', () => {
      expect(calculateUnitPrice(5000, null, 'kg')).toBe(5000);
      expect(calculateUnitPrice(5000, undefined, 'kg')).toBe(5000);
    });

    test('should default to 1 when quantity is missing', () => {
      expect(calculateUnitPrice(10000, null, 'pcs')).toBe(10000);
      expect(calculateUnitPrice(10000, undefined, 'pcs')).toBe(10000);
    });
  });

  describe('zero quantity handling', () => {
    test('should throw error for zero quantity', () => {
      expect(() => calculateUnitPrice(5000, 0, 'kg')).toThrow('Quantity cannot be zero');
      expect(() => calculateUnitPrice(1000, 0, 'pcs')).toThrow('Quantity cannot be zero');
    });
  });

  describe('invalid price handling', () => {
    test('should throw error for invalid prices', () => {
      expect(() => calculateUnitPrice(0, 1, 'kg')).toThrow('Invalid price: 0');
      expect(() => calculateUnitPrice(-1000, 1, 'kg')).toThrow('Invalid price: -1000');
    });
  });

  describe('unknown unit handling', () => {
    test('should calculate simple per-unit price for unknown units', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(calculateUnitPrice(10000, 5, 'unknown')).toBe(2000); // 10000 / 5 = 2000
      expect(calculateUnitPrice(5000, 2, 'xyz')).toBe(2500); // 5000 / 2 = 2500
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown unit for unit price calc'));
      
      consoleSpy.mockRestore();
    });

    test('should handle unknown units with null quantity', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(calculateUnitPrice(5000, null, 'unknown')).toBe(5000);
      
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    test('should handle very small quantities', () => {
      expect(calculateUnitPrice(100, 0.1, 'kg')).toBe(1000); // 100 / 0.1kg = 1000/kg
      expect(calculateUnitPrice(50, 0.05, 'L')).toBe(1000); // 50 / 0.05L = 1000/L
    });

    test('should handle decimal prices', () => {
      expect(calculateUnitPrice(150.5, 1, 'kg')).toBe(150.5);
      expect(calculateUnitPrice(999.99, 3, 'pcs')).toBeCloseTo(333.33, 2);
    });

    test('should validate calculation results', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // This would cause NaN or Infinity in edge cases
      // The function should handle gracefully
      expect(calculateUnitPrice(1000, 0.0000001, 'invalidunit')).toBe(10000000000);
      
      consoleSpy.mockRestore();
    });
  });
});