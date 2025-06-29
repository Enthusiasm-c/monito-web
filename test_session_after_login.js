const { chromium } = require('playwright');

async function testSessionAfterLogin() {
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: false,
            slowMo: 1000
        });
        
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        
        const page = await context.newPage();
        
        console.log('🔍 Testing session after login...');
        
        // Navigate to login page
        await page.goto('http://209.38.85.196:3000/admin/login');
        await page.waitForLoadState('networkidle');
        
        // Fill login form
        await page.fill('input[name="email"]', 'admin@monito-web.com');
        await page.fill('input[name="password"]', 'admin123');
        
        console.log('📋 Credentials filled');
        
        // Submit form
        await page.click('button[type="submit"]');
        console.log('📤 Form submitted');
        
        // Wait for potential navigation or error
        await page.waitForTimeout(5000);
        
        // Check current URL
        console.log(`Current URL: ${page.url()}`);
        
        // Check session by calling the API directly
        console.log('\n🔍 Checking session via API...');
        
        const sessionResponse = await page.goto('http://209.38.85.196:3000/api/auth/session');
        const sessionData = await sessionResponse.json();
        
        console.log('Session data:', JSON.stringify(sessionData, null, 2));
        
        if (sessionData.user) {
            console.log(`✅ User is authenticated: ${sessionData.user.email}`);
            console.log(`👤 User role: ${sessionData.user.role || 'NO ROLE'}`);
            
            if (sessionData.user.role === 'admin' || sessionData.user.role === 'manager') {
                console.log('✅ User has correct role for admin access');
            } else {
                console.log('❌ User does not have admin/manager role');
            }
        } else {
            console.log('❌ User is not authenticated');
        }
        
        // Try to access admin suppliers directly
        console.log('\n🔍 Testing direct admin access...');
        
        const adminResponse = await page.goto('http://209.38.85.196:3000/admin/suppliers');
        await page.waitForLoadState('networkidle');
        
        console.log(`Admin suppliers URL: ${page.url()}`);
        
        // Check if we get the admin content or are redirected
        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);
        
        const adminContent = await page.locator('h1, h2, [data-testid*="admin"]').first().textContent().catch(() => null);
        if (adminContent) {
            console.log(`✅ Admin content found: ${adminContent}`);
        } else {
            console.log('❌ No admin content found');
        }
        
        // Take final screenshot
        await page.screenshot({ path: 'final-session-test.png', fullPage: true });
        console.log('📸 Final screenshot saved');
        
        // Keep browser open for manual inspection
        console.log('\n⏰ Keeping browser open for 10 seconds...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testSessionAfterLogin().then(() => {
    console.log('\n🏁 Session test completed!');
}).catch(error => {
    console.error('💥 Test execution failed:', error);
});