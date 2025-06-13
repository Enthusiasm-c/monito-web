#!/bin/bash

echo "🐍 Setting up Python environment for PDF processing..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Install required Python packages
echo "📦 Installing Python packages..."

pip3 install --user \
    camelot-py[cv] \
    pandas \
    PyPDF2 \
    pdfplumber \
    opencv-python \
    pillow \
    numpy \
    tabula-py

echo ""
echo "🔧 Checking Ghostscript installation..."
if command -v gs &> /dev/null; then
    echo "✅ Ghostscript found: $(gs --version)"
else
    echo "⚠️  Ghostscript not found. Installing with Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ghostscript
    else
        echo "❌ Homebrew not found. Please install Ghostscript manually:"
        echo "   brew install ghostscript"
    fi
fi

echo ""
echo "🔧 Checking Java for Tabula..."
if command -v java &> /dev/null; then
    echo "✅ Java found: $(java -version 2>&1 | head -n 1)"
else
    echo "⚠️  Java not found. Tabula-py requires Java."
    echo "   Install Java from: https://www.java.com/download/"
fi

echo ""
echo "📋 Testing PDF processing setup..."

# Test script
cat > /tmp/test_pdf_setup.py << 'EOF'
import sys
print("Testing PDF processing libraries...")

try:
    import camelot
    print("✅ Camelot imported successfully")
except Exception as e:
    print(f"❌ Camelot import failed: {e}")

try:
    import pdfplumber
    print("✅ PDFPlumber imported successfully")
except Exception as e:
    print(f"❌ PDFPlumber import failed: {e}")

try:
    import tabula
    print("✅ Tabula imported successfully")
except Exception as e:
    print(f"❌ Tabula import failed: {e}")

try:
    import cv2
    print("✅ OpenCV imported successfully")
except Exception as e:
    print(f"❌ OpenCV import failed: {e}")

print("\nSetup complete!")
EOF

python3 /tmp/test_pdf_setup.py

echo ""
echo "🎉 Python environment setup complete!"
echo "   You may need to restart your terminal for PATH changes to take effect."