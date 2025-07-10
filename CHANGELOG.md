# Changelog

All notable changes to this project will be documented in this file.

## [2.1.1] - 2025-07-10

### Fixed
- **Major Syntax Fixes**: Resolved 40+ syntax errors across multiple service files
  - Fixed missing commas in object literals in `DatabaseService.ts`
  - Fixed object property syntax in `tokenCostMonitor.ts`
  - Added missing commas after methods in `priceValidator.ts` and `JobQueue.ts`
  - Fixed bracket balance issues in API route files

- **Import Path Corrections**: Fixed 13 files with incorrect relative import paths
  - Corrected imports for `DatabaseService` and `utils/errors`
  - Fixed paths in bot prices compare routes
  - Fixed paths in admin routes for products, suppliers, and uploads

- **Admin Dashboard Updates**:
  - Fixed static statistics display to show real-time data
  - Now correctly shows 3,318 products and 30 suppliers
  - Added dynamic loading of statistics from API

- **API Route Fixes**:
  - Fixed `/api/admin/products` endpoint to use correct method signature
  - Fixed `/api/admin/suppliers` endpoint to properly return paginated data
  - Resolved compilation errors in multiple route handlers

### Improved
- Enhanced error handling in database service methods
- Better pagination display in admin supplier management page

## [2.1.0] - 2025-07-09

### Added
- Real-time progress tracking with Server-Sent Events (SSE)
- Support for up to 3 simultaneous file uploads
- AI Model Updates: OpenAI API now uses max_completion_tokens for o3-mini

### Changed
- Schema Updates: processingDetails field changed from String to Json type

### Fixed
- Price Analytics public API access restored
- Database cleanup: Removed failed uploads and duplicates
- Performance optimization: Enhanced file processing pipeline

## [2.0.0] - 2025-07-07

### Added
- Complete July 2025 data integration
- 3,318 products tracked
- 31 verified suppliers integrated
- Real-time price tracking with 6-month history

### Features
- Multi-supplier price comparison
- AI-powered product standardization
- Intelligent file processing (Excel, PDF, CSV, Images)
- Indonesian market optimization