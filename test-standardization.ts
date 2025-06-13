import { standardizeProductData } from './app/services/standardization';

// Test cases with common misspellings and Indonesian names
const testCases = [
  { raw: 'baby poteto', unit: 'kg' },
  { raw: 'sweet poteto', unit: 'kg' },
  { raw: 'banana kepok', unit: 'kg' },
  { raw: 'pisang kepok', unit: 'kg' },
  { raw: 'brocoly potong', unit: 'kg' },
  { raw: 'chiken breast', unit: 'kg' },
  { raw: 'advocado', unit: 'pcs' },
  { raw: 'tomatos', unit: 'kg' },
  { raw: 'baby poteto 1kg', unit: 'kg' },
  { raw: 'pisang raja', unit: 'kg' },
  { raw: 'pisang ambon', unit: 'kg' },
  { raw: 'carot baby', unit: 'kg' },
  { raw: 'spinch fresh', unit: 'kg' },
  { raw: 'noddles instant', unit: 'pack' }
];

console.log('Testing Product Standardization with Spell Checking:\n');

testCases.forEach(({ raw, unit }) => {
  const result = standardizeProductData(raw, unit);
  console.log(`Input: "${raw}" (${unit})`);
  console.log(`Output: "${result.standardizedName}" (${result.standardizedUnit})`);
  console.log(`Language: ${result.detectedLanguage}, Confidence: ${result.confidence}`);
  console.log('---');
});