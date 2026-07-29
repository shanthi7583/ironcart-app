import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import Razorpay from 'razorpay';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database file setup
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
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

// Helper to read DB
const readDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      prices: DEFAULT_PRICE_LIST,
      customers: DEFAULT_CUSTOMERS,
      orders: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read database file, resetting...', err);
    const fallback = { prices: DEFAULT_PRICE_LIST, customers: DEFAULT_CUSTOMERS, orders: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2));
    return fallback;
  }
};

// Helper to write DB
const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

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

// --- API ROUTES ---

// 1. Get prices
app.get('/api/prices', (req, res) => {
  const db = readDB();
  res.json(db.prices);
});

// 2. Update prices (Admin)
app.put('/api/prices', (req, res) => {
  const updatedPrices = req.body;
  if (!Array.isArray(updatedPrices)) {
    return res.status(400).json({ error: 'Body must be an array of prices' });
  }
  const db = readDB();
  db.prices = updatedPrices;
  writeDB(db);
  console.log('⚙️ Pricing updated on database.');
  res.json({ message: 'Prices updated successfully', prices: db.prices });
});

// 3. Get all orders (Admin or list)
app.get('/api/orders', (req, res) => {
  const db = readDB();
  res.json(db.orders);
});

// 4. Create new order (Customer checkout)
app.post('/api/orders', (req, res) => {
  const newOrder = req.body;
  if (!newOrder.id || !newOrder.items) {
    return res.status(400).json({ error: 'Invalid order structure' });
  }
  const db = readDB();
  db.orders.unshift(newOrder); // Add to beginning
  writeDB(db);
  
  // Dispatch alerts
  sendNotification('whatsapp', newOrder.customerPhone, `Hi ${newOrder.customerName}, your IronCart order ${newOrder.id} of ₹${newOrder.total} was placed! Pickup scheduled for ${newOrder.pickupDate} (${newOrder.pickupTime}).`);
  sendNotification('sms', '9791019505', `Owner Alert: New order ${newOrder.id} received from ${newOrder.customerName} (${newOrder.apartmentNo}).`);
  
  res.status(201).json(newOrder);
});

// 5. Update order status (Admin control)
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const db = readDB();
  const index = db.orders.findIndex(o => o.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  db.orders[index].status = status;
  writeDB(db);
  
  const order = db.orders[index];
  sendNotification('whatsapp', order.customerPhone, `Dear ${order.customerName}, your IronCart order ${order.id} status is now: [${status}].`);
  
  res.json(db.orders[index]);
});

// 6. Update payment status (Admin control)
app.patch('/api/orders/:id/payment', (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  
  const db = readDB();
  const index = db.orders.findIndex(o => o.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  db.orders[index].paymentStatus = paymentStatus;
  writeDB(db);
  
  const order = db.orders[index];
  sendNotification('sms', order.customerPhone, `IronCart: Payment of ₹${order.total} for order ${order.id} is confirmed [Paid].`);
  
  res.json(db.orders[index]);
});

// 7. Get customers list
app.get('/api/customers', (req, res) => {
  const db = readDB();
  res.json(db.customers);
});

// 8. Register customer / login verification
app.post('/api/customers', (req, res) => {
  const newCustomer = req.body;
  if (!newCustomer.phone || !newCustomer.name) {
    return res.status(400).json({ error: 'Name and phone required' });
  }
  
  const db = readDB();
  const existingIdx = db.customers.findIndex(c => c.phone === newCustomer.phone);
  
  if (existingIdx !== -1) {
    return res.json(db.customers[existingIdx]);
  }
  
  db.customers.push(newCustomer);
  writeDB(db);
  
  sendNotification('sms', newCustomer.phone, `Welcome to IronCart, ${newCustomer.name}! Your pickup profile has been created successfully.`);
  
  res.status(201).json(newCustomer);
});

// Update customer (for wallet and addresses)
app.put('/api/customers/:phone', (req, res) => {
  const db = readDB();
  const index = db.customers.findIndex(c => c.phone === req.params.phone);
  if (index === -1) return res.status(404).json({ error: 'Customer not found' });
  
  db.customers[index] = { ...db.customers[index], ...req.body };
  writeDB(db);
  res.json(db.customers[index]);
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
module.exports = app;
