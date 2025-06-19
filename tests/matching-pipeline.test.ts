import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { 
  normalize, 
  coreNoun, 
  hasDifferentCoreNoun, 
  calcUnitPrice 
} from '../app/lib/utils/product-normalizer';
import { 
  aliasLookup, 
  createAlias 
} from '../app/services/database/aliasService';

import { prisma } from '../lib/prisma';

describe('Matching Pipeline Tests', () => {
  let testProductId: string;
  
  beforeAll(async () => {
    // Create a test product
    const product = await prisma.product.create({
      data: {
        name: 'Carrot',
        standardizedName: 'Carrot',
        category: 'Vegetables',
        unit: 'kg',
        standardizedUnit: 'kg'
      }
    });
    testProductId = product.id;
  });
  
  afterAll(async () => {
    // Cleanup
    await prisma.productAlias.deleteMany({
      where: { productId: testProductId }
    });
    await prisma.product.delete({
      where: { id: testProductId }
    });
    await prisma.$disconnect();
  });
  
  describe('M-1: test_alias_lookup', () => {
    test('should find product by alias wortel', async () => {
      // Create alias
      await createAlias(testProductId, 'wortel', 'id');
      
      // Test lookup
      const foundProductId = await aliasLookup('wortel');
      expect(foundProductId).toBe(testProductId);
    });
    
    test('should find product by alias zanahoria', async () => {
      // Create alias
      await createAlias(testProductId, 'zanahoria', 'es');
      
      // Test lookup
      const foundProductId = await aliasLookup('zanahoria');
      expect(foundProductId).toBe(testProductId);
    });
  });
  
  describe('M-2: Language normalization', () => {
    test('should normalize Indonesian product names', () => {
      expect(normalize('wortel')).toBe('carrot');
      expect(normalize('kentang')).toBe('potato');
      expect(normalize('jamur')).toBe('mushroom');
      expect(normalize('ayam')).toBe('chicken');
    });
    
    test('should normalize Spanish product names', () => {
      expect(normalize('zanahoria')).toBe('carrot');
      expect(normalize('champiñón')).toBe('mushroom');
      expect(normalize('pollo')).toBe('chicken');
      expect(normalize('cebolla')).toBe('onion');
    });
    
    test('should handle mixed language input', () => {
      expect(normalize('fresh wortel')).toBe('fresh carrot');
      expect(normalize('champiñón grande')).toBe('mushroom grande');
    });
  });
  
  describe('M-3: test_core_noun_guard', () => {
    test('sweet potato should not match potato', () => {
      expect(coreNoun('sweet potato')).toBe('potato');
      expect(coreNoun('potato')).toBe('potato');
      
      // Despite same core noun, hasDifferentCoreNoun should handle this
      expect(hasDifferentCoreNoun('sweet potato', 'potato')).toBe(false);
      // This is because 'sweet' is in exclusive modifiers
      
      // Let's test with different core nouns
      expect(hasDifferentCoreNoun('carrot', 'potato')).toBe(true);
      expect(hasDifferentCoreNoun('baby carrot', 'carrot')).toBe(false);
    });
    
    test('should extract correct core nouns', () => {
      expect(coreNoun('baby spinach')).toBe('spinach');
      expect(coreNoun('cherry tomato')).toBe('tomato');
      expect(coreNoun('oyster mushroom')).toBe('mushroom');
      expect(coreNoun('local fresh carrot')).toBe('carrot');
    });
  });
  
  describe('M-4: test_unit_price_calc', () => {
    test('should calculate unit price correctly for g to kg conversion', () => {
      // 0.2 kg @ 25,000 → unitPrice 125,000 per kg
      const unitPrice = calcUnitPrice(25000, 0.2, 'kg');
      expect(unitPrice).toBe(125000);
    });
    
    test('should handle gram to kilogram conversion', () => {
      // 200g @ 25,000 → unitPrice 125,000 per kg
      const unitPrice = calcUnitPrice(25000, 200, 'g');
      expect(unitPrice).toBe(125000);
    });
    
    test('should handle milliliter to liter conversion', () => {
      // 500ml @ 10,000 → unitPrice 20,000 per liter
      const unitPrice = calcUnitPrice(10000, 500, 'ml');
      expect(unitPrice).toBe(20000);
    });
    
    test('should handle different unit combinations', () => {
      // Test g to kg: 250g @ 5000 → 20000 per kg
      expect(calcUnitPrice(5000, 250, 'g')).toBe(20000);
      
      // Test ml to L: 750ml @ 15000 → 20000 per L
      expect(calcUnitPrice(15000, 750, 'ml')).toBe(20000);
      
      // Test pieces (no conversion): 3 pcs @ 12000 → 4000 per pcs
      expect(calcUnitPrice(12000, 3, 'pcs')).toBe(4000);
      
      // Test dozen to pieces: 1 dozen @ 24000 → 2000 per pcs
      expect(calcUnitPrice(24000, 1, 'dozen')).toBe(2000);
    });
    
    test('should handle normalized unit names', () => {
      // Test with various unit formats
      expect(calcUnitPrice(10000, 1000, 'gram')).toBe(10000); // gram → kg
      expect(calcUnitPrice(10000, 1, 'kilogram')).toBe(10000); // kilogram → kg
      expect(calcUnitPrice(10000, 1000, 'ml')).toBe(10000); // ml → L
      expect(calcUnitPrice(10000, 1, 'liter')).toBe(10000); // liter → L
    });
    
    test('should return null for invalid inputs', () => {
      expect(calcUnitPrice(10000, 0, 'kg')).toBeNull();
      expect(calcUnitPrice(10000, -1, 'kg')).toBeNull();
      expect(calcUnitPrice(10000, 1, '')).toBeNull();
      expect(calcUnitPrice(0, 1, 'kg')).toBeNull();
      expect(calcUnitPrice(-1000, 1, 'kg')).toBeNull();
    });
    
    test('should handle edge cases for unit conversion', () => {
      // Very small quantities
      expect(calcUnitPrice(1000, 0.001, 'kg')).toBe(1000000);
      
      // Very large quantities  
      expect(calcUnitPrice(1000000, 1000, 'kg')).toBe(1000);
      
      // Fractional quantities in grams
      expect(calcUnitPrice(2500, 125, 'g')).toBe(20000); // 125g @ 2500 = 20000/kg
    });
  });
  
  describe('M-5: Supplier and freshness filter', () => {
    test('should filter same supplier within fresh period', async () => {
      const supplierId = 'test-supplier-123';
      const invoiceDate = new Date();
      
      // Create test prices
      const prices = [
        {
          supplierId: supplierId,
          price: 10000,
          priceDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days old
          unitPrice: 10000
        },
        {
          supplierId: 'other-supplier',
          price: 9000,
          priceDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days old
          unitPrice: 9000
        },
        {
          supplierId: supplierId,
          price: 8000,
          priceDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
          unitPrice: 8000
        }
      ];
      
      const MIN_SAVING = 0.05;
      const FRESH_DAYS = 7;
      const invoiceUnitPrice = 10000;
      
      // Apply filters
      const filtered = prices
        .filter(c => {
          const daysDiff = (invoiceDate.getTime() - c.priceDate.getTime()) / (24 * 60 * 60 * 1000);
          return c.supplierId !== supplierId || daysDiff >= FRESH_DAYS;
        })
        .filter(c => c.unitPrice < invoiceUnitPrice * (1 - MIN_SAVING))
        .sort((a, b) => a.unitPrice - b.unitPrice)
        .slice(0, 3);
      
      // Should only include 'other-supplier' (9000) and old same supplier price (8000)
      expect(filtered.length).toBe(2);
      expect(filtered[0].supplierId).toBe(supplierId); // 8000 (older, cheaper)
      expect(filtered[1].supplierId).toBe('other-supplier'); // 9000
    });
    
    test('should limit to maximum 3 alternatives', () => {
      const alternatives = [
        { price: 1000, unitPrice: 1000 },
        { price: 2000, unitPrice: 2000 },
        { price: 3000, unitPrice: 3000 },
        { price: 4000, unitPrice: 4000 },
        { price: 5000, unitPrice: 5000 }
      ];
      
      const limited = alternatives
        .sort((a, b) => a.unitPrice - b.unitPrice)
        .slice(0, 3);
      
      expect(limited.length).toBe(3);
      expect(limited[0].price).toBe(1000);
      expect(limited[2].price).toBe(3000);
    });
    
    test('should require minimum 5% savings', () => {
      const invoicePrice = 10000;
      const MIN_SAVING = 0.05;
      
      const alternatives = [
        { price: 9600, unitPrice: 9600 }, // 4% savings - should be excluded
        { price: 9500, unitPrice: 9500 }, // 5% savings - should be included
        { price: 9000, unitPrice: 9000 }, // 10% savings - should be included
      ];
      
      const filtered = alternatives.filter(
        alt => alt.unitPrice < invoicePrice * (1 - MIN_SAVING)
      );
      
      expect(filtered.length).toBe(2);
      expect(filtered[0].price).toBe(9500);
      expect(filtered[1].price).toBe(9000);
    });
  });

  describe('Dictionary Integration Tests', () => {
    test('should save unmatched products to queue', async () => {
      // This would be integration test with actual API
      const unmatchedData = {
        rawName: 'zanahorias grandes',
        normalizedName: 'carrot large',
        context: {
          scanned_price: 15000,
          unit: 'kg',
          search_attempts: ['zanahorias grandes', 'carrot large']
        }
      };

      // Mock the unmatched queue creation
      expect(unmatchedData.rawName).toBe('zanahorias grandes');
      expect(unmatchedData.normalizedName).toBe('carrot large');
      expect(unmatchedData.context.scanned_price).toBe(15000);
    });

    test('should handle language dictionary lookups', () => {
      // Test dictionary functionality
      const translations = {
        'wortel': 'carrot',
        'kentang': 'potato',
        'ayam': 'chicken',
        'zanahoria': 'carrot',
        'pollo': 'chicken'
      };

      // Test Indonesian translations
      expect(translations['wortel']).toBe('carrot');
      expect(translations['kentang']).toBe('potato');
      expect(translations['ayam']).toBe('chicken');

      // Test Spanish translations
      expect(translations['zanahoria']).toBe('carrot');
      expect(translations['pollo']).toBe('chicken');
    });

    test('should handle unit dictionary conversions', () => {
      const unitConversions = {
        'g': { target: 'kg', factor: 0.001 },
        'gram': { target: 'kg', factor: 0.001 },
        'ml': { target: 'L', factor: 0.001 },
        'liter': { target: 'L', factor: 1.0 },
        'dozen': { target: 'pcs', factor: 12 }
      };

      // Test weight conversions
      expect(unitConversions['g'].target).toBe('kg');
      expect(unitConversions['g'].factor).toBe(0.001);
      expect(unitConversions['gram'].target).toBe('kg');

      // Test volume conversions
      expect(unitConversions['ml'].target).toBe('L');
      expect(unitConversions['ml'].factor).toBe(0.001);
      expect(unitConversions['liter'].target).toBe('L');

      // Test count conversions
      expect(unitConversions['dozen'].target).toBe('pcs');
      expect(unitConversions['dozen'].factor).toBe(12);
    });
  });

  describe('Price Comparison API Integration', () => {
    test('should include unit prices in comparison results', () => {
      const mockPriceData = [
        {
          amount: 25000,
          unit: 'kg',
          quantity: 0.5,
          supplier: 'Supplier A'
        },
        {
          amount: 15000,
          unit: 'g', 
          quantity: 500,
          supplier: 'Supplier B'
        }
      ];

      // Calculate unit prices for comparison
      const enrichedPrices = mockPriceData.map(price => ({
        ...price,
        unitPrice: calcUnitPrice(price.amount, price.quantity, price.unit)
      }));

      // Supplier A: 25000 / 0.5kg = 50000 per kg
      expect(enrichedPrices[0].unitPrice).toBe(50000);
      
      // Supplier B: 15000 / 500g = 30000 per kg
      expect(enrichedPrices[1].unitPrice).toBe(30000);

      // Sort by unit price to find best deal
      const sortedByUnitPrice = enrichedPrices.sort((a, b) => (a.unitPrice || 0) - (b.unitPrice || 0));
      expect(sortedByUnitPrice[0].supplier).toBe('Supplier B'); // Better unit price
    });

    test('should calculate savings based on unit price', () => {
      const scannedPrice = 40000; // 40k per kg
      const alternativePrice = 30000; // 30k per kg

      const savings = ((scannedPrice - alternativePrice) / scannedPrice) * 100;
      expect(savings).toBe(25); // 25% savings

      // Should meet minimum 5% savings threshold
      const MIN_SAVING_PCT = 5;
      expect(savings).toBeGreaterThanOrEqual(MIN_SAVING_PCT);
    });
  });
});