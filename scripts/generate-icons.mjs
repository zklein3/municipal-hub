// Generates static PWA icon PNGs using sharp + SVG source
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

function makeSvg(size) {
  const fontSize = Math.round(size * 0.46)
  const y = Math.round(size * 0.72)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#991b1b"/>
  <text x="${size / 2}" y="${y}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial, sans-serif" letter-spacing="-${Math.round(size * 0.02)}">F7</text>
</svg>`
}

const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-icon.png', size: 180 },
]

for (const { name, size } of icons) {
  const svg = Buffer.from(makeSvg(size))
  const outPath = join(publicDir, name)
  await sharp(svg).png().toFile(outPath)
  console.log(`Generated ${name} (${size}x${size})`)
}
