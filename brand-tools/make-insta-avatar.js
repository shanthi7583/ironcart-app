// Instagram profile picture, 1080x1080, in four variants.
//
// Instagram crops this to a circle and shows it at about 32px beside every comment,
// so the argument about whether the name fits is settled by looking at it small, not
// by opinion. This renders every variant at the four sizes Instagram actually uses
// and stacks them into one comparison sheet.
//
//   node make-insta-avatar.js
//     → insta-avatar-<variant>-1080.png   (upload one of these)
//     → insta-avatar-comparison.png       (the sheet to decide from)
const sharp = require('sharp');
const path = require('path');

const OUT = 'C:/Users/shant/Demo/ironing-app/public/brand';
const S = 1080;
const SERIF = "Georgia, 'Times New Roman', serif";

// The glyph is authored in a ~48x40 space: content spans x 9–39, y 6–34, centred
// on (24, 20). Everything below positions it from those numbers.
const glyph = (sw, withSteam) => `
  ${withSteam ? `
  <path d="M32 8c0 1.2-1.6 1.2-1.6 2.4s1.6 1.2 1.6 2.4" stroke="white" stroke-width="${sw - 0.5}" stroke-linecap="round" fill="none" opacity="0.9"/>
  <path d="M36 6c0 1.2-1.6 1.2-1.6 2.4s1.6 1.2 1.6 2.4" stroke="white" stroke-width="${sw - 0.5}" stroke-linecap="round" fill="none" opacity="0.9"/>` : ''}
  <circle cx="24" cy="9" r="2" stroke="white" stroke-width="${sw}" fill="none"/>
  <path d="M24 11v3" stroke="white" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
  <path d="M24 14 L9 27a2.5 2.5 0 0 0 1.5 4.5h27a2.5 2.5 0 0 0 1.5-4.5L24 14Z" stroke="white" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
  <path d="M14.5 34h19" stroke="white" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;

const hanger = (scale, cx, cy, sw, steam) =>
  `<g transform="translate(${cx - 24 * scale}, ${cy - 20 * scale}) scale(${scale})">${glyph(sw, steam)}</g>`;

const word = (y, size, s = 'PressGo') =>
  `<text x="${S / 2}" y="${y}" text-anchor="middle" font-family="${SERIF}" font-size="${size}"
     font-weight="bold" fill="#FFFFFF" letter-spacing="-2">${s}</text>`;

// A circle of radius 540 only safely holds about 475px from the centre once Instagram's
// ring is allowed for, which is what caps every size below.
const VARIANTS = {
  // No name. One bold shape is all that survives 32px.
  mark:     () => hanger(19, S / 2, S / 2, 2.1, false),
  // Name under the mark — the arrangement people picture when they ask for a logo.
  wordmark: () => hanger(11.5, S / 2, 430, 2.4, false) + word(790, 148),
  // Name only, as large as the circle allows.
  text:     () => word(612, 208),
  // Initials: the one way the name stays legible all the way down.
  monogram: () => word(660, 420, 'PG'),
};

const canvas = inner => `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1E3A8A"/>
      <stop offset="55%" stop-color="#0E7490"/>
      <stop offset="100%" stop-color="#0F766E"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#g)"/>
  ${inner}
</svg>`;

const SIZES = [320, 110, 56, 32];
const LABEL_W = 150, GAP = 30, PAD = 26, ROW_GAP = 22;

async function circleRow(src) {
  const parts = [];
  let x = LABEL_W;
  for (const size of SIZES) {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    const buf = await sharp(src).resize(size, size)
      .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    parts.push({ buf, left: Math.round(x), top: Math.round((SIZES[0] - size) / 2) });
    x += size + GAP;
  }
  return { parts, width: x - GAP, height: SIZES[0] };
}

(async () => {
  const rows = [];
  for (const name of Object.keys(VARIANTS)) {
    const file = path.join(OUT, `insta-avatar-${name}-1080.png`);
    await sharp(Buffer.from(canvas(VARIANTS[name]()))).flatten({ background: '#0E7490' }).png().toFile(file);
    rows.push({ name, row: await circleRow(file) });
    console.log(`written: insta-avatar-${name}-1080.png`);
  }

  const width = PAD * 2 + Math.max(...rows.map(r => r.row.width));
  const height = PAD * 2 + rows.length * SIZES[0] + (rows.length - 1) * ROW_GAP + 34;

  const composites = [];
  let top = PAD + 34;
  const labels = [`<text x="${PAD + LABEL_W}" y="${PAD + 18}" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="#71717A">` +
    SIZES.map(s => `${s}px`).join('   ·   ') + `</text>`];
  for (const { name, row } of rows) {
    for (const p of row.parts) composites.push({ input: p.buf, left: PAD + p.left, top: top + p.top });
    labels.push(`<text x="${PAD}" y="${top + SIZES[0] / 2 + 6}" font-family="Helvetica, Arial, sans-serif"
       font-size="19" font-weight="700" fill="#27272A">${name}</text>`);
    top += SIZES[0] + ROW_GAP;
  }
  composites.push({
    input: Buffer.from(`<svg width="${width}" height="${height}">${labels.join('')}</svg>`),
    left: 0, top: 0,
  });

  const sheet = path.join(OUT, 'insta-avatar-comparison.png');
  await sharp({ create: { width, height, channels: 3, background: '#F4F4F5' } })
    .composite(composites).png().toFile(sheet);
  console.log(`written: ${sheet}`);
})().catch(e => { console.error(e); process.exit(1); });
