const { test, expect } = require('@playwright/test');

test.describe('Direct Admin Access Testing (Authentication Bypassed)', () => {
  
  test('Navigate directly to suppliers page and verify interface structure', async ({ page }) => {
    console.log('Testing direct access to /admin/suppliers...');
    
    // Navigate directly to suppliers page
    await page.goto('/admin/suppliers');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test-results/01-direct-suppliers-access.png',
      fullPage: true 
    });
    
    console.log('Page loaded, checking if we have direct access...');
    
    // Check if we're redirected to login or if we have direct access
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Save page content for analysis
    const pageContent = await page.content();
    require('fs').writeFileSync('test-results/suppliers-page-content.html', pageContent);
    
    // Check for various possible states
    const isLoginPage = await page.locator('input[type="password"]').isVisible().catch(() => false);
    const hasSupplierTitle = await page.locator('h1, h2, h3').filter({ hasText: /supplier/i }).isVisible().catch(() => false);
    const hasAddButton = await page.locator('button').filter({ hasText: /add/i }).isVisible().catch(() => false);
    
    console.log(`Is login page: ${isLoginPage}`);
    console.log(`Has supplier title: ${hasSupplierTitle}`);
    console.log(`Has add button: ${hasAddButton}`);
    
    if (isLoginPage) {
      console.log('Authentication is still required, documenting login page structure...');
      
      // Document login page structure
      const loginElements = await page.locator('input, button, form').all();
      console.log(`Found ${loginElements.length} form elements on login page`);
      
      // Try to fill and submit if it's a login form
      const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /sign|login|submit/i });
      
      if (await emailInput.isVisible() && await passwordInput.isVisible()) {
        console.log('Attempting to login with test credentials...');
        await emailInput.fill('admin@monito.com');
        await passwordInput.fill('password');
        await page.screenshot({ path: 'test-results/02-login-filled.png' });
        
        await submitButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        await page.screenshot({ path: 'test-results/03-after-login-attempt.png' });
        
        // Check if login was successful
        const newUrl = page.url();
        console.log(`URL after login attempt: ${newUrl}`);
        
        if (newUrl.includes('/admin/suppliers') || newUrl.includes('/admin')) {
          console.log('Login successful! Now checking suppliers page...');
        }
      }
    }
    
    // Now check the actual suppliers page content
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'test-results/04-suppliers-page-final.png',
      fullPage: true 
    });
    
    // Document all elements on the page
    console.log('Documenting page structure...');
    
    // Check for page title
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    // Look for main headings
    const headings = await page.locator('h1, h2, h3, h4').allTextContents();
    console.log('Page headings:', headings);
    
    // Look for buttons
    const buttons = await page.locator('button').allTextContents();
    console.log('Buttons found:', buttons);
    
    // Look for tables
    const tables = await page.locator('table').count();
    console.log(`Tables found: ${tables}`);
    
    if (tables > 0) {
      // Get table headers
      const tableHeaders = await page.locator('th').allTextContents();
      console.log('Table headers:', tableHeaders);
      
      // Count table rows
      const tableRows = await page.locator('tbody tr').count();
      console.log(`Table rows: ${tableRows}`);
    }
    
    // Look for search functionality
    const searchInputs = await page.locator('input[type="search"], input[placeholder*="search" i]').count();
    console.log(`Search inputs found: ${searchInputs}`);
    
    // Look for Add Supplier button specifically
    const addSupplierButton = page.locator('button').filter({ hasText: /add.*supplier/i });
    const hasAddSupplierButton = await addSupplierButton.isVisible().catch(() => false);
    console.log(`Add Supplier button visible: ${hasAddSupplierButton}`);
    
    // Save detailed element information
    const elementInfo = {
      pageTitle,
      headings,
      buttons,
      tables,
      searchInputs,
      hasAddSupplierButton,
      url: page.url(),
      timestamp: new Date().toISOString()
    };
    
    require('fs').writeFileSync('test-results/suppliers-page-structure.json', JSON.stringify(elementInfo, null, 2));
  });
  
  test('Test Add Supplier button functionality', async ({ page }) => {
    console.log('Testing Add Supplier functionality...');
    
    // Navigate to suppliers page
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to find and click Add Supplier button
    const addSupplierButton = page.locator('button').filter({ hasText: /add.*supplier/i }).first();
    const isVisible = await addSupplierButton.isVisible().catch(() => false);
    
    console.log(`Add Supplier button visible: ${isVisible}`);
    
    if (isVisible) {
      console.log('Clicking Add Supplier button...');
      await addSupplierButton.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'test-results/05-add-supplier-clicked.png' });
      
      // Check for modal or form
      const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
      const hasModal = await modal.isVisible().catch(() => false);
      console.log(`Modal appeared: ${hasModal}`);
      
      if (hasModal) {
        // Document modal structure
        const modalContent = await modal.textContent();
        console.log('Modal content preview:', modalContent?.substring(0, 200));
        
        // Look for form fields
        const formFields = await modal.locator('input, select, textarea').count();
        console.log(`Form fields in modal: ${formFields}`);
        
        // Get field labels/placeholders
        const inputs = await modal.locator('input').all();
        for (let i = 0; i < inputs.length; i++) {
          const placeholder = await inputs[i].getAttribute('placeholder');
          const name = await inputs[i].getAttribute('name');
          const type = await inputs[i].getAttribute('type');
          console.log(`Input ${i + 1}: name="${name}", type="${type}", placeholder="${placeholder}"`);
        }
        
        await page.screenshot({ 
          path: 'test-results/06-add-supplier-modal.png',
          fullPage: true 
        });
      }
      
      // Check if it's a separate page instead
      const currentUrl = page.url();
      if (currentUrl.includes('/add') || currentUrl.includes('/create')) {
        console.log('Navigated to separate add page');
        await page.screenshot({ 
          path: 'test-results/06-add-supplier-page.png',
          fullPage: true 
        });
      }
    } else {
      console.log('Add Supplier button not found. Checking alternative selectors...');
      
      // Try alternative selectors
      const altButtons = [
        'button:has-text("Add")',
        'button:has-text("Create")',
        'button:has-text("New")',
        '[data-testid*="add"]',
        '[class*="add"]'
      ];
      
      for (const selector of altButtons) {
        const button = page.locator(selector);
        const count = await button.count();
        if (count > 0) {
          console.log(`Found alternative button with selector: ${selector}`);
          const text = await button.first().textContent();
          console.log(`Button text: ${text}`);
        }
      }
    }
  });
  
  test('Verify suppliers table content and structure', async ({ page }) => {
    console.log('Verifying suppliers table...');
    
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for tables
    const tables = await page.locator('table').count();
    console.log(`Tables found: ${tables}`);
    
    if (tables > 0) {
      // Check first table
      const table = page.locator('table').first();
      
      // Get headers
      const headers = await table.locator('th').allTextContents();
      console.log('Table headers:', headers);
      
      // Get data rows
      const dataRows = await table.locator('tbody tr').count();
      console.log(`Data rows: ${dataRows}`);
      
      if (dataRows > 0) {
        // Get first few rows of data
        for (let i = 0; i < Math.min(5, dataRows); i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td').allTextContents();
          console.log(`Row ${i + 1}:`, cells);
        }
        
        // Check for expected test suppliers
        const tableText = await table.textContent();
        const testSuppliers = ['Test Supplier', 'Demo Supplier', 'Sample Supplier'];
        const foundSuppliers = testSuppliers.filter(supplier => 
          tableText?.includes(supplier)
        );
        console.log('Found test suppliers:', foundSuppliers);
      }
      
      await page.screenshot({ 
        path: 'test-results/07-suppliers-table.png',
        clip: await table.boundingBox() 
      });
    } else {
      console.log('No tables found. Checking for alternative data display...');
      
      // Look for cards or lists
      const cards = await page.locator('[class*="card"], [class*="item"]').count();
      console.log(`Cards/items found: ${cards}`);
      
      if (cards > 0) {
        await page.screenshot({ path: 'test-results/07-suppliers-cards.png' });
      }
    }
  });
  
  test('Check search functionality', async ({ page }) => {
    console.log('Testing search functionality...');
    
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for search inputs
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="search" i]',
      'input[name*="search" i]',
      '[data-testid*="search"]'
    ];
    
    let searchInput = null;
    for (const selector of searchSelectors) {
      const input = page.locator(selector);
      if (await input.isVisible().catch(() => false)) {
        searchInput = input;
        console.log(`Found search input with selector: ${selector}`);
        break;
      }
    }
    
    if (searchInput) {
      console.log('Testing search functionality...');
      
      // Test search
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'test-results/08-search-test.png' });
      
      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'test-results/09-search-cleared.png' });
    } else {
      console.log('No search functionality found');
    }
  });
  
  test('Document complete page selectors for testing', async ({ page }) => {
    console.log('Documenting complete page structure for future tests...');
    
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Get all interactive elements
    const selectors = {
      buttons: await page.locator('button').all(),
      inputs: await page.locator('input').all(),
      links: await page.locator('a').all(),
      tables: await page.locator('table').all(),
      forms: await page.locator('form').all()
    };
    
    const selectorMap = {};
    
    // Document buttons
    selectorMap.buttons = [];
    for (let i = 0; i < selectors.buttons.length; i++) {
      const button = selectors.buttons[i];
      const text = await button.textContent();
      const classes = await button.getAttribute('class');
      const id = await button.getAttribute('id');
      const dataTestId = await button.getAttribute('data-testid');
      
      selectorMap.buttons.push({
        index: i,
        text: text?.trim(),
        classes,
        id,
        dataTestId,
        boundingBox: await button.boundingBox()
      });
    }
    
    // Document inputs
    selectorMap.inputs = [];
    for (let i = 0; i < selectors.inputs.length; i++) {
      const input = selectors.inputs[i];
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const classes = await input.getAttribute('class');
      const id = await input.getAttribute('id');
      
      selectorMap.inputs.push({
        index: i,
        type,
        name,
        placeholder,
        classes,
        id,
        boundingBox: await input.boundingBox()
      });
    }
    
    // Document links
    selectorMap.links = [];
    for (let i = 0; i < Math.min(10, selectors.links.length); i++) {
      const link = selectors.links[i];
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      
      selectorMap.links.push({
        index: i,
        href,
        text: text?.trim()
      });
    }
    
    // Save selector map
    require('fs').writeFileSync('test-results/suppliers-page-selectors.json', JSON.stringify(selectorMap, null, 2));
    
    console.log('Selector documentation complete');
    console.log(`Found: ${selectorMap.buttons.length} buttons, ${selectorMap.inputs.length} inputs, ${selectorMap.links.length} links`);
  });
});