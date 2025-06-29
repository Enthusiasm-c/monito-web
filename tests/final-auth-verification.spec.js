const { test, expect } = require('@playwright/test');

test.describe('Final Authentication Verification', () => {
  test('Complete authentication flow with proper JavaScript waiting', async ({ page, context }) => {
    console.log('=== FINAL AUTHENTICATION VERIFICATION ===');
    
    // Navigate to protected page - should redirect to login
    console.log('1. Navigating to protected page /admin/suppliers');
    await page.goto('/admin/suppliers');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    console.log('   Current URL:', currentUrl);
    
    if (currentUrl.includes('/admin/login')) {
      console.log('   ✅ Correctly redirected to login page');
    } else {
      console.log('   ❌ Unexpected redirect behavior');
    }
    
    await page.screenshot({ path: 'test-results/final-step1-redirected-to-login.png', fullPage: true });
    
    // Fill in credentials
    console.log('2. Filling in admin credentials');
    await page.fill('input[name="email"]', 'admin@monito-web.com');
    await page.fill('input[name="password"]', 'admin123');
    
    await page.screenshot({ path: 'test-results/final-step2-credentials-filled.png', fullPage: true });
    
    // Submit form and wait for client-side redirect
    console.log('3. Submitting form and waiting for client-side redirect');
    
    // Start monitoring for the redirect
    const redirectPromise = page.waitForURL('**/admin/suppliers', { timeout: 10000 });
    
    await page.click('button[type="submit"]');
    
    try {
      await redirectPromise;
      console.log('   ✅ Successfully redirected to protected page');
    } catch (error) {
      console.log('   ❌ Redirect timeout - checking current state');
      
      // Wait a bit more for any delayed redirect
      await page.waitForTimeout(3000);
      
      const finalUrl = page.url();
      console.log('   Final URL after timeout:', finalUrl);
      
      // Check if we're still on login page
      if (finalUrl.includes('/admin/login')) {
        // Check for any error messages
        const errorElement = page.locator('.text-red-800');
        if (await errorElement.count() > 0) {
          const errorText = await errorElement.textContent();
          console.log('   Error message found:', errorText);
        } else {
          console.log('   No error message - authentication might be in progress');
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/final-step3-after-login.png', fullPage: true });
    
    // Verify final state
    const finalUrl = page.url();
    console.log('4. Final verification - URL:', finalUrl);
    
    if (finalUrl.includes('/admin/suppliers')) {
      console.log('   ✅ LOGIN SUCCESS - Reached protected page');
      
      // Verify page content
      const pageTitle = await page.title();
      console.log('   Page title:', pageTitle);
      
      // Check if admin panel elements are visible
      const isAdminPage = await page.locator('h1, h2').count() > 0;
      console.log('   Page has admin content:', isAdminPage);
      
    } else {
      console.log('   ❌ LOGIN FAILED - Still on login page or other redirect');
    }
    
    // Check session one more time
    console.log('5. Final session verification');
    const sessionResponse = await page.request.get('/api/auth/session');
    const sessionData = await sessionResponse.json();
    
    if (sessionData.user) {
      console.log('   ✅ Valid session exists');
      console.log('     User:', sessionData.user.email);
      console.log('     Role:', sessionData.user.role);
    } else {
      console.log('   ❌ No valid session found');
    }
    
    console.log('=== AUTHENTICATION DIAGNOSIS COMPLETE ===');
  });
  
  test('Verify authentication works with manual session check', async ({ page }) => {
    console.log('=== MANUAL SESSION VERIFICATION ===');
    
    // Create session manually
    await page.goto('/admin/login');
    await page.fill('input[name="email"]', 'admin@monito-web.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for potential redirect
    await page.waitForTimeout(5000);
    
    // Now check if we can access protected content
    console.log('Attempting to access admin API...');
    const apiResponse = await page.request.get('/api/admin/suppliers');
    console.log('Admin API response status:', apiResponse.status());
    
    if (apiResponse.status() === 200) {
      console.log('✅ Admin API accessible - authentication working');
      try {
        const apiData = await apiResponse.json();
        console.log('API returned data items:', Array.isArray(apiData) ? apiData.length : 'Not an array');
      } catch (e) {
        console.log('API response not JSON');
      }
    } else {
      console.log('❌ Admin API not accessible - status:', apiResponse.status());
    }
    
    // Try navigating to admin pages directly
    console.log('Testing direct navigation to admin pages...');
    const adminPages = ['/admin', '/admin/suppliers', '/admin/products'];
    
    for (const adminPage of adminPages) {
      await page.goto(adminPage);
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      const success = url === `http://209.38.85.196:3000${adminPage}`;
      console.log(`${adminPage}: ${success ? '✅' : '❌'} (${url})`);
    }
  });
});