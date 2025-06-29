import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'http://209.38.85.196:3000';

test.describe('API Endpoints Testing', () => {
  test('should test all admin API endpoints', async ({ request }) => {
    console.log('Testing admin API endpoints...');

    // Test suppliers API
    const suppliersResponse = await request.get(`${PRODUCTION_URL}/api/admin/suppliers`);
    expect(suppliersResponse.status()).toBe(200);
    const suppliersData = await suppliersResponse.json();
    console.log(`Suppliers API: ${suppliersData.suppliers?.length || 0} suppliers found`);

    // Test products API
    const productsResponse = await request.get(`${PRODUCTION_URL}/api/admin/products`);
    expect(productsResponse.status()).toBe(200);
    const productsData = await productsResponse.json();
    console.log(`Products API: ${productsData.products?.length || 0} products found`);

    // Test uploads pending API
    const uploadsResponse = await request.get(`${PRODUCTION_URL}/api/admin/uploads/pending`);
    expect(uploadsResponse.status()).toBe(200);
    const uploadsData = await uploadsResponse.json();
    console.log(`Uploads API: ${uploadsData.uploads?.length || 0} pending uploads`);

    // Test uploads status API
    const statusResponse = await request.get(`${PRODUCTION_URL}/api/admin/uploads/status`);
    expect(statusResponse.status()).toBe(200);
    console.log('Uploads status API: working');

    // Test dictionaries API
    const dictResponse = await request.get(`${PRODUCTION_URL}/api/admin/dictionaries`);
    expect(dictResponse.status()).toBe(200);
    const dictData = await dictResponse.json();
    console.log(`Dictionaries API: ${dictData.summary?.total || 0} total entries`);
  });

  test('should test specific API functionality', async ({ request }) => {
    // Test supplier creation
    const newSupplier = {
      name: 'Test API Supplier',
      email: 'test-api@playwright.com',
      phone: '+1234567890',
      contactInfo: 'API Test Contact',
      address: 'API Test Address'
    };

    const createResponse = await request.post(`${PRODUCTION_URL}/api/admin/suppliers`, {
      data: newSupplier
    });
    
    if (createResponse.status() === 200 || createResponse.status() === 201) {
      const createdSupplier = await createResponse.json();
      console.log(`Created supplier: ${createdSupplier.supplier?.name}`);
      
      // Clean up - delete the test supplier
      if (createdSupplier.supplier?.id) {
        const deleteResponse = await request.delete(`${PRODUCTION_URL}/api/admin/suppliers/${createdSupplier.supplier.id}`, {
          data: { force: true }
        });
        console.log(`Cleanup: ${deleteResponse.status() === 200 ? 'Success' : 'Failed'}`);
      }
    } else {
      console.log(`Supplier creation failed: ${createResponse.status()}`);
    }
  });

  test('should test data integrity', async ({ request }) => {
    // Test that we get valid JSON responses
    const endpoints = [
      '/api/admin/suppliers',
      '/api/admin/products', 
      '/api/admin/uploads/pending',
      '/api/admin/dictionaries?type=language',
      '/api/admin/dictionaries?type=unit'
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${PRODUCTION_URL}${endpoint}`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
      
      console.log(`${endpoint}: Valid JSON response ✓`);
    }
  });

  test('should test error handling', async ({ request }) => {
    // Test 404 for non-existent supplier
    const notFoundResponse = await request.get(`${PRODUCTION_URL}/api/admin/suppliers/non-existent-id`);
    expect(notFoundResponse.status()).toBe(404);
    console.log('404 handling: Working ✓');

    // Test invalid dictionary type
    const invalidDictResponse = await request.get(`${PRODUCTION_URL}/api/admin/dictionaries?type=invalid`);
    expect(invalidDictResponse.status()).toBe(200); // Should return empty or summary
    console.log('Invalid parameter handling: Working ✓');
  });

  test('should test uploads API thoroughly', async ({ request }) => {
    // Test all uploads endpoints
    const uploadsEndpoints = [
      '/api/admin/uploads/pending',
      '/api/admin/uploads/status', 
      '/api/admin/uploads/pending-count'
    ];

    for (const endpoint of uploadsEndpoints) {
      const response = await request.get(`${PRODUCTION_URL}${endpoint}`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      console.log(`${endpoint}: ${JSON.stringify(data).length} bytes response`);
    }
  });
});