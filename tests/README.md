# Comprehensive Supplier CRUD Testing Suite

This directory contains a comprehensive Playwright test suite for testing all supplier CRUD (Create, Read, Update, Delete) operations in the Monito Web application.

## 🎯 Test Coverage

The test suite comprehensively covers all aspects of supplier management:

### Authentication & Navigation
- ✅ Navigate to admin login page
- ✅ Login with admin credentials (admin@monito-web.com / admin123)
- ✅ Navigate to suppliers section
- ✅ Verify page accessibility and UI elements

### READ Operations
- ✅ Verify suppliers list displays correctly
- ✅ Check all supplier data fields are visible (name, email, phone, contact info, address)
- ✅ Test pagination functionality if available
- ✅ Capture comprehensive screenshots of the interface

### CREATE Operations
- ✅ Test "Add Supplier" button functionality
- ✅ Fill in new supplier form with test data
- ✅ Submit form and verify supplier creation
- ✅ Verify new supplier appears in the list
- ✅ Handle both modal and page-based forms

### UPDATE Operations
- ✅ Find and access supplier editing functionality
- ✅ Test editing supplier name, email, and phone
- ✅ Save changes and verify they are applied
- ✅ Test inline editing if available

### DELETE Operations
- ✅ Test supplier deletion functionality
- ✅ Handle deletion confirmation dialogs
- ✅ Verify supplier is removed from the list

### Error Handling & Validation
- ✅ Test form validation with empty required fields
- ✅ Test duplicate supplier name handling
- ✅ Test invalid email format validation
- ✅ Capture validation error states

### Search & Filter
- ✅ Test search functionality with supplier names
- ✅ Test available filter options
- ✅ Verify search results accuracy

## 🚀 Running the Tests

### Prerequisites

1. Ensure Playwright is installed:
```bash
npm install --save-dev @playwright/test
npx playwright install
```

2. Make sure the Monito Web application is running at `http://209.38.85.196:3000`

3. Verify admin credentials are working:
   - Email: `admin@monito-web.com`
   - Password: `admin123`

### Execution Options

#### Option 1: Using the Test Runner Script (Recommended)
```bash
# Run headless (default)
node run-supplier-tests.js

# Run with visible browser
node run-supplier-tests.js --headed

# Run in debug mode (step-by-step)
node run-supplier-tests.js --debug

# Run with verbose output
node run-supplier-tests.js --verbose
```

#### Option 2: Using NPM Scripts
```bash
# Run supplier tests headless
npm run test:suppliers

# Run supplier tests with visible browser
npm run test:suppliers:headed

# Run all Playwright tests
npm run test:playwright
```

#### Option 3: Direct Playwright Commands
```bash
# Run the comprehensive test suite
npx playwright test tests/comprehensive-supplier-crud.spec.js

# Run with browser visible
npx playwright test tests/comprehensive-supplier-crud.spec.js --headed

# Run in debug mode
npx playwright test tests/comprehensive-supplier-crud.spec.js --debug
```

## 📊 Test Results & Reports

After running tests, you'll find results in the `test-results/` directory:

### Screenshots (26 Total)
- `01-login-page.png` - Initial login page
- `02-credentials-filled.png` - Login form with credentials
- `03-after-login.png` - Admin dashboard after login
- `04-suppliers-page.png` - Suppliers management page
- `05-suppliers-list.png` - Complete suppliers list view
- `06-supplier-data-fields.png` - Data field visibility
- `07-pagination-test.png` - Pagination functionality
- `08-complete-suppliers-overview.png` - Complete overview
- `09-add-supplier-opened.png` - Add supplier form/modal
- `10-form-filled.png` - Form with test data
- `11-after-submit.png` - After form submission
- `12-updated-suppliers-list.png` - List with new supplier
- `13-edit-form-opened.png` - Edit supplier form
- `14-fields-edited.png` - Form with edited values
- `15-after-save.png` - After saving changes
- `16-inline-editing.png` - Inline editing test
- `17-delete-confirmation.png` - Delete confirmation dialog
- `18-after-deletion.png` - After supplier deletion
- `19-list-after-deletion.png` - Updated list after deletion
- `20-validation-errors.png` - Form validation errors
- `21-duplicate-test.png` - Duplicate supplier test
- `22-email-validation.png` - Email format validation
- `23-search-results.png` - Search functionality
- `24-filter-options.png` - Filter options
- `25-final-state.png` - Final application state
- `26-final-overview.png` - Complete final overview

### Reports
- `html-report/index.html` - Interactive HTML test report
- `results.json` - Detailed JSON test results
- Console output with detailed test progress

## 🔧 Test Configuration

The test suite is configured with:
- **Timeout**: 5 minutes per test, 20 minutes total
- **Retries**: 1 retry on failure (2 on CI)
- **Browser**: Chromium (1920x1080 viewport)
- **Speed**: 500ms delay between actions for visibility
- **Screenshots**: Captured on failure and key test points
- **Videos**: Recorded on failure

## 🐛 Troubleshooting

### Common Issues

1. **Server Not Available**
   - Ensure `http://209.38.85.196:3000` is accessible
   - Check network connectivity
   - Verify server is running

2. **Authentication Failures**
   - Verify admin credentials: `admin@monito-web.com` / `admin123`
   - Check if credentials have changed
   - Ensure login page is accessible

3. **Element Not Found**
   - UI might have changed - check screenshots
   - Selectors might need updating
   - Page might be loading slowly

4. **Test Timeouts**
   - Server might be slow to respond
   - Increase timeout in configuration
   - Check network latency

### Debug Mode

Use debug mode for step-by-step execution:
```bash
node run-supplier-tests.js --debug
```

This allows you to:
- Step through each test action
- Inspect elements in browser dev tools
- Modify test behavior in real-time

## 📝 Test Data

The test suite uses the following test data:

```javascript
const TEST_SUPPLIER = {
    name: 'Test Supplier Co',
    email: 'test@supplier.com',
    phone: '+62-123-456-789',
    contactInfo: 'Test Contact',
    address: 'Test Address 123'
};
```

## 🔄 Maintenance

### Updating Tests

If the UI changes, you may need to update:
1. **Selectors** - Element selectors in the test file
2. **Test Data** - Sample data used in tests
3. **Timeouts** - Adjust if page load times change
4. **Screenshots** - Expected vs actual screenshot comparisons

### Adding New Tests

To add new test cases:
1. Follow the existing test structure
2. Use descriptive test names
3. Include proper console logging
4. Capture screenshots at key points
5. Update this README with new test descriptions

## 📋 Test Checklist

Use this checklist to verify all functionality:

- [ ] Can navigate to admin login page
- [ ] Can login with admin credentials
- [ ] Can access suppliers management page
- [ ] Suppliers list displays with data
- [ ] Can add new supplier successfully
- [ ] New supplier appears in list
- [ ] Can edit existing supplier
- [ ] Changes are saved and visible
- [ ] Can delete supplier with confirmation
- [ ] Supplier is removed from list
- [ ] Form validation works for empty fields
- [ ] Email validation works for invalid formats
- [ ] Search functionality works
- [ ] Filters work (if available)
- [ ] All screenshots captured successfully

## 🆘 Support

If you encounter issues with the test suite:

1. Check the generated screenshots in `test-results/`
2. Review the HTML report for detailed error information
3. Run tests in headed mode to see browser actions
4. Use debug mode for step-by-step execution
5. Check server logs for backend issues

For UI-related issues, the screenshots provide visual evidence of the current state vs expected behavior.