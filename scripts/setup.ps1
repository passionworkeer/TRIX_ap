# TRIX Production Setup Script
# Run this in PowerShell

Write-Host "🚀 TRIX Production Mode Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install npm dependencies
Write-Host "📦 Step 1: Installing npm dependencies..." -ForegroundColor Yellow
npm install @supabase/supabase-js

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ npm dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install npm dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Setup .env file
Write-Host "📝 Step 2: Setting up .env file..." -ForegroundColor Yellow

if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists. Skipping..." -ForegroundColor Yellow
} else {
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env file created from template" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env and add your Supabase credentials!" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Install Python dependencies
Write-Host "🐍 Step 3: Installing Python dependencies..." -ForegroundColor Yellow

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
}

if ($pythonCmd) {
    & $pythonCmd.Source -m pip install -r requirements.txt
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python dependencies installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Python not found. Please install Python 3.7+ and run:" -ForegroundColor Yellow
    Write-Host "   pip install -r requirements.txt" -ForegroundColor White
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Edit .env file with your Supabase credentials" -ForegroundColor White
Write-Host "   2. Create Supabase project at: https://app.supabase.com" -ForegroundColor White
Write-Host "   3. Run SQL schema (see IMPLEMENTATION_GUIDE.md)" -ForegroundColor White
Write-Host "   4. Start Python server: python server.py" -ForegroundColor White
Write-Host "   5. Start dev server: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "📖 For detailed instructions, see:" -ForegroundColor Cyan
Write-Host "   - IMPLEMENTATION_GUIDE.md" -ForegroundColor White
Write-Host "   - INTEGRATION_SUMMARY.md" -ForegroundColor White
Write-Host ""
