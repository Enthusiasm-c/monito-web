const { chromium } = require('playwright');
const fs = require('fs').promises;

async function analyzeAdminInterface() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('=== ANALYZING ADMIN INTERFACE STRUCTURE ===\n');
    
    // 1. Navigate to admin/suppliers directly
    console.log('1. Testing direct access to /admin/suppliers...');
    await page.goto('http://209.38.85.196:3000/admin/suppliers', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'admin-interface-initial.png',
      fullPage: true
    });
    
    // Wait a moment for any dynamic content
    await page.waitForTimeout(3000);
    
    // Get page title and URL
    const title = await page.title();
    const url = await page.url();
    console.log(`   - Page Title: ${title}`);
    console.log(`   - Current URL: ${url}`);
    
    // Check for authentication loading
    const loadingText = await page.textContent('body').catch(() => '');
    console.log(`   - Body text contains: ${loadingText.slice(0, 200)}...`);
    
    // Check for specific loading indicators
    const loadingSpinner = await page.locator('.animate-spin').count();
    console.log(`   - Loading spinners found: ${loadingSpinner}`);
    
    const authCheckText = await page.locator('text=Checking authentication').count();
    console.log(`   - "Checking authentication" text found: ${authCheckText}`);
    
    // Wait for potential redirect or content load
    console.log('   - Waiting for page to settle...');
    await page.waitForTimeout(5000);
    
    // Check if we got redirected
    const finalUrl = await page.url();
    console.log(`   - Final URL after wait: ${finalUrl}`);
    
    // Take another screenshot after waiting
    await page.screenshot({ 
      path: 'admin-interface-after-wait.png',
      fullPage: true
    });
    
    // 2. Check for login form or admin content
    console.log('\n2. Analyzing page content...');
    
    // Look for login form elements
    const loginForm = await page.locator('form').count();
    const emailInput = await page.locator('input[type="email"], input[name="email"]').count();
    const passwordInput = await page.locator('input[type="password"], input[name="password"]').count();
    const submitButton = await page.locator('button[type="submit"], input[type="submit"]').count();
    
    console.log(`   - Forms found: ${loginForm}`);
    console.log(`   - Email inputs found: ${emailInput}`);
    console.log(`   - Password inputs found: ${passwordInput}`);
    console.log(`   - Submit buttons found: ${submitButton}`);
    
    // Look for admin interface elements
    const tables = await page.locator('table').count();
    const adminTitles = await page.locator('h1, h2, h3').count();
    const buttons = await page.locator('button').count();
    const adminNav = await page.locator('nav').count();
    
    console.log(`   - Tables found: ${tables}`);
    console.log(`   - Headings found: ${adminTitles}`);
    console.log(`   - Buttons found: ${buttons}`);
    console.log(`   - Navigation elements found: ${adminNav}`);
    
    // Get all visible text
    const allText = await page.textContent('body');
    console.log(`   - Total body text length: ${allText.length}`);
    
    // 3. Try to identify specific admin elements
    console.log('\n3. Looking for specific admin elements...');
    
    // Check for supplier-related content
    const supplierTexts = await page.locator('text=supplier').count();
    const addButton = await page.locator('text=Add, button:has-text("Add")').count();
    const editButtons = await page.locator('text=Edit, button:has-text("Edit")').count();
    const deleteButtons = await page.locator('text=Delete, button:has-text("Delete")').count();
    
    console.log(`   - "Supplier" text mentions: ${supplierTexts}`);
    console.log(`   - Add buttons: ${addButton}`);
    console.log(`   - Edit buttons: ${editButtons}`);
    console.log(`   - Delete buttons: ${deleteButtons}`);
    
    // 4. Get DOM structure for analysis
    console.log('\n4. Extracting DOM structure...');
    
    const bodyHTML = await page.locator('body').innerHTML();
    await fs.writeFile('admin-interface-dom.html', bodyHTML);
    console.log('   - DOM structure saved to admin-interface-dom.html');
    
    // Get all element selectors
    const allElements = await page.evaluate(() => {
      const elements = [];
      const traverse = (node, path = []) => {
        if (node.nodeType === 1) { // Element node
          const tagName = node.tagName.toLowerCase();
          const className = node.className || '';
          const id = node.id || '';
          const textContent = node.textContent?.trim().slice(0, 50) || '';
          
          elements.push({
            path: path.concat(tagName).join(' > '),
            tagName,
            className,
            id,
            textContent,
            attributes: Array.from(node.attributes).map(attr => ({
              name: attr.name,
              value: attr.value
            }))
          });
          
          Array.from(node.children).forEach(child => 
            traverse(child, path.concat(tagName))
          );
        }
      };
      
      traverse(document.body);
      return elements;
    });
    
    await fs.writeFile('admin-interface-elements.json', JSON.stringify(allElements, null, 2));
    console.log('   - Element structure saved to admin-interface-elements.json');
    
    // 5. Test API endpoints
    console.log('\n5. Testing API endpoints...');
    
    const apiResponse = await page.request.get('http://209.38.85.196:3000/api/admin/suppliers');
    console.log(`   - API /api/admin/suppliers status: ${apiResponse.status()}`);
    console.log(`   - API response: ${await apiResponse.text()}`);
    
    // 6. Check if login is required
    console.log('\n6. Attempting to access admin after potential redirect...');
    
    if (finalUrl.includes('/login') || finalUrl.includes('/auth')) {
      console.log('   - Appears to have redirected to login page');
      
      // Try to fill login form if it exists
      const emailField = page.locator('input[type="email"], input[name="email"]').first();
      const passwordField = page.locator('input[type="password"], input[name="password"]').first();
      
      if (await emailField.count() > 0 && await passwordField.count() > 0) {
        console.log('   - Login form detected, attempting login...');
        
        await emailField.fill('admin@example.com');
        await passwordField.fill('admin123');
        
        await page.screenshot({ 
          path: 'admin-login-filled.png',
          fullPage: true
        });
        
        // Look for submit button
        const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
          
          const postLoginUrl = await page.url();
          console.log(`   - Post-login URL: ${postLoginUrl}`);
          
          await page.screenshot({ 
            path: 'admin-after-login-attempt.png',
            fullPage: true
          });
        }
      }
    } else {
      console.log('   - No redirect to login detected');
    }
    
    // 7. Final analysis
    console.log('\n7. Final page analysis...');
    const currentUrl = await page.url();
    const currentTitle = await page.title();
    const finalBodyText = await page.textContent('body');
    
    console.log(`   - Final URL: ${currentUrl}`);
    console.log(`   - Final Title: ${currentTitle}`);
    console.log(`   - Final body text (first 300 chars): ${finalBodyText.slice(0, 300)}...`);
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'admin-interface-final.png',
      fullPage: true
    });
    
    // Create summary report
    const report = {
      timestamp: new Date().toISOString(),
      initialUrl: 'http://209.38.85.196:3000/admin/suppliers',
      finalUrl: currentUrl,
      pageTitle: currentTitle,
      analysis: {
        hasLoadingSpinner: loadingSpinner > 0,
        hasAuthCheck: authCheckText > 0,
        hasLoginForm: loginForm > 0 && emailInput > 0 && passwordInput > 0,
        hasAdminContent: tables > 0 || adminTitles > 0,
        totalElements: allElements.length,
        bodyTextLength: finalBodyText.length
      },
      elements: {
        forms: loginForm,
        emailInputs: emailInput,
        passwordInputs: passwordInput,
        submitButtons: submitButton,
        tables: tables,
        headings: adminTitles,
        buttons: buttons,
        navigation: adminNav
      },
      apiTest: {
        suppliersEndpoint: {
          status: apiResponse.status(),
          response: await apiResponse.text()
        }
      }
    };
    
    await fs.writeFile('admin-interface-analysis-report.json', JSON.stringify(report, null, 2));
    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log('Generated files:');
    console.log('- admin-interface-initial.png');
    console.log('- admin-interface-after-wait.png');
    console.log('- admin-interface-final.png');
    console.log('- admin-interface-dom.html');
    console.log('- admin-interface-elements.json');
    console.log('- admin-interface-analysis-report.json');
    
  } catch (error) {
    console.error('Error during analysis:', error);
    await page.screenshot({ 
      path: 'admin-interface-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

// Run the analysis
analyzeAdminInterface().catch(console.error);