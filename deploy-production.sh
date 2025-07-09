#!/bin/bash

# Production deployment script for monito-web
# Server: 209.38.85.196

echo "🚀 Starting deployment to production server..."
echo "================================================="

# Execute deployment commands on remote server
ssh root@209.38.85.196 << 'ENDSSH'
    set -e
    
    echo "📂 Navigating to project directory..."
    cd /root/monito-web
    
    echo "🔄 Pulling latest changes from git..."
    git pull origin main
    
    echo "📦 Installing dependencies..."
    npm install
    
    echo "🏗️ Building the project..."
    npm run build
    
    echo "🔄 Restarting application with PM2..."
    pm2 restart monito-web
    
    echo "💾 Saving PM2 configuration..."
    pm2 save
    
    echo "📊 Checking application status..."
    pm2 status monito-web
    
    echo "✅ Deployment completed successfully!"
    echo "🌐 Application is running at http://209.38.85.196:3000"
ENDSSH

echo "✅ Deployment script completed!"