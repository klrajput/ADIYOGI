@echo off
REM Quick setup script for Mental Health Forum (Windows)
REM Run this after downloading the project

echo 🏥 Mental Health Forum - Quick Setup
echo ==================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    echo    Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected
node --version

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed
    pause
    exit /b 1
)

echo ✅ npm detected
npm --version

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ package.json not found
    echo    Make sure you're in the mental-health-chan directory
    pause
    exit /b 1
)

echo.
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully
echo.
echo 🚀 Starting the forum...
echo    Your forum will open at: http://localhost:3000
echo    Admin panel available at: http://localhost:3000/admin/database
echo.
echo Press Ctrl+C to stop the server
echo.

npm start
