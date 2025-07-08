import { dataNormalizer } from '../../app/services/dataNormalizer';

describe('DataNormalizer - Price Parsing', () => {
  describe('normalizePrice with K/M suffixes', () => {
    test('should parse prices with K suffix', () => {
      expect(dataNormalizer.normalizePrice('50K').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('50k').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('1.5K').value).toBe(1500);
      expect(dataNormalizer.normalizePrice('25.5k').value).toBe(25500);
    });

    test('should parse prices with M suffix', () => {
      expect(dataNormalizer.normalizePrice('1M').value).toBe(1000000);
      expect(dataNormalizer.normalizePrice('1m').value).toBe(1000000);
      expect(dataNormalizer.normalizePrice('2.5M').value).toBe(2500000);
      expect(dataNormalizer.normalizePrice('0.5m').value).toBe(500000);
    });

    test('should parse prices with Indonesian K variants', () => {
      expect(dataNormalizer.normalizePrice('50rb').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('50ribu').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('25 rb').value).toBe(25000);
      expect(dataNormalizer.normalizePrice('100 ribu').value).toBe(100000);
    });

    test('should parse prices with currency and suffix', () => {
      expect(dataNormalizer.normalizePrice('Rp 50K').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('Rp. 25k').value).toBe(25000);
      expect(dataNormalizer.normalizePrice('IDR 1M').value).toBe(1000000);
    });
  });

  describe('price range validation', () => {
    test('should reject prices below 100', () => {
      expect(dataNormalizer.normalizePrice('50').value).toBeNull();
      expect(dataNormalizer.normalizePrice('99').value).toBeNull();
      expect(dataNormalizer.normalizePrice('0').value).toBeNull();
      expect(dataNormalizer.normalizePrice('-100').value).toBeNull();
    });

    test('should accept prices from 100 to 10,000,000', () => {
      expect(dataNormalizer.normalizePrice('100').value).toBe(100);
      expect(dataNormalizer.normalizePrice('50000').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('10000000').value).toBe(10000000);
    });

    test('should reject prices above 10,000,000', () => {
      expect(dataNormalizer.normalizePrice('10000001').value).toBeNull();
      expect(dataNormalizer.normalizePrice('50000000').value).toBeNull();
      expect(dataNormalizer.normalizePrice('15M').value).toBeNull();
    });
  });

  describe('Indonesian number format', () => {
    test('should parse Indonesian thousands separator', () => {
      expect(dataNormalizer.normalizePrice('50.000').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('1.500.000').value).toBe(1500000);
      expect(dataNormalizer.normalizePrice('25.500').value).toBe(25500);
    });

    test('should handle mixed formats', () => {
      expect(dataNormalizer.normalizePrice('Rp. 50.000').value).toBe(50000);
      expect(dataNormalizer.normalizePrice('IDR 1.500.000').value).toBe(1500000);
    });
  });

  describe('edge cases', () => {
    test('should handle null/undefined/empty', () => {
      expect(dataNormalizer.normalizePrice(null).value).toBeNull();
      expect(dataNormalizer.normalizePrice(undefined).value).toBeNull();
      expect(dataNormalizer.normalizePrice('').value).toBeNull();
    });

    test('should handle invalid formats', () => {
      expect(dataNormalizer.normalizePrice('abc').value).toBeNull();
      expect(dataNormalizer.normalizePrice('K50').value).toBeNull();
      expect(dataNormalizer.normalizePrice('fifty thousand').value).toBeNull();
    });
  });
});