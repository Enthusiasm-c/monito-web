#!/bin/bash

# Supplier CRUD Testing Setup Script
# This script ensures all necessary dependencies are installed for running the comprehensive supplier tests

echo "🚀 Setting up Comprehensive Supplier CRUD Testing Environment"
echo "============================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install Playwright if not already installed
echo "📦 Installing Playwright..."
npm install --save-dev @playwright/test

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install

# Create test-results directory if it doesn't exist
if [ ! -d "test-results" ]; then
    echo "📁 Creating test-results directory..."
    mkdir -p test-results
fi

# Make test runner executable
echo "🔧 Making test runner executable..."
chmod +x run-supplier-tests.js

# Verify Playwright installation
echo "🔍 Verifying Playwright installation..."
if npx playwright --version &> /dev/null; then
    echo "✅ Playwright installed successfully: $(npx playwright --version)"
else
    echo "❌ Playwright installation failed"
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Available test commands:"
echo "  ./run-supplier-tests.js          # Run headless tests"
echo "  ./run-supplier-tests.js --headed # Run with visible browser"
echo "  ./run-supplier-tests.js --debug  # Run in debug mode"
echo ""
echo "📚 Or use npm scripts:"
echo "  npm run test:suppliers           # Run supplier tests"
echo "  npm run test:suppliers:headed    # Run with visible browser"
echo ""
echo "🔗 Make sure the server is running at: http://209.38.85.196:3000"
echo "🔑 Admin credentials: admin@monito-web.com / admin123"
echo ""
echo "▶️  Ready to run tests! Use any of the commands above to start testing."