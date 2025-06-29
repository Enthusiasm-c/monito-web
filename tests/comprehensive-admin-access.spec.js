const { test, expect } = require('@playwright/test');

test.describe('Comprehensive Admin Interface Access Testing', () => {
  
  test('Test direct access to all admin pages', async ({ page }) => {
    console.log('Testing access to all admin pages...');
    
    const adminPages = [
      { path: '/admin', name: 'Admin Dashboard' },
      { path: '/admin/suppliers', name: 'Suppliers Management' },
      { path: '/admin/products', name: 'Products Management' },
      { path: '/admin/uploads', name: 'Uploads Management' },
      { path: '/admin/unmatched', name: 'Unmatched Products' },
      { path: '/admin/preview', name: 'Preview' }
    ];
    
    const pageResults = {};
    
    for (const adminPage of adminPages) {
      console.log(`Testing access to: ${adminPage.path}`);
      
      try {
        await page.goto(adminPage.path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Take screenshot
        const screenshotPath = `test-results/admin-page-${adminPage.path.replace(/\//g, '-')}.png`;
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });
        
        // Get page information
        const pageTitle = await page.title();
        const currentUrl = page.url();
        const hasErrorMessage = await page.locator('text*="Error"').isVisible().catch(() => false);
        const errorText = hasErrorMessage ? await page.locator('text*="Error"').textContent() : null;
        
        // Check for common elements
        const hasNavigation = await page.locator('nav').isVisible().catch(() => false);
        const hasSignOutButton = await page.locator('button:has-text("Sign Out")').isVisible().catch(() => false);
        const hasLoadingSpinner = await page.locator('[class*="spin"], [class*="loading"]').isVisible().catch(() => false);
        
        // Get headings
        const headings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);
        
        // Get buttons
        const buttons = await page.locator('button').allTextContents().catch(() => []);
        
        // Check for data tables
        const tableCount = await page.locator('table').count().catch(() => 0);
        
        // Save page content for analysis
        const pageContent = await page.content();
        require('fs').writeFileSync(`test-results/admin-content-${adminPage.path.replace(/\//g, '-')}.html`, pageContent);
        
        pageResults[adminPage.path] = {
          name: adminPage.name,
          accessed: true,
          pageTitle,
          currentUrl,
          hasErrorMessage,
          errorText,
          hasNavigation,
          hasSignOutButton,
          hasLoadingSpinner,
          headings,
          buttons,
          tableCount,
          timestamp: new Date().toISOString()
        };
        
        console.log(`✓ ${adminPage.path}: ${hasErrorMessage ? 'ERROR - ' + errorText : 'ACCESSIBLE'}`);
        
      } catch (error) {
        console.log(`✗ ${adminPage.path}: FAILED - ${error.message}`);
        pageResults[adminPage.path] = {
          name: adminPage.name,
          accessed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Save comprehensive results
    require('fs').writeFileSync('test-results/admin-pages-analysis.json', JSON.stringify(pageResults, null, 2));
    
    console.log('\\nAdmin Pages Access Summary:');
    for (const [path, result] of Object.entries(pageResults)) {
      if (result.accessed) {
        console.log(`${path}: ${result.hasErrorMessage ? '❌ ' + result.errorText : '✅ Accessible'}`);
      } else {
        console.log(`${path}: ❌ Failed to load`);
      }
    }
  });
  
  test('Test suppliers page functionality when working', async ({ page }) => {
    console.log('Testing suppliers page functionality...');
    
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check if there's an error first
    const hasError = await page.locator('text*="Error"').isVisible().catch(() => false);
    
    if (hasError) {
      console.log('Suppliers page has error, trying to fix it...');
      
      // Try clicking "Try Again" button
      const tryAgainButton = page.locator('button:has-text("Try Again")');
      if (await tryAgainButton.isVisible()) {
        console.log('Clicking Try Again button...');
        await tryAgainButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'test-results/suppliers-after-retry.png', fullPage: true });
        
        // Check if error is gone
        const stillHasError = await page.locator('text*="Error"').isVisible().catch(() => false);
        if (!stillHasError) {
          console.log('Error resolved! Checking page content...');
          
          // Now test the working functionality
          await testSuppliersPageContent(page);
        } else {
          console.log('Error persists after retry');
        }
      }
    } else {
      console.log('No error detected, testing normal functionality...');
      await testSuppliersPageContent(page);
    }
  });
  
  test('Check authentication state and session', async ({ page }) => {
    console.log('Checking authentication state...');
    
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for authentication indicators
    const hasSignOut = await page.locator('button:has-text("Sign Out")').isVisible().catch(() => false);
    const hasLoginForm = await page.locator('input[type="password"]').isVisible().catch(() => false);
    const hasAdminNav = await page.locator('text="Monito Admin"').isVisible().catch(() => false);
    
    console.log(`Has Sign Out button: ${hasSignOut}`);
    console.log(`Has Login form: ${hasLoginForm}`);
    console.log(`Has Admin navigation: ${hasAdminNav}`);
    
    // Check cookies and localStorage
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('session') ||
      cookie.name.includes('token')
    );
    
    console.log(`Authentication cookies found: ${authCookies.length}`);
    authCookies.forEach(cookie => {
      console.log(`- ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
    });
    
    // Check localStorage
    const localStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        items[key] = window.localStorage.getItem(key);
      }
      return items;
    });
    
    console.log('LocalStorage items:', Object.keys(localStorage));
    
    const authState = {
      hasSignOut,
      hasLoginForm,
      hasAdminNav,
      authCookies: authCookies.map(c => ({ name: c.name, domain: c.domain, path: c.path })),
      localStorage,
      currentUrl: page.url(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      timestamp: new Date().toISOString()
    };
    
    require('fs').writeFileSync('test-results/auth-state-analysis.json', JSON.stringify(authState, null, 2));
  });
  
  test('Test admin navigation and routing', async ({ page }) => {
    console.log('Testing admin navigation...');
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/admin-dashboard.png', fullPage: true });
    
    // Test navigation links
    const navLinks = [
      { selector: 'a[href="/admin/products"]', name: 'Products' },
      { selector: 'a[href="/admin/suppliers"]', name: 'Suppliers' },
      { selector: 'a[href="/admin/uploads"]', name: 'Uploads' }
    ];
    
    for (const link of navLinks) {
      console.log(`Testing navigation to ${link.name}...`);
      
      const linkElement = page.locator(link.selector);
      if (await linkElement.isVisible()) {
        await linkElement.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        console.log(`Navigated to: ${currentUrl}`);
        
        await page.screenshot({ 
          path: `test-results/nav-to-${link.name.toLowerCase()}.png`,
          fullPage: true 
        });
        
        // Go back to admin dashboard for next test
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      } else {
        console.log(`❌ ${link.name} navigation link not found`);
      }
    }
  });
});

async function testSuppliersPageContent(page) {
  console.log('Testing suppliers page content...');
  
  // Look for expected elements
  const elements = {
    addButton: 'button:has-text("Add"), button:has-text("Create"), button:has-text("New")',
    searchInput: 'input[type="search"], input[placeholder*="search" i]',
    table: 'table',
    suppliersHeading: 'h1:has-text("Supplier"), h2:has-text("Supplier"), h3:has-text("Supplier")'
  };
  
  for (const [name, selector] of Object.entries(elements)) {
    const isVisible = await page.locator(selector).isVisible().catch(() => false);
    console.log(`${name}: ${isVisible ? '✅ Found' : '❌ Not found'}`);
  }
  
  // Check for table content
  const tables = await page.locator('table').count();
  if (tables > 0) {
    console.log(`Found ${tables} table(s)`);
    
    const firstTable = page.locator('table').first();
    const rowCount = await firstTable.locator('tbody tr').count().catch(() => 0);
    console.log(`Table has ${rowCount} data rows`);
    
    if (rowCount > 0) {
      // Get sample data
      const firstRowCells = await firstTable.locator('tbody tr').first().locator('td').allTextContents().catch(() => []);
      console.log('Sample row data:', firstRowCells);
    }
  }
  
  await page.screenshot({ path: 'test-results/suppliers-working-state.png', fullPage: true });
}