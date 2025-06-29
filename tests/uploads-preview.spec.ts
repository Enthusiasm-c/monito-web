import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'http://209.38.85.196:3000';

test.describe('Uploads Preview Functionality', () => {
  test('should display Preview button for each upload', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for uploads to load
    await page.waitForTimeout(3000);
    
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      console.log(`Found ${count} upload(s) with Preview buttons`);
      
      const firstUpload = uploadItems.first();
      
      // Check that Preview button exists
      await expect(firstUpload.locator('button:has-text("Preview")')).toBeVisible();
      
      // Check that all three buttons are present
      await expect(firstUpload.locator('button:has-text("Preview")')).toBeVisible();
      await expect(firstUpload.locator('button:has-text("Approve")')).toBeVisible();
      await expect(firstUpload.locator('button:has-text("Reject")')).toBeVisible();
      
      console.log('✓ All action buttons (Preview, Approve, Reject) are visible');
    } else {
      console.log('No uploads found to test Preview functionality');
    }
  });

  test('should open preview mode when clicking Preview button', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for uploads to load
    await page.waitForTimeout(3000);
    
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      const firstUpload = uploadItems.first();
      const previewButton = firstUpload.locator('button:has-text("Preview")');
      
      // Get upload name for verification
      const uploadName = await firstUpload.locator('p.text-sm.font-medium').textContent();
      console.log(`Testing preview for upload: ${uploadName}`);
      
      // Click Preview button
      await previewButton.click();
      
      // Wait for preview mode to load
      await page.waitForTimeout(2000);
      
      // Check that we're in preview mode
      await expect(page.locator('h1')).toContainText('Preview Upload:');
      
      // Check for Back to List button
      await expect(page.locator('button:has-text("Back to List")')).toBeVisible();
      
      // Check for the two-panel layout
      await expect(page.locator('div[class*="grid-cols-1 lg:grid-cols-2"]')).toBeVisible();
      
      console.log('✓ Preview mode opened successfully');
      
      // Test going back to list
      await page.click('button:has-text("Back to List")');
      
      // Should be back to main uploads list
      await expect(page.locator('h1:has-text("Upload Management")')).toBeVisible();
      
      console.log('✓ Back to List functionality works');
    } else {
      console.log('No uploads available to test preview mode');
    }
  });

  test('should display file viewer and data comparison in preview', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for uploads to load
    await page.waitForTimeout(3000);
    
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      const firstUpload = uploadItems.first();
      await firstUpload.locator('button:has-text("Preview")').click();
      
      // Wait for preview to load
      await page.waitForTimeout(3000);
      
      // Check for file viewer section (left panel)
      await expect(page.locator('text=Исходный файл:')).toBeVisible();
      
      // Check for data comparison section (right panel)
      await expect(page.locator('text=Распознанные данные')).toBeVisible();
      
      // Check for data quality indicators
      const hasErrorIndicators = await page.locator('text=Критичные ошибки').isVisible();
      const hasWarningIndicators = await page.locator('text=Предупреждения').isVisible();
      
      if (hasErrorIndicators && hasWarningIndicators) {
        console.log('✓ Data quality indicators found');
      }
      
      // Check for table structure in data comparison
      const hasTable = await page.locator('table').isVisible();
      if (hasTable) {
        // Check for table headers
        await expect(page.locator('th:has-text("Название продукта")')).toBeVisible();
        await expect(page.locator('th:has-text("Цена")')).toBeVisible();
        await expect(page.locator('th:has-text("Единица")')).toBeVisible();
        await expect(page.locator('th:has-text("Статус")')).toBeVisible();
        
        console.log('✓ Data comparison table structure is correct');
      }
      
    } else {
      console.log('No uploads available to test preview panels');
    }
  });

  test('should test file viewer functionality for different file types', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for uploads to load
    await page.waitForTimeout(3000);
    
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      // Test each upload to see different file types
      for (let i = 0; i < Math.min(count, 2); i++) {
        const upload = uploadItems.nth(i);
        const fileName = await upload.locator('p.text-sm.font-medium').textContent();
        
        console.log(`Testing file viewer for: ${fileName}`);
        
        await upload.locator('button:has-text("Preview")').click();
        await page.waitForTimeout(2000);
        
        // Check if file viewer loaded
        const fileViewerExists = await page.locator('text=Исходный файл:').isVisible();
        expect(fileViewerExists).toBe(true);
        
        // Check for file type handling
        if (fileName?.includes('.xlsx') || fileName?.includes('.xls')) {
          // Excel files should show download option
          const hasDownloadLink = await page.locator('text=Скачать и открыть').isVisible();
          if (hasDownloadLink) {
            console.log('✓ Excel file handling detected');
          }
        }
        
        if (fileName?.includes('.pdf')) {
          // PDF files should show iframe
          const hasIframe = await page.locator('iframe').isVisible();
          if (hasIframe) {
            console.log('✓ PDF file handling detected');
          }
        }
        
        // Go back for next iteration
        await page.click('button:has-text("Back to List")');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should test approve/reject functionality from preview mode', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for uploads to load
    await page.waitForTimeout(3000);
    
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      const firstUpload = uploadItems.first();
      await firstUpload.locator('button:has-text("Preview")').click();
      
      // Wait for preview to load
      await page.waitForTimeout(2000);
      
      // Check that approve/reject buttons are available in preview mode
      await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      await expect(page.locator('button:has-text("Reject")')).toBeVisible();
      
      // Verify buttons are enabled (not disabled)
      const approveButton = page.locator('button:has-text("Approve")');
      const rejectButton = page.locator('button:has-text("Reject")');
      
      const approveEnabled = await approveButton.isEnabled();
      const rejectEnabled = await rejectButton.isEnabled();
      
      expect(approveEnabled).toBe(true);
      expect(rejectEnabled).toBe(true);
      
      console.log('✓ Approve/Reject buttons are functional in preview mode');
      
      // Test that buttons work (but don't actually click to avoid side effects)
      // Just verify they're clickable
      await expect(approveButton).toBeEnabled();
      await expect(rejectButton).toBeEnabled();
      
    } else {
      console.log('No uploads available to test approve/reject in preview');
    }
  });

  test('should verify responsive layout in preview mode', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/admin/uploads`);
    
    // Wait for uploads to load
    await page.waitForTimeout(3000);
    
    const uploadItems = page.locator('li[class*="px-4 py-4"]');
    const count = await uploadItems.count();
    
    if (count > 0) {
      const firstUpload = uploadItems.first();
      await firstUpload.locator('button:has-text("Preview")').click();
      
      // Wait for preview to load
      await page.waitForTimeout(2000);
      
      // Check desktop layout (side-by-side)
      const gridContainer = page.locator('div[class*="grid-cols-1 lg:grid-cols-2"]');
      await expect(gridContainer).toBeVisible();
      
      // Check that both panels are present
      const leftPanel = gridContainer.locator('> div').first();
      const rightPanel = gridContainer.locator('> div').last();
      
      await expect(leftPanel).toBeVisible();
      await expect(rightPanel).toBeVisible();
      
      console.log('✓ Two-panel layout is working correctly');
      
      // Check header information
      await expect(page.locator('text=Supplier:')).toBeVisible();
      await expect(page.locator('text=products detected')).toBeVisible();
      
      console.log('✓ Preview header information is displayed');
      
    }
  });
});