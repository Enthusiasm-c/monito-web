const { standardizeProductData } = require('./app/services/standardization/index');

// Test cases
const testCases = [
  { name: 'baby poteto', unit: 'kg' },
  { name: 'banana kepok', unit: 'kg' },
  { name: 'kentang baby', unit: 'kg' },
  { name: 'pisang kepok', unit: 'kg' },
  { name: 'Banana kepok besar', unit: 'kg' }
];

console.log('Testing standardization...\n');

testCases.forEach(test => {
  const result = standardizeProductData(test.name, test.unit);
  console.log(`Original: "${test.name}" (${test.unit})`);
  console.log(`Standardized: "${result.standardizedName}" (${result.standardizedUnit})`);
  console.log(`Language: ${result.detectedLanguage}, Confidence: ${result.confidence}`);
  console.log('---');
});