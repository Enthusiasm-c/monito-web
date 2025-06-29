# Admin Interface Structure Analysis Guide

## Manual Testing Steps with Playwright MCP Server

### Step 1: Authentication Analysis

1. **Navigate to Login Page**
   ```bash
   # Open http://209.38.85.196:3000/admin/login
   ```

2. **Inspect Login Elements**
   - Email input: `input[name="email"]`
   - Password input: `input[name="password"]`
   - Submit button: `button[type="submit"]`
   - Take screenshot: "login-page-structure.png"

3. **Login Process**
   - Fill credentials: admin@monito-web.com / admin123
   - Submit form
   - Wait for redirect to `/admin/suppliers`

### Step 2: Suppliers Page Structure Analysis

1. **Page Elements to Inspect**
   ```css
   /* Main page title */
   h1:has-text("Suppliers Management")
   
   /* Add Supplier button */
   button:has-text("Add Supplier")
   
   /* Search input */
   input[name="search"]
   input#search
   
   /* Main table */
   table.min-w-full.divide-y.divide-gray-300
   
   /* Table headers */
   th:has-text("Supplier")
   th:has-text("Contact")
   th:has-text("Products")
   th:has-text("Created")
   ```

2. **Screenshots to Take**
   - "suppliers-page-overview.png" - Full page
   - "suppliers-table-structure.png" - Table area
   - "suppliers-summary-stats.png" - Bottom stats section

### Step 3: Add Supplier Form Analysis

1. **Open Add Form**
   ```javascript
   // Click the Add Supplier button
   await page.locator('button:has-text("Add Supplier")').click();
   ```

2. **Form Structure Inspection**
   ```css
   /* Form container */
   h3:has-text("Add New Supplier")
   
   /* Form fields */
   input#name              /* Required field */
   input#email[type="email"]
   input#phone
   input#contactInfo
   textarea#address
   
   /* Form buttons */
   button:has-text("Cancel")
   button:has-text("Create Supplier")
   ```

3. **Form Behavior Testing**
   - Fill all fields with test data
   - Test form validation (empty required fields)
   - Test email validation
   - Submit form and verify behavior

### Step 4: Table Data and Actions Analysis

1. **Table Row Structure**
   ```css
   /* Supplier rows */
   tr:has-text("supplier-name")
   
   /* Data cells */
   td:has-text("supplier-name")
   td:has-text("email@domain.com")
   td:has-text("phone-number")
   
   /* Action buttons */
   a:has-text("Edit")
   button:has-text("Delete")
   ```

2. **Actions to Test**
   - Click Edit link → Should navigate to `/admin/suppliers/{id}`
   - Click Delete button → Should show confirmation dialog
   - Verify row data displays correctly

### Step 5: Search Functionality Analysis

1. **Search Input Testing**
   ```css
   input[name="search"]
   input[placeholder="Search suppliers..."]
   ```

2. **Search Behavior**
   - Search by supplier name
   - Search by email
   - Search by contact info
   - Verify filtered results
   - Clear search and verify full list returns

### Step 6: Browser Developer Tools Analysis

1. **Use Browser DevTools to Inspect**
   ```javascript
   // Open DevTools and run in console:
   console.log("Add Supplier Button:", document.querySelector('button:has-text("Add Supplier")'));
   console.log("Search Input:", document.querySelector('input[name="search"]'));
   console.log("Table:", document.querySelector('table'));
   ```

2. **Element Identification**
   - Right-click elements → Inspect
   - Copy CSS selectors
   - Note any dynamic classes or IDs
   - Check for data attributes

### Step 7: Modal and Dynamic Content Analysis

1. **Check for Dynamic Behavior**
   - Form appearance/disappearance
   - Loading states
   - Error messages
   - Success notifications

2. **State Changes to Monitor**
   ```css
   /* Loading states */
   .animate-spin
   
   /* Error states */
   .text-red-600
   .text-red-800
   
   /* Success states */
   .text-green-500
   ```

## Correct CSS Selectors Summary

Based on source code analysis, here are the verified selectors:

### Authentication
- **Login email**: `input[name="email"]`
- **Login password**: `input[name="password"]`
- **Login submit**: `button[type="submit"]`

### Main Page Elements
- **Page title**: `h1:has-text("Suppliers Management")`
- **Add button**: `button:has-text("Add Supplier")`
- **Search input**: `input[name="search"]` or `input#search`

### Add Supplier Form
- **Form title**: `h3:has-text("Add New Supplier")`
- **Name field**: `input#name`
- **Email field**: `input#email`
- **Phone field**: `input#phone`
- **Contact field**: `input#contactInfo`
- **Address field**: `textarea#address`
- **Cancel button**: `button:has-text("Cancel")`
- **Submit button**: `button:has-text("Create Supplier")`

### Table Structure
- **Main table**: `table.min-w-full`
- **Supplier rows**: `tbody tr`
- **Edit links**: `a:has-text("Edit")`
- **Delete buttons**: `button:has-text("Delete")`

### Data Verification
- **Supplier name in table**: `tr:has-text("supplier-name")`
- **Email in contact column**: `td:has-text("email@domain.com")`
- **Actions column**: `td.text-right`

## Test Data Recommendations

```javascript
const TEST_SUPPLIER = {
    name: 'Test Supplier Co',
    email: 'test@supplier.com',
    phone: '+62-123-456-789',
    contactInfo: 'Test Contact Person',
    address: 'Test Address 123, Test City'
};
```

## Screenshots to Capture

1. **login-page-structure.png** - Login page with form fields
2. **suppliers-page-overview.png** - Main suppliers page
3. **add-form-opened.png** - Add supplier form displayed
4. **form-filled.png** - Form with test data filled
5. **table-with-data.png** - Table showing suppliers
6. **search-results.png** - Search functionality results
7. **edit-page.png** - Edit supplier page
8. **validation-errors.png** - Form validation states

## Common Issues to Watch For

1. **Timing Issues**
   - Form may take time to appear/disappear
   - Table data may need time to load
   - Search results may be debounced

2. **Dynamic Classes**
   - Tailwind CSS classes may change
   - Loading states may show/hide elements

3. **Navigation**
   - Edit links navigate to different pages
   - Form submission may reload page

4. **Validation**
   - Client-side validation may prevent form submission
   - Server-side validation may show error messages

## Playwright MCP Commands to Use

If you have access to Playwright MCP tools, use these commands:

```javascript
// Navigate and screenshot
await page.goto('http://209.38.85.196:3000/admin/login');
await page.screenshot({ path: 'login-page.png', fullPage: true });

// Fill and submit form
await page.fill('input[name="email"]', 'admin@monito-web.com');
await page.fill('input[name="password"]', 'admin123');
await page.click('button[type="submit"]');

// Wait for navigation
await page.waitForURL('**/admin/suppliers');

// Test add supplier
await page.click('button:has-text("Add Supplier")');
await page.fill('input#name', 'Test Supplier');
await page.click('button:has-text("Create Supplier")');
```

This analysis provides the exact structure needed to update your test selectors and ensure accurate testing of the admin interface.