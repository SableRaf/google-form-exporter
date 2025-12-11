#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

/**
 * Checks for uncommitted changes in the src directory
 * Returns true if there are changes, false otherwise
 */
function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain src/', { encoding: 'utf8' });
    return status.trim().length > 0;
  } catch (e) {
    // If git command fails, assume there might be changes and warn
    return true;
  }
}

/**
 * Prompts user for confirmation
 * Returns a promise that resolves to true if user confirms, false otherwise
 */
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main function to check for changes and warn user
 */
async function main() {
  console.log('🔍 Checking for local changes...\n');

  if (hasUncommittedChanges()) {
    console.log('⚠️  WARNING: You have uncommitted changes in the src/ directory.');
    console.log('   Running "clasp pull" will overwrite your local files with the');
    console.log('   version from the Apps Script editor.\n');

    const shouldContinue = await promptUser('Do you want to continue? (y/N): ');

    if (!shouldContinue) {
      console.log('\n❌ Pull cancelled. Commit your changes first or stash them.');
      process.exit(1);
    }

    console.log('\n✓ Proceeding with pull...\n');
  } else {
    console.log('✓ No uncommitted changes detected. Proceeding with pull...\n');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
