// Second social card, aimed only at repair shops.
//
// The generic card leads with "take orders online", which a repair shop reads as
// something for restaurants. Their actual pain is different and much sharper: they're
// holding the customer's phone, so the customer has no way to check progress except
// to ring — often on a borrowed handset. Leading with that line earns the read.
const sharp = require('sharp');
const OUT = 'C:/Users/shant/Demo/ironing-app/public/brand';
const S = 1080;

const GRAD = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#3B1D6E"/>
    <stop offset="55%" stop-color="#155E75"/>
    <stop offset="100%" stop-color="#0F766E"/>
  </linearGradient>`;

const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// A speech bubble rather than a phone: the subject here is the call you stop taking.
const bubble = `
  <g transform="translate(756, 246)" opacity="0.13">
    <rect x="0" y="0" width="250" height="176" rx="34" fill="none" stroke="#FFFFFF" stroke-width="6"/>
    <path d="M52 176 L52 228 L106 176 Z" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/>
    <rect x="34" y="52" width="182" height="14" rx="7" fill="#FFFFFF" opacity="0.65"/>
    <rect x="34" y="92" width="128" height="14" rx="7" fill="#FFFFFF" opacity="0.4"/>
  </g>`;

const line = (y, text, size, weight, opacity) =>
  `<text x="86" y="${y}" font-family="${SANS}" font-size="${size}" font-weight="${weight}"
     fill="#FFFFFF" opacity="${opacity}">${text}</text>`;

const bullet = (y, text) => `
  <circle cx="97" cy="${y - 9}" r="6" fill="#FFFFFF" opacity="0.85"/>
  <text x="124" y="${y}" font-family="${SANS}" font-size="37" font-weight="500"
     fill="#FFFFFF" opacity="0.93">${text}</text>`;

const TRADES = ['Mobile', 'Laptop', 'Watch', 'Shoe', 'Appliance', 'Jewellery', 'Furniture'];

function chips(startY, maxX = 772) {
  const fs = 30, padX = 20, gapX = 12, gapY = 15, h = 54;
  let x = 86, y = startY, out = '';
  for (const t of TRADES) {
    const w = Math.round(t.length * fs * 0.56) + padX * 2;
    if (x + w > maxX) { x = 86; y += h + gapY; }
    out += `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#FFFFFF" opacity="0.14"/>
      <text x="${x + w / 2}" y="${y + 37}" text-anchor="middle" font-family="${SANS}"
            font-size="${fs}" font-weight="600" fill="#FFFFFF" opacity="0.95">${t}</text>`;
    x += w + gapX;
  }
  return { svg: out, endY: y + h };
}

const trades = chips(556);

const svg = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRAD}</defs>
  <rect width="${S}" height="${S}" fill="url(#g)"/>
  ${bubble}

  ${line(178, 'FOR REPAIR SHOPS', 30, 700, '0.75')}

  <text x="86" y="292" font-family="Georgia, 'Times New Roman', serif" font-size="88"
        font-weight="bold" fill="#FFFFFF">Stop answering</text>
  <text x="86" y="390" font-family="Georgia, 'Times New Roman', serif" font-size="88"
        font-weight="bold" fill="#FFFFFF">“is it ready?”</text>

  ${line(462, 'Customers check the status themselves.', 41, 600, '0.97')}
  ${line(524, 'For every kind of repair:', 32, 500, '0.8')}

  ${trades.svg}

  ${bullet(trades.endY + 66, 'Quote first — they approve, then you start')}
  ${bullet(trades.endY + 128, 'Auto-alert the moment it&apos;s ready')}
  ${bullet(trades.endY + 190, 'Collection, repair and return in one place')}

  <rect x="86" y="906" width="600" height="4" rx="2" fill="#FFFFFF" opacity="0.25"/>
  ${line(972, 'See one running: pressgo.co.in', 41, 700, '1')}
</svg>`;

(async () => {
  await sharp(Buffer.from(svg)).flatten({ background: '#155E75' }).png()
    .toFile(`${OUT}/social-repair-shops-1080.png`);
  const m = await sharp(`${OUT}/social-repair-shops-1080.png`).metadata();
  console.log(`written: ${m.width}x${m.height} · chips end at y=${trades.endY}`);
})().catch(e => { console.error(e); process.exit(1); });
