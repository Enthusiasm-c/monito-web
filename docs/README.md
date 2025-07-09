# 📚 Monito Web Documentation

## Core Documentation Files

This directory contains **only 3 essential documentation files** to prevent duplication and maintain clarity:

### 1. 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
**Complete system architecture and technology stack**
- System overview and components
- Technology choices and rationale
- Database schema and relationships
- API structure and patterns
- Security considerations

### 2. 🔄 [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) 
**Anti-duplication rules and development patterns**
- Mandatory patterns to prevent code duplication
- BaseProcessor inheritance requirements
- AsyncHandler error handling standards
- DatabaseService usage rules
- Self-check procedures for developers

### 3. 🚀 [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
**Getting started and development workflows**
- Setup instructions
- Development environment
- Testing procedures
- Deployment process
- Troubleshooting common issues

---

## 🚨 CRITICAL RULE: NO ADDITIONAL DOCUMENTATION

**Any other documentation files in this directory are DEPRECATED and should be removed.**

Before creating new documentation:
1. Check if it belongs in one of the 3 core files above
2. Update existing files instead of creating new ones
3. Run the duplication check below

---

## 🔍 Self-Check for Documentation Duplication

Run this command to check for documentation duplication:

```bash
# Check for duplicate documentation files (should only be 3 + README)
find docs/ -name "*.md" | wc -l
# Expected output: 4 (3 core files + this README)

# If more than 4 files exist, remove the extras:
find docs/ -name "*.md" ! -name "ARCHITECTURE.md" ! -name "REFACTORING_GUIDE.md" ! -name "DEVELOPER_GUIDE.md" ! -name "README.md" -delete
```

## 📝 Content Guidelines

### What Goes Where:

**ARCHITECTURE.md**:
- System design and components
- Technology stack decisions
- Database schemas
- API documentation
- Security architecture

**REFACTORING_GUIDE.md**:
- Code quality rules
- Anti-duplication patterns
- Required inheritance structures
- Error handling standards
- Development best practices

**DEVELOPER_GUIDE.md**:
- Setup and installation
- Development workflow
- Testing procedures
- Deployment instructions
- Troubleshooting

### ❌ What NOT to Create:
- Separate setup guides
- Individual feature documentation
- Technology-specific guides
- Redundant API documentation
- Multiple architecture files

---

## 🔄 Maintenance

This documentation structure was established during the 2024 refactoring to eliminate the 11+ duplicate documentation files that existed previously.

**Last Updated**: July 9, 2025 (Added real-time progress tracking)
**Maintainer**: Development Team