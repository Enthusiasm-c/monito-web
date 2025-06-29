const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slower to see what's happening
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });

  // Log network failures
  page.on('requestfailed', request => {
    console.log('Request failed:', request.url(), request.failure().errorText);
  });

  try {
    console.log('=== TESTING MONITO WEB ADMIN WITH PASSWORD CHANGE ===\n');
    
    // Navigate directly to login
    console.log('1. Navigating to admin login page...');
    await page.goto('http://209.38.85.196:3000/admin/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.screenshot({ path: 'login-page.png', fullPage: true });
    console.log('Screenshot: login-page.png');
    
    // Try to login
    console.log('\n2. Attempting login with default credentials...');
    
    await page.fill('input[placeholder="Email address"]', 'admin@monito-web.com');
    await page.fill('input[placeholder="Password"]', 'admin123');
    
    console.log('Credentials filled, submitting...');
    
    // Click sign in and wait for response
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/') || response.url().includes('auth'), { timeout: 10000 }).catch(() => null),
      page.click('button:has-text("Sign in")')
    ]);
    
    if (response) {
      console.log(`Login response status: ${response.status()}`);
      const responseBody = await response.text().catch(() => '');
      if (responseBody) {
        console.log('Response preview:', responseBody.substring(0, 200));
      }
    }
    
    await page.waitForTimeout(3000);
    
    // Check current state
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Check for password change form
    console.log('\n3. Checking for password change requirement...');
    
    const passwordChangeIndicators = [
      'text=/change.*password/i',
      'text=/new.*password/i',
      'text=/reset.*password/i',
      'text=/first.*login/i',
      'h1:has-text("Change Password")',
      'h2:has-text("Change Password")'
    ];
    
    let needsPasswordChange = false;
    for (const indicator of passwordChangeIndicators) {
      const element = await page.locator(indicator).first();
      if (await element.isVisible()) {
        const text = await element.textContent();
        console.log(`Found password change indicator: "${text}"`);
        needsPasswordChange = true;
        break;
      }
    }
    
    if (needsPasswordChange) {
      console.log('\n4. Password change required. Looking for password change form...');
      
      // Look for new password fields
      const newPasswordField = await page.locator('input[type="password"][placeholder*="new" i], input[name*="newPassword" i]').first();
      const confirmPasswordField = await page.locator('input[type="password"][placeholder*="confirm" i], input[name*="confirmPassword" i]').first();
      
      if (await newPasswordField.isVisible() && await confirmPasswordField.isVisible()) {
        console.log('Found password change form');
        
        // Fill new password
        const newPassword = 'AdminPassword123!';
        await newPasswordField.fill(newPassword);
        await confirmPasswordField.fill(newPassword);
        
        console.log('New password filled');
        
        // Submit password change
        const submitButton = await page.locator('button[type="submit"], button:has-text("Change Password"), button:has-text("Update Password")').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          console.log('Password change submitted');
          
          await page.waitForTimeout(3000);
          
          // Check if we need to login again with new password
          if (page.url().includes('login')) {
            console.log('Redirected to login. Logging in with new password...');
            await page.fill('input[placeholder="Email address"]', 'admin@monito-web.com');
            await page.fill('input[placeholder="Password"]', newPassword);
            await page.click('button:has-text("Sign in")');
            await page.waitForTimeout(3000);
          }
        }
      }
    }
    
    // Check if we're in admin panel
    if (currentUrl.includes('admin') && !currentUrl.includes('login')) {
      console.log('\n5. Successfully accessed admin panel!');
      await page.screenshot({ path: 'admin-panel-success.png', fullPage: true });
      console.log('Screenshot: admin-panel-success.png');
      
      // Quick check of admin features
      console.log('\nChecking admin features:');
      
      // Count visible links in navigation
      const navLinks = await page.locator('nav a, aside a').all();
      console.log(`- Navigation links: ${navLinks.length}`);
      
      // Look for main content
      const mainContent = await page.locator('main, [role="main"], .main-content').first();
      if (await mainContent.isVisible()) {
        console.log('- Main content area found');
      }
      
      // Look for data tables
      const tables = await page.locator('table').all();
      console.log(`- Tables found: ${tables.length}`);
      
    } else {
      console.log('\n✗ Could not access admin panel');
      console.log('The login might be failing due to:');
      console.log('1. Invalid credentials');
      console.log('2. Account locked or disabled');
      console.log('3. Server-side authentication issues');
      console.log('4. Session/cookie problems');
      
      // Try to find any error messages
      const errorSelectors = [
        '.error', '.alert-error', '.alert-danger',
        '[role="alert"]', '.toast-error',
        'div[class*="error"]', 'p[class*="error"]',
        '*:has-text("Invalid")', '*:has-text("incorrect")'
      ];
      
      for (const selector of errorSelectors) {
        try {
          const error = await page.locator(selector).first();
          if (await error.isVisible()) {
            const errorText = await error.textContent();
            console.log(`\nError message found: "${errorText.trim()}"`);
            break;
          }
        } catch (e) {
          // Continue checking other selectors
        }
      }
    }
    
    await page.screenshot({ path: 'final-state.png', fullPage: true });
    console.log('\nFinal screenshot: final-state.png');
    
  } catch (error) {
    console.error('\nTest error:', error.message);
    await page.screenshot({ path: 'error-state.png', fullPage: true });
  } finally {
    console.log('\n=== TEST COMPLETED ===');
    console.log('Browser will close in 20 seconds...');
    await page.waitForTimeout(20000);
    await browser.close();
  }
})();