#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Remove tmp directory
const tmpPath = path.join(__dirname, '..', 'tmp');

if (fs.existsSync(tmpPath)) {
  fs.rmSync(tmpPath, { recursive: true, force: true });
  console.log('✓ Cleaned up tmp directory');
} else {
  console.log('✓ No tmp directory to clean');
}
