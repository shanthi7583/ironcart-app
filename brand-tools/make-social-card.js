// Square social card (1080x1080) advertising app-building as a service.
// Deliberately NOT PressGo-branded: PressGo is the proof, not the seller. Text sits
// well inside the edges because Instagram crops square posts in feed previews.
const sharp = require('sharp');
const OUT = 'C:/Users/shant/Demo/ironing-app/public/brand';
const S = 1080;

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

// Trades that share PressGo's model — a catalogue of items, collected, serviced or
// delivered. Appointment businesses (salon, tuition) and quote-first ones (electrician)
// are real builds rather than rebrands, so they don't belong on a card promising
// 2-3 weeks.
//
// These were chips before. The PressGo band at the bottom needs ~110px and the card
// was already full, so they collapse to one line — the chips were decoration, the
// band is an offer.
const TRADES = 'Laundry · Dry clean · Tailoring · Repairs · Grocery · Bakery · Pharmacy';

// Three tiers as full-width rows, not columns: at 1080 square, three columns leave
// ~288px each, which forces the feature line down to an unreadable size or wraps it
// into three ragged lines. Rows keep every price on one baseline and give the feature
// line the full width.
//
// Only a name, a price and one line of scope per tier. The card's job is to make the
// shop ask, not to answer everything — the detail belongs on the website, and a card
// dense enough to price a project from is a card nobody reads.
const ROW_H = 94;
const tier = (y, label, price, scope, popular) => `
  <rect x="86" y="${y}" width="908" height="${ROW_H}" rx="20"
        fill="#FFFFFF" opacity="${popular ? 0.22 : 0.12}"/>
  <text x="112" y="${y + 38}" font-family="${SANS}" font-size="25" font-weight="700"
        fill="#FFFFFF" opacity="0.8" letter-spacing="1.6">${label}</text>
  ${popular ? `
  <rect x="${112 + label.length * 18 + 22}" y="${y + 16}" width="160" height="29" rx="14.5"
        fill="#FFFFFF" opacity="0.9"/>
  <text x="${112 + label.length * 18 + 102}" y="${y + 36}" text-anchor="middle"
        font-family="${SANS}" font-size="18" font-weight="800" fill="#0E7490"
        letter-spacing="1.2">RECOMMENDED</text>` : ''}
  <text x="968" y="${y + 42}" text-anchor="end" font-family="${SANS}" font-size="40"
        font-weight="800" fill="#FFFFFF">${price}</text>
  <text x="112" y="${y + 76}" font-family="${SANS}" font-size="23" font-weight="500"
        fill="#FFFFFF" opacity="0.82">${scope}</text>`;

// The second offer: not a fourth tier, a different product. Shops that iron, wash or
// dry-clean can take orders through PressGo itself rather than paying for a build —
// they use it, they don't own it. Outlined rather than filled so it reads as an
// alternative to the three rows above, not a cheaper rung on the same ladder.
//
// Scoped to garments on purpose: a bakery or pharmacy can't run on PressGo, so naming
// every trade here would promise something that doesn't exist.
const pressgoBand = (y) => `
  <rect x="86" y="${y}" width="908" height="112" rx="22" fill="#FFFFFF" opacity="0.07"/>
  <rect x="86" y="${y}" width="908" height="112" rx="22" fill="none"
        stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="2.5"/>
  <text x="112" y="${y + 42}" font-family="${SANS}" font-size="23" font-weight="700"
        fill="#FFFFFF" opacity="0.72" letter-spacing="1.4">ALREADY AN IRONING, LAUNDRY OR DRY-CLEAN SHOP?</text>
  <text x="112" y="${y + 84}" font-family="${SANS}" font-size="29" font-weight="600"
        fill="#FFFFFF">We'll send you orders in your area — ₹2,500/month.</text>`;

const svg = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>${GRAD}</defs>
  <rect width="${S}" height="${S}" fill="url(#g)"/>

  ${line(158, 'FOR LOCAL BUSINESSES', 29, 700, '0.75')}

  <text x="86" y="276" font-family="Georgia, 'Times New Roman', serif" font-size="74"
        font-weight="bold" fill="#FFFFFF">Take orders online.</text>

  ${line(340, 'A web app for your shop — live in 2–3 weeks.', 37, 600, '0.97')}
  ${line(388, TRADES, 24, 500, '0.78')}

  ${line(444, 'YOUR OWN APP', 23, 700, '0.6')}

  ${tier(464, 'BASIC', '₹25,000', 'Ordering, payments, one dashboard', false)}
  ${tier(568, 'STANDARD', '₹45,000', '+ delivery view, reports, your own app icon', true)}
  ${tier(672, 'COMPLETE', '₹85,000', '+ multiple branches, staff logins, priority support', false)}

  ${line(802, 'Own app + ₹3,500/month · Website only ₹15,000 + ₹500/month', 24, 500, '0.85')}

  ${pressgoBand(832)}

  ${line(984, 'Free demo — see it running before you pay', 25, 600, '0.82')}
  ${line(1034, 'pressgo.co.in · WhatsApp 96117 62505', 31, 700, '1')}
</svg>`;

(async () => {
  await sharp(Buffer.from(svg)).flatten({ background: '#0E7490' }).png()
    .toFile(`${OUT}/social-app-service-1080.png`);
  const m = await sharp(`${OUT}/social-app-service-1080.png`).metadata();
  console.log(`written: ${m.width}x${m.height}`);
})().catch(e => { console.error(e); process.exit(1); });
