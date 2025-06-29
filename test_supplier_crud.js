const { chromium } = require('playwright');

async function testSupplierCRUD() {
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
        
        console.log('🔍 Testing Supplier CRUD Operations...');
        
        // Login as admin
        await page.goto('http://209.38.85.196:3000/admin/login');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[name="email"]', 'admin@monito-web.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // Navigate to suppliers page
        await page.goto('http://209.38.85.196:3000/admin/suppliers');
        await page.waitForLoadState('networkidle');
        
        console.log('✅ Logged in and navigated to suppliers page');
        
        // Test 1: Click Add Supplier button
        console.log('\n📝 Testing Add Supplier functionality...');
        
        const addSupplierBtn = page.locator('button:has-text("Add Supplier")');
        await addSupplierBtn.click();
        await page.waitForTimeout(2000);
        
        // Take screenshot of what opens (modal, new page, etc.)
        await page.screenshot({ path: 'add-supplier-modal.png', fullPage: true });
        console.log('📸 Add Supplier modal/form screenshot taken');
        
        // Check if a modal opened
        const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
        const isModalVisible = await modal.isVisible().catch(() => false);
        
        if (isModalVisible) {
            console.log('✅ Modal opened for adding supplier');
            
            // Look for form fields
            const nameField = page.locator('input[name="name"], input[placeholder*="name"], input[label*="name"]').first();
            const emailField = page.locator('input[name="email"], input[type="email"], input[placeholder*="email"]').first();
            const phoneField = page.locator('input[name="phone"], input[type="tel"], input[placeholder*="phone"]').first();
            
            if (await nameField.isVisible()) {
                await nameField.fill('Test Supplier');
                console.log('✅ Name field filled');
            }
            
            if (await emailField.isVisible()) {
                await emailField.fill('test@supplier.com');
                console.log('✅ Email field filled');
            }
            
            if (await phoneField.isVisible()) {
                await phoneField.fill('+1234567890');
                console.log('✅ Phone field filled');
            }
            
            // Take screenshot with filled form
            await page.screenshot({ path: 'supplier-form-filled.png', fullPage: true });
            
            // Look for submit button
            const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create"), button:has-text("Add")').first();
            
            if (await submitBtn.isVisible()) {
                console.log('✅ Submit button found');
                await submitBtn.click();
                await page.waitForTimeout(3000);
                
                // Check if supplier was added
                await page.screenshot({ path: 'after-supplier-submit.png', fullPage: true });
                
                // Look for success message or new supplier in list
                const successMessage = await page.locator('[class*="success"], [class*="alert-success"], .text-green-500').textContent().catch(() => null);
                if (successMessage) {
                    console.log(`✅ Success message: ${successMessage}`);
                }
                
                // Check if supplier appears in the list
                const supplierRows = await page.locator('table tr').count();
                if (supplierRows > 1) { // More than just header
                    console.log(`✅ Supplier table now has ${supplierRows} rows`);
                } else {
                    console.log('❌ No suppliers found in table');
                }
            }
            
        } else {
            console.log('❌ No modal opened, checking if redirected to form page');
            
            // Check if we were redirected to a form page
            const currentUrl = page.url();
            console.log(`Current URL: ${currentUrl}`);
            
            if (currentUrl.includes('add') || currentUrl.includes('new')) {
                console.log('✅ Redirected to add supplier form page');
                await page.screenshot({ path: 'add-supplier-page.png', fullPage: true });
            }
        }
        
        // Test 2: Try to search for existing suppliers
        console.log('\n🔍 Testing supplier search...');
        
        // Go back to suppliers list
        await page.goto('http://209.38.85.196:3000/admin/suppliers');
        await page.waitForLoadState('networkidle');
        
        const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('test');
            await page.waitForTimeout(2000);
            
            await page.screenshot({ path: 'supplier-search.png', fullPage: true });
            console.log('✅ Search functionality tested');
        }
        
        // Test 3: Check filter functionality
        console.log('\n🔧 Testing filters...');
        
        const categoryFilter = page.locator('select, [role="combobox"]').first();
        if (await categoryFilter.isVisible()) {
            await categoryFilter.click();
            await page.waitForTimeout(1000);
            
            await page.screenshot({ path: 'supplier-filters.png', fullPage: true });
            console.log('✅ Filter dropdown accessible');
        }
        
        // Test 4: Test pagination (if any data exists)
        console.log('\n📄 Testing pagination...');
        
        const paginationElements = await page.locator('[aria-label*="pagination"], .pagination, [class*="pagination"]').count();
        if (paginationElements > 0) {
            console.log('✅ Pagination elements found');
            await page.screenshot({ path: 'supplier-pagination.png', fullPage: true });
        } else {
            console.log('ℹ️ No pagination found (likely due to no data)');
        }
        
        // Test 5: Check if we can access supplier details/edit
        console.log('\n✏️ Testing supplier row actions...');
        
        // Look for action buttons in table rows
        const actionButtons = await page.locator('button:has-text("Edit"), button:has-text("View"), button:has-text("Delete"), a:has-text("Edit")').count();
        console.log(`Found ${actionButtons} action buttons`);
        
        if (actionButtons > 0) {
            const firstActionButton = page.locator('button:has-text("Edit"), button:has-text("View"), a:has-text("Edit")').first();
            await firstActionButton.click();
            await page.waitForTimeout(2000);
            
            await page.screenshot({ path: 'supplier-action.png', fullPage: true });
            console.log('✅ Supplier action tested');
        }
        
        // Final screenshot of the admin panel
        await page.goto('http://209.38.85.196:3000/admin/suppliers');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'final-admin-state.png', fullPage: true });
        
        console.log('\n⏰ Keeping browser open for final inspection...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testSupplierCRUD().then(() => {
    console.log('\n🏁 Supplier CRUD test completed!');
}).catch(error => {
    console.error('💥 Test execution failed:', error);
});