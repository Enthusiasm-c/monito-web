/**
 * Dictionary Cache Loader
 * Loads dictionaries from database at startup and provides fast lookup
 */

import { prisma } from '../../../lib/prisma';

interface LanguageCache {
  [sourceWord: string]: {
    targetWord: string;
    language: string;
    category?: string;
  };
}

interface UnitCache {
  [sourceUnit: string]: {
    targetUnit: string;
    conversionFactor: number;
    category?: string;
  };
}

class DictionaryCache {
  private static instance: DictionaryCache;
  private languageDict: LanguageCache = {};
  private unitDict: UnitCache = {};
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): DictionaryCache {
    if (!DictionaryCache.instance) {
      DictionaryCache.instance = new DictionaryCache();
    }
    return DictionaryCache.instance;
  }

  /**
   * Load dictionaries from database
   */
  async loadDictionaries(): Promise<void> {
    try {
      console.log('📚 Loading dictionaries from database...');
      
      const [languageEntries, unitEntries] = await Promise.all([
        prisma.languageDictionary.findMany({
          select: {
            sourceWord: true,
            targetWord: true,
            language: true,
            category: true
          }
        }),
        prisma.unitDictionary.findMany({
          select: {
            sourceUnit: true,
            targetUnit: true,
            conversionFactor: true,
            category: true
          }
        })
      ]);

      // Build language dictionary cache
      this.languageDict = {};
      languageEntries.forEach(entry => {
        this.languageDict[entry.sourceWord] = {
          targetWord: entry.targetWord,
          language: entry.language,
          category: entry.category || undefined
        };
      });

      // Build unit dictionary cache
      this.unitDict = {};
      unitEntries.forEach(entry => {
        this.unitDict[entry.sourceUnit] = {
          targetUnit: entry.targetUnit,
          conversionFactor: entry.conversionFactor,
          category: entry.category || undefined
        };
      });

      this.lastLoadTime = Date.now();
      
      console.log(`✅ Dictionaries loaded: ${languageEntries.length} language entries, ${unitEntries.length} unit entries`);
      
    } catch (error) {
      console.error('❌ Failed to load dictionaries:', error);
      throw error;
    }
  }

  /**
   * Check if cache needs refresh
   */
  private needsRefresh(): boolean {
    return Date.now() - this.lastLoadTime > this.CACHE_TTL;
  }

  /**
   * Ensure cache is loaded and fresh
   */
  private async ensureLoaded(): Promise<void> {
    if (this.lastLoadTime === 0 || this.needsRefresh()) {
      await this.loadDictionaries();
    }
  }

  /**
   * Translate word using language dictionary
   */
  async translateWord(sourceWord: string): Promise<string | null> {
    await this.ensureLoaded();
    
    const normalized = sourceWord.toLowerCase().trim();
    const entry = this.languageDict[normalized];
    
    return entry ? entry.targetWord : null;
  }

  /**
   * Get unit conversion
   */
  async convertUnit(sourceUnit: string): Promise<{
    targetUnit: string;
    conversionFactor: number;
    category?: string;
  } | null> {
    await this.ensureLoaded();
    
    const normalized = sourceUnit.toLowerCase().trim();
    const entry = this.unitDict[normalized];
    
    return entry || null;
  }

  /**
   * Get all language entries (for fallback compatibility)
   */
  async getLanguageMap(): Promise<LanguageCache> {
    await this.ensureLoaded();
    return { ...this.languageDict };
  }

  /**
   * Get all unit entries (for fallback compatibility)
   */
  async getUnitMap(): Promise<UnitCache> {
    await this.ensureLoaded();
    return { ...this.unitDict };
  }

  /**
   * Force refresh cache
   */
  async refresh(): Promise<void> {
    await this.loadDictionaries();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    languageEntries: number;
    unitEntries: number;
    lastLoadTime: Date;
    cacheAge: number;
  } {
    return {
      languageEntries: Object.keys(this.languageDict).length,
      unitEntries: Object.keys(this.unitDict).length,
      lastLoadTime: new Date(this.lastLoadTime),
      cacheAge: Date.now() - this.lastLoadTime
    };
  }

  /**
   * Seed initial data from existing hardcoded dictionaries
   */
  async seedFromHardcoded(): Promise<void> {
    try {
      console.log('🌱 Seeding dictionaries from hardcoded data...');

      // Import existing language mappings
      const LANG_MAP = {
        // Indonesian vegetables
        wortel: 'carrot',
        kentang: 'potato', 
        bawang: 'onion',
        tomat: 'tomato',
        cabai: 'chili',
        jagung: 'corn',
        
        // Indonesian meat/protein
        ayam: 'chicken',
        daging: 'beef',
        ikan: 'fish',
        telur: 'egg',
        
        // Spanish
        zanahoria: 'carrot',
        'champiñón': 'mushroom',
        pollo: 'chicken',
        
        // Common terms
        segar: 'fresh',
        organic: 'organic',
        lokal: 'local'
      };

      const UNIT_MAP = {
        // Weight
        g: 'g',
        kg: 'kg',
        gram: 'g',
        kilogram: 'kg',
        
        // Volume  
        ml: 'ml',
        l: 'L',
        liter: 'L',
        ltr: 'L',
        
        // Count
        pcs: 'pcs',
        pieces: 'pcs',
        buah: 'pcs',
        biji: 'pcs',
        dozen: 'dozen'
      };

      // Seed language dictionary
      const languageSeeds = Object.entries(LANG_MAP).map(([source, target]) => ({
        sourceWord: source,
        targetWord: target,
        language: source.match(/[áéíóúñü]/) ? 'es' : 'id',
        category: null,
        createdBy: 'system'
      }));

      // Seed unit dictionary
      const unitSeeds = Object.entries(UNIT_MAP).map(([source, target]) => {
        const conversionFactor = source === 'g' && target === 'kg' ? 0.001 :
                                source === 'dozen' ? 12 : 1.0;
        const category = ['g', 'kg', 'gram', 'kilogram'].includes(source) ? 'weight' :
                        ['ml', 'l', 'liter', 'ltr'].includes(source) ? 'volume' : 'count';
        
        return {
          sourceUnit: source,
          targetUnit: target,
          conversionFactor,
          category,
          createdBy: 'system'
        };
      });

      // Insert with upsert to avoid duplicates
      await Promise.all([
        ...languageSeeds.map(data => 
          prisma.languageDictionary.upsert({
            where: { sourceWord: data.sourceWord },
            update: data,
            create: data
          })
        ),
        ...unitSeeds.map(data =>
          prisma.unitDictionary.upsert({
            where: { sourceUnit: data.sourceUnit },
            update: data,
            create: data
          })
        )
      ]);

      console.log(`✅ Seeded ${languageSeeds.length} language entries and ${unitSeeds.length} unit entries`);
      
      // Reload cache with new data
      await this.loadDictionaries();
      
    } catch (error) {
      console.error('❌ Failed to seed dictionaries:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const dictionaryCache = DictionaryCache.getInstance();

// Auto-load on first import (for server startup)
if (typeof window === 'undefined') {
  dictionaryCache.loadDictionaries().catch(console.error);
}