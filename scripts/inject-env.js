#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found. Please create one based on .env.example');
  process.exit(1);
}

// Parse .env file
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  // Skip empty lines and comments
  if (!line || line.startsWith('#')) return;

  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

// Validate required variables
const requiredVars = ['FORM_ID', 'EXPORT_FOLDER_ID'];
const missingVars = requiredVars.filter(v => !envVars[v]);

if (missingVars.length > 0) {
  console.error('Error: Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Read and update Code.js
const codeJsPath = path.join(__dirname, '..', 'src', 'Code.js');
let codeContent = fs.readFileSync(codeJsPath, 'utf8');
codeContent = codeContent.replace(/var FORM_ID = "{{FORM_ID}}";/g, `var FORM_ID = "${envVars.FORM_ID}";`);
codeContent = codeContent.replace(/var EXPORT_FOLDER_ID = "{{EXPORT_FOLDER_ID}}";/g, `var EXPORT_FOLDER_ID = "${envVars.EXPORT_FOLDER_ID}";`);
fs.writeFileSync(codeJsPath, codeContent, 'utf8');

console.log('✓ Environment variables injected successfully');
console.log(`  FORM_ID: ${envVars.FORM_ID}`);
console.log(`  EXPORT_FOLDER_ID: ${envVars.EXPORT_FOLDER_ID}`);
