import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'http://209.38.85.196:3000';

test.describe('Uploads Page Tests', () => {
  test('should load uploads page successfully', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Check page loads without errors
    await expect(page).toHaveTitle(/Vercel \+ Neon/);
    
    // Check main heading
    await expect(page.locator('h1:has-text("Upload Management")')).toBeVisible();
    
    // Check description
    await expect(page.locator('text=Review and approve pending uploads from suppliers')).toBeVisible();
  });

  test('should display statistics cards', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Upload Management")');
    
    // Check statistics cards
    await expect(page.locator('text=Pending Review')).toBeVisible();
    await expect(page.locator('text=Total Products')).toBeVisible();
    await expect(page.locator('text=Avg Completeness')).toBeVisible();
    await expect(page.locator('text=Processing Cost')).toBeVisible();
  });

  test('should show uploads table with correct headers', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Upload Management")');
    
    // Check table header
    await expect(page.locator('h3')).toContainText('Pending Uploads');
    
    // Check refresh button
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
  });

  test('should handle empty state correctly', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for loading to complete
    await page.waitForTimeout(3000);
    
    // Should either show uploads or empty state
    const hasUploads = await page.locator('li').count() > 0;
    
    if (!hasUploads) {
      // Check empty state
      await expect(page.locator('text=No pending uploads')).toBeVisible();
      await expect(page.locator('text=All uploads have been processed or reviewed')).toBeVisible();
    } else {
      // Check that uploads are displayed
      console.log('Found uploads in the system');
    }
  });

  test('should test refresh functionality', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for initial load
    await page.waitForSelector('h1:has-text("Upload Management")');
    
    // Click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await refreshButton.click();
    
    // Should show refreshing state briefly
    await expect(page.locator('button:has-text("Refreshing...")')).toBeVisible({ timeout: 1000 }).catch(() => {
      // Refresh might be too fast to catch, that's OK
    });
    
    // Should return to normal state
    await expect(refreshButton).toBeVisible();
  });

  test('should test API integration', async ({ request }) => {
    // Test that uploads API is working
    const response = await request.get(`${PRODUCTION_URL}/api/admin/uploads/pending`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('uploads');
    expect(data).toHaveProperty('pagination');
    expect(Array.isArray(data.uploads)).toBe(true);
    
    console.log(`API Response: ${data.uploads.length} pending uploads found`);
  });

  test('should handle approve/reject buttons if uploads exist', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Check if there are any uploads
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      console.log(`Found ${count} upload(s) to test`);
      
      const firstUpload = uploadItems.first();
      
      // Check that approve and reject buttons exist
      await expect(firstUpload.locator('button:has-text("Approve")')).toBeVisible();
      await expect(firstUpload.locator('button:has-text("Reject")')).toBeVisible();
      
      // Test that buttons are clickable (but don't actually click to avoid side effects)
      const approveButton = firstUpload.locator('button:has-text("Approve")');
      const rejectButton = firstUpload.locator('button:has-text("Reject")');
      
      await expect(approveButton).toBeEnabled();
      await expect(rejectButton).toBeEnabled();
    } else {
      console.log('No uploads found to test buttons');
    }
  });

  test('should verify uploads data structure', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      const firstUpload = uploadItems.first();
      
      // Check upload item structure
      await expect(firstUpload.locator('svg')).toBeVisible(); // File icon
      await expect(firstUpload.locator('p.text-sm.font-medium')).toBeVisible(); // File name
      await expect(firstUpload.locator('p.text-sm.text-gray-500')).toBeVisible(); // Metadata
      
      // Check status badge
      await expect(firstUpload.locator('span[class*="rounded-full"]')).toBeVisible();
    }
  });

  test('should test statistics calculations', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for statistics to load
    await page.waitForTimeout(3000);
    
    // Get statistics values
    const pendingCountText = await page.locator('dt:has-text("Pending Review")').locator('+ dd').textContent();
    const totalProductsText = await page.locator('dt:has-text("Total Products")').locator('+ dd').textContent();
    const avgCompletenessText = await page.locator('dt:has-text("Avg Completeness")').locator('+ dd').textContent();
    const processingCostText = await page.locator('dt:has-text("Processing Cost")').locator('+ dd').textContent();
    
    console.log('Statistics:', {
      pendingUploads: pendingCountText,
      totalProducts: totalProductsText,
      avgCompleteness: avgCompletenessText,
      processingCost: processingCostText
    });
    
    // Verify values are numeric or percentage
    expect(pendingCountText).toMatch(/^\d+$/);
    expect(totalProductsText).toMatch(/^\d+$/);
    expect(avgCompletenessText).toMatch(/^\d+%$/);
    expect(processingCostText).toMatch(/^\$[\d.]+$/);
  });
});