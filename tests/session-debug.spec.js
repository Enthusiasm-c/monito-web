const { test, expect } = require('@playwright/test');

test.describe('Session Debug', () => {
  test('Check session state after login attempt', async ({ page, context }) => {
    console.log('=== SESSION STATE DEBUG ===');
    
    // Navigate to login page
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    console.log('1. Initial state - no session');
    
    // Check initial session
    const initialSession = await page.request.get('/api/auth/session');
    console.log('Initial session status:', initialSession.status());
    try {
      const initialSessionData = await initialSession.json();
      console.log('Initial session data:', JSON.stringify(initialSessionData, null, 2));
    } catch (e) {
      console.log('No initial session data');
    }
    
    // Fill and submit login form
    await page.fill('input[name="email"]', 'admin@monito-web.com');
    await page.fill('input[name="password"]', 'admin123');
    
    console.log('2. Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for potential redirect
    await page.waitForTimeout(3000);
    
    // Check cookies after login
    const cookies = await context.cookies();
    console.log('3. Cookies after login:');
    cookies.forEach(cookie => {
      console.log(`   ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
    });
    
    // Check session after login
    console.log('4. Checking session after login...');
    const postLoginSession = await page.request.get('/api/auth/session');
    console.log('Post-login session status:', postLoginSession.status());
    
    try {
      const sessionData = await postLoginSession.json();
      console.log('Post-login session data:', JSON.stringify(sessionData, null, 2));
      
      if (sessionData.user) {
        console.log('✅ Session established successfully');
        console.log('   User:', sessionData.user.email);
        console.log('   Role:', sessionData.user.role);
        console.log('   Active:', sessionData.user.isActive);
      } else {
        console.log('❌ No user in session');
      }
    } catch (e) {
      console.log('❌ Could not parse session data:', e.message);
    }
    
    // Try to access protected page
    console.log('5. Testing access to protected page...');
    await page.goto('/admin/suppliers', { waitUntil: 'networkidle' });
    
    const finalUrl = page.url();
    console.log('Final URL after accessing /admin/suppliers:', finalUrl);
    
    if (finalUrl.includes('/admin/suppliers')) {
      console.log('✅ Successfully accessed protected page');
    } else if (finalUrl.includes('/admin/login')) {
      console.log('❌ Redirected back to login - authentication failed');
    } else {
      console.log('❓ Unexpected redirect to:', finalUrl);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/session-debug-final.png', fullPage: true });
    
    // Double-check session state
    console.log('6. Final session check...');
    const finalSession = await page.request.get('/api/auth/session');
    try {
      const finalSessionData = await finalSession.json();
      console.log('Final session:', JSON.stringify(finalSessionData, null, 2));
    } catch (e) {
      console.log('Final session check failed:', e.message);
    }
  });
  
  test('Test direct session creation via API', async ({ page }) => {
    console.log('=== DIRECT SESSION API TEST ===');
    
    // Get CSRF token
    const csrfResponse = await page.request.get('/api/auth/csrf');
    const csrfData = await csrfResponse.json();
    console.log('CSRF Token obtained:', csrfData.csrfToken.substring(0, 20) + '...');
    
    // Try direct login via API
    console.log('Attempting direct login via credentials callback...');
    
    const loginData = new URLSearchParams({
      email: 'admin@monito-web.com',
      password: 'admin123',
      csrfToken: csrfData.csrfToken,
      callbackUrl: 'http://209.38.85.196:3000/admin/suppliers',
      redirect: 'true',
      json: 'false'
    });
    
    const loginResponse = await page.request.post('/api/auth/callback/credentials', {
      data: loginData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });
    
    console.log('Login response status:', loginResponse.status());
    console.log('Login response headers:', loginResponse.headers());
    
    // Check if redirect happened
    if (loginResponse.status() === 302) {
      console.log('✅ Got redirect response');
      const location = loginResponse.headers()['location'];
      console.log('Redirect location:', location);
    } else {
      console.log('❌ Expected redirect (302) but got:', loginResponse.status());
      try {
        const responseText = await loginResponse.text();
        console.log('Response body:', responseText.substring(0, 200));
      } catch (e) {
        console.log('Could not read response body');
      }
    }
  });
  
  test('Check NextAuth environment and configuration', async ({ page }) => {
    console.log('=== NEXTAUTH CONFIGURATION CHECK ===');
    
    // Check providers endpoint
    const providersResponse = await page.request.get('/api/auth/providers');
    console.log('Providers endpoint status:', providersResponse.status());
    
    if (providersResponse.status() === 200) {
      try {
        const providers = await providersResponse.json();
        console.log('Available providers:', Object.keys(providers));
        
        if (providers.credentials) {
          console.log('✅ Credentials provider configured');
          console.log('   ID:', providers.credentials.id);
          console.log('   Name:', providers.credentials.name);
          console.log('   Type:', providers.credentials.type);
        } else {
          console.log('❌ Credentials provider not found');
        }
      } catch (e) {
        console.log('❌ Could not parse providers response:', e.message);
      }
    }
    
    // Test signin page
    console.log('Testing signin page access...');
    await page.goto('/api/auth/signin');
    
    const signinContent = await page.content();
    if (signinContent.includes('Sign in')) {
      console.log('✅ Signin page accessible');
    } else {
      console.log('❌ Signin page not accessible or malformed');
    }
    
    // Check configuration by attempting callback with invalid data
    console.log('Testing configuration with invalid credentials...');
    const invalidLogin = await page.request.post('/api/auth/callback/credentials', {
      data: 'email=invalid@test.com&password=wrong&csrfToken=invalid',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });
    
    console.log('Invalid login response status:', invalidLogin.status());
    if (invalidLogin.status() === 401 || invalidLogin.status() === 400) {
      console.log('✅ Proper error handling for invalid credentials');
    } else {
      console.log('❓ Unexpected response for invalid credentials');
    }
  });
});