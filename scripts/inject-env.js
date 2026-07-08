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
const requiredVars = ['SOURCE_FORM_ID', 'EXPORT_FOLDER_ID'];
const missingVars = requiredVars.filter(v => !envVars[v]);

if (missingVars.length > 0) {
  console.error('Error: Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Create tmp/dist directory
const distPath = path.join(__dirname, '..', 'tmp', 'dist');
if (fs.existsSync(distPath)) {
  // Clean existing dist folder
  fs.rmSync(distPath, { recursive: true, force: true });
}
fs.mkdirSync(distPath, { recursive: true });

// Copy all files from src to tmp/dist
const srcPath = path.join(__dirname, '..', 'src');
const srcFiles = fs.readdirSync(srcPath);

srcFiles.forEach(file => {
  const srcFilePath = path.join(srcPath, file);
  const distFilePath = path.join(distPath, file);

  if (fs.statSync(srcFilePath).isFile()) {
    fs.copyFileSync(srcFilePath, distFilePath);
  }
});

// Read and update Code.js in tmp/dist
const codeJsPath = path.join(distPath, 'Code.js');
let codeContent = fs.readFileSync(codeJsPath, 'utf8');
codeContent = codeContent.replace(/var SOURCE_FORM_ID = "{{SOURCE_FORM_ID}}";/g, `var SOURCE_FORM_ID = "${envVars.SOURCE_FORM_ID}";`);
codeContent = codeContent.replace(/var TARGET_FORM_ID = "{{TARGET_FORM_ID}}";/g, `var TARGET_FORM_ID = "${envVars.TARGET_FORM_ID || ''}";`);
codeContent = codeContent.replace(/var EXPORT_FOLDER_ID = "{{EXPORT_FOLDER_ID}}";/g, `var EXPORT_FOLDER_ID = "${envVars.EXPORT_FOLDER_ID}";`);
codeContent = codeContent.replace(/var IMPORT_FILE_ID = "{{IMPORT_FILE_ID}}";/g, `var IMPORT_FILE_ID = "${envVars.IMPORT_FILE_ID || ''}";`);
fs.writeFileSync(codeJsPath, codeContent, 'utf8');

console.log('✓ Files copied to tmp/dist and environment variables injected');
console.log(`  SOURCE_FORM_ID: ${envVars.SOURCE_FORM_ID}`);
console.log(`  TARGET_FORM_ID: ${envVars.TARGET_FORM_ID || '(not set)'}`);
console.log(`  EXPORT_FOLDER_ID: ${envVars.EXPORT_FOLDER_ID}`);
console.log(`  IMPORT_FILE_ID: ${envVars.IMPORT_FILE_ID || '(not set)'}`);
