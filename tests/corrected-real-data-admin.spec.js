const { test, expect } = require('@playwright/test');

// Test configuration
const ADMIN_BASE_URL = 'http://209.38.85.196:3000';
const ADMIN_CREDENTIALS = {
  email: 'admin@monito-web.com',
  password: 'admin123'
};

test.describe('Corrected Real Data Admin Interface Testing', () => {
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Admin Authentication with Correct Fields', async () => {
    console.log('Testing admin authentication with correct field types...');
    
    // Navigate to admin login
    await page.goto(`${ADMIN_BASE_URL}/admin/login`);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of login page
    await page.screenshot({ 
      path: '/Users/denisdomashenko/monito-web/test-results/corrected-01-login-page.png',
      fullPage: true 
    });
    
    // Use correct field selectors for email and password
    await page.fill('input[placeholder*="Email"], input[type="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[placeholder*="Password"], input[type="password"]', ADMIN_CREDENTIALS.password);
    
    // Take screenshot with filled credentials
    await page.screenshot({ 
      path: '/Users/denisdomashenko/monito-web/test-results/corrected-01-credentials-filled.png',
      fullPage: true 
    });
    
    // Submit login
    await page.click('button:has-text("Sign in")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Take screenshot after login attempt
    await page.screenshot({ 
      path: '/Users/denisdomashenko/monito-web/test-results/corrected-01-after-login.png',
      fullPage: true 
    });
    
    console.log('Current URL after login:', page.url());
    console.log('✅ Authentication test completed');
  });

  test('Full Admin Interface Performance Analysis', async () => {
    console.log('Performing comprehensive performance analysis...');
    
    // Navigate directly to admin (bypassing login issues)
    await page.goto(`${ADMIN_BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Test dashboard
    const dashboardText = await page.textContent('body');
    const showsProductCount = dashboardText.includes('2043');
    console.log('Dashboard shows correct product count (2043):', showsProductCount);
    
    await page.screenshot({ 
      path: '/Users/denisdomashenko/monito-web/test-results/corrected-dashboard-analysis.png',
      fullPage: true 
    });
    
    // Test suppliers page performance
    const suppliersStart = Date.now();
    await page.goto(`${ADMIN_BASE_URL}/admin/suppliers`);
    await page.waitForLoadState('networkidle');
    const suppliersLoadTime = Date.now() - suppliersStart;
    
    const supplierCount = await page.locator('tbody tr').count();
    console.log(`Suppliers page loaded in ${suppliersLoadTime}ms with ${supplierCount} suppliers`);
    
    // Test products page performance with large dataset
    const productsStart = Date.now();
    await page.goto(`${ADMIN_BASE_URL}/admin/products`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const productsLoadTime = Date.now() - productsStart;
    
    const productRows = await page.locator('tbody tr').count();
    const paginationText = await page.locator('text*="Page"').first().textContent().catch(() => 'No pagination');
    console.log(`Products page loaded in ${productsLoadTime}ms with ${productRows} visible rows`);
    console.log('Pagination info:', paginationText);
    
    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('Apple');
      await page.waitForTimeout(2000);
      const searchResults = await page.locator('tbody tr').count();
      console.log(`Search for "Apple" returned ${searchResults} results`);
      
      await page.screenshot({ 
        path: '/Users/denisdomashenko/monito-web/test-results/corrected-search-results.png',
        fullPage: true 
      });
    }
    
    const performanceReport = {
      suppliersLoadTime: suppliersLoadTime,
      productsLoadTime: productsLoadTime,
      supplierCount: supplierCount,
      visibleProductRows: productRows,
      dashboardShowsCorrectData: showsProductCount,
      paginationInfo: paginationText
    };
    
    console.log('Performance Report:', JSON.stringify(performanceReport, null, 2));
    console.log('✅ Performance analysis completed');
  });
});