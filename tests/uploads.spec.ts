import { test, expect } from '@playwright/test';

test.describe('Admin Uploads Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to uploads admin page
    await page.goto('http://localhost:3000/admin/uploads');
    await page.waitForLoadState('networkidle');
  });

  test('should display uploads page with correct title and layout', async ({ page }) => {
    // Check page title and header
    await expect(page.locator('h1')).toContainText('Upload Management');
    await expect(page.locator('p')).toContainText('Review and approve pending uploads from suppliers');
    
    // Check navigation is active
    await expect(page.locator('nav a[href="/admin/uploads"]')).toHaveClass(/border-indigo-500/);
    await expect(page.locator('nav a[href="/admin/uploads"]')).toHaveClass(/text-indigo-600/);
  });

  test('should display statistics cards', async ({ page }) => {
    // Wait for statistics to load
    await page.waitForLoadState('networkidle');
    
    // Check all 4 statistics cards are present
    const statCards = page.locator('.grid .bg-white.overflow-hidden.shadow.rounded-lg');
    await expect(statCards).toHaveCount(4);
    
    // Check specific statistics
    await expect(page.locator('dt').filter({ hasText: 'Pending Review' })).toBeVisible();
    await expect(page.locator('dt').filter({ hasText: 'Total Products' })).toBeVisible();
    await expect(page.locator('dt').filter({ hasText: 'Avg Completeness' })).toBeVisible();
    await expect(page.locator('dt').filter({ hasText: 'Processing Cost' })).toBeVisible();
  });

  test('should show empty state when no uploads pending', async ({ page }) => {
    // Wait for uploads to load
    await page.waitForSelector('.bg-white.shadow.overflow-hidden');
    
    // Check pending uploads section
    await expect(page.locator('h3')).toContainText('Pending Uploads (0)');
    
    // Should show empty state
    await expect(page.locator('h3').filter({ hasText: 'No pending uploads' })).toBeVisible();
    await expect(page.locator('p').filter({ hasText: 'All uploads have been processed or reviewed.' })).toBeVisible();
  });

  test('should have refresh button that works', async ({ page }) => {
    const refreshButton = page.locator('button').filter({ hasText: 'Refresh' });
    await expect(refreshButton).toBeVisible();
    
    // Click refresh button
    await refreshButton.click();
    
    // Button should show loading state temporarily
    await expect(refreshButton).toContainText('Refreshing...');
    
    // Wait for refresh to complete
    await expect(refreshButton).toContainText('Refresh');
  });

  test('should handle navigation back to admin dashboard', async ({ page }) => {
    // Click on admin breadcrumb
    await page.locator('a[href="/admin"]').click();
    
    // Should navigate to admin dashboard
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('Monito Administration');
  });

  test('should navigate to other admin sections', async ({ page }) => {
    // Test navigation to Products
    await page.locator('nav a[href="/admin/products"]').click();
    await expect(page).toHaveURL('/admin/products');
    
    // Go back to uploads
    await page.goto('/admin/uploads');
    
    // Test navigation to Suppliers
    await page.locator('nav a[href="/admin/suppliers"]').click();
    await expect(page).toHaveURL('/admin/suppliers');
  });

  test('should auto-refresh every 30 seconds', async ({ page }) => {
    // Mock the API call to track refresh requests
    let refreshCount = 0;
    await page.route('/api/uploads/pending*', (route) => {
      refreshCount++;
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          uploads: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        })
      });
    });
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    const initialCount = refreshCount;
    
    // Wait 31 seconds for auto-refresh (we'll speed this up with page.clock)
    await page.clock.install();
    await page.clock.fastForward(31000);
    
    // Should have made another request
    expect(refreshCount).toBeGreaterThan(initialCount);
  });
});

test.describe('Admin Uploads with Mock Data', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API with sample upload data
    await page.route('/api/uploads/pending*', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          uploads: [
            {
              id: 'upload-1',
              originalName: 'Bali Organics Price List.pdf',
              fileName: 'upload-1.pdf',
              fileSize: 1024 * 1024 * 2, // 2MB
              mimeType: 'application/pdf',
              status: 'completed',
              approvalStatus: 'pending_review',
              createdAt: new Date().toISOString(),
              completenessRatio: 0.95,
              processingCostUsd: 0.015,
              totalRowsDetected: 150,
              totalRowsProcessed: 143,
              estimatedProductsCount: 143,
              extractedProducts: [
                { 
                  originalName: 'Nasi Merah Organik',
                  standardizedName: 'Rice Red Organic',
                  originalUnit: 'kg',
                  standardizedUnit: 'kg',
                  category: 'grains',
                  confidence: 95
                }
              ],
              supplier: {
                id: 'supplier-1',
                name: 'Bali Organics',
                email: 'orders@baliorganics.com'
              },
              url: '/uploads/upload-1.pdf'
            },
            {
              id: 'upload-2',
              originalName: 'Jakarta Fresh Vegetables.xlsx',
              fileName: 'upload-2.xlsx',
              fileSize: 1024 * 512, // 512KB
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              status: 'completed',
              approvalStatus: 'pending_review',
              createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
              completenessRatio: 0.88,
              processingCostUsd: 0.008,
              totalRowsDetected: 75,
              totalRowsProcessed: 66,
              estimatedProductsCount: 66,
              extractedProducts: [],
              supplier: {
                id: 'supplier-2',
                name: 'Jakarta Fresh Market',
                email: 'info@jakartafresh.id'
              },
              url: '/uploads/upload-2.xlsx'
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1
          }
        })
      });
    });

    await page.goto('/admin/uploads');
  });

  test('should display uploads list with correct data', async ({ page }) => {
    // Wait for uploads to load
    await page.waitForLoadState('networkidle');
    
    // Check statistics show correct values
    await expect(page.locator('dd').filter({ hasText: '2' })).toBeVisible(); // Pending Review
    await expect(page.locator('dd').filter({ hasText: '209' })).toBeVisible(); // Total Products (143+66)
    await expect(page.locator('dd').filter({ hasText: '92%' })).toBeVisible(); // Avg Completeness
    await expect(page.locator('dd').filter({ hasText: '$0.023' })).toBeVisible(); // Processing Cost
    
    // Check uploads list
    await expect(page.locator('h3')).toContainText('Pending Uploads (2)');
    
    // Check individual upload items
    await expect(page.locator('text=Bali Organics Price List.pdf')).toBeVisible();
    await expect(page.locator('text=Jakarta Fresh Vegetables.xlsx')).toBeVisible();
    
    // Check supplier names
    await expect(page.locator('text=Bali Organics')).toBeVisible();
    await expect(page.locator('text=Jakarta Fresh Market')).toBeVisible();
    
    // Check file sizes and product counts
    await expect(page.locator('text=2 MB • 143 products')).toBeVisible();
    await expect(page.locator('text=512 KB • 66 products')).toBeVisible();
  });

  test('should show action buttons for each upload', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Each upload should have Preview, Approve, and Reject buttons
    const uploadItems = page.locator('li');
    
    for (let i = 0; i < 2; i++) {
      const item = uploadItems.nth(i);
      await expect(item.locator('button').filter({ hasText: 'Preview' })).toBeVisible();
      await expect(item.locator('button').filter({ hasText: 'Approve' })).toBeVisible();
      await expect(item.locator('button').filter({ hasText: 'Reject' })).toBeVisible();
    }
  });

  test('should open preview mode when Preview button is clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click preview button on first upload
    await page.locator('button').filter({ hasText: 'Preview' }).first().click();
    
    // Should show preview interface
    await expect(page.locator('h1')).toContainText('Preview Upload: Bali Organics Price List.pdf');
    await expect(page.locator('p').filter({ hasText: 'Supplier: Bali Organics • 143 products detected' })).toBeVisible();
    
    // Should have action buttons in preview
    await expect(page.locator('button').filter({ hasText: 'Approve' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Reject' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Back to List' })).toBeVisible();
    
    // Click back to list
    await page.locator('button').filter({ hasText: 'Back to List' }).click();
    
    // Should return to uploads list
    await expect(page.locator('h1')).toContainText('Upload Management');
  });

  test('should handle approve action', async ({ page }) => {
    // Mock the approve API
    await page.route('/api/uploads/approve', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          productsCreated: 143,
          message: 'Upload approved successfully. Created 143 products.'
        })
      });
    });

    await page.waitForLoadState('networkidle');
    
    // Click approve button on first upload
    await page.locator('button').filter({ hasText: 'Approve' }).first().click();
    
    // Should show success alert
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Upload approved successfully! Created 143 products.');
      await dialog.accept();
    });
  });

  test('should handle reject action', async ({ page }) => {
    // Mock the reject API
    await page.route('/api/uploads/reject', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Upload rejected successfully.'
        })
      });
    });

    await page.waitForLoadState('networkidle');
    
    // Click reject button on first upload
    await page.locator('button').filter({ hasText: 'Reject' }).first().click();
    
    // Should prompt for rejection reason
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        expect(dialog.message()).toContain('Please provide a reason for rejection:');
        await dialog.accept('Incorrect data format');
      } else if (dialog.type() === 'alert') {
        expect(dialog.message()).toContain('Upload rejected successfully.');
        await dialog.accept();
      }
    });
  });

  test('should disable buttons during processing', async ({ page }) => {
    // Mock slow approve API
    await page.route('/api/uploads/approve', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, productsCreated: 143 })
      });
    });

    await page.waitForLoadState('networkidle');
    
    const approveButton = page.locator('button').filter({ hasText: 'Approve' }).first();
    
    // Click approve button
    await approveButton.click();
    
    // Button should be disabled and show "Approving..."
    await expect(approveButton).toBeDisabled();
    await expect(approveButton).toContainText('Approving...');
  });

  test('should show correct status badges', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Should show "Pending Review" badges
    const badges = page.locator('.inline-flex.items-center.px-2\\.5.py-0\\.5.rounded-full');
    await expect(badges.filter({ hasText: 'Pending Review' })).toHaveCount(2);
    
    // Check badge styling
    await expect(badges.first()).toHaveClass(/bg-yellow-100/);
    await expect(badges.first()).toHaveClass(/text-yellow-800/);
  });

  test('should format file sizes correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check file size formatting
    await expect(page.locator('text=2 MB')).toBeVisible(); // 2MB file
    await expect(page.locator('text=512 KB')).toBeVisible(); // 512KB file
  });

  test('should format timestamps correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Should show relative timestamps
    const timestamps = page.locator('text=/Uploaded .+ ago/');
    await expect(timestamps).toHaveCount(2);
  });
});