#!/bin/bash
# Fix Jest configuration

cd /home/emin/cafeduo-main

# Install ts-jest
echo "Installing ts-jest..."
npm install --save-dev ts-jest

# Alternative: Use babel-jest instead (lighter)
# npm install --save-dev @babel/core @babel/preset-env @babel/preset-typescript

echo "Done! Now run: npm test"
