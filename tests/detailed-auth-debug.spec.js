const { test, expect } = require('@playwright/test');

test.describe('Detailed Authentication Debug', () => {
  test('Debug NextAuth callback with network monitoring', async ({ page, context }) => {
    let callbackResponse = null;
    let callbackError = null;
    
    // Enhanced network monitoring
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/callback/credentials')) {
        try {
          const status = response.status();
          const headers = response.headers();
          let body = '';
          
          try {
            body = await response.text();
          } catch (e) {
            body = 'Could not read response body';
          }
          
          callbackResponse = {
            url: response.url(),
            status: status,
            statusText: response.statusText(),
            headers: headers,
            body: body,
            timestamp: new Date().toISOString()
          };
          
          console.log('=== CALLBACK RESPONSE CAPTURED ===');
          console.log('Status:', status);
          console.log('Status Text:', response.statusText());
          console.log('Headers:', JSON.stringify(headers, null, 2));
          console.log('Body:', body);
          
        } catch (error) {
          callbackError = error.message;
          console.log('Error capturing callback response:', error.message);
        }
      }
    });
    
    // Monitor request failure
    page.on('requestfailed', (request) => {
      if (request.url().includes('/api/auth/callback/credentials')) {
        console.log('=== CALLBACK REQUEST FAILED ===');
        console.log('URL:', request.url());
        console.log('Method:', request.method());
        console.log('Failure text:', request.failure()?.errorText);
      }
    });
    
    console.log('=== Starting detailed authentication debug ===');
    
    // Navigate to login page
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/detailed-debug-step1.png', fullPage: true });
    
    // Fill form and submit
    await page.fill('input[name="email"]', 'admin@monito-web.com');
    await page.fill('input[name="password"]', 'admin123');
    
    await page.screenshot({ path: 'test-results/detailed-debug-step2.png', fullPage: true });
    
    // Submit form and wait for callback
    console.log('Submitting form...');
    await page.click('button[type="submit"]');
    
    // Wait for either success or failure
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (e) {
      console.log('Network idle timeout, continuing...');
    }
    
    // Wait a bit more for the callback response
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'test-results/detailed-debug-step3.png', fullPage: true });
    
    // Check final state
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    // Print callback details
    if (callbackResponse) {
      console.log('=== CALLBACK RESPONSE ANALYSIS ===');
      console.log(JSON.stringify(callbackResponse, null, 2));
    } else if (callbackError) {
      console.log('=== CALLBACK ERROR ===');
      console.log(callbackError);
    } else {
      console.log('=== NO CALLBACK RESPONSE CAPTURED ===');
    }
    
    // Try to manually test the callback endpoint
    console.log('=== MANUAL CALLBACK TEST ===');
    try {
      const csrfResponse = await page.request.get('/api/auth/csrf');
      const csrfData = await csrfResponse.json();
      console.log('CSRF Token:', csrfData.csrfToken);
      
      const callbackResponse = await page.request.post('/api/auth/callback/credentials', {
        data: {
          email: 'admin@monito-web.com',
          password: 'admin123',
          csrfToken: csrfData.csrfToken,
          redirect: 'false',
          json: 'true'
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      console.log('Manual callback status:', callbackResponse.status());
      console.log('Manual callback headers:', callbackResponse.headers());
      
      try {
        const callbackBody = await callbackResponse.text();
        console.log('Manual callback body:', callbackBody);
      } catch (e) {
        console.log('Could not read manual callback body');
      }
      
    } catch (manualError) {
      console.log('Manual callback test failed:', manualError.message);
    }
  });
  
  test('Check server environment for NextAuth', async ({ page }) => {
    console.log('=== SERVER ENVIRONMENT CHECK ===');
    
    // Test if we can reach the auth endpoints
    const endpoints = [
      '/api/auth/providers',
      '/api/auth/csrf',
      '/api/auth/session'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await page.request.get(endpoint);
        console.log(`${endpoint}: ${response.status()} ${response.statusText()}`);
        
        if (response.status() === 200) {
          try {
            const data = await response.json();
            console.log(`  Data:`, JSON.stringify(data, null, 2));
          } catch (e) {
            console.log(`  Could not parse JSON response`);
          }
        }
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
  });
  
  test('Test environment variables effect', async ({ page }) => {
    console.log('=== ENVIRONMENT VARIABLES TEST ===');
    
    // Navigate to a page that might expose environment info
    await page.goto('/api/auth/providers');
    
    try {
      const content = await page.content();
      console.log('Providers endpoint response:', content);
    } catch (error) {
      console.log('Could not get providers endpoint content:', error.message);
    }
    
    // Test with different base URLs
    const testUrls = [
      'http://209.38.85.196:3000/api/auth/csrf',
      'http://localhost:3000/api/auth/csrf'
    ];
    
    for (const url of testUrls) {
      try {
        const response = await page.request.get(url);
        console.log(`${url}: ${response.status()}`);
      } catch (error) {
        console.log(`${url}: ERROR - ${error.message}`);
      }
    }
  });
});