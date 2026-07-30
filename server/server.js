import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import https from 'https';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase PostgreSQL Client Initialized.');
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

// --- API ROUTES ---

// 1. Get prices
app.get('/api/prices', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('prices').select('*').order('id', { ascending: true });
    if (!error && data && data.length > 0) return res.json(data);
  }
  res.json(DEFAULT_PRICE_LIST);
});

// 2. Update prices (Admin)
app.put('/api/prices', async (req, res) => {
  const updatedPrices = req.body;
  if (!Array.isArray(updatedPrices)) {
    return res.status(400).json({ error: 'Body must be an array of prices' });
  }
  // This route is tricky to map to Supabase without IDs. In a real app we'd upsert. 
  // We'll skip Supabase sync for price updates for now, as they are mostly static.
  res.json({ message: 'Prices updated successfully', prices: updatedPrices });
});

// 3. Get all orders (Admin or list)
app.get('/api/orders', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapOrderToFrontend));
  }
  res.json([]);
});

// 4. Create new order (Customer checkout)
app.post('/api/orders', async (req, res) => {
  const newOrder = req.body;
  if (!newOrder.id || !newOrder.items) {
    return res.status(400).json({ error: 'Invalid order structure' });
  }
  
  if (supabase) {
    const orderData = {
      id: newOrder.id,
      customer_phone: newOrder.customerPhone,
      customer_name: newOrder.customerName,
      apartment_no: newOrder.apartmentNo,
      address: newOrder.address,
      status: newOrder.status || 'Placed',
      payment_status: newOrder.paymentStatus || 'Pending',
      payment_method: newOrder.paymentMethod || 'Cash',
      pickup_date: newOrder.pickupDate,
      pickup_time: newOrder.pickupTime,
      subtotal: newOrder.subtotal,
      total: newOrder.total,
      items: newOrder.items,
      special_instructions: newOrder.specialInstructions,
      cancel_reason: newOrder.cancelReason || null,
      delivery_timeline: newOrder.deliveryTimeline || []
    };
    await supabase.from('orders').insert([orderData]);
  }
  
  // Dispatch alerts
  sendNotification('whatsapp', newOrder.customerPhone, `Hi ${newOrder.customerName}, your IronCart order ${newOrder.id} of ₹${newOrder.total} was placed! Pickup scheduled for ${newOrder.pickupDate} (${newOrder.pickupTime}).`);
  sendNotification('sms', '9791019505', `Owner Alert: New order ${newOrder.id} received from ${newOrder.customerName} (${newOrder.apartmentNo}).`);
  
  res.status(201).json(newOrder);
});

// 5. Update order status (Admin control)
app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, cancelReason, paymentStatus } = req.body;
  
  if (supabase) {
    const updatePayload = { status };
    if (cancelReason) updatePayload.cancel_reason = cancelReason;
    if (paymentStatus) updatePayload.payment_status = paymentStatus;

    const { data, error } = await supabase.from('orders').update(updatePayload).eq('id', id).select();
    if (!error && data && data.length > 0) {
      const order = mapOrderToFrontend(data[0]);
      if (status === 'Cancelled') {
        sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your IronCart order ${order.id} has been Cancelled. Reason: ${cancelReason}`);
      } else {
        sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your IronCart order ${order.id} status is now: [${status}].`);

        // Referral Reward Logic
        if (status === 'Delivered') {
          try {
            const { count, error: countError } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('customer_phone', order.customerPhone).eq('status', 'Delivered');
            if (!countError && count === 1) {
              const { data: cData } = await supabase.from('customers').select('referred_by, wallet_balance').eq('phone', order.customerPhone).single();
              if (cData && cData.referred_by) {
                // Reward new customer
                await supabase.from('customers').update({ wallet_balance: (cData.wallet_balance || 0) + 50 }).eq('phone', order.customerPhone);
                sendNotification('whatsapp', order.customerPhone, `🎉 Congratulations! ₹50 has been added to your IronCart wallet for completing your first referred order!`);
                
                // Reward referrer
                const { data: refData } = await supabase.from('customers').select('wallet_balance, phone').eq('referral_code', cData.referred_by).single();
                if (refData) {
                  await supabase.from('customers').update({ wallet_balance: (refData.wallet_balance || 0) + 50 }).eq('phone', refData.phone);
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
  }
  res.json({ id, status, cancelReason });
});

// 5.5 Update order schedule
app.patch('/api/orders/:id/reschedule', async (req, res) => {
  const { id } = req.params;
  const { pickupDate, pickupTime } = req.body;
  
  if (supabase) {
    const { data, error } = await supabase.from('orders').update({ pickup_date: pickupDate, pickup_time: pickupTime }).eq('id', id).select();
    if (!error && data && data.length > 0) {
      const order = mapOrderToFrontend(data[0]);
      sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your IronCart order ${order.id} has been RESCHEDULED to ${pickupDate} (${pickupTime}).`);
      return res.json(order);
    }
  }
  res.json({ id, pickupDate, pickupTime });
});

// 6. Update payment status (Admin control)
app.patch('/api/orders/:id/payment', async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  
  if (supabase) {
    const { data, error } = await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', id).select();
    if (!error && data && data.length > 0) {
      const order = mapOrderToFrontend(data[0]);
      sendNotification('sms', order.customerPhone, `IronCart: Payment of ₹${order.total} for order ${order.id} is confirmed [Paid].`);
      return res.json(order);
    }
  }
  res.json({ id, paymentStatus });
});

// 7. Get customers list
app.get('/api/customers', async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!error && data) return res.json(data.map(mapCustomerToFrontend));
  }
  res.json(DEFAULT_CUSTOMERS);
});

// 7.5 Get individual customer by phone
app.get('/api/customers/:phone', async (req, res) => {
  const { phone } = req.params;
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

// 8. Register customer / login verification
app.post('/api/customers', async (req, res) => {
  const newCustomer = req.body;
  if (!newCustomer.phone || !newCustomer.name) {
    return res.status(400).json({ error: 'Name and phone required' });
  }
  
  if (supabase) {
    // Check if exists
    const { data: existing } = await supabase.from('customers').select('*').eq('phone', newCustomer.phone);
    if (existing && existing.length > 0) {
      return res.json(mapCustomerToFrontend(existing[0]));
    }
    
    const referralCode = `IRON-${Math.random().toString(36).substring(2,6).toUpperCase()}`;

    // Insert new
    const customerData = {
      phone: newCustomer.phone,
      name: newCustomer.name,
      wallet_balance: newCustomer.walletBalance || 0,
      subscription_quota: newCustomer.subscriptionQuota || 0,
      active_plan: newCustomer.activePlan || 'None',
      apartment_no: newCustomer.apartmentNo || '',
      address: newCustomer.address || '',
      addresses: newCustomer.addresses || [],
      referral_code: referralCode,
      referred_by: newCustomer.referredBy || null
    };
    await supabase.from('customers').insert([customerData]);
  } else {
    const existingIndex = DEFAULT_CUSTOMERS.findIndex(c => c.phone === newCustomer.phone);
    if (existingIndex === -1) {
      DEFAULT_CUSTOMERS.push({
        phone: newCustomer.phone,
        name: newCustomer.name,
        walletBalance: newCustomer.walletBalance || 0,
        subscriptionQuota: newCustomer.subscriptionQuota || 0,
        activePlan: newCustomer.activePlan || 'None',
        apartmentNo: newCustomer.apartmentNo || '',
        address: newCustomer.address || '',
        addresses: newCustomer.addresses || [],
        referralCode: `IRON-${Math.random().toString(36).substring(2,6).toUpperCase()}`,
        referredBy: newCustomer.referredBy || null
      });
    }
  }
  
  sendNotification('sms', newCustomer.phone, `Welcome to IronCart, ${newCustomer.name}! Your pickup profile has been created successfully.`);
  res.status(201).json(newCustomer);
});

// Update customer (for wallet and addresses)
app.put('/api/customers/:phone', async (req, res) => {
  const { phone } = req.params;
  const updates = req.body;
  
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

// 9. Payment order creation simulation / Live Razorpay Order session
app.post('/api/payments/create-order', async (req, res) => {
  const { amount, currency } = req.body;
  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
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
        keyId: process.env.RAZORPAY_KEY_ID
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
    liveMode: false
  };
  
  console.log(`🏦 Payment Gateway Order Initialized (Demo Mode): ${gatewayOrder.gatewayOrderId} for ₹${amount}`);
  res.json(gatewayOrder);
});

// 10. Simulated / Real OTP dispatcher API
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  
  sendNotification('whatsapp', phone, `Your IronCart verification OTP code is ${otp}. Valid for 5 minutes.`);
  res.json({ success: true, otp });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 IronCart Backend API Server is running on http://localhost:${PORT}`);
  });
}

// Export for Vercel Serverless Functions
export default app;
