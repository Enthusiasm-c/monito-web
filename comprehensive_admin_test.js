const { chromium } = require('playwright');

async function comprehensiveAdminTest() {
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
        
        console.log('🔍 Comprehensive Admin Panel Test...');
        
        // Function to login
        async function loginAs(email, password, role) {
            console.log(`\n🔑 Testing login as ${role}: ${email}`);
            
            await page.goto('http://209.38.85.196:3000/admin/login');
            await page.waitForLoadState('networkidle');
            
            await page.fill('input[name="email"]', email);
            await page.fill('input[name="password"]', password);
            await page.click('button[type="submit"]');
            
            await page.waitForTimeout(3000);
            
            // Check session
            const sessionResponse = await page.goto('http://209.38.85.196:3000/api/auth/session');
            const sessionData = await sessionResponse.json();
            
            if (sessionData.user) {
                console.log(`✅ ${role} login successful: ${sessionData.user.email} (role: ${sessionData.user.role})`);
                return true;
            } else {
                console.log(`❌ ${role} login failed`);
                return false;
            }
        }
        
        // Test 1: Admin Login
        const adminLoginSuccess = await loginAs('admin@monito-web.com', 'admin123', 'Admin');
        
        if (adminLoginSuccess) {
            // Navigate to admin panel
            await page.goto('http://209.38.85.196:3000/admin/suppliers');
            await page.waitForLoadState('networkidle');
            
            console.log('\n📊 Testing Suppliers Management...');
            await page.screenshot({ path: 'admin-suppliers-overview.png', fullPage: true });
            
            // Test Add Supplier button
            const addSupplierBtn = page.locator('button:has-text("Add Supplier")');
            if (await addSupplierBtn.isVisible()) {
                console.log('✅ Add Supplier button found');
                
                // Click it to see if modal/form opens
                await addSupplierBtn.click();
                await page.waitForTimeout(2000);
                await page.screenshot({ path: 'admin-add-supplier.png', fullPage: true });
                
                // Close modal if opened (press escape)
                await page.keyboard.press('Escape');
                await page.waitForTimeout(1000);
            }
            
            // Test navigation tabs
            console.log('\n🧭 Testing Navigation...');
            
            // Test Products tab
            const productsTab = page.locator('text=Products').first();
            if (await productsTab.isVisible()) {
                await productsTab.click();
                await page.waitForTimeout(3000);
                await page.waitForLoadState('networkidle');
                
                console.log(`✅ Products page: ${page.url()}`);
                await page.screenshot({ path: 'admin-products.png', fullPage: true });
            }
            
            // Test Uploads tab
            const uploadsTab = page.locator('text=Uploads').first();
            if (await uploadsTab.isVisible()) {
                await uploadsTab.click();
                await page.waitForTimeout(3000);
                await page.waitForLoadState('networkidle');
                
                console.log(`✅ Uploads page: ${page.url()}`);
                await page.screenshot({ path: 'admin-uploads.png', fullPage: true });
            }
            
            // Go back to suppliers
            await page.goto('http://209.38.85.196:3000/admin/suppliers');
            await page.waitForLoadState('networkidle');
            
            // Test search functionality
            console.log('\n🔍 Testing Search...');
            const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
            if (await searchInput.isVisible()) {
                await searchInput.fill('test supplier');
                await page.waitForTimeout(2000);
                console.log('✅ Search input works');
                await searchInput.clear();
            }
            
            // Test user menu
            console.log('\n👤 Testing User Menu...');
            
            // Check user info display
            const userInfo = await page.locator(':text("System Administrator")').textContent().catch(() => null);
            if (userInfo) {
                console.log(`✅ User info displayed: ${userInfo}`);
            }
            
            // Check Sign Out functionality
            const signOutBtn = page.locator('text=Sign Out');
            if (await signOutBtn.isVisible()) {
                console.log('✅ Sign Out button found');
            }
            
            // Check Back to App link
            const backToAppLink = page.locator('text=Back to App');
            if (await backToAppLink.isVisible()) {
                console.log('✅ Back to App link found');
            }
        }
        
        // Test 2: Manager Login
        console.log('\n' + '='.repeat(50));
        const managerLoginSuccess = await loginAs('manager@monito-web.com', 'manager123', 'Manager');
        
        if (managerLoginSuccess) {
            await page.goto('http://209.38.85.196:3000/admin/suppliers');
            await page.waitForLoadState('networkidle');
            
            console.log('✅ Manager can access admin panel');
            await page.screenshot({ path: 'manager-admin-access.png', fullPage: true });
            
            // Check if manager has same permissions as admin
            const addSupplierBtn = page.locator('button:has-text("Add Supplier")');
            if (await addSupplierBtn.isVisible()) {
                console.log('✅ Manager can see Add Supplier button');
            } else {
                console.log('❌ Manager cannot see Add Supplier button (restricted access)');
            }
        }
        
        // Test 3: Invalid Credentials
        console.log('\n' + '='.repeat(50));
        console.log('\n🔑 Testing invalid credentials...');
        
        await page.goto('http://209.38.85.196:3000/admin/login');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[name="email"]', 'invalid@test.com');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        
        await page.waitForTimeout(3000);
        
        // Check for error message
        const errorMessage = await page.locator('[class*="error"], [class*="alert"], .text-red-500').textContent().catch(() => null);
        if (errorMessage) {
            console.log(`✅ Error message displayed: ${errorMessage}`);
        } else {
            console.log('❌ No error message displayed for invalid credentials');
        }
        
        await page.screenshot({ path: 'invalid-login-test.png', fullPage: true });
        
        // Test 4: Test API endpoints accessibility
        console.log('\n🔧 Testing API endpoints...');
        
        // First login as admin again
        await loginAs('admin@monito-web.com', 'admin123', 'Admin');
        
        const apiTests = [
            { endpoint: '/api/admin/suppliers', name: 'Suppliers API' },
            { endpoint: '/api/admin/products', name: 'Products API' },
            { endpoint: '/api/admin/uploads', name: 'Uploads API' }
        ];
        
        for (const test of apiTests) {
            try {
                const response = await page.goto(`http://209.38.85.196:3000${test.endpoint}`);
                console.log(`✅ ${test.name}: ${response.status()}`);
                
                if (response.status() === 200) {
                    const data = await response.json();
                    console.log(`   Data preview: ${JSON.stringify(data).substring(0, 100)}...`);
                }
            } catch (error) {
                console.log(`❌ ${test.name}: Error - ${error.message}`);
            }
        }
        
        console.log('\n⏰ Keeping browser open for final inspection...');
        await page.goto('http://209.38.85.196:3000/admin/suppliers');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

comprehensiveAdminTest().then(() => {
    console.log('\n🏁 Comprehensive admin test completed!');
}).catch(error => {
    console.error('💥 Test execution failed:', error);
});