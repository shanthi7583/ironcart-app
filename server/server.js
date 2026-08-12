import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import https from 'https';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { initializeApp as initializeFirebaseApp, getApps as getFirebaseApps, cert as firebaseCert } from 'firebase-admin/app';
import { getAuth as getFirebaseAuth } from 'firebase-admin/auth';
import { getMessaging as getFirebaseMessaging } from 'firebase-admin/messaging';
import { waitUntil } from '@vercel/functions';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Keep the untouched bytes around: Cashfree signs the raw payload, so the webhook has
// to hash exactly what was sent, not a re-serialisation of the parsed object.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Initialize Supabase Client
// Prefer a service role key (server-only, never shipped to the browser) so backend
// writes don't depend on Row Level Security policies being permissive. Falls back to
// the anon key for backward compatibility, but that path should be treated as temporary.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase PostgreSQL Client Initialized.');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set — running with the anon key instead. Set the service role key (Supabase Dashboard → Settings → API) and enable Row Level Security on the orders/customers tables.');
  }
} else {
  console.error('⚠️ Supabase URL or Key missing in Vercel Environment Variables!');
}

// Initialize Cashfree config only if keys are present in .env. There's no persistent
// client object (unlike the old Razorpay SDK) — every call hits Cashfree's REST API
// directly with these credentials attached as headers.
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
const CASHFREE_BASE_URL = CASHFREE_ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
const cashfreeConfigured = !!(CASHFREE_APP_ID && CASHFREE_SECRET_KEY);
if (cashfreeConfigured) {
  console.log(`✅ Cashfree Payment Gateway Initialized (${CASHFREE_ENV} mode).`);
} else {
  console.log('⚠️ Cashfree keys missing. Operating in simulated Payment Demo Mode.');
}

function cashfreeHeaders() {
  return {
    'x-client-id': CASHFREE_APP_ID,
    'x-client-secret': CASHFREE_SECRET_KEY,
    'x-api-version': '2023-08-01',
    'Content-Type': 'application/json'
  };
}

// Initialize Firebase Admin (server-side verification for phone-auth ID tokens).
// The client verifies the phone with Firebase directly — real telecom transactional
// SMS routes, not subject to the DND/promotional-route issues Fast2SMS hits — but we
// never trust the client's bare claim that verification succeeded. The ID token it
// hands back is independently re-checked against Google's servers here before we
// issue our own session for that phone number.
let firebaseAuth = null;
let firebaseMessaging = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    const firebaseApp = getFirebaseApps().length
      ? getFirebaseApps()[0]
      : initializeFirebaseApp({ credential: firebaseCert(serviceAccount) });
    firebaseAuth = getFirebaseAuth(firebaseApp);
    firebaseMessaging = getFirebaseMessaging(firebaseApp);
    console.log('✅ Firebase Admin Initialized — phone auth verified server-side.');
  } catch (err) {
    console.error('⚠️ Failed to initialize Firebase Admin (check FIREBASE_SERVICE_ACCOUNT_KEY):', err.message);
  }
} else {
  console.log('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY missing. Phone login (the only auth route) will not work.');
}

// Best-effort push notification for order updates — sent alongside the existing
// SMS/WhatsApp dispatch, never instead of it. A customer with no registered device
// (web-only, or push permission denied) just gets the SMS as before; a missing/stale
// token or a messaging error here must never block the order-lifecycle request that
// triggered it, so every failure is caught and logged rather than thrown.
async function sendPushNotification(phone, title, body, data = {}) {
  if (!firebaseMessaging || !supabase || !phone) return { ok: false, reason: 'not configured' };
  const { data: cust, error } = await supabase.from('customers').select('fcm_token').eq('phone', phone).single();
  if (error) {
    console.error(`Push notification skipped for ${phone} — token lookup failed:`, error.message);
    return { ok: false, reason: error.message };
  }
  const token = cust?.fcm_token;
  if (!token) return { ok: false, reason: 'no registered device' };
  try {
    await firebaseMessaging.send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' }
    });
    return { ok: true };
  } catch (err) {
    console.error(`Push notification failed for ${phone}:`, err.message);
    return { ok: false, reason: err.message };
  }
}

// --- SESSIONS ---
// Lightweight signed tokens (HMAC-SHA256) so we don't need a JWT dependency.
// Payload is base64url JSON + a signature; verified with a constant-time compare.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.warn('⚠️ SESSION_SECRET is not set. Using an insecure development fallback — set a long random SESSION_SECRET env var before going live, otherwise anyone who reads this warning could forge admin sessions.');
}
const secret = SESSION_SECRET || 'iron-kart-dev-secret-change-me';

function signToken(payload, expiresInSeconds) {
  const body = { ...payload, exp: Date.now() + expiresInSeconds * 1000 };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig || '');
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!body.exp || Date.now() > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.user = payload;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Cashfree order_ids are generated by us server-side (never accepted from the
// client) when the order is created, and the amount is fixed at that point from
// our own quote — never from anything the client claims. So there's no client-side
// signature to check; we just ask Cashfree directly what actually happened to the
// order_id our own server created, the same principle the old Razorpay check used
// (never trust the client's bare claim that a payment succeeded).
async function fetchConfirmedCashfreeAmount(cashfreeOrderId) {
  if (!cashfreeConfigured || !cashfreeOrderId) return null;
  try {
    const res = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(cashfreeOrderId)}`, {
      headers: cashfreeHeaders()
    });
    if (!res.ok) return null;
    const order = await res.json();
    if (order.order_status !== 'PAID') return null;
    return order.order_amount;
  } catch (err) {
    console.error('Cashfree order lookup failed:', err.message);
    return null;
  }
}

// --- Authoritative pricing (never trust a total the client sends) ---
// Deliberately empty. WELCOME50 and FIRST10 had no first-order check and no usage
// cap, so anyone who learned a code could reuse it on every order indefinitely — and
// since a discount is capped at the subtotal, WELCOME50 on a small basket took the
// garments to zero. The welcome discount is applied automatically now, so a shareable
// code earns nothing and only carries the risk. The mechanism stays in place for a
// future campaign that has real limits behind it.
const COUPONS = {};

// Acquisition and delivery economics, overridable from the admin panel (stored as a
// system row like the support contact) so these can be tuned without a redeploy.
//
// welcomePercent    — off a customer's *first* order. Deliberately a percentage, not a
//                     flat amount: at ₹10–20 an item a flat discount can exceed a small
//                     first order entirely, and it's capped at the subtotal, so trial
//                     orders were coming out free while still costing a round trip.
// welcomeMinOrder   — low enough that a genuine trial order (~10 garments) reaches it.
// freeDeliveryAbove — applies to everyone, not just new customers. Small orders never
//                     paid for their own pickup and return.
const PRICING_DEFAULTS = {
  welcomePercent: 0.25,
  welcomeMinOrder: 150,
  freeDeliveryAbove: 250,
  deliveryFee: 30,
  // Speed is the least price-sensitive thing on offer — nobody comparison-shops
  // urgency — and it costs almost nothing extra to provide. Both competitors charge
  // roughly triple for it; +20%/+50% was leaving that margin on the table.
  expressMarkup: 1.0,
  urgentMarkup: 2.0,
  // Prime is off by default. See the subscriptions/activate guard for why.
  primeEnabled: false,
  // Campaign: "your first 2 orders are free, up to ₹100 each". A credit covers the
  // whole order up to the cap and carries free pickup regardless of size, since the
  // offer promises that outright.
  campaignFreeOrders: 2,
  campaignMaxPerOrder: 100
};

async function getPricingSettings() {
  if (!supabase) return { ...PRICING_DEFAULTS };
  const { data, error } = await supabase
    .from('prices')
    .select('icon')
    .eq('category', 'system')
    .eq('item_name', 'pricing_rules')
    .limit(1);
  if (error || !data || data.length === 0) return { ...PRICING_DEFAULTS };
  try {
    return { ...PRICING_DEFAULTS, ...JSON.parse(data[0].icon) };
  } catch {
    return { ...PRICING_DEFAULTS };
  }
}

// A first order is one where this phone has no earlier order that wasn't cancelled.
// Checked server-side against real order history — the previous WELCOME50 code had no
// such check at all, so any customer could reuse it on every order indefinitely.
async function isFirstOrder(customerPhone) {
  if (!customerPhone || !supabase) return false;
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('customer_phone', customerPhone)
    .neq('status', 'Cancelled')
    .limit(1);
  // On a lookup failure, decline the discount rather than hand it out — a customer
  // wrongly charged full price can be refunded; one wrongly discounted cannot.
  if (error) {
    console.error(`First-order lookup failed for ${customerPhone}, pricing without the welcome discount:`, error.message);
    return false;
  }
  return !data || data.length === 0;
}

const SUBSCRIPTION_DISCOUNTS = {
  Bronze: { 'Light Weight': 0.05, 'Medium/Heavy': 0.10, 'Premium': 0.15, 'Household': 0.10 },
  Silver: { 'Light Weight': 0.10, 'Medium/Heavy': 0.20, 'Premium': 0.30, 'Household': 0.15 },
  Gold: { 'Light Weight': 0.15, 'Medium/Heavy': 0.30, 'Premium': 0.45, 'Household': 0.20 }
};

async function getPriceCatalog() {
  if (supabase) {
    const { data, error } = await supabase.from('prices').select('*').order('id', { ascending: true });
    if (!error && data && data.length > 0) {
      return data.filter(p => p.category !== 'system').map(p => ({
        name: p.item_name,
        price: p.price,
        category: p.category,
        serviceType: p.service_type || 'Ironing'
      }));
    }
  }
  return DEFAULT_PRICE_LIST;
}

// Recomputes subtotal/discount/tax/total from the server's own price catalog and the
// customer's real (database) subscription tier — cartItems only ever supplies item
// identity + quantity, never a price or a total. This is the one place that decides
// what an order actually costs.
async function computeQuote({ cartItems, couponCode, customerPhone, speed }) {
  const catalog = await getPriceCatalog();
  const lookup = new Map(catalog.map(p => [`${p.serviceType}-${p.name}`, p]));

  let subtotal = 0;
  const items = [];
  for (const ci of (cartItems || [])) {
    const p = lookup.get(`${ci.serviceType}-${ci.name}`);
    const qty = Math.max(0, Math.floor(Number(ci.qty) || 0));
    if (!p || qty <= 0) continue;
    subtotal += p.price * qty;
    items.push({ name: `${p.serviceType} - ${p.name}`, qty, price: p.price, category: p.category });
  }

  const rules = await getPricingSettings();

  // Only trust our own enum of speeds — an unrecognized value is priced as Normal
  // rather than trusting whatever the client sent.
  const markupMultiplier = speed === 'Urgent' ? rules.urgentMarkup : speed === 'Express' ? rules.expressMarkup : 0;
  const markup = Math.round(subtotal * markupMultiplier * 100) / 100;

  let activePlan = 'None';
  let freeOrderCredits = 0;
  if (customerPhone && supabase) {
    // select('*') rather than naming columns: asking for a column that doesn't exist
    // yet fails the entire select, and this lookup degrades to "no subscription" on
    // error — so naming free_order_credits before its migration had run silently
    // stripped every Prime member's discount in production. A whole row costs nothing
    // extra here and cannot break when the schema moves ahead of, or behind, the code.
    const { data, error } = await supabase.from('customers').select('*').eq('phone', customerPhone).single();
    // Deliberately degrades to "no subscription discount" rather than failing the
    // whole quote/checkout over a transient lookup error - worst case a subscriber
    // pays full price once, which is recoverable, versus blocking checkout entirely.
    // Logged so it's visible instead of silently invisible.
    if (error) console.error(`Subscription lookup failed for ${customerPhone}, pricing without a discount:`, error.message);
    activePlan = data?.active_plan || 'None';
    freeOrderCredits = data?.free_order_credits || 0;
  }

  // Every discount the customer could qualify for, then apply the single best one.
  // Picking the largest means a Prime member placing their first order is never worse
  // off than they'd be today, whichever way the welcome offer moves.
  const candidates = [];

  if (activePlan !== 'None' && SUBSCRIPTION_DISCOUNTS[activePlan]) {
    let planDiscount = 0;
    for (const it of items) {
      const pct = SUBSCRIPTION_DISCOUNTS[activePlan][it.category] || 0;
      planDiscount += it.price * it.qty * pct;
    }
    if (planDiscount > 0) candidates.push({ amount: planDiscount, label: `${activePlan} Prime` });
  }

  // A campaign credit replaces the welcome discount rather than stacking with it.
  // Stacking would take a first order close to zero while still costing two round
  // trips, so whoever holds a credit simply doesn't get the percentage offer as well.
  const usingCampaignCredit = freeOrderCredits > 0 && rules.campaignMaxPerOrder > 0;
  if (usingCampaignCredit) {
    candidates.push({
      amount: Math.min(subtotal, rules.campaignMaxPerOrder),
      label: 'Free order',
      campaign: true
    });
  } else if (rules.welcomePercent > 0 && subtotal >= rules.welcomeMinOrder && await isFirstOrder(customerPhone)) {
    candidates.push({ amount: subtotal * rules.welcomePercent, label: 'First order' });
  }

  if (couponCode && COUPONS[couponCode]) {
    const c = COUPONS[couponCode];
    candidates.push({ amount: c.type === 'flat' ? c.value : subtotal * c.value, label: couponCode });
  }

  const best = candidates.sort((a, b) => b.amount - a.amount)[0];
  let discount = best ? best.amount : 0;
  // couponApplied stays the promo-code name only — other code keys off it — while
  // discountLabel names whatever the saving actually came from, so the checkout summary
  // no longer shows an empty "Discount ()" for plan and first-order discounts.
  const couponApplied = best && best.label === couponCode ? couponCode : '';
  const discountLabel = best ? best.label : '';

  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  // Charged on what was ordered, before discounts — a discount shouldn't move an order
  // below the threshold and start costing delivery it had already earned for free.
  // The campaign promises free pickup outright, so a credit waives it at any size.
  const redeemingCredit = !!(best && best.campaign);
  const deliveryFee = redeemingCredit || subtotal === 0 || subtotal >= rules.freeDeliveryAbove
    ? 0
    : rules.deliveryFee;

  const taxable = Math.max(0, subtotal - discount + markup + deliveryFee);
  const tax = Math.round(taxable * 0.05 * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  return {
    subtotal, discount, markup, deliveryFee, tax, total, couponApplied, discountLabel,
    freeDeliveryAbove: rules.freeDeliveryAbove,
    // Order creation reads this to burn the credit — only once the order is actually
    // saved, so an abandoned checkout never costs the customer one of their two.
    redeemingCredit,
    items: items.map(({ name, qty, price }) => ({ name, qty, price }))
  };
}

const ADMIN_PIN = process.env.ADMIN_PIN || '9791';
const RIDER_PIN = process.env.RIDER_PIN || '8888';
const OWNER_ALERT_PHONE = process.env.OWNER_ALERT_PHONE || '9791019505';
const PLAN_PRICES = { Bronze: 299, Silver: 499, Gold: 699 };

// Mirrors BASE_GARMENTS in src/App.tsx — kept as a separate literal here (rather than
// imported) because the client and server are different build targets, but the two
// MUST stay in sync. They drifted once already: this list used to be a much smaller
// 20-row Apparel/Outerwear/Bedding set left over from an early prototype, while the
// client's list grew to this richer 35-item catalog — since the empty-table seed
// below only ever fires once (never re-runs against a non-empty table), that drift
// stayed permanently live in production until caught and fixed via
// POST /api/admin/reseed-prices.
const BASE_GARMENTS = [
  { name: 'Baby Clothes', price: 20, category: 'Light Weight' },
  { name: 'Kids Wear', price: 20, category: 'Light Weight' },
  { name: 'Uniform', price: 20, category: 'Light Weight' },
  { name: 'Legging', price: 20, category: 'Light Weight' },
  { name: 'Pajama', price: 20, category: 'Light Weight' },
  { name: 'Salwar', price: 20, category: 'Light Weight' },
  { name: 'Kurta', price: 20, category: 'Light Weight' },
  { name: 'T-Shirt', price: 20, category: 'Light Weight' },
  { name: 'Trouser/Pant', price: 20, category: 'Light Weight' },
  { name: 'Jacket', price: 50, category: 'Medium/Heavy' },
  { name: 'Blazer', price: 80, category: 'Medium/Heavy' },
  { name: 'Skirt', price: 45, category: 'Medium/Heavy' },
  { name: 'Dhoti', price: 30, category: 'Medium/Heavy' },
  { name: 'Party Top', price: 35, category: 'Medium/Heavy' },
  { name: 'Silk Kurta', price: 40, category: 'Medium/Heavy' },
  { name: 'Sweater', price: 60, category: 'Medium/Heavy' },
  { name: 'Bridal Set', price: 250, category: 'Premium' },
  { name: 'Designer Blouse', price: 60, category: 'Premium' },
  { name: 'Designer Saree', price: 100, category: 'Premium' },
  { name: 'Formal Suit', price: 120, category: 'Premium' },
  { name: 'Lehenga', price: 200, category: 'Premium' },
  { name: 'Sherwani', price: 250, category: 'Premium' },
  { name: 'Silk Saree', price: 120, category: 'Premium' },
  { name: 'Winter Coat', price: 150, category: 'Premium' },
  { name: 'Cushion Cover', price: 20, category: 'Household' },
  { name: 'Face Towel', price: 20, category: 'Household' },
  { name: 'Handkerchief', price: 20, category: 'Household' },
  { name: 'Kitchen Towel', price: 20, category: 'Household' },
  { name: 'Pillow Cover', price: 20, category: 'Household' },
  { name: 'Table Mat', price: 20, category: 'Household' },
  { name: 'Bed Sheet', price: 65, category: 'Household' },
  { name: 'Blanket', price: 100, category: 'Household' },
  { name: 'Comforter', price: 120, category: 'Household' },
  { name: 'Curtain', price: 80, category: 'Household' },
  { name: 'Sofa Cover', price: 90, category: 'Household' },
];

const DEFAULT_PRICE_LIST = [];
BASE_GARMENTS.forEach(item => {
  DEFAULT_PRICE_LIST.push({ ...item, serviceType: 'Ironing' });
  DEFAULT_PRICE_LIST.push({ ...item, price: Math.round(item.price * 2.5), serviceType: 'Dry Cleaning' });
  DEFAULT_PRICE_LIST.push({ ...item, price: Math.round(item.price * 1.5), serviceType: 'Laundry' });
});

const DEFAULT_CUSTOMERS = [
  {
    name: 'Shanthi Jayaraman',
    phone: '9791019505',
    email: 'shanthi.jayaraman7@gmail.com',
    apartmentNo: 'Apt 402, Block C',
    address: '123 Tech Park, Whitefield, Bengaluru'
  }
];

// --- SIMULATED SMS / WHATSAPP GATEWAY DISPATCHER ---
// Integrated with Fast2SMS for cost-effective Indian mobile SMS OTPs & Alerts.
// Returns a Promise<{ok, reason}> so callers that need to know whether delivery
// actually succeeded (the OTP route) can check it — Fast2SMS returns HTTP 200 even
// when it fails to send (e.g. "insufficient wallet balance"), so the HTTP status
// alone proves nothing. Existing fire-and-forget callers (order status updates,
// welcome messages, etc.) are unaffected — they never awaited this and still don't
// have to; failing to notify about an already-successful action is a lesser issue
// than the OTP route silently telling a customer "sent" when nothing went out.
// Marketing goes out over the WhatsApp Business API when one is configured, and only
// then. WhatsApp permits business-initiated marketing solely through pre-approved
// templates on a real Business API account; blasting it from an ordinary number gets
// that number banned, which would take out order notifications and support at the
// same time.
//
// Note this is a genuinely different channel from sendNotification below: despite the
// 'whatsapp' argument it accepts, that function sends SMS through Fast2SMS. Nothing
// in this app has ever sent a real WhatsApp message.
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_TEMPLATE = process.env.WHATSAPP_TEMPLATE_NAME;
const whatsappConfigured = !!(WHATSAPP_API_URL && WHATSAPP_API_TOKEN && WHATSAPP_TEMPLATE);

async function sendCampaignMessage(phone, message) {
  if (whatsappConfigured) {
    try {
      const res = await fetch(WHATSAPP_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `91${phone}`,
          type: 'template',
          template: { name: WHATSAPP_TEMPLATE, language: { code: 'en' } }
        })
      });
      if (!res.ok) {
        console.error('WhatsApp send failed:', res.status, (await res.text()).slice(0, 200));
        return { ok: false };
      }
      return { ok: true, channel: 'whatsapp' };
    } catch (err) {
      console.error('WhatsApp send error:', err.message);
      return { ok: false };
    }
  }
  // No WhatsApp account wired up: fall back to SMS. Promotional SMS in India needs
  // DLT registration and is blocked to DND numbers, so expect partial delivery.
  const result = await sendNotification('sms', phone, message);
  return { ok: !!result?.ok, channel: 'sms' };
}

const sendNotification = (type, phone, message) => {
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`\n======================================================`);
  console.log(`🔔 [NOTIFICATION SERVICE] - ${timestamp}`);
  console.log(`📱 Channel: ${type.toUpperCase()}`);
  console.log(`📞 Target Phone: +91 ${phone}`);
  console.log(`💬 Message: "${message}"`);
  console.log(`======================================================\n`);

  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (!fast2smsKey || !(type === 'sms' || type === 'otp' || type === 'whatsapp')) {
    return Promise.resolve({ ok: false, reason: 'Fast2SMS is not configured' });
  }

  const postData = JSON.stringify({
    route: 'q',
    message: message,
    language: 'english',
    flash: 0,
    numbers: phone
  });

  const options = {
    hostname: 'www.fast2sms.com',
    path: '/dev/bulkV2',
    method: 'POST',
    headers: {
      'authorization': fast2smsKey,
      'Content-Type': 'application/json',
      // Byte length, not JS string length — messages routinely carry ₹ and emoji,
      // which are multiple UTF-8 bytes but a single UTF-16 code unit each. Using
      // postData.length undercounts Content-Length for any such message, so
      // Fast2SMS truncates the body at that shorter length — silently dropping
      // whatever field lands past the cut (numbers, being last, every time).
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`✉️ Fast2SMS Live Dispatch Response Status: ${res.statusCode} - ${body}`);
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { /* non-JSON response */ }
        // Fast2SMS returns HTTP 200 with { return: false, message: '...' } on failure
        // (e.g. insufficient wallet balance) — the JSON body is the real verdict.
        const ok = res.statusCode === 200 && !!parsed && parsed.return === true;
        resolve({ ok, reason: ok ? null : (parsed?.message || `Fast2SMS returned HTTP ${res.statusCode}`) });
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Fast2SMS Live Transmission Failed: ${e.message}`);
      resolve({ ok: false, reason: e.message });
    });

    req.write(postData);
    req.end();
  });
};

// --- API MAPPER HELPERS ---
const mapOrderToFrontend = (o) => ({
  id: o.id,
  customerPhone: o.customer_phone,
  customerName: o.customer_name,
  apartmentNo: o.apartment_no,
  address: o.address,
  status: o.status,
  paymentStatus: o.payment_status,
  paymentMethod: o.payment_method,
  pickupDate: o.pickup_date,
  pickupTime: o.pickup_time,
  subtotal: o.subtotal,
  total: o.total,
  items: o.items,
  specialInstructions: o.special_instructions,
  cancelReason: o.cancel_reason,
  deliveryTimeline: o.delivery_timeline,
  createdAt: o.created_at
});

const mapCustomerToFrontend = (c) => ({
  phone: c.phone,
  name: c.name,
  walletBalance: c.wallet_balance || 0,
  subscriptionQuota: c.subscription_quota || 0,
  activePlan: c.active_plan || 'None',
  apartmentNo: c.apartment_no || '',
  address: c.address || '',
  addresses: c.addresses,
  referralCode: c.referral_code,
  referredBy: c.referred_by
});

// Returns { ok, error } instead of swallowing failures — a silent failure here is
// exactly what made UPI/offers settings look saved while never actually persisting.
async function upsertSystemSetting(itemName, iconValue) {
  const { data: existing, error: lookupError } = await supabase.from('prices').select('id').eq('category', 'system').eq('item_name', itemName);
  if (lookupError) return { ok: false, error: lookupError };
  if (existing && existing.length > 0) {
    const { error } = await supabase.from('prices').update({ icon: iconValue }).eq('id', existing[0].id);
    if (error) return { ok: false, error };
  } else {
    const { error } = await supabase.from('prices').insert([{ category: 'system', item_name: itemName, price: 0, icon: iconValue, service_type: 'system' }]);
    if (error) return { ok: false, error };
  }
  return { ok: true };
}

// Best-effort wallet transaction log. Swallows errors so it never breaks the wallet
// operation itself — e.g. if the wallet_transactions table hasn't been created yet
// (see the migration note in server/.env.example), balances still update correctly,
// the history list is just empty until the table exists.
async function logWalletTransaction(phone, type, amount, description) {
  if (!supabase) return;
  // The client returns { error } rather than throwing, so the try/catch that used to
  // wrap this never fired — a missing table meant money moved with no record and not
  // even a log line. Still non-fatal (a failed ledger write must not fail the payment
  // that already succeeded) but now it is loud, because a silent one hid the fact that
  // wallet_transactions had never been created at all.
  const { error } = await supabase.from('wallet_transactions').insert([{
    customer_phone: phone,
    type,
    amount,
    description
  }]);
  if (error) {
    console.error(`WALLET LEDGER WRITE FAILED — ${type} ₹${amount} for ${phone} (${description}):`, error.message);
  }
}

// --- AUTH ROUTES ---

// Issues a signed session token scoped to a phone number once it's been verified.
// Used by the Firebase login route: the client verifies the phone directly with
// Firebase (real telecom transactional SMS route), and we independently re-check
// that verification server-side (see /api/auth/firebase-login below) before
// trusting it. Returns { status, body } so the caller just forwards it as the
// HTTP response.
async function issueSessionForPhone(phone) {
  const token = signToken({ role: 'customer', phone }, 30 * 24 * 60 * 60);

  let customer = null;
  if (supabase) {
    const { data, error } = await supabase.from('customers').select('*').eq('phone', phone);
    if (error) {
      console.error('Customer lookup failed during login:', error.message);
      return { status: 503, body: { error: 'Could not verify your account right now. Please try again.' } };
    }
    if (data && data.length > 0) customer = mapCustomerToFrontend(data[0]);
  } else {
    customer = DEFAULT_CUSTOMERS.find(c => c.phone === phone) || null;
  }
  return { status: 200, body: { token, exists: !!customer, customer } };
}

// Firebase phone-auth login: the client already completed verification directly with
// Firebase (real telecom transactional SMS route). We independently re-verify the ID
// token it hands back with Firebase Admin before trusting the phone number in it —
// never just take the client's word that verification happened.
app.post('/api/auth/firebase-login', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'ID token is required' });
  if (!firebaseAuth) return res.status(503).json({ error: 'Firebase sign-in is not configured on the server' });

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch (err) {
    console.error('Firebase ID token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired verification. Please try again.' });
  }

  const rawPhone = decoded.phone_number; // e.g. "+919791019505"
  if (!rawPhone) return res.status(400).json({ error: 'This sign-in is not linked to a phone number' });
  const phone = rawPhone.replace(/\D/g, '').slice(-10);
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Could not read a valid phone number from verification' });

  const { status, body } = await issueSessionForPhone(phone);
  res.status(status).json(body);
});

// Admin / rider login: PIN never leaves the server, and the client only ever gets a token back.
app.post('/api/auth/admin-login', (req, res) => {
  const { pin } = req.body;
  if (pin && pin === ADMIN_PIN) {
    return res.json({ token: signToken({ role: 'admin' }, 12 * 60 * 60), role: 'admin' });
  }
  if (pin && pin === RIDER_PIN) {
    return res.json({ token: signToken({ role: 'rider' }, 12 * 60 * 60), role: 'rider' });
  }
  res.status(401).json({ error: 'Invalid PIN' });
});

// --- API ROUTES ---

// 1. Get prices (public catalog, safe to expose — also carries system rows for upi/offers)
app.get('/api/prices', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('prices').select('*').order('id', { ascending: true });
    const hasGarments = data && data.some(p => p.category !== 'system');
    if (!error && hasGarments) return res.json(data);

    // The garment catalog specifically is missing — could be a fully empty table,
    // or (as found in production) a table that has only "system" rows (UPI
    // settings, offers) but zero actual price entries, which a bare data.length > 0
    // check would have missed entirely. Seed it instead of quietly falling back to
    // a response that was never actually written to the database.
    if (!error) {
      const seedRows = DEFAULT_PRICE_LIST.map(item => ({
        category: item.category, item_name: item.name, price: item.price, service_type: item.serviceType
      }));
      const { data: seeded, error: seedError } = await supabase.from('prices').insert(seedRows).select();
      if (!seedError && seeded && seeded.length > 0) {
        console.log(`Seeded ${seeded.length} default price rows — the garment catalog was empty.`);
        return res.json([...(data || []), ...seeded]);
      }
      if (seedError) console.error('Failed to seed default prices:', seedError.message);
    }
  }
  res.json(DEFAULT_PRICE_LIST);
});

// 1.5 Re-sync the garment catalog to the current DEFAULT_PRICE_LIST (Admin only).
// Unlike the empty-table seed above, this replaces whatever garment rows already
// exist — for when the database has drifted from the code's item list (found in
// production: an older, smaller Apparel/Outerwear/Bedding seed was still live even
// though DEFAULT_PRICE_LIST had long since grown to the richer Light Weight/Medium-
// Heavy/Premium/Household catalog, because the empty-table seed only ever triggers
// once and never re-runs against a non-empty table). System rows (UPI/offers
// settings) are left untouched.
app.post('/api/admin/reseed-prices', authMiddleware, requireRole('admin'), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });

  const { data: existing, error: readError } = await supabase.from('prices').select('id').neq('category', 'system');
  if (readError) {
    console.error('Reseed: failed to read existing garment rows:', readError.message);
    return res.status(500).json({ error: 'Could not read the existing catalog' });
  }

  if (existing.length > 0) {
    const { error: deleteError } = await supabase.from('prices').delete().in('id', existing.map(r => r.id));
    if (deleteError) {
      console.error('Reseed: failed to delete stale garment rows:', deleteError.message);
      return res.status(500).json({ error: 'Could not clear the existing catalog' });
    }
  }

  const freshRows = DEFAULT_PRICE_LIST.map(item => ({
    category: item.category, item_name: item.name, price: item.price, service_type: item.serviceType
  }));
  const { data: inserted, error: insertError } = await supabase.from('prices').insert(freshRows).select('id');
  if (insertError) {
    console.error('Reseed: failed to insert fresh catalog:', insertError.message);
    return res.status(500).json({ error: 'Catalog was cleared but the fresh insert failed — please retry.' });
  }

  console.log(`Reseeded price catalog: removed ${existing.length} stale rows, inserted ${inserted.length} fresh rows.`);
  res.json({ removed: existing.length, inserted: inserted.length });
});

// 2. Update prices (Admin) — now actually persists to Supabase instead of no-op success
app.put('/api/prices', authMiddleware, requireRole('admin'), async (req, res) => {
  const updatedPrices = req.body;
  if (!Array.isArray(updatedPrices)) {
    return res.status(400).json({ error: 'Body must be an array of prices' });
  }

  if (supabase) {
    const results = await Promise.all(updatedPrices.map(item =>
      supabase.from('prices')
        .update({ price: item.price })
        .eq('item_name', item.name)
        .eq('service_type', item.serviceType)
    ));
    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      console.error(`${failed.length}/${updatedPrices.length} price updates failed:`, failed[0].error.message);
      return res.status(500).json({ error: `${failed.length} of ${updatedPrices.length} price updates failed. Please try again.` });
    }
  }

  res.json({ message: 'Prices updated successfully', prices: updatedPrices });
});

// 2.5 Admin-only settings that used to be written straight from the browser via the
// Supabase anon key. Moved server-side so a customer token (or no token at all) can't
// touch them.
app.put('/api/settings/upi', authMiddleware, requireRole('admin'), async (req, res) => {
  const { phone, id } = req.body;
  if (!phone || !id) return res.status(400).json({ error: 'phone and id are required' });
  if (supabase) {
    const result = await upsertSystemSetting('upi_details', `${phone}|${id}`);
    if (!result.ok) {
      console.error('UPI settings save failed:', result.error?.message);
      return res.status(500).json({ error: 'Could not save UPI settings. Please try again.' });
    }
  }
  res.json({ success: true });
});

// Customer-facing support contact (the "Call Us" / "Chat with Us" buttons). Was
// hardcoded to the founder's personal number, which meant handing support to anyone
// else required a code change and redeploy. Stored as a system setting like the UPI
// details so it can be reassigned from the admin panel.
app.put('/api/settings/support', authMiddleware, requireRole('admin'), async (req, res) => {
  const { phone, whatsapp } = req.body;
  // Indian mobile numbers: 10 digits starting 6-9. Validated here rather than trusting
  // the client, since this value ends up in tel:/wa.me links shown to every customer.
  const valid = v => /^[6-9]\d{9}$/.test(String(v || '').trim());
  if (!valid(phone) || !valid(whatsapp)) {
    return res.status(400).json({ error: 'Enter valid 10-digit mobile numbers for both fields.' });
  }
  if (supabase) {
    const result = await upsertSystemSetting('support_contact', `${phone}|${whatsapp}`);
    if (!result.ok) {
      console.error('Support contact save failed:', result.error?.message);
      return res.status(500).json({ error: 'Could not save support contact. Please try again.' });
    }
  }
  res.json({ success: true });
});

// --- Unit economics ---
//
// What a garment costs to service, so a price can be checked against a target margin
// instead of guessed. Every figure here is an editable estimate, not a measurement —
// the defaults are a bottom-up model for a Bangalore operation with no route density
// yet, and they should be replaced with real numbers as soon as there are any.
//
// The dominant cost is the trip, not the ironing: a 45 rupee round trip spread over a
// 10-garment basket adds 4.50 per garment, against roughly 3 for the labour. That is
// why basket size moves margin far more than any per-item price change does.
const COST_DEFAULTS = {
  // Outsourced: the vendor's rate card charges ₹10 to steam iron a light garment.
  // Effort multipliers below scale that for heavier and more delicate work.
  processingPerGarment: 10,
  // A rider on ₹700/day plus ~₹100 fuel, completing about 20 stops a day. Each order
  // takes two stops — one to collect, one to return — so that is 10 orders a day and
  // ₹80 an order. An earlier ₹45 here was a guess with nothing behind it and it made
  // the catalogue look considerably healthier than it is. Revise this down as routes
  // tighten: density, not per-item price, is what moves this number.
  deliveryCostPerTrip: 80,
  avgBasketSize: 10,           // garments per order
  targetMargin: 0.30,
  // Anchored to the vendor's own rate card rather than invented: they charge ₹10 for a
  // shirt or trouser, ₹15 for a ladies' long top, ₹50 for a saree and ₹100 for a suit
  // pair. Household is a blend — ₹10 a pillow cover against ₹40 a bed cover — so it
  // sits between the two. Crude by category, since the vendor prices per item, but far
  // closer than a guess.
  effort: { 'Light Weight': 1, 'Medium/Heavy': 1.5, 'Premium': 5, 'Household': 1.5 }
};

async function getCostSettings() {
  if (!supabase) return { ...COST_DEFAULTS };
  const { data, error } = await supabase
    .from('prices').select('icon')
    .eq('category', 'system').eq('item_name', 'cost_model').limit(1);
  if (error || !data || data.length === 0) return { ...COST_DEFAULTS };
  try {
    const saved = JSON.parse(data[0].icon);
    return { ...COST_DEFAULTS, ...saved, effort: { ...COST_DEFAULTS.effort, ...(saved.effort || {}) } };
  } catch {
    return { ...COST_DEFAULTS };
  }
}

app.put('/api/settings/costs', authMiddleware, requireRole('admin'), async (req, res) => {
  const { processingPerGarment, deliveryCostPerTrip, avgBasketSize, targetMargin } = req.body;
  const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
  const p = num(processingPerGarment, 0, 10000);
  const d = num(deliveryCostPerTrip, 0, 100000);
  const b = num(avgBasketSize, 1, 1000);
  const m = num(targetMargin, 0, 95);
  if (p === null || d === null || b === null || m === null) {
    return res.status(400).json({ error: 'Enter non-negative costs, a basket size of at least 1, and a margin between 0 and 95%.' });
  }
  const model = { processingPerGarment: p, deliveryCostPerTrip: d, avgBasketSize: b, targetMargin: m / 100 };
  if (supabase) {
    const result = await upsertSystemSetting('cost_model', JSON.stringify(model));
    if (!result.ok) {
      console.error('Cost model save failed:', result.error?.message);
      return res.status(500).json({ error: 'Could not save the cost model. Please try again.' });
    }
  }
  res.json({ success: true, model });
});

// Every item priced against what it costs to service, so under-priced lines are
// visible rather than discovered at the end of a month.
app.get('/api/admin/margins', authMiddleware, requireRole('admin'), async (req, res) => {
  const c = await getCostSettings();
  const catalog = await getPriceCatalog();
  const deliveryPerGarment = c.deliveryCostPerTrip / c.avgBasketSize;

  const items = catalog.map(item => {
    const cost = c.processingPerGarment * (c.effort[item.category] || 1) + deliveryPerGarment;
    const margin = item.price > 0 ? (item.price - cost) / item.price : 0;
    return {
      name: item.name,
      category: item.category,
      price: item.price,
      cost: Math.round(cost * 100) / 100,
      marginPct: Math.round(margin * 1000) / 10,
      suggested: Math.ceil(cost / (1 - c.targetMargin)),
      belowTarget: margin < c.targetMargin
    };
  });

  const below = items.filter(i => i.belowTarget);
  res.json({
    model: { ...c, targetMarginPct: Math.round(c.targetMargin * 100), deliveryPerGarment: Math.round(deliveryPerGarment * 100) / 100 },
    summary: { total: items.length, belowTarget: below.length },
    items: items.sort((a, b) => a.marginPct - b.marginPct)
  });
});

// Which migrations have actually been applied. Added because schema drift has caused
// three separate live problems — a missing fcm_token silently disabled push, a missing
// pending_orders left interrupted payments unrecoverable, and a missing
// free_order_credits stripped every Prime member's discount — and in each case there
// was no way to check other than waiting for the symptom.
app.get('/api/admin/schema-check', authMiddleware, requireRole('admin'), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'No database connection' });

  const probe = async (table, column) => {
    const { error } = await supabase.from(table).select(column || '*').limit(1);
    return error ? { ok: false, detail: error.message } : { ok: true };
  };

  res.json({
    'orders':                      await probe('orders'),
    'customers':                   await probe('customers'),
    'customers.fcm_token':         await probe('customers', 'fcm_token'),
    'customers.free_order_credits': await probe('customers', 'free_order_credits'),
    'pending_orders':              await probe('pending_orders'),
    'leads':                       await probe('leads'),
    'wallet_transactions':         await probe('wallet_transactions'),
    'prices':                      await probe('prices')
  });
});

// --- Website leads and the first-order campaign ---

const CONSENT_TEXT = 'I agree to receive offers and updates from PressGo on WhatsApp/SMS.';

// The campaign message. Kept here so the copy that goes out is reviewable in one
// place rather than assembled at three call sites.
function campaignMessage(name) {
  const hi = name ? `Hi ${name}! ` : '';
  return `${hi}Thinking about that pile of ironing? This is the perfect time to try PressGo.

Your first 2 steam ironing orders are FREE (up to Rs.100 off each), with free pickup & delivery, back to you in 24 hours.

Open the PressGo app to schedule a pickup: https://pressgo.co.in

Reply STOP to unsubscribe.`;
}

// Public: someone on the marketing site leaving their details. Deliberately records
// the exact consent wording and the moment it was given — without that there's no
// defence if a recipient reports the message, and no way to prove opt-in to a
// WhatsApp provider during template review.
app.post('/api/leads', async (req, res) => {
  const { name, phone, consent } = req.body;
  if (!/^[6-9]\d{9}$/.test(String(phone || '').trim())) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  }
  if (consent !== true) {
    return res.status(400).json({ error: 'Please tick the box to receive offers from us.' });
  }
  if (!supabase) return res.json({ success: true });

  const { error } = await supabase.from('leads').upsert([{
    phone: String(phone).trim(),
    name: String(name || '').trim().slice(0, 80) || null,
    consent: true,
    consent_text: CONSENT_TEXT,
    consent_at: new Date().toISOString(),
    source: 'website',
    unsubscribed: false
  }], { onConflict: 'phone' });

  if (error) {
    console.error('Lead capture failed:', error.message);
    return res.status(500).json({ error: 'Could not save your details. Please try again.' });
  }
  res.json({ success: true });
});

// Public unsubscribe, so "Reply STOP" has somewhere to land and the app can offer a
// real opt-out link. No auth: knowing the number is the whole point, and the only
// action possible is switching someone off.
app.post('/api/leads/unsubscribe', async (req, res) => {
  const { phone } = req.body;
  if (!/^[6-9]\d{9}$/.test(String(phone || '').trim())) return res.status(400).json({ error: 'Invalid number' });
  if (supabase) {
    const { error } = await supabase.from('leads').update({ unsubscribed: true }).eq('phone', String(phone).trim());
    if (error) console.error('Unsubscribe failed:', error.message);
  }
  res.json({ success: true });
});

// Admin-triggered campaign send. Deliberately NOT on a timer: an automatic weekly
// blast is exactly what gets a sender number reported and banned, and the message
// has to go through an approved template on a real WhatsApp Business API account
// before it should run unattended at all.
//
// Guards, all of them load-bearing:
//   - only leads with recorded consent and no unsubscribe
//   - only leads not messaged within minIntervalDays
//   - never anyone who already registered as a customer (they aren't a lead any more)
//   - a hard cap per run, so a mistake can't message the whole list
app.post('/api/admin/campaign/send', authMiddleware, requireRole('admin'), async (req, res) => {
  const dryRun = req.body?.dryRun !== false; // opt in to really sending
  const minIntervalDays = Number(req.body?.minIntervalDays) || 30;
  const limit = Math.min(Number(req.body?.limit) || 50, 200);

  if (!supabase) return res.status(503).json({ error: 'Campaign needs a database connection' });

  const cutoff = new Date(Date.now() - minIntervalDays * 86400000).toISOString();
  const { data: leads, error } = await supabase
    .from('leads')
    .select('phone, name, last_sent_at')
    .eq('consent', true)
    .eq('unsubscribed', false)
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`)
    .limit(limit);

  if (error) {
    console.error('Campaign lead fetch failed:', error.message);
    return res.status(500).json({ error: 'Could not load leads' });
  }

  const { data: existing } = await supabase.from('customers').select('phone');
  const alreadyCustomers = new Set((existing || []).map(c => c.phone));
  const targets = (leads || []).filter(l => !alreadyCustomers.has(l.phone));

  if (dryRun) {
    return res.json({
      dryRun: true,
      wouldSend: targets.length,
      sample: campaignMessage(targets[0]?.name),
      recipients: targets.map(t => t.phone)
    });
  }

  let sent = 0;
  for (const lead of targets) {
    const result = await sendCampaignMessage(lead.phone, campaignMessage(lead.name));
    if (!result.ok) continue;
    sent++;
    await supabase.from('leads').update({
      last_sent_at: new Date().toISOString(),
      send_count: (lead.send_count || 0) + 1
    }).eq('phone', lead.phone);
  }
  res.json({ dryRun: false, attempted: targets.length, sent });
});

// Welcome-offer and delivery economics. Kept adjustable from the admin panel because
// these are the numbers most likely to need tuning once real order volume shows what
// the average basket and the true cost of a pickup actually are.
app.put('/api/settings/pricing', authMiddleware, requireRole('admin'), async (req, res) => {
  const { welcomePercent, welcomeMinOrder, freeDeliveryAbove, deliveryFee, expressMarkup, urgentMarkup, primeEnabled } = req.body;

  const num = (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  // Percentages arrive as whole numbers from the admin form (25, 100) and are stored
  // as fractions.
  const pct = num(welcomePercent, 0, 100);
  const minOrder = num(welcomeMinOrder, 0, 100000);
  const freeAbove = num(freeDeliveryAbove, 0, 100000);
  const fee = num(deliveryFee, 0, 10000);
  const express = num(expressMarkup, 0, 1000);
  const urgent = num(urgentMarkup, 0, 1000);
  if (pct === null || minOrder === null || freeAbove === null || fee === null || express === null || urgent === null) {
    return res.status(400).json({ error: 'Enter a welcome discount of 0-100%, speed markups of 0-1000%, and non-negative amounts for the order and delivery values.' });
  }

  const rules = {
    welcomePercent: pct / 100, welcomeMinOrder: minOrder,
    freeDeliveryAbove: freeAbove, deliveryFee: fee,
    expressMarkup: express / 100, urgentMarkup: urgent / 100,
    primeEnabled: primeEnabled === true
  };
  if (supabase) {
    const result = await upsertSystemSetting('pricing_rules', JSON.stringify(rules));
    if (!result.ok) {
      console.error('Pricing rules save failed:', result.error?.message);
      return res.status(500).json({ error: 'Could not save pricing rules. Please try again.' });
    }
  }
  res.json({ success: true, rules });
});

app.put('/api/settings/flash-offers', authMiddleware, requireRole('admin'), async (req, res) => {
  const offers = req.body;
  if (!Array.isArray(offers)) return res.status(400).json({ error: 'Body must be an array of offers' });
  if (supabase) {
    const result = await upsertSystemSetting('flash_offers', JSON.stringify(offers));
    if (!result.ok) {
      console.error('Flash offers save failed:', result.error?.message);
      return res.status(500).json({ error: 'Could not save flash offers. Please try again.' });
    }
  }
  res.json({ success: true });
});

app.put('/api/settings/festive-offer', authMiddleware, requireRole('admin'), async (req, res) => {
  const offer = req.body;
  if (supabase) {
    const result = await upsertSystemSetting('festive_offer', JSON.stringify(offer));
    if (!result.ok) {
      console.error('Festive offer save failed:', result.error?.message);
      return res.status(500).json({ error: 'Could not save the festive offer. Please try again.' });
    }
  }
  res.json({ success: true });
});

// 3. Get all orders (Admin / Rider dashboards only — this used to be public)
app.get('/api/orders', authMiddleware, requireRole('admin', 'rider'), async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapOrderToFrontend));
    if (error) console.error('Order list fetch failed:', error.message);
  }
  res.json([]);
});

// 3.5 A customer's own orders only
app.get('/api/orders/mine', authMiddleware, requireRole('customer'), async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').eq('customer_phone', req.user.phone).order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapOrderToFrontend));
    if (error) console.error('Customer order list fetch failed:', error.message);
  }
  res.json([]);
});

// Writes the order row and fires the customer/owner alerts. Shared by the normal
// checkout route and the Cashfree webhook, so an order created from a webhook is
// identical to one created by the app — same columns, same notifications.
async function persistOrder(newOrder, customerPhone, quote, paymentStatus) {
  if (supabase) {
    const orderData = {
      id: newOrder.id,
      customer_phone: customerPhone,
      customer_name: newOrder.customerName,
      apartment_no: newOrder.apartmentNo,
      address: newOrder.address,
      status: newOrder.status || 'Placed',
      payment_status: paymentStatus,
      payment_method: newOrder.paymentMethod || 'Cash',
      pickup_date: newOrder.pickupDate,
      pickup_time: newOrder.pickupTime,
      subtotal: quote.subtotal,
      total: quote.total,
      items: quote.items,
      special_instructions: newOrder.specialInstructions,
      cancel_reason: null,
      delivery_timeline: []
    };
    const { error: insertError } = await supabase.from('orders').insert([orderData]);
    if (insertError) {
      // Never tell the customer "order placed" when it wasn't actually saved —
      // this previously happened silently whenever the total had a fractional
      // amount (which 5% GST produces almost every time).
      console.error('Order insert failed:', insertError.message);
      return { error: 'We could not save your order. Please try again — you have not been charged.' };
    }
  }

  // Burn the campaign credit only now the row is safely written. Decrementing earlier
  // would silently eat one of the customer's two free orders on a failed insert.
  if (quote.redeemingCredit && supabase) {
    const { data: cust } = await supabase.from('customers').select('free_order_credits').eq('phone', customerPhone).single();
    const remaining = Math.max(0, (cust?.free_order_credits || 0) - 1);
    const { error: creditError } = await supabase.from('customers').update({ free_order_credits: remaining }).eq('phone', customerPhone);
    if (creditError) console.error('Free-order credit decrement failed:', creditError.message);
  }

  waitUntil(sendNotification('whatsapp', customerPhone, `Hi ${newOrder.customerName}, your PressGo order ${newOrder.id} of ₹${quote.total} was placed! Pickup scheduled for ${newOrder.pickupDate} (${newOrder.pickupTime}).`));
  waitUntil(sendNotification('sms', OWNER_ALERT_PHONE, `Owner Alert: New order ${newOrder.id} received from ${newOrder.customerName} (${newOrder.apartmentNo}).`));
  waitUntil(sendPushNotification(customerPhone, 'Order placed', `Your order ${newOrder.id} of ₹${quote.total} was placed. Pickup on ${newOrder.pickupDate} (${newOrder.pickupTime}).`, { orderId: newOrder.id, status: 'Placed' }));

  return {
    order: {
      ...newOrder,
      customerPhone,
      paymentStatus,
      subtotal: quote.subtotal,
      total: quote.total,
      items: quote.items,
      couponApplied: quote.couponApplied
    }
  };
}

// 4. Create new order (Customer checkout, or Admin/Rider walk-in booking)
app.post('/api/orders', authMiddleware, requireRole('customer', 'admin', 'rider'), async (req, res) => {
  const newOrder = req.body;
  if (!newOrder.id || !Array.isArray(newOrder.cartItems)) {
    return res.status(400).json({ error: 'Invalid order structure' });
  }

  const customerPhone = req.user.role === 'customer' ? req.user.phone : newOrder.customerPhone;
  if (!customerPhone) return res.status(400).json({ error: 'customerPhone is required' });

  // The only numbers we trust are our own — recomputed from the price catalog and the
  // customer's real subscription tier, never whatever the client says the cart adds up to.
  const quote = await computeQuote({ cartItems: newOrder.cartItems, couponCode: newOrder.couponCode, customerPhone, speed: newOrder.speed });
  if (quote.items.length === 0) return res.status(400).json({ error: 'No valid items in cart' });

  let paymentStatus = 'Pending';
  if (newOrder.paymentMethod === 'COD') {
    paymentStatus = 'Pending';
  } else if (newOrder.paymentMethod === 'Wallet') {
    if (!supabase) return res.status(503).json({ error: 'Wallet payments require a database connection' });
    const { data: custData, error: balanceError } = await supabase.from('customers').select('wallet_balance').eq('phone', customerPhone).single();
    if (balanceError) {
      console.error('Wallet balance lookup failed:', balanceError.message);
      return res.status(503).json({ error: 'Could not check your wallet balance. Please try again.' });
    }
    const balance = custData?.wallet_balance || 0;
    if (balance < quote.total) return res.status(400).json({ error: 'Insufficient wallet balance' });
    // Marking the order Paid must never happen unless the debit itself is confirmed —
    // otherwise a transient failure here would have delivered a paid order for free.
    const { error: debitError } = await supabase.from('customers').update({ wallet_balance: balance - quote.total }).eq('phone', customerPhone);
    if (debitError) {
      console.error('Wallet debit failed:', debitError.message);
      return res.status(500).json({ error: 'Could not charge your wallet. Please try again.' });
    }
    await logWalletTransaction(customerPhone, 'debit', quote.total, `Order ${newOrder.id}`);
    paymentStatus = 'Paid';
  } else {
    const { cashfreeOrderId } = newOrder;
    if (cashfreeConfigured) {
      // Live gateway configured: only trust "Paid" if Cashfree itself confirms this
      // exact order was fully paid, and for the amount our own quote says it costs.
      const confirmedAmount = await fetchConfirmedCashfreeAmount(cashfreeOrderId);
      paymentStatus = (confirmedAmount !== null && Math.abs(confirmedAmount - quote.total) < 0.01) ? 'Paid' : 'Pending';
    } else {
      // No live gateway configured — we're in demo mode, nothing real to verify.
      paymentStatus = 'Paid';
    }
  }

  // Gateway-paid orders race the Cashfree webhook, which can create the same order
  // from its own copy of the draft. The pending_orders row is the claim token: delete
  // it and we own the creation. If it's already gone the webhook may have beaten us,
  // so look for the order it would have written and hand that back instead of writing
  // a second one. A miss on both means the draft was never stored (its save is
  // non-fatal), and creating normally is correct.
  if (supabase && newOrder.cashfreeOrderId) {
    const { data: claimed } = await supabase
      .from('pending_orders')
      .delete()
      .eq('gateway_order_id', newOrder.cashfreeOrderId)
      .select();
    if (!claimed || claimed.length === 0) {
      const { data: existing } = await supabase
        .from('orders')
        .select('*')
        .ilike('payment_method', `%${newOrder.cashfreeOrderId}%`)
        .limit(1);
      if (existing && existing.length > 0) return res.status(200).json(mapOrderToFrontend(existing[0]));
    }
  }

  const saved = await persistOrder(newOrder, customerPhone, quote, paymentStatus);
  if (saved.error) return res.status(500).json({ error: saved.error });

  res.status(201).json(saved.order);
});

// 5. Update order status (Admin/Rider control; a customer may only cancel their own order)
app.patch('/api/orders/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, cancelReason, paymentStatus } = req.body;

  if (!supabase) return res.json({ id, status, cancelReason, paymentStatus });

  const { data: existingRows, error: existingError } = await supabase.from('orders').select('*').eq('id', id);
  if (existingError) console.error('Order lookup failed:', existingError.message);
  const existing = existingRows && existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const isStaff = req.user.role === 'admin' || req.user.role === 'rider';
  const isOwnerCancelling = req.user.role === 'customer' && req.user.phone === existing.customer_phone && status === 'Cancelled';
  if (!isStaff && !isOwnerCancelling) return res.status(403).json({ error: 'Forbidden' });

  const updatePayload = { status };
  if (cancelReason) updatePayload.cancel_reason = cancelReason;
  if (paymentStatus) {
    if (isStaff) {
      updatePayload.payment_status = paymentStatus;
    } else if (isOwnerCancelling && paymentStatus === 'Cancelled') {
      // A customer cancelling their own order may mark the payment Cancelled too
      // (never Paid — that stays staff-only) so an unpaid cancelled order doesn't
      // sit showing "Pending" forever.
      updatePayload.payment_status = 'Cancelled';
    }
  }

  const { data, error } = await supabase.from('orders').update(updatePayload).eq('id', id).select();
  if (!error && data && data.length > 0) {
    const order = mapOrderToFrontend(data[0]);
    if (status === 'Cancelled') {
      waitUntil(sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your PressGo order ${order.id} has been Cancelled. Reason: ${cancelReason}`));
      waitUntil(sendPushNotification(order.customerPhone, 'Order cancelled', `Order ${order.id} was cancelled. Reason: ${cancelReason}`, { orderId: order.id, status: 'Cancelled' }));
    } else {
      waitUntil(sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your PressGo order ${order.id} status is now: [${status}].`));
      waitUntil(sendPushNotification(order.customerPhone, 'Order update', `Order ${order.id} is now: ${status}.`, { orderId: order.id, status }));

      // Referral Reward Logic
      if (status === 'Delivered') {
        try {
          const { count, error: countError } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('customer_phone', order.customerPhone).eq('status', 'Delivered');
          if (!countError && count === 1) {
            const { data: cData } = await supabase.from('customers').select('referred_by, wallet_balance').eq('phone', order.customerPhone).single();
            if (cData && cData.referred_by) {
              // Reward new customer — Supabase errors don't throw, so the outer
              // try/catch alone can't see them; check explicitly and skip the
              // "you got ₹50" message if the credit didn't actually happen.
              const { error: creditError } = await supabase.from('customers').update({ wallet_balance: (cData.wallet_balance || 0) + 50 }).eq('phone', order.customerPhone);
              if (creditError) {
                console.error('Referral credit (new customer) failed:', creditError.message);
              } else {
                await logWalletTransaction(order.customerPhone, 'credit', 50, 'Referral reward — your first order');
                waitUntil(sendNotification('whatsapp', order.customerPhone, `🎉 Congratulations! ₹50 has been added to your PressGo wallet for completing your first referred order!`));
              }

              // Reward referrer
              const { data: refData } = await supabase.from('customers').select('wallet_balance, phone').eq('referral_code', cData.referred_by).single();
              if (refData) {
                const { error: referrerCreditError } = await supabase.from('customers').update({ wallet_balance: (refData.wallet_balance || 0) + 50 }).eq('phone', refData.phone);
                if (referrerCreditError) {
                  console.error('Referral credit (referrer) failed:', referrerCreditError.message);
                } else {
                  await logWalletTransaction(refData.phone, 'credit', 50, `Referral reward — ${order.customerName} completed their first order`);
                  waitUntil(sendNotification('whatsapp', refData.phone, `🎉 Great news! Your friend ${order.customerName} completed their first order. ₹50 has been added to your wallet!`));
                }
              }
            }
          }
        } catch (err) {
          console.error("Referral logic error", err);
        }
      }
    }
    return res.json(order);
  }
  console.error('Order status update failed:', error?.message || 'no matching order row');
  res.status(500).json({ error: 'Could not update the order. Please try again.' });
});

// 5.5 Update order schedule (staff, or the order's own customer)
app.patch('/api/orders/:id/reschedule', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { pickupDate, pickupTime } = req.body;

  if (!supabase) return res.json({ id, pickupDate, pickupTime });

  const { data: existingRows, error: existingError } = await supabase.from('orders').select('*').eq('id', id);
  if (existingError) console.error('Order lookup failed:', existingError.message);
  const existing = existingRows && existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const isStaff = req.user.role === 'admin' || req.user.role === 'rider';
  const isOwner = req.user.role === 'customer' && req.user.phone === existing.customer_phone;
  if (!isStaff && !isOwner) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase.from('orders').update({ pickup_date: pickupDate, pickup_time: pickupTime }).eq('id', id).select();
  if (!error && data && data.length > 0) {
    const order = mapOrderToFrontend(data[0]);
    waitUntil(sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your PressGo order ${order.id} has been RESCHEDULED to ${pickupDate} (${pickupTime}).`));
    waitUntil(sendPushNotification(order.customerPhone, 'Pickup rescheduled', `Order ${order.id} pickup moved to ${pickupDate} (${pickupTime}).`, { orderId: order.id, status: 'Rescheduled' }));
    return res.json(order);
  }
  console.error('Order reschedule failed:', error?.message || 'no matching order row');
  res.status(500).json({ error: 'Could not reschedule the order. Please try again.' });
});

// 6. Update payment status (Admin/Rider control only — e.g. marking a COD order paid on delivery)
app.patch('/api/orders/:id/payment', authMiddleware, requireRole('admin', 'rider'), async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (supabase) {
    const { data, error } = await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', id).select();
    if (!error && data && data.length > 0) {
      const order = mapOrderToFrontend(data[0]);
      waitUntil(sendNotification('sms', order.customerPhone, `PressGo: Payment of ₹${order.total} for order ${order.id} is confirmed [Paid].`));
      waitUntil(sendPushNotification(order.customerPhone, 'Payment confirmed', `Payment of ₹${order.total} for order ${order.id} is confirmed.`, { orderId: order.id, status: 'Paid' }));
      return res.json(order);
    }
    console.error('Order payment status update failed:', error?.message || 'no matching order row');
    return res.status(500).json({ error: 'Could not update the payment status. Please try again.' });
  }
  res.json({ id, paymentStatus });
});

// 6.5 Delete an order record (Admin only)
app.delete('/api/orders/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      console.error('Order delete failed:', error.message);
      return res.status(500).json({ error: 'Could not delete the order. Please try again.' });
    }
  }
  res.json({ success: true });
});

// 7. Get customers list (Admin only — this used to be public)
app.get('/api/customers', authMiddleware, requireRole('admin'), async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapCustomerToFrontend));
    if (error) console.error('Customer list fetch failed:', error.message);
  }
  res.json(DEFAULT_CUSTOMERS);
});

// 7.5 Get individual customer by phone (that customer themselves, or staff)
app.get('/api/customers/:phone', authMiddleware, async (req, res) => {
  const { phone } = req.params;
  const isSelf = req.user.role === 'customer' && req.user.phone === phone;
  const isStaff = req.user.role === 'admin' || req.user.role === 'rider';
  if (!isSelf && !isStaff) return res.status(403).json({ error: 'Forbidden' });

  if (supabase) {
    const { data, error } = await supabase.from('customers').select('*').eq('phone', phone);
    if (!error && data && data.length > 0) {
      return res.json(mapCustomerToFrontend(data[0]));
    }
    return res.status(404).json({ error: 'Customer not found' });
  }
  const existing = DEFAULT_CUSTOMERS.find(c => c.phone === phone);
  if (existing) return res.json(existing);
  res.status(404).json({ error: 'Customer not found' });
});

// 7.6 Register/update this customer's FCM device token for push notifications.
// Phone comes from the session, never the body — a customer can only ever set the
// token for their own account.
app.post('/api/customers/fcm-token', authMiddleware, requireRole('customer'), async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token is required' });

  if (!supabase) return res.json({ success: true });

  const { error } = await supabase.from('customers').update({ fcm_token: token }).eq('phone', req.user.phone);
  if (error) {
    console.error(`FCM token save failed for ${req.user.phone}:`, error.message);
    return res.status(500).json({ error: 'Could not save device token' });
  }
  res.json({ success: true });
});

// 8. Register customer — requires a phone verified via OTP moments ago; the phone
// comes from that token, never from the request body, so nobody can register (or
// silently overwrite) a profile for a number they don't control.
app.post('/api/customers', authMiddleware, requireRole('customer'), async (req, res) => {
  const phone = req.user.phone;
  const newCustomer = req.body;
  if (!newCustomer.name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (supabase) {
    const { data: existing, error: lookupError } = await supabase.from('customers').select('*').eq('phone', phone);
    if (lookupError) {
      console.error('Customer lookup failed during registration:', lookupError.message);
      return res.status(503).json({ error: 'Could not check your account right now. Please try again.' });
    }
    if (existing && existing.length > 0) {
      return res.json(mapCustomerToFrontend(existing[0]));
    }

    const referralCode = `PRESSGO-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const customerData = {
      phone,
      name: newCustomer.name,
      wallet_balance: 0,
      subscription_quota: 0,
      active_plan: 'None',
      apartment_no: newCustomer.apartmentNo || '',
      address: newCustomer.address || '',
      addresses: newCustomer.addresses || [],
      referral_code: referralCode,
      referred_by: newCustomer.referredBy || null
    };
    const { data: inserted, error: insertError } = await supabase.from('customers').insert([customerData]).select();
    if (insertError) {
      // Never fabricate a success response here — that was the exact bug that made
      // registration look like it worked while nothing was actually saved, so the
      // customer's real profile silently never existed on their next login.
      console.error('Customer insert failed during registration:', insertError.message);
      return res.status(500).json({ error: 'We could not create your profile. Please try again.' });
    }
    waitUntil(sendNotification('sms', phone, `Welcome to PressGo, ${newCustomer.name}! Your pickup profile has been created successfully.`));
    return res.status(201).json(mapCustomerToFrontend(inserted[0]));
  }

  const existingIndex = DEFAULT_CUSTOMERS.findIndex(c => c.phone === phone);
  if (existingIndex === -1) {
    DEFAULT_CUSTOMERS.push({
      phone,
      name: newCustomer.name,
      walletBalance: 0,
      subscriptionQuota: 0,
      activePlan: 'None',
      apartmentNo: newCustomer.apartmentNo || '',
      address: newCustomer.address || '',
      addresses: newCustomer.addresses || [],
      referralCode: `PRESSGO-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      referredBy: newCustomer.referredBy || null
    });
  }
  waitUntil(sendNotification('sms', phone, `Welcome to PressGo, ${newCustomer.name}! Your pickup profile has been created successfully.`));
  res.status(201).json({ ...newCustomer, phone });
});

// Update customer profile (self or admin). A plain customer token can edit their own
// name/address/addresses, but not wallet balance, subscription quota, or plan — those
// only change through payment-verified or staff-only routes below.
app.put('/api/customers/:phone', authMiddleware, async (req, res) => {
  const { phone } = req.params;
  const isSelf = req.user.role === 'customer' && req.user.phone === phone;
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const updates = { ...req.body };
  if (!isAdmin) {
    delete updates.walletBalance;
    delete updates.subscriptionQuota;
    delete updates.activePlan;
  }

  if (supabase) {
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.walletBalance !== undefined) dbUpdates.wallet_balance = updates.walletBalance;
    if (updates.subscriptionQuota !== undefined) dbUpdates.subscription_quota = updates.subscriptionQuota;
    if (updates.activePlan !== undefined) dbUpdates.active_plan = updates.activePlan;
    if (updates.apartmentNo !== undefined) dbUpdates.apartment_no = updates.apartmentNo;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.addresses !== undefined) dbUpdates.addresses = updates.addresses;

    const { data, error } = await supabase.from('customers').update(dbUpdates).eq('phone', phone).select();
    if (!error && data && data.length > 0) {
      return res.json(mapCustomerToFrontend(data[0]));
    }
    console.error('Customer profile update failed:', error?.message || 'no matching customer row');
    return res.status(500).json({ error: 'Could not save your changes. Please try again.' });
  } else {
    const existingIndex = DEFAULT_CUSTOMERS.findIndex(c => c.phone === phone);
    if (existingIndex !== -1) {
      DEFAULT_CUSTOMERS[existingIndex] = { ...DEFAULT_CUSTOMERS[existingIndex], ...updates };
      return res.json(DEFAULT_CUSTOMERS[existingIndex]);
    }
  }
  res.json({ phone, ...updates });
});

// Delete account (self or admin) — replaces the old direct-from-browser Supabase delete.
app.delete('/api/customers/:phone', authMiddleware, async (req, res) => {
  const { phone } = req.params;
  const isSelf = req.user.role === 'customer' && req.user.phone === phone;
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  if (supabase) {
    const { error } = await supabase.from('customers').delete().eq('phone', phone);
    if (error) {
      // A customer asking to delete their account must never be told it worked
      // when it didn't - that's a real data-protection compliance concern, not
      // just a UX bug.
      console.error('Customer delete failed:', error.message);
      return res.status(500).json({ error: 'Could not delete your account. Please try again.' });
    }
  }
  res.json({ success: true });
});

// 9. Payment order creation simulation / Live Cashfree Order session
app.post('/api/payments/create-order', authMiddleware, async (req, res) => {
  const { cartItems, couponCode, planName, currency, paymentMethods, speed, orderDraft } = req.body;
  let amount;
  let quote = null;

  if (Array.isArray(cartItems)) {
    // Booking checkout: the total is whatever our own catalog + the customer's real
    // subscription tier say it is — never what the client computed.
    quote = await computeQuote({
      cartItems,
      couponCode,
      customerPhone: req.user.role === 'customer' ? req.user.phone : undefined,
      speed
    });
    amount = quote.total;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Cart is empty or invalid' });
  } else if (planName) {
    // Prime subscription purchase: amount is the plan's real listed price, not
    // whatever the client says it should be.
    amount = PLAN_PRICES[planName];
    if (!amount) return res.status(400).json({ error: 'Unknown plan' });
  } else {
    // Wallet top-up: there's no "correct" amount to check against — it's the
    // customer's own discretionary top-up choice.
    const { amount: requestedAmount } = req.body;
    if (!requestedAmount || requestedAmount <= 0) return res.status(400).json({ error: 'Amount is required' });
    amount = requestedAmount;
  }

  // The caller can optionally narrow which methods Cashfree's checkout page shows
  // (e.g. wallet top-up only wants NetBanking/Card) — only when it already knows the
  // restriction ahead of time. Validated against Cashfree's known codes since this
  // string flows straight into the request we send them.
  const CASHFREE_VALID_METHOD_CODES = new Set(['cc', 'dc', 'nb', 'upi', 'app', 'paylater', 'emi', 'cardlessemi']);
  const safePaymentMethods = typeof paymentMethods === 'string' && paymentMethods
    .split(',')
    .every(code => CASHFREE_VALID_METHOD_CODES.has(code.trim()))
    ? paymentMethods
    : null;

  if (cashfreeConfigured) {
    try {
      const gatewayOrderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const customerPhone = /^\d{10}$/.test(req.user.phone || '') ? req.user.phone : '9999999999';
      const cfRes = await fetch(`${CASHFREE_BASE_URL}/orders`, {
        method: 'POST',
        headers: cashfreeHeaders(),
        body: JSON.stringify({
          order_id: gatewayOrderId,
          order_amount: amount,
          order_currency: currency || 'INR',
          customer_details: {
            customer_id: customerPhone,
            customer_phone: customerPhone
          },
          order_meta: {
            ...(safePaymentMethods ? { payment_methods: safePaymentMethods } : {}),
            // The native app's WebView origin is "https://localhost" — a domain that
            // can never be whitelisted with Cashfree since it isn't a real, reachable
            // website. A custom URL scheme (com.vastracare.app://...) isn't accepted
            // either — Cashfree's Orders API rejects it outright as an invalid
            // return_url before whitelisting even comes into play. So native uses a
            // real, already-whitelisted https URL on an /payment-return path that's
            // configured as a verified Android App Link (see the intent-filter in
            // AndroidManifest.xml + public/.well-known/assetlinks.json) — Android
            // intercepts it and routes straight back into the app instead of a
            // browser, same end result as a custom scheme without Cashfree rejecting it.
            return_url: req.headers.origin === 'https://localhost'
              ? 'https://pressgo.co.in/payment-return?cf_order_id={order_id}'
              : `${req.headers.origin || 'https://pressgo.co.in'}/?cf_order_id={order_id}`
          }
        })
      });
      const cfData = await cfRes.json();
      if (!cfRes.ok || !cfData.payment_session_id) {
        console.error('Cashfree order creation failed:', cfData);
        return res.status(500).json({ error: 'Cashfree order creation failed: ' + (cfData.message || 'Unknown error') });
      }
      console.log(`🏦 Live Cashfree Order Registered: ${gatewayOrderId} for ₹${amount}`);

      // Stash the order the customer is about to pay for, so the webhook can still
      // create it if their device never makes it back — closed tab, dead battery, lost
      // connection. Without this the money is taken and no order exists anywhere.
      // Only for cart checkouts; wallet top-ups and plan purchases have no order draft.
      if (supabase && orderDraft && Array.isArray(orderDraft.cartItems)) {
        const { error: draftError } = await supabase.from('pending_orders').upsert([{
          gateway_order_id: gatewayOrderId,
          customer_phone: req.user.phone,
          // Mirror exactly what the app would have POSTed, including the "(Txn: …)"
          // suffix — that string is how an order is later traced back to its gateway
          // payment, and the duplicate check in POST /orders matches on it.
          draft: {
            ...orderDraft,
            cashfreeOrderId: gatewayOrderId,
            paymentMethod: `${orderDraft.paymentMethod} (Txn: ${gatewayOrderId})`
          }
        }]);
        // Non-fatal: the customer can still pay and the normal return path still works.
        // It only costs us the safety net, so log loudly rather than blocking checkout.
        if (draftError) console.error('Pending order draft save failed:', draftError.message);
      }

      return res.json({
        gatewayOrderId,
        paymentSessionId: cfData.payment_session_id,
        amount,
        currency: currency || 'INR',
        liveMode: true,
        cashfreeEnv: CASHFREE_ENV,
        quote
      });
    } catch (err) {
      console.error('Cashfree API error:', err);
      return res.status(500).json({ error: 'Cashfree order creation failed: ' + err.message });
    }
  }

  // Simulated fallback transaction
  const gatewayOrder = {
    gatewayOrderId: `demo_order_${Math.random().toString(36).substring(2, 11)}`,
    amount: amount,
    currency: currency || 'INR',
    status: 'created',
    createdAt: Date.now(),
    liveMode: false,
    quote
  };

  console.log(`🏦 Payment Gateway Order Initialized (Demo Mode): ${gatewayOrder.gatewayOrderId} for ₹${amount}`);
  res.json(gatewayOrder);
});

// 9b. Cashfree's checkout page (https://api.cashfree.com/pg/view/sessions/checkout) is
// loaded via a POST with the session id in the form body, not a GET with it in the URL
// — the cashfree-js SDK does this itself normally, but that SDK call happens inside the
// native app's WebView, whose "https://localhost" origin as the referrer can never be
// whitelisted with Cashfree (unlike a real domain, it can't be registered as a website).
// This tiny auto-submitting form page is loaded instead, in a genuine external browser
// tab (see Browser.open in App.tsx) from this already-whitelisted domain, so Cashfree
// sees a real, approved referrer when the POST lands.
app.get('/api/payments/cashfree-redirect', (req, res) => {
  const sessionId = req.query.session_id;
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(sessionId)) {
    return res.status(400).send('Invalid session id');
  }
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><body>
<form id="cf" method="POST" action="https://api.cashfree.com/pg/view/sessions/checkout">
  <input type="hidden" name="payment_session_id" value="${sessionId}" />
</form>
<script>document.getElementById('cf').submit();</script>
</body></html>`);
});

// Cashfree calls this the moment a payment settles, independently of the customer's
// device. It's the only path that survives them closing the tab, losing signal or
// running out of battery between paying and getting back to the app.
//
// The pending_orders row doubles as a single-use claim: whoever deletes it first is
// the one that creates the order. Supabase returns the deleted rows, so an empty
// result means the app's own return path already handled it and this webhook is a
// no-op. That's what stops a duplicate order when both paths fire, which is the
// normal case rather than the exception.
app.post('/api/payments/webhook', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (!cashfreeConfigured || !signature || !timestamp || !req.rawBody) {
    return res.status(400).json({ error: 'Bad webhook request' });
  }

  // Cashfree signs timestamp + raw body with the secret key.
  const expected = crypto
    .createHmac('sha256', CASHFREE_SECRET_KEY)
    .update(timestamp + req.rawBody.toString('utf8'))
    .digest('base64');

  const given = Buffer.from(String(signature));
  const mine = Buffer.from(expected);
  if (given.length !== mine.length || !crypto.timingSafeEqual(given, mine)) {
    console.error('Cashfree webhook signature mismatch — ignoring');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Always 200 past this point: a non-2xx makes Cashfree retry, and every failure
  // below is either "nothing to do" or something a retry cannot fix.
  const type = req.body?.type;
  const cfOrderId = req.body?.data?.order?.order_id;
  if (type !== 'PAYMENT_SUCCESS_WEBHOOK' || !cfOrderId) return res.json({ received: true });
  if (!supabase) return res.json({ received: true });

  const { data: claimed, error: claimError } = await supabase
    .from('pending_orders')
    .delete()
    .eq('gateway_order_id', cfOrderId)
    .select();

  if (claimError) {
    console.error('Pending order claim failed:', claimError.message);
    return res.json({ received: true });
  }
  if (!claimed || claimed.length === 0) return res.json({ received: true }); // already handled

  const { draft, customer_phone: customerPhone } = claimed[0];

  // Same independent verification the checkout route does — the signature proves
  // Cashfree sent this, but the amount still has to match our own quote.
  const quote = await computeQuote({ cartItems: draft.cartItems, couponCode: draft.couponCode, customerPhone, speed: draft.speed });
  const confirmedAmount = await fetchConfirmedCashfreeAmount(cfOrderId);
  const paid = confirmedAmount !== null && Math.abs(confirmedAmount - quote.total) < 0.01;

  const saved = await persistOrder(draft, customerPhone, quote, paid ? 'Paid' : 'Pending');
  if (saved.error) {
    // Put it back so a Cashfree retry can try again rather than losing the order.
    await supabase.from('pending_orders').upsert([claimed[0]]);
    console.error('Webhook order creation failed:', saved.error);
    return res.status(500).json({ error: 'Could not save order' });
  }

  console.log(`🔔 Order ${draft.id} created from Cashfree webhook (${cfOrderId})`);
  res.json({ received: true });
});

// Was a given gateway order actually paid? The native app needs this when it comes
// back to the foreground without Cashfree's return_url having fired — i.e. the
// customer backed out of the Chrome Custom Tab, or the redirect was lost. Without it
// the app can't tell "cancelled" from "paid but the redirect never arrived", and it
// would either strand a real payment or claim success for one that never happened.
// Deliberately returns nothing but a boolean: order ids are unguessable, but there's
// no reason to expose amounts to whoever holds one.
app.get('/api/payments/status/:cashfreeOrderId', authMiddleware, requireRole('customer'), async (req, res) => {
  const { cashfreeOrderId } = req.params;
  if (!cashfreeConfigured) return res.json({ paid: false });
  const confirmedAmount = await fetchConfirmedCashfreeAmount(cashfreeOrderId);
  res.json({ paid: confirmedAmount !== null });
});

// 10. Verify a Cashfree payment and credit the customer's wallet server-side.
// Replaces the old flow where the browser just PUT whatever wallet_balance it felt like.
app.post('/api/payments/verify-wallet-topup', authMiddleware, requireRole('customer'), async (req, res) => {
  const { amount, cashfreeOrderId } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  // Credit exactly what Cashfree confirms was paid for this order_id — never the
  // client's bare claim.
  let creditAmount = amount;
  if (cashfreeConfigured) {
    const confirmedAmount = await fetchConfirmedCashfreeAmount(cashfreeOrderId);
    if (confirmedAmount === null) return res.status(400).json({ error: 'Payment verification failed' });
    creditAmount = confirmedAmount;
  }

  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  const { data: custData, error: lookupError } = await supabase.from('customers').select('wallet_balance').eq('phone', req.user.phone).single();
  if (lookupError) console.error('Wallet top-up balance lookup failed:', lookupError.message);
  const newBalance = (custData?.wallet_balance || 0) + creditAmount;
  const { data: updated, error: updateError } = await supabase.from('customers').update({ wallet_balance: newBalance }).eq('phone', req.user.phone).select();
  if (updated && updated[0]) {
    await logWalletTransaction(req.user.phone, 'credit', creditAmount, 'Wallet top-up');
    return res.json(mapCustomerToFrontend(updated[0]));
  }
  console.error('Wallet top-up credit failed:', updateError?.message || 'no matching customer row');
  res.status(500).json({ error: 'Failed to credit wallet' });
});

// 10.5 A customer's own wallet transaction history
app.get('/api/wallet/transactions', authMiddleware, requireRole('customer'), async (req, res) => {
  if (!supabase) return res.json([]);
  const { data, error } = await supabase.from('wallet_transactions')
    .select('*')
    .eq('customer_phone', req.user.phone)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    // An empty list and a broken table look identical to the customer, which is how a
    // missing wallet_transactions went unnoticed. Still returns [] so the screen
    // renders, but the cause is now recoverable from the logs.
    console.error('Wallet history fetch failed:', error.message);
    return res.json([]);
  }
  res.json(data.map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    description: t.description,
    createdAt: t.created_at
  })));
});

// 11. Activate a Prime subscription plan — only after a verified payment.
app.post('/api/subscriptions/activate', authMiddleware, requireRole('customer'), async (req, res) => {
  const { planName, cashfreeOrderId } = req.body;

  // Prime is withdrawn from sale. The plan cards advertised a flat 35% while the
  // engine gave 15% on light garments — the ones customers actually send — and at a
  // 27.5% base margin no percentage-discount plan can be worth its own monthly fee:
  // Gold saved 3 rupees a garment against a 699 fee, so a customer needed 233
  // garments a month just to break even. Guarded here as well as hidden in the UI, so
  // a stale client or a direct call cannot sell one. Existing holders keep their
  // discount — computeQuote reads active_plan regardless of this flag.
  const pricingRules = await getPricingSettings();
  if (!pricingRules.primeEnabled) {
    return res.status(403).json({ error: 'Prime plans are not available at the moment.' });
  }

  const planPrice = PLAN_PRICES[planName];
  if (!planPrice) return res.status(400).json({ error: 'Unknown plan' });

  if (cashfreeConfigured) {
    const confirmedAmount = await fetchConfirmedCashfreeAmount(cashfreeOrderId);
    if (confirmedAmount === null || Math.abs(confirmedAmount - planPrice) > 0.01) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }
  }

  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  const { data: updated, error: updateError } = await supabase.from('customers').update({ active_plan: planName }).eq('phone', req.user.phone).select();
  if (updated && updated[0]) return res.json(mapCustomerToFrontend(updated[0]));
  console.error('Subscription activation failed:', updateError?.message || 'no matching customer row');
  res.status(500).json({ error: 'Failed to activate plan' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 PressGo Backend API Server is running on http://localhost:${PORT}`);
  });
}

// Export for Vercel Serverless Functions
export default app;
