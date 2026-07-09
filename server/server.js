import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const DEFAULT_PRICE_LIST = [
  { name: 'Shirt', price: 15, category: 'Apparel' },
  { name: 'T-Shirt', price: 12, category: 'Apparel' },
  { name: 'Pant', price: 15, category: 'Apparel' },
  { name: 'Jeans', price: 18, category: 'Apparel' },
  { name: 'Saree', price: 50, category: 'Apparel' },
  { name: 'Kurta', price: 20, category: 'Apparel' },
  { name: 'Salwar', price: 20, category: 'Apparel' },
  { name: 'Blazer', price: 80, category: 'Outerwear' },
  { name: 'Coat', price: 90, category: 'Outerwear' },
  { name: 'Suit', price: 120, category: 'Outerwear' },
  { name: 'School Uniform', price: 25, category: 'Apparel' },
  { name: 'Bedsheet', price: 30, category: 'Bedding' },
  { name: 'Pillow Cover', price: 10, category: 'Bedding' },
  { name: 'Curtain', price: 60, category: 'Bedding' },
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
  console.log(`🔔 New Order Created: ${newOrder.id} - ${newOrder.customerName}`);
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
  console.log(`📱 Order Status Changed: ${id} is now [${status}]`);
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
  console.log(`💳 Order Payment Updated: ${id} payment status is [${paymentStatus}]`);
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
    // Already exists, just return profile (login)
    return res.json(db.customers[existingIdx]);
  }
  
  db.customers.push(newCustomer);
  writeDB(db);
  console.log(`👋 New Customer Registered: ${newCustomer.name} (${newCustomer.phone})`);
  res.status(201).json(newCustomer);
});

app.listen(PORT, () => {
  console.log(`🚀 IronEase Backend API Server is running on http://localhost:${PORT}`);
});
