const { test, expect } = require('@playwright/test');

test.describe('Authentication Debug Suite', () => {
  test('Debug authentication flow with comprehensive monitoring', async ({ page, context }) => {
    // Enable request interception to monitor all network requests
    const networkRequests = [];
    const consoleMessages = [];
    
    // Monitor all network requests
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Monitor network responses
    page.on('response', response => {
      const request = networkRequests.find(req => req.url === response.url());
      if (request) {
        request.status = response.status();
        request.statusText = response.statusText();
        request.responseHeaders = response.headers();
      }
    });
    
    // Monitor console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Monitor page errors
    page.on('pageerror', error => {
      consoleMessages.push({
        type: 'error',
        text: `Page Error: ${error.message}`,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    console.log('=== STEP 1: Navigate to /admin/suppliers (should redirect to login) ===');
    
    // Navigate to admin/suppliers - should redirect to login
    await page.goto('/admin/suppliers');
    
    // Wait for page to load and take screenshot
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/step1-navigation.png', fullPage: true });
    
    console.log('Current URL after navigation:', page.url());
    console.log('Page title:', await page.title());
    
    // Check if we're redirected to login
    const currentUrl = page.url();
    const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth/signin');
    console.log('Redirected to login page:', isOnLoginPage);

    console.log('=== STEP 2: Fill in login form ===');
    
    // Wait for login form to be visible
    await page.waitForSelector('form', { timeout: 10000 });
    
    // Look for email/username field
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[name="username"]',
      'input[id="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]'
    ];
    
    let emailField = null;
    for (const selector of emailSelectors) {
      try {
        emailField = page.locator(selector);
        if (await emailField.count() > 0) {
          console.log('Found email field with selector:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    // Look for password field
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="Password" i]'
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        passwordField = page.locator(selector);
        if (await passwordField.count() > 0) {
          console.log('Found password field with selector:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!emailField || !passwordField) {
      console.log('Could not find login form fields. Available inputs:');
      const inputs = await page.locator('input').all();
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const name = await input.getAttribute('name');
        const type = await input.getAttribute('type');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        console.log(`Input ${i}: name="${name}", type="${type}", id="${id}", placeholder="${placeholder}"`);
      }
    }
    
    // Fill the form
    if (emailField && passwordField) {
      await emailField.fill('admin@monito-web.com');
      await passwordField.fill('admin123');
      
      console.log('Credentials filled successfully');
      await page.screenshot({ path: 'test-results/step2-credentials-filled.png', fullPage: true });
    } else {
      console.log('ERROR: Could not find login form fields');
      await page.screenshot({ path: 'test-results/step2-error-no-form.png', fullPage: true });
    }

    console.log('=== STEP 3: Submit form and monitor network requests ===');
    
    // Clear previous network requests for login monitoring
    networkRequests.length = 0;
    
    // Look for submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'button:has-text("Log In")',
      'form button'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = page.locator(selector);
        if (await submitButton.count() > 0) {
          console.log('Found submit button with selector:', selector);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (submitButton) {
      // Click submit and wait for response
      await Promise.all([
        page.waitForLoadState('networkidle'),
        submitButton.click()
      ]);
      
      console.log('Form submitted successfully');
      await page.screenshot({ path: 'test-results/step3-after-submit.png', fullPage: true });
    } else {
      console.log('ERROR: Could not find submit button');
      await page.screenshot({ path: 'test-results/step3-error-no-submit.png', fullPage: true });
    }

    console.log('=== STEP 4: Analyze network requests and responses ===');
    
    // Filter and analyze authentication-related requests
    const authRequests = networkRequests.filter(req => 
      req.url.includes('/api/auth/') || 
      req.url.includes('/auth/') ||
      req.url.includes('callback') ||
      req.url.includes('signin') ||
      req.url.includes('login')
    );
    
    console.log('Authentication-related network requests:');
    authRequests.forEach((req, index) => {
      console.log(`\nRequest ${index + 1}:`);
      console.log(`  URL: ${req.url}`);
      console.log(`  Method: ${req.method}`);
      console.log(`  Status: ${req.status || 'No response'}`);
      console.log(`  Status Text: ${req.statusText || 'N/A'}`);
      if (req.postData) {
        console.log(`  POST Data: ${req.postData}`);
      }
      if (req.responseHeaders) {
        console.log(`  Response Headers:`, JSON.stringify(req.responseHeaders, null, 2));
      }
    });
    
    // Check for the specific callback request
    const callbackRequest = authRequests.find(req => req.url.includes('/api/auth/callback/credentials'));
    if (callbackRequest) {
      console.log('\n=== CALLBACK REQUEST ANALYSIS ===');
      console.log('POST /api/auth/callback/credentials found!');
      console.log('Status:', callbackRequest.status);
      console.log('POST Data:', callbackRequest.postData);
      console.log('Response Headers:', JSON.stringify(callbackRequest.responseHeaders, null, 2));
    } else {
      console.log('\n=== ERROR: No callback request found ===');
      console.log('Available requests:', networkRequests.map(r => r.url));
    }

    console.log('=== STEP 5: Check session cookies ===');
    
    // Get all cookies
    const cookies = await context.cookies();
    console.log('Current cookies:');
    cookies.forEach(cookie => {
      console.log(`  ${cookie.name}: ${cookie.value} (domain: ${cookie.domain}, path: ${cookie.path})`);
    });
    
    // Check for session-related cookies
    const sessionCookies = cookies.filter(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('token') || 
      cookie.name.includes('auth') ||
      cookie.name.includes('next-auth')
    );
    
    if (sessionCookies.length > 0) {
      console.log('Session cookies found:');
      sessionCookies.forEach(cookie => {
        console.log(`  ${cookie.name}: ${cookie.value}`);
      });
    } else {
      console.log('No session cookies found');
    }

    console.log('=== STEP 6: Check final page state ===');
    
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    console.log('Final page title:', await page.title());
    
    // Check if we're successfully logged in
    const isLoggedIn = finalUrl.includes('/admin') && !finalUrl.includes('/login') && !finalUrl.includes('/auth');
    console.log('Successfully logged in:', isLoggedIn);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/step6-final-state.png', fullPage: true });

    console.log('=== STEP 7: Console messages and errors ===');
    
    if (consoleMessages.length > 0) {
      console.log('Console messages:');
      consoleMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
        if (msg.stack) {
          console.log(`     Stack: ${msg.stack}`);
        }
      });
    } else {
      console.log('No console messages captured');
    }

    console.log('=== STEP 8: Additional debugging steps ===');
    
    if (!isLoggedIn) {
      console.log('Login failed. Trying additional debugging steps...');
      
      // Try to clear cookies and retry
      console.log('Clearing cookies and retrying...');
      await context.clearCookies();
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/debug-after-clear-cookies.png', fullPage: true });
      
      // Check for CORS errors in network requests
      const corsErrors = networkRequests.filter(req => 
        req.status === 0 || 
        req.statusText?.includes('CORS') ||
        req.url.includes('cors')
      );
      
      if (corsErrors.length > 0) {
        console.log('Potential CORS errors found:');
        corsErrors.forEach(err => {
          console.log(`  ${err.url}: ${err.status} ${err.statusText}`);
        });
      }
      
      // Check for CSP errors
      const cspErrors = consoleMessages.filter(msg => 
        msg.text.includes('Content Security Policy') ||
        msg.text.includes('CSP') ||
        msg.text.includes('refused to')
      );
      
      if (cspErrors.length > 0) {
        console.log('Content Security Policy errors found:');
        cspErrors.forEach(err => {
          console.log(`  ${err.text}`);
        });
      }
    }

    console.log('=== DEBUGGING SUMMARY ===');
    console.log(`Total network requests: ${networkRequests.length}`);
    console.log(`Auth-related requests: ${authRequests.length}`);
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log(`Cookies set: ${cookies.length}`);
    console.log(`Final login status: ${isLoggedIn ? 'SUCCESS' : 'FAILED'}`);
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      loginSuccess: isLoggedIn,
      finalUrl: finalUrl,
      networkRequests: networkRequests,
      authRequests: authRequests,
      consoleMessages: consoleMessages,
      cookies: cookies,
      callbackRequest: callbackRequest
    };
    
    // Write report to file
    await page.evaluate((reportData) => {
      console.log('DETAILED REPORT:', JSON.stringify(reportData, null, 2));
    }, report);
  });
  
  test('Test incognito mode authentication', async ({ browser }) => {
    console.log('=== TESTING IN INCOGNITO MODE ===');
    
    const context = await browser.newContext({
      // Incognito mode settings
      ignoreHTTPSErrors: true,
      acceptDownloads: false,
      bypassCSP: false
    });
    
    const page = await context.newPage();
    
    // Monitor network requests
    const networkRequests = [];
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    });
    
    page.on('response', response => {
      const request = networkRequests.find(req => req.url === response.url());
      if (request) {
        request.status = response.status();
      }
    });
    
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/incognito-step1.png', fullPage: true });
    
    // Try to fill login form
    try {
      await page.fill('input[name="email"], input[type="email"]', 'admin@monito-web.com');
      await page.fill('input[name="password"], input[type="password"]', 'admin123');
      await page.screenshot({ path: 'test-results/incognito-step2.png', fullPage: true });
      
      await page.click('button[type="submit"], button:has-text("Sign In")');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/incognito-step3.png', fullPage: true });
      
      console.log('Incognito mode final URL:', page.url());
      
    } catch (error) {
      console.log('Incognito mode error:', error.message);
      await page.screenshot({ path: 'test-results/incognito-error.png', fullPage: true });
    }
    
    await context.close();
  });
});