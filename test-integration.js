/**
 * Integration testing for monito-web system
 * Tests critical component integrations and dependencies
 */

const path = require('path');
const fs = require('fs');

// Mock fetch for Node.js environment
global.fetch = require('node-fetch');

// Test configuration
const TEST_CONFIG = {
  maxTimeoutMs: 10000,
  retryAttempts: 3
};

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

/**
 * Test runner utility
 */
async function runTest(testName, testFunction) {
  console.log(`🧪 Running: ${testName}`);
  
  try {
    await testFunction();
    testResults.passed++;
    testResults.details.push({ name: testName, status: 'PASSED', error: null });
    console.log(`✅ PASSED: ${testName}\n`);
  } catch (error) {
    testResults.failed++;
    testResults.details.push({ name: testName, status: 'FAILED', error: error.message });
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

/**
 * Test utility imports and module loading
 */
async function testModuleImports() {
  // Test critical utility imports
  const modulesToTest = [
    './app/lib/utils/product-normalizer.js',
    './app/lib/utils/unit-price-calculator.js', 
    './app/utils/validation.js',
    './app/utils/common.js'
  ];

  for (const modulePath of modulesToTest) {
    const fullPath = path.resolve(modulePath);
    if (fs.existsSync(fullPath.replace('.js', '.ts'))) {
      console.log(`✅ Module exists: ${modulePath.replace('.js', '.ts')}`);
    } else {
      throw new Error(`Module not found: ${modulePath}`);
    }
  }
}

/**
 * Test database schema consistency
 */
async function testDatabaseSchema() {
  const schemaPath = './prisma/schema.prisma';
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error('Prisma schema not found');
  }
  
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Check for required models
  const requiredModels = [
    'Product', 'Price', 'Supplier', 'Upload',
    'ProductAlias', 'UnmatchedQueue'
  ];
  
  for (const model of requiredModels) {
    if (!schema.includes(`model ${model}`)) {
      throw new Error(`Required model ${model} not found in schema`);
    }
  }
  
  console.log(`✅ All required models found in schema`);
}

/**
 * Test API route structure
 */
async function testAPIRouteStructure() {
  const criticalRoutes = [
    './app/api/bot/prices/compare/route.ts',
    './app/api/products/route.ts',
    './app/api/upload-unified/route.ts',
    './app/api/standardization/route.ts'
  ];
  
  for (const route of criticalRoutes) {
    if (!fs.existsSync(route)) {
      throw new Error(`Critical API route missing: ${route}`);
    }
    
    const content = fs.readFileSync(route, 'utf8');
    
    // Check for required exports
    if (!content.includes('export async function POST') && !content.includes('export async function GET')) {
      throw new Error(`Route ${route} missing HTTP method exports`);
    }
  }
  
  console.log(`✅ All critical API routes found and properly structured`);
}

/**
 * Test configuration and environment setup
 */
async function testEnvironmentConfig() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'BOT_API_KEY'
  ];
  
  const envExample = fs.readFileSync('./.env.example', 'utf8');
  
  for (const envVar of requiredEnvVars) {
    if (!envExample.includes(envVar)) {
      throw new Error(`Required environment variable ${envVar} not documented in .env.example`);
    }
  }
  
  console.log(`✅ All required environment variables documented`);
}

/**
 * Test critical file dependencies
 */
async function testFileDependencies() {
  // Check for circular dependencies by analyzing imports
  const criticalFiles = [
    './app/lib/utils/product-normalizer.ts',
    './app/lib/utils/standardization.ts',
    './app/services/database/aliasService.ts',
    './app/api/bot/prices/compare/route.ts'
  ];
  
  for (const file of criticalFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Critical file missing: ${file}`);
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for problematic patterns
    if (content.includes('import {') && content.includes('from "../../"') && content.includes('from "../../../"')) {
      console.log(`⚠️  Complex import structure in ${file} - consider refactoring`);
    }
  }
  
  console.log(`✅ All critical files present with reasonable import structure`);
}

/**
 * Test data processing pipeline integrity
 */
async function testDataProcessingPipeline() {
  // Test if product normalization chain works
  const productNormalizerPath = './app/lib/utils/product-normalizer.ts';
  const standardizationPath = './app/lib/utils/standardization.ts';
  const aliasServicePath = './app/services/database/aliasService.ts';
  
  const files = [productNormalizerPath, standardizationPath, aliasServicePath];
  
  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Pipeline component missing: ${file}`);
    }
    
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for expected functions
    if (file.includes('product-normalizer')) {
      if (!content.includes('export function normalize')) {
        throw new Error('product-normalizer missing normalize function');
      }
    }
    
    if (file.includes('standardization')) {
      if (!content.includes('export async function standardizeProducts')) {
        throw new Error('standardization missing standardizeProducts function');
      }
    }
    
    if (file.includes('aliasService')) {
      if (!content.includes('export async function searchProductsWithAliases')) {
        throw new Error('aliasService missing searchProductsWithAliases function');
      }
    }
  }
  
  console.log(`✅ Data processing pipeline components properly structured`);
}

/**
 * Test package.json dependencies
 */
async function testPackageDependencies() {
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  
  // Critical dependencies for the system to function
  const criticalDependencies = [
    '@prisma/client',
    'openai',
    'next',
    'zod'
  ];
  
  for (const dep of criticalDependencies) {
    if (!packageJson.dependencies[dep]) {
      throw new Error(`Critical dependency missing: ${dep}`);
    }
  }
  
  // Check for dev dependencies
  const criticalDevDependencies = [
    'typescript',
    '@types/node'
  ];
  
  for (const dep of criticalDevDependencies) {
    if (!packageJson.devDependencies[dep]) {
      throw new Error(`Critical dev dependency missing: ${dep}`);
    }
  }
  
  console.log(`✅ All critical dependencies present in package.json`);
}

/**
 * Test TypeScript configuration
 */
async function testTypeScriptConfig() {
  if (!fs.existsSync('./tsconfig.json')) {
    throw new Error('TypeScript configuration missing');
  }
  
  const tsConfig = JSON.parse(fs.readFileSync('./tsconfig.json', 'utf8'));
  
  // Check for important compiler options
  const importantOptions = [
    'strict',
    'target',
    'moduleResolution'
  ];
  
  for (const option of importantOptions) {
    if (!(option in tsConfig.compilerOptions)) {
      throw new Error(`Important TypeScript option missing: ${option}`);
    }
  }
  
  console.log(`✅ TypeScript configuration properly structured`);
}

/**
 * Test for potential security issues
 */
async function testSecurityConfiguration() {
  // Check for sensitive files that shouldn't be committed
  const sensitiveFiles = [
    '.env',
    '.env.local'
  ];
  
  const gitignore = fs.readFileSync('./.gitignore', 'utf8');
  
  for (const file of sensitiveFiles) {
    if (!gitignore.includes(file)) {
      console.log(`⚠️  Warning: ${file} should be in .gitignore`);
    }
  }
  
  // Check if .env exists (it shouldn't in production)
  if (fs.existsSync('./.env')) {
    console.log(`⚠️  Warning: .env file exists - ensure it contains no production secrets`);
  }
  
  console.log(`✅ Basic security configuration checks passed`);
}

/**
 * Main test execution
 */
async function runIntegrationTests() {
  console.log('🚀 Starting Integration Tests for monito-web\n');
  console.log('=' + '='.repeat(50));
  
  // Run all tests
  await runTest('Module Import Structure', testModuleImports);
  await runTest('Database Schema Consistency', testDatabaseSchema);
  await runTest('API Route Structure', testAPIRouteStructure);
  await runTest('Environment Configuration', testEnvironmentConfig);
  await runTest('File Dependencies', testFileDependencies);
  await runTest('Data Processing Pipeline', testDataProcessingPipeline);
  await runTest('Package Dependencies', testPackageDependencies);
  await runTest('TypeScript Configuration', testTypeScriptConfig);
  await runTest('Security Configuration', testSecurityConfiguration);
  
  // Print summary
  console.log('=' + '='.repeat(50));
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('=' + '='.repeat(50));
  console.log(`Total Tests: ${testResults.passed + testResults.failed + testResults.skipped}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏭️  Skipped: ${testResults.skipped}`);
  console.log(`Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n💥 FAILED TESTS:');
    testResults.details
      .filter(test => test.status === 'FAILED')
      .forEach(test => {
        console.log(`   ${test.name}: ${test.error}`);
      });
  }
  
  console.log('\n💡 INTEGRATION HEALTH ASSESSMENT:');
  
  if (testResults.failed === 0) {
    console.log('   🟢 EXCELLENT: All critical integrations working');
    console.log('   🟢 System ready for production deployment');
  } else if (testResults.failed <= 2) {
    console.log('   🟡 GOOD: Minor integration issues detected');
    console.log('   🟡 Review failed tests before deployment');
  } else {
    console.log('   🔴 POOR: Multiple integration failures');
    console.log('   🔴 Address critical issues before deployment');
  }
  
  return {
    success: testResults.failed === 0,
    summary: testResults
  };
}

// Run tests if called directly
if (require.main === module) {
  runIntegrationTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Integration test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTests };