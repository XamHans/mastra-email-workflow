#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyCredentials() {
  const projectRoot = path.resolve(__dirname, '..');
  const sourceCredentialsDir = path.join(projectRoot, 'src', 'mastra', 'tools', 'credentials');
  const targetCredentialsDir = path.join(projectRoot, '.mastra', 'output', 'credentials');

  try {
    // Check if source credentials directory exists
    await fs.access(sourceCredentialsDir);
    
    // Create target directory if it doesn't exist
    await fs.mkdir(targetCredentialsDir, { recursive: true });
    
    // Copy the entire credentials directory
    await copyDirectory(sourceCredentialsDir, targetCredentialsDir);
    
    console.log('✅ Credentials copied successfully to output directory');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️  No credentials directory found, skipping copy');
    } else {
      console.error('❌ Error copying credentials:', error);
      process.exit(1);
    }
  }
}

async function copyDirectory(source, target) {
  const files = await fs.readdir(source, { withFileTypes: true });
  
  for (const file of files) {
    const sourcePath = path.join(source, file.name);
    const targetPath = path.join(target, file.name);
    
    if (file.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
      console.log(`  Copied: ${path.relative(process.cwd(), sourcePath)} → ${path.relative(process.cwd(), targetPath)}`);
    }
  }
}

copyCredentials().catch(console.error);