const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to admin suppliers page...');
    await page.goto('http://209.38.85.196:3000/admin/suppliers', { waitUntil: 'networkidle' });
    
    // Take screenshot of initial page
    await page.screenshot({ path: 'admin-login-page.png', fullPage: true });
    console.log('Screenshot saved: admin-login-page.png');
    
    // Check if we're redirected to login page
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Try to login
    console.log('\n2. Attempting to login with provided credentials...');
    
    // Look for email/username field
    const emailField = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="Email" i]').first();
    if (await emailField.isVisible()) {
      await emailField.fill('admin@monito-web.com');
      console.log('Email entered');
    }
    
    // Look for password field
    const passwordField = await page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();
    if (await passwordField.isVisible()) {
      await passwordField.fill('admin123');
      console.log('Password entered');
    }
    
    // Look for login button
    const loginButton = await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      console.log('Login button clicked');
      
      // Wait for navigation or response
      try {
        await page.waitForURL('**/admin/**', { timeout: 10000 });
        console.log('Successfully navigated to admin panel');
      } catch (e) {
        console.log('Navigation timeout - checking for error messages...');
        
        // Check for error messages
        const errorMessage = await page.locator('.error, .alert, [role="alert"], .text-red-500, .text-danger').first();
        if (await errorMessage.isVisible()) {
          const errorText = await errorMessage.textContent();
          console.log('Error message found:', errorText);
        }
        
        // Check if we need to change password
        const changePasswordPrompt = await page.locator('text=/change.*password/i').first();
        if (await changePasswordPrompt.isVisible()) {
          console.log('Password change required on first login');
        }
      }
      
      await page.waitForTimeout(2000);
    }
    
    // Check if login was successful
    const afterLoginUrl = page.url();
    console.log('URL after login attempt:', afterLoginUrl);
    
    // Take screenshot after login attempt
    await page.screenshot({ path: 'admin-after-login.png', fullPage: true });
    console.log('Screenshot saved: admin-after-login.png');
    
    // Check if we're in the admin panel
    if (afterLoginUrl.includes('admin')) {
      console.log('\n3. Login successful! Exploring admin panel...');
      
      // Check suppliers list
      console.log('\n4. Checking suppliers list...');
      await page.waitForTimeout(2000);
      
      // Take screenshot of suppliers page
      await page.screenshot({ path: 'admin-suppliers-list.png', fullPage: true });
      console.log('Screenshot saved: admin-suppliers-list.png');
      
      // Look for suppliers table or list
      const suppliersTable = await page.locator('table, [role="table"], .suppliers-list, [data-testid*="supplier"]').first();
      if (await suppliersTable.isVisible()) {
        console.log('Suppliers table/list found');
        
        // Count suppliers
        const supplierRows = await page.locator('tbody tr, [role="row"], .supplier-item').count();
        console.log(`Number of suppliers found: ${supplierRows}`);
      }
      
      // Try to find "Add Supplier" button
      console.log('\n5. Looking for Add Supplier functionality...');
      const addSupplierButton = await page.locator('button:has-text("Add Supplier"), button:has-text("New Supplier"), button:has-text("Create Supplier"), a:has-text("Add Supplier")').first();
      
      if (await addSupplierButton.isVisible()) {
        console.log('Add Supplier button found');
        await addSupplierButton.click();
        await page.waitForTimeout(2000);
        
        // Take screenshot of add supplier form
        await page.screenshot({ path: 'admin-add-supplier-form.png', fullPage: true });
        console.log('Screenshot saved: admin-add-supplier-form.png');
        
        // Check for form fields
        const nameField = await page.locator('input[name="name"], input[placeholder*="name" i]').first();
        const emailField = await page.locator('input[name="email"], input[type="email"]').first();
        
        if (await nameField.isVisible() && await emailField.isVisible()) {
          console.log('Add supplier form fields found');
        }
        
        // Go back to suppliers list
        const cancelButton = await page.locator('button:has-text("Cancel"), button:has-text("Back"), a:has-text("Back")').first();
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Try to find Edit buttons
      console.log('\n6. Looking for Edit functionality...');
      const editButtons = await page.locator('button:has-text("Edit"), a:has-text("Edit"), [aria-label*="edit" i]').all();
      
      if (editButtons.length > 0) {
        console.log(`Found ${editButtons.length} edit buttons`);
        await editButtons[0].click();
        await page.waitForTimeout(2000);
        
        // Take screenshot of edit form
        await page.screenshot({ path: 'admin-edit-supplier-form.png', fullPage: true });
        console.log('Screenshot saved: admin-edit-supplier-form.png');
        
        // Go back
        const cancelButton = await page.locator('button:has-text("Cancel"), button:has-text("Back"), a:has-text("Back")').first();
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Try to find Delete buttons
      console.log('\n7. Looking for Delete functionality...');
      const deleteButtons = await page.locator('button:has-text("Delete"), button:has-text("Remove"), [aria-label*="delete" i]').all();
      
      if (deleteButtons.length > 0) {
        console.log(`Found ${deleteButtons.length} delete buttons`);
      }
      
      // Check for other admin navigation items
      console.log('\n8. Checking other admin navigation items...');
      const navLinks = await page.locator('nav a, [role="navigation"] a, .sidebar a, .menu a').all();
      
      console.log('Navigation links found:');
      for (const link of navLinks) {
        const text = await link.textContent();
        if (text && text.trim()) {
          console.log(`- ${text.trim()}`);
        }
      }
      
      // Take final screenshot of admin panel
      await page.screenshot({ path: 'admin-panel-overview.png', fullPage: true });
      console.log('\nFinal screenshot saved: admin-panel-overview.png');
      
    } else {
      console.log('\nLogin failed or redirected to non-admin page');
      console.log('Please check the credentials or login process');
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log('Error screenshot saved: error-screenshot.png');
  } finally {
    console.log('\nTest completed. Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
})();