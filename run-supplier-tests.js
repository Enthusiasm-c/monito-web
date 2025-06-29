#!/usr/bin/env node

/**
 * Supplier CRUD Test Runner
 * 
 * This script runs the comprehensive supplier CRUD tests using Playwright.
 * It provides an easy way to execute all tests and generate reports.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure test-results directory exists
const testResultsDir = path.join(__dirname, 'test-results');
if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
}

console.log('🚀 Starting Comprehensive Supplier CRUD Tests');
console.log('='.repeat(50));

// Configuration
const testOptions = {
    headed: process.argv.includes('--headed') || process.argv.includes('-h'),
    debug: process.argv.includes('--debug') || process.argv.includes('-d'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

// Build command
let command = 'npx playwright test tests/comprehensive-supplier-crud.spec.js';

if (testOptions.headed) {
    command += ' --headed';
    console.log('🖥️  Running in headed mode (browser visible)');
}

if (testOptions.debug) {
    command += ' --debug';
    console.log('🐛 Running in debug mode');
}

if (testOptions.verbose) {
    command += ' --reporter=list';
    console.log('📝 Verbose output enabled');
}

console.log(`📋 Command: ${command}`);
console.log('⏳ Starting test execution...\n');

// Execute the tests
const testProcess = spawn(command, {
    shell: true,
    stdio: 'inherit',
    cwd: __dirname
});

testProcess.on('close', (code) => {
    console.log('\n' + '='.repeat(50));
    
    if (code === 0) {
        console.log('✅ All tests completed successfully!');
        console.log('\n📊 Test Results Summary:');
        console.log('  📸 Screenshots saved in: ./test-results/');
        console.log('  📄 HTML Report: ./test-results/html-report/index.html');
        console.log('  📋 JSON Results: ./test-results/results.json');
        
        console.log('\n🔍 Key Test Areas Covered:');
        console.log('  ✓ Authentication & Navigation');
        console.log('  ✓ READ Operations (list display, pagination)');
        console.log('  ✓ CREATE Operations (add new supplier)');
        console.log('  ✓ UPDATE Operations (edit existing supplier)');
        console.log('  ✓ DELETE Operations (remove supplier)');
        console.log('  ✓ Error Handling & Validation');
        console.log('  ✓ Search & Filter functionality');
        
        console.log('\n📸 Screenshots generated:');
        const screenshots = [
            '01-login-page.png',
            '02-credentials-filled.png',
            '03-after-login.png',
            '04-suppliers-page.png',
            '05-suppliers-list.png',
            '06-supplier-data-fields.png',
            '07-pagination-test.png',
            '08-complete-suppliers-overview.png',
            '09-add-supplier-opened.png',
            '10-form-filled.png',
            '11-after-submit.png',
            '12-updated-suppliers-list.png',
            '13-edit-form-opened.png',
            '14-fields-edited.png',
            '15-after-save.png',
            '16-inline-editing.png',
            '17-delete-confirmation.png',
            '18-after-deletion.png',
            '19-list-after-deletion.png',
            '20-validation-errors.png',
            '21-duplicate-test.png',
            '22-email-validation.png',
            '23-search-results.png',
            '24-filter-options.png',
            '25-final-state.png',
            '26-final-overview.png'
        ];
        
        screenshots.forEach((screenshot, index) => {
            console.log(`    ${(index + 1).toString().padStart(2, '0')}. ${screenshot}`);
        });
        
    } else {
        console.log(`❌ Tests failed with exit code: ${code}`);
        console.log('\n🔧 Troubleshooting Tips:');
        console.log('  1. Ensure the server is running at http://209.38.85.196:3000');
        console.log('  2. Verify admin credentials are correct');
        console.log('  3. Check network connectivity');
        console.log('  4. Review screenshots in ./test-results/ for visual debugging');
        console.log('  5. Use --headed flag to see browser actions');
        console.log('  6. Use --debug flag for step-by-step debugging');
    }
    
    console.log('\n📚 Usage Examples:');
    console.log('  node run-supplier-tests.js          # Run headless');
    console.log('  node run-supplier-tests.js --headed # Run with visible browser');
    console.log('  node run-supplier-tests.js --debug  # Run in debug mode');
    console.log('  node run-supplier-tests.js -v       # Verbose output');
    
    console.log('\n🏁 Test execution completed!');
});

testProcess.on('error', (error) => {
    console.error('❌ Failed to start test process:', error);
    console.log('\n💡 Make sure Playwright is installed:');
    console.log('  npm install --save-dev @playwright/test');
    console.log('  npx playwright install');
});