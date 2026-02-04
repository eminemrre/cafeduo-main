#!/bin/bash
# Phase 4 Setup Script

echo "🎨 Phase 4: UI/UX Polish & Responsive Design Setup"
echo "=================================================="

# Create new branch
echo "📦 Creating new branch..."
git checkout -b feat/phase-4-responsive-ui

# Install dependencies
echo "📥 Installing Framer Motion..."
npm install framer-motion

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start dev server: npm run dev"
echo "2. Open http://localhost:3000"
echo "3. Test responsive design"
