#!/bin/bash

# ALX Polly Setup Script
# This script cleans and reinstalls dependencies to fix native binding issues

echo "🚀 Setting up ALX Polly project..."

# Remove existing node_modules and package-lock.json
echo "🧹 Cleaning existing dependencies..."
rm -rf node_modules
rm -rf .next
rm -f package-lock.json

# Clear npm cache
echo "🗑️  Clearing npm cache..."
npm cache clean --force

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run TypeScript check
echo "🔍 Checking TypeScript..."
npm run tsc

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure your .env.local file has the required Supabase keys:"
echo "   - NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url"
echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "🎯 Ready to start your security audit!"
