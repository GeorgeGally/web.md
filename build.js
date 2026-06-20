#!/usr/bin/env node

import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dist = resolve(__dirname, 'dist');

if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true });
}

console.log('Building content script with Vite...');
execSync('npx vite build', { stdio: 'inherit', cwd: __dirname });

console.log('Copying extension files...');

const filesToCopy = [
  ['manifest.json', 'manifest.json'],
  ['src/background.js', 'background.js'],
  ['src/popup/popup.html', 'popup/popup.html'],
  ['src/popup/popup.js', 'popup/popup.js'],
  ['src/popup/popup.css', 'popup/popup.css'],
];

for (const [src, dest] of filesToCopy) {
  const srcPath = resolve(__dirname, src);
  const destPath = resolve(__dirname, 'dist', dest);
  const destDir = dirname(destPath);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  cpSync(srcPath, destPath);
  console.log(`  ${src} → dist/${dest}`);
}

const iconSizes = ['16', '48', '128'];
const iconsDir = resolve(__dirname, 'dist', 'icons');
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

for (const size of iconSizes) {
  const src = resolve(__dirname, 'icons', `icon${size}.png`);
  const dest = resolve(__dirname, 'dist', 'icons', `icon${size}.png`);
  if (existsSync(src)) {
    cpSync(src, dest);
    console.log(`  icons/icon${size}.png → dist/icons/icon${size}.png`);
  }
}

console.log('\nBuild complete! Load dist/ as an unpacked extension in Chrome.');