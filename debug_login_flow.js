const { chromium } = require('playwright');

async function debugLoginFlow() {
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
        
        // Monitor network requests
        page.on('request', request => {
            if (request.url().includes('auth') || request.url().includes('login')) {
                console.log(`🔗 Request: ${request.method()} ${request.url()}`);
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('auth') || response.url().includes('login')) {
                console.log(`📡 Response: ${response.status()} ${response.url()}`);
            }
        });
        
        console.log('🔍 Starting detailed login flow debug...');
        
        // Step 1: Go to admin area
        console.log('\n📱 Step 1: Navigating to admin suppliers page...');
        await page.goto('http://209.38.85.196:3000/admin/suppliers');
        await page.waitForLoadState('networkidle');
        
        console.log(`Current URL: ${page.url()}`);
        
        // Take screenshot
        await page.screenshot({ path: 'debug-step1-initial.png', fullPage: true });
        
        // Step 2: Fill login form
        console.log('\n🔑 Step 2: Filling login form...');
        
        // Wait for form elements
        await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
        
        const emailField = page.locator('input[name="email"], input[type="email"]').first();
        const passwordField = page.locator('input[name="password"], input[type="password"]').first();
        const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
        
        // Clear and fill email
        await emailField.fill('');
        await emailField.fill('admin@monito-web.com');
        console.log('✅ Email filled');
        
        // Clear and fill password
        await passwordField.fill('');
        await passwordField.fill('admin123');
        console.log('✅ Password filled');
        
        // Take screenshot before submit
        await page.screenshot({ path: 'debug-step2-form-filled.png', fullPage: true });
        
        // Step 3: Submit form and monitor
        console.log('\n📤 Step 3: Submitting form...');
        
        // Listen for navigation
        const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
        
        // Click submit
        await submitButton.click();
        console.log('✅ Submit button clicked');
        
        // Wait for navigation or timeout
        const navigationResult = await navigationPromise;
        
        if (navigationResult) {
            console.log(`🚀 Navigation occurred to: ${page.url()}`);
        } else {
            console.log('❌ No navigation occurred');
        }
        
        // Wait a bit more
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle');
        
        console.log(`Final URL: ${page.url()}`);
        
        // Take screenshot after submit
        await page.screenshot({ path: 'debug-step3-after-submit.png', fullPage: true });
        
        // Step 4: Check for errors or success indicators
        console.log('\n🔍 Step 4: Checking for errors or success...');
        
        // Look for error messages
        const errorSelectors = [
            '[class*="error"]',
            '[class*="alert"]',
            '.text-red-500',
            '[role="alert"]',
            '.alert-error',
            '.error-message'
        ];
        
        for (const selector of errorSelectors) {
            const elements = await page.locator(selector).all();
            if (elements.length > 0) {
                for (const element of elements) {
                    const text = await element.textContent();
                    if (text && text.trim()) {
                        console.log(`❌ Error found: ${text.trim()}`);
                    }
                }
            }
        }
        
        // Check if we're still on login page or redirected
        const currentUrl = page.url();
        if (currentUrl.includes('/admin/login')) {
            console.log('❌ Still on login page - authentication failed');
            
            // Check form values
            const emailValue = await emailField.inputValue();
            const passwordValue = await passwordField.inputValue();
            console.log(`Form values - Email: ${emailValue}, Password: ${passwordValue ? '[FILLED]' : '[EMPTY]'}`);
            
        } else if (currentUrl.includes('/admin')) {
            console.log('✅ Successfully redirected to admin area');
            
            // Look for admin content
            const adminContent = await page.locator('h1, h2, [class*="admin"], [class*="dashboard"]').all();
            console.log(`Found ${adminContent.length} admin elements`);
            
            for (let i = 0; i < Math.min(adminContent.length, 5); i++) {
                const text = await adminContent[i].textContent();
                console.log(`  - ${text?.trim()}`);
            }
            
        } else {
            console.log(`❓ Unexpected redirect to: ${currentUrl}`);
        }
        
        // Step 5: Try to access admin API directly
        console.log('\n🔧 Step 5: Testing admin API access...');
        
        try {
            const apiResponse = await page.goto('http://209.38.85.196:3000/api/admin/suppliers', {
                waitUntil: 'networkidle'
            });
            
            console.log(`API Response Status: ${apiResponse?.status()}`);
            
            if (apiResponse?.status() === 200) {
                const apiText = await page.textContent('body');
                console.log('✅ API access successful');
                console.log(`Response preview: ${apiText?.substring(0, 200)}...`);
            } else {
                console.log('❌ API access failed');
            }
        } catch (error) {
            console.log(`❌ API test error: ${error.message}`);
        }
        
        // Step 6: Manual wait for observation
        console.log('\n⏰ Keeping browser open for 10 seconds for manual observation...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
        
        if (browser) {
            const page = (await browser.contexts())[0]?.pages()[0];
            if (page) {
                await page.screenshot({ path: 'debug-error.png', fullPage: true });
            }
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

debugLoginFlow().then(() => {
    console.log('\n🏁 Debug completed!');
}).catch(error => {
    console.error('💥 Debug execution failed:', error);
});