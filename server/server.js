import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import https from 'https';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

// Initialize Razorpay client only if keys are present in .env
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('✅ Razorpay Live Gateway Client Initialized.');
} else {
  console.log('⚠️ Razorpay keys missing. Operating in simulated Payment Demo Mode.');
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

function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

// The HMAC signature only proves a payment_id genuinely belongs to an order_id —
// it says nothing about the amount. Without this, a client could pay a real ₹1
// order, get a genuinely valid signature for it, and then tell any of our
// "verified" endpoints to treat that as proof of paying ₹10,000. This asks
// Razorpay directly what was actually paid for a given order, which is the only
// number worth trusting.
async function fetchConfirmedPaymentAmount(razorpayOrderId) {
  if (!razorpay || !razorpayOrderId) return null;
  try {
    const order = await razorpay.orders.fetch(razorpayOrderId);
    if (order.status !== 'paid' || order.amount_paid !== order.amount) return null;
    return order.amount / 100;
  } catch (err) {
    console.error('Razorpay order lookup failed:', err.message);
    return null;
  }
}

async function verifiedRazorpayAmount(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return null;
  if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) return null;
  return fetchConfirmedPaymentAmount(razorpayOrderId);
}

// --- Authoritative pricing (never trust a total the client sends) ---
const COUPONS = {
  WELCOME50: { type: 'flat', value: 50 },
  FIRST10: { type: 'percent', value: 0.10 }
};

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
async function computeQuote({ cartItems, couponCode, customerPhone }) {
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

  const markup = 0; // no express/urgent surcharge is implemented yet

  let activePlan = 'None';
  if (customerPhone && supabase) {
    const { data } = await supabase.from('customers').select('active_plan').eq('phone', customerPhone).single();
    activePlan = data?.active_plan || 'None';
  }

  let discount = 0;
  let couponApplied = '';
  if (activePlan !== 'None' && SUBSCRIPTION_DISCOUNTS[activePlan]) {
    for (const it of items) {
      const pct = SUBSCRIPTION_DISCOUNTS[activePlan][it.category] || 0;
      discount += it.price * it.qty * pct;
    }
  } else if (couponCode && COUPONS[couponCode]) {
    const c = COUPONS[couponCode];
    discount = c.type === 'flat' ? c.value : subtotal * c.value;
    couponApplied = couponCode;
  }
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  const taxable = Math.max(0, subtotal - discount + markup);
  const tax = Math.round(taxable * 0.05 * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  return {
    subtotal, discount, markup, tax, total, couponApplied,
    items: items.map(({ name, qty, price }) => ({ name, qty, price }))
  };
}

// --- OTP store (in-memory; fine for a single-instance deployment) ---
const otpStore = new Map(); // phone -> { otp, expiresAt }
const otpRateLimit = new Map(); // phone -> last-sent timestamp

const ADMIN_PIN = process.env.ADMIN_PIN || '9791';
const RIDER_PIN = process.env.RIDER_PIN || '8888';
const OWNER_ALERT_PHONE = process.env.OWNER_ALERT_PHONE || '9791019505';
const PLAN_PRICES = { Bronze: 299, Silver: 499, Gold: 699 };

const DEFAULT_PRICE_LIST = [
  { name: 'Shirt', price: 15, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'T-Shirt', price: 12, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'Pant', price: 15, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'Jeans', price: 18, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'Saree', price: 50, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'Kurta', price: 20, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'Salwar', price: 20, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'Blazer', price: 80, category: 'Outerwear', serviceType: 'Ironing' },
  { name: 'Coat', price: 90, category: 'Outerwear', serviceType: 'Ironing' },
  { name: 'Suit', price: 120, category: 'Outerwear', serviceType: 'Ironing' },
  { name: 'School Uniform', price: 25, category: 'Apparel', serviceType: 'Ironing' },
  { name: 'Bedsheet', price: 30, category: 'Bedding', serviceType: 'Ironing' },
  { name: 'Pillow Cover', price: 10, category: 'Bedding', serviceType: 'Ironing' },
  { name: 'Curtain', price: 60, category: 'Bedding', serviceType: 'Ironing' },
  { name: 'Shirt', price: 50, category: 'Apparel', serviceType: 'Dry Cleaning' },
  { name: 'Pant', price: 50, category: 'Apparel', serviceType: 'Dry Cleaning' },
  { name: 'Suit', price: 250, category: 'Outerwear', serviceType: 'Dry Cleaning' },
  { name: 'Shirt', price: 30, category: 'Apparel', serviceType: 'Laundry' },
  { name: 'Pant', price: 30, category: 'Apparel', serviceType: 'Laundry' },
  { name: 'Bedsheet', price: 60, category: 'Bedding', serviceType: 'Laundry' },
];

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
// Integrated with Fast2SMS for cost-effective Indian mobile SMS OTPs & Alerts
const sendNotification = (type, phone, message) => {
  const timestamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`\n======================================================`);
  console.log(`🔔 [NOTIFICATION SERVICE] - ${timestamp}`);
  console.log(`📱 Channel: ${type.toUpperCase()}`);
  console.log(`📞 Target Phone: +91 ${phone}`);
  console.log(`💬 Message: "${message}"`);
  console.log(`======================================================\n`);

  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey && (type === 'sms' || type === 'otp' || type === 'whatsapp')) {
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
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`✉️ Fast2SMS Live Dispatch Response Status: ${res.statusCode} - ${body}`);
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Fast2SMS Live Transmission Failed: ${e.message}`);
    });

    req.write(postData);
    req.end();
  }
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

async function upsertSystemSetting(itemName, iconValue) {
  const { data: existing } = await supabase.from('prices').select('id').eq('category', 'system').eq('item_name', itemName);
  if (existing && existing.length > 0) {
    await supabase.from('prices').update({ icon: iconValue }).eq('id', existing[0].id);
  } else {
    await supabase.from('prices').insert([{ category: 'system', item_name: itemName, price: 0, icon: iconValue, service_type: 'system' }]);
  }
}

// Best-effort wallet transaction log. Swallows errors so it never breaks the wallet
// operation itself — e.g. if the wallet_transactions table hasn't been created yet
// (see the migration note in server/.env.example), balances still update correctly,
// the history list is just empty until the table exists.
async function logWalletTransaction(phone, type, amount, description) {
  if (!supabase) return;
  try {
    await supabase.from('wallet_transactions').insert([{
      customer_phone: phone,
      type,
      amount,
      description
    }]);
  } catch (err) {
    console.warn('wallet_transactions insert skipped (table may not exist yet):', err.message);
  }
}

// --- AUTH ROUTES ---

// Send OTP: the code is only ever dispatched via the notification channel below,
// never returned in the response — that was the whole point of having an OTP.
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'A valid 10-digit mobile number is required' });
  }

  const lastSent = otpRateLimit.get(phone);
  if (lastSent && Date.now() - lastSent < 30 * 1000) {
    return res.status(429).json({ error: 'Please wait a bit before requesting another OTP' });
  }
  otpRateLimit.set(phone, Date.now());

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  sendNotification('whatsapp', phone, `Your Vastra Care verification OTP code is ${otp}. Valid for 5 minutes.`);
  res.json({ success: true });
});

// Verify OTP -> issues a signed session token scoped to this phone number.
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

  const entry = otpStore.get(phone);
  if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }
  otpStore.delete(phone);

  const token = signToken({ role: 'customer', phone }, 30 * 24 * 60 * 60);

  let customer = null;
  if (supabase) {
    const { data } = await supabase.from('customers').select('*').eq('phone', phone);
    if (data && data.length > 0) customer = mapCustomerToFrontend(data[0]);
  } else {
    customer = DEFAULT_CUSTOMERS.find(c => c.phone === phone) || null;
  }
  res.json({ token, exists: !!customer, customer });
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
    if (!error && data && data.length > 0) return res.json(data);
  }
  res.json(DEFAULT_PRICE_LIST);
});

// 2. Update prices (Admin) — now actually persists to Supabase instead of no-op success
app.put('/api/prices', authMiddleware, requireRole('admin'), async (req, res) => {
  const updatedPrices = req.body;
  if (!Array.isArray(updatedPrices)) {
    return res.status(400).json({ error: 'Body must be an array of prices' });
  }

  if (supabase) {
    await Promise.all(updatedPrices.map(item =>
      supabase.from('prices')
        .update({ price: item.price })
        .eq('item_name', item.name)
        .eq('service_type', item.serviceType)
    ));
  }

  res.json({ message: 'Prices updated successfully', prices: updatedPrices });
});

// 2.5 Admin-only settings that used to be written straight from the browser via the
// Supabase anon key. Moved server-side so a customer token (or no token at all) can't
// touch them.
app.put('/api/settings/upi', authMiddleware, requireRole('admin'), async (req, res) => {
  const { phone, id } = req.body;
  if (!phone || !id) return res.status(400).json({ error: 'phone and id are required' });
  if (supabase) await upsertSystemSetting('upi_details', `${phone}|${id}`);
  res.json({ success: true });
});

app.put('/api/settings/flash-offers', authMiddleware, requireRole('admin'), async (req, res) => {
  const offers = req.body;
  if (!Array.isArray(offers)) return res.status(400).json({ error: 'Body must be an array of offers' });
  if (supabase) await upsertSystemSetting('flash_offers', JSON.stringify(offers));
  res.json({ success: true });
});

app.put('/api/settings/festive-offer', authMiddleware, requireRole('admin'), async (req, res) => {
  const offer = req.body;
  if (supabase) await upsertSystemSetting('festive_offer', JSON.stringify(offer));
  res.json({ success: true });
});

// 3. Get all orders (Admin / Rider dashboards only — this used to be public)
app.get('/api/orders', authMiddleware, requireRole('admin', 'rider'), async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapOrderToFrontend));
  }
  res.json([]);
});

// 3.5 A customer's own orders only
app.get('/api/orders/mine', authMiddleware, requireRole('customer'), async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').eq('customer_phone', req.user.phone).order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapOrderToFrontend));
  }
  res.json([]);
});

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
  const quote = await computeQuote({ cartItems: newOrder.cartItems, couponCode: newOrder.couponCode, customerPhone });
  if (quote.items.length === 0) return res.status(400).json({ error: 'No valid items in cart' });

  let paymentStatus = 'Pending';
  if (newOrder.paymentMethod === 'COD') {
    paymentStatus = 'Pending';
  } else if (newOrder.paymentMethod === 'Wallet') {
    if (!supabase) return res.status(503).json({ error: 'Wallet payments require a database connection' });
    const { data: custData } = await supabase.from('customers').select('wallet_balance').eq('phone', customerPhone).single();
    const balance = custData?.wallet_balance || 0;
    if (balance < quote.total) return res.status(400).json({ error: 'Insufficient wallet balance' });
    await supabase.from('customers').update({ wallet_balance: balance - quote.total }).eq('phone', customerPhone);
    await logWalletTransaction(customerPhone, 'debit', quote.total, `Order ${newOrder.id}`);
    paymentStatus = 'Paid';
  } else {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = newOrder;
    if (razorpay) {
      // Live gateway configured: only trust "Paid" if Razorpay itself confirms this
      // exact order was fully paid, and for the amount our own quote says it costs.
      const confirmedAmount = await verifiedRazorpayAmount(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      paymentStatus = (confirmedAmount !== null && Math.abs(confirmedAmount - quote.total) < 0.01) ? 'Paid' : 'Pending';
    } else {
      // No live gateway configured — we're in demo mode, nothing real to verify.
      paymentStatus = 'Paid';
    }
  }

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
      return res.status(500).json({ error: 'We could not save your order. Please try again — you have not been charged.' });
    }
  }

  const responseOrder = {
    ...newOrder,
    customerPhone,
    paymentStatus,
    subtotal: quote.subtotal,
    total: quote.total,
    items: quote.items,
    couponApplied: quote.couponApplied
  };

  // Dispatch alerts
  sendNotification('whatsapp', customerPhone, `Hi ${newOrder.customerName}, your Vastra Care order ${newOrder.id} of ₹${quote.total} was placed! Pickup scheduled for ${newOrder.pickupDate} (${newOrder.pickupTime}).`);
  sendNotification('sms', OWNER_ALERT_PHONE, `Owner Alert: New order ${newOrder.id} received from ${newOrder.customerName} (${newOrder.apartmentNo}).`);

  res.status(201).json(responseOrder);
});

// 5. Update order status (Admin/Rider control; a customer may only cancel their own order)
app.patch('/api/orders/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, cancelReason, paymentStatus } = req.body;

  if (!supabase) return res.json({ id, status, cancelReason, paymentStatus });

  const { data: existingRows } = await supabase.from('orders').select('*').eq('id', id);
  const existing = existingRows && existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const isStaff = req.user.role === 'admin' || req.user.role === 'rider';
  const isOwnerCancelling = req.user.role === 'customer' && req.user.phone === existing.customer_phone && status === 'Cancelled';
  if (!isStaff && !isOwnerCancelling) return res.status(403).json({ error: 'Forbidden' });

  const updatePayload = { status };
  if (cancelReason) updatePayload.cancel_reason = cancelReason;
  if (paymentStatus && isStaff) updatePayload.payment_status = paymentStatus;

  const { data, error } = await supabase.from('orders').update(updatePayload).eq('id', id).select();
  if (!error && data && data.length > 0) {
    const order = mapOrderToFrontend(data[0]);
    if (status === 'Cancelled') {
      sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your Vastra Care order ${order.id} has been Cancelled. Reason: ${cancelReason}`);
    } else {
      sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your Vastra Care order ${order.id} status is now: [${status}].`);

      // Referral Reward Logic
      if (status === 'Delivered') {
        try {
          const { count, error: countError } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('customer_phone', order.customerPhone).eq('status', 'Delivered');
          if (!countError && count === 1) {
            const { data: cData } = await supabase.from('customers').select('referred_by, wallet_balance').eq('phone', order.customerPhone).single();
            if (cData && cData.referred_by) {
              // Reward new customer
              await supabase.from('customers').update({ wallet_balance: (cData.wallet_balance || 0) + 50 }).eq('phone', order.customerPhone);
              await logWalletTransaction(order.customerPhone, 'credit', 50, 'Referral reward — your first order');
              sendNotification('whatsapp', order.customerPhone, `🎉 Congratulations! ₹50 has been added to your Vastra Care wallet for completing your first referred order!`);

              // Reward referrer
              const { data: refData } = await supabase.from('customers').select('wallet_balance, phone').eq('referral_code', cData.referred_by).single();
              if (refData) {
                await supabase.from('customers').update({ wallet_balance: (refData.wallet_balance || 0) + 50 }).eq('phone', refData.phone);
                await logWalletTransaction(refData.phone, 'credit', 50, `Referral reward — ${order.customerName} completed their first order`);
                sendNotification('whatsapp', refData.phone, `🎉 Great news! Your friend ${order.customerName} completed their first order. ₹50 has been added to your wallet!`);
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
  res.json({ id, status, cancelReason, paymentStatus });
});

// 5.5 Update order schedule (staff, or the order's own customer)
app.patch('/api/orders/:id/reschedule', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { pickupDate, pickupTime } = req.body;

  if (!supabase) return res.json({ id, pickupDate, pickupTime });

  const { data: existingRows } = await supabase.from('orders').select('*').eq('id', id);
  const existing = existingRows && existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const isStaff = req.user.role === 'admin' || req.user.role === 'rider';
  const isOwner = req.user.role === 'customer' && req.user.phone === existing.customer_phone;
  if (!isStaff && !isOwner) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase.from('orders').update({ pickup_date: pickupDate, pickup_time: pickupTime }).eq('id', id).select();
  if (!error && data && data.length > 0) {
    const order = mapOrderToFrontend(data[0]);
    sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your Vastra Care order ${order.id} has been RESCHEDULED to ${pickupDate} (${pickupTime}).`);
    return res.json(order);
  }
  res.json({ id, pickupDate, pickupTime });
});

// 6. Update payment status (Admin/Rider control only — e.g. marking a COD order paid on delivery)
app.patch('/api/orders/:id/payment', authMiddleware, requireRole('admin', 'rider'), async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (supabase) {
    const { data, error } = await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', id).select();
    if (!error && data && data.length > 0) {
      const order = mapOrderToFrontend(data[0]);
      sendNotification('sms', order.customerPhone, `Vastra Care: Payment of ₹${order.total} for order ${order.id} is confirmed [Paid].`);
      return res.json(order);
    }
  }
  res.json({ id, paymentStatus });
});

// 6.5 Delete an order record (Admin only)
app.delete('/api/orders/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (supabase) await supabase.from('orders').delete().eq('id', id);
  res.json({ success: true });
});

// 7. Get customers list (Admin only — this used to be public)
app.get('/api/customers', authMiddleware, requireRole('admin'), async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapCustomerToFrontend));
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
    const { data: existing } = await supabase.from('customers').select('*').eq('phone', phone);
    if (existing && existing.length > 0) {
      return res.json(mapCustomerToFrontend(existing[0]));
    }

    const referralCode = `VASTRA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

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
    const { data: inserted } = await supabase.from('customers').insert([customerData]).select();
    sendNotification('sms', phone, `Welcome to Vastra Care, ${newCustomer.name}! Your pickup profile has been created successfully.`);
    return res.status(201).json(inserted && inserted[0] ? mapCustomerToFrontend(inserted[0]) : { ...newCustomer, phone });
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
      referralCode: `VASTRA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      referredBy: newCustomer.referredBy || null
    });
  }
  sendNotification('sms', phone, `Welcome to Vastra Care, ${newCustomer.name}! Your pickup profile has been created successfully.`);
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

  if (supabase) await supabase.from('customers').delete().eq('phone', phone);
  res.json({ success: true });
});

// 9. Payment order creation simulation / Live Razorpay Order session
app.post('/api/payments/create-order', authMiddleware, async (req, res) => {
  const { cartItems, couponCode, planName, currency } = req.body;
  let amount;
  let quote = null;

  if (Array.isArray(cartItems)) {
    // Booking checkout: the total is whatever our own catalog + the customer's real
    // subscription tier say it is — never what the client computed.
    quote = await computeQuote({
      cartItems,
      couponCode,
      customerPhone: req.user.role === 'customer' ? req.user.phone : undefined
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

  if (razorpay) {
    try {
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Razorpay in paise
        currency: currency || 'INR',
        receipt: `receipt_${Date.now()}`
      });
      console.log(`🏦 Live Razorpay Order Registered: ${order.id} for ₹${amount}`);
      return res.json({
        gatewayOrderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        liveMode: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        quote
      });
    } catch (err) {
      console.error('Razorpay SDK error:', err);
      return res.status(500).json({ error: 'Razorpay order creation failed: ' + err.message });
    }
  }

  // Simulated fallback transaction
  const gatewayOrder = {
    gatewayOrderId: `rzp_order_${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
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

// 10. Verify a Razorpay payment and credit the customer's wallet server-side.
// Replaces the old flow where the browser just PUT whatever wallet_balance it felt like.
app.post('/api/payments/verify-wallet-topup', authMiddleware, requireRole('customer'), async (req, res) => {
  const { amount, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  // Credit exactly what Razorpay confirms was paid — a valid signature alone doesn't
  // prove the amount, only that this payment_id belongs to this order_id.
  let creditAmount = amount;
  if (razorpay) {
    const confirmedAmount = await verifiedRazorpayAmount(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (confirmedAmount === null) return res.status(400).json({ error: 'Payment verification failed' });
    creditAmount = confirmedAmount;
  }

  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  const { data: custData } = await supabase.from('customers').select('wallet_balance').eq('phone', req.user.phone).single();
  const newBalance = (custData?.wallet_balance || 0) + creditAmount;
  const { data: updated } = await supabase.from('customers').update({ wallet_balance: newBalance }).eq('phone', req.user.phone).select();
  if (updated && updated[0]) {
    await logWalletTransaction(req.user.phone, 'credit', creditAmount, 'Wallet top-up');
    return res.json(mapCustomerToFrontend(updated[0]));
  }
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
  if (error) return res.json([]); // table probably doesn't exist yet — degrade gracefully
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
  const { planName, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const planPrice = PLAN_PRICES[planName];
  if (!planPrice) return res.status(400).json({ error: 'Unknown plan' });

  if (razorpay) {
    const confirmedAmount = await verifiedRazorpayAmount(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (confirmedAmount === null || Math.abs(confirmedAmount - planPrice) > 0.01) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }
  }

  if (!supabase) return res.status(503).json({ error: 'Database unavailable' });
  const { data: updated } = await supabase.from('customers').update({ active_plan: planName }).eq('phone', req.user.phone).select();
  if (updated && updated[0]) return res.json(mapCustomerToFrontend(updated[0]));
  res.status(500).json({ error: 'Failed to activate plan' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Vastra Care Backend API Server is running on http://localhost:${PORT}`);
  });
}

// Export for Vercel Serverless Functions
export default app;
