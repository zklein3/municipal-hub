#!/usr/bin/env node
// Generates the static social share (Open Graph) image — 1200x630.
// Run: node scripts/generate-og-image.js

const sharp = require('sharp');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fafafa"/>
  <rect x="0" y="0" width="1200" height="12" fill="#991b1b"/>

  <!-- Logo -->
  <rect x="90" y="195" width="240" height="240" rx="52" fill="#991b1b"/>
  <text x="210" y="365" font-size="125" font-weight="bold" text-anchor="middle" fill="white" font-family="sans-serif" letter-spacing="-5">F7</text>

  <!-- Wordmark -->
  <text x="370" y="300" font-size="88" font-weight="800" fill="#18181b" font-family="Arial, Helvetica, sans-serif" letter-spacing="-2">FireOps7</text>

  <!-- Tagline -->
  <text x="372" y="365" font-size="34" fill="#71717a" font-family="Arial, Helvetica, sans-serif">Fire Department Operations, Simplified.</text>

  <!-- Feature strip -->
  <text x="90" y="540" font-size="26" fill="#991b1b" font-family="Arial, Helvetica, sans-serif" font-weight="600">Incident Reporting  ·  NERIS Compatible  ·  Training &amp; Certifications  ·  ISO Compliance</text>
</svg>`;

async function main() {
  const outPath = path.join(ROOT, 'public', 'og-image.png');
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('wrote', path.relative(ROOT, outPath));
}

main().catch(e => { console.error(e); process.exit(1); });
