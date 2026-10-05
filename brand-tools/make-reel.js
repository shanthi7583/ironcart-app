// Builds a 14-second vertical Reel (1080x1920, 30fps) as an MP4.
//
// Frames are drawn as SVG and rendered with sharp, then stitched with ffmpeg. There
// is no footage to shoot and nothing to film: the whole thing is type on the brand
// gradient, which is also why it stays legible at the size people actually watch it.
//
//   node make-reel.js          → ../public/brand/reel-app-service.mp4
//
// Needs ffmpeg on PATH as well as sharp.
const sharp = require('sharp');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const W = 1080, H = 1920, FPS = 30;
// Absolute, like the sibling generators: these get run from wherever sharp happens
// to be installed, so a path relative to the script lands somewhere unexpected.
const OUT = 'C:/Users/shant/Demo/ironing-app/public/brand';
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

// Reels put the caption and the like/comment/share buttons over the frame: the right
// ~190px and the bottom ~420px are covered on a lot of phones, and the top ~250px
// carries the account row. Everything here stays inside x 80–880, y 320–1400.
const SAFE_X = 80, SAFE_R = 880;

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = v => Math.max(0, Math.min(1, v));

// Each line rises a little and fades in, one after the next. `at` is when this line
// starts, in seconds from the start of its scene.
function rise(local, at, dur = 0.5) {
  const p = ease(clamp01((local - at) / dur));
  return { o: p, dy: (1 - p) * 34 };
}

const text = (x, y, s, { size, weight = 600, family = SANS, fill = '#FFFFFF', opacity = 1, anchor = 'start', spacing = 0 }) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}"
     fill="${fill}" opacity="${opacity.toFixed(3)}" text-anchor="${anchor}"
     letter-spacing="${spacing}">${s}</text>`;

// --- scenes -----------------------------------------------------------------
// Each returns SVG for a local time in seconds. The hook earns the next two seconds;
// the price list only appears once someone has a reason to care about it.

function hook(t) {
  const L = ['Your customers', 'already order', 'on WhatsApp.'];
  return L.map((s, i) => {
    const { o, dy } = rise(t, 0.15 + i * 0.28);
    return text(SAFE_X, 620 + i * 118 + dy, s, { size: 86, weight: 700, family: SERIF, opacity: o });
  }).join('');
}

function turn(t) {
  const a = rise(t, 0.1), b = rise(t, 0.38);
  return (
    text(SAFE_X, 660 + a.dy, 'Make it work', { size: 92, weight: 700, family: SERIF, opacity: a.o }) +
    text(SAFE_X, 778 + b.dy, 'properly.', { size: 92, weight: 700, family: SERIF, opacity: b.o })
  );
}

function offer(t) {
  const a = rise(t, 0.1), b = rise(t, 0.4), c = rise(t, 0.7);
  const TRADES = ['Laundry', 'Dry clean', 'Tailoring', 'Repairs', 'Grocery', 'Bakery', 'Pharmacy'];
  let x = SAFE_X, y = 1000, chips = '';
  TRADES.forEach((label, i) => {
    const fs_ = 27, h = 50;
    const w = Math.round(label.length * fs_ * 0.56) + 36;
    if (x + w > SAFE_R) { x = SAFE_X; y += h + 13; }
    const p = ease(clamp01((t - (0.85 + i * 0.07)) / 0.4));
    chips +=
      `<g opacity="${p.toFixed(3)}">` +
      `<rect x="${x}" y="${y + (1 - p) * 16}" width="${w}" height="${h}" rx="${h / 2}" fill="#FFFFFF" opacity="0.16"/>` +
      text(x + w / 2, y + 34 + (1 - p) * 16, label, { size: fs_, weight: 600, anchor: 'middle', opacity: 0.95 }) +
      `</g>`;
    x += w + 11;
  });
  return (
    text(SAFE_X, 600 + a.dy, 'Take orders', { size: 94, weight: 700, family: SERIF, opacity: a.o }) +
    text(SAFE_X, 712 + b.dy, 'online.', { size: 94, weight: 700, family: SERIF, opacity: b.o }) +
    text(SAFE_X, 820 + c.dy, 'A web app for your shop —', { size: 40, weight: 600, opacity: c.o * 0.97 }) +
    text(SAFE_X, 876 + c.dy, 'live in 2–3 weeks.', { size: 40, weight: 600, opacity: c.o * 0.97 }) +
    chips
  );
}

function prices(t) {
  const head = rise(t, 0.05);
  const ROWS = [
    ['BASIC', '₹25,000', 'Ordering, payments, one dashboard'],
    ['STANDARD', '₹45,000', '+ delivery view, reports, your own icon'],
    ['COMPLETE', '₹85,000', '+ branches, staff logins, priority support'],
  ];
  const rows = ROWS.map(([label, price, scope], i) => {
    const p = ease(clamp01((t - (0.35 + i * 0.3)) / 0.45));
    const y = 700 + i * 142 + (1 - p) * 28;
    return (
      `<g opacity="${p.toFixed(3)}">` +
      `<rect x="${SAFE_X}" y="${y}" width="${SAFE_R - SAFE_X}" height="126" rx="22" fill="#FFFFFF" opacity="${i === 1 ? 0.22 : 0.12}"/>` +
      text(SAFE_X + 28, y + 50, label, { size: 28, weight: 700, opacity: 0.8, spacing: 1.6 }) +
      text(SAFE_R - 28, y + 54, price, { size: 46, weight: 800, anchor: 'end' }) +
      text(SAFE_X + 28, y + 96, scope, { size: 24, weight: 500, opacity: 0.82 }) +
      `</g>`
    );
  }).join('');
  return text(SAFE_X, 620 + head.dy, 'Your own app', { size: 64, weight: 700, family: SERIF, opacity: head.o }) + rows;
}

function close(t) {
  const a = rise(t, 0.1), b = rise(t, 0.45), c = rise(t, 0.75);
  return (
    text(SAFE_X, 640 + a.dy, 'Free demo.', { size: 92, weight: 700, family: SERIF, opacity: a.o }) +
    text(SAFE_X, 726 + a.dy, 'See it before you pay.', { size: 38, weight: 600, opacity: a.o * 0.9 }) +
    text(SAFE_X, 884 + b.dy, 'pressgo.co.in', { size: 52, weight: 800, opacity: b.o }) +
    text(SAFE_X, 962 + c.dy, 'WhatsApp 96113 62505', { size: 44, weight: 700, opacity: c.o * 0.95 })
  );
}

// start time, duration, draw
const SCENES = [
  [0.0, 2.7, hook],
  [2.7, 2.5, turn],
  [5.2, 3.4, offer],
  [8.6, 3.2, prices],
  [11.8, 2.6, close],
];
const TOTAL = SCENES[SCENES.length - 1][0] + SCENES[SCENES.length - 1][1];

function frame(t) {
  const scene = SCENES.find(([s, d]) => t >= s && t < s + d) || SCENES[SCENES.length - 1];
  const [start, dur, draw] = scene;
  const local = t - start;
  // Crossfade the last 0.35s of every scene but the final one.
  const fadeOut = scene === SCENES[SCENES.length - 1] ? 1 : clamp01((dur - local) / 0.35);
  // A slow push on the background keeps a still frame from looking frozen.
  const k = 1 + 0.045 * (t / TOTAL);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1E3A8A"/>
        <stop offset="55%" stop-color="#0E7490"/>
        <stop offset="100%" stop-color="#0F766E"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <g transform="translate(${(W * (1 - k)) / 2}, ${(H * (1 - k)) / 2}) scale(${k.toFixed(4)})">
      <g opacity="${fadeOut.toFixed(3)}">${draw(local)}</g>
    </g>
  </svg>`;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  const count = Math.round(TOTAL * FPS);
  for (let i = 0; i < count; i++) {
    await sharp(Buffer.from(frame(i / FPS)))
      .flatten({ background: '#0E7490' }).png({ compressionLevel: 1 })
      .toFile(path.join(dir, `f${String(i).padStart(4, '0')}.png`));
    if (i % 60 === 0) process.stdout.write(`${i}/${count}\r`);
  }

  const out = path.join(OUT, 'reel-app-service.mp4');
  // A silent audio track: some players and uploaders behave oddly with none at all,
  // and Instagram lays its own music over whatever is here anyway.
  execFileSync('ffmpeg', [
    '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', out,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`written: ${out} · ${count} frames · ${TOTAL.toFixed(1)}s · ${(fs.statSync(out).size / 1048576).toFixed(2)} MB`);
})().catch(e => { console.error(e); process.exit(1); });
