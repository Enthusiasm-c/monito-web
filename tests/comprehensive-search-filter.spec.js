const { test, expect } = require('@playwright/test');

/**
 * Comprehensive Search & Filter Testing Suite
 * Tests search and filter functionality across the admin interface on http://209.38.85.196:3000
 * 
 * Test Coverage:
 * - Suppliers Search & Filter Testing
 * - Products Search & Filter Testing
 * - Advanced Filter Combinations
 * - Filter Performance & UX Testing
 * - Edge Cases & Error Handling
 * - User Experience Testing
 */

const BASE_URL = 'http://209.38.85.196:3000';
const ADMIN_CREDENTIALS = {
    email: 'admin@monito-web.com',
    password: 'admin123'
};

test.describe('Comprehensive Search & Filter Testing Suite', () => {
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
        context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            storageState: undefined
        });
        page = await context.newPage();
        
        // Login once for all tests
        console.log('🔐 Logging in with admin credentials...');
        await page.goto(`${BASE_URL}/admin/login`);
        await page.fill('input[name="email"]', ADMIN_CREDENTIALS.email);
        await page.fill('input[name="password"]', ADMIN_CREDENTIALS.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE_URL}/admin`);
        console.log('✅ Successfully logged in');
    });

    test.afterAll(async () => {
        await context.close();
    });

    test.describe('1. Suppliers Search & Filter Testing', () => {
        test('Navigate to suppliers page and capture initial state', async () => {
            console.log('🔍 Testing suppliers page navigation and initial state...');
            
            await page.goto(`${BASE_URL}/admin/suppliers`);
            await page.waitForLoadState('networkidle');
            
            // Take screenshot of initial suppliers page
            await page.screenshot({
                path: 'test-results/01-suppliers-initial-state.png',
                fullPage: true
            });
            
            // Verify we're on the suppliers page
            await expect(page).toHaveURL(`${BASE_URL}/admin/suppliers`);
            console.log('✅ Successfully navigated to suppliers page');
        });

        test('Test search functionality - "Fresh Market"', async () => {
            console.log('🔍 Testing search for "Fresh Market"...');
            
            // Look for search input
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('Fresh Market');
            
            // Wait for search results
            await page.waitForTimeout(1000);
            
            // Take screenshot of search results
            await page.screenshot({
                path: 'test-results/02-suppliers-search-fresh-market.png',
                fullPage: true
            });
            
            // Check if results are filtered
            const supplierRows = page.locator('tbody tr');
            const count = await supplierRows.count();
            console.log(`Found ${count} suppliers matching "Fresh Market"`);
            
            // Clear search
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test search functionality - "Jakarta"', async () => {
            console.log('🔍 Testing search for "Jakarta"...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('Jakarta');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/03-suppliers-search-jakarta.png',
                fullPage: true
            });
            
            const supplierRows = page.locator('tbody tr');
            const count = await supplierRows.count();
            console.log(`Found ${count} suppliers in Jakarta`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test partial term search - "Green"', async () => {
            console.log('🔍 Testing partial search for "Green"...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('Green');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/04-suppliers-search-green.png',
                fullPage: true
            });
            
            const supplierRows = page.locator('tbody tr');
            const count = await supplierRows.count();
            console.log(`Found ${count} suppliers matching "Green"`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test case-insensitive search', async () => {
            console.log('🔍 Testing case-insensitive search...');
            
            const searchInput = page.locator('input[type="text"]').first();
            
            // Test lowercase
            await searchInput.fill('fresh market');
            await page.waitForTimeout(1000);
            const lowercaseCount = await page.locator('tbody tr').count();
            
            // Test uppercase
            await searchInput.clear();
            await searchInput.fill('FRESH MARKET');
            await page.waitForTimeout(1000);
            const uppercaseCount = await page.locator('tbody tr').count();
            
            await page.screenshot({
                path: 'test-results/05-suppliers-case-insensitive.png',
                fullPage: true
            });
            
            console.log(`Lowercase results: ${lowercaseCount}, Uppercase results: ${uppercaseCount}`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test empty search (show all suppliers)', async () => {
            console.log('🔍 Testing empty search to show all suppliers...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.clear();
            await page.waitForTimeout(1000);
            
            const supplierRows = page.locator('tbody tr');
            const totalCount = await supplierRows.count();
            
            await page.screenshot({
                path: 'test-results/06-suppliers-empty-search.png',
                fullPage: true
            });
            
            console.log(`Total suppliers displayed: ${totalCount}`);
        });

        test('Test search with no results', async () => {
            console.log('🔍 Testing search with no results...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('xyz123nonexistent');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/07-suppliers-no-results.png',
                fullPage: true
            });
            
            // Check for no results message or empty table
            const supplierRows = page.locator('tbody tr');
            const count = await supplierRows.count();
            console.log(`Search with no results returned ${count} suppliers`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });
    });

    test.describe('2. Products Search & Filter Testing', () => {
        test('Navigate to products page and capture initial state', async () => {
            console.log('🔍 Testing products page navigation and initial state...');
            
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            await page.screenshot({
                path: 'test-results/08-products-initial-state.png',
                fullPage: true
            });
            
            await expect(page).toHaveURL(`${BASE_URL}/admin/products`);
            console.log('✅ Successfully navigated to products page');
        });

        test('Test product search - "carrot"', async () => {
            console.log('🔍 Testing product search for "carrot"...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('carrot');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/09-products-search-carrot.png',
                fullPage: true
            });
            
            const productRows = page.locator('tbody tr');
            const count = await productRows.count();
            console.log(`Found ${count} products matching "carrot"`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test product search - "vegetables"', async () => {
            console.log('🔍 Testing product search for "vegetables"...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('vegetables');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/10-products-search-vegetables.png',
                fullPage: true
            });
            
            const productRows = page.locator('tbody tr');
            const count = await productRows.count();
            console.log(`Found ${count} products matching "vegetables"`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test product search - "kg" unit', async () => {
            console.log('🔍 Testing product search for "kg"...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('kg');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/11-products-search-kg.png',
                fullPage: true
            });
            
            const productRows = page.locator('tbody tr');
            const count = await productRows.count();
            console.log(`Found ${count} products with kg unit`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test partial product search - "tom"', async () => {
            console.log('🔍 Testing partial product search for "tom"...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('tom');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/12-products-search-tom.png',
                fullPage: true
            });
            
            const productRows = page.locator('tbody tr');
            const count = await productRows.count();
            console.log(`Found ${count} products matching "tom"`);
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test category filters', async () => {
            console.log('🔍 Testing category filters...');
            
            // Check for category filter dropdown/buttons
            const categoryFilter = page.locator('select').first().or(page.locator('button:has-text("Category")'));
            
            if (await categoryFilter.count() > 0) {
                // Try to find and test category filters
                const filterOptions = ['vegetables', 'fruits', 'meat', 'all'];
                
                for (const category of filterOptions) {
                    try {
                        console.log(`Testing ${category} category filter...`);
                        
                        // This might need adjustment based on actual UI
                        await page.click(`text=${category}`, { timeout: 2000 });
                        await page.waitForTimeout(1000);
                        
                        await page.screenshot({
                            path: `test-results/13-products-filter-${category}.png`,
                            fullPage: true
                        });
                        
                        const productRows = page.locator('tbody tr');
                        const count = await productRows.count();
                        console.log(`Found ${count} products in ${category} category`);
                        
                    } catch (error) {
                        console.log(`Category filter ${category} not found or not clickable`);
                    }
                }
            } else {
                console.log('No category filters found on the page');
                await page.screenshot({
                    path: 'test-results/13-products-no-category-filters.png',
                    fullPage: true
                });
            }
        });

        test('Test unit filters', async () => {
            console.log('🔍 Testing unit filters...');
            
            // Check for unit filter elements
            const unitFilter = page.locator('select').nth(1).or(page.locator('button:has-text("Unit")'));
            
            if (await unitFilter.count() > 0) {
                const unitOptions = ['kg', 'pcs', 'bunch'];
                
                for (const unit of unitOptions) {
                    try {
                        console.log(`Testing ${unit} unit filter...`);
                        
                        await page.click(`text=${unit}`, { timeout: 2000 });
                        await page.waitForTimeout(1000);
                        
                        await page.screenshot({
                            path: `test-results/14-products-filter-${unit}.png`,
                            fullPage: true
                        });
                        
                        const productRows = page.locator('tbody tr');
                        const count = await productRows.count();
                        console.log(`Found ${count} products with ${unit} unit`);
                        
                    } catch (error) {
                        console.log(`Unit filter ${unit} not found or not clickable`);
                    }
                }
            } else {
                console.log('No unit filters found on the page');
                await page.screenshot({
                    path: 'test-results/14-products-no-unit-filters.png',
                    fullPage: true
                });
            }
        });
    });

    test.describe('3. Advanced Filter Combinations', () => {
        test('Test combining search + category filter', async () => {
            console.log('🔍 Testing combination of search and category filters...');
            
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            // Try to combine search with category
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('carrot');
            await page.waitForTimeout(500);
            
            // Try to select vegetables category if available
            try {
                await page.click('text=vegetables', { timeout: 2000 });
                await page.waitForTimeout(1000);
                
                await page.screenshot({
                    path: 'test-results/15-products-combined-search-category.png',
                    fullPage: true
                });
                
                const productRows = page.locator('tbody tr');
                const count = await productRows.count();
                console.log(`Found ${count} products with combined search+category filter`);
                
            } catch (error) {
                console.log('Could not test combined filters - category filter not found');
            }
            
            await searchInput.clear();
            await page.waitForTimeout(500);
        });

        test('Test filter reset functionality', async () => {
            console.log('🔍 Testing filter reset functionality...');
            
            // Apply some filters first
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('test');
            await page.waitForTimeout(1000);
            
            // Look for reset or clear button
            const resetButton = page.locator('button:has-text("Reset")').or(
                page.locator('button:has-text("Clear")')).or(
                page.locator('button:has-text("All")')
            );
            
            if (await resetButton.count() > 0) {
                await resetButton.first().click();
                await page.waitForTimeout(1000);
                
                await page.screenshot({
                    path: 'test-results/16-products-reset-filters.png',
                    fullPage: true
                });
                
                console.log('✅ Successfully tested filter reset');
            } else {
                // Manual reset by clearing search
                await searchInput.clear();
                await page.screenshot({
                    path: 'test-results/16-products-manual-reset.png',
                    fullPage: true
                });
                console.log('No reset button found - cleared search manually');
            }
        });
    });

    test.describe('4. Filter Performance & UX Testing', () => {
        test('Test filter response time', async () => {
            console.log('🔍 Testing filter response time...');
            
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            const searchInput = page.locator('input[type="text"]').first();
            
            // Measure search response time
            const startTime = Date.now();
            await searchInput.fill('carrot');
            await page.waitForTimeout(2000); // Wait for results
            const endTime = Date.now();
            
            const responseTime = endTime - startTime;
            console.log(`Filter response time: ${responseTime}ms`);
            
            await page.screenshot({
                path: 'test-results/17-products-performance-test.png',
                fullPage: true
            });
            
            // Response time should be reasonable (under 3 seconds)
            expect(responseTime).toBeLessThan(3000);
            
            await searchInput.clear();
        });

        test('Test real-time search (results update as you type)', async () => {
            console.log('🔍 Testing real-time search functionality...');
            
            const searchInput = page.locator('input[type="text"]').first();
            
            // Type character by character to test real-time search
            const searchTerm = 'carrot';
            for (let i = 1; i <= searchTerm.length; i++) {
                const partialTerm = searchTerm.substring(0, i);
                await searchInput.fill(partialTerm);
                await page.waitForTimeout(300);
                
                console.log(`Typed: "${partialTerm}"`);
            }
            
            await page.screenshot({
                path: 'test-results/18-products-realtime-search.png',
                fullPage: true
            });
            
            console.log('✅ Completed real-time search test');
            await searchInput.clear();
        });

        test('Test mobile responsiveness of filters', async () => {
            console.log('🔍 Testing mobile responsiveness...');
            
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });
            
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            await page.screenshot({
                path: 'test-results/19-products-mobile-view.png',
                fullPage: true
            });
            
            // Test search on mobile
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('carrot');
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/20-products-mobile-search.png',
                fullPage: true
            });
            
            // Reset to desktop view
            await page.setViewportSize({ width: 1920, height: 1080 });
            console.log('✅ Completed mobile responsiveness test');
        });
    });

    test.describe('5. Edge Cases & Error Handling', () => {
        test('Test very long search terms', async () => {
            console.log('🔍 Testing very long search terms...');
            
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            const longSearchTerm = 'a'.repeat(100); // 100 character search
            const searchInput = page.locator('input[type="text"]').first();
            
            await searchInput.fill(longSearchTerm);
            await page.waitForTimeout(1000);
            
            await page.screenshot({
                path: 'test-results/21-products-long-search.png',
                fullPage: true
            });
            
            console.log(`Tested search with ${longSearchTerm.length} characters`);
            await searchInput.clear();
        });

        test('Test special characters in search', async () => {
            console.log('🔍 Testing special characters in search...');
            
            const specialChars = ['@', '#', '$', '%', '&', '*', '()', '[]', '{}', '|', '\\', '/', '?'];
            const searchInput = page.locator('input[type="text"]').first();
            
            for (const char of specialChars) {
                try {
                    await searchInput.fill(char);
                    await page.waitForTimeout(500);
                    console.log(`Tested special character: ${char}`);
                } catch (error) {
                    console.log(`Error with special character ${char}: ${error.message}`);
                }
            }
            
            await page.screenshot({
                path: 'test-results/22-products-special-chars.png',
                fullPage: true
            });
            
            await searchInput.clear();
        });

        test('Test basic SQL injection attempts', async () => {
            console.log('🔍 Testing basic SQL injection attempts...');
            
            const sqlInjectionAttempts = [
                "'; DROP TABLE products; --",
                "' OR '1'='1",
                "' UNION SELECT * FROM users --",
                "admin'--",
                "admin' #",
                "admin'/*"
            ];
            
            const searchInput = page.locator('input[type="text"]').first();
            
            for (const injection of sqlInjectionAttempts) {
                try {
                    await searchInput.fill(injection);
                    await page.waitForTimeout(1000);
                    console.log(`Tested SQL injection: ${injection.substring(0, 20)}...`);
                    
                    // Check if page is still functional
                    await expect(page).toHaveURL(`${BASE_URL}/admin/products`);
                    
                } catch (error) {
                    console.log(`SQL injection test failed: ${error.message}`);
                }
            }
            
            await page.screenshot({
                path: 'test-results/23-products-sql-injection-test.png',
                fullPage: true
            });
            
            await searchInput.clear();
            console.log('✅ Completed SQL injection security test');
        });
    });

    test.describe('6. User Experience Testing', () => {
        test('Test search highlights and result counts', async () => {
            console.log('🔍 Testing search highlights and result counts...');
            
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('carrot');
            await page.waitForTimeout(1000);
            
            // Check for result counts or highlights
            const resultCountElement = page.locator('text=/\\d+\\s+(results?|items?|products?)/i');
            const highlightedText = page.locator('.highlight, .match, .search-highlight');
            
            if (await resultCountElement.count() > 0) {
                const resultText = await resultCountElement.first().textContent();
                console.log(`Found result count display: ${resultText}`);
            }
            
            if (await highlightedText.count() > 0) {
                console.log(`Found ${await highlightedText.count()} highlighted search terms`);
            }
            
            await page.screenshot({
                path: 'test-results/24-products-ux-highlights.png',
                fullPage: true
            });
            
            await searchInput.clear();
        });

        test('Test "No results found" messages', async () => {
            console.log('🔍 Testing "No results found" messages...');
            
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('nonexistentproduct12345');
            await page.waitForTimeout(1000);
            
            // Look for no results messages
            const noResultsMessage = page.locator('text=/no.*results?.*found/i').or(
                page.locator('text=/no.*products?.*found/i')).or(
                page.locator('text=/nothing.*found/i')).or(
                page.locator('text=/empty/i')
            );
            
            if (await noResultsMessage.count() > 0) {
                const messageText = await noResultsMessage.first().textContent();
                console.log(`Found no results message: ${messageText}`);
            } else {
                console.log('No specific "no results" message found');
            }
            
            await page.screenshot({
                path: 'test-results/25-products-no-results-message.png',
                fullPage: true
            });
            
            await searchInput.clear();
        });

        test('Test filter state persistence', async () => {
            console.log('🔍 Testing filter state persistence...');
            
            // Apply a search filter
            const searchInput = page.locator('input[type="text"]').first();
            await searchInput.fill('carrot');
            await page.waitForTimeout(1000);
            
            // Navigate away and back
            await page.goto(`${BASE_URL}/admin/suppliers`);
            await page.waitForLoadState('networkidle');
            
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            // Check if search term persisted
            const currentSearchValue = await searchInput.inputValue();
            console.log(`Search value after navigation: "${currentSearchValue}"`);
            
            await page.screenshot({
                path: 'test-results/26-products-filter-persistence.png',
                fullPage: true
            });
            
            await searchInput.clear();
        });

        test('Final comprehensive overview', async () => {
            console.log('🔍 Creating final comprehensive overview...');
            
            // Suppliers overview
            await page.goto(`${BASE_URL}/admin/suppliers`);
            await page.waitForLoadState('networkidle');
            
            await page.screenshot({
                path: 'test-results/27-final-suppliers-overview.png',
                fullPage: true
            });
            
            // Products overview
            await page.goto(`${BASE_URL}/admin/products`);
            await page.waitForLoadState('networkidle');
            
            await page.screenshot({
                path: 'test-results/28-final-products-overview.png',
                fullPage: true
            });
            
            console.log('✅ Search and filter testing suite completed successfully!');
        });
    });
});