import { standardizeUnit } from '../../app/services/standardization';

describe('Unit Standardization', () => {
  describe('weight units', () => {
    test('should standardize kilogram variants', () => {
      expect(standardizeUnit('kg')).toBe('kg');
      expect(standardizeUnit('Kg')).toBe('kg');
      expect(standardizeUnit('KG')).toBe('kg');
      expect(standardizeUnit('kg.')).toBe('kg');
      expect(standardizeUnit('kg/')).toBe('kg');
      expect(standardizeUnit('kilo')).toBe('kg');
      expect(standardizeUnit('kilogram')).toBe('kg');
    });

    test('should standardize gram variants', () => {
      expect(standardizeUnit('g')).toBe('g');
      expect(standardizeUnit('gr')).toBe('g');
      expect(standardizeUnit('gram')).toBe('g');
      expect(standardizeUnit('grams')).toBe('g');
      expect(standardizeUnit('g.')).toBe('g');
    });
  });

  describe('volume units', () => {
    test('should standardize liter variants', () => {
      expect(standardizeUnit('l')).toBe('L');
      expect(standardizeUnit('L')).toBe('L');
      expect(standardizeUnit('ltr')).toBe('L');
      expect(standardizeUnit('liter')).toBe('L');
      expect(standardizeUnit('litre')).toBe('L');
    });

    test('should standardize milliliter variants', () => {
      expect(standardizeUnit('ml')).toBe('mL');
      expect(standardizeUnit('ML')).toBe('mL');
      expect(standardizeUnit('milliliter')).toBe('mL');
      expect(standardizeUnit('mililiter')).toBe('mL');
    });
  });

  describe('count units', () => {
    test('should standardize piece variants', () => {
      expect(standardizeUnit('pcs')).toBe('pcs');
      expect(standardizeUnit('pc')).toBe('pcs');
      expect(standardizeUnit('piece')).toBe('pcs');
      expect(standardizeUnit('pieces')).toBe('pcs');
      expect(standardizeUnit('ea')).toBe('pcs');
      expect(standardizeUnit('each')).toBe('pcs');
    });

    test('should standardize Indonesian count units', () => {
      expect(standardizeUnit('buah')).toBe('pcs');
      expect(standardizeUnit('butir')).toBe('pcs');
      expect(standardizeUnit('biji')).toBe('pcs');
      expect(standardizeUnit('lembar')).toBe('sheet');
      expect(standardizeUnit('potong')).toBe('pcs');
      expect(standardizeUnit('ekor')).toBe('pcs');
    });
  });

  describe('packaging units', () => {
    test('should standardize pack variants', () => {
      expect(standardizeUnit('pack')).toBe('pack');
      expect(standardizeUnit('packs')).toBe('pack');
      expect(standardizeUnit('package')).toBe('pack');
      expect(standardizeUnit('paket')).toBe('pack');
      expect(standardizeUnit('bungkus')).toBe('pack');
    });

    test('should standardize box variants', () => {
      expect(standardizeUnit('box')).toBe('box');
      expect(standardizeUnit('boxes')).toBe('box');
      expect(standardizeUnit('dus')).toBe('box');
      expect(standardizeUnit('karton')).toBe('carton');
    });

    test('should standardize bottle/can variants', () => {
      expect(standardizeUnit('bottle')).toBe('bottle');
      expect(standardizeUnit('botol')).toBe('bottle');
      expect(standardizeUnit('can')).toBe('can');
      expect(standardizeUnit('kaleng')).toBe('can');
    });
  });

  describe('bundle units', () => {
    test('should standardize bunch/bundle variants', () => {
      expect(standardizeUnit('bunch')).toBe('bunch');
      expect(standardizeUnit('bundle')).toBe('bundle');
      expect(standardizeUnit('sisir')).toBe('bunch');
      expect(standardizeUnit('ikat')).toBe('bundle');
    });
  });

  describe('thousand units', () => {
    test('should standardize thousand variants', () => {
      expect(standardizeUnit('k')).toBe('1000');
      expect(standardizeUnit('K')).toBe('1000');
      expect(standardizeUnit('ribu')).toBe('1000');
      expect(standardizeUnit('rb')).toBe('1000');
    });
  });

  describe('edge cases', () => {
    test('should handle empty/null units', () => {
      expect(standardizeUnit('')).toBe('pcs');
      expect(standardizeUnit(null as any)).toBe('pcs');
      expect(standardizeUnit(undefined as any)).toBe('pcs');
    });

    test('should clean dots and slashes', () => {
      expect(standardizeUnit('kg./unit')).toBe('kg');
      expect(standardizeUnit('pcs.')).toBe('pcs');
      expect(standardizeUnit('L/')).toBe('L');
    });

    test('should warn and return unknown units', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(standardizeUnit('unknown')).toBe('unknown');
      expect(standardizeUnit('xyz123')).toBe('xyz123');
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown unit standardization'));
      
      consoleSpy.mockRestore();
    });
  });
});