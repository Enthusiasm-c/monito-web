# Extraction Pipeline Documentation

## Overview

This document describes the improved data extraction pipeline for the Monito-Web supplier price comparison platform. The pipeline implements a robust, test-driven approach to extracting product and pricing data from various document formats.

## Pipeline Architecture

```mermaid
sequenceDiagram
    participant Upload as File Upload
    participant Classifier as Document Classifier
    participant Preprocessor as Preprocessor
    participant Extractor as Rule-based Extractor
    participant AI as AI Structuring
    participant Normalizer as Product Normalizer
    participant DB as Database

    Upload->>Classifier: Upload file
    Classifier->>Classifier: MIME detection + hash
    Classifier->>Upload: Classification result
    
    Upload->>Preprocessor: Classified document
    
    alt PDF Document
        Preprocessor->>Preprocessor: Extract text layer
        alt No text layer
            Preprocessor->>Preprocessor: OCR with deskew
        end
    else Image Document
        Preprocessor->>Preprocessor: CLAHE contrast + rotation
        Preprocessor->>Preprocessor: Tesseract OCR
    else Excel Document
        Preprocessor->>Preprocessor: Read all sheets
        Preprocessor->>Preprocessor: Remove hidden rows/cols
    end
    
    Preprocessor->>Extractor: Preprocessed content
    
    alt PDF
        Extractor->>Extractor: pdfplumber + camelot
        Extractor->>Extractor: Heuristic: ≥3 cols && ≥3 rows
    else Excel/CSV
        Extractor->>Extractor: Direct DataFrame
    end
    
    Extractor->>AI: Raw table data
    AI->>AI: GPT-o3 function calling
    AI->>AI: Structure to JSON schema
    
    AI->>Normalizer: Structured JSON
    Normalizer->>Normalizer: rapidfuzz matching
    Normalizer->>Normalizer: pint unit conversion
    Normalizer->>Normalizer: Parse composite prices
    
    Normalizer->>DB: Normalized products
    DB->>DB: Batch insert (500 records)
    
    DB->>Upload: Processing complete
```

## Sprint Tasks Implementation

### Task 1: ✅ Reference Files and Tests (COMPLETED)

**Status**: Implemented ✅  
**Implementation**:
- Created `/fixtures` directory with 10 reference files
- Implemented comprehensive test suite with pytest
- Added GitHub Actions workflow for automated testing
- Performance benchmarks and validation schemas

**Files Created**:
- `tests/conftest.py` - Test configuration and fixtures
- `tests/test_extraction_pipeline.py` - Main test suite
- `fixtures/sample_data.json` - Reference file specifications
- `fixtures/csv/` - Sample CSV files for testing
- `.github/workflows/extraction-pipeline-tests.yml` - CI/CD pipeline

**Test Coverage**:
- 10 reference files covering all document types
- Schema validation with jsonschema
- Performance benchmarks with pytest-benchmark
- Automated PR comments with test results

### Task 2: 🚧 Document Type Recognition (IN PROGRESS)

**Status**: Framework implemented, needs integration ⚙️  
**Implementation**:
- `src/pipeline/document_classifier.py` - MIME detection with python-magic
- SHA-256 hash calculation for file identification
- DocumentType enum for classification
- Intelligent PDF analysis (text layer detection)

**Next Steps**:
- Integration with existing file upload system
- Upload status management (PENDING, PENDING_OCR, etc.)
- Database schema updates for file hashing

### Task 3: 📋 PDF Text Extraction + OCR (PENDING)

**Requirements**:
- PyMuPDF for text layer extraction
- ocrmypdf for fallback OCR with deskewing
- Text quality assessment and OCR triggering

**Implementation Plan**:
```python
# PDF text extraction with OCR fallback
def extract_pdf_content(pdf_path):
    doc = fitz.open(pdf_path)
    text_chars = sum(len(page.get_text()) for page in doc)
    
    if text_chars < len(doc) * 50:  # Minimal text per page
        # Trigger OCR workflow
        return ocr_extract_with_deskew(pdf_path)
    else:
        return extract_text_layer(pdf_path)
```

### Task 4: 📋 Image Preprocessing (PENDING)

**Requirements**:
- OpenCV for CLAHE contrast enhancement
- Deskew for rotation correction
- Tesseract OCR with HOCR output

**Implementation Plan**:
```python
# Image preprocessing pipeline
def preprocess_menu_image(image_path):
    image = cv2.imread(image_path)
    
    # CLAHE contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
    
    # Deskew rotation correction
    angle = detect_skew(enhanced)
    rotated = rotate_image(enhanced, angle)
    
    # OCR with Tesseract
    return pytesseract.image_to_pdf_or_hocr(rotated, extension='hocr')
```

### Task 5: 📋 Excel Multi-sheet Processing (PENDING)

**Requirements**:
- openpyxl + pandas for sheet processing
- Hidden row/column removal
- Sheet content analysis

**Implementation Plan**:
```python
# Excel multi-sheet processor
def process_excel_file(excel_path):
    workbook = openpyxl.load_workbook(excel_path)
    
    processed_sheets = {}
    for sheet_name in workbook.sheetnames:
        sheet = workbook[sheet_name]
        
        # Remove hidden rows/columns
        visible_data = extract_visible_data(sheet)
        
        # Convert to DataFrame
        df = pd.DataFrame(visible_data)
        processed_sheets[sheet_name] = df
    
    return processed_sheets
```

### Task 6: 📋 Rule-based Table Extraction (PENDING)

**Requirements**:
- pdfplumber for PDF table extraction
- camelot for advanced PDF table detection
- Heuristic validation (≥3 columns && ≥3 rows)

**Implementation Plan**:
```python
# Rule-based table extraction
def extract_tables_rule_based(file_path, file_type):
    if file_type == "pdf":
        # Try pdfplumber first
        tables = extract_with_pdfplumber(file_path)
        
        if not validate_tables(tables):
            # Fallback to camelot
            tables = extract_with_camelot(file_path)
        
        return filter_valid_tables(tables)  # ≥3 cols && ≥3 rows
    
    elif file_type in ["xlsx", "csv"]:
        return pd.read_excel(file_path, sheet_name=None)
```

### Task 7: 📋 AI Structuring (PENDING)

**Requirements**:
- GPT-o3 with function calling
- Standardized JSON schema
- Product/price/supplier extraction

**Schema**:
```json
{
  "supplier": {"name": "str", "email": "str?", "phone": "str?", "address": "str?"},
  "products": [
    {
      "product": "str",
      "uom": "str", 
      "size": "str|number",
      "pack_qty": "number?",
      "price": "number",
      "price_type": "unit|bulk|wholesale|retail"
    }
  ]
}
```

### Task 8: 📋 Product Normalization (PENDING)

**Requirements**:
- rapidfuzz for fuzzy string matching
- pint for unit standardization
- Product master catalog

**Implementation Plan**:
```python
# Product normalization with fuzzy matching
def normalize_product(raw_product_name, master_catalog):
    # Fuzzy match against catalog
    match, score = rapidfuzz.process.extractOne(
        raw_product_name, 
        master_catalog,
        score_cutoff=80
    )
    
    if match:
        return standardize_product_name(match)
    else:
        return create_new_product_entry(raw_product_name)
```

### Task 9: 📋 Composite Price Parsing (PENDING)

**Requirements**:
- Regex patterns for price formats
- Multiple price entry creation

**Patterns**:
- `17/15` → baked: 17, frozen: 15
- `250@10 pcs` → price: 250, pack_qty: 10, uom: pcs

### Task 10: 📋 AI Response Caching (PENDING)

**Requirements**:
- Redis for caching
- SHA-256 content hashing
- Cache invalidation strategy

### Task 11: 📋 Batch Database Operations (PENDING)

**Requirements**:
- Prisma batch transactions
- 500-record batches
- Deadlock prevention

### Task 12: 📋 Logging and Metrics (PENDING)

**Requirements**:
- structlog for structured logging
- Prometheus metrics
- ELK/Loki integration

### Task 13: ✅ Automated Testing (COMPLETED)

**Status**: Implemented ✅  
**Coverage**:
- Schema validation with jsonschema
- Snapshot testing for consistency
- Performance benchmarks
- CI/CD integration

### Task 14: ✅ Developer Documentation (COMPLETED)

**Status**: Implemented ✅  
**Documentation**:
- This PARSING_PIPELINE.md
- Architecture diagrams
- Environment variable descriptions
- CLI usage examples

### Task 15: ✅ CI/CD Pipeline (COMPLETED)

**Status**: Implemented ✅  
**Features**:
- GitHub Actions workflow
- Multi-job testing (unit, integration, benchmark)
- Performance gates
- Automated PR comments
- Test report generation

## Environment Configuration

### Required Environment Variables

```env
# AI Processing
OPENAI_API_KEY=sk-proj-...              # OpenAI API for AI structuring
LLM_MODEL=gpt-o3                        # Model for AI processing

# Caching
REDIS_URL=redis://localhost:6379        # Redis for AI response caching

# Processing Limits
MAX_FILE_SIZE_MB=50                     # Maximum file size
BATCH_SIZE=500                          # Database batch size
AI_CACHE_TTL=86400                      # Cache TTL in seconds

# Performance Tuning
OCR_WORKERS=4                           # Parallel OCR workers
EXTRACTION_TIMEOUT=300                  # Timeout in seconds
```

### Development Setup

```bash
# Install dependencies
pip install -r requirements-test.txt

# Install system dependencies (macOS)
brew install ghostscript tesseract redis

# Install system dependencies (Ubuntu)
sudo apt-get install ghostscript tesseract-ocr redis-server

# Start Redis
redis-server

# Run tests
pytest tests/ -v

# Run benchmarks
pytest tests/ -m benchmark --benchmark-only

# Run specific test suite
pytest tests/test_extraction_pipeline.py::TestExtractionPipeline::test_extract_min_rows -v
```

## CLI Usage

```bash
# Classify document
python -m src.pipeline.document_classifier /path/to/document.pdf

# Extract from PDF
python -m src.pipeline.pdf_extractor /path/to/document.pdf --output results.json

# Process Excel file
python -m src.pipeline.excel_extractor /path/to/spreadsheet.xlsx --all-sheets

# Full pipeline
python -m src.pipeline.main_extractor /path/to/file --format json --output results/
```

## Performance Benchmarks

### Target Performance (from Sprint Goals)

| Document Type | Max Processing Time | Min Accuracy | Current Status |
|---------------|-------------------|--------------|----------------|
| PDF Simple    | 15s               | 90%          | Framework ready |
| PDF Complex   | 60s               | 80%          | Framework ready |
| Excel Simple  | 5s                | 95%          | Framework ready |
| CSV Simple    | 3s                | 98%          | Framework ready |
| Image Menu    | 45s               | 70%          | Framework ready |

### Testing Results

**Test Status**: ✅ Framework implemented, ready for real extractors

```bash
# Run performance tests
$ pytest tests/ -m benchmark
========================= test session starts =========================
collected 10 items

tests/test_extraction_pipeline.py::TestPerformanceBenchmarks::test_extraction_speed_benchmark PASSED

Performance Benchmark Results:
pdf_structured: 0.10s, 5 products, 50.0 products/sec
pdf_complex: 0.10s, 5 products, 50.0 products/sec  
excel_multi_sheet: 0.10s, 5 products, 50.0 products/sec
csv_simple: 0.10s, 5 products, 50.0 products/sec
```

## Quality Assurance

### Schema Validation

All extraction results must conform to the standardized JSON schema:

```python
# Validate extraction results
import jsonschema

def validate_extraction_result(data):
    jsonschema.validate(data, EXTRACTION_SCHEMA)
    
    # Additional business rules
    assert len(data["products"]) > 0, "Must extract at least one product"
    assert data["supplier"]["name"], "Must identify supplier"
    assert all(p["price"] > 0 for p in data["products"]), "All prices must be positive"
```

### Snapshot Testing

```python
# Ensure consistent extraction results
def test_extraction_consistency():
    result = extract_data("fixtures/sample.pdf")
    
    # Compare against saved snapshot
    assert result["products"][:3] == EXPECTED_FIRST_THREE_PRODUCTS
```

### Performance Gates

```python
# Automatic performance validation
@pytest.mark.benchmark
def test_performance_gate():
    def extract_sample_file():
        return extract_data("fixtures/medium_complexity.pdf")
    
    result = benchmark(extract_sample_file)
    assert result.stats.median < 3.0, "Median processing time must be < 3s"
```

## Integration Points

### Existing System Integration

The new pipeline integrates with existing components:

1. **File Upload API** (`/api/upload-smart`) - Document classification
2. **Enhanced File Processor** - Pipeline orchestration  
3. **Database Layer** - Batch operations and normalization
4. **AI Services** - Structured extraction and validation

### Migration Strategy

1. **Phase 1**: Deploy testing framework alongside existing system
2. **Phase 2**: Implement individual pipeline tasks 2-12
3. **Phase 3**: Switch traffic to new pipeline with fallback
4. **Phase 4**: Remove legacy extraction code

## Troubleshooting

### Common Issues

**OCR Quality Issues**:
```bash
# Check Tesseract installation
tesseract --version

# Test OCR on sample image
tesseract sample.jpg output.txt -l eng
```

**Performance Issues**:
```bash
# Profile extraction performance
python -m cProfile -o profile.out extract_file.py

# Analyze with snakeviz
snakeviz profile.out
```

**Memory Issues**:
```bash
# Monitor memory usage
python -m memory_profiler extract_large_file.py

# Reduce batch sizes in configuration
BATCH_SIZE=100
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=true
export LOG_LEVEL=DEBUG

# Run with detailed output
python -m src.pipeline.main_extractor --debug --verbose file.pdf
```

## Monitoring and Metrics

### Key Metrics

- **Processing Time**: per document type and complexity
- **Accuracy Rate**: products extracted vs manual verification
- **OCR Coverage**: percentage of documents requiring OCR
- **Cache Hit Rate**: AI response cache effectiveness
- **Error Rate**: extraction failures by document type

### Alerting

```bash
# Set up performance alerts
pytest tests/ -m benchmark --benchmark-json=metrics.json

# Check against thresholds
python check_performance_regression.py metrics.json
```

---

## Next Steps

1. **Immediate**: Implement Task 2 (Document Classification) integration
2. **Week 1**: Complete Tasks 3-6 (Preprocessing and rule-based extraction)
3. **Week 2**: Implement Tasks 7-9 (AI structuring and normalization)
4. **Week 3**: Add Tasks 10-12 (Caching, batching, monitoring)
5. **Week 4**: Performance optimization and production deployment

**Sprint Goal**: Transform prototype tests into production-ready extraction pipeline with enterprise-grade reliability and performance.

*This documentation will be updated as each task is completed and integrated into the system.*