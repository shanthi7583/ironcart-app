import { useState, useEffect } from 'react'
import { 
  Plus, Minus, Clock, Check, MapPin,
  TrendingUp, Users, Smartphone, 
  ChevronRight, ShoppingBag, 
  FileText, CreditCard, ArrowLeft, Settings, 
  Bell, HelpCircle, LogOut, Eye, RefreshCw, Key, Star, Navigation, Wallet, X, Phone, Gift, Landmark, Truck, User
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { auth, RecaptchaVerifier } from './firebaseConfig'
import { signInWithPhoneNumber } from 'firebase/auth'

// Define interfaces
interface GarmentItem {
  name: string;
  price: number;
  category: string;
  serviceType?: string;
  icon?: string;
}

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface AddressInfo {
  id: string;
  label: string;
  fullAddress: string;
}

interface CustomerProfile {
  phone: string;
  name: string;
  email?: string;
  password?: string;
  walletBalance?: number;
  subscriptionQuota?: number;
  activePlan?: string;
  apartmentNo: string;
  address: string;
  addresses?: AddressInfo[];
  referralCode?: string;
  referredBy?: string;
}

interface Order {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  apartmentNo: string;
  address: string;
  pickupDate: string;
  pickupTime: string;
  speed: 'Normal' | 'Express' | 'Urgent';
  service: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  markup: number;
  tax: number;
  total: number;
  couponApplied: string;
  status: 'Placed' | 'Picked Up' | 'Ironing' | 'Ready' | 'Delivered' | 'Cancelled';
  paymentStatus: 'Pending' | 'Paid';
  paymentMethod: string;
  specialInstructions: string;
  cancelReason?: string;
  createdAt: string;
}



const BASE_GARMENTS = [
  // --- Light Weight ---
  { name: 'Baby Clothes', price: 10, category: 'Light Weight', icon: '👶' },
  { name: 'Kids Wear', price: 15, category: 'Light Weight', icon: '🧒' },
  { name: 'Uniform', price: 20, category: 'Light Weight', icon: '👔' },
  { name: 'Legging', price: 15, category: 'Light Weight', icon: '👖' },
  { name: 'Pajama', price: 15, category: 'Light Weight', icon: '🩳' },
  { name: 'Salwar', price: 20, category: 'Light Weight', icon: '🥻' },
  { name: 'Kurta', price: 20, category: 'Light Weight', icon: '👚' },
  { name: 'T-Shirt', price: 15, category: 'Light Weight', icon: '👕' },
  { name: 'Trouser/Pant', price: 18, category: 'Light Weight', icon: '👖' },

  // --- Medium/Heavy ---
  { name: 'Jacket', price: 50, category: 'Medium/Heavy', icon: '🧥' },
  { name: 'Blazer', price: 80, category: 'Medium/Heavy', icon: '🧥' },
  { name: 'Skirt', price: 25, category: 'Medium/Heavy', icon: '👗' },
  { name: 'Dhoti', price: 30, category: 'Medium/Heavy', icon: '🥻' },
  { name: 'Party Top', price: 35, category: 'Medium/Heavy', icon: '👚' },
  { name: 'Silk Kurta', price: 40, category: 'Medium/Heavy', icon: '👘' },
  { name: 'Sweater', price: 60, category: 'Medium/Heavy', icon: '🧶' },

  // --- Premium ---
  { name: 'Bridal Set', price: 250, category: 'Premium', icon: '✨' },
  { name: 'Designer Blouse', price: 60, category: 'Premium', icon: '👚' },
  { name: 'Designer Saree', price: 100, category: 'Premium', icon: '🥻' },
  { name: 'Formal Suit', price: 120, category: 'Premium', icon: '🕴️' },
  { name: 'Lehenga', price: 200, category: 'Premium', icon: '👗' },
  { name: 'Sherwani', price: 250, category: 'Premium', icon: '🧥' },
  { name: 'Silk Saree', price: 150, category: 'Premium', icon: '🥻' },
  { name: 'Winter Coat', price: 150, category: 'Premium', icon: '🧥' },

  // --- Household ---
  { name: 'Cushion Cover', price: 15, category: 'Household', icon: '🛋️' },
  { name: 'Face Towel', price: 10, category: 'Household', icon: '🧻' },
  { name: 'Handkerchief', price: 5, category: 'Household', icon: '🧣' },
  { name: 'Kitchen Towel', price: 10, category: 'Household', icon: '🧺' },
  { name: 'Pillow Cover', price: 15, category: 'Household', icon: '🛏️' },
  { name: 'Table Mat', price: 20, category: 'Household', icon: '🍽️' },
  { name: 'Bed Sheet', price: 40, category: 'Household', icon: '🛏️' },
  { name: 'Blanket', price: 100, category: 'Household', icon: '🛌' },
  { name: 'Comforter', price: 120, category: 'Household', icon: '🛌' },
  { name: 'Curtain', price: 80, category: 'Household', icon: '🪟' },
  { name: 'Sofa Cover', price: 90, category: 'Household', icon: '🛋️' },
];

const DEFAULT_PRICE_LIST: GarmentItem[] = [];
BASE_GARMENTS.forEach(item => {
  DEFAULT_PRICE_LIST.push({ ...item, serviceType: 'Ironing' });
  DEFAULT_PRICE_LIST.push({ ...item, price: Math.round(item.price * 2.5), serviceType: 'Dry Cleaning' });
  DEFAULT_PRICE_LIST.push({ ...item, price: Math.round(item.price * 1.5), serviceType: 'Laundry' });
});

export default function App() {
  // --- Persistent State using Backend API & LocalStorage ---
  const API_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

  const [orders, setOrders] = useState<Order[]>([]);
  const [priceList, setPriceList] = useState<GarmentItem[]>(DEFAULT_PRICE_LIST);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  
  const [currentCustomer, setCurrentCustomer] = useState<CustomerProfile | null>(() => {
    const saved = localStorage.getItem('iron_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Fetch initial data and listen to live changes from Supabase if active
  useEffect(() => {
    const client = supabase;
    if (client) {
      // 1. Fetch from Supabase tables
      client.from('prices').select('*')
        .then(({ data, error }) => {
          if (error) console.error(error);
          else if (data && data.length > 0) {
            const upiRow = data.find((p: any) => p.category === 'system' && p.item_name === 'upi_details');
            if (upiRow && upiRow.icon) {
              const [phone, id] = upiRow.icon.split('|');
              setUpiDetails({ phone, id });
            }
            const garments = data.filter((p: any) => p.category !== 'system');
            const mapped = garments.map((p: any) => ({
              name: p.item_name,
              price: p.price,
              category: p.category,
              icon: p.icon || '👕',
              serviceType: p.service_type || 'Ironing'
            }));
            setPriceList(mapped);
          } else {
            // Seed database prices table if empty
            const seedData = DEFAULT_PRICE_LIST.map(item => ({
              category: item.category,
              item_name: item.name,
              price: item.price,
              icon: item.icon || '👕',
              service_type: item.serviceType
            }));
            client.from('prices').insert(seedData).then(() => {
              console.log('Seeded prices table in database.');
            });
          }
        });

      client.from('orders').select('*').order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error(error);
          else if (data) setOrders(data);
        });

      client.from('customers').select('*')
        .then(({ data, error }) => {
          if (error) console.error(error);
          else if (data) setCustomers(data);
        });

      // 2. Real-time Subscription to DB modifications
      const ordersSubscription = client
        .channel('orders-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          console.log('Realtime Order Event received:', payload);
          client.from('orders').select('*').order('created_at', { ascending: false })
            .then(({ data, error }) => {
              if (!error && data) setOrders(data);
            });
        })
        .subscribe();

      return () => {
        client.removeChannel(ordersSubscription);
      };
    } else {
      // Fallback: Local Server REST API
      fetch(`${API_URL}/prices`)
        .then(res => res.json())
        .then(data => setPriceList(data))
        .catch(err => console.error('Failed to fetch prices:', err));

      fetch(`${API_URL}/orders`)
        .then(res => res.json())
        .then(data => setOrders(data))
        .catch(err => console.error('Failed to fetch orders:', err));

      fetch(`${API_URL}/customers`)
        .then(res => res.json())
        .then(data => setCustomers(data))
        .catch(err => console.error('Failed to fetch customers:', err));
    }
  }, []);

  // Sync user session to LocalStorage
  useEffect(() => {
    if (currentCustomer) {
      localStorage.setItem('iron_current_user', JSON.stringify(currentCustomer));
    } else {
      localStorage.removeItem('iron_current_user');
    }
  }, [currentCustomer]);

  // --- Layout and Navigation State ---
  // Default to 'customer' view ONLY, so the customer app is used alone!
  const [viewMode, setViewMode] = useState<'customer' | 'admin' | 'dual' | 'rider'>('customer');
  const [customerActiveTab, setCustomerActiveTab] = useState<'home' | 'order' | 'prices' | 'history' | 'support' | 'subscriptions' | 'rewards' | 'notifications' | 'profile'>('home');
  const [adminActiveTab, setAdminActiveTab] = useState<'overview' | 'orders' | 'prices' | 'customers' | 'settings'>('overview');
  const userSubscription = currentCustomer?.activePlan || 'None';
  const [upiDetails, setUpiDetails] = useState<{ phone: string, id: string }>(() => {
    const saved = localStorage.getItem('iron_upi_details');
    return saved ? JSON.parse(saved) : { phone: '9791019505', id: '9791019505@ybl' };
  });

  useEffect(() => {
    localStorage.setItem('iron_upi_details', JSON.stringify(upiDetails));
  }, [upiDetails]);


  // Customer Form / Auth State
  const [authStep, setAuthStep] = useState<'login' | 'otp' | 'register'>('login');
  const [authPhone, setAuthPhone] = useState('');
  const [authName, setAuthName] = useState('');
  const [authApartment, setAuthApartment] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authReferredBy, setAuthReferredBy] = useState('');
  const [authOTP, setAuthOTP] = useState('');
  const [sentOTP, setSentOTP] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Admin access state
  const [adminPin, setAdminPin] = useState('');

  // Customer Placing Order State
  const [selectedService, setSelectedService] = useState<'Ironing' | 'Dry Cleaning' | 'Laundry'>('Ironing');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');

  const orderSpeed = 'Normal';
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Light Weight');

  // Cancel & Reschedule Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  
  
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isToday = i === 0;
      const isTomorrow = i === 1;
      let label = d.toLocaleDateString('en-US', { weekday: 'short' });
      if (isToday) label = 'Today';
      if (isTomorrow) label = 'Tmrw';
      dates.push({
        value: d.toISOString().split('T')[0],
        label: label,
        dateNum: d.getDate()
      });
    }
    return dates;
  };
  const availableDates = generateDates();
  
  useEffect(() => {
    if (!pickupDate && availableDates.length > 0) {
      setPickupDate(availableDates[0].value);
    }
  }, [pickupDate]);

  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'COD' | 'Wallet' | 'NetBanking'>('UPI');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<Order | null>(null);

  // Admin edit prices state
  const [editingPrices, setEditingPrices] = useState<{ [key: string]: number }>({});

  // Active modal invoice state
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);
  const [gatewayOrderData, setGatewayOrderData] = useState<any>(null);
  const [firebaseConfirmResult, setFirebaseConfirmResult] = useState<any>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Show simulated WhatsApp / System Notification banners
  const triggerNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // --- Auth Handlers ---
  const handleSendOTP = () => {
    if (!authPhone || authPhone.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    const sendLocalOTP = () => {
      fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: authPhone })
      })
        .then(res => res.json())
        .then(data => {
          if (data.otp) {
            setSentOTP(data.otp);
            setAuthStep('otp');
            triggerNotification(`💬 WhatsApp OTP Sent to +91 ${authPhone}! Check backend terminal log for PIN.`);
          }
        })
        .catch(err => alert('Failed to send verification code: ' + err.message));
    };

    if (auth) {
      try {
        const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
        signInWithPhoneNumber(auth, '+91' + authPhone, appVerifier)
          .then((confirmationResult) => {
            setFirebaseConfirmResult(confirmationResult);
            setAuthStep('otp');
            triggerNotification(`💬 Real SMS OTP Sent to +91 ${authPhone}!`);
          })
          .catch((err) => {
            alert('Firebase Phone Auth Error: ' + err.message);
            console.warn('Firebase Phone Auth Error, falling back to local:', err.message);
            sendLocalOTP();
          });
      } catch (err: any) {
        alert('Failed to initialize SMS gateway: ' + err.message);
        console.warn('Failed to initialize SMS gateway, falling back to local:', err.message);
        sendLocalOTP();
      }
      return;
    }

    // Fallback if no auth object
    sendLocalOTP();
  };

  const handleVerifyOTP = () => {
    const processLogin = () => {
      fetch(`${API_URL}/customers/${authPhone}`)
        .then(res => {
          if (res.ok) {
            return res.json().then(data => {
              setCurrentCustomer(data);
              setCustomerActiveTab('home');
            });
          } else if (res.status === 404) {
            setAuthStep('register');
          } else {
            throw new Error('Unexpected API error');
          }
        })
        .catch(err => alert('API Connection Error: ' + err.message));
    };

    if (auth && firebaseConfirmResult) {
      firebaseConfirmResult.confirm(authOTP)
        .then(() => {
          processLogin();
        })
        .catch((err: any) => {
          alert('Invalid verification code: ' + err.message);
        });
      return;
    }

    if (authOTP === sentOTP || authOTP === '1234') { // Fallback bypass
      processLogin();
    } else {
      alert('Invalid OTP. Please try again or use 1234');
    }
  };

  const handleRegister = () => {
    if (!authName.trim() || !authApartment.trim() || authAddress.trim().length < 5) {
      alert('Please enter a valid name, apartment number, and full street address (at least 5 characters).');
      return;
    }
    const newProfile: CustomerProfile = {
      name: authName,
      phone: authPhone,
      apartmentNo: authApartment,
      address: authAddress,
      referredBy: authReferredBy.trim() ? authReferredBy.trim().toUpperCase() : undefined
    };

    // Direct Supabase call removed to enforce routing through Express API (/api/customers)
    // where backend safely maps camelCase keys to snake_case SQL columns.

    fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProfile)
    })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        setCustomers(prev => [...prev, data]);
        setCurrentCustomer(data);
        localStorage.setItem('iron_current_user', JSON.stringify(data));
        setAuthPhone('');
        setAuthOTP('');
        triggerNotification(`🎉 Welcome to Iron Kart, ${data.name}!`);
      })
      .catch(() => alert('Registration failed. Is the backend running?'));
  };

  const handleLogout = () => {
    localStorage.removeItem('iron_current_user');
    setCurrentCustomer(null);
    setAuthStep('login');
    setAuthPhone('');
    setAuthOTP('');
    setAuthName('');
    setAuthApartment('');
    setAuthAddress('');
    setSelectedItems({});
    window.location.reload();
  };

  // --- Calculation Helpers ---
  const calculateTotals = () => {
    let subtotal = 0;
    let totalItems = 0;
    Object.entries(selectedItems).forEach(([key, qty]) => {
      const item = priceList.find(p => `${p.serviceType}-${p.name}` === key);
      if (item && qty > 0) {
        totalItems += qty;
        subtotal += item.price * qty;
      }
    });

    let markupMultiplier = 0; // Standard delivery (no extra markup)
    const markup = parseFloat((subtotal * markupMultiplier).toFixed(2));
    
    // Apply discount to subtotal
    let discount = 0;
    
    if (userSubscription !== 'None') {
      Object.entries(selectedItems).forEach(([name, qty]) => {
        const item = priceList.find(i => i.name === name);
        if (item && qty > 0) {
          let catDiscountPercent = 0;
          if (userSubscription === 'Bronze') {
            if (item.category === 'Light Weight') catDiscountPercent = 0.05;
            else if (item.category === 'Medium/Heavy') catDiscountPercent = 0.10;
            else if (item.category === 'Premium') catDiscountPercent = 0.15;
            else if (item.category === 'Household') catDiscountPercent = 0.10;
          } else if (userSubscription === 'Silver') {
            if (item.category === 'Light Weight') catDiscountPercent = 0.10;
            else if (item.category === 'Medium/Heavy') catDiscountPercent = 0.20;
            else if (item.category === 'Premium') catDiscountPercent = 0.30;
            else if (item.category === 'Household') catDiscountPercent = 0.15;
          } else if (userSubscription === 'Gold') {
            if (item.category === 'Light Weight') catDiscountPercent = 0.15;
            else if (item.category === 'Medium/Heavy') catDiscountPercent = 0.30;
            else if (item.category === 'Premium') catDiscountPercent = 0.45;
            else if (item.category === 'Household') catDiscountPercent = 0.20;
          }
          discount += item.price * qty * catDiscountPercent;
        }
      });
    } else {
      if (appliedCoupon === 'WELCOME50') discount = 50;
      else if (appliedCoupon === 'FIRST10') discount = subtotal * 0.10;
    }
    
    // Ensure discount doesn't exceed subtotal
    if (discount > subtotal) discount = subtotal;
    discount = parseFloat(discount.toFixed(2));

    const taxableAmount = Math.max(0, subtotal - discount + markup);
    const tax = parseFloat((taxableAmount * 0.05).toFixed(2)); // 5% GST
    const total = parseFloat((taxableAmount + tax).toFixed(2));

    return { subtotal, discount, markup, tax, total };
  };

  // --- Order Submission ---
  const handlePlaceOrder = () => {
    const { subtotal, total } = calculateTotals();

    if (!orderName.trim() || !orderPhone.trim() || orderAddress.trim().length < 5) {
      alert('Please fill out all pickup details (Name, Phone, and Full Address) correctly.');
      return;
    }

    if (subtotal === 0) {
      alert('Please add at least one garment to your basket');
      return;
    }
    if (!pickupDate) {
      alert('Please select a pickup date');
      return;
    }

    // Call payment gateway simulation API to generate a transaction session ID
    fetch(`${API_URL}/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total })
    })
      .then(res => res.json())
      .then(data => {
        setGatewayOrderData(data);
        triggerNotification(`🏦 Payment Gateway Session: ${data.gatewayOrderId} created!`);
        setShowCheckoutModal(true);
      })
      .catch(err => {
        alert('Failed to connect to checkout gateway: ' + err.message);
      });
  };

  const confirmOrderPayment = (transactionId: string = 'Simulated') => {
    const { subtotal, discount, markup, tax, total } = calculateTotals();
    const orderItems: OrderItem[] = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => {
        const pItem = priceList.find(p => `${p.serviceType}-${p.name}` === key);
        return {
          name: pItem ? `${pItem.serviceType} - ${pItem.name}` : key,
          qty,
          price: pItem ? pItem.price : 0
        };
      });

    const newOrder: Order = {
      id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      invoiceNo: `IC-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: orderName || 'Walk-in Customer',
      customerPhone: orderPhone || '',
      apartmentNo: '',
      address: orderAddress || '',
      pickupDate,
      pickupTime,
      speed: orderSpeed,
      service: selectedService,
      items: orderItems,
      subtotal,
      discount,
      markup,
      tax,
      total,
      couponApplied: appliedCoupon,
      status: 'Placed',
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
      paymentMethod: transactionId !== 'Simulated' ? `${paymentMethod} (Txn: ${transactionId})` : paymentMethod,
      specialInstructions,
      createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    // Direct Supabase call removed. We MUST route through Express API (/api/orders)
    // so the backend can map camelCase to snake_case and trigger notifications.

    fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
    })
      .then(res => res.json())
      .then(data => {
        setOrders(prev => [data, ...prev]);
        setSelectedItems({});
        setSpecialInstructions('');
        setShowCheckoutModal(false);
        setSelectedOrderForTracking(data);
        setCustomerActiveTab('history');
        triggerNotification(`🎉 Order Placed Successfully! We care for your clothes as much as you do! ❤️`);
      })
      .catch(err => alert('API Connection Error: ' + err.message));
  };

  const handleCheckoutSubmit = () => {
    if (paymentMethod === 'Wallet') {
      const { total } = calculateTotals();
      if (!currentCustomer || (currentCustomer.walletBalance || 0) < total) {
        alert('Insufficient wallet balance! Please add funds or choose another payment method.');
        return;
      }
      const newBalance = currentCustomer.walletBalance! - total;
      const updated = { ...currentCustomer, walletBalance: newBalance };
      setCurrentCustomer(updated);
      fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      confirmOrderPayment();
      return;
    }

    if ((paymentMethod === 'UPI' || paymentMethod === 'Card' || paymentMethod === 'NetBanking') && gatewayOrderData?.liveMode) {
      // Trigger Live Razorpay Checkout
      const options = {
        key: gatewayOrderData.keyId,
        amount: gatewayOrderData.amount * 100, // paise
        currency: gatewayOrderData.currency,
        name: "Iron Kart Service",
        description: "Ironing Booking Service Payment",
        order_id: gatewayOrderData.gatewayOrderId,
        handler: function (response: any) {
          console.log("Razorpay Success Transaction ID:", response.razorpay_payment_id);
          confirmOrderPayment(response.razorpay_payment_id);
        },
        prefill: {
          name: orderName || '',
          contact: orderPhone || ''
        },
        theme: { color: "#F43F5E" }
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } else {
      // Demo Mode or COD
      confirmOrderPayment();
    }
  };

  // --- Admin Actions ---
  const updateOrderStatus = (orderId: string, nextStatus: 'Placed' | 'Picked Up' | 'Ironing' | 'Ready' | 'Delivered') => {
    fetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    })
      .then(res => res.json())
      .then(data => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data } : o));
        let notifyMsg = `📱 SMS: Order ${orderId} updated to [${nextStatus}]`;
        if (nextStatus === 'Ready') notifyMsg = `🎉 WhatsApp sent: Your ironing is ready for pickup!`;
        if (nextStatus === 'Delivered') notifyMsg = `🚚 Delivered! Invoice generated.`;
        triggerNotification(notifyMsg);
      })
      .catch(err => alert('API Connection Error: ' + err.message));
  };

  const markOrderPaid = (orderId: string) => {
    fetch(`${API_URL}/orders/${orderId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'Paid' })
    })
      .then(res => res.json())
      .then(data => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data } : o));
        triggerNotification(`💳 Payment received for order ${orderId}`);
      })
      .catch(err => alert('API Connection Error: ' + err.message));
  };

  const deleteOrder = (orderId: string) => {
    if (confirm('Delete this order record?')) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    }
  };

  const saveAdminPrices = () => {
    const updated = priceList.map(item => {
      const key = `${item.serviceType}-${item.name}`;
      if (editingPrices[key] !== undefined) {
        return { ...item, price: editingPrices[key] };
      }
      return item;
    });

    const client = supabase;
    if (client) {
      Promise.all(
        updated.map(item => {
          const key = `${item.serviceType}-${item.name}`;
          if (editingPrices[key] !== undefined) {
            return client.from('prices')
              .update({ price: item.price })
              .eq('item_name', item.name)
              .eq('service_type', item.serviceType);
          }
          return Promise.resolve();
        })
      ).then(() => {
        setPriceList(updated);
        setEditingPrices({});
        triggerNotification(`⚙️ Price rates updated successfully!`);
      });
      return;
    }

    fetch(`${API_URL}/prices`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    })
      .then(res => res.json())
      .then(data => {
        setPriceList(data.prices);
        setEditingPrices({});
        triggerNotification(`⚙️ Price rates updated successfully!`);
      })
      .catch(err => alert('API Connection Error: ' + err.message));
  };

  const saveUpiSettings = () => {
    const client = supabase;
    const packed = `${upiDetails.phone}|${upiDetails.id}`;
    if (client) {
      client.from('prices')
        .update({ icon: packed })
        .eq('category', 'system')
        .eq('item_name', 'upi_details')
        .then(() => {
          // If we had no row to update, we'll try to upsert
          client.from('prices')
            .select('id')
            .eq('category', 'system')
            .eq('item_name', 'upi_details')
            .then(({ data: existData }) => {
              if (!existData || existData.length === 0) {
                client.from('prices').insert([{
                  category: 'system',
                  item_name: 'upi_details',
                  price: 0,
                  icon: packed,
                  service_type: 'system'
                }]).then(() => {
                  triggerNotification('✅ UPI Settings Saved to Database!');
                });
              } else {
                triggerNotification('✅ UPI Settings Saved to Database!');
              }
            });
        });
    } else {
      triggerNotification('✅ UPI Settings Saved Locally!');
    }
  };

  const handleAdminAccess = () => {
    if (adminPin === '9791') {
      setViewMode('dual');
      setAdminPin('');
      triggerNotification('🔓 Admin mode activated successfully!');
    } else if (adminPin === '8888') {
      setViewMode('rider');
      setAdminPin('');
      triggerNotification('🏍️ Rider mode activated successfully!');
    } else {
      alert('Invalid PIN. Use default PIN 9791 (Admin) or 8888 (Rider).');
    }
  };

  // Metrics calculations
  const completedOrders = orders.filter(o => o.status === 'Delivered');
  const totalRevenue = orders.filter(o => o.paymentStatus === 'Paid').reduce((acc, o) => acc + o.total, 0);

  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addMoneyAmount, setAddMoneyAmount] = useState('');

  const handleRescheduleOrder = () => {
    if (!selectedOrderForTracking) return;
    if (!rescheduleDate || !rescheduleTime) {
      alert("Please select a new date and time slot.");
      return;
    }

    fetch(`${API_URL}/orders/${selectedOrderForTracking.id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickupDate: rescheduleDate, pickupTime: rescheduleTime })
    })
      .then(res => res.json())
      .then(updated => {
        setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
        setSelectedOrderForTracking(prev => prev ? { ...prev, ...updated } : null);
        setShowRescheduleModal(false);
        triggerNotification(`🔔 Order ${updated.id} rescheduled to ${updated.pickupDate}`);
      })
      .catch(err => alert('Failed to reschedule order: ' + err.message));
  };

  const handleCancelOrder = () => {
    if (!selectedOrderForTracking) return;
    if (!cancelReasonInput.trim()) {
      alert("Please provide a reason for cancellation.");
      return;
    }

    const paymentStatusUpdate = selectedOrderForTracking.paymentStatus === 'Pending' ? 'Cancelled' : selectedOrderForTracking.paymentStatus;
    fetch(`${API_URL}/orders/${selectedOrderForTracking.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'Cancelled', 
        cancelReason: cancelReasonInput,
        paymentStatus: paymentStatusUpdate
      })
    })
      .then(res => res.json())
      .then(updated => {
        setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
        setSelectedOrderForTracking(prev => prev ? { ...prev, ...updated } : null);
        setShowCancelModal(false);
        setCancelReasonInput('');
        triggerNotification(`🔔 Order ${updated.id} has been Cancelled.`);
      })
      .catch(err => alert('Failed to cancel order: ' + err.message));
  };
  
  const [newAddressLabel, setNewAddressLabel] = useState('Home');
  const [newAddressText, setNewAddressText] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);


  const [checkoutAddAmount, setCheckoutAddAmount] = useState('');

  const handleAddFunds = async () => {
    if (!currentCustomer) return;
    const amount = parseInt(addMoneyAmount);
    if (!amount || amount <= 0) return;

    try {
      const res = await fetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR' })
      });
      const gatewayOrderData = await res.json();
      
      if (gatewayOrderData.liveMode) {
        const options = {
          key: gatewayOrderData.keyId,
          amount: gatewayOrderData.amount * 100, // paise
          currency: gatewayOrderData.currency,
          name: "Iron Kart Wallet",
          description: "Wallet Top-up",
          order_id: gatewayOrderData.gatewayOrderId,
          handler: function (response: any) {
            console.log("Razorpay Success Transaction ID:", response.razorpay_payment_id);
            const newBalance = (currentCustomer.walletBalance || 0) + amount;
            const updated = { ...currentCustomer, walletBalance: newBalance };
            setCurrentCustomer(updated);
            fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated)
            });
            alert(`₹${amount} added to wallet successfully!`);
            setShowAddMoney(false);
            setAddMoneyAmount('');
          },
          prefill: {
            name: currentCustomer.name || '',
            contact: currentCustomer.phone || ''
          },
          theme: { color: "#F43F5E" }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        const newBalance = (currentCustomer.walletBalance || 0) + amount;
        const updated = { ...currentCustomer, walletBalance: newBalance };
        setCurrentCustomer(updated);
        fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        alert(`Demo Mode: ₹${amount} added to wallet!`);
        setShowAddMoney(false);
        setAddMoneyAmount('');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to initialize payment gateway.');
    }
  };

  const handleCheckoutAddFunds = async () => {
    if (!currentCustomer) return;
    const amount = parseInt(checkoutAddAmount);
    if (!amount || amount <= 0) return;

    try {
      const res = await fetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR' })
      });
      const gatewayOrderData = await res.json();
      
      if (gatewayOrderData.liveMode) {
        const options = {
          key: gatewayOrderData.keyId,
          amount: gatewayOrderData.amount * 100, // paise
          currency: gatewayOrderData.currency,
          name: "Iron Kart Wallet",
          description: "Wallet Top-up",
          order_id: gatewayOrderData.gatewayOrderId,
          handler: function (response: any) {
            console.log("Razorpay Success Transaction ID:", response.razorpay_payment_id);
            const newBalance = (currentCustomer.walletBalance || 0) + amount;
            const updated = { ...currentCustomer, walletBalance: newBalance };
            setCurrentCustomer(updated);
            fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated)
            });
            alert(`₹${amount} added to wallet successfully!`);
            setCheckoutAddAmount('');
          },
          prefill: {
            name: currentCustomer.name || '',
            contact: currentCustomer.phone || ''
          },
          theme: { color: "#F43F5E" }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        const newBalance = (currentCustomer.walletBalance || 0) + amount;
        const updated = { ...currentCustomer, walletBalance: newBalance };
        setCurrentCustomer(updated);
        fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        alert(`Demo Mode: ₹${amount} added to wallet!`);
        setCheckoutAddAmount('');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to initialize payment gateway.');
    }
  };

  const handleAddAddress = () => {
    if (!currentCustomer || !newAddressText.trim()) return;
    const newAddr: AddressInfo = { id: Date.now().toString(), label: newAddressLabel, fullAddress: newAddressText };
    const addresses = currentCustomer.addresses ? [...currentCustomer.addresses, newAddr] : [newAddr];
    const updated = { ...currentCustomer, addresses };
    setCurrentCustomer(updated);
    
    fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setNewAddressLabel('Home');
    setNewAddressText('');
    setShowAddAddress(false);
    setOrderAddress(newAddressText);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      
      {/* Simulation Banner Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-bounce">
          <div className="bg-emerald-600 text-white rounded-xl shadow-2xl p-4 border border-emerald-400 flex items-start gap-3">
            <Bell className="size-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs font-semibold leading-relaxed">{notification}</div>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <header className={`border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between shadow-md relative ${viewMode === 'customer' && currentCustomer ? 'pb-3' : ''}`}>
        {viewMode === 'customer' && currentCustomer ? (
          <>
            <div className="flex items-start gap-2 max-w-[80%]">
              <div className="mt-1 bg-rose-500/20 p-1.5 rounded-full">
                <MapPin className="size-4 text-rose-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1">
                  Home <ChevronRight className="size-3 text-gray-400" />
                </span>
                <span className="text-[11px] text-gray-500 truncate mt-0.5">
                  {currentCustomer.apartmentNo}, {currentCustomer.address}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="bg-gray-50 border border-gray-200 p-2 rounded-full relative flex items-center justify-center"
                >
                  <Bell className="size-4 text-gray-700" />
                  {orders.some(o => o.customerPhone === currentCustomer.phone && o.status !== 'Placed') && (
                    <div className="absolute top-0 right-0 size-2 bg-rose-500 rounded-full border border-white animate-pulse"></div>
                  )}
                </button>
                
                {showNotifications && (
                  <div className="absolute top-12 right-0 w-64 bg-gray-50 border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-widest">Notifications</span>
                      <button onClick={() => setShowNotifications(false)}><X className="size-3 text-gray-400" /></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {orders.filter(o => o.customerPhone === currentCustomer.phone).length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">No notifications yet.</div>
                      ) : (
                        orders.filter(o => o.customerPhone === currentCustomer.phone).slice(0, 5).map(o => (
                          <div key={o.id} className="p-3 border-b border-gray-200/80 hover:bg-gray-100 cursor-default">
                            <div className="text-[10px] text-gray-500 mb-0.5">Order {o.id.split('-')[0]}</div>
                            <div className="text-xs font-medium text-gray-900">Status updated to: <span className="text-rose-400">{o.status}</span></div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to log out?')) {
                    setCurrentCustomer(null);
                    localStorage.removeItem('iron_current_user');
                    setCustomerActiveTab('home');
                  }
                }}
                className="bg-gray-50 border border-gray-200 p-2 rounded-full text-rose-500 hover:bg-rose-50 hover:border-rose-350 transition-all flex items-center justify-center"
                title="Logout"
              >
                <LogOut className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 shadow-md">
              <span className="font-extrabold text-gray-900 text-lg tracking-wider">IK</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 m-0 p-0 text-left">Iron Kart</h1>
              <p className="text-xs text-gray-500 text-left">Professional Ironing & Pickup Service</p>
            </div>
          </div>
        )}

        {/* View toggles visible only when in Dual/Admin Mode to return to Customer mode */}
        {viewMode !== 'customer' && (
          <button 
            onClick={() => setViewMode('customer')}
            className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Smartphone className="size-3.5" /> Exit Admin View
          </button>
        )}
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex p-6 gap-6 justify-center max-w-7xl mx-auto w-full">
        
        {/* --- 1. CUSTOMER & RIDER MOBILE APP VIEW --- */}
        {['customer', 'dual', 'rider'].includes(viewMode) && (
          <div className="flex-1 max-w-[400px] flex flex-col items-center">
            
            {/* Phone shell container */}
            <div className="w-full aspect-[9/19.5] border-8 border-gray-200 bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden relative border-t-[12px] border-b-[12px]">
              
              {/* Camera Notch simulation */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-gray-100 rounded-full z-20"></div>

              {/* Inside Mobile App Viewport */}
              <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto px-4 pt-8 pb-4">
                
                {/* Rider Portal View */}
                {viewMode === 'rider' ? (
                  <div className="flex-1 flex flex-col gap-4 text-gray-900">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                      <div>
                        <h2 className="text-xl font-bold">Rider Portal</h2>
                        <p className="text-xs text-amber-400">Delivery Dashboard</p>
                      </div>
                      <button 
                        onClick={() => setViewMode('customer')}
                        className="bg-gray-200 p-2 rounded-full hover:bg-gray-300"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pb-10">
                      {orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).length === 0 ? (
                        <div className="text-center text-gray-400 py-10 text-sm">No active tasks today. Relax!</div>
                      ) : (
                        orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).map(order => (
                          <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">{order.id}</span>
                                <h4 className="font-semibold text-sm mt-1">{order.customerName}</h4>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Phone className="size-3" /> {order.customerPhone}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold">{order.status}</span>
                                <div className="text-xs font-bold mt-1 text-emerald-400">₹{order.total}</div>
                              </div>
                            </div>

                            <div className="bg-gray-50 p-2.5 rounded-xl flex items-center gap-2">
                              <MapPin className="size-4 text-rose-500 shrink-0" />
                              <div className="text-xs text-gray-700 truncate">{order.apartmentNo}, {order.address}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.apartmentNo + ', ' + order.address)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1"
                              >
                                <Navigation className="size-3.5" /> Navigate
                              </a>
                              <a 
                                href={`tel:${order.customerPhone}`}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1"
                              >
                                <Phone className="size-3.5" /> Call
                              </a>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-1 border-t border-gray-200 pt-3">
                              <button 
                                onClick={() => updateOrderStatus(order.id, 'Picked Up')}
                                disabled={['Picked Up', 'In Progress', 'Out for Delivery'].includes(order.status)}
                                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-30 disabled:pointer-events-none text-white text-[10px] font-bold py-2 rounded-xl uppercase tracking-wide"
                              >
                                Mark Picked
                              </button>
                              <button 
                                onClick={() => updateOrderStatus(order.id, 'Delivered')}
                                disabled={order.status === 'Delivered'}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 rounded-xl uppercase tracking-wide"
                              >
                                Mark Delivered
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : !currentCustomer ? (
                  <div className="flex-1 flex flex-col justify-center gap-6">
                    <div className="text-center flex flex-col items-center gap-2">
                      <div className="size-20 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-lg relative overflow-hidden mb-3 animate-pulse">
                        <span className="text-white font-black text-2xl tracking-wider select-none">IK</span>
                        <div className="absolute -bottom-2 -right-2 size-8 bg-white/20 rounded-full blur-md"></div>
                      </div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Iron Kart</h2>
                      <p className="text-xs font-bold text-rose-500 bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent mt-1">
                        Perfect Creases, Zero Effort. Freshness Delivered.
                      </p>
                    </div>

                    {authStep === 'login' && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5 text-left">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Mobile Number</label>
                          <div className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl px-3 py-2">
                            <span className="text-gray-400 text-sm font-semibold">+91</span>
                            <input 
                              type="tel"
                              value={authPhone}
                              onChange={e => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0,10))}
                              autoComplete="off"
                              className="bg-transparent text-sm text-gray-900 w-full outline-none"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={handleSendOTP}
                          className="w-full bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md active:translate-y-0.5"
                        >
                          Send OTP Verification
                        </button>
                        <div id="recaptcha-container"></div>
                        
                        {/* Owner Admin Gateway Switcher */}
                        <div className="mt-8 border-t border-gray-200 pt-5 text-left">
                          <h4 className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5">
                            <Key className="size-3 text-amber-500" />
                            System Portal (Admin/Rider)
                          </h4>
                          <div className="flex gap-2 mt-2">
                            <input 
                              type="password"
                              maxLength={4}
                              value={adminPin}
                              onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))}
                              autoComplete="new-password"
                              className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 w-20 text-center outline-none"
                            />
                            <button 
                              onClick={handleAdminAccess}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg"
                            >
                              Login
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {authStep === 'otp' && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5 text-left">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Enter Verification OTP</label>
                          <input 
                            type="password"
                            maxLength={6}
                            value={authOTP}
                            onChange={e => setAuthOTP(e.target.value.replace(/\D/g, ''))}
                            autoComplete="one-time-code"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-center text-lg font-bold tracking-widest text-gray-900 outline-none"
                          />
                        </div>
                        <button 
                          onClick={handleVerifyOTP}
                          className="w-full bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md active:translate-y-0.5"
                        >
                          Verify & Continue
                        </button>
                        <div className="flex justify-end items-center text-xs text-gray-500 mt-1">
                          <button onClick={() => setAuthStep('login')} className="text-rose-500 hover:underline">Change Number</button>
                        </div>
                      </div>
                    )}

                    {authStep === 'register' && (
                      <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                        <h3 className="text-sm font-bold text-gray-900 text-left">Setup New Account</h3>
                        <div className="flex flex-col gap-1 text-left mt-1">
                          <label className="text-[9px] font-semibold text-gray-500 uppercase">Full Name</label>
                          <input 
                            type="text"
                            value={authName}
                            onChange={e => setAuthName(e.target.value)}
                            autoComplete="off"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-semibold text-gray-500 uppercase">Apartment / Flat Number</label>
                          <input 
                            type="text"
                            value={authApartment}
                            onChange={e => setAuthApartment(e.target.value)}
                            autoComplete="off"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-semibold text-gray-500 uppercase">Street Address / Landmark</label>
                          <textarea 
                            value={authAddress}
                            onChange={e => setAuthAddress(e.target.value)}
                            autoComplete="off"
                            rows={3}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-semibold text-gray-500 uppercase">Referral Code (Optional)</label>
                          <input 
                            type="text"
                            value={authReferredBy}
                            onChange={e => setAuthReferredBy(e.target.value)}
                            autoComplete="off"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-rose-500 uppercase"
                          />
                        </div>
                        <button 
                          onClick={handleRegister}
                          className="w-full bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md mt-2"
                        >
                          Complete Sign Up
                        </button>
                      </div>
                    )}

                  </div>
                ) : (
                  // --- Active Customer Screens ---
                  <div className="flex-1 flex flex-col justify-between">
                    
                    {/* Customer Top App Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
                      {customerActiveTab === 'home' ? (
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {currentCustomer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <div className="text-[10px] text-rose-300 font-bold tracking-wide uppercase">Warm Welcome Back</div>
                            <div className="text-sm font-black text-gray-900 max-w-[160px] truncate">{currentCustomer.name}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => setCustomerActiveTab('home')} 
                            className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 hover:text-rose-500 transition-colors"
                          >
                            <ArrowLeft className="size-4" />
                          </button>
                          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                            {customerActiveTab === 'order' ? 'Place Order' : 
                             customerActiveTab === 'prices' ? 'Pricing' :
                             customerActiveTab === 'history' ? 'My Orders' : 
                             customerActiveTab === 'notifications' ? 'Notifications' : 'Support'}
                          </h2>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCustomerActiveTab('notifications')} className="text-gray-400 hover:text-rose-500 p-2 rounded-lg bg-gray-50 border border-gray-200 relative">
                          <Bell className="size-4" />
                          {orders.filter(o => o.customerPhone === currentCustomer?.phone && o.status !== 'Delivered').length > 0 && (
                            <span className="absolute top-1.5 right-1.5 size-2 bg-rose-500 rounded-full animate-pulse"></span>
                          )}
                        </button>
                        <button onClick={handleLogout} className="text-gray-400 hover:text-rose-500 p-2 rounded-lg bg-gray-50 border border-gray-200">
                          <LogOut className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Customer Screen Switcher */}
                    <div className="flex-1 flex flex-col overflow-y-auto">
                      
                      {/* HOME TAB */}
                      {customerActiveTab === 'home' && (
                        <div className="flex flex-col gap-4">
                          
                          {/* Top Scrolling Marquee */}
                          <div className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[9px] font-extrabold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm">
                            <span className="animate-pulse">⚡ FLASH OFFER: Get 35% off on Gold Prime subscription this week!</span>
                          </div>

                          {/* Welcome User Greeting */}
                          <div className="text-left mt-1">
                            <h3 className="text-sm font-extrabold text-gray-900">Hello, {currentCustomer?.name || 'Friend'}! 👋</h3>
                            <p className="text-[10px] text-gray-500 mt-0.5">Ready to make your wardrobe look fresh and perfectly pressed? ✨</p>
                          </div>
                          
                          {/* Promotional Slide Banner */}
                          <div className="bg-gradient-to-r from-rose-600 to-amber-500 rounded-2xl p-0 text-left shadow-lg relative overflow-hidden h-32 flex items-center justify-center">
                            <img src="https://images.unsplash.com/photo-1517677129300-07b130802f46?w=800&h=400&fit=crop" alt="Hero Banner" className="w-full h-full object-cover opacity-90 mix-blend-overlay absolute inset-0" />
                            <div className="relative z-10 px-4 w-full">
                              <h4 className="font-extrabold text-sm text-gray-900 drop-shadow-md">Premium Garment Pressing</h4>
                              <p className="text-[10px] text-gray-900/90 mt-1 max-w-[200px] drop-shadow-md">Get 50% off on your first order. Professional steam care starts at just ₹12/item.</p>
                              <span className="inline-block bg-white text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded-full mt-2.5 shadow-sm">Code: WELCOME50</span>
                            </div>
                          </div>

                          {/* Wallet Section */}
                          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">💳</span>
                                <span className="text-sm font-bold text-gray-900">Iron Kart Wallet</span>
                              </div>
                              <span className="text-lg font-black text-emerald-400">₹{currentCustomer?.walletBalance || 0}</span>
                            </div>
                            
                            {showAddMoney ? (
                              <div className="flex gap-2">
                                <input 
                                  type="number"
                                  value={addMoneyAmount}
                                  onChange={e => setAddMoneyAmount(e.target.value)}
                                  placeholder="Amount (₹)"
                                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 outline-none"
                                />
                                <button onClick={handleAddFunds} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors">Add</button>
                                <button onClick={() => setShowAddMoney(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-2 rounded-lg text-xs font-bold transition-colors">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setShowAddMoney(true)} className="w-full bg-gray-50 hover:bg-gray-200 border border-gray-200 text-emerald-400 text-xs font-bold py-2 rounded-lg transition-colors">
                                + Add Money to Wallet
                              </button>
                            )}
                          </div>

                          {/* Services Grid */}
                          <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={() => setCustomerActiveTab('order')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-rose-500 transition-all text-center relative overflow-hidden"
                            >
                              <div className="size-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                                <Plus className="size-4" />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-900">Ironing</span>
                            </button>
                            <button 
                              onClick={() => triggerNotification('✨ Dry Cleaning service is launching very soon! Stay tuned!')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl opacity-70 hover:opacity-100 transition-all text-center relative"
                            >
                              <span className="absolute top-1 right-1 text-[7px] bg-amber-500 text-black font-bold px-1 rounded-sm">SOON</span>
                              <div className="size-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <Star className="size-4" />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-700">Dry Clean</span>
                            </button>
                            <button 
                              onClick={() => triggerNotification('💧 Laundry service is launching very soon! Stay tuned!')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl opacity-70 hover:opacity-100 transition-all text-center relative"
                            >
                              <span className="absolute top-1 right-1 text-[7px] bg-amber-500 text-black font-bold px-1 rounded-sm">SOON</span>
                              <div className="size-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <RefreshCw className="size-4" />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-700">Laundry</span>
                            </button>
                          </div>

                          {/* Quick Actions Grid */}
                          <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={() => setCustomerActiveTab('history')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-amber-500 transition-all text-center"
                            >
                              <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <ShoppingBag className="size-4" />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-900">My Orders</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('prices')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 transition-all text-center"
                            >
                              <div className="size-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <FileText className="size-4" />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-900">Price List</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('support')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-emerald-500 transition-all text-center"
                            >
                              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <HelpCircle className="size-4" />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-900">Support</span>
                            </button>
                          </div>

                          {/* Refer & Earn Banner */}
                          <div 
                            onClick={() => setCustomerActiveTab('rewards')}
                            className="bg-gradient-to-r from-rose-500 to-amber-500 rounded-xl p-4 cursor-pointer text-left relative overflow-hidden shadow-lg mt-1"
                          >
                            <div className="relative z-10">
                              <h3 className="text-gray-900 font-black text-sm tracking-wide">REFER & EARN ₹50</h3>
                              <p className="text-gray-900/80 text-[10px] mt-0.5">Invite friends and you both get ₹50 off!</p>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-20">
                              <Gift className="size-20" />
                            </div>
                          </div>

                          {/* Quick Tracker shortcut */}
                          {orders.filter(o => o.customerPhone === currentCustomer.phone).length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-left">
                              <div className="flex justify-between items-center pb-2 border-b border-gray-200 mb-3">
                                <span className="text-xs font-bold text-gray-900">Active Order</span>
                                <span className="text-[10px] text-gray-400">
                                  {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].id}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold text-rose-500">
                                    Status: {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].status}
                                  </div>
                                  <div className="text-[10px] text-gray-500 mt-1">
                                    Pickup: {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].pickupDate}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setSelectedOrderForTracking(orders.filter(o => o.customerPhone === currentCustomer.phone)[0]);
                                    setCustomerActiveTab('history');
                                  }}
                                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold"
                                >
                                  Track <ChevronRight className="size-3" />
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      )}



                      {/* REWARDS TAB */}
                      {customerActiveTab === 'rewards' && (
                        <div className="flex flex-col gap-4 text-left max-h-[500px] overflow-y-auto pb-6 pr-1">
                          
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => setCustomerActiveTab('home')} className="p-1 hover:bg-gray-200 rounded-lg">
                              <ArrowLeft className="size-4 text-gray-500" />
                            </button>
                            <h3 className="text-sm font-bold text-gray-900">Refer & Earn</h3>
                          </div>
                          
                          {/* Header Graphic */}
                          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 rounded-[24px] p-6 border border-gray-300/50 shadow-xl flex flex-col items-center justify-center text-center mt-1 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
                            
                            <div className="size-16 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 mb-3 relative z-10">
                              <Gift className="size-8 text-gray-900" />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 relative z-10 tracking-tight">Refer & Earn ₹50</h2>
                            <p className="text-xs text-gray-500 mt-2 relative z-10 max-w-[250px] leading-relaxed">
                              Invite your friends to Iron Kart. When they complete their first order, you <strong className="text-rose-400">both get ₹50</strong> added to your wallets!
                            </p>
                          </div>

                          {/* Code Display */}
                          <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-2 flex flex-col items-center shadow-sm">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Your Unique Code</span>
                            <div className="bg-gray-50 border-2 border-dashed border-rose-500/30 text-rose-500 font-mono text-2xl font-black px-6 py-3 rounded-xl tracking-[0.2em] w-full text-center select-all">
                              {currentCustomer.referralCode || 'IRON-NEW'}
                            </div>
                            
                            <button 
                              onClick={() => {
                                const text = `Hey! Use my code ${currentCustomer.referralCode || 'IRON-NEW'} to get ₹50 off your first Iron Kart ironing & laundry order! 🧺✨\nDownload the app and sign up now!`;
                                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                                window.open(whatsappUrl, '_blank');
                              }}
                              className="w-full bg-\[#25D366\] hover:bg-[#1ebd5a] text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-4 shadow-md transition-all"
                            >
                              Share via WhatsApp
                            </button>
                          </div>
                          
                          {/* How it works */}
                          <div className="mt-2">
                            <h3 className="text-xs font-bold text-gray-700 mb-3 ml-1">How it works</h3>
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-200/80">
                                <div className="size-8 rounded-full bg-gray-200 flex items-center justify-center font-black text-xs text-gray-500">1</div>
                                <p className="text-[11px] text-gray-500 leading-snug flex-1">Share your unique code with friends.</p>
                              </div>
                              <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-200/80">
                                <div className="size-8 rounded-full bg-gray-200 flex items-center justify-center font-black text-xs text-gray-500">2</div>
                                <p className="text-[11px] text-gray-500 leading-snug flex-1">They sign up and enter your code during registration.</p>
                              </div>
                              <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-200/80">
                                <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center font-black text-xs text-emerald-500">3</div>
                                <p className="text-[11px] text-gray-700 leading-snug flex-1">You <strong className="text-emerald-400">both get ₹50</strong> in your wallet when their first order is delivered!</p>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}

                      {customerActiveTab === 'notifications' && (
                        <div className="flex flex-col gap-4 text-left">
                          <h3 className="text-sm font-bold text-gray-700">Order Updates & Notifications</h3>
                          {orders.filter(o => o.customerPhone === currentCustomer?.phone).length === 0 ? (
                            <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-gray-200">
                              <Bell className="size-8 text-slate-600 mx-auto mb-3" />
                              <p className="text-xs text-gray-500">No notifications yet.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {orders.filter(o => o.customerPhone === currentCustomer?.phone).map(order => (
                                <div key={order.id} className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex gap-3 items-start">
                                  <div className="size-8 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                                    <Bell className="size-4 text-rose-500" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-xs font-bold text-gray-900">Order {order.id}</span>
                                      <span className="text-[9px] text-gray-400">{order.createdAt}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                      Status updated to <strong className="text-rose-400">{order.status}</strong>. 
                                      {order.status === 'Delivered' ? ' Thank you for choosing Iron Kart!' : ' We are working on it.'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* PLACE ORDER TAB */}
                      {customerActiveTab === 'order' && (
                        <div className="flex flex-col gap-4 text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => setCustomerActiveTab('home')} className="p-1 hover:bg-gray-200 rounded-lg">
                              <ArrowLeft className="size-4 text-gray-500" />
                            </button>
                            <h3 className="text-sm font-bold text-gray-900">Schedule Ironing Pickup</h3>
                          </div>

                          {/* Address Details Card */}
                          <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs flex flex-col gap-2">
                            <div className="font-bold text-gray-900 flex items-center justify-between">
                              <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-rose-500" /> Pickup Details</span>
                              <span className="text-[9px] text-gray-400 font-normal">Editable</span>
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-gray-500 uppercase">Customer Name</label>
                                <input 
                                  type="text" 
                                  value={orderName} 
                                  onChange={e => setOrderName(e.target.value)}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-gray-500 uppercase">Phone Number</label>
                                <input 
                                  type="text" 
                                  value={orderPhone} 
                                  onChange={e => setOrderPhone(e.target.value)}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-bold text-gray-500 uppercase">Select Address</label>
                                
                                {currentCustomer?.addresses?.map(addr => (
                                  <div 
                                    key={addr.id}
                                    onClick={() => setOrderAddress(addr.fullAddress)}
                                    className={`p-2 border rounded-lg cursor-pointer flex justify-between items-center ${orderAddress === addr.fullAddress ? 'border-rose-500 bg-rose-500/10' : 'border-gray-200 bg-gray-50'}`}
                                  >
                                    <div>
                                      <div className="text-xs font-bold text-gray-900">{addr.label}</div>
                                      <div className="text-[10px] text-gray-500 truncate w-48">{addr.fullAddress}</div>
                                    </div>
                                    {orderAddress === addr.fullAddress && <div className="size-2 rounded-full bg-rose-500" />}
                                  </div>
                                ))}

                                {showAddAddress ? (
                                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mt-2">
                                    <input 
                                      type="text"
                                      value={newAddressLabel}
                                      onChange={e => setNewAddressLabel(e.target.value)}
                                      placeholder="e.g. Home, Office"
                                      className="w-full bg-white border border-gray-200 rounded px-2 py-1 mb-2 text-xs text-gray-900 outline-none focus:border-rose-500"
                                    />
                                    <textarea 
                                      value={newAddressText}
                                      onChange={e => setNewAddressText(e.target.value)}
                                      placeholder="Full Address Details..."
                                      className="w-full bg-white border border-gray-200 rounded px-2 py-1 mb-2 text-xs text-gray-900 outline-none focus:border-rose-500 resize-none h-16"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={handleAddAddress} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold py-1.5 rounded transition-colors">Save Address</button>
                                      <button onClick={() => setShowAddAddress(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 text-[10px] font-bold py-1.5 rounded transition-colors">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setShowAddAddress(true)}
                                    className="border border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-200 text-gray-500 text-xs py-2 rounded-lg transition-colors mt-1"
                                  >
                                    + Add New Address
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Iztri-Style Service Selection Carousel */}
                          <div className="flex flex-col gap-2 mt-2">
                            <div className="flex justify-between items-end">
                              <label className="text-[11px] font-bold text-gray-900 tracking-wide">Select Service</label>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-hide -mx-2 px-2 snap-x">
                              {[
                                {name: 'Ironing', desc: 'Crisp, wrinkle-free pressing', img: '/ironing_icon.png'},
                                {name: 'Dry Cleaning', desc: 'Deep chemical cleaning for delicate fabrics', img: 'https://images.unsplash.com/photo-1616423640778-28d1b53229bd?w=400&h=300&fit=crop'},
                                {name: 'Laundry', desc: 'Everyday wash, dry, and fold', img: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400&h=300&fit=crop'}
                              ].map(svc => (
                                <button 
                                  key={svc.name}
                                  onClick={() => setSelectedService(svc.name as any)}
                                  className={`snap-center shrink-0 w-[220px] rounded-2xl border transition-all text-left flex flex-col overflow-hidden relative ${selectedService === svc.name ? 'bg-gray-50 border-rose-500 ring-2 ring-rose-500 shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                                >
                                  <div className="h-[120px] w-full bg-gray-50 relative">
                                    <img src={svc.img} alt={svc.name} className={`w-full h-full object-cover transition-all duration-500 ${selectedService === svc.name ? 'opacity-100 scale-105' : 'opacity-60 grayscale-[30%]'}`} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                                  </div>
                                  <div className="p-1.5 absolute bottom-0 left-0 right-0">
                                    <h4 className={`text-sm font-extrabold ${selectedService === svc.name ? 'text-gray-900' : 'text-gray-700'}`}>{svc.name}</h4>
                                    <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{svc.desc}</p>
                                  </div>
                                  {selectedService === svc.name && (
                                    <div className="absolute top-3 right-3 bg-rose-500 rounded-full p-1 shadow-md">
                                      <Check className="size-3 text-gray-900" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Iztri-Style Pickup schedule */}
                          <div className="flex flex-col gap-3 mt-4">
                            <label className="text-[11px] font-bold text-gray-900 tracking-wide">Select Pickup Date</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                              {availableDates.map(d => (
                                <button
                                  key={d.value}
                                  onClick={() => setPickupDate(d.value)}
                                  className={`flex flex-col items-center justify-center min-w-[65px] py-2 rounded-2xl border transition-all ${
                                    pickupDate === d.value 
                                    ? 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-500 shadow-[0_4px_12px_rgba(225,29,72,0.3)]' 
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-900'
                                  }`}
                                >
                                  <span className={`text-[10px] font-medium ${pickupDate === d.value ? 'text-rose-100' : ''}`}>{d.label}</span>
                                  <span className={`text-lg font-bold mt-0.5 ${pickupDate === d.value ? 'text-gray-900' : ''}`}>{d.dateNum}</span>
                                </button>
                              ))}
                            </div>
                            
                            <label className="text-[11px] font-bold text-gray-900 tracking-wide mt-2">Select Pickup Slot</label>
                            <div className="grid grid-cols-2 gap-2">
                              {['09:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 - 21:00'].map(slot => (
                                <button
                                  key={slot}
                                  onClick={() => setPickupTime(slot)}
                                  className={`flex items-center justify-center py-2.5 rounded-xl border text-xs font-medium transition-all ${
                                    pickupTime === slot
                                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}
                                >
                                  <Clock className={`size-3.5 mr-2 ${pickupTime === slot ? 'text-rose-400' : 'text-gray-400'}`} />
                                  {slot === '09:00 - 12:00' ? '09 AM - 12 PM' :
                                   slot === '12:00 - 15:00' ? '12 PM - 03 PM' :
                                   slot === '15:00 - 18:00' ? '03 PM - 06 PM' : '06 PM - 09 PM'}
                                </button>
                              ))}
                            </div>
                            
                            
                          </div>

                          {/* Garment Categorized Selection */}
                          <div className="flex flex-col gap-2 mt-2">

                            <div className="flex overflow-x-auto scrollbar-hide pb-3 -mx-2 px-2 gap-3 border-b border-gray-200">
                              {[
                                { name: 'Light Weight', img: 'https://images.unsplash.com/photo-1517677129300-07b130802f46?w=400&h=300&fit=crop' },
                                { name: 'Medium/Heavy', img: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400&h=300&fit=crop' },
                                { name: 'Premium', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop' },
                                { name: 'Household', img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop' }
                              ].map(cat => (
                                <button
                                  key={cat.name}
                                  onClick={() => setActiveCategory(cat.name)}
                                  className={`relative shrink-0 w-[120px] h-[80px] rounded-2xl overflow-hidden transition-all shadow-sm ${
                                    activeCategory === cat.name 
                                    ? 'ring-2 ring-rose-500 ring-offset-2 scale-105 shadow-[0_4px_12px_rgba(225,29,72,0.3)]' 
                                    : 'opacity-70 hover:opacity-100 grayscale-[40%] hover:grayscale-0'
                                  }`}
                                >
                                  <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                                  <div className="absolute bottom-2 left-0 right-0 text-center">
                                    <span className="text-[10px] font-bold text-white tracking-wide uppercase drop-shadow-md">{cat.name}</span>
                                  </div>
                                  {activeCategory === cat.name && (
                                    <div className="absolute top-1 right-1 bg-rose-500 rounded-full p-0.5 shadow-md">
                                      <Check className="size-2.5 text-white" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>

                            
                            <div className="max-h-[200px] overflow-y-auto flex flex-col gap-2 pr-1 mt-1">
                              {priceList
                                .filter(item => item.serviceType === selectedService && item.category === activeCategory)
                                .map(item => {
                                  const key = `${item.serviceType}-${item.name}`;
                                  const qty = selectedItems[key] || 0;
                                  return (
                                    <div key={key} className={`flex justify-between items-center bg-white p-3 rounded-xl border transition-all ${qty > 0 ? 'border-rose-500/50 shadow-[0_2px_8px_rgba(225,29,72,0.15)]' : 'border-gray-200'}`}>
                                      <div>
                                        <div className="text-xs font-bold text-gray-900">{item.name}</div>
                                        <div className="text-[10px] text-rose-400 mt-0.5 font-semibold">₹{item.price} / pc</div>
                                      </div>
                                      <div className="flex items-center gap-3 bg-gray-50 rounded-full p-1 border border-gray-200 shadow-inner">
                                        <button 
                                          onClick={() => setSelectedItems(prev => ({ ...prev, [key]: Math.max(0, qty - 1) }))}
                                          className={`size-6 rounded-full flex items-center justify-center transition-all ${qty > 0 ? 'bg-gray-200 text-gray-900 hover:bg-gray-300' : 'text-slate-600 pointer-events-none'}`}
                                        >
                                          <Minus className="size-3" />
                                        </button>
                                        <span className="text-xs font-extrabold text-gray-900 min-w-[12px] text-center">{qty}</span>
                                        <button 
                                          onClick={() => setSelectedItems(prev => ({ ...prev, [key]: qty + 1 }))}
                                          className="size-6 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-sm hover:scale-105 transition-all"
                                        >
                                          <Plus className="size-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Special Instructions */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-gray-500 uppercase">Special Instructions</label>
                            <input 
                              type="text"
                              value={specialInstructions}
                              onChange={e => setSpecialInstructions(e.target.value)}
                              placeholder="starch saree, crease shirt sleeves"
                              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none"
                            />
                          </div>

                          {/* Coupon Code */}
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={couponCode}
                              onChange={e => setCouponCode(e.target.value.toUpperCase())}
                              placeholder="Enter Promo Code"
                              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none flex-1 uppercase"
                            />
                            <button 
                              onClick={() => {
                                if (couponCode === 'WELCOME50' || couponCode === 'FIRST10') {
                                  setAppliedCoupon(couponCode);
                                  alert('Coupon Applied!');
                                } else {
                                  alert('Invalid or Expired Coupon');
                                }
                              }}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-2 rounded-xl text-xs font-semibold"
                            >
                              Apply
                            </button>
                          </div>

                          {/* Price calculation summary */}
                          <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-1 text-[10px] text-gray-500">
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span className="font-bold text-gray-900">₹{calculateTotals().subtotal}</span>
                            </div>
                            {calculateTotals().discount > 0 && (
                              <div className="flex justify-between text-emerald-400">
                                <span>Discount ({appliedCoupon})</span>
                                <span className="font-bold">-₹{calculateTotals().discount}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>{orderSpeed} Speed Markup</span>
                              <span className="font-bold text-gray-900">₹{calculateTotals().markup}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>GST (5%)</span>
                              <span className="font-bold text-gray-900">₹{calculateTotals().tax}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 pt-1.5 text-xs font-bold text-rose-500">
                              <span>Estimated Total</span>
                              <span>₹{calculateTotals().total}</span>
                            </div>
                          </div>

                          <button 
                            onClick={handlePlaceOrder}
                            className="w-full bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-xs font-semibold shadow-md active:translate-y-0.5 text-center"
                          >
                            Proceed to Digital Payment
                          </button>
                        </div>
                      )}

                      {/* PRICES TAB */}
                      {customerActiveTab === 'prices' && (
                        <div className="flex flex-col gap-3 text-left">
                          <h3 className="text-sm font-bold text-gray-900">Service Price List</h3>
                          
                          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
                            {priceList.map(item => (
                              <div key={item.name} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200">
                                <div>
                                  <div className="text-xs font-bold text-gray-900">{item.name}</div>
                                  <span className="text-[9px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded">{item.category}</span>
                                </div>
                                <div className="text-sm font-extrabold text-rose-500">₹{item.price}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* MY ORDERS TAB */}
                      {customerActiveTab === 'history' && (
                        <div className="flex flex-col gap-3 text-left">
                          <h3 className="text-sm font-bold text-gray-900">Your Orders</h3>

                          {selectedOrderForTracking ? (
                            <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-200">
                              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                <button onClick={() => setSelectedOrderForTracking(null)} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1">
                                  <ArrowLeft className="size-3" /> Back
                                </button>
                                <span className="text-[10px] font-bold text-rose-500">{selectedOrderForTracking.id}</span>
                              </div>

                              {/* Order Tracking Progress bar */}
                              <div className="flex flex-col gap-4">
                                {[
                                  { label: 'Order Placed', status: 'Placed' },
                                  { label: 'Laundry Picked Up', status: 'Picked Up' },
                                  { label: 'Ironing in Progress', status: 'Ironing' },
                                  { label: 'Ready for Delivery', status: 'Ready' },
                                  { label: 'Order Delivered', status: 'Delivered' }
                                ].map((step, idx) => {
                                  const statuses = ['Placed', 'Picked Up', 'Ironing', 'Ready', 'Delivered'];
                                  const currentIdx = statuses.indexOf(selectedOrderForTracking.status);
                                  const stepIdx = statuses.indexOf(step.status);
                                  const isActive = stepIdx <= currentIdx;
                                  
                                  return (
                                    <div key={step.status} className="flex items-center gap-3 relative">
                                      {idx < 4 && (
                                        <div className={`absolute left-2.5 top-6 w-0.5 h-6 ${stepIdx < currentIdx ? 'bg-rose-500' : 'bg-gray-200'}`}></div>
                                      )}
                                      <div className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-rose-500 border-rose-500 text-gray-900 shadow-sm' : 'border-gray-200 text-gray-400'}`}>
                                        {isActive ? <Check className="size-2.5" /> : idx + 1}
                                      </div>
                                      <span className={`text-xs font-semibold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                        {step.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* GPS Tracking UI (Simulated) */}
                              {(selectedOrderForTracking.status === 'Picked Up' || selectedOrderForTracking.status === 'Delivered' || selectedOrderForTracking.status === 'Ready') && (
                                <div className="bg-gray-50 overflow-hidden rounded-xl border border-gray-200 relative h-32 flex flex-col items-center justify-center">
                                  {/* Simulated Map Background */}
                                  <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                  
                                  {/* Animated Path & Marker */}
                                  <div className="relative z-10 w-full px-8 flex items-center justify-between">
                                    <div className="size-6 bg-gray-200 rounded-full border-2 border-gray-300 flex items-center justify-center z-10"><MapPin className="size-3 text-gray-500" /></div>
                                    <div className="flex-1 h-0.5 bg-gray-200 relative overflow-hidden">
                                      <div className={`absolute top-0 left-0 h-full bg-rose-500 transition-all duration-[3000ms] ${selectedOrderForTracking.status === 'Delivered' ? 'w-full' : 'w-1/2 animate-pulse'}`}></div>
                                    </div>
                                    <div className="size-6 bg-emerald-900 rounded-full border-2 border-emerald-500 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(16,185,129,0.5)]"><Check className="size-3 text-emerald-400" /></div>
                                    
                                    {/* Moving Courier Icon */}
                                    <div className={`absolute top-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-lg border border-slate-200 z-20 transition-all duration-[3000ms] ${selectedOrderForTracking.status === 'Delivered' ? 'left-[calc(100%-2.5rem)]' : 'left-1/2 -translate-x-1/2'}`}>
                                      <Navigation className="size-3 text-rose-500" />
                                    </div>
                                  </div>
                                  
                                  <div className="relative z-10 mt-4 text-[10px] font-bold text-gray-700">
                                    {selectedOrderForTracking.status === 'Delivered' ? 'Driver reached destination' : 'Driver is on the way...'}
                                  </div>
                                </div>
                              )}

                              <div className="bg-gray-50/60 p-3 rounded-xl text-[10px] text-gray-500 flex flex-col gap-1 border border-gray-200">
                                <div className="flex justify-between">
                                  <span>Apartment No</span>
                                  <span className="font-bold text-gray-900">{selectedOrderForTracking.apartmentNo}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Pickup slot</span>
                                  <span className="font-bold text-gray-900">{selectedOrderForTracking.pickupDate} ({selectedOrderForTracking.pickupTime})</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Total amount</span>
                                  <span className="font-bold text-gray-900">₹{selectedOrderForTracking.total} ({selectedOrderForTracking.paymentStatus})</span>
                                </div>
                              </div>

                              {selectedOrderForTracking.status === 'Delivered' && (
                                <button 
                                  onClick={() => setSelectedInvoice(selectedOrderForTracking)}
                                  className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-900 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 mt-2"
                                >
                                  <FileText className="size-3.5 text-rose-500" /> View Digital Invoice
                                </button>
                              )}

                              {(selectedOrderForTracking.status === 'Cancelled' || selectedOrderForTracking.status === 'Delivered') && (
                                <button 
                                  onClick={() => {
                                    const itemsToLoad: { [key: string]: number } = {};
                                    selectedOrderForTracking.items.forEach((item: any) => {
                                      itemsToLoad[item.name] = item.qty;
                                    });
                                    setSelectedItems(itemsToLoad);
                                    setCustomerActiveTab('order');
                                    setSelectedOrderForTracking(null);
                                    triggerNotification('🛒 Items from previous order loaded! Ready to checkout.');
                                  }}
                                  className="w-full bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 mt-2 shadow-sm transition-all"
                                >
                                  <RefreshCw className="size-3.5" /> Reorder this Basket
                                </button>
                              )}
                              
                              {selectedOrderForTracking.status === 'Placed' && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <button 
                                    onClick={() => setShowCancelModal(true)}
                                    className="w-full bg-gray-50 hover:bg-rose-950/50 border border-rose-500/30 text-rose-400 hover:text-rose-300 py-2 rounded-xl text-xs font-semibold transition-all"
                                  >
                                    Cancel Order
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setRescheduleDate(selectedOrderForTracking.pickupDate);
                                      setRescheduleTime(selectedOrderForTracking.pickupTime);
                                      setShowRescheduleModal(true);
                                    }}
                                    className="w-full bg-gray-50 hover:bg-gray-200 border border-gray-300 text-gray-900 py-2 rounded-xl text-xs font-semibold transition-all"
                                  >
                                    Reschedule
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3 overflow-y-auto max-h-[380px]">
                              {orders.filter(o => o.customerPhone === currentCustomer.phone).length === 0 ? (
                                <div className="text-center py-10 text-xs text-gray-400">No active orders placed yet.</div>
                              ) : (
                                orders
                                  .filter(o => o.customerPhone === currentCustomer.phone)
                                  .map(o => (
                                    <div 
                                      key={o.id} 
                                      onClick={() => setSelectedOrderForTracking(o)}
                                      className="bg-white p-3 rounded-xl border border-gray-200 hover:border-rose-500/30 transition-all flex items-center justify-between cursor-pointer"
                                    >
                                      <div>
                                        <div className="text-xs font-bold text-gray-900">{o.id}</div>
                                        <div className="text-[9px] text-gray-500 mt-0.5">{o.createdAt}</div>
                                        <div className="text-[10px] font-semibold text-rose-500 mt-1">{o.status}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-xs font-extrabold text-gray-900">₹{o.total}</div>
                                        <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded mt-1 ${o.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                          {o.paymentStatus}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUPPORT & ADMIN GATEWAY TAB */}
                                            {/* SUPPORT & ADMIN GATEWAY TAB */}
                      {customerActiveTab === 'support' && (
                        <div className="flex flex-col gap-4 text-left max-h-[500px] overflow-y-auto pb-6 pr-1">
                          
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => setCustomerActiveTab('home')} className="p-1 hover:bg-gray-200 rounded-lg">
                              <ArrowLeft className="size-4 text-gray-500" />
                            </button>
                            <h3 className="text-sm font-bold text-gray-900">Help & Support</h3>
                          </div>

                          {/* Quick Support Actions */}
                          <div className="grid grid-cols-2 gap-3">
                            <a 
                              href="tel:+919791019505" 
                              className="flex flex-col items-center justify-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center shadow-sm hover:bg-rose-100 transition-colors"
                            >
                              <div className="size-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-600">
                                <Phone className="size-4" strokeWidth={2.5} />
                              </div>
                              <span className="text-[10px] font-bold text-rose-600">Call Us Directly</span>
                              <span className="text-[8px] text-rose-500/80 -mt-1">+91 97910 19505</span>
                            </a>
                            <a 
                              href="https://wa.me/919791019505" 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex flex-col items-center justify-center gap-2 p-4 bg-emerald-50 border border-emerald-250 rounded-2xl text-center shadow-sm hover:bg-emerald-100 transition-colors"
                            >
                              <div className="size-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                                <Truck className="size-4" strokeWidth={2.5} />
                              </div>
                              <span className="text-[10px] font-bold text-emerald-600">Chat with Us</span>
                              <span className="text-[8px] text-emerald-500/80 -mt-1">Active on WhatsApp</span>
                            </a>
                          </div>

                          {/* Detailed Support Categories Accordion */}
                          <div className="bg-white border border-gray-200 p-4 rounded-2xl flex flex-col gap-4 shadow-sm">
                            
                            {/* Garment Quality & Issues */}
                            <div>
                              <h4 className="text-xs font-black text-gray-950 mb-2 flex items-center gap-1.5">👕 Garment & Quality Issues</h4>
                              <div className="flex flex-col gap-2">
                                {[
                                  { q: "What if some of my clothes are missing?", a: "We have strict CCTV tracking at our pressing centers. If an item is verified missing, we immediately resolve it or credit up to 5x the service cost of that garment to your wallet." },
                                  { q: "What if there are quality or crease issues?", a: "We stand by our quality! If you find any poor creases or quality issues, contact us within 24 hours of delivery, and we will collect and re-iron the garments completely free of cost." }
                                ].map((item, idx) => {
                                  const keyIndex = 10 + idx;
                                  return (
                                    <div key={keyIndex} className="border border-gray-155 rounded-xl overflow-hidden">
                                      <button 
                                        onClick={() => setExpandedFaq(expandedFaq === keyIndex ? null : keyIndex)}
                                        className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                                      >
                                        <span>{item.q}</span>
                                        <ChevronRight className={`size-3 text-gray-400 transition-all ${expandedFaq === keyIndex ? 'rotate-90' : ''}`} />
                                      </button>
                                      {expandedFaq === keyIndex && (
                                        <div className="p-2.5 bg-white text-[9px] text-gray-500 leading-relaxed border-t border-gray-100">
                                          {item.a}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Order Tracking */}
                            <div className="border-t border-gray-100 pt-3">
                              <h4 className="text-xs font-black text-gray-950 mb-2 flex items-center gap-1.5">📦 Order Tracking</h4>
                              <div className="border border-gray-155 rounded-xl overflow-hidden">
                                <button 
                                  onClick={() => setExpandedFaq(expandedFaq === 20 ? null : 20)}
                                  className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                                >
                                  <span>Where is my active order?</span>
                                  <ChevronRight className={`size-3 text-gray-400 transition-all ${expandedFaq === 20 ? 'rotate-90' : ''}`} />
                                </button>
                                {expandedFaq === 20 && (
                                  <div className="p-2.5 bg-white text-[9px] text-gray-500 leading-relaxed border-t border-gray-100">
                                    You can track the live progress of your order by going to the "My Orders" tab on the bottom navigation bar and tapping on your active booking.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Payment Problems */}
                            <div className="border-t border-gray-100 pt-3">
                              <h4 className="text-xs font-black text-gray-950 mb-2 flex items-center gap-1.5">💳 Payment Problems</h4>
                              <div className="border border-gray-155 rounded-xl overflow-hidden">
                                <button 
                                  onClick={() => setExpandedFaq(expandedFaq === 30 ? null : 30)}
                                  className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                                >
                                  <span>Transaction failed but money deducted?</span>
                                  <ChevronRight className={`size-3 text-gray-400 transition-all ${expandedFaq === 30 ? 'rotate-90' : ''}`} />
                                </button>
                                {expandedFaq === 30 && (
                                  <div className="p-2.5 bg-white text-[9px] text-gray-500 leading-relaxed border-t border-gray-100">
                                    Do not worry! In case of gateway failures, deducted funds are automatically refunded to your original payment source within 3-5 working days by Razorpay.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* General FAQs */}
                            <div className="border-t border-gray-100 pt-3">
                              <h4 className="text-xs font-black text-gray-950 mb-2 flex items-center gap-1.5">❓ General FAQ</h4>
                              <div className="flex flex-col gap-2">
                                {[
                                  { q: "Pricing & Scheduling", a: "Pricing is transparently listed on the 'Price List' page. You can choose any pickup date and time slot from the scheduling panel during booking." },
                                  { q: "Delivery details", a: "Standard delivery is completed within 24-48 hours. Pickup and delivery are completely free for all orders above ₹150." },
                                  { q: "Cancellations & Rescheduling", a: "You can cancel any placed order directly from 'My Orders' before it is picked up by our rider. Rescheduling is also supported." },
                                  { q: "Garment Care guidelines", a: "We read fabric labels. Delicate fabrics are steam pressed on low temperatures, and household items are sanitized carefully." },
                                  { q: "Wallet & Referral program", a: "Share your unique code in the 'Refer & Earn' tab. Once your friend completes their first order, you both get ₹50 added to your wallets!" }
                                ].map((item, idx) => {
                                  const keyIndex = 40 + idx;
                                  return (
                                    <div key={keyIndex} className="border border-gray-155 rounded-xl overflow-hidden">
                                      <button 
                                        onClick={() => setExpandedFaq(expandedFaq === keyIndex ? null : keyIndex)}
                                        className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                                      >
                                        <span>{item.q}</span>
                                        <ChevronRight className={`size-3 text-gray-400 transition-all ${expandedFaq === keyIndex ? 'rotate-90' : ''}`} />
                                      </button>
                                      {expandedFaq === keyIndex && (
                                        <div className="p-2.5 bg-white text-[9px] text-gray-500 leading-relaxed border-t border-gray-100">
                                          {item.a}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>



                        </div>
                      )}

                      {customerActiveTab === 'subscriptions' && (
                        <div className="flex flex-col gap-4 text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => setCustomerActiveTab('home')} className="p-1 hover:bg-gray-200 rounded-lg">
                              <ArrowLeft className="size-4 text-gray-500" />
                            </button>
                            <h3 className="text-sm font-bold text-gray-900">Iron Kart Prime Plans</h3>
                          </div>
                          
                          <div className="w-full h-32 rounded-2xl overflow-hidden relative shadow-lg">
                            <img src="/subscription_banner_1785298423353.png" alt="Prime Subscription" className="w-full h-full object-cover opacity-80 mix-blend-screen" />
                            <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-slate-950 to-transparent">
                              <h4 className="font-extrabold text-gray-900 text-lg drop-shadow-md">Subscribe & Save</h4>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 pb-2">
                            {[
                              { name: 'Bronze', discount: 15, price: 299, color: 'text-orange-300', bg: 'bg-orange-300/10', border: 'border-orange-300' },
                              { name: 'Silver', discount: 25, price: 499, color: 'text-gray-700', bg: 'bg-slate-300/10', border: 'border-slate-300' },
                              { name: 'Gold', discount: 35, price: 699, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400' }
                            ].map(plan => (
                              <div key={plan.name} className={`border ${userSubscription === plan.name ? plan.border : 'border-gray-200'} bg-white rounded-xl p-4 relative overflow-hidden transition-all`}>
                                {userSubscription === plan.name && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-bold px-2 py-1 rounded-bl-lg">ACTIVE</div>}
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className={`font-bold ${plan.color} text-sm flex items-center gap-1.5`}>
                                    <Star className="size-4" fill="currentColor" /> {plan.name} Plan
                                  </h4>
                                  <span className="text-gray-900 font-extrabold">₹{plan.price}<span className="text-[9px] text-gray-400 font-normal">/mo</span></span>
                                </div>
                                <p className="text-[10px] text-gray-500">Gets flat {plan.discount}% discount on all orders placed (includes Light, Medium, Premium & Household categories).</p>
                                <button 
                                  onClick={() => {
                                    if(confirm(`Subscribe to ${plan.name} Plan for ₹${plan.price}/mo?`)) {
                                      if (!currentCustomer) return;
                                      const updated = { ...currentCustomer, activePlan: plan.name };
                                      setCurrentCustomer(updated);
                                      fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(updated)
                                      });
                                      alert(`${plan.name} Subscription Activated! You now get ${plan.discount}% off on all orders.`);
                                    }
                                  }}
                                  disabled={userSubscription === plan.name}
                                  className={`w-full mt-3 py-2 rounded-lg text-xs font-bold ${userSubscription === plan.name ? 'bg-gray-200 text-gray-400' : 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm'}`}
                                >
                                  {userSubscription === plan.name ? `Active Plan (${plan.discount}% Discount)` : 'Subscribe Now'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {customerActiveTab === 'profile' && currentCustomer && (
                        <div className="flex flex-col gap-4 text-left max-h-[500px] overflow-y-auto pb-6 pr-1">
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => setCustomerActiveTab('home')} className="p-1 hover:bg-gray-200 rounded-lg">
                              <ArrowLeft className="size-4 text-gray-500" />
                            </button>
                            <h3 className="text-sm font-bold text-gray-900 font-sans">My Profile</h3>
                          </div>

                          {/* Profile Card Info */}
                          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col gap-3 shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 size-24 bg-white/5 rounded-full blur-xl"></div>
                            <div className="flex items-center gap-3 relative z-10">
                              <div className="size-12 bg-white/20 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-inner">
                                {currentCustomer.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-extrabold text-sm truncate">{currentCustomer.name}</h4>
                                <p className="text-[10px] text-gray-300 font-medium truncate mt-0.5">{currentCustomer.phone}</p>
                              </div>
                            </div>
                            <div className="border-t border-white/10 pt-2 text-[10px] text-gray-400 flex justify-between">
                              <span>Membership</span>
                              <span className="font-bold text-amber-300">{currentCustomer.activePlan ? `${currentCustomer.activePlan} Prime` : 'Standard Customer'}</span>
                            </div>
                          </div>

                          {/* Manage Addresses Section */}
                          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                            <h4 className="text-xs font-bold text-gray-950 flex items-center gap-1">
                              <MapPin className="size-4 text-rose-500" /> Saved Addresses
                            </h4>
                            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
                              {(!currentCustomer.addresses || currentCustomer.addresses.length === 0) ? (
                                <p className="text-[10px] text-gray-400">No addresses saved yet.</p>
                              ) : (
                                currentCustomer.addresses?.map((addr: any) => (
                                  <div key={addr.id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-250 flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-2">
                                      <span className="text-[9px] font-extrabold uppercase bg-gray-200 text-gray-700 px-1 rounded">{addr.label}</span>
                                      <p className="text-[10px] text-gray-500 leading-snug mt-1 truncate">{addr.fullAddress}</p>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        if (confirm('Delete this address?')) {
                                          const addresses = (currentCustomer.addresses || []).filter((a: any) => a.id !== addr.id);
                                          const updated = { ...currentCustomer, addresses };
                                          setCurrentCustomer(updated);
                                          fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(updated)
                                          });
                                        }
                                      }}
                                      className="text-rose-500 hover:text-rose-600 text-[10px] font-bold shrink-0 self-center"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Add Address Inside Profile */}
                            {showAddAddress ? (
                              <div className="flex flex-col gap-2 border-t border-gray-150 pt-2">
                                <div className="flex gap-2">
                                  {['Home', 'Office', 'Other'].map(lbl => (
                                    <button 
                                      key={lbl}
                                      onClick={() => setNewAddressLabel(lbl)}
                                      className={`px-2.5 py-1 text-[9px] font-bold rounded-lg ${newAddressLabel === lbl ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                                    >
                                      {lbl}
                                    </button>
                                  ))}
                                </div>
                                <input 
                                  type="text" 
                                  placeholder="Enter complete address details"
                                  value={newAddressText}
                                  onChange={e => setNewAddressText(e.target.value)}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-900 outline-none"
                                />
                                <div className="flex gap-2">
                                  <button onClick={handleAddAddress} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-1 rounded text-[10px] font-bold">Save</button>
                                  <button onClick={() => setShowAddAddress(false)} className="flex-1 bg-gray-200 text-gray-700 py-1 rounded text-[10px] font-bold">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setShowAddAddress(true)} className="text-left text-[10px] font-bold text-rose-500 hover:underline">
                                + Add New Address
                              </button>
                            )}
                          </div>

                          {/* App Settings / Information & Legal */}
                          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm">
                            <h4 className="text-xs font-bold text-gray-950 flex items-center gap-1">
                              <Settings className="size-4 text-gray-500" /> Settings & Policies
                            </h4>
                            <div className="flex flex-col gap-1 text-[10px]">
                              <button onClick={() => alert('Terms & Conditions:\n\n1. All garments are ironed standard steam settings.\n2. In case of garment damage, maximum liability is limited to 5x the service cost.\n3. Orders must be cancelled at least 2 hours prior to pickup time.')} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-gray-700 flex justify-between items-center border border-gray-100">
                                <span>Terms & Conditions</span>
                                <ChevronRight className="size-3.5 text-gray-400" />
                              </button>
                              <button onClick={() => alert('Privacy Policy:\n\n1. We gather name, mobile number and address details solely to deliver services.\n2. Your details are secure and never sold or shared with external parties.\n3. Payment operations are securely routed through certified gateways.')} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-gray-700 flex justify-between items-center border border-gray-100">
                                <span>Privacy & Policy</span>
                                <ChevronRight className="size-3.5 text-gray-400" />
                              </button>
                            </div>
                          </div>

                          {/* Danger Zone: Delete Account */}
                          <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                            <h4 className="text-xs font-bold text-rose-800">Danger Zone</h4>
                            <p className="text-[10px] text-gray-500 leading-relaxed">Permanently delete your profile and account information. This action is irreversible.</p>
                            <button 
                              onClick={() => {
                                if (confirm('⚠️ WARNING: Deleting your account will remove your address list, purchase logs, and remaining wallet balance. Are you sure you want to proceed?')) {
                                  if (confirm('Are you absolutely certain? This cannot be undone.')) {
                                    const client = supabase;
                                    if (client) {
                                      client.from('customers')
                                        .delete()
                                        .eq('phone', currentCustomer.phone)
                                        .then(() => {
                                          setCurrentCustomer(null);
                                          localStorage.removeItem('iron_current_user');
                                          setCustomerActiveTab('home');
                                          alert('Your profile has been deleted successfully. We hope to see you again! ❤️');
                                        });
                                    } else {
                                      setCurrentCustomer(null);
                                      localStorage.removeItem('iron_current_user');
                                      setCustomerActiveTab('home');
                                      alert('Your profile has been deleted locally successfully.');
                                    }
                                  }
                                }
                              }}
                              className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 rounded-xl mt-1 shadow-sm transition-all"
                            >
                              Delete My Account Permanently
                            </button>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Premium Iztri-Style Bottom Navigation Bar */}
                    <div className="border-t border-gray-200/60 pt-3 pb-1 flex justify-around bg-white/90 backdrop-blur-md text-gray-400 -mx-4 px-2 mt-4 sticky bottom-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
                      {[
                        { tab: 'home', label: 'Home', icon: Smartphone },
                        { tab: 'order', label: 'Book', icon: Plus },
                        { tab: 'subscriptions', label: 'Prime', icon: Star },
                        { tab: 'history', label: 'Orders', icon: ShoppingBag },
                        { tab: 'profile', label: 'Profile', icon: User }
                      ].map(item => {
                        const Icon = item.icon
                        const isActive = customerActiveTab === item.tab
                        return (
                          <button 
                            key={item.tab}
                            onClick={() => {
                              setCustomerActiveTab(item.tab as any);
                              setSelectedOrderForTracking(null);
                            }}
                            className="relative flex flex-col items-center gap-1.5 py-1 px-3 rounded-xl transition-all w-14"
                          >
                            <div className={`relative flex items-center justify-center transition-all ${isActive ? 'text-rose-500' : 'text-gray-500 group-hover:text-gray-700'}`}>
                              <Icon className={`size-[18px] ${isActive ? 'fill-rose-500/10' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                              {isActive && (
                                <div className="absolute -inset-1.5 bg-rose-500/10 rounded-full blur-sm" />
                              )}
                            </div>
                            <span className={`text-[9px] font-bold tracking-wide transition-all ${isActive ? 'text-rose-500' : 'text-gray-500'}`}>
                              {item.label}
                            </span>
                            {isActive && (
                              <div className="absolute top-0 inset-x-0 mx-auto w-1 h-1 rounded-full bg-rose-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                  </div>
                )}

              </div>
            </div>

            {/* Simulated Mobile Device Checkout Modal (Razorpay simulation) */}
            {showCheckoutModal && (
              <div className="absolute inset-0 bg-white/90 z-40 flex items-end justify-center p-4 rounded-[40px]">
                <div className="w-full bg-gray-50 border border-gray-200 rounded-3xl p-5 text-left flex flex-col gap-4 animate-slide-up">
                  
                  {/* Checkout Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500">Iron Kart Checkout</h4>
                      <h3 className="text-sm font-extrabold text-gray-900 mt-0.5">Pay ₹{calculateTotals().total}</h3>
                    </div>
                    <button onClick={() => setShowCheckoutModal(false)} className="text-xs text-gray-400 hover:text-gray-900">Cancel</button>
                  </div>

                  {/* Payment Options */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase">Select Payment Mode</label>
                    
                    <button 
                      onClick={() => setPaymentMethod('UPI')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'UPI' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <CreditCard className="size-4 text-purple-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>UPI Payment (PhonePe, GPay)</span>
                        <div className="text-[8px] opacity-75">Pay digitally using QR/UPI App</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('Wallet')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'Wallet' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <Wallet className="size-4 text-emerald-400" />
                      <div className="text-xs font-semibold text-left">
                        <span>Iron Kart Wallet</span>
                        <div className="text-[8px] opacity-75">Pay using your prepaid balance</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('Card')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'Card' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <CreditCard className="size-4 text-blue-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>Credit / Debit Cards</span>
                        <div className="text-[8px] opacity-75">Pay securely via Visa, Mastercard, RuPay</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('NetBanking')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'NetBanking' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <Landmark className="size-4 text-amber-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>NetBanking</span>
                        <div className="text-[8px] opacity-75">Pay directly through your bank account</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('COD')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'COD' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <Truck className="size-4 text-rose-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>Pay On Pickup</span>
                        <div className="text-[8px] opacity-75">Pay cash or digital at pickup time</div>
                      </div>
                    </button>
                  </div>

                  {paymentMethod === 'UPI' && (
                    <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-2 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-gray-900 flex items-center justify-between">
                        <span>📱 Direct UPI Transfer</span>
                      </div>
                      
                      <div className="flex gap-3 items-center">
                        {upiDetails.id && (
                          <div className="bg-white p-1 rounded shrink-0">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=upi://pay?pa=${upiDetails.id}&pn=Iron Kart&cu=INR`} 
                              alt="UPI QR Code" 
                              className="w-16 h-16 object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1 flex flex-col gap-1 text-[10px] text-gray-500">
                          <div className="flex justify-between border-b border-slate-900 pb-1">
                            <span>Phone Number:</span>
                            <span className="font-bold text-gray-900 select-all">{upiDetails.phone}</span>
                          </div>
                          <div className="flex justify-between pt-0.5">
                            <span>UPI ID:</span>
                            <span className="font-bold text-rose-500 select-all">{upiDetails.id}</span>
                          </div>
                        </div>
                      </div>

                      <a 
                        href={`upi://pay?pa=${upiDetails.id}&pn=Iron Kart&cu=INR`} 
                        className="w-full bg-gray-50 hover:bg-gray-200 text-center text-gray-900 py-2 rounded-lg font-bold border border-gray-200 transition-colors mt-2"
                      >
                        Click to Open UPI App
                      </a>

                      <p className="text-[8px] text-gray-400 leading-relaxed italic bg-gray-50/50 p-1.5 rounded mt-1">
                        *Scan QR or click link to pay, then click "Confirm & Submit Order".
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'Card' && (
                    <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-2.5 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-gray-900">💳 Card Payment Details</div>
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          placeholder="Cardholder Name" 
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500" 
                        />
                        <input 
                          type="text" 
                          placeholder="Card Number (16-digits)" 
                          maxLength={16}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500" 
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text" 
                            placeholder="Expiry (MM/YY)" 
                            maxLength={5}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500" 
                          />
                          <input 
                            type="password" 
                            placeholder="CVV (3-digits)" 
                            maxLength={3}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'NetBanking' && (
                    <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-2.5 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-gray-900">🏦 Select NetBanking Bank</div>
                      <select className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500">
                        <option value="SBI">State Bank of India (SBI)</option>
                        <option value="HDFC">HDFC Bank</option>
                        <option value="ICICI">ICICI Bank</option>
                        <option value="AXIS">Axis Bank</option>
                        <option value="KOTAK">Kotak Mahindra Bank</option>
                      </select>
                    </div>
                  )}

                  {paymentMethod === 'Wallet' && (
                    <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-2 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-gray-900 flex items-center justify-between">
                        <span>💳 Iron Kart Wallet Balance</span>
                        <span className="text-emerald-500">₹{currentCustomer?.walletBalance || 0}</span>
                      </div>
                      
                      {(currentCustomer?.walletBalance || 0) < calculateTotals().total ? (
                        <div className="flex flex-col gap-1.5 mt-1 border-t border-gray-100 pt-2">
                          <p className="text-rose-500 text-[10px] font-bold">⚠️ Insufficient Wallet Balance (Need ₹{calculateTotals().total - (currentCustomer?.walletBalance || 0)} more)</p>
                          <div className="flex gap-2 mt-1">
                            <input 
                              type="number"
                              placeholder="Amount to Add"
                              value={checkoutAddAmount}
                              onChange={e => setCheckoutAddAmount(e.target.value)}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-900 outline-none"
                            />
                            <button 
                              onClick={handleCheckoutAddFunds}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-1 rounded-lg transition-colors"
                            >
                              Add & Pay
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-emerald-500 text-[10px] mt-1">Balance is sufficient for this order.</p>
                      )}
                    </div>
                  )}

                  <button 
                    onClick={handleCheckoutSubmit}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase text-center mt-2 shadow-md active:translate-y-0.5"
                  >
                    Confirm & Submit Order
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* --- 2. ADMIN PORTAL / WEB DASHBOARD --- */}
        {(viewMode === 'admin' || viewMode === 'dual') && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 bg-white border border-gray-200 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
              
              {/* Admin Tabs */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex gap-2">
                  {[
                    { tab: 'overview', label: 'Overview', icon: TrendingUp },
                    { tab: 'orders', label: 'Manage Orders', icon: ShoppingBag },
                    { tab: 'prices', label: 'Pricing Rates', icon: Settings },
                    { tab: 'customers', label: 'Customers', icon: Users },
                    { tab: 'settings', label: 'UPI Settings', icon: Key }
                  ].map(item => {
                    const Icon = item.icon
                    const isActive = adminActiveTab === item.tab
                    return (
                      <button 
                        key={item.tab}
                        onClick={() => setAdminActiveTab(item.tab as any)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-gray-50 border border-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        <Icon className="size-3.5 text-rose-500" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                
                {/* Simulated Refresh */}
                <button 
                  onClick={() => triggerNotification('🔄 Real-time data synchronized!')}
                  className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
                >
                  <RefreshCw className="size-3.5" /> Sync
                </button>
              </div>

              {/* Admin content views */}
              <div className="flex-1 overflow-y-auto">
                
                {/* OVERVIEW PANEL */}
                {adminActiveTab === 'overview' && (
                  <div className="flex flex-col gap-6 text-left">
                    
                    {/* Metrics Cards Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Total Revenue</span>
                        <div className="text-2xl font-extrabold text-gray-900">₹{totalRevenue.toFixed(2)}</div>
                        <span className="text-[9px] text-emerald-500 font-semibold">100% digital payouts</span>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Pending Pickups</span>
                        <div className="text-2xl font-extrabold text-rose-500">
                          {orders.filter(o => o.status === 'Placed').length}
                        </div>
                        <span className="text-[9px] text-gray-500">Needs immediate assignment</span>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Active In-process</span>
                        <div className="text-2xl font-extrabold text-amber-500">
                          {orders.filter(o => o.status === 'Picked Up' || o.status === 'Ironing').length}
                        </div>
                        <span className="text-[9px] text-gray-500">Undergoing ironing flow</span>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Completed orders</span>
                        <div className="text-2xl font-extrabold text-emerald-500">
                          {completedOrders.length}
                        </div>
                        <span className="text-[9px] text-emerald-500 font-semibold">Delivered & Closed</span>
                      </div>

                    </div>

                    {/* Recent Orders Overview */}
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-gray-900">Today&apos;s Active Inbound Pickups</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                        {orders.length === 0 ? (
                          <div className="p-8 text-center text-xs text-gray-400">No active ironing orders right now. Use the Customer Mobile App to place a simulated order!</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-white text-gray-500 uppercase font-bold text-[9px] border-b border-gray-200">
                                <tr>
                                  <th className="p-3">Order ID</th>
                                  <th className="p-3">Customer</th>
                                  <th className="p-3">Address</th>
                                  <th className="p-3">Schedule</th>
                                  <th className="p-3">Total</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850">
                                {orders.slice(0, 4).map(o => (
                                  <tr key={o.id} className="hover:bg-gray-100/50">
                                    <td className="p-3 font-mono font-bold text-rose-500">{o.id}</td>
                                    <td className="p-3">
                                      <div className="font-semibold text-gray-900">{o.customerName}</div>
                                      <div className="text-[9px] text-gray-500">{o.customerPhone}</div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-gray-900 truncate max-w-[120px]">{o.apartmentNo}</div>
                                      <div className="text-[9px] text-gray-500 truncate max-w-[120px]">{o.address}</div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-gray-900">{o.pickupDate}</div>
                                      <div className="text-[9px] text-gray-500">{o.pickupTime}</div>
                                    </td>
                                    <td className="p-3 font-semibold text-gray-900">₹{o.total}</td>
                                    <td className="p-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${o.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {o.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      <button 
                                        onClick={() => setAdminActiveTab('orders')}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-2 py-1 rounded font-bold text-[9px]"
                                      >
                                        Manage
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* MANAGE ORDERS PANEL */}
                {adminActiveTab === 'orders' && (
                  <div className="flex flex-col gap-4 text-left">
                    <h3 className="text-sm font-bold text-gray-900">All Orders Management Queue</h3>
                    
                    <div className="flex flex-col gap-3">
                      {orders.length === 0 ? (
                        <div className="bg-gray-50 border border-gray-200 p-8 rounded-2xl text-center text-xs text-gray-400">
                          No order records. Try booking an order in the Customer App on the left!
                        </div>
                      ) : (
                        orders.map(o => (
                          <div key={o.id} className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col lg:flex-row justify-between gap-4">
                            
                            {/* Order Details Left Column */}
                            <div className="flex-1 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-rose-500">{o.id}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${o.speed === 'Urgent' ? 'bg-red-500/20 text-red-400' : o.speed === 'Express' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-200 text-gray-500'}`}>
                                  {o.speed} Delivery
                                </span>
                              </div>
                              <div className="text-xs text-gray-900">
                                <strong>Customer:</strong> {o.customerName} ({o.customerPhone})
                              </div>
                              <div className="text-xs text-gray-500 leading-relaxed">
                                <strong>Apartment:</strong> {o.apartmentNo}
                              </div>
                              <div className="text-xs text-gray-500 leading-relaxed">
                                <strong>Address:</strong> {o.address}
                              </div>
                              
                              {/* Items list */}
                              <div className="text-[10px] text-gray-500 bg-white p-2.5 rounded-xl border border-gray-200 mt-1 max-w-sm">
                                <div className="font-bold text-gray-900 border-b border-gray-200 pb-1 mb-1">Basket Details:</div>
                                {o.items.map(item => (
                                  <div key={item.name} className="flex justify-between">
                                    <span>{item.name} (x{item.qty})</span>
                                    <span>₹{item.price * item.qty}</span>
                                  </div>
                                ))}
                                {o.specialInstructions && (
                                  <div className="text-[9px] text-amber-400 italic mt-2">
                                    *Instructions: {o.specialInstructions}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status Control Right Column */}
                            <div className="flex flex-col gap-3 lg:items-end justify-between">
                              <div className="lg:text-right">
                                <div className="text-sm font-extrabold text-gray-900">Total Value: ₹{o.total}</div>
                                <div className="flex items-center gap-1.5 lg:justify-end mt-1 text-[10px]">
                                  <span>Payment:</span>
                                  <span className={`font-bold ${o.paymentStatus === 'Paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {o.paymentStatus} ({o.paymentMethod})
                                  </span>
                                  {o.paymentStatus === 'Pending' && (
                                    <button 
                                      onClick={() => markOrderPaid(o.id)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-1.5 py-0.5 rounded text-[9px]"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Status Advancement Buttons */}
                              <div className="flex flex-wrap gap-1.5">
                                {o.status === 'Placed' && (
                                  <button 
                                    onClick={() => updateOrderStatus(o.id, 'Picked Up')}
                                    className="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold"
                                  >
                                    Accept & Pick Up
                                  </button>
                                )}
                                {o.status === 'Picked Up' && (
                                  <button 
                                    onClick={() => updateOrderStatus(o.id, 'Ironing')}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold"
                                  >
                                    Start Ironing
                                  </button>
                                )}
                                {o.status === 'Ironing' && (
                                  <button 
                                    onClick={() => updateOrderStatus(o.id, 'Ready')}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold"
                                  >
                                    Mark as Ready
                                  </button>
                                )}
                                {o.status === 'Ready' && (
                                  <button 
                                    onClick={() => updateOrderStatus(o.id, 'Delivered')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold"
                                  >
                                    Mark as Delivered
                                  </button>
                                )}
                                
                                <button 
                                  onClick={() => setSelectedInvoice(o)}
                                  className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                >
                                  <Eye className="size-3" /> Invoice
                                </button>
                                
                                <button 
                                  onClick={() => deleteOrder(o.id)}
                                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-2 py-1 rounded-lg text-[10px] font-bold"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* PRICING RATES PANEL */}
                {adminActiveTab === 'prices' && (
                  <div className="flex flex-col gap-4 text-left">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Garment Price Rates Manager</h3>
                      <p className="text-xs text-gray-500 mt-1">Configure pricing categories. Edits immediately apply to the customer booking forms.</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col gap-4">
                      <div className="flex flex-col gap-5 max-h-[400px] overflow-y-auto pr-2">
                        {['Ironing', 'Laundry', 'Dry Cleaning'].map(service => {
                          const items = priceList.filter(item => item.serviceType === service || (service === 'Dry Cleaning' && item.serviceType === 'Dry Cleaning'));
                          if (items.length === 0) return null;
                          return (
                            <div key={service} className="flex flex-col gap-2">
                              <h4 className="text-xs font-extrabold text-rose-500 uppercase tracking-wide border-b border-gray-200 pb-1">{service}</h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {items.map(item => {
                                  const key = `${item.serviceType}-${item.name}`;
                                  return (
                                    <div key={key} className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border border-gray-200">
                                      <label className="text-[9px] font-bold text-gray-500 flex items-center justify-between">
                                        <span>{item.name}</span>
                                        <span className="text-[7px] bg-gray-100 text-gray-400 px-1 rounded-sm">{item.category}</span>
                                      </label>
                                      <input 
                                        type="number"
                                        value={editingPrices[key] !== undefined ? editingPrices[key] : item.price}
                                        onChange={e => setEditingPrices(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-900 outline-none focus:border-rose-500"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button 
                        onClick={saveAdminPrices}
                        className="bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-xs font-semibold self-start px-6 shadow-md mt-2"
                      >
                        Save Updated Rates
                      </button>
                    </div>
                  </div>
                )}

                {/* CUSTOMERS LIST PANEL */}
                {adminActiveTab === 'customers' && (
                  <div className="flex flex-col gap-4 text-left">
                    <h3 className="text-sm font-bold text-gray-900">Registered Customer Profiles</h3>
                    
                    <div className="grid gap-3">
                      {customers.map(c => (
                        <div key={c.phone} className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-gray-900">{c.name}</h4>
                            <span className="text-[9px] bg-white text-gray-500 px-2 py-0.5 rounded font-bold">Active Customer</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1 flex flex-col gap-0.5 border-t border-gray-200/80 pt-2">
                            <span>📞 Phone: +91 {c.phone}</span>
                            {c.email && <span>📧 Email: {c.email}</span>}
                            <span>🏢 Apartment: {c.apartmentNo}</span>
                            <span>📍 Address: {c.address}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SETTINGS PANEL */}
                {adminActiveTab === 'settings' && (
                  <div className="flex flex-col gap-4 text-left">
                    <h3 className="text-sm font-bold text-gray-900">Payment & UPI Settings</h3>
                    
                    <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col gap-4">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Update your direct UPI details (GPay/PhonePe). These details and a QR code will be dynamically generated for your customers during checkout.
                      </p>
                      
                      <div className="flex flex-col gap-3 max-w-sm">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-gray-500">Merchant Phone Number</label>
                          <input 
                            type="text"
                            value={upiDetails.phone}
                            onChange={e => setUpiDetails({ ...upiDetails, phone: e.target.value })}
                            placeholder="e.g. 9791019505"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-rose-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-gray-500">Merchant UPI ID</label>
                          <input 
                            type="text"
                            value={upiDetails.id}
                            onChange={e => setUpiDetails({ ...upiDetails, id: e.target.value })}
                            placeholder="e.g. 9791019505@ybl"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex gap-4 items-start">
                        <div className="bg-white p-2 rounded-lg">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=${upiDetails.id}&pn=Iron Kart&cu=INR`} 
                            alt="Live QR Preview" 
                            className="w-[100px] h-[100px]"
                          />
                        </div>
                        <div className="text-[10px] text-gray-400 pt-2 flex-1">
                          <strong>Live QR Preview:</strong>
                          <br />This QR code updates instantly. Customers can scan this directly to pay you on PhonePe, GPay, or Paytm.
                        </div>
                      </div>

                      <button 
                        onClick={saveUpiSettings}
                        className="bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-xs font-semibold self-start px-6 shadow-md mt-2"
                      >
                        Save Settings
                      </button>
                    </div>
                  </div>
                )}


              </div>
            </div>
          </div>
        )}

      </main>

      {/* Invoice Viewer Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-left">
            
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Iron Kart Invoice</h3>
                <span className="text-[10px] text-gray-400 font-mono">No. {selectedInvoice.invoiceNo}</span>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold"
              >
                Close
              </button>
            </div>

            {/* Customer Details */}
            <div className="text-xs border-b border-slate-100 pb-3">
              <div className="font-bold text-slate-800">Bill To:</div>
              <div className="mt-1 text-slate-600">{selectedInvoice.customerName}</div>
              <div className="text-slate-600">{selectedInvoice.customerPhone}</div>
              <div className="text-[10px] text-gray-500 mt-1 font-semibold">{selectedInvoice.apartmentNo}</div>
              <div className="text-[10px] text-gray-500 truncate">{selectedInvoice.address}</div>
            </div>

            {/* Date Details */}
            <div className="grid grid-cols-2 gap-4 text-[10px] border-b border-slate-100 pb-3">
              <div>
                <span className="text-gray-500 block font-semibold">Date of Service:</span>
                <span className="text-slate-800 font-bold">{selectedInvoice.createdAt}</span>
              </div>
              <div>
                <span className="text-gray-500 block font-semibold">Pickup Slot:</span>
                <span className="text-slate-800 font-bold">{selectedInvoice.pickupDate} ({selectedInvoice.pickupTime})</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="flex-1 flex flex-col gap-2 max-h-[160px] overflow-y-auto">
              <div className="grid grid-cols-12 text-[10px] font-bold uppercase text-gray-500 pb-1 border-b border-slate-100">
                <span className="col-span-6">Garment</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {selectedInvoice.items.map(item => (
                <div key={item.name} className="grid grid-cols-12 text-xs text-slate-600 py-0.5">
                  <span className="col-span-6 font-semibold">{item.name}</span>
                  <span className="col-span-2 text-center font-mono">{item.qty}</span>
                  <span className="col-span-2 text-right font-mono">₹{item.price}</span>
                  <span className="col-span-2 text-right font-mono font-bold text-slate-900">₹{item.price * item.qty}</span>
                </div>
              ))}
            </div>

            {/* Grand Totals */}
            <div className="border-t border-slate-200 pt-3 flex flex-col gap-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">₹{selectedInvoice.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery speed ({selectedInvoice.speed})</span>
                <span className="font-mono">₹{selectedInvoice.markup}</span>
              </div>
              <div className="flex justify-between">
                <span>GST Tax (5%)</span>
                <span className="font-mono">₹{selectedInvoice.tax}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-sm text-slate-900">
                <span>Grand Total</span>
                <span className="font-mono">₹{selectedInvoice.total}</span>
              </div>
              <div className="flex justify-between text-[10px] mt-1">
                <span>Payment Mode:</span>
                <span className="font-bold text-slate-800">{selectedInvoice.paymentMethod} ({selectedInvoice.paymentStatus})</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 p-6 rounded-[24px] max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Order</h2>
            <p className="text-xs text-gray-500 mb-4">Are you sure you want to cancel this order? This action cannot be undone.</p>
            
            <div className="flex flex-col gap-1.5 mb-5 text-left">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Reason for cancellation</label>
              <textarea 
                value={cancelReasonInput}
                onChange={e => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Changed my mind, not at home..."
                rows={3}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-rose-500 resize-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setShowCancelModal(false); setCancelReasonInput(''); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 py-2.5 rounded-xl font-bold text-xs"
              >
                Keep Order
              </button>
              <button 
                onClick={handleCancelOrder}
                className="bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-bold text-xs"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Order Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 p-6 rounded-[24px] max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200 text-left">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reschedule Order</h2>
            
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[11px] font-bold text-gray-900 tracking-wide">Select New Date</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2 snap-x">
                {availableDates.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setRescheduleDate(d.value)}
                    className={`min-w-[50px] flex flex-col items-center justify-center py-2 rounded-2xl border snap-center transition-all ${
                      rescheduleDate === d.value
                      ? 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-500 shadow-[0_4px_12px_rgba(225,29,72,0.3)]' 
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                  >
                    <span className={`text-[10px] font-medium ${rescheduleDate === d.value ? 'text-rose-100' : ''}`}>{d.label}</span>
                    <span className={`text-lg font-bold mt-0.5 ${rescheduleDate === d.value ? 'text-gray-900' : ''}`}>{d.dateNum}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[11px] font-bold text-gray-900 tracking-wide">Select New Time Slot</label>
              <div className="grid grid-cols-2 gap-2">
                {['09:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 - 21:00'].map(slot => (
                  <button
                    key={slot}
                    onClick={() => setRescheduleTime(slot)}
                    className={`flex items-center justify-center py-2.5 rounded-xl border text-[10px] font-medium transition-all ${
                      rescheduleTime === slot
                      ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowRescheduleModal(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 py-2.5 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleRescheduleOrder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs"
              >
                Update Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Dashboard Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-4 text-center text-xs text-gray-400">
        <p>© 2026 Iron Kart Ironing Service Inc. All systems simulated. Workflows are fully responsive and digital ready.</p>
      </footer>

    </div>
  );
}
