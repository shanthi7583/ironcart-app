// Instagram profile picture, 1080x1080.
//
// Instagram crops this to a circle and then shows it at about 32px beside every
// comment, so the only thing that survives is one bold shape. No wordmark: "PressGo"
// at 32px is a grey smudge. The hanger is the same mark as the app icon and the Play
// listing, which is the point — someone who has seen the app recognises the account.
//
// Two versions are drawn so they can be compared at the size that matters:
//   detailed — with the steam curls, as on the app icon
//   simple   — curls dropped, which is the one to upload unless the curls survive
const sharp = require('sharp');
const path = require('path');

const OUT = 'C:/Users/shant/Demo/ironing-app/public/brand';
const S = 1080;

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

function avatar(withSteam) {
  const scale = 19;                        // 30 glyph units wide → 570px, half the canvas
  const tx = S / 2 - 24 * scale;
  const ty = S / 2 - 20 * scale;
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1E3A8A"/>
        <stop offset="55%" stop-color="#0E7490"/>
        <stop offset="100%" stop-color="#0F766E"/>
      </linearGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#g)"/>
    <g transform="translate(${tx}, ${ty}) scale(${scale})">${glyph(2.1, withSteam)}</g>
  </svg>`;
}

// What Instagram actually does: crop to a circle, then shrink. Rendering the same
// four sizes it uses is the only honest way to check the mark still reads.
async function circleStrip(src, out) {
  const SIZES = [320, 110, 56, 32];
  const GAP = 28, PAD = 24;
  const width = PAD * 2 + SIZES.reduce((a, s) => a + s, 0) + GAP * (SIZES.length - 1);
  const height = PAD * 2 + SIZES[0];

  const parts = [];
  let x = PAD;
  for (const size of SIZES) {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    const buf = await sharp(src).resize(size, size)
      .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    parts.push({ input: buf, left: Math.round(x), top: Math.round(PAD + (SIZES[0] - size) / 2) });
    x += size + GAP;
  }

  await sharp({ create: { width, height, channels: 3, background: '#F4F4F5' } })
    .composite(parts).png().toFile(out);
}

(async () => {
  for (const [name, steam] of [['detailed', true], ['simple', false]]) {
    const file = path.join(OUT, `insta-avatar-${name}-1080.png`);
    await sharp(Buffer.from(avatar(steam))).flatten({ background: '#0E7490' }).png().toFile(file);
    await circleStrip(file, path.join(OUT, `insta-avatar-${name}-preview.png`));
    console.log(`written: ${file}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
