#!/bin/bash
# Quick setup script for Mental Health Forum
# Run this after downloading the project

echo "🏥 Mental Health Forum - Quick Setup"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Please download and install Node.js from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "✅ Node.js detected: $NODE_VERSION"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm detected: $NPM_VERSION"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    echo "   Make sure you're in the mental-health-chan directory"
    exit 1
fi

echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🚀 Starting the forum..."
echo "   Your forum will open at: http://localhost:3000"
echo "   Admin panel available at: http://localhost:3000/admin/database"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
