# 🔍 Debugging Guide - Upload Issues

## Quick Diagnosis for Upload ID: eea152313b6f4c6a905588ef777c2120

### 1. 🚀 Quick Access Debug Tools

**Debug Dashboard**: `/debug`
- Interactive upload testing
- Real-time error reporting
- Upload history and logs

**API Endpoints**:
```bash
# Check upload logs
GET /api/upload-logs

# Test upload with detailed debugging
POST /api/upload-debug

# Check environment status
POST /api/upload-debug (shows env validation)
```

### 2. 🔧 Common Issues & Solutions

#### **Environment Variables Missing**
```bash
# Required variables:
DATABASE_URL='postgresql://...'      # ✅ Database connection
OPENAI_API_KEY='sk-...'             # ⚠️  AI processing (optional)
BLOB_READ_WRITE_TOKEN='...'         # ⚠️  File storage (optional)
```

**Symptoms**: Files fail to upload, "Upload failed" errors
**Solution**: Add missing environment variables in Vercel dashboard

#### **Database Connection Issues**
**Symptoms**: 500 errors, "Database connection failed"
**Check**: 
```bash
curl -X POST /api/upload-debug
# Look for "Database connected successfully" ✅
```

#### **File Size/Type Issues**
**Limits**: 
- Max file size: 10MB
- Supported types: PDF, Excel, CSV, PNG, JPG

**Check**:
```bash
# Upload with debug endpoint shows file validation
curl -X POST /api/upload-debug -F "files=@yourfile.xlsx"
```

#### **Prisma/Database Schema Issues**
**Symptoms**: Database errors during upload creation
**Fix**:
```bash
# In production - runs automatically via postinstall
npx prisma generate && npx prisma migrate deploy
```

### 3. 🧪 Testing Workflow

1. **Environment Check**:
   ```bash
   curl -X POST /api/upload-debug
   # Check debug.environment section
   ```

2. **Database Test**:
   ```bash
   curl /api/suppliers
   # Should return supplier list
   ```

3. **Upload Test**:
   ```bash
   curl -X POST /api/upload-debug -F "files=@test.csv"
   # Follow detailed logs
   ```

4. **Check Results**:
   ```bash
   curl /api/upload-logs
   # Review upload history and errors
   ```

### 4. 📊 Debug Output Interpretation

**Successful Upload**:
```json
{
  "message": "Upload process completed",
  "results": [
    {
      "status": "uploaded",
      "filename": "test.csv"
    }
  ],
  "debug": {
    "environment": {
      "hasBlob": true,
      "hasOpenAI": true,
      "hasDatabase": true
    }
  }
}
```

**Failed Upload**:
```json
{
  "error": "Database connection failed",
  "debug": {
    "dbError": "Connection timeout"
  }
}
```

### 5. 🔄 Fallback Behavior

The system gracefully handles missing services:

- **No Blob Storage**: Uses mock URLs, still processes data
- **No OpenAI**: Creates sample data for testing
- **Database Issues**: Clear error messages with details

### 6. 🆘 Emergency Fixes

#### Clear Failed Uploads:
```bash
curl -X DELETE "/api/upload-logs?clearAll=true"
```

#### Reset Test Data:
```bash
curl -X POST /api/seed
```

#### Manual Supplier Creation:
```bash
curl -X POST /api/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Supplier","email":"test@example.com"}'
```

### 7. 📱 Debug Dashboard Features

Navigate to `/debug` for:

- **📊 Upload Statistics**: Success/failure rates
- **🧪 File Upload Testing**: Drag & drop with instant feedback  
- **📋 Upload Logs**: Detailed history with error messages
- **🔄 Real-time Refresh**: Live status updates
- **🧹 Cleanup Tools**: Remove failed uploads

### 8. 🚨 Production Debugging

For production issues (like ID: eea152313b6f4c6a905588ef777c2120):

1. Check Vercel function logs
2. Verify environment variables are set
3. Test with `/debug` page
4. Review upload logs via `/api/upload-logs`
5. Use `/api/upload-debug` for detailed error reporting

The debug system provides comprehensive visibility into all upload failures and helps identify configuration issues quickly.