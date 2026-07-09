import { useState, useEffect } from 'react'
import { 
  Plus, Minus, Calendar, Clock, Check, MapPin,
  TrendingUp, Users, Smartphone, 
  ChevronRight, ShoppingBag, 
  FileText, CreditCard, ArrowLeft, Settings, 
  Bell, HelpCircle, LogOut, Eye, RefreshCw, Key
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { auth, RecaptchaVerifier } from './firebaseConfig'
import { signInWithPhoneNumber } from 'firebase/auth'

// Define interfaces
interface GarmentItem {
  name: string;
  price: number;
  category: string;
}

interface OrderItem {
  name: string;
  qty: number;
  price: number;
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
  items: OrderItem[];
  subtotal: number;
  markup: number;
  tax: number;
  total: number;
  status: 'Placed' | 'Picked Up' | 'Ironing' | 'Ready' | 'Delivered';
  paymentStatus: 'Pending' | 'Paid';
  paymentMethod: string;
  specialInstructions: string;
  createdAt: string;
}

interface CustomerProfile {
  name: string;
  phone: string;
  email?: string;
  password?: string;
  apartmentNo: string;
  address: string;
}

const DEFAULT_PRICE_LIST: GarmentItem[] = [
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

export default function App() {
  // --- Persistent State using Backend API & LocalStorage ---
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
      client.from('price_list').select('*')
        .then(({ data, error }) => {
          if (error) console.error(error);
          else if (data) setPriceList(data);
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
  const [viewMode, setViewMode] = useState<'customer' | 'admin' | 'dual'>('customer');
  const [customerActiveTab, setCustomerActiveTab] = useState<'home' | 'order' | 'prices' | 'history' | 'support'>('home');
  const [adminActiveTab, setAdminActiveTab] = useState<'overview' | 'orders' | 'prices' | 'customers' | 'settings'>('overview');
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
  const [authOTP, setAuthOTP] = useState('');
  const [sentOTP, setSentOTP] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Admin access state
  const [adminPin, setAdminPin] = useState('');

  // Customer Placing Order State
  const [orderSpeed, setOrderSpeed] = useState<'Normal' | 'Express' | 'Urgent'>('Normal');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('09:00 - 12:00');
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderApartment, setOrderApartment] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'COD'>('UPI');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<Order | null>(null);

  // Admin edit prices state
  const [editingPrices, setEditingPrices] = useState<{ [key: string]: number }>({});

  // Active modal invoice state
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);
  const [gatewayOrderData, setGatewayOrderData] = useState<any>(null);
  const [firebaseConfirmResult, setFirebaseConfirmResult] = useState<any>(null);

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
          });
      } catch (err: any) {
        alert('Failed to initialize SMS gateway: ' + err.message);
      }
      return;
    }

    // Fallback: Local Server API
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

  const handleVerifyOTP = () => {
    if (auth && firebaseConfirmResult) {
      firebaseConfirmResult.confirm(authOTP)
        .then(() => {
          const existing = customers.find(c => c.phone === authPhone);
          if (existing) {
            fetch(`${API_URL}/customers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(existing)
            })
              .then(res => res.json())
              .then(data => {
                setCurrentCustomer(data);
                setCustomerActiveTab('home');
              })
              .catch(err => alert('API Connection Error: ' + err.message));
          } else {
            setAuthStep('register');
          }
        })
        .catch((err: any) => {
          alert('Invalid verification code: ' + err.message);
        });
      return;
    }

    if (authOTP === sentOTP || authOTP === '1234') { // Fallback bypass
      const existing = customers.find(c => c.phone === authPhone);
      if (existing) {
        fetch(`${API_URL}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existing)
        })
          .then(res => res.json())
          .then(data => {
            setCurrentCustomer(data);
            setCustomerActiveTab('home');
          })
          .catch(err => alert('API Connection Error: ' + err.message));
      } else {
        setAuthStep('register');
      }
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
      address: authAddress
    };

    if (supabase) {
      supabase.from('customers').insert([newProfile])
        .then(({ error }) => {
          if (error) {
            alert('Failed to register: ' + error.message);
          } else {
            setCustomers(prev => [...prev, newProfile]);
            setAuthStep('login');
            setAuthPhone('');
            setAuthOTP('');
            triggerNotification(`✅ Registration Successful! Please login using your mobile number.`);
          }
        });
      return;
    }

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
        setAuthStep('login');
        setAuthPhone('');
        setAuthOTP('');
        triggerNotification(`✅ Registration Successful! Please login using your mobile number.`);
      })
      .catch(() => alert('Registration failed. Is the backend running?'));
  };

  const handleLogout = () => {
    localStorage.removeItem('iron_current_user');
    setCurrentCustomer(null);
    setAuthStep('login');
    setAuthPhone('');
    setAuthOTP('');
    setSelectedItems({});
    window.location.reload();
  };

  // --- Calculation Helpers ---
  const calculateTotals = () => {
    let subtotal = 0;
    Object.entries(selectedItems).forEach(([name, qty]) => {
      const item = priceList.find(p => p.name === name);
      if (item && qty > 0) {
        subtotal += item.price * qty;
      }
    });

    let markupMultiplier = 0; // Normal
    if (orderSpeed === 'Express') markupMultiplier = 0.5; // +50%
    if (orderSpeed === 'Urgent') markupMultiplier = 1.0; // +100%

    const markup = parseFloat((subtotal * markupMultiplier).toFixed(2));
    const tax = parseFloat(((subtotal + markup) * 0.05).toFixed(2)); // 5% GST
    const total = parseFloat((subtotal + markup + tax).toFixed(2));

    return { subtotal, markup, tax, total };
  };

  // --- Order Submission ---
  const handlePlaceOrder = () => {
    const { subtotal, total } = calculateTotals();

    if (!orderName.trim() || !orderPhone.trim() || !orderApartment.trim() || orderAddress.trim().length < 5) {
      alert('Please fill out all pickup details (Name, Phone, Apartment, and Full Address) correctly.');
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
    const { subtotal, markup, tax, total } = calculateTotals();
    const orderItems: OrderItem[] = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([name, qty]) => {
        const pItem = priceList.find(p => p.name === name);
        return {
          name,
          qty,
          price: pItem ? pItem.price : 0
        };
      });

    const newOrder: Order = {
      id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      invoiceNo: `IE-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: orderName || 'Walk-in Customer',
      customerPhone: orderPhone || '',
      apartmentNo: orderApartment || '',
      address: orderAddress || '',
      pickupDate,
      pickupTime,
      speed: orderSpeed,
      items: orderItems,
      subtotal,
      markup,
      tax,
      total,
      status: 'Placed',
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
      paymentMethod: transactionId !== 'Simulated' ? `${paymentMethod} (Txn: ${transactionId})` : paymentMethod,
      specialInstructions,
      createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    if (supabase) {
      supabase.from('orders').insert([newOrder])
        .then(({ error }) => {
          if (error) {
            alert('Supabase Order Placement Failed: ' + error.message);
          } else {
            setOrders(prev => [newOrder, ...prev]);
            setSelectedItems({});
            setSpecialInstructions('');
            setShowCheckoutModal(false);
            setSelectedOrderForTracking(newOrder);
            setCustomerActiveTab('history');
            triggerNotification(`🔔 Real-Time Order Placed!`);
          }
        });
      return;
    }

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
        triggerNotification(`🔔 New Order Alert to Owner: received order ${data.id} from ${data.customerName} (${data.apartmentNo})`);
      })
      .catch(err => alert('API Connection Error: ' + err.message));
  };

  const handleCheckoutSubmit = () => {
    if ((paymentMethod === 'UPI' || paymentMethod === 'Card') && gatewayOrderData?.liveMode) {
      // Trigger Live Razorpay Checkout
      const options = {
        key: gatewayOrderData.keyId,
        amount: gatewayOrderData.amount * 100, // paise
        currency: gatewayOrderData.currency,
        name: "IronEase Service",
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
    if (supabase) {
      supabase.from('orders').update({ status: nextStatus }).eq('id', orderId)
        .then(({ error }) => {
          if (error) {
            alert('Supabase Status Update Failed: ' + error.message);
          } else {
            let notifyMsg = `📱 SMS: Order ${orderId} updated to [${nextStatus}]`;
            if (nextStatus === 'Ready') notifyMsg = `🎉 WhatsApp sent: Your ironing is ready for pickup!`;
            if (nextStatus === 'Delivered') notifyMsg = `🚚 Delivered! Invoice generated.`;
            triggerNotification(notifyMsg);
          }
        });
      return;
    }

    fetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    })
      .then(res => res.json())
      .then(data => {
        setOrders(prev => prev.map(o => o.id === orderId ? data : o));
        let notifyMsg = `📱 SMS: Order ${orderId} updated to [${nextStatus}]`;
        if (nextStatus === 'Ready') notifyMsg = `🎉 WhatsApp sent: Your ironing is ready for pickup!`;
        if (nextStatus === 'Delivered') notifyMsg = `🚚 Delivered! Invoice generated.`;
        triggerNotification(notifyMsg);
      })
      .catch(err => alert('API Connection Error: ' + err.message));
  };

  const markOrderPaid = (orderId: string) => {
    if (supabase) {
      supabase.from('orders').update({ paymentStatus: 'Paid' }).eq('id', orderId)
        .then(({ error }) => {
          if (error) {
            alert('Supabase Payment Status Update Failed: ' + error.message);
          } else {
            triggerNotification(`💳 Payment received for order ${orderId}`);
          }
        });
      return;
    }

    fetch(`${API_URL}/orders/${orderId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'Paid' })
    })
      .then(res => res.json())
      .then(data => {
        setOrders(prev => prev.map(o => o.id === orderId ? data : o));
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
      if (editingPrices[item.name] !== undefined) {
        return { ...item, price: editingPrices[item.name] };
      }
      return item;
    });

    const client = supabase;
    if (client) {
      Promise.all(
        updated.map(item => client.from('price_list').update({ price: item.price }).eq('name', item.name))
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

  const handleAdminAccess = () => {
    if (adminPin === '9791') {
      setViewMode('dual');
      setAdminPin('');
      triggerNotification('🔓 Admin mode activated successfully!');
    } else {
      alert('Invalid PIN. Use default PIN 9791 to switch views.');
    }
  };

  // Metrics calculations
  const completedOrders = orders.filter(o => o.status === 'Delivered');
  const totalRevenue = orders.filter(o => o.paymentStatus === 'Paid').reduce((acc, o) => acc + o.total, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
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
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 shadow-md">
            <span className="font-extrabold text-white text-lg tracking-wider">IE</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 p-0 text-left">IronEase Portal</h1>
            <p className="text-xs text-slate-400 text-left">Professional Ironing & Pickup Service</p>
          </div>
        </div>

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
        
        {/* --- 1. CUSTOMER MOBILE APP VIEW --- */}
        {(viewMode === 'customer' || viewMode === 'dual') && (
          <div className="flex-1 max-w-[400px] flex flex-col items-center">
            
            {/* Phone shell container */}
            <div className="w-full aspect-[9/19.5] border-8 border-slate-850 bg-slate-950 rounded-[40px] shadow-2xl flex flex-col overflow-hidden relative border-t-[12px] border-b-[12px]">
              
              {/* Camera Notch simulation */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-850 rounded-full z-20"></div>

              {/* Inside Mobile App Viewport */}
              <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto px-4 pt-8 pb-4">
                
                {/* Auth Screen Flow */}
                {!currentCustomer ? (
                  <div className="flex-1 flex flex-col justify-center gap-6">
                    <div className="text-center flex flex-col items-center gap-2">
                      <div className="size-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-md">
                        <ShoppingBag className="size-8" />
                      </div>
                      <h2 className="text-xl font-bold text-white">IronEase Delivery</h2>
                      <p className="text-xs text-slate-400">Professional Ironing & Pressing Service</p>
                    </div>

                    {authStep === 'login' && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5 text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile Number</label>
                          <div className="flex gap-2 items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                            <span className="text-slate-500 text-sm font-semibold">+91</span>
                            <input 
                              type="tel"
                              value={authPhone}
                              onChange={e => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0,10))}
                              placeholder="Enter 10 digit number"
                              className="bg-transparent text-sm text-white w-full outline-none"
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
                        <div className="mt-8 border-t border-slate-800 pt-5 text-left">
                          <h4 className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                            <Key className="size-3 text-amber-500" />
                            Owner Admin Gateway
                          </h4>
                          <div className="flex gap-2 mt-2">
                            <input 
                              type="password"
                              maxLength={4}
                              placeholder="PIN"
                              value={adminPin}
                              onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white w-20 text-center outline-none"
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
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Enter Verification OTP</label>
                          <input 
                            type="text"
                            maxLength={6}
                            value={authOTP}
                            onChange={e => setAuthOTP(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••••"
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-lg font-bold tracking-widest text-white outline-none"
                          />
                        </div>
                        <button 
                          onClick={handleVerifyOTP}
                          className="w-full bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md active:translate-y-0.5"
                        >
                          Verify & Continue
                        </button>
                        <div className="flex justify-end items-center text-xs text-slate-400 mt-1">
                          <button onClick={() => setAuthStep('login')} className="text-rose-500 hover:underline">Change Number</button>
                        </div>
                      </div>
                    )}

                    {authStep === 'register' && (
                      <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                        <h3 className="text-sm font-bold text-white text-left">Setup New Account</h3>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-semibold text-slate-400 uppercase">Full Name</label>
                          <input 
                            type="text"
                            value={authName}
                            onChange={e => setAuthName(e.target.value)}
                            placeholder="Your Full Name"
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-semibold text-slate-400 uppercase">Apartment / Flat Number</label>
                          <input 
                            type="text"
                            value={authApartment}
                            onChange={e => setAuthApartment(e.target.value)}
                            placeholder="Apt 402, Block C"
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-semibold text-slate-400 uppercase">Street Address / Landmark</label>
                          <textarea 
                            value={authAddress}
                            onChange={e => setAuthAddress(e.target.value)}
                            placeholder="123 Tech Park, Whitefield, Bengaluru"
                            rows={3}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none resize-none"
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
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {currentCustomer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <div className="text-[10px] text-rose-300 font-bold tracking-wide uppercase">Warm Welcome Back</div>
                          <div className="text-sm font-black text-white max-w-[160px] truncate">{currentCustomer.name}</div>
                        </div>
                      </div>
                      <button onClick={handleLogout} className="text-slate-500 hover:text-rose-500 p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <LogOut className="size-4" />
                      </button>
                    </div>

                    {/* Customer Screen Switcher */}
                    <div className="flex-1 flex flex-col overflow-y-auto">
                      
                      {/* HOME TAB */}
                      {customerActiveTab === 'home' && (
                        <div className="flex flex-col gap-4">
                          
                          {/* Promotional Slide Banner */}
                          <div className="bg-gradient-to-r from-rose-600 to-amber-500 rounded-2xl p-4 text-left shadow-lg relative overflow-hidden">
                            <div className="absolute right-0 bottom-0 opacity-15 text-[80px] font-black tracking-tighter">50%</div>
                            <h4 className="font-extrabold text-sm text-white">First Order Discount!</h4>
                            <p className="text-[10px] text-white/90 mt-1 max-w-[200px]">Get 50% off on your first order. Standard normal delivery starts at just ₹12/item.</p>
                            <span className="inline-block bg-white text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded-full mt-2.5">Code: FIRST50</span>
                          </div>

                          {/* Quick Actions Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={() => setCustomerActiveTab('order')}
                              className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-rose-500 transition-all text-center"
                            >
                              <div className="size-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                                <Plus className="size-5" />
                              </div>
                              <span className="text-xs font-semibold text-white">Place Order</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('history')}
                              className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-rose-500 transition-all text-center"
                            >
                              <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <ShoppingBag className="size-5" />
                              </div>
                              <span className="text-xs font-semibold text-white">My Orders</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('prices')}
                              className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-rose-500 transition-all text-center"
                            >
                              <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <FileText className="size-5" />
                              </div>
                              <span className="text-xs font-semibold text-white">Price List</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('support')}
                              className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-rose-500 transition-all text-center"
                            >
                              <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <HelpCircle className="size-5" />
                              </div>
                              <span className="text-xs font-semibold text-white">Support</span>
                            </button>
                          </div>

                          {/* Quick Tracker shortcut */}
                          {orders.filter(o => o.customerPhone === currentCustomer.phone).length > 0 && (
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left">
                              <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3">
                                <span className="text-xs font-bold text-white">Active Order</span>
                                <span className="text-[10px] text-slate-500">
                                  {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].id}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold text-rose-500">
                                    Status: {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].status}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    Pickup: {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].pickupDate}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setSelectedOrderForTracking(orders.filter(o => o.customerPhone === currentCustomer.phone)[0]);
                                    setCustomerActiveTab('history');
                                  }}
                                  className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold"
                                >
                                  Track <ChevronRight className="size-3" />
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                      {/* PLACE ORDER TAB */}
                      {customerActiveTab === 'order' && (
                        <div className="flex flex-col gap-4 text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => setCustomerActiveTab('home')} className="p-1 hover:bg-slate-800 rounded-lg">
                              <ArrowLeft className="size-4 text-slate-400" />
                            </button>
                            <h3 className="text-sm font-bold text-white">Schedule Ironing Pickup</h3>
                          </div>

                          {/* Address Details Card */}
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs flex flex-col gap-2">
                            <div className="font-bold text-white flex items-center justify-between">
                              <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-rose-500" /> Pickup Details</span>
                              <span className="text-[9px] text-slate-500 font-normal">Editable</span>
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Customer Name</label>
                                <input 
                                  type="text" 
                                  value={orderName} 
                                  onChange={e => setOrderName(e.target.value)}
                                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-rose-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Phone Number</label>
                                <input 
                                  type="text" 
                                  value={orderPhone} 
                                  onChange={e => setOrderPhone(e.target.value)}
                                  placeholder="e.g. 9876543210"
                                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-rose-500"
                                />
                              </div>
                              <div className="flex gap-2">
                                <div className="flex flex-col gap-1 w-1/3">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Apt No.</label>
                                  <input 
                                    type="text" 
                                    value={orderApartment} 
                                    onChange={e => setOrderApartment(e.target.value)}
                                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-rose-500"
                                  />
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Full Address</label>
                                  <input 
                                    type="text" 
                                    value={orderAddress} 
                                    onChange={e => setOrderAddress(e.target.value)}
                                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-rose-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Speed Selection */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Delivery Speed</label>
                            <div className="grid grid-cols-3 gap-2">
                              {['Normal', 'Express', 'Urgent'].map(sp => (
                                <button 
                                  key={sp}
                                  onClick={() => setOrderSpeed(sp as any)}
                                  className={`py-2 rounded-xl text-xs font-semibold border transition-all text-center ${orderSpeed === sp ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                                >
                                  {sp}
                                  <div className="text-[8px] opacity-80">
                                    {sp === 'Normal' && 'Standard'}
                                    {sp === 'Express' && '+50% (24h)'}
                                    {sp === 'Urgent' && '+100% (4h)'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Pickup schedule */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Pickup Date</label>
                              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white">
                                <Calendar className="size-3.5 text-rose-500 mr-2" />
                                <input 
                                  type="date"
                                  value={pickupDate}
                                  onChange={e => setPickupDate(e.target.value)}
                                  className="bg-transparent outline-none w-full text-xs text-white"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Pickup Slot</label>
                              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white">
                                <Clock className="size-3.5 text-rose-500 mr-2" />
                                <select 
                                  value={pickupTime}
                                  onChange={e => setPickupTime(e.target.value)}
                                  className="bg-transparent outline-none w-full text-xs text-white"
                                >
                                  <option value="09:00 - 12:00">09 AM - 12 PM</option>
                                  <option value="12:00 - 15:00">12 PM - 03 PM</option>
                                  <option value="15:00 - 18:00">03 PM - 06 PM</option>
                                  <option value="18:00 - 21:00">06 PM - 09 PM</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Garment Selection Basket */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Select Garments</label>
                            <div className="max-h-[140px] overflow-y-auto flex flex-col gap-2 pr-1">
                              {priceList.map(item => {
                                const qty = selectedItems[item.name] || 0;
                                return (
                                  <div key={item.name} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                                    <div>
                                      <div className="text-xs font-bold text-white">{item.name}</div>
                                      <div className="text-[9px] text-slate-400">₹{item.price}/pc</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button 
                                        onClick={() => setSelectedItems(prev => ({ ...prev, [item.name]: Math.max(0, qty - 1) }))}
                                        className="size-6 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
                                      >
                                        <Minus className="size-3" />
                                      </button>
                                      <span className="text-xs font-bold text-white min-w-[12px] text-center">{qty}</span>
                                      <button 
                                        onClick={() => setSelectedItems(prev => ({ ...prev, [item.name]: qty + 1 }))}
                                        className="size-6 bg-rose-500 rounded-full flex items-center justify-center text-white"
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
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Special Instructions</label>
                            <input 
                              type="text"
                              value={specialInstructions}
                              onChange={e => setSpecialInstructions(e.target.value)}
                              placeholder="starch saree, crease shirt sleeves"
                              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                            />
                          </div>

                          {/* Price calculation summary */}
                          <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col gap-1 text-[10px] text-slate-400">
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span className="font-bold text-white">₹{calculateTotals().subtotal}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{orderSpeed} Speed Markup</span>
                              <span className="font-bold text-white">₹{calculateTotals().markup}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>GST (5%)</span>
                              <span className="font-bold text-white">₹{calculateTotals().tax}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-800 pt-1.5 text-xs font-bold text-rose-500">
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
                          <h3 className="text-sm font-bold text-white">Service Price List</h3>
                          
                          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto">
                            {priceList.map(item => (
                              <div key={item.name} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-850">
                                <div>
                                  <div className="text-xs font-bold text-white">{item.name}</div>
                                  <span className="text-[9px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded">{item.category}</span>
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
                          <h3 className="text-sm font-bold text-white">Your Orders</h3>

                          {selectedOrderForTracking ? (
                            <div className="flex flex-col gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                <button onClick={() => setSelectedOrderForTracking(null)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
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
                                        <div className={`absolute left-2.5 top-6 w-0.5 h-6 ${stepIdx < currentIdx ? 'bg-rose-500' : 'bg-slate-800'}`}></div>
                                      )}
                                      <div className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'border-slate-800 text-slate-500'}`}>
                                        {isActive ? <Check className="size-2.5" /> : idx + 1}
                                      </div>
                                      <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-500'}`}>
                                        {step.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="bg-slate-900/60 p-3 rounded-xl text-[10px] text-slate-400 flex flex-col gap-1 border border-slate-850">
                                <div className="flex justify-between">
                                  <span>Apartment No</span>
                                  <span className="font-bold text-white">{selectedOrderForTracking.apartmentNo}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Pickup slot</span>
                                  <span className="font-bold text-white">{selectedOrderForTracking.pickupDate} ({selectedOrderForTracking.pickupTime})</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Total amount</span>
                                  <span className="font-bold text-white">₹{selectedOrderForTracking.total} ({selectedOrderForTracking.paymentStatus})</span>
                                </div>
                              </div>

                              {selectedOrderForTracking.status === 'Delivered' && (
                                <button 
                                  onClick={() => setSelectedInvoice(selectedOrderForTracking)}
                                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 mt-2"
                                >
                                  <FileText className="size-3.5 text-rose-500" /> View Digital Invoice
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3 overflow-y-auto max-h-[380px]">
                              {orders.filter(o => o.customerPhone === currentCustomer.phone).length === 0 ? (
                                <div className="text-center py-10 text-xs text-slate-500">No active orders placed yet.</div>
                              ) : (
                                orders
                                  .filter(o => o.customerPhone === currentCustomer.phone)
                                  .map(o => (
                                    <div 
                                      key={o.id} 
                                      onClick={() => setSelectedOrderForTracking(o)}
                                      className="bg-slate-950 p-3 rounded-xl border border-slate-850 hover:border-rose-500/30 transition-all flex items-center justify-between cursor-pointer"
                                    >
                                      <div>
                                        <div className="text-xs font-bold text-white">{o.id}</div>
                                        <div className="text-[9px] text-slate-400 mt-0.5">{o.createdAt}</div>
                                        <div className="text-[10px] font-semibold text-rose-500 mt-1">{o.status}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-xs font-extrabold text-white">₹{o.total}</div>
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
                      {customerActiveTab === 'support' && (
                        <div className="flex flex-col gap-3 text-left">
                          <h3 className="text-sm font-bold text-white">Help & Support</h3>
                          
                          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col gap-4">
                            <div>
                              <h4 className="text-xs font-bold text-white mb-1">📞 Contact Support</h4>
                              <p className="text-[10px] text-slate-400 leading-relaxed">For immediate support regarding delivery schedules, reach us:</p>
                              <div className="flex flex-col gap-1.5 mt-2.5 text-[10px]">
                                <a href="tel:+919791019505" className="text-rose-500 font-bold hover:underline">Phone: +91 9791019505</a>
                                <a href="mailto:support@ironease.com" className="text-rose-500 font-bold hover:underline">Email: support@ironease.com</a>
                              </div>
                            </div>
                            
                            <div className="border-t border-slate-800 pt-3">
                              <h4 className="text-xs font-bold text-white mb-1">💬 WhatsApp Chat</h4>
                              <a 
                                href="https://wa.me/919791019505" 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl mt-2 text-center"
                              >
                                Chat on WhatsApp
                              </a>
                            </div>

                            {/* Owner Admin Gateway Switcher */}
                            <div className="border-t border-slate-800 pt-3 bg-slate-950/60 p-2.5 rounded-xl border border-dashed border-slate-800">
                              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <Key className="size-3.5 text-amber-500 animate-pulse" />
                                Owner Portal Gateway
                              </h4>
                              <p className="text-[9px] text-slate-500 mt-1">If you are the business owner, enter your access PIN to open the dashboard:</p>
                              <div className="flex gap-2 mt-3">
                                <input 
                                  type="password"
                                  maxLength={4}
                                  placeholder="PIN (9791)"
                                  value={adminPin}
                                  onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))}
                                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white w-24 text-center outline-none"
                                />
                                <button 
                                  onClick={handleAdminAccess}
                                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1 rounded-lg"
                                >
                                  Enter Portal
                                </button>
                              </div>
                              <span className="text-[8px] text-slate-500 block mt-2 text-center bg-slate-900 py-1 rounded-md">Admin PIN: <strong>9791</strong></span>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Customer Bottom Navigation Bar */}
                    <div className="border-t border-slate-850 pt-2 flex justify-between bg-slate-900 text-slate-500 -mx-4 px-4 mt-4">
                      {[
                        { tab: 'home', label: 'Home', icon: Smartphone },
                        { tab: 'order', label: 'Book', icon: Plus },
                        { tab: 'prices', label: 'Prices', icon: FileText },
                        { tab: 'history', label: 'Orders', icon: ShoppingBag },
                        { tab: 'support', label: 'Support', icon: HelpCircle }
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
                            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${isActive ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            <Icon className="size-4" />
                            <span className="text-[8px] font-bold">{item.label}</span>
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
              <div className="absolute inset-0 bg-slate-950/90 z-40 flex items-end justify-center p-4 rounded-[40px]">
                <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 text-left flex flex-col gap-4 animate-slide-up">
                  
                  {/* Checkout Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400">IronEase Checkout</h4>
                      <h3 className="text-sm font-extrabold text-white mt-0.5">Pay ₹{calculateTotals().total}</h3>
                    </div>
                    <button onClick={() => setShowCheckoutModal(false)} className="text-xs text-slate-500 hover:text-white">Cancel</button>
                  </div>

                  {/* Payment Options */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Select Payment Mode</label>
                    
                    <button 
                      onClick={() => setPaymentMethod('UPI')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'UPI' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
                    >
                      <CreditCard className="size-4 text-purple-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>UPI Payment (PhonePe, GPay)</span>
                        <div className="text-[8px] opacity-75">Pay digitally using QR/UPI App</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('Card')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'Card' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
                    >
                      <CreditCard className="size-4 text-blue-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>Credit / Debit Card</span>
                        <div className="text-[8px] opacity-75">Visa, MasterCard, RuPay</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('COD')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'COD' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
                    >
                      <ShoppingBag className="size-4 text-emerald-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>Cash on Delivery / Pay on Pickup</span>
                        <div className="text-[8px] opacity-75">Pay when order is picked up</div>
                      </div>
                    </button>
                  </div>

                  {paymentMethod === 'UPI' && (
                    <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col gap-2 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-white flex items-center justify-between">
                        <span>📱 Direct UPI Transfer</span>
                      </div>
                      
                      <div className="flex gap-3 items-center">
                        {upiDetails.id && (
                          <div className="bg-white p-1 rounded shrink-0">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=upi://pay?pa=${upiDetails.id}&pn=IronEase&cu=INR`} 
                              alt="UPI QR Code" 
                              className="w-16 h-16 object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1 flex flex-col gap-1 text-[10px] text-slate-400">
                          <div className="flex justify-between border-b border-slate-900 pb-1">
                            <span>Phone Number:</span>
                            <span className="font-bold text-white select-all">{upiDetails.phone}</span>
                          </div>
                          <div className="flex justify-between pt-0.5">
                            <span>UPI ID:</span>
                            <span className="font-bold text-rose-500 select-all">{upiDetails.id}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[8px] text-slate-500 leading-relaxed italic bg-slate-900/50 p-1.5 rounded">
                        *Scan QR or use details to pay, then click "Confirm & Submit Order".
                      </p>
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
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
              
              {/* Admin Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
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
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-slate-900 border border-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
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
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
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
                      
                      <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Revenue</span>
                        <div className="text-2xl font-extrabold text-white">₹{totalRevenue.toFixed(2)}</div>
                        <span className="text-[9px] text-emerald-500 font-semibold">100% digital payouts</span>
                      </div>

                      <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Pickups</span>
                        <div className="text-2xl font-extrabold text-rose-500">
                          {orders.filter(o => o.status === 'Placed').length}
                        </div>
                        <span className="text-[9px] text-slate-400">Needs immediate assignment</span>
                      </div>

                      <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Active In-process</span>
                        <div className="text-2xl font-extrabold text-amber-500">
                          {orders.filter(o => o.status === 'Picked Up' || o.status === 'Ironing').length}
                        </div>
                        <span className="text-[9px] text-slate-400">Undergoing ironing flow</span>
                      </div>

                      <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Completed orders</span>
                        <div className="text-2xl font-extrabold text-emerald-500">
                          {completedOrders.length}
                        </div>
                        <span className="text-[9px] text-emerald-500 font-semibold">Delivered & Closed</span>
                      </div>

                    </div>

                    {/* Recent Orders Overview */}
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-white">Today&apos;s Active Inbound Pickups</h3>
                      <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
                        {orders.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-500">No active ironing orders right now. Use the Customer Mobile App to place a simulated order!</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[9px] border-b border-slate-850">
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
                                  <tr key={o.id} className="hover:bg-slate-850/50">
                                    <td className="p-3 font-mono font-bold text-rose-500">{o.id}</td>
                                    <td className="p-3">
                                      <div className="font-semibold text-white">{o.customerName}</div>
                                      <div className="text-[9px] text-slate-400">{o.customerPhone}</div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-white truncate max-w-[120px]">{o.apartmentNo}</div>
                                      <div className="text-[9px] text-slate-400 truncate max-w-[120px]">{o.address}</div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-white">{o.pickupDate}</div>
                                      <div className="text-[9px] text-slate-400">{o.pickupTime}</div>
                                    </td>
                                    <td className="p-3 font-semibold text-white">₹{o.total}</td>
                                    <td className="p-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${o.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {o.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      <button 
                                        onClick={() => setAdminActiveTab('orders')}
                                        className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded font-bold text-[9px]"
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
                    <h3 className="text-sm font-bold text-white">All Orders Management Queue</h3>
                    
                    <div className="flex flex-col gap-3">
                      {orders.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-850 p-8 rounded-2xl text-center text-xs text-slate-500">
                          No order records. Try booking an order in the Customer App on the left!
                        </div>
                      ) : (
                        orders.map(o => (
                          <div key={o.id} className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex flex-col lg:flex-row justify-between gap-4">
                            
                            {/* Order Details Left Column */}
                            <div className="flex-1 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-rose-500">{o.id}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${o.speed === 'Urgent' ? 'bg-red-500/20 text-red-400' : o.speed === 'Express' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                                  {o.speed} Delivery
                                </span>
                              </div>
                              <div className="text-xs text-white">
                                <strong>Customer:</strong> {o.customerName} ({o.customerPhone})
                              </div>
                              <div className="text-xs text-slate-400 leading-relaxed">
                                <strong>Apartment:</strong> {o.apartmentNo}
                              </div>
                              <div className="text-xs text-slate-400 leading-relaxed">
                                <strong>Address:</strong> {o.address}
                              </div>
                              
                              {/* Items list */}
                              <div className="text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-850 mt-1 max-w-sm">
                                <div className="font-bold text-white border-b border-slate-800 pb-1 mb-1">Basket Details:</div>
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
                                <div className="text-sm font-extrabold text-white">Total Value: ₹{o.total}</div>
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
                                  className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
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
                      <h3 className="text-sm font-bold text-white">Garment Price Rates Manager</h3>
                      <p className="text-xs text-slate-400 mt-1">Configure pricing categories. Edits immediately apply to the customer booking forms.</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex flex-col gap-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-2">
                        {priceList.map(item => (
                          <div key={item.name} className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-slate-400">{item.name} (₹)</label>
                            <input 
                              type="number"
                              defaultValue={item.price}
                              onChange={e => setEditingPrices(prev => ({ ...prev, [item.name]: parseFloat(e.target.value) || 0 }))}
                              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                            />
                          </div>
                        ))}
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
                    <h3 className="text-sm font-bold text-white">Registered Customer Profiles</h3>
                    
                    <div className="grid gap-3">
                      {customers.map(c => (
                        <div key={c.phone} className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-white">{c.name}</h4>
                            <span className="text-[9px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded font-bold">Active Customer</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex flex-col gap-0.5 border-t border-slate-800/50 pt-2">
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
                    <h3 className="text-sm font-bold text-white">Payment & UPI Settings</h3>
                    
                    <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex flex-col gap-4">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Update your direct UPI details (GPay/PhonePe). These details and a QR code will be dynamically generated for your customers during checkout.
                      </p>
                      
                      <div className="flex flex-col gap-3 max-w-sm">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-slate-400">Merchant Phone Number</label>
                          <input 
                            type="text"
                            value={upiDetails.phone}
                            onChange={e => setUpiDetails({ ...upiDetails, phone: e.target.value })}
                            placeholder="e.g. 9791019505"
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-slate-400">Merchant UPI ID</label>
                          <input 
                            type="text"
                            value={upiDetails.id}
                            onChange={e => setUpiDetails({ ...upiDetails, id: e.target.value })}
                            placeholder="e.g. 9791019505@ybl"
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex gap-4 items-start">
                        <div className="bg-white p-2 rounded-lg">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=${upiDetails.id}&pn=IronEase&cu=INR`} 
                            alt="Live QR Preview" 
                            className="w-[100px] h-[100px]"
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 pt-2 flex-1">
                          <strong>Live QR Preview:</strong>
                          <br />This QR code updates instantly. Customers can scan this directly to pay you on PhonePe, GPay, or Paytm.
                        </div>
                      </div>

                      <button 
                        onClick={() => triggerNotification('✅ UPI Settings Saved Successfully!')}
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
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-left">
            
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">IronEase Invoice</h3>
                <span className="text-[10px] text-slate-500 font-mono">No. {selectedInvoice.invoiceNo}</span>
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
              <div className="text-[10px] text-slate-400 mt-1 font-semibold">{selectedInvoice.apartmentNo}</div>
              <div className="text-[10px] text-slate-400 truncate">{selectedInvoice.address}</div>
            </div>

            {/* Date Details */}
            <div className="grid grid-cols-2 gap-4 text-[10px] border-b border-slate-100 pb-3">
              <div>
                <span className="text-slate-400 block font-semibold">Date of Service:</span>
                <span className="text-slate-800 font-bold">{selectedInvoice.createdAt}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Pickup Slot:</span>
                <span className="text-slate-800 font-bold">{selectedInvoice.pickupDate} ({selectedInvoice.pickupTime})</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="flex-1 flex flex-col gap-2 max-h-[160px] overflow-y-auto">
              <div className="grid grid-cols-12 text-[10px] font-bold uppercase text-slate-400 pb-1 border-b border-slate-100">
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



      {/* Simulation Dashboard Footer */}
      <footer className="border-t border-slate-850 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        <p>© 2026 IronEase Ironing Service Inc. All systems simulated. Workflows are fully responsive and digital ready.</p>
      </footer>

    </div>
  );
}
