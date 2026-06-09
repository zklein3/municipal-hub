#!/usr/bin/env node
// Generates PWA + Android launcher icons from the F7 red square design.
// Run: node scripts/generate-icons.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// Full F7 red square — used for legacy launcher icons and PWA icons
function squareSvg(size) {
  const rx = Math.round(size * (112 / 512));
  const fontSize = Math.round(size * (260 / 512));
  const y = Math.round(size * (360 / 512));
  const spacing = Math.round(-10 * (size / 512));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#991b1b"/>
  <text x="${size / 2}" y="${y}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" fill="white" font-family="sans-serif" letter-spacing="${spacing}">F7</text>
</svg>`;
}

// Foreground layer for adaptive icons — white F7 on transparent, centered in 108dp canvas
// The safe zone is the inner 72/108 = 66.7% of the canvas
function foregroundSvg(canvas) {
  const safe = Math.round(canvas * (72 / 108));
  const fontSize = Math.round(safe * (260 / 512));
  const offset = Math.round((canvas - safe) / 2);
  const cx = canvas / 2;
  const cy = offset + Math.round(safe * (360 / 512));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}" width="${canvas}" height="${canvas}">
  <text x="${cx}" y="${cy}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" fill="white" font-family="sans-serif">F7</text>
</svg>`;
}

async function generate(svgStr, outPath) {
  await sharp(Buffer.from(svgStr)).png().toFile(outPath);
  console.log('  wrote', path.relative(ROOT, outPath));
}

async function main() {
  // PWA icons
  console.log('PWA icons:');
  await generate(squareSvg(192), path.join(ROOT, 'public', 'icon-192.png'));
  await generate(squareSvg(512), path.join(ROOT, 'public', 'icon-512.png'));
  await generate(squareSvg(180), path.join(ROOT, 'public', 'apple-icon.png'));

  // Android legacy + round launcher icons (full design)
  // mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
  const densities = [
    { dir: 'mipmap-mdpi',    legacy: 48,  fg: 108 },
    { dir: 'mipmap-hdpi',    legacy: 72,  fg: 162 },
    { dir: 'mipmap-xhdpi',   legacy: 96,  fg: 216 },
    { dir: 'mipmap-xxhdpi',  legacy: 144, fg: 324 },
    { dir: 'mipmap-xxxhdpi', legacy: 192, fg: 432 },
  ];

  console.log('\nAndroid icons:');
  for (const d of densities) {
    const dir = path.join(ANDROID_RES, d.dir);
    await generate(squareSvg(d.legacy), path.join(dir, 'ic_launcher.png'));
    await generate(squareSvg(d.legacy), path.join(dir, 'ic_launcher_round.png'));
    await generate(foregroundSvg(d.fg), path.join(dir, 'ic_launcher_foreground.png'));
  }

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
