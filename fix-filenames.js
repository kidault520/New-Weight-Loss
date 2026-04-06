#!/usr/bin/env node

import { readdir, rename } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';

// Function to clean filename by removing or replacing special characters
function cleanFilename(filename) {
  const name = basename(filename, extname(filename));
  const ext = extname(filename);
  
  // Replace problematic characters with safe alternatives
  const cleanName = name
    .replace(/[^\w\-_.]/g, '-') // Replace special chars with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  return cleanName + ext;
}

// Function to recursively scan directory for files with special characters
async function scanDirectory(dir = '.') {
  const problematicFiles = [];
  
  try {
    const items = await readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(dir, item.name);
      
      // Skip node_modules and .git directories
      if (item.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(item.name)) {
        const subFiles = await scanDirectory(fullPath);
        problematicFiles.push(...subFiles);
      } else if (item.isFile()) {
        // Check if filename contains non-ASCII or problematic characters
        const hasSpecialChars = /[^\w\-_.]/g.test(item.name) || !/^[\x00-\x7F]*$/.test(item.name);
        
        if (hasSpecialChars) {
          const cleanName = cleanFilename(item.name);
          problematicFiles.push({
            original: fullPath,
            suggested: join(dirname(fullPath), cleanName),
            filename: item.name,
            cleanFilename: cleanName
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
  
  return problematicFiles;
}

// Main function
async function main() {
  console.log('🔍 Scanning for files with unsupported characters...\n');
  
  const problematicFiles = await scanDirectory();
  
  if (problematicFiles.length === 0) {
    console.log('✅ No files with problematic characters found!');
    return;
  }
  
  console.log(`⚠️  Found ${problematicFiles.length} file(s) with potentially problematic characters:\n`);
  
  for (const file of problematicFiles) {
    console.log(`Original: ${file.original}`);
    console.log(`Suggested: ${file.suggested}`);
    console.log('---');
  }
  
  console.log('\n🔧 Renaming files...');
  
  for (const file of problematicFiles) {
    try {
      await rename(file.original, file.suggested);
      console.log(`✅ Renamed: ${file.filename} → ${file.cleanFilename}`);
    } catch (error) {
      console.error(`❌ Failed to rename ${file.original}:`, error.message);
    }
  }
  
  console.log('\n✨ File renaming complete!');
}

main().catch(console.error);