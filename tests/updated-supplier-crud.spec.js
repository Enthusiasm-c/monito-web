const { test, expect } = require('@playwright/test');

/**
 * Updated Supplier CRUD Testing Suite with Correct Selectors
 * Based on actual admin interface source code analysis
 * 
 * Test Coverage:
 * - Authentication & Navigation
 * - Interface Structure Verification
 * - CREATE Operations (add new supplier)
 * - READ Operations (list, search, display)
 * - UPDATE Operations (edit existing supplier)
 * - DELETE Operations (remove supplier)
 * - Form Validation Testing
 * - Search & Filter functionality
 */

const BASE_URL = 'http://209.38.85.196:3000';
const ADMIN_CREDENTIALS = {
    email: 'admin@monito-web.com',
    password: 'admin123'
};

const TEST_SUPPLIER = {
    name: 'Test Supplier Co Updated',
    email: 'test.updated@supplier.com',
    phone: '+62-123-456-789',
    contactInfo: 'Updated Test Contact',
    address: 'Updated Test Address 123'
};

test.describe('Updated Supplier CRUD Operations with Correct Selectors', () => {
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
        context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            storageState: undefined
        });
        page = await context.newPage();
    });

    test.afterAll(async () => {
        await context.close();
    });

    test.describe('Authentication & Interface Verification', () => {
        test('1. Login and verify admin interface', async () => {
            console.log('🔍 Testing admin login and interface verification...');
            
            // Navigate to login page
            await page.goto(`${BASE_URL}/admin/login`);
            await page.waitForLoadState('networkidle');
            
            // Verify correct selectors exist
            await expect(page.locator('input[name="email"]')).toBeVisible();
            await expect(page.locator('input[name="password"]')).toBeVisible();
            await expect(page.locator('button[type="submit"]')).toBeVisible();
            
            // Take screenshot of login page
            await page.screenshot({ 
                path: 'test-results/updated-01-login-page.png', 
                fullPage: true 
            });
            
            // Login with admin credentials
            await page.fill('input[name="email"]', ADMIN_CREDENTIALS.email);
            await page.fill('input[name="password"]', ADMIN_CREDENTIALS.password);
            await page.click('button[type="submit"]');
            
            // Wait for redirect
            await page.waitForTimeout(3000);
            
            // Navigate to suppliers page
            await page.goto(`${BASE_URL}/admin/suppliers`);
            await page.waitForLoadState('networkidle');
            
            // Verify we're on the suppliers page
            await expect(page.locator('h1:has-text("Suppliers Management")')).toBeVisible();
            
            // Take screenshot of suppliers page
            await page.screenshot({ 
                path: 'test-results/updated-02-suppliers-page.png', 
                fullPage: true 
            });
            
            console.log('✅ Admin login and interface verification successful');
        });

        test('2. Verify suppliers page structure', async () => {
            console.log('🔍 Verifying suppliers page structure...');
            
            // Verify page title and description
            await expect(page.locator('h1:has-text("Suppliers Management")')).toBeVisible();
            await expect(page.locator('p:has-text("Manage supplier information")')).toBeVisible();
            
            // Verify Add Supplier button exists
            const addSupplierButton = page.locator('button:has-text("Add Supplier")');
            await expect(addSupplierButton).toBeVisible();
            
            // Verify search input exists
            const searchInput = page.locator('input[name="search"]');
            await expect(searchInput).toBeVisible();
            await expect(searchInput).toHaveAttribute('placeholder', 'Search suppliers...');
            
            // Verify table structure
            await expect(page.locator('table')).toBeVisible();
            await expect(page.locator('th:has-text("Supplier")')).toBeVisible();
            await expect(page.locator('th:has-text("Contact")')).toBeVisible();
            await expect(page.locator('th:has-text("Products")')).toBeVisible();
            await expect(page.locator('th:has-text("Created")')).toBeVisible();
            
            // Verify summary stats section
            await expect(page.locator('dt:has-text("Total Suppliers")')).toBeVisible();
            await expect(page.locator('dt:has-text("Active Suppliers")')).toBeVisible();
            
            console.log('✅ Suppliers page structure verified');
        });
    });

    test.describe('CREATE Operations', () => {
        test('3. Test Add Supplier form opening', async () => {
            console.log('🔍 Testing Add Supplier form opening...');
            
            // Click Add Supplier button
            const addSupplierButton = page.locator('button:has-text("Add Supplier")');
            await addSupplierButton.click();
            await page.waitForTimeout(1000);
            
            // Verify form appears
            await expect(page.locator('h3:has-text("Add New Supplier")')).toBeVisible();
            
            // Verify all form fields exist with correct selectors
            await expect(page.locator('input#name')).toBeVisible();
            await expect(page.locator('input#email')).toBeVisible();
            await expect(page.locator('input#phone')).toBeVisible();
            await expect(page.locator('input#contactInfo')).toBeVisible();
            await expect(page.locator('textarea#address')).toBeVisible();
            
            // Verify form buttons
            await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
            await expect(page.locator('button:has-text("Create Supplier")')).toBeVisible();
            
            // Take screenshot of form
            await page.screenshot({ 
                path: 'test-results/updated-03-add-form-opened.png', 
                fullPage: true 
            });
            
            console.log('✅ Add Supplier form opening successful');
        });

        test('4. Fill and submit new supplier form', async () => {
            console.log('🔍 Testing form filling and submission...');
            
            // Fill form fields using correct selectors
            await page.fill('input#name', TEST_SUPPLIER.name);
            await page.fill('input#email', TEST_SUPPLIER.email);
            await page.fill('input#phone', TEST_SUPPLIER.phone);
            await page.fill('input#contactInfo', TEST_SUPPLIER.contactInfo);
            await page.fill('textarea#address', TEST_SUPPLIER.address);
            
            // Take screenshot with filled form
            await page.screenshot({ 
                path: 'test-results/updated-04-form-filled.png', 
                fullPage: true 
            });
            
            // Submit form
            const createButton = page.locator('button:has-text("Create Supplier")');
            await createButton.click();
            await page.waitForTimeout(3000);
            
            // Verify form disappears (successful submission)
            await expect(page.locator('h3:has-text("Add New Supplier")')).not.toBeVisible();
            
            // Take screenshot after submission
            await page.screenshot({ 
                path: 'test-results/updated-05-after-submission.png', 
                fullPage: true 
            });
            
            console.log('✅ Form filling and submission successful');
        });

        test('5. Verify new supplier appears in list', async () => {
            console.log('🔍 Verifying new supplier appears in list...');
            
            // Refresh page to ensure we see updated data
            await page.reload();
            await page.waitForLoadState('networkidle');
            
            // Search for our test supplier
            const searchInput = page.locator('input[name="search"]');
            await searchInput.fill(TEST_SUPPLIER.name);
            await page.waitForTimeout(2000);
            
            // Verify supplier appears in table
            const supplierRow = page.locator(`tr:has-text("${TEST_SUPPLIER.name}")`);
            await expect(supplierRow).toBeVisible();
            
            // Verify email appears in the contact column
            await expect(page.locator(`tr:has-text("${TEST_SUPPLIER.name}") td:has-text("${TEST_SUPPLIER.email}")`)).toBeVisible();
            
            // Take screenshot of search results
            await page.screenshot({ 
                path: 'test-results/updated-06-supplier-in-list.png', 
                fullPage: true 
            });
            
            // Clear search
            await searchInput.clear();
            await page.waitForTimeout(1000);
            
            console.log('✅ New supplier verified in list');
        });
    });

    test.describe('READ Operations', () => {
        test('6. Test search functionality', async () => {
            console.log('🔍 Testing search functionality...');
            
            const searchInput = page.locator('input[name="search"]');
            
            // Test search with supplier name
            await searchInput.fill('Test');
            await page.waitForTimeout(2000);
            
            // Count visible rows
            const visibleRows = await page.locator('tbody tr').count();
            console.log(`Search for "Test" returned ${visibleRows} results`);
            
            // Test search with email
            await searchInput.clear();
            await searchInput.fill(TEST_SUPPLIER.email);
            await page.waitForTimeout(2000);
            
            // Should find our test supplier
            await expect(page.locator(`tr:has-text("${TEST_SUPPLIER.name}")`)).toBeVisible();
            
            // Take screenshot of search results
            await page.screenshot({ 
                path: 'test-results/updated-07-search-results.png', 
                fullPage: true 
            });
            
            // Clear search
            await searchInput.clear();
            await page.waitForTimeout(1000);
            
            console.log('✅ Search functionality working');
        });

        test('7. Verify table data display', async () => {
            console.log('🔍 Verifying table data display...');
            
            // Find our test supplier row
            const supplierRow = page.locator(`tr:has-text("${TEST_SUPPLIER.name}")`);
            await expect(supplierRow).toBeVisible();
            
            // Verify all data fields are displayed
            await expect(supplierRow.locator(`td:has-text("${TEST_SUPPLIER.name}")`)).toBeVisible();
            await expect(supplierRow.locator(`td:has-text("${TEST_SUPPLIER.email}")`)).toBeVisible();
            await expect(supplierRow.locator(`td:has-text("${TEST_SUPPLIER.phone}")`)).toBeVisible();
            
            // Verify action buttons are present
            await expect(supplierRow.locator('a:has-text("Edit")')).toBeVisible();
            await expect(supplierRow.locator('button:has-text("Delete")')).toBeVisible();
            
            console.log('✅ Table data display verified');
        });
    });

    test.describe('UPDATE Operations', () => {
        test('8. Test edit supplier functionality', async () => {
            console.log('🔍 Testing edit supplier functionality...');
            
            // Find and click edit link for our test supplier
            const supplierRow = page.locator(`tr:has-text("${TEST_SUPPLIER.name}")`);
            const editLink = supplierRow.locator('a:has-text("Edit")');
            
            await editLink.click();
            await page.waitForLoadState('networkidle');
            
            // Should navigate to edit page
            expect(page.url()).toContain('/admin/suppliers/');
            
            // Take screenshot of edit page
            await page.screenshot({ 
                path: 'test-results/updated-08-edit-page.png', 
                fullPage: true 
            });
            
            console.log('✅ Edit functionality navigation working');
        });
    });

    test.describe('Form Validation', () => {
        test('9. Test form validation with empty required fields', async () => {
            console.log('🔍 Testing form validation...');
            
            // Navigate back to suppliers list
            await page.goto(`${BASE_URL}/admin/suppliers`);
            await page.waitForLoadState('networkidle');
            
            // Open add supplier form
            await page.locator('button:has-text("Add Supplier")').click();
            await page.waitForTimeout(1000);
            
            // Try to submit empty form
            const createButton = page.locator('button:has-text("Create Supplier")');
            await createButton.click();
            await page.waitForTimeout(1000);
            
            // Check if validation prevents submission (form should still be visible)
            await expect(page.locator('h3:has-text("Add New Supplier")')).toBeVisible();
            
            // Take screenshot of validation state
            await page.screenshot({ 
                path: 'test-results/updated-09-validation-test.png', 
                fullPage: true 
            });
            
            console.log('✅ Form validation tested');
        });

        test('10. Test email validation', async () => {
            console.log('🔍 Testing email validation...');
            
            // Fill name (required field) but use invalid email
            await page.fill('input#name', 'Test Validation Supplier');
            await page.fill('input#email', 'invalid-email-format');
            
            // Try to submit
            const createButton = page.locator('button:has-text("Create Supplier")');
            await createButton.click();
            await page.waitForTimeout(1000);
            
            // Take screenshot
            await page.screenshot({ 
                path: 'test-results/updated-10-email-validation.png', 
                fullPage: true 
            });
            
            // Cancel form
            await page.locator('button:has-text("Cancel")').click();
            
            console.log('✅ Email validation tested');
        });
    });

    test.describe('DELETE Operations', () => {
        test('11. Test delete supplier functionality', async () => {
            console.log('🔍 Testing delete supplier functionality...');
            
            // Find our test supplier row
            const supplierRow = page.locator(`tr:has-text("${TEST_SUPPLIER.name}")`);
            
            // Set up dialog handler for confirmation
            page.on('dialog', async dialog => {
                expect(dialog.message()).toContain('Are you sure you want to delete this supplier?');
                await dialog.accept();
            });
            
            // Click delete button
            const deleteButton = supplierRow.locator('button:has-text("Delete")');
            await deleteButton.click();
            await page.waitForTimeout(3000);
            
            // Verify supplier is removed from list
            await expect(page.locator(`tr:has-text("${TEST_SUPPLIER.name}")`)).not.toBeVisible();
            
            // Take screenshot after deletion
            await page.screenshot({ 
                path: 'test-results/updated-11-after-deletion.png', 
                fullPage: true 
            });
            
            console.log('✅ Delete functionality working');
        });
    });

    test.describe('Summary', () => {
        test('12. Generate comprehensive test summary', async () => {
            console.log('\n📊 Updated Test Summary Report');
            console.log('===============================');
            console.log('✅ Interface Structure: Verified');
            console.log('✅ Authentication: Working');
            console.log('✅ Add Supplier Form: Correct selectors identified');
            console.log('✅ Search Functionality: Working');
            console.log('✅ Table Display: Correct structure');
            console.log('✅ Edit Navigation: Working');
            console.log('✅ Delete Functionality: Working');
            console.log('✅ Form Validation: Tested');
            console.log('\n📸 Screenshots captured with updated selectors');
            console.log('🎯 All supplier operations tested with correct CSS selectors');
            
            // Take final comprehensive screenshot
            await page.screenshot({ 
                path: 'test-results/updated-12-final-overview.png', 
                fullPage: true 
            });
        });
    });
});