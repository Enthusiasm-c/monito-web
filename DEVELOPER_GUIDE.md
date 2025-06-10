# 👨‍💻 Developer Guide

## Getting Started

This guide provides detailed information for developers working on the Monito-Web project.

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ (recommended: use nvm)
- PostgreSQL database (local or Neon)
- OpenAI API key
- Vercel account (for blob storage)
- Python 3.8+ (for PDF processing)

### Environment Configuration

Create `.env` file in project root:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/monito_web"

# AI Services
OPENAI_API_KEY="your_openai_api_key"

# File Storage
BLOB_READ_WRITE_TOKEN="your_vercel_blob_token"

# Optional: Development settings
NODE_ENV="development"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Installation
```bash
# Clone repository
git clone https://github.com/your-org/monito-web.git
cd monito-web

# Install dependencies
npm install

# Install Python dependencies for PDF processing
pip install camelot-py[cv] pandas requests

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Seed development database (optional)
curl -X POST http://localhost:3001/api/seed
```

### Running the Application
```bash
# Start development server
npm run dev

# Run with logging
npm run dev 2>&1 | tee dev.log

# Build for production
npm run build

# Start production server
npm start
```

## 🏗️ Project Structure

### Core Directories
```
monito-web/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   ├── services/          # Business logic services
│   ├── page.tsx          # Main dashboard
│   └── layout.tsx        # App layout
├── prisma/               # Database schema & migrations
├── scripts/              # External processing scripts
├── test-files/           # Sample files for testing
└── docs/                 # Documentation files
```

### Key Files
- `app/page.tsx` - Main dashboard UI component
- `app/api/products/route.ts` - Products API with search
- `app/services/fileProcessor.ts` - Core file processing logic
- `app/services/dataNormalizer.ts` - Data cleaning & normalization
- `app/services/embeddingService.ts` - AI product matching
- `prisma/schema.prisma` - Database schema definition

## 🔧 Development Workflows

### Adding New Features

1. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Update Database Schema** (if needed)
```bash
# Edit prisma/schema.prisma
npx prisma db push
npx prisma generate
```

3. **Implement Feature**
- Add API endpoints in `app/api/`
- Add business logic in `app/services/`
- Update UI components as needed

4. **Test Thoroughly**
```bash
# Run linting
npm run lint

# Test API endpoints
curl -X GET "http://localhost:3001/api/your-endpoint"

# Test file uploads
curl -X POST "http://localhost:3001/api/upload-smart" \
  -F "files=@test-files/sample.pdf"
```

5. **Commit and Push**
```bash
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### Testing Guidelines

#### API Testing
```bash
# Test product search
curl "http://localhost:3001/api/products?search=beef&limit=10"

# Test supplier creation
curl -X POST "http://localhost:3001/api/suppliers" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Supplier","email":"test@example.com"}'

# Test file upload
curl -X POST "http://localhost:3001/api/upload-smart" \
  -F "files=@test-files/sample.csv"
```

#### Frontend Testing
- Test all search functionality
- Verify responsive design on different screen sizes
- Test dark/light theme switching
- Validate form submissions and error handling

### Debugging

#### Common Issues

1. **Database Connection Errors**
```bash
# Check database connection
npx prisma db pull

# Reset database (development only)
npx prisma db push --force-reset
```

2. **File Processing Errors**
```bash
# Check Python dependencies
python -c "import camelot; print('Camelot installed')"

# Test PDF processing manually
python scripts/pdf_table_processor.py test-files/sample.pdf
```

3. **Search Not Working**
- Check Prisma query syntax in `/api/products/route.ts`
- Verify database indexes on `standardizedName`
- Test search API directly with curl

#### Logging and Monitoring
```bash
# View development logs
tail -f dev.log

# Check API responses
# Add console.log statements in API routes

# Monitor database queries
# Enable Prisma logging in development
```

## 🎨 Code Standards

### TypeScript Guidelines
- Always use TypeScript for new files
- Define proper interfaces for API responses
- Avoid `any` type - use specific types or `unknown`
- Use strict type checking

### React Best Practices
- Use functional components with hooks
- Implement proper error boundaries
- Use `useEffect` cleanup functions
- Implement proper loading states

### API Design
- Follow RESTful conventions
- Use consistent error response format
- Implement proper status codes
- Add request validation

### Database Best Practices
- Use Prisma migrations for schema changes
- Add proper indexes for query optimization
- Use transactions for complex operations
- Implement soft deletes where appropriate

## 🔍 Debugging Tools

### Database Inspection
```bash
# Open Prisma Studio
npx prisma studio

# Run raw SQL queries
npx prisma db execute --file query.sql
```

### API Testing Tools
- Use Postman or curl for API testing
- Browser DevTools for frontend debugging
- Prisma Studio for database inspection
- Next.js built-in error reporting

### Performance Monitoring
```javascript
// Add timing logs to API routes
console.time('processing-time');
// ... your code
console.timeEnd('processing-time');

// Monitor database query performance
// Enable Prisma logging in development
```

## 🚀 Deployment

### Development Deployment
```bash
# Build and test locally
npm run build
npm start

# Test production build
NODE_ENV=production npm start
```

### Production Deployment (Vercel)
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Database Migrations
```bash
# Production database migration
npx prisma db push --preview-feature

# Generate and apply migrations
npx prisma migrate deploy
```

## 🤝 Contributing

### Pull Request Process
1. Fork the repository
2. Create feature branch from `main`
3. Implement changes with tests
4. Run linting and fix issues
5. Submit pull request with description

### Code Review Checklist
- [ ] TypeScript compilation passes
- [ ] ESLint warnings addressed
- [ ] API endpoints tested
- [ ] UI responsiveness verified
- [ ] Documentation updated
- [ ] Performance impact assessed

### Git Workflow
```bash
# Keep main branch updated
git checkout main
git pull origin main

# Rebase feature branch
git checkout feature/your-feature
git rebase main

# Interactive rebase to clean up commits
git rebase -i HEAD~3
```

## 📚 Learning Resources

### Next.js 15
- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)

### Prisma ORM
- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Studio](https://www.prisma.io/studio)

### OpenAI Integration
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GPT-4 Best Practices](https://platform.openai.com/docs/guides/gpt-best-practices)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app)

## 🆘 Getting Help

### Internal Resources
- Check existing issues on GitHub
- Review API documentation in `API_DOCUMENTATION.md`
- Consult architecture documentation in `ARCHITECTURE.md`

### External Support
- Stack Overflow for general development questions
- Next.js Discord for framework-specific issues
- Prisma Discord for database-related questions

### Reporting Issues
1. Check existing issues first
2. Provide minimal reproduction case
3. Include error logs and screenshots
4. Specify environment details (OS, Node version, etc.)