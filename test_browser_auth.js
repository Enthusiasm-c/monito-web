#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testAuthentication() {
  console.log('🚀 Starting browser-based authentication test...\n');

  const browser = await puppeteer.launch({
    headless: false, // Keep visible for debugging
    slowMo: 1000,    // Slow down for better visibility
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Enable request interception to monitor network requests
    await page.setRequestInterception(true);
    
    const requests = [];
    const responses = [];
    
    page.on('request', (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
      console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
      request.continue();
    });
    
    page.on('response', (response) => {
      responses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers()
      });
      console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
    });

    // Listen for console errors
    page.on('console', (msg) => {
      console.log(`🖥️  CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    // Listen for JavaScript errors
    page.on('pageerror', (error) => {
      console.error(`💥 PAGE ERROR: ${error.message}`);
    });

    console.log('=== STEP 1: Navigate to admin suppliers page ===');
    await page.goto('http://209.38.85.196:3000/admin/suppliers', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Take screenshot of initial state
    await page.screenshot({ path: 'browser-test-1-initial.png', fullPage: true });
    console.log('📸 Screenshot saved: browser-test-1-initial.png');

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('login')) {
      console.log('\n=== STEP 2: Fill and submit login form ===');
      
      // Wait for form elements
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      
      // Fill form
      await page.type('input[name="email"]', 'admin@monito-web.com');
      await page.type('input[name="password"]', 'admin123');
      
      await page.screenshot({ path: 'browser-test-2-form-filled.png', fullPage: true });
      console.log('📸 Screenshot saved: browser-test-2-form-filled.png');
      
      // Submit form and wait for navigation
      console.log('🔄 Submitting form...');
      
      // Click submit button
      await page.click('button[type="submit"]');
      
      // Wait for either success redirect or error message
      try {
        await Promise.race([
          page.waitForURL('**/admin/**', { timeout: 15000 }),
          page.waitForSelector('.error, .alert, [role="alert"], .text-red-500', { timeout: 15000 })
        ]);
      } catch (e) {
        console.log('⏰ Timeout waiting for response');
      }
      
      await page.waitForTimeout(3000);
      
      const finalUrl = page.url();
      console.log(`Final URL: ${finalUrl}`);
      
      await page.screenshot({ path: 'browser-test-3-after-submit.png', fullPage: true });
      console.log('📸 Screenshot saved: browser-test-3-after-submit.png');
      
      // Check for error messages
      const errorSelectors = [
        '.error', '.alert', '[role="alert"]', 
        '.text-red-500', '.text-danger', '.text-error',
        'div:has-text("error")', 'div:has-text("invalid")',
        'div:has-text("failed")'
      ];
      
      for (const selector of errorSelectors) {
        try {
          const errorElement = await page.$(selector);
          if (errorElement) {
            const errorText = await page.evaluate(el => el.textContent, errorElement);
            if (errorText && errorText.trim()) {
              console.log(`❌ Error found: ${errorText.trim()}`);
            }
          }
        } catch (e) {
          // Ignore selector errors
        }
      }
      
      if (finalUrl.includes('admin') && !finalUrl.includes('login')) {
        console.log('✅ Successfully logged in and redirected to admin panel');
      } else {
        console.log('❌ Login appears to have failed');
      }
    }

    console.log('\n=== NETWORK SUMMARY ===');
    console.log(`Total requests: ${requests.length}`);
    console.log(`Total responses: ${responses.length}`);
    
    // Filter auth-related requests
    const authRequests = requests.filter(req => 
      req.url.includes('/api/auth/') || 
      req.url.includes('callback') ||
      req.url.includes('signin')
    );
    
    console.log('\n📋 Auth-related requests:');
    authRequests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`   Data: ${req.postData.substring(0, 200)}...`);
      }
    });

    const authResponses = responses.filter(res => 
      res.url.includes('/api/auth/') || 
      res.url.includes('callback') ||
      res.url.includes('signin')
    );
    
    console.log('\n📋 Auth-related responses:');
    authResponses.forEach((res, i) => {
      console.log(`${i + 1}. ${res.status} ${res.url}`);
    });

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will remain open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('💥 Test failed:', error);
    await browser.close();
    return;
  }

  await browser.close();
  console.log('\n✅ Test completed');
}

// Check if puppeteer is installed
try {
  require.resolve('puppeteer');
  testAuthentication();
} catch (e) {
  console.log('❌ Puppeteer not found. Installing...');
  console.log('Please run: npm install puppeteer');
  console.log('Then run this script again.');
}