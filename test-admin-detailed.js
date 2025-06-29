const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down actions to see what's happening
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('=== MONITO WEB ADMIN PANEL TEST ===\n');
    
    // 1. Navigate to admin suppliers page
    console.log('1. Navigating to admin suppliers page...');
    const response = await page.goto('http://209.38.85.196:3000/admin/suppliers', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    console.log(`Response status: ${response.status()}`);
    
    await page.waitForTimeout(2000);
    
    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Take screenshot
    await page.screenshot({ path: 'step1-initial-page.png', fullPage: true });
    console.log('Screenshot saved: step1-initial-page.png');
    
    // 2. Check if we're on login page
    if (currentUrl.includes('login')) {
      console.log('\n2. Redirected to login page. Attempting to login...');
      
      // Debug: log all visible form elements
      const formElements = await page.locator('input, button').all();
      console.log(`Found ${formElements.length} form elements`);
      
      // Fill email
      const emailInput = await page.locator('input[name="email"], input[type="email"], input[placeholder*="mail" i]').first();
      if (await emailInput.isVisible()) {
        await emailInput.click();
        await emailInput.fill('admin@monito-web.com');
        console.log('✓ Email entered: admin@monito-web.com');
      } else {
        console.log('✗ Email input not found');
      }
      
      // Fill password
      const passwordInput = await page.locator('input[name="password"], input[type="password"]').first();
      if (await passwordInput.isVisible()) {
        await passwordInput.click();
        await passwordInput.fill('admin123');
        console.log('✓ Password entered: admin123');
      } else {
        console.log('✗ Password input not found');
      }
      
      await page.screenshot({ path: 'step2-credentials-entered.png', fullPage: true });
      console.log('Screenshot saved: step2-credentials-entered.png');
      
      // Submit form
      const submitButton = await page.locator('button[type="submit"], button:has-text("Sign in")').first();
      if (await submitButton.isVisible()) {
        console.log('Found submit button, clicking...');
        await submitButton.click();
        
        // Wait for response
        try {
          await page.waitForURL('**/admin/**', { timeout: 10000 });
          console.log('✓ Successfully logged in and redirected to admin panel');
        } catch (e) {
          // Check current state
          const newUrl = page.url();
          console.log(`After login URL: ${newUrl}`);
          
          // Check for any error messages
          const possibleErrors = [
            '.error', '.alert', '[role="alert"]', 
            '.text-red-500', '.text-danger', '.text-error',
            'div:has-text("error")', 'div:has-text("invalid")'
          ];
          
          for (const selector of possibleErrors) {
            const error = await page.locator(selector).first();
            if (await error.isVisible()) {
              const text = await error.textContent();
              console.log(`✗ Error found: ${text}`);
              break;
            }
          }
        }
      }
      
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'step3-after-login.png', fullPage: true });
      console.log('Screenshot saved: step3-after-login.png');
    }
    
    // 3. Check if we're in admin panel
    const adminUrl = page.url();
    if (adminUrl.includes('admin') && !adminUrl.includes('login')) {
      console.log('\n3. Successfully in admin panel!');
      console.log(`Admin URL: ${adminUrl}`);
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // 4. Analyze suppliers page
      console.log('\n4. Analyzing suppliers page...');
      
      // Look for page title/header
      const pageTitle = await page.locator('h1, h2, .page-title').first();
      if (await pageTitle.isVisible()) {
        const titleText = await pageTitle.textContent();
        console.log(`Page title: ${titleText}`);
      }
      
      // Look for suppliers table
      const table = await page.locator('table, [role="table"], .table').first();
      if (await table.isVisible()) {
        console.log('✓ Found suppliers table');
        
        // Count rows
        const rows = await page.locator('tbody tr, [role="row"]:not(:first-child)').all();
        console.log(`Number of supplier entries: ${rows.length}`);
        
        // Get column headers
        const headers = await page.locator('thead th, th').all();
        if (headers.length > 0) {
          console.log('Table columns:');
          for (const header of headers) {
            const text = await header.textContent();
            if (text) console.log(`  - ${text.trim()}`);
          }
        }
      } else {
        console.log('✗ No suppliers table found');
      }
      
      // 5. Look for action buttons
      console.log('\n5. Looking for action buttons...');
      
      // Add Supplier button
      const addButtons = [
        'button:has-text("Add Supplier")',
        'button:has-text("New Supplier")', 
        'a:has-text("Add Supplier")',
        'button[aria-label*="add" i]',
        '.add-supplier-btn'
      ];
      
      let foundAddButton = false;
      for (const selector of addButtons) {
        const btn = await page.locator(selector).first();
        if (await btn.isVisible()) {
          console.log('✓ Found "Add Supplier" button');
          foundAddButton = true;
          
          // Click to see add form
          await btn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'step4-add-supplier-form.png', fullPage: true });
          console.log('Screenshot saved: step4-add-supplier-form.png');
          
          // Check form fields
          const formFields = await page.locator('input[type="text"], input[type="email"], textarea, select').all();
          console.log(`Add form has ${formFields.length} input fields`);
          
          // Close form
          const closeBtn = await page.locator('button:has-text("Cancel"), button:has-text("Close"), .close-btn').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(1000);
          }
          break;
        }
      }
      if (!foundAddButton) console.log('✗ No "Add Supplier" button found');
      
      // Edit buttons
      const editButtons = await page.locator('button:has-text("Edit"), a:has-text("Edit"), [aria-label*="edit" i]').all();
      console.log(`✓ Found ${editButtons.length} edit buttons`);
      
      // Delete buttons
      const deleteButtons = await page.locator('button:has-text("Delete"), button:has-text("Remove"), [aria-label*="delete" i]').all();
      console.log(`✓ Found ${deleteButtons.length} delete buttons`);
      
      // 6. Check navigation menu
      console.log('\n6. Checking admin navigation menu...');
      const navItems = await page.locator('nav a, aside a, .sidebar a, [role="navigation"] a').all();
      
      if (navItems.length > 0) {
        console.log('Navigation menu items:');
        const uniqueLinks = new Set();
        
        for (const item of navItems) {
          const text = await item.textContent();
          const href = await item.getAttribute('href');
          if (text && text.trim() && href) {
            uniqueLinks.add(`${text.trim()} -> ${href}`);
          }
        }
        
        uniqueLinks.forEach(link => console.log(`  - ${link}`));
      }
      
      // 7. Final overview screenshot
      await page.screenshot({ path: 'step5-admin-overview.png', fullPage: true });
      console.log('\nFinal screenshot saved: step5-admin-overview.png');
      
    } else {
      console.log('\n✗ Failed to access admin panel');
      console.log(`Final URL: ${adminUrl}`);
    }
    
  } catch (error) {
    console.error('\nError during testing:', error.message);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log('Error screenshot saved: error-screenshot.png');
  } finally {
    console.log('\n=== TEST COMPLETED ===');
    console.log('Browser will remain open for 15 seconds...');
    await page.waitForTimeout(15000);
    await browser.close();
  }
})();