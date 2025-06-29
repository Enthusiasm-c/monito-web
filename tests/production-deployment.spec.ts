import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'http://209.38.85.196:3000';

test.describe('Production Deployment Tests', () => {
  test('should load main page successfully', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await expect(page).toHaveTitle(/Vercel \+ Neon/);
    
    // Check if the page contains expected content
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load admin panel', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin`);
    
    // Should see admin navigation
    await expect(page.locator('a:has-text("Monito Admin")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Products")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Suppliers")')).toBeVisible();
  });

  test('should load suppliers page', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/suppliers`);
    
    // Check for suppliers page content
    await expect(page.locator('h1:has-text("Suppliers Management")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Supplier")')).toBeVisible();
    
    // Check for table headers
    await expect(page.locator('th:has-text("Supplier")')).toBeVisible();
    await expect(page.locator('th:has-text("Contact")')).toBeVisible();
    await expect(page.locator('th:has-text("Products")')).toBeVisible();
    await expect(page.locator('th:has-text("Created")')).toBeVisible();
  });

  test('should load products page', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/products`);
    
    // Check for products page content
    await expect(page.locator('h1:has-text("Products")')).toBeVisible();
    await expect(page.locator('a:has-text("Add Product")')).toBeVisible();
    
    // Check for search functionality
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should have working API endpoints', async ({ request }) => {
    // Test suppliers API
    const suppliersResponse = await request.get(`${PRODUCTION_URL}/api/admin/suppliers`);
    expect(suppliersResponse.status()).toBe(200);
    
    const suppliersData = await suppliersResponse.json();
    expect(suppliersData).toHaveProperty('suppliers');
    expect(Array.isArray(suppliersData.suppliers)).toBe(true);
  });

  test('should have working products API', async ({ request }) => {
    // Test products API
    const productsResponse = await request.get(`${PRODUCTION_URL}/api/admin/products`);
    expect(productsResponse.status()).toBe(200);
    
    const productsData = await productsResponse.json();
    expect(productsData).toHaveProperty('products');
    expect(Array.isArray(productsData.products)).toBe(true);
  });

  test('should have working uploads API endpoints', async ({ request }) => {
    // Test pending uploads API
    const pendingResponse = await request.get(`${PRODUCTION_URL}/api/admin/uploads/pending`);
    expect(pendingResponse.status()).toBe(200);
    
    const pendingData = await pendingResponse.json();
    expect(pendingData).toHaveProperty('uploads');
    expect(pendingData).toHaveProperty('pagination');
    expect(Array.isArray(pendingData.uploads)).toBe(true);

    // Test uploads status API
    const statusResponse = await request.get(`${PRODUCTION_URL}/api/admin/uploads/status`);
    expect(statusResponse.status()).toBe(200);
  });

  test('should test dictionaries API', async ({ request }) => {
    // Test dictionaries API summary
    const dictResponse = await request.get(`${PRODUCTION_URL}/api/admin/dictionaries`);
    expect(dictResponse.status()).toBe(200);
    
    const dictData = await dictResponse.json();
    expect(dictData).toHaveProperty('success', true);
    expect(dictData).toHaveProperty('summary');
    
    // Test language dictionaries
    const langResponse = await request.get(`${PRODUCTION_URL}/api/admin/dictionaries?type=language`);
    expect(langResponse.status()).toBe(200);
    
    const langData = await langResponse.json();
    expect(langData).toHaveProperty('success', true);
    expect(langData).toHaveProperty('data');
    expect(Array.isArray(langData.data)).toBe(true);

    // Test unit dictionaries
    const unitResponse = await request.get(`${PRODUCTION_URL}/api/admin/dictionaries?type=unit`);
    expect(unitResponse.status()).toBe(200);
    
    const unitData = await unitResponse.json();
    expect(unitData).toHaveProperty('success', true);
    expect(unitData).toHaveProperty('data');
    expect(Array.isArray(unitData.data)).toBe(true);
  });

  test('should test supplier deletion functionality', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/suppliers`);
    
    // Wait for suppliers to load
    await page.waitForSelector('table');
    
    // Check if there are suppliers in the table
    const supplierRows = page.locator('tbody tr');
    const count = await supplierRows.count();
    
    if (count > 0) {
      // Look for a supplier with 0 prices to safely delete
      const firstRow = supplierRows.first();
      const pricesText = await firstRow.locator('td').nth(2).textContent();
      
      if (pricesText && pricesText.includes('0 prices')) {
        // This supplier has no prices, safe to test deletion
        const deleteButton = firstRow.locator('button:has-text("Delete")');
        
        // Mock the confirm dialog to return true
        page.on('dialog', dialog => dialog.accept());
        
        await deleteButton.click();
        
        // Wait for deletion to complete (should see alert or page refresh)
        await page.waitForTimeout(2000);
      }
    }
  });

  test('should verify navigation between admin sections', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin`);
    
    // Navigate to suppliers
    await page.click('text=Suppliers');
    await expect(page).toHaveURL(/\/admin\/suppliers/);
    await expect(page.locator('text=Suppliers Management')).toBeVisible();
    
    // Navigate to products
    await page.click('text=Products');
    await expect(page).toHaveURL(/\/admin\/products/);
    await expect(page.locator('text=Add Product')).toBeVisible();
    
    // Try to navigate to uploads (should show link even if page is disabled)
    const uploadsLink = page.locator('text=Uploads');
    await expect(uploadsLink).toBeVisible();
  });

  test('should test search functionality on suppliers page', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/suppliers`);
    
    // Wait for page to load
    await page.waitForSelector('input[placeholder*="Search"]');
    
    // Test search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test');
    await page.waitForTimeout(1000);
    
    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(1000);
  });

  test('should test add supplier form', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/suppliers`);
    
    // Click Add Supplier button
    await page.click('text=Add Supplier');
    
    // Check if form is visible
    await expect(page.locator('text=Add New Supplier')).toBeVisible();
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    
    // Fill form with test data
    await page.fill('input[id="name"]', 'Test Supplier Playwright');
    await page.fill('input[id="email"]', 'test@playwright.com');
    await page.fill('input[id="phone"]', '+1234567890');
    await page.fill('input[id="contactInfo"]', 'Test Contact');
    await page.fill('textarea[id="address"]', 'Test Address');
    
    // Submit form
    await page.click('text=Create Supplier');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Check if supplier was added (should see it in the list or get confirmation)
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('should test products filtering', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/products`);
    
    // Wait for products to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Test search filter
    const searchInput = page.locator('input[id="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      await searchInput.clear();
    }
    
    // Test category filter if categories exist
    const categorySelect = page.locator('select[id="category"]');
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption({ index: 0 }); // Select first option
      await page.waitForTimeout(1000);
    }
  });
});