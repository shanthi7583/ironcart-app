// Play Store feature graphic: exactly 1024x500, no alpha, no transparency.
// Google crops and scales this aggressively across surfaces, so nothing important
// goes near the edges and the text stays large enough to read as a thumbnail.
const sharp = require('sharp');

const OUT = 'C:/Users/shant/Demo/ironing-app/public/brand';
const W = 1024, H = 500;

// Same gradient and hanger as the launcher icon and splash, so the listing, the icon
// and the app all read as one thing.
const GRAD = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#2563EB"/>
    <stop offset="52%" stop-color="#06B6D4"/>
    <stop offset="100%" stop-color="#14B8A6"/>
  </linearGradient>`;

const glyph = (sw = 2.6) => `
  <path d="M32 8c0 1.2-1.6 1.2-1.6 2.4s1.6 1.2 1.6 2.4" stroke="white" stroke-width="${sw - 0.4}" stroke-linecap="round" fill="none" opacity="0.9"/>
  <path d="M36 6c0 1.2-1.6 1.2-1.6 2.4s1.6 1.2 1.6 2.4" stroke="white" stroke-width="${sw - 0.4}" stroke-linecap="round" fill="none" opacity="0.9"/>
  <circle cx="24" cy="9" r="2" stroke="white" stroke-width="${sw}" fill="none"/>
  <path d="M24 11v3" stroke="white" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
  <path d="M24 14 L9 27a2.5 2.5 0 0 0 1.5 4.5h27a2.5 2.5 0 0 0 1.5-4.5L24 14Z" stroke="white" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
  <path d="M14.5 34h19" stroke="white" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRAD}
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>

  <!-- Oversized watermark hanger, cropped off the right edge: brand presence without
       competing with the wordmark for attention. -->
  <g transform="translate(720, 60) scale(8.5)" opacity="0.13">${glyph(2.2)}</g>

  <!-- Icon tile, matching the launcher icon exactly -->
  <rect x="72" y="176" width="148" height="148" rx="34" fill="#FFFFFF" opacity="0.16"/>
  <g transform="translate(105, 209) scale(1.72)">${glyph(2.8)}</g>

  <text x="258" y="238" font-family="Georgia, 'Times New Roman', serif" font-size="82"
        font-weight="bold" fill="#FFFFFF" letter-spacing="-1">PressGo</text>
  <text x="262" y="288" font-family="-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="30" font-weight="600" fill="#FFFFFF" opacity="0.95">Ironing, picked up and delivered</text>
  <text x="262" y="336" font-family="-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="25" font-weight="500" fill="#FFFFFF" opacity="0.8">Free pickup &amp; delivery · Track every order</text>
</svg>`;

(async () => {
  await sharp(Buffer.from(svg))
    .flatten({ background: '#2563EB' })   // Play rejects alpha on this asset
    .png()
    .toFile(`${OUT}/play-feature-graphic-1024x500.png`);

  const meta = await sharp(`${OUT}/play-feature-graphic-1024x500.png`).metadata();
  console.log(`written: ${meta.width}x${meta.height}, channels ${meta.channels}, alpha ${!!meta.hasAlpha}`);
})().catch(e => { console.error(e); process.exit(1); });
