// Instagram Story version of the app-building card: 1080x1920.
//
// Not a rescale of the square card. Stories put Instagram's own UI over the top ~300px
// (profile row) and bottom ~300px (reply box, link sticker), so every word lives
// between y=320 and y=1620. The extra height goes into larger type, because a Story
// is glanced at for two seconds, not read.
const sharp = require('sharp');
const OUT = 'C:/Users/shant/Demo/ironing-app/public/brand';
const W = 1080, H = 1920;

const GRAD = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#1E3A8A"/>
    <stop offset="55%" stop-color="#0E7490"/>
    <stop offset="100%" stop-color="#0F766E"/>
  </linearGradient>`;

const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const line = (y, text, size, weight, opacity) =>
  `<text x="86" y="${y}" font-family="${SANS}" font-size="${size}" font-weight="${weight}"
     fill="#FFFFFF" opacity="${opacity}">${text}</text>`;

const TRADES = 'Laundry · Dry clean · Tailoring · Repairs · Grocery · Bakery · Pharmacy';

const ROW_H = 110;
const tier = (y, label, price, scope, popular) => `
  <rect x="86" y="${y}" width="908" height="${ROW_H}" rx="22"
        fill="#FFFFFF" opacity="${popular ? 0.22 : 0.12}"/>
  <text x="112" y="${y + 44}" font-family="${SANS}" font-size="28" font-weight="700"
        fill="#FFFFFF" opacity="0.8" letter-spacing="1.6">${label}</text>
  ${popular ? `
  <rect x="${112 + label.length * 20 + 24}" y="${y + 20}" width="176" height="32" rx="16"
        fill="#FFFFFF" opacity="0.9"/>
  <text x="${112 + label.length * 20 + 112}" y="${y + 42}" text-anchor="middle"
        font-family="${SANS}" font-size="20" font-weight="800" fill="#0E7490"
        letter-spacing="1.2">RECOMMENDED</text>` : ''}
  <text x="968" y="${y + 48}" text-anchor="end" font-family="${SANS}" font-size="46"
        font-weight="800" fill="#FFFFFF">${price}</text>
  <text x="112" y="${y + 88}" font-family="${SANS}" font-size="26" font-weight="500"
        fill="#FFFFFF" opacity="0.82">${scope}</text>`;

// Outlined, not filled: a different product from the three rows above, not a cheaper
// rung on the same ladder. Garment trades only — PressGo can't run a bakery.
const pressgoBand = (y) => `
  <rect x="86" y="${y}" width="908" height="132" rx="24" fill="#FFFFFF" opacity="0.07"/>
  <rect x="86" y="${y}" width="908" height="132" rx="24" fill="none"
        stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="2.5"/>
  <text x="112" y="${y + 50}" font-family="${SANS}" font-size="25" font-weight="700"
        fill="#FFFFFF" opacity="0.72" letter-spacing="1.4">ALREADY AN IRONING, LAUNDRY OR DRY-CLEAN SHOP?</text>
  <text x="112" y="${y + 99}" font-family="${SANS}" font-size="31" font-weight="600"
        fill="#FFFFFF">We'll send you orders in your area — ₹2,500/month.</text>`;

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRAD}</defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>

  ${line(392, 'FOR LOCAL BUSINESSES', 32, 700, '0.75')}

  <text x="86" y="516" font-family="Georgia, 'Times New Roman', serif" font-size="96"
        font-weight="bold" fill="#FFFFFF">Take orders</text>
  <text x="86" y="624" font-family="Georgia, 'Times New Roman', serif" font-size="96"
        font-weight="bold" fill="#FFFFFF">online.</text>

  ${line(700, 'A web app for your shop — live in 2–3 weeks.', 38, 600, '0.97')}
  ${line(752, TRADES, 25, 500, '0.78')}

  ${line(820, 'YOUR OWN APP', 25, 700, '0.6')}

  ${tier(842, 'BASIC', '₹25,000', 'Ordering, payments, one dashboard', false)}
  ${tier(968, 'STANDARD', '₹45,000', '+ delivery view, reports, your own app icon', true)}
  ${tier(1094, 'COMPLETE', '₹85,000', '+ multiple branches, staff logins, priority support', false)}

  ${line(1248, 'Own app + ₹3,500/month · Website only ₹15,000 + ₹500/month', 27, 500, '0.85')}

  ${pressgoBand(1288)}

  ${line(1486, 'Free demo — see it running before you pay', 29, 600, '0.82')}
  ${line(1548, 'pressgo.co.in · WhatsApp 96113 62505', 36, 700, '1')}
</svg>`;

(async () => {
  await sharp(Buffer.from(svg)).flatten({ background: '#0E7490' }).png()
    .toFile(`${OUT}/story-app-service-1080x1920.png`);
  const m = await sharp(`${OUT}/story-app-service-1080x1920.png`).metadata();
  console.log(`written: ${m.width}x${m.height}`);
})().catch(e => { console.error(e); process.exit(1); });
