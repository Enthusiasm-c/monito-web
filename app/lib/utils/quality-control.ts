/**
 * Quality control for maximum accuracy standardization
 */

export interface QualityCheckResult {
  isValid: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Critical Indonesian terms that must be translated exactly
 */
const CRITICAL_TRANSLATIONS = {
  'daun bawang': 'Chives',
  'bawang merah': 'Onion Red',
  'bawang putih': 'Garlic',
  'bawang bombay': 'Onion Yellow',
  'ayam': 'Chicken',
  'daging sapi': 'Beef',
  'udang': 'Shrimp',
  'sawi': 'Mustard Green',
  'kangkung': 'Water Spinach',
  'cabai': 'Chili',
  'cabe': 'Chili',
  'lombok': 'Chili'
};

/**
 * Forbidden translations (common AI mistakes)
 */
const FORBIDDEN_TRANSLATIONS = {
  'daun bawang': ['Green Onion', 'Spring Onion', 'Scallion'],
  'harum': ['Fragrant', 'Aromatic'],
  'keriting': ['Kriting', 'Curled']
};

/**
 * Validate translation accuracy for critical terms
 */
export function validateCriticalTranslations(
  originalName: string,
  standardizedName: string
): QualityCheckResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const lowerOriginal = originalName.toLowerCase();
  const lowerStandardized = standardizedName.toLowerCase();

  // Check for critical term translations
  for (const [indonesian, expectedEnglish] of Object.entries(CRITICAL_TRANSLATIONS)) {
    if (lowerOriginal.includes(indonesian)) {
      if (!lowerStandardized.includes(expectedEnglish.toLowerCase())) {
        issues.push(`Critical term "${indonesian}" not translated to "${expectedEnglish}"`);
        recommendations.push(`Use "${expectedEnglish}" for "${indonesian}"`);
        score -= 20;
      }
    }
  }

  // Check for forbidden translations
  for (const [indonesian, forbiddenList] of Object.entries(FORBIDDEN_TRANSLATIONS)) {
    if (lowerOriginal.includes(indonesian)) {
      for (const forbidden of forbiddenList) {
        if (lowerStandardized.includes(forbidden.toLowerCase())) {
          issues.push(`Forbidden translation: "${forbidden}" used for "${indonesian}"`);
          recommendations.push(`Use "${CRITICAL_TRANSLATIONS[indonesian as keyof typeof CRITICAL_TRANSLATIONS]}" instead`);
          score -= 30;
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    score: Math.max(0, score),
    issues,
    recommendations
  };
}

/**
 * Comprehensive quality check for standardized products
 */
export function performQualityCheck(
  originalProducts: any[],
  standardizedProducts: any[]
): {
  overallScore: number;
  criticalIssues: number;
  results: QualityCheckResult[];
  summary: string;
} {
  if (originalProducts.length !== standardizedProducts.length) {
    return {
      overallScore: 0,
      criticalIssues: 1,
      results: [],
      summary: `Count mismatch: ${originalProducts.length} original vs ${standardizedProducts.length} standardized`
    };
  }

  const results: QualityCheckResult[] = [];
  let totalScore = 0;
  let criticalIssues = 0;

  for (let i = 0; i < originalProducts.length; i++) {
    const original = originalProducts[i];
    const standardized = standardizedProducts[i];

    const translationCheck = validateCriticalTranslations(
      original.name || original.rawName,
      standardized.standardizedName
    );

    // Additional checks
    const additionalIssues: string[] = [];
    let additionalScore = 100;

    // Check confidence level
    if (standardized.confidence < 90) {
      additionalIssues.push(`Low confidence: ${standardized.confidence}%`);
      additionalScore -= 10;
    }

    // Check category validity
    const validCategories = ['dairy', 'meat', 'seafood', 'vegetables', 'fruits', 'spices', 'grains', 'bakery', 'beverages', 'oils', 'sweeteners', 'condiments', 'disposables', 'other'];
    if (!validCategories.includes(standardized.category)) {
      additionalIssues.push(`Invalid category: ${standardized.category}`);
      additionalScore -= 15;
    }

    // Check unit standardization
    const validUnits = ['kg', 'g', 'l', 'ml', 'pcs', 'pack', 'box', 'bottle', 'can', 'bunch', 'sheet', 'sack'];
    if (standardized.standardizedUnit && !validUnits.includes(standardized.standardizedUnit)) {
      additionalIssues.push(`Invalid unit: ${standardized.standardizedUnit}`);
      additionalScore -= 10;
    }

    const finalResult: QualityCheckResult = {
      isValid: translationCheck.isValid && additionalIssues.length === 0,
      score: Math.min(translationCheck.score, additionalScore),
      issues: [...translationCheck.issues, ...additionalIssues],
      recommendations: translationCheck.recommendations
    };

    if (!finalResult.isValid) {
      criticalIssues++;
    }

    results.push(finalResult);
    totalScore += finalResult.score;
  }

  const overallScore = Math.round(totalScore / originalProducts.length);

  const summary = criticalIssues === 0 
    ? `✅ Perfect quality: ${overallScore}% accuracy`
    : `⚠️ ${criticalIssues} critical issues found, ${overallScore}% overall accuracy`;

  return {
    overallScore,
    criticalIssues,
    results,
    summary
  };
}

/**
 * Auto-fix common translation errors
 */
export function autoFixTranslations(products: any[]): any[] {
  return products.map(product => {
    let fixedName = product.standardizedName;

    // Auto-fix critical term errors
    for (const [indonesian, correct] of Object.entries(CRITICAL_TRANSLATIONS)) {
      // Check if original contains the Indonesian term
      if (product.originalName?.toLowerCase().includes(indonesian)) {
        // Fix common mistranslations
        for (const [, forbidden] of Object.entries(FORBIDDEN_TRANSLATIONS)) {
          for (const forbiddenTerm of forbidden) {
            if (fixedName.toLowerCase().includes(forbiddenTerm.toLowerCase())) {
              fixedName = fixedName.replace(new RegExp(forbiddenTerm, 'gi'), correct);
              console.log(`🔧 Auto-fixed: "${forbiddenTerm}" → "${correct}" in "${product.originalName}"`);
            }
          }
        }
      }
    }

    return {
      ...product,
      standardizedName: fixedName
    };
  });
}