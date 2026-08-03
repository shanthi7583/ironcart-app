import { useState, useEffect, useRef } from 'react'
import {
  Plus, Minus, Clock, Check, MapPin,
  TrendingUp, Users, Smartphone,
  ChevronRight, ShoppingBag,
  FileText, CreditCard, ArrowLeft, Settings,
  Bell, HelpCircle, LogOut, Eye, RefreshCw, Key, Star, Navigation, Wallet, X, Phone, Gift, Landmark, Truck, User, Sparkles
} from 'lucide-react'
import { auth as firebaseAuth, RecaptchaVerifier } from './firebaseConfig'
import { signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth'
import { load as loadCashfree } from '@cashfreepayments/cashfree-js'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'

// The SDK's load() re-fetches/re-initializes Cashfree's checkout script, so this
// caches one instance per mode instead of reloading it on every checkout attempt.
let cashfreeInstancePromise: ReturnType<typeof loadCashfree> | null = null;
let cashfreeInstanceMode: 'sandbox' | 'production' | null = null;
function getCashfreeInstance(mode: 'sandbox' | 'production') {
  if (!cashfreeInstancePromise || cashfreeInstanceMode !== mode) {
    cashfreeInstanceMode = mode;
    cashfreeInstancePromise = loadCashfree({ mode });
  }
  return cashfreeInstancePromise;
}

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

// Category picker thumbnails. Deliberately covers both taxonomies that have existed in
// this codebase (the newer Light Weight/Medium-Heavy/Premium/Household set, and the
// older Apparel/Outerwear/Bedding set some deployments' databases were seeded with) so
// the picker never silently shows an empty item list just because a category name
// wasn't in a hardcoded list — anything unrecognized still gets a sensible fallback image.
const CATEGORY_IMAGES: Record<string, string> = {
  'Light Weight': 'https://images.unsplash.com/photo-1544441893-675973e31985?w=400&h=300&fit=crop',
  'Medium/Heavy': 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400&h=300&fit=crop',
  'Premium': 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=300&fit=crop',
  'Household': 'https://images.unsplash.com/photo-1616627561950-9f746e330187?w=400&h=300&fit=crop',
  'Apparel': 'https://images.unsplash.com/photo-1544441893-675973e31985?w=400&h=300&fit=crop',
  'Outerwear': 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400&h=300&fit=crop',
  'Bedding': 'https://images.unsplash.com/photo-1616627561950-9f746e330187?w=400&h=300&fit=crop'
};
const FALLBACK_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=300&fit=crop';

// Pre-login hero carousel — three rotating slides shown above the phone-number form.
const LOGIN_HERO_SLIDES = [
  {
    img: 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=800&h=1000&fit=crop',
    title: 'Steam-Pressed to Perfection',
    subtitle: 'Fabric-safe steam care — no burns, no shine, just crisp results.'
  },
  {
    img: 'https://images.unsplash.com/photo-1620455800201-7f00aeef12ed?w=800&h=1000&fit=crop',
    title: 'Doorstep Pickup, Zero Hassle',
    subtitle: 'Schedule a pickup in seconds — we handle the rest, door to door.'
  },
  {
    img: 'https://images.unsplash.com/photo-1616627561950-9f746e330187?w=800&h=1000&fit=crop',
    title: 'Fresh, Folded, On Time',
    subtitle: 'Every order quality-checked and delivered back within 24 hours.'
  }
];

export default function App() {
  // --- Persistent State using Backend API & LocalStorage ---
  // The native app has no origin of its own (Capacitor serves the bundle from a local
  // WebView host), so a relative '/api' would resolve to that local host instead of the
  // real backend — it must always use the absolute production URL there.
  const API_URL = Capacitor.isNativePlatform()
    ? 'https://pressngo-app.vercel.app/api'
    : (import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api'));

  // Signed session token issued by the backend after OTP or admin-PIN verification.
  // Sent as a Bearer token on every authenticated request instead of trusting the client.
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('iron_session_token'));
  const authHeaders = (extra?: Record<string, string>) => ({
    'Content-Type': 'application/json',
    ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
    ...extra
  });
  const setSession = (token: string | null) => {
    setSessionToken(token);
    if (token) localStorage.setItem('iron_session_token', token);
    else localStorage.removeItem('iron_session_token');
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [priceList, setPriceList] = useState<GarmentItem[]>(DEFAULT_PRICE_LIST);
  
  const DEFAULT_OFFERS = [
    { name: 'Everyday', img: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=200&h=200&fit=crop', cat: 'Light Weight' },
    { name: 'Party Wear', img: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=200&h=200&fit=crop', cat: 'Medium/Heavy' },
    { name: 'Premium', img: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=200&h=200&fit=crop', cat: 'Premium' },
    { name: 'Home', img: 'https://images.unsplash.com/photo-1616627561950-9f746e330187?w=200&h=200&fit=crop', cat: 'Household' }
  ];
  const [flashOffers, setFlashOffers] = useState<{name: string, img: string, cat: string}[]>(DEFAULT_OFFERS);
  const [editingOffers, setEditingOffers] = useState<{name: string, img: string, cat: string}[]>(DEFAULT_OFFERS);

  const DEFAULT_FESTIVE_OFFER = {
    enabled: false,
    title: 'Diwali Special Offer',
    subtitle: 'Get 20% off on all Premium Dry Cleaning!',
    img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop'
  };
  const [festiveOffer, setFestiveOffer] = useState<{enabled: boolean, title: string, subtitle: string, img: string}>(DEFAULT_FESTIVE_OFFER);
  const [editingFestive, setEditingFestive] = useState<{enabled: boolean, title: string, subtitle: string, img: string}>(DEFAULT_FESTIVE_OFFER);
  
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  
  const [currentCustomer, setCurrentCustomer] = useState<CustomerProfile | null>(() => {
    const saved = localStorage.getItem('iron_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Everything now goes through the Express API instead of talking to Supabase directly
  // from the browser. The old direct-to-Supabase path shipped a working read/write
  // client (URL + anon key) inside the public JS bundle, which meant anyone could read
  // or delete the entire orders/customers tables from devtools regardless of any RLS
  // that may or may not have been configured. The API now checks a signed session
  // token on every request instead.
  const fetchMyOrders = (token: string) => {
    fetch(`${API_URL}/orders/mine`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => setOrders(data))
      .catch(err => console.error('Failed to fetch orders:', err));
  };

  const fetchAllOrdersAndCustomers = (token: string) => {
    fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => setOrders(data))
      .catch(err => console.error('Failed to fetch orders:', err));

    fetch(`${API_URL}/customers`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => setCustomers(data))
      .catch(err => console.error('Failed to fetch customers:', err));
  };

  // Fetch the public price/offers catalog (no auth needed — it's meant to be seen by anyone)
  useEffect(() => {
    fetch(`${API_URL}/prices`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const upiRow = data.find((p: any) => p.category === 'system' && (p.item_name === 'upi_details' || p.name === 'upi_details'));
          if (upiRow && upiRow.icon) {
            const [phone, id] = upiRow.icon.split('|');
            setUpiDetails({ phone, id });
          }
          const offersRow = data.find((p: any) => p.category === 'system' && (p.item_name === 'flash_offers' || p.name === 'flash_offers'));
          if (offersRow && offersRow.icon) {
            try {
              const parsed = JSON.parse(offersRow.icon);
              setFlashOffers(parsed);
              setEditingOffers(parsed);
            } catch(e) {}
          }
          const festiveRow = data.find((p: any) => p.category === 'system' && (p.item_name === 'festive_offer' || p.name === 'festive_offer'));
          if (festiveRow && festiveRow.icon) {
            try {
              const parsed = JSON.parse(festiveRow.icon);
              setFestiveOffer(parsed);
              setEditingFestive(parsed);
            } catch(e) {}
          }
          const garments = data.filter((p: any) => p.category !== 'system');
          const mapped = garments.map((p: any) => ({
            name: p.item_name || p.name,
            price: p.price,
            category: p.category,
            icon: p.icon || '👕',
            serviceType: p.service_type || p.serviceType || 'Ironing'
          }));
          setPriceList(mapped);
        }
      })
      .catch(err => console.error('Failed to fetch prices:', err));
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

  // Load whichever order/customer data this session is entitled to see, once we know
  // who's logged in (and again whenever the role changes, e.g. customer -> admin).
  useEffect(() => {
    if (!sessionToken) return;
    if (viewMode === 'dual' || viewMode === 'rider' || viewMode === 'admin') {
      fetchAllOrdersAndCustomers(sessionToken);
    } else if (currentCustomer) {
      fetchMyOrders(sessionToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, viewMode]);
  const [customerActiveTab, setCustomerActiveTab] = useState<'home' | 'order' | 'prices' | 'history' | 'support' | 'subscriptions' | 'rewards' | 'notifications' | 'profile'>('home');
  const [adminActiveTab, setAdminActiveTab] = useState<'overview' | 'orders' | 'prices' | 'customers' | 'settings' | 'offers'>('overview');
  const userSubscription = currentCustomer?.activePlan || 'None';
  const [upiDetails, setUpiDetails] = useState<{ phone: string, id: string }>(() => {
    const saved = localStorage.getItem('iron_upi_details');
    return saved ? JSON.parse(saved) : { phone: '9791019505', id: '9791019505@ybl' };
  });

  const [currentSlide, setCurrentSlide] = useState(0);
  const slideImages = [
    "https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=800&h=400&fit=crop", // Steam Ironing
    "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=800&h=400&fit=crop", // Laundry
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=400&fit=crop", // Dry Cleaning
    "https://images.unsplash.com/photo-1616627561950-9f746e330187?w=800&h=400&fit=crop"  // Linens/Curtains
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slideImages.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('iron_upi_details', JSON.stringify(upiDetails));
  }, [upiDetails]);


  // Customer Form / Auth State
  const [authStep, setAuthStep] = useState<'welcome' | 'login' | 'otp' | 'register'>('welcome');
  const [authPhone, setAuthPhone] = useState('');
  const [authName, setAuthName] = useState('');
  const [authApartment, setAuthApartment] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authReferredBy, setAuthReferredBy] = useState('');
  const [authOTP, setAuthOTP] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  // Set only when Firebase handled this OTP round — verification then goes through
  // Firebase's own confirm() rather than our /api/auth/verify-otp fallback.
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);

  const [loginHeroIndex, setLoginHeroIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setLoginHeroIndex(i => (i + 1) % LOGIN_HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown > 0]);

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

  // Whatever categories actually exist in the loaded price catalog for the selected
  // service — jump to a real one whenever the current selection doesn't exist there
  // (first load, or after switching service type), instead of silently showing nothing.
  useEffect(() => {
    const categoriesForService = Array.from(new Set(priceList.filter(p => p.serviceType === selectedService).map(p => p.category)));
    if (categoriesForService.length > 0 && !categoriesForService.includes(activeCategory)) {
      setActiveCategory(categoriesForService[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceList, selectedService]);
  const [showConsoleInput, setShowConsoleInput] = useState(false);

  // Cancel & Reschedule Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  
  
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
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

  useEffect(() => {
    if (currentCustomer) {
      setOrderName(currentCustomer.name || '');
      setOrderPhone(currentCustomer.phone || '');
      if (currentCustomer.addresses && currentCustomer.addresses.length > 0) {
        setOrderAddress(currentCustomer.addresses[0].fullAddress);
      } else {
        setOrderAddress(currentCustomer.address || '');
      }
    } else {
      setOrderName('');
      setOrderPhone('');
      setOrderAddress('');
    }
  }, [currentCustomer]);
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
  const [confirmedQuote, setConfirmedQuote] = useState<{ subtotal: number, discount: number, tax: number, total: number, couponApplied: string } | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [modalConfig, setModalConfig] = useState<{title: string, message: string, type: 'alert'|'confirm', onConfirm?: ()=>void} | null>(null);
  const [toastMessage, setToastMessage] = useState<{message: string, type: 'success'|'error'|'info'} | null>(null);

  const customAlert = (message: string) => {
    setToastMessage({ message, type: 'error' });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const customConfirm = (message: string, onConfirm: () => void) => {
    setModalConfig({ title: 'Confirm Action', message, type: 'confirm', onConfirm });
  };

  // Show simulated WhatsApp / System Notification banners
  const triggerNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // --- Auth Handlers ---
  // The OTP itself never comes back to the browser. Phone verification happens
  // entirely through Firebase's own transactional SMS route (invisible reCAPTCHA +
  // signInWithPhoneNumber), and the resulting ID token is independently re-checked
  // server-side with Firebase Admin before we issue our own session token — there is
  // no client-side bypass. There is deliberately no fallback to any other SMS
  // provider: a fallback that silently degrades to a slower, unfunded, or
  // DND-blocked route is worse than a clear "please try again" error.
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  // Tracks the in-flight render() so handleSendOTP can wait for it instead of racing
  // it — calling verify() while a render() on the same container is still pending
  // makes grecaptcha throw "reCAPTCHA has already been rendered in this element".
  const recaptchaRenderPromiseRef = useRef<Promise<unknown> | null>(null);
  // Native (Android/iOS) phone auth goes through @capacitor-firebase/authentication
  // instead of the web JS SDK's reCAPTCHA flow — Firebase's reCAPTCHA verification is
  // unreliable inside a WebView regardless of dashboard config (App Check, API key
  // restrictions, and Android app registration were all confirmed correct/absent and
  // it still failed with auth/invalid-app-credential). The native plugin uses Play
  // Integrity attestation instead, which has no such WebView-trust problem.
  const nativeVerificationIdRef = useRef<string | null>(null);

  // Pre-warm the invisible reCAPTCHA as soon as the login screen mounts — building it
  // lazily on the first "Send OTP" tap made that first attempt eat several extra
  // seconds (sometimes long enough to time out) loading Google's recaptcha script.
  // Not needed (or wanted) on native, which uses the plugin's own verification flow.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!firebaseAuth || currentCustomer || authStep !== 'login') return;
    if (recaptchaVerifierRef.current) return;
    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible'
      });
      recaptchaRenderPromiseRef.current = recaptchaVerifierRef.current.render().catch(err => {
        console.error('Recaptcha pre-render failed:', err);
      });
    } catch (err) {
      console.error('Recaptcha pre-init failed:', err);
    }
  }, [currentCustomer, authStep]);

  const handleSendOTP = async () => {
    if (!authPhone || authPhone.length < 10) {
      customAlert('Please enter a valid 10-digit mobile number');
      return;
    }

    if (Capacitor.isNativePlatform()) {
      let codeSentListener: { remove: () => void } | null = null;
      let failedListener: { remove: () => void } | null = null;
      const cleanup = () => {
        codeSentListener?.remove();
        failedListener?.remove();
      };
      try {
        codeSentListener = await FirebaseAuthentication.addListener('phoneCodeSent', event => {
          nativeVerificationIdRef.current = event.verificationId;
          setAuthStep('otp');
          setResendCooldown(30);
          triggerNotification(`💬 OTP sent to +91 ${authPhone}!`);
          cleanup();
        });
        failedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', event => {
          console.error('Native phone verification failed:', event.message);
          customAlert('Could not send OTP right now. Please try again in a moment.');
          cleanup();
        });
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: `+91${authPhone}` });
      } catch (err) {
        console.error('Native phone sign-in failed:', err);
        cleanup();
        customAlert('Could not send OTP right now. Please try again in a moment.');
      }
      return;
    }

    if (!firebaseAuth) {
      customAlert('Sign-in is not available right now. Please try again in a moment.');
      return;
    }

    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
          size: 'invisible'
        });
        recaptchaRenderPromiseRef.current = recaptchaVerifierRef.current.render();
      }
      // Wait out any still-in-flight render (pre-warm, or the one just started above)
      // before handing the verifier to signInWithPhoneNumber.
      if (recaptchaRenderPromiseRef.current) {
        await recaptchaRenderPromiseRef.current;
      }
      signInWithPhoneNumber(firebaseAuth, `+91${authPhone}`, recaptchaVerifierRef.current)
        .then(confirmationResult => {
          setFirebaseConfirmation(confirmationResult);
          setAuthStep('otp');
          setResendCooldown(30);
          triggerNotification(`💬 OTP sent to +91 ${authPhone}!`);
        })
        .catch(err => {
          console.error('Firebase send OTP failed:', err);
          recaptchaVerifierRef.current?.clear();
          recaptchaVerifierRef.current = null;
          recaptchaRenderPromiseRef.current = null;
          customAlert('Could not send OTP right now. Please try again in a moment.');
        });
    } catch (err) {
      console.error('Firebase RecaptchaVerifier setup failed:', err);
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      recaptchaRenderPromiseRef.current = null;
      customAlert('Could not send OTP right now. Please try again in a moment.');
    }
  };

  const completeFirebaseLogin = async (idToken: string) => {
    const res = await fetch(`${API_URL}/auth/firebase-login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ idToken })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Sign-in failed');
    setSession(data.token);
    if (data.exists && data.customer) {
      setCurrentCustomer(data.customer);
      setCustomerActiveTab('home');
    } else {
      setAuthStep('register');
    }
  };

  const handleVerifyOTP = () => {
    if (Capacitor.isNativePlatform()) {
      if (!nativeVerificationIdRef.current) {
        customAlert('Your verification session expired. Please request a new OTP.');
        setAuthStep('login');
        return;
      }
      FirebaseAuthentication.confirmVerificationCode({
        verificationId: nativeVerificationIdRef.current,
        verificationCode: authOTP
      })
        .then(async () => {
          const { token: idToken } = await FirebaseAuthentication.getIdToken();
          if (!idToken) throw new Error('Sign-in failed');
          await completeFirebaseLogin(idToken);
        })
        .catch(err => {
          customAlert(err.message || 'Invalid OTP. Please try again.');
        });
      return;
    }

    if (!firebaseConfirmation) {
      customAlert('Your verification session expired. Please request a new OTP.');
      setAuthStep('login');
      return;
    }

    firebaseConfirmation.confirm(authOTP)
      .then(async result => {
        const idToken = await result.user.getIdToken();
        await completeFirebaseLogin(idToken);
      })
      .catch(err => {
        customAlert(err.message || 'Invalid OTP. Please try again.');
      });
  };

  const handleRegister = () => {
    if (!authName.trim() || !authApartment.trim() || authAddress.trim().length < 5) {
      customAlert('Please enter a valid name, apartment number, and full street address (at least 5 characters).');
      return;
    }
    const newProfile = {
      name: authName,
      apartmentNo: authApartment,
      address: authAddress,
      referredBy: authReferredBy.trim() ? authReferredBy.trim().toUpperCase() : undefined
    };

    fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(newProfile)
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        setCustomers(prev => [...prev, data]);
        setCurrentCustomer(data);
        setAuthPhone('');
        setAuthOTP('');
        triggerNotification(`🎉 Welcome to PressGo, ${data.name}!`);
      })
      .catch(err => {
        customAlert('Could not complete registration: ' + err.message + '. Please try again.');
      });
  };

  const handleLogout = () => {
    localStorage.removeItem('iron_current_user');
    setSession(null);
    setCurrentCustomer(null);
    setAuthStep('welcome');
    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.signOut().catch(() => {});
      nativeVerificationIdRef.current = null;
    } else {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    }
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
      Object.entries(selectedItems).forEach(([key, qty]) => {
        const item = priceList.find(p => `${p.serviceType}-${p.name}` === key);
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
  // Raw {serviceType, name, qty} identifiers only — never a price. The server looks up
  // its own authoritative price for each and computes the total; that's the whole point.
  const buildCartItems = () => Object.entries(selectedItems)
    .filter(([_, qty]) => qty > 0)
    .map(([key, qty]) => {
      const pItem = priceList.find(p => `${p.serviceType}-${p.name}` === key);
      return pItem ? { serviceType: pItem.serviceType, name: pItem.name, qty } : null;
    })
    .filter((x): x is { serviceType: string, name: string, qty: number } => x !== null);

  const handlePlaceOrder = () => {
    if (isCreatingCheckout) return; // guard against double-tap creating duplicate gateway sessions
    const { subtotal } = calculateTotals();
    const cartItems = buildCartItems();

    if (!orderName.trim() || !orderPhone.trim() || orderAddress.trim().length < 5) {
      customAlert('Please fill out all pickup details (Name, Phone, and Full Address) correctly.');
      return;
    }

    if (subtotal === 0 || cartItems.length === 0) {
      customAlert('Please add at least one garment to your basket');
      return;
    }
    if (!pickupDate) {
      customAlert('Please select a pickup date');
      return;
    }

    setIsCreatingCheckout(true);
    // Ask the server for a real, priced quote and create the payment gateway session
    // against that — never against whatever total the browser computed.
    fetch(`${API_URL}/payments/create-order`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ cartItems, couponCode: appliedCoupon })
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
        setGatewayOrderData(data);
        setConfirmedQuote(data.quote || null);
        triggerNotification(`🏦 Payment Gateway Session: ${data.gatewayOrderId} created!`);
        setShowCheckoutModal(true);
      })
      .catch(err => {
        customAlert('Failed to connect to checkout gateway: ' + err.message);
      })
      .finally(() => setIsCreatingCheckout(false));
  };

  // Shared by the normal in-page-modal flow and by resumeAfterCashfreeRedirect (native
  // full-page checkout can't run a .then() continuation after redirecting away).
  const submitOrder = (newOrder: any) => {
    fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(newOrder)
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to place order');
        setOrders(prev => [data, ...prev]);
        setSelectedItems({});
        setSpecialInstructions('');
        setShowCheckoutModal(false);
        setConfirmedQuote(null);
        setSelectedOrderForTracking(data);
        setCustomerActiveTab('history');
        triggerNotification(`🎉 Order Placed Successfully! We care for your clothes as much as you do! ❤️`);
        if (newOrder.paymentMethod?.startsWith('Wallet') && currentCustomer) {
          fetch(`${API_URL}/customers/${currentCustomer.phone}`, { headers: authHeaders() })
            .then(res => res.ok ? res.json() : null)
            .then(refreshed => { if (refreshed) setCurrentCustomer(refreshed); });
          fetchWalletTransactions();
        }
      })
      .catch(err => customAlert(err.message || 'API Connection Error, please try again.'))
      .finally(() => setIsSubmittingOrder(false));
  };

  // Split out from confirmOrderPayment so the native pre-redirect path (which has to
  // persist the order before Cashfree takes over the whole page) can build the exact
  // same object without duplicating every field.
  const buildNewOrder = (cashfreeDetails?: { orderId: string }) => {
    const newOrder: any = {
      id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      invoiceNo: `IC-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: orderName || 'Walk-in Customer',
      customerPhone: orderPhone || '',
      apartmentNo: currentCustomer?.apartmentNo || '',
      address: orderAddress || '',
      pickupDate,
      pickupTime,
      speed: orderSpeed,
      service: selectedService,
      cartItems: buildCartItems(),
      couponCode: appliedCoupon,
      status: 'Placed',
      paymentMethod: cashfreeDetails ? `${paymentMethod} (Txn: ${cashfreeDetails.orderId})` : paymentMethod,
      specialInstructions,
      createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    // The server independently decides the real paymentStatus (asking Cashfree what
    // actually happened to this order_id, or deducting the wallet balance itself) —
    // this is just its input.
    if (cashfreeDetails) {
      newOrder.cashfreeOrderId = cashfreeDetails.orderId;
    }
    return newOrder;
  };

  const confirmOrderPayment = (cashfreeDetails?: { orderId: string }) => {
    // isSubmittingOrder is already set by handleCheckoutSubmit before this runs (immediately
    // for COD/Wallet, or later once the Cashfree checkout modal closes) — just clear it when done.
    submitOrder(buildNewOrder(cashfreeDetails));
  };

  const handleCheckoutSubmit = () => {
    if (isSubmittingOrder) return; // guard against double-tap while a submission is already in flight
    setIsSubmittingOrder(true);

    if (paymentMethod === 'Wallet') {
      const total = confirmedQuote?.total ?? calculateTotals().total;
      if (!currentCustomer || (currentCustomer.walletBalance || 0) < total) {
        customAlert('Insufficient wallet balance! Please add funds or choose another payment method.');
        setIsSubmittingOrder(false);
        return;
      }
      // The wallet is checked and debited server-side inside order creation itself,
      // so there's nothing to do here but place the order.
      confirmOrderPayment();
      return;
    }

    if ((paymentMethod === 'UPI' || paymentMethod === 'Card' || paymentMethod === 'NetBanking') && gatewayOrderData?.liveMode) {
      // The gateway order created back in handlePlaceOrder (before the customer had
      // picked a method) can't be restricted to one method yet, so Cashfree's checkout
      // would show every method it has enabled — Card, UPI, NetBanking, Pay Later,
      // Cardless EMI, wallets, all of it. Now that we know exactly which method they
      // picked, create a fresh, correctly-restricted order for it before opening
      // checkout, so the customer only ever sees the one method they chose.
      const methodCode = paymentMethod === 'UPI' ? 'upi' : paymentMethod === 'Card' ? 'cc,dc' : 'nb';
      fetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ cartItems: buildCartItems(), couponCode: appliedCoupon, currency: 'INR', paymentMethods: methodCode })
      })
        .then(async res => {
          const restrictedOrder = await res.json().catch(() => ({}));
          if (!res.ok || !restrictedOrder.paymentSessionId) throw new Error(restrictedOrder.error || 'Failed to prepare payment');

          // Cashfree's in-page modal (redirectTarget: '_modal') depends on a native JS
          // bridge (PaymentJSInterface) that only exists in Cashfree's own native Android
          // SDK — inside a plain Capacitor WebView it throws and the checkout hangs on
          // "Processing…" forever. Native platforms use a full-page redirect instead,
          // persisting the order first since Cashfree's return_url brings the app back
          // as a fresh page load with no in-memory state left — see
          // resumeAfterCashfreeRedirect, which picks this back up.
          const cashfree = await getCashfreeInstance(restrictedOrder.cashfreeEnv === 'production' ? 'production' : 'sandbox');
          if (Capacitor.isNativePlatform()) {
            localStorage.setItem('pendingCashfreeOrder', JSON.stringify({
              gatewayOrderId: restrictedOrder.gatewayOrderId,
              order: buildNewOrder({ orderId: restrictedOrder.gatewayOrderId })
            }));
            await cashfree.checkout({
              paymentSessionId: restrictedOrder.paymentSessionId,
              redirectTarget: '_self'
            });
            return;
          }
          const result: any = await cashfree.checkout({
            paymentSessionId: restrictedOrder.paymentSessionId,
            redirectTarget: '_modal'
          });
          if (result?.error) {
            // User closed the modal, or the attempt failed inside it — nothing to verify.
            setIsSubmittingOrder(false);
            return;
          }
          // Whatever the modal reported, Cashfree's own Get Order status is the only
          // thing worth trusting — confirmOrderPayment hands that off to the server.
          confirmOrderPayment({ orderId: restrictedOrder.gatewayOrderId });
        })
        .catch((err: any) => {
          console.error('Cashfree checkout failed:', err);
          customAlert('Could not open the payment gateway. Please try again.');
          setIsSubmittingOrder(false);
        });
    } else {
      // Demo Mode or COD
      confirmOrderPayment();
    }
  };

  // --- Admin Actions ---
  const updateOrderStatus = (orderId: string, nextStatus: 'Placed' | 'Picked Up' | 'Ironing' | 'Ready' | 'Delivered') => {
    const order = orders.find(o => o.id === orderId);
    if (order && order.customerPhone) {
      const statuses: Record<string, string> = {
        'Picked Up': `Hello ${order.customerName}, your garments for order *${order.id}* have been Picked Up! 🛵💨`,
        'Ironing': `Hi ${order.customerName}, your garments for order *${order.id}* are currently being Ironed & Processed! 👔✨`,
        'Ready': `Great news ${order.customerName}! Your order *${order.id}* is Ready for delivery. 🎉`,
        'Delivered': `Thank you ${order.customerName}! 🌟\n\nYour garments for order *${order.id}* have been successfully Delivered.\n\n*--- INVOICE ---*\nTotal Amount: ₹${order.total}\nPayment Status: ${order.paymentStatus} (${order.paymentMethod})\n\nWe hope you love the crisp finish! 👔✨`
      };
      if (statuses[nextStatus]) {
        const whatsappUrl = `https://wa.me/91${order.customerPhone}?text=${encodeURIComponent(statuses[nextStatus])}`;
        window.open(whatsappUrl, '_blank');
      }
    }

    let payload: any = { status: nextStatus };
    if (nextStatus === 'Delivered' && order?.paymentStatus === 'Pending') {
      payload.paymentStatus = 'Paid';
    }

    fetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data } : o));
        triggerNotification(`Order ${orderId} updated to ${nextStatus}!`);
      })
      .catch(err => customAlert('API Connection Error: ' + err.message));
  };

  const markOrderPaid = (orderId: string) => {
    fetch(`${API_URL}/orders/${orderId}/payment`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ paymentStatus: 'Paid' })
    })
      .then(res => res.json())
      .then(data => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data } : o));
        triggerNotification(`💳 Payment received for order ${orderId}`);
      })
      .catch(err => customAlert('API Connection Error: ' + err.message));
  };

  const deleteOrder = (orderId: string) => {
    customConfirm('Delete this order record?', () => {
      fetch(`${API_URL}/orders/${orderId}`, { method: 'DELETE', headers: authHeaders() })
        .then(res => {
          if (!res.ok) throw new Error('Failed to delete order');
          setOrders(prev => prev.filter(o => o.id !== orderId));
        })
        .catch(err => customAlert('Could not delete order: ' + err.message));
    });
  };

  const saveAdminPrices = () => {
    const updated = priceList.map(item => {
      const key = `${item.serviceType}-${item.name}`;
      if (editingPrices[key] !== undefined) {
        return { ...item, price: editingPrices[key] };
      }
      return item;
    });

    fetch(`${API_URL}/prices`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updated)
    })
      .then(res => res.json())
      .then(data => {
        setPriceList(data.prices);
        setEditingPrices({});
        triggerNotification(`⚙️ Price rates updated successfully!`);
      })
      .catch(err => customAlert('API Connection Error: ' + err.message));
  };

  const saveUpiSettings = () => {
    fetch(`${API_URL}/settings/upi`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(upiDetails)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save');
        triggerNotification('✅ UPI Settings Saved to Database!');
      })
      .catch(err => customAlert('API Connection Error: ' + err.message));
  };

  const handleAdminAccess = () => {
    fetch(`${API_URL}/auth/admin-login`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ pin: adminPin })
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Invalid PIN');
        setSession(data.token);
        setAdminPin('');
        setShowConsoleInput(false);
        if (data.role === 'admin') {
          setViewMode('dual');
          triggerNotification('🔓 Admin mode activated successfully!');
        } else {
          setViewMode('rider');
          triggerNotification('🏍️ Rider mode activated successfully!');
        }
      })
      .catch(err => customAlert(err.message || 'Invalid PIN.'));
  };

  // Metrics calculations
  const completedOrders = orders.filter(o => o.status === 'Delivered');
  const totalRevenue = orders.filter(o => o.paymentStatus === 'Paid').reduce((acc, o) => acc + o.total, 0);

  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addMoneyAmount, setAddMoneyAmount] = useState('');
  const [showWalletHistory, setShowWalletHistory] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<{ id: string, type: 'credit' | 'debit', amount: number, description: string, createdAt: string }[]>([]);

  const fetchWalletTransactions = () => {
    fetch(`${API_URL}/wallet/transactions`, { headers: authHeaders() })
      .then(res => res.ok ? res.json() : [])
      .then(data => setWalletTransactions(data))
      .catch(() => {});
  };

  const handleRescheduleOrder = () => {
    if (!selectedOrderForTracking) return;
    if (!rescheduleDate || !rescheduleTime) {
      customAlert("Please select a new date and time slot.");
      return;
    }

    fetch(`${API_URL}/orders/${selectedOrderForTracking.id}/reschedule`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ pickupDate: rescheduleDate, pickupTime: rescheduleTime })
    })
      .then(res => res.json())
      .then(updated => {
        setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
        setSelectedOrderForTracking(prev => prev ? { ...prev, ...updated } : null);
        setShowRescheduleModal(false);
        triggerNotification(`🔔 Order ${updated.id} rescheduled to ${updated.pickupDate}`);
      })
      .catch(err => customAlert('Failed to reschedule order: ' + err.message));
  };

  const handleCancelOrder = () => {
    if (!selectedOrderForTracking) return;
    if (!cancelReasonInput.trim()) {
      customAlert("Please provide a reason for cancellation.");
      return;
    }

    const paymentStatusUpdate = selectedOrderForTracking.paymentStatus === 'Pending' ? 'Cancelled' : selectedOrderForTracking.paymentStatus;
    fetch(`${API_URL}/orders/${selectedOrderForTracking.id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
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
      .catch(err => customAlert('Failed to cancel order: ' + err.message));
  };
  
  const [newAddressLabel, setNewAddressLabel] = useState('Home');
  const [newAddressText, setNewAddressText] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);


  const [checkoutAddAmount, setCheckoutAddAmount] = useState('');

  // Shared by the "Add Money" and in-checkout top-up buttons: creates a Cashfree order,
  // then hands the resulting payment (or nothing, in demo mode) to the server, which is
  // the only party that actually credits the wallet — the client can no longer just
  // tell the API what the new balance should be.
  // Promoted out of topUpWallet so resumeAfterCashfreeRedirect can also call it once
  // the native full-page checkout redirects back with no in-memory onDone to run.
  const creditWalletTopup = async (amount: number, cashfreeDetails?: { orderId: string }, onDone?: () => void) => {
    const payload: any = { amount };
    if (cashfreeDetails) {
      payload.cashfreeOrderId = cashfreeDetails.orderId;
    }
    const verifyRes = await fetch(`${API_URL}/payments/verify-wallet-topup`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const updated = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) {
      customAlert(updated.error || 'Could not verify payment.');
      return;
    }
    setCurrentCustomer(updated);
    fetchWalletTransactions();
    customAlert(`₹${amount} added to wallet successfully!`);
    onDone?.();
  };

  const topUpWallet = async (amount: number, onDone: () => void) => {
    if (!currentCustomer || !amount || amount <= 0) return;

    try {
      const res = await fetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount, currency: 'INR', paymentMethods: 'nb,cc,dc' })
      });
      const gatewayOrderData = await res.json();

      if (gatewayOrderData.liveMode) {
        const cashfree = await getCashfreeInstance(gatewayOrderData.cashfreeEnv === 'production' ? 'production' : 'sandbox');
        // See the order-checkout branch above for why native uses a full-page redirect
        // instead of Cashfree's in-page modal.
        if (Capacitor.isNativePlatform()) {
          localStorage.setItem('pendingCashfreeWalletTopup', JSON.stringify({
            gatewayOrderId: gatewayOrderData.gatewayOrderId,
            amount
          }));
          await cashfree.checkout({
            paymentSessionId: gatewayOrderData.paymentSessionId,
            redirectTarget: '_self'
          });
          return;
        }
        const result: any = await cashfree.checkout({
          paymentSessionId: gatewayOrderData.paymentSessionId,
          redirectTarget: '_modal'
        });
        if (result?.error) return; // user closed the modal or the attempt failed
        await creditWalletTopup(amount, { orderId: gatewayOrderData.gatewayOrderId }, onDone);
      } else {
        await creditWalletTopup(amount, undefined, onDone);
      }
    } catch (e) {
      console.error(e);
      customAlert('Failed to initialize payment gateway.');
    }
  };

  const handleAddFunds = async () => {
    const amount = parseInt(addMoneyAmount);
    await topUpWallet(amount, () => { setShowAddMoney(false); setAddMoneyAmount(''); });
  };

  const handleCheckoutAddFunds = async () => {
    const amount = parseInt(checkoutAddAmount);
    await topUpWallet(amount, () => setCheckoutAddAmount(''));
  };

  // Promoted out of handleSubscribe so resumeAfterCashfreeRedirect can also call it.
  const activateSubscriptionPlan = async (planName: string, cashfreeDetails?: { orderId: string }) => {
    const payload: any = { planName };
    if (cashfreeDetails) {
      payload.cashfreeOrderId = cashfreeDetails.orderId;
    }
    const activateRes = await fetch(`${API_URL}/subscriptions/activate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const updated = await activateRes.json().catch(() => ({}));
    if (!activateRes.ok) {
      customAlert(updated.error || 'Could not activate plan.');
      return;
    }
    setCurrentCustomer(updated);
    triggerNotification(`🎉 ${planName} Subscription Activated!`);
  };

  // Activating a Prime plan used to just PUT the plan name onto the customer record —
  // meaning anyone could grant themselves a permanent order discount for free. Now it
  // goes through the same pay-then-verify flow as everything else.
  const handleSubscribe = async (planName: string) => {
    if (!currentCustomer) return;

    try {
      const res = await fetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planName, currency: 'INR' })
      });
      const gatewayOrderData = await res.json();

      if (gatewayOrderData.liveMode) {
        const cashfree = await getCashfreeInstance(gatewayOrderData.cashfreeEnv === 'production' ? 'production' : 'sandbox');
        // See the order-checkout branch above for why native uses a full-page redirect
        // instead of Cashfree's in-page modal.
        if (Capacitor.isNativePlatform()) {
          localStorage.setItem('pendingCashfreeSubscription', JSON.stringify({
            gatewayOrderId: gatewayOrderData.gatewayOrderId,
            planName
          }));
          await cashfree.checkout({
            paymentSessionId: gatewayOrderData.paymentSessionId,
            redirectTarget: '_self'
          });
          return;
        }
        const result: any = await cashfree.checkout({
          paymentSessionId: gatewayOrderData.paymentSessionId,
          redirectTarget: '_modal'
        });
        if (result?.error) return; // user closed the modal or the attempt failed
        await activateSubscriptionPlan(planName, { orderId: gatewayOrderData.gatewayOrderId });
      } else {
        await activateSubscriptionPlan(planName);
      }
    } catch (e) {
      console.error(e);
      customAlert('Failed to initialize payment gateway.');
    }
  };

  // Finishes whichever Cashfree action (order/wallet top-up/subscription) was pending
  // before the native full-page checkout took over the WebView, using whatever was
  // stashed in localStorage beforehand — the redirect back wipes all in-memory state.
  const resolvePendingCashfreeAction = (cfOrderId: string) => {
    const pendingOrderRaw = localStorage.getItem('pendingCashfreeOrder');
    if (pendingOrderRaw) {
      localStorage.removeItem('pendingCashfreeOrder');
      const pending = JSON.parse(pendingOrderRaw);
      if (pending.gatewayOrderId === cfOrderId) {
        setIsSubmittingOrder(true);
        submitOrder(pending.order);
      }
      return;
    }
    const pendingWalletRaw = localStorage.getItem('pendingCashfreeWalletTopup');
    if (pendingWalletRaw) {
      localStorage.removeItem('pendingCashfreeWalletTopup');
      const pending = JSON.parse(pendingWalletRaw);
      if (pending.gatewayOrderId === cfOrderId) {
        creditWalletTopup(pending.amount, { orderId: cfOrderId });
      }
      return;
    }
    const pendingSubRaw = localStorage.getItem('pendingCashfreeSubscription');
    if (pendingSubRaw) {
      localStorage.removeItem('pendingCashfreeSubscription');
      const pending = JSON.parse(pendingSubRaw);
      if (pending.gatewayOrderId === cfOrderId) {
        activateSubscriptionPlan(pending.planName, { orderId: cfOrderId });
      }
    }
  };

  // Cashfree's return_url for native is a custom URL scheme (com.vastracare.app://
  // payment-return?cf_order_id=...) since its own WebView origin, "https://localhost",
  // can never be whitelisted as a real website — see return_url in server.js. Android
  // routes that scheme back into this same app (singleTask launchMode) as an
  // appUrlOpen event instead of a normal page navigation.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;
    CapacitorApp.addListener('appUrlOpen', (event: { url: string }) => {
      const cfOrderId = new URL(event.url).searchParams.get('cf_order_id');
      if (cfOrderId) resolvePendingCashfreeAction(cfOrderId);
    }).then((handle: { remove: () => void }) => { removeListener = () => handle.remove(); });
    return () => removeListener?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddAddress = () => {
    if (!currentCustomer || !newAddressText.trim()) return;
    const newAddr: AddressInfo = { id: Date.now().toString(), label: newAddressLabel, fullAddress: newAddressText };
    const addresses = currentCustomer.addresses ? [...currentCustomer.addresses, newAddr] : [newAddr];
    const updated = { ...currentCustomer, addresses };
    setCurrentCustomer(updated);
    
    fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updated)
    });
    setNewAddressLabel('Home');
    setNewAddressText('');
    setShowAddAddress(false);
    setOrderAddress(newAddressText);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900 flex flex-col font-sans">
      {/* Firebase's invisible reCAPTCHA lives outside the phone-frame mockup on purpose.
          That wrapper clips anything past its edges — fine for an actually-invisible
          widget, but when Google decides a login looks risky enough to demand a real
          visible challenge, the challenge iframe rendered inside the clipped container
          becomes impossible to see or solve, and the OTP request just hangs forever
          with no error. Rendering it here, fixed over the whole viewport, means an
          escalated challenge is always visible and solvable regardless of where in the
          UI the OTP form happens to live.
          The wrapper itself must stay pointer-events-none UNCONDITIONALLY — reCAPTCHA
          renders iframes into it constantly even while operating fully invisibly, so
          any rule that flips pointer-events based on "an iframe exists in here" ends up
          permanently blocking clicks/typing on the entire page, not just during an
          actual visible challenge. Only the iframe(s) themselves get pointer-events —
          harmless when they're invisible, since there are no visible pixels to
          intercept clicks through. */}
      <div id="recaptcha-container" className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none [&_iframe]:pointer-events-auto"></div>

      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border text-white text-xs font-bold transition-all animate-fade-in ${toastMessage.type === 'error' ? 'bg-rose-500/95 border-rose-400' : toastMessage.type === 'success' ? 'bg-emerald-500/95 border-emerald-400' : 'bg-slate-800/95 border-slate-700'}`}>
            {toastMessage.type === 'error' ? '⚠️' : toastMessage.type === 'success' ? '✅' : 'ℹ️'}
            <div className="flex-1">{toastMessage.message}</div>
          </div>
        </div>
      )}

      {/* Global Modal */}
      {modalConfig && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-left flex flex-col gap-4 transform transition-all scale-100">
            <h3 className="text-lg font-black text-slate-900">{modalConfig.title}</h3>
            <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto pr-2">{modalConfig.message}</div>
            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => setModalConfig(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
              >
                {modalConfig.type === 'confirm' ? 'Cancel' : 'Close'}
              </button>
              {modalConfig.type === 'confirm' && (
                <button 
                  onClick={() => {
                    if (modalConfig.onConfirm) modalConfig.onConfirm();
                    setModalConfig(null);
                  }}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-rose-500/30"
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
                  Home <ChevronRight className="size-3 text-gray-500" />
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
                      <button onClick={() => setShowNotifications(false)}><X className="size-3 text-gray-500" /></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {orders.filter(o => o.customerPhone === currentCustomer.phone).length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">No notifications yet.</div>
                      ) : (
                        orders.filter(o => o.customerPhone === currentCustomer.phone).slice(0, 5).map(o => (
                          <div key={o.id} className="p-3 border-b border-gray-200/80 hover:bg-gray-100 cursor-default">
                            <div className="text-[12px] text-gray-500 mb-0.5">Order {o.id.split('-')[0]}</div>
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
                  customConfirm('Are you sure you want to log out?', () => {
                    setCurrentCustomer(null);
                    localStorage.removeItem('iron_current_user');
                    setCustomerActiveTab('home');
                  });
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
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 shadow-md relative overflow-hidden border border-white/20">
              <div className="absolute inset-0 bg-white/20 rotate-45 transform translate-x-[-10px]"></div>
              <svg viewBox="0 0 48 48" className="size-6 relative z-10" fill="none">
                <path d="M34 6c0 2-3 2-3 4.5S34 13 34 15" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
                <path d="M40 8c0 2-3 2-3 4.5S40 15 40 17" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
                <path d="M17 20v-4a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v4" stroke="white" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                <path d="M8 22a2 2 0 0 1 2-2h14c9 0 15 4.5 15 9s-6 9-15 9H10a2 2 0 0 1-2-2Z" fill="white" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight m-0 p-0 text-left bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-amber-500">PressGo</h1>
              <p className="text-xs text-gray-500 text-left font-medium">Premium Ironing & Care</p>
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
      <main className="flex-1 flex flex-col lg:flex-row p-3 sm:p-6 gap-6 justify-center max-w-7xl mx-auto w-full">

        {/* --- 1. CUSTOMER & RIDER MOBILE APP VIEW ---
             Hidden on small screens while in dual (admin) mode — on an actual phone,
             showing a shrunk customer-app preview next to the admin dashboard left no
             usable room for either. Admin gets the full screen; "Exit Admin View"
             still gets you back to the plain customer app. */}
        {['customer', 'dual', 'rider'].includes(viewMode) && (
          <div className={`flex-1 max-w-[400px] flex-col items-center ${viewMode === 'dual' ? 'hidden lg:flex' : 'flex'}`}>

            {/* Phone shell container */}
            <div className="w-full aspect-[9/19.5] border-8 border-gray-200 bg-slate-50 rounded-[40px] shadow-2xl flex flex-col overflow-hidden relative border-t-[12px] border-b-[12px]">
              
              {/* Camera Notch simulation */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-gray-100 rounded-full z-20"></div>

              {/* Inside Mobile App Viewport */}
              <div
                className="flex-1 flex flex-col overflow-y-auto px-4 pt-8 pb-4"
                style={!currentCustomer ? {
                  background: 'radial-gradient(circle at 15% -10%, rgba(244,63,94,0.42), transparent 55%), radial-gradient(circle at 108% 15%, rgba(245,158,11,0.42), transparent 50%), linear-gradient(160deg, #FFEBD9 0%, #FFDCCC 45%, #FFC9B8 100%)'
                } : { background: 'radial-gradient(circle at 15% 0%, rgba(244,63,94,0.10), transparent 45%), radial-gradient(circle at 100% 20%, rgba(245,158,11,0.12), transparent 40%), linear-gradient(180deg, #FFF7ED 0%, #FFF3E4 100%)' }}
              >
                
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
                        <div className="text-center text-gray-500 py-10 text-sm">No active tasks today. Relax!</div>
                      ) : (
                        orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).map(order => (
                          <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[12px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">{order.id}</span>
                                <h4 className="font-semibold text-sm mt-1">{order.customerName}</h4>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                  <Phone className="size-3" /> {order.customerPhone}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[12px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-bold">{order.status}</span>
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
                                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-30 disabled:pointer-events-none text-white text-[12px] font-bold py-2 rounded-xl uppercase tracking-wide"
                              >
                                Mark Picked
                              </button>
                              <button 
                                onClick={() => updateOrderStatus(order.id, 'Delivered')}
                                disabled={order.status === 'Delivered'}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold py-2 rounded-xl uppercase tracking-wide"
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
                  <div className="flex-1 flex flex-col justify-center gap-5">
                    {authStep === 'welcome' ? (
                      <>
                        {/* Brand mark — a custom hanger-and-steam glyph, not a stock icon */}
                        <div className="flex flex-col items-center gap-3 relative">
                          <div className="absolute -top-6 size-32 bg-gradient-to-br from-rose-400 via-orange-300 to-amber-300 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

                          <div className="relative size-[60px] rounded-[20px] bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 shadow-lg shadow-rose-500/40 flex items-center justify-center border-[3px] border-white overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/35"></div>
                            <svg viewBox="0 0 48 48" className="size-8 relative z-10" fill="none">
                              {/* Steam rising off the hot tip */}
                              <path d="M34 6c0 2-3 2-3 4.5S34 13 34 15" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
                              <path d="M40 8c0 2-3 2-3 4.5S40 15 40 17" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
                              {/* Handle */}
                              <path d="M17 20v-4a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v4" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                              {/* Iron body — flat back, tapering to a rounded point at the front */}
                              <path d="M8 22a2 2 0 0 1 2-2h14c9 0 15 4.5 15 9s-6 9-15 9H10a2 2 0 0 1-2-2Z" fill="white" />
                            </svg>
                          </div>

                          <div className="text-center flex flex-col items-center gap-1.5 relative">
                            <h2 className="font-display italic text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-orange-500 to-amber-600 tracking-tight drop-shadow-sm">PressGo</h2>
                            <p className="flex items-center gap-2 text-sm font-extrabold text-rose-600 tracking-wide">
                              <Sparkles className="size-3.5 text-amber-500 animate-spark shrink-0" />
                              <span className="text-shimmer">Pressed to perfection, picked up at your door.</span>
                              <Sparkles className="size-3.5 text-amber-500 animate-spark shrink-0" style={{ animationDelay: '0.8s' }} />
                            </p>
                          </div>
                        </div>

                        {/* Rotating hero carousel — three slides, auto-advancing every 4s */}
                        <div className="relative w-full h-60 rounded-3xl overflow-hidden shadow-xl shadow-rose-500/25">
                          {LOGIN_HERO_SLIDES.map((slide, i) => (
                            <div
                              key={slide.title}
                              className="absolute inset-0 transition-opacity duration-700 ease-out"
                              style={{ opacity: i === loginHeroIndex ? 1 : 0 }}
                            >
                              <img
                                src={slide.img}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ filter: 'saturate(1.1) contrast(1.05)' }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                              <div className="absolute inset-x-0 bottom-0 p-4">
                                <h3 className="font-display italic text-white text-lg font-semibold leading-tight tracking-tight drop-shadow-md">{slide.title}</h3>
                                <p className="text-white/80 text-[10.5px] leading-snug mt-0.5 max-w-[88%]">{slide.subtitle}</p>
                              </div>
                            </div>
                          ))}
                          <div className="absolute bottom-3 right-4 flex gap-1.5">
                            {LOGIN_HERO_SLIDES.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setLoginHeroIndex(i)}
                                aria-label={`Show slide ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all ${i === loginHeroIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`}
                              />
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => setAuthStep('login')}
                          className="w-full bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-rose-500/30 active:translate-y-0.5"
                        >
                          Get Started
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Compact header for verification/registration — small brand lockup, back arrow to Welcome from the phone step only */}
                        <div className="flex items-center gap-3 mb-1">
                          {authStep === 'login' && (
                            <button
                              onClick={() => setAuthStep('welcome')}
                              aria-label="Back"
                              className="p-2 -ml-2 rounded-full text-rose-600 hover:bg-rose-100/60 transition-colors"
                            >
                              <ArrowLeft className="size-4" />
                            </button>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="size-9 rounded-xl bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 shadow-md flex items-center justify-center border-2 border-white shrink-0">
                              <svg viewBox="0 0 48 48" className="size-5" fill="none">
                                <path d="M34 6c0 2-3 2-3 4.5S34 13 34 15" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                                <path d="M40 8c0 2-3 2-3 4.5S40 15 40 17" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                                <path d="M17 20v-4a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v4" stroke="white" strokeWidth="3.4" strokeLinecap="round" fill="none" />
                                <path d="M8 22a2 2 0 0 1 2-2h14c9 0 15 4.5 15 9s-6 9-15 9H10a2 2 0 0 1-2-2Z" fill="white" />
                              </svg>
                            </div>
                            <span className="font-display text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-600 tracking-tight">PressGo</span>
                          </div>
                        </div>

                        {authStep === 'login' && (
                          <p className="text-sm text-gray-600 -mt-2 mb-1">Enter your mobile number to continue.</p>
                        )}

                    {authStep === 'login' && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5 text-left">
                          <label className="text-[12px] font-bold text-gray-500 uppercase">Mobile Number</label>
                          <div className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl px-3 py-2">
                            <span className="text-gray-500 text-sm font-semibold">+91</span>
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

                        {/* Admin Login Gateway Switcher */}
                        <div className="mt-8 pt-4 flex flex-col items-center gap-2 pb-2">
                          {showConsoleInput ? (
                            <div className="flex gap-2 items-center animate-fade-in">
                              <input 
                                type="password"
                                maxLength={4}
                                placeholder="PIN"
                                value={adminPin}
                                onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 w-20 text-center outline-none focus:border-rose-500"
                              />
                              <button
                                onClick={handleAdminAccess}
                                className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[12px] px-3.5 py-1.5 rounded-lg transition-colors"
                              >
                                Go
                              </button>
                              <button 
                                onClick={() => setShowConsoleInput(false)}
                                className="text-gray-500 hover:text-gray-600 text-xs px-1"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setShowConsoleInput(true)}
                              className="text-[12px] font-bold text-gray-500 hover:text-rose-500 transition-colors uppercase tracking-wider"
                            >
                              Admin Login
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {authStep === 'otp' && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5 text-left">
                          <label className="text-[12px] font-bold text-gray-500 uppercase">Enter Verification OTP</label>
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
                        <p className="text-[11px] text-gray-500 -mt-1">Didn't get a code? You can request a new one once the timer below finishes.</p>
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <button
                            onClick={handleSendOTP}
                            disabled={resendCooldown > 0}
                            className="text-rose-500 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                          >
                            {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                          </button>
                          <button onClick={() => setAuthStep('login')} className="text-rose-500 hover:underline">Change Number</button>
                        </div>
                      </div>
                    )}

                    {authStep === 'register' && (
                      <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                        <h3 className="text-sm font-bold text-gray-900 text-left">Setup New Account</h3>
                        <div className="flex flex-col gap-1 text-left mt-1">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase">Full Name</label>
                          <input 
                            type="text"
                            value={authName}
                            onChange={e => setAuthName(e.target.value)}
                            autoComplete="off"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase">Apartment / Flat Number</label>
                          <input 
                            type="text"
                            value={authApartment}
                            onChange={e => setAuthApartment(e.target.value)}
                            autoComplete="off"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase">Street Address / Landmark</label>
                          <textarea 
                            value={authAddress}
                            onChange={e => setAuthAddress(e.target.value)}
                            autoComplete="off"
                            rows={3}
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase">Referral Code (Optional)</label>
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
                      </>
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
                            <div className="text-[12px] text-rose-300 font-bold tracking-wide uppercase">Warm Welcome Back</div>
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
                             customerActiveTab === 'notifications' ? 'Notifications' : 
                             customerActiveTab === 'rewards' ? 'Refer & Earn' :
                             customerActiveTab === 'profile' ? 'My Profile' :
                             customerActiveTab === 'subscriptions' ? 'Prime Plans' : 'Support'}
                          </h2>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCustomerActiveTab('notifications')} className="text-gray-500 hover:text-rose-500 p-2 rounded-lg bg-gray-50 border border-gray-200 relative">
                          <Bell className="size-4" />
                          {orders.filter(o => o.customerPhone === currentCustomer?.phone && o.status !== 'Delivered').length > 0 && (
                            <span className="absolute top-1.5 right-1.5 size-2 bg-rose-500 rounded-full animate-pulse"></span>
                          )}
                        </button>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-rose-500 p-2 rounded-lg bg-gray-50 border border-gray-200">
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
                          <div className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[11px] font-extrabold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm">
                            <span className="animate-pulse">⚡ FLASH OFFER: Get 35% off on Gold Prime subscription this week!</span>
                          </div>

                          {/* Welcome User Greeting */}
                          <div className="text-left mt-1 animate-slide-up">
                            <h3 className="font-display italic text-2xl font-semibold text-gray-900 leading-tight">Hello, {currentCustomer?.name || 'Friend'} 👋</h3>
                            <p className="flex items-center gap-1.5 text-[12px] font-bold mt-1">
                              <Sparkles className="size-3 text-amber-500 animate-spark shrink-0" />
                              <span className="text-shimmer text-rose-500">Experience premium fabric care tailored just for you.</span>
                            </p>
                          </div>


                          {/* Promotional Slide Banner */}
                          <div className="bg-gradient-to-r from-rose-600 to-amber-500 rounded-2xl p-0 text-left shadow-lg shadow-rose-500/15 relative overflow-hidden h-48 flex items-center justify-center group animate-slide-up stagger-1">
                            <div className="absolute inset-0 flex transition-transform duration-1000 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                              {slideImages.map((src, index) => (
                                <div key={index} className="relative w-full h-full shrink-0">
                                  <img
                                    src={src}
                                    alt={`Hero Banner ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    style={{ filter: 'saturate(1.15) contrast(1.05)' }}
                                  />
                                  {/* Lighter than before — the photo itself should read as the
                                      hero, not just a tint behind a solid color block. */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-rose-950/85 via-rose-900/25 to-transparent"></div>
                                </div>
                              ))}
                            </div>
                            <div className="relative z-10 px-5 w-full">
                              <h4 className="font-display italic font-bold text-xl text-white drop-shadow-md">Premium Garment Pressing</h4>
                              <p className="text-[13px] text-white/95 mt-1.5 max-w-[220px] leading-relaxed drop-shadow-md">Get 50% off on your first order. Professional steam care starts at just ₹12/item.</p>
                              <span className="inline-block bg-white text-rose-600 text-[11px] font-bold px-2.5 py-1 rounded-full mt-3 shadow-sm">Code: WELCOME50</span>
                            </div>
                          </div>

                          {/* Wallet Section */}
                          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm animate-slide-up stagger-2 transition-all hover:shadow-md">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 transform transition-transform hover:scale-105">
                                <span className="text-lg">💳</span>
                                <span className="text-sm font-bold text-gray-900">PressGo Wallet</span>
                              </div>
                              <span className="font-display text-xl font-semibold text-emerald-500">₹{currentCustomer?.walletBalance || 0}</span>
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

                            <button
                              onClick={() => {
                                const next = !showWalletHistory;
                                setShowWalletHistory(next);
                                if (next && walletTransactions.length === 0) fetchWalletTransactions();
                              }}
                              className="text-left text-[12px] font-bold text-gray-500 hover:text-gray-600 flex items-center gap-1"
                            >
                              {showWalletHistory ? 'Hide' : 'View'} transaction history
                              <ChevronRight className={`size-3 transition-transform ${showWalletHistory ? 'rotate-90' : ''}`} />
                            </button>

                            {showWalletHistory && (
                              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto border-t border-gray-100 pt-2">
                                {walletTransactions.length === 0 ? (
                                  <p className="text-[12px] text-gray-500 text-center py-3">No transactions yet.</p>
                                ) : (
                                  walletTransactions.map(t => (
                                    <div key={t.id} className="flex items-center justify-between text-[12px] py-1">
                                      <div className="min-w-0 pr-2">
                                        <p className="text-gray-700 font-semibold truncate">{t.description}</p>
                                        <p className="text-gray-500">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                      </div>
                                      <span className={`font-bold shrink-0 ${t.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {t.type === 'credit' ? '+' : '−'}₹{t.amount}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>




                          {/* Services Grid */}
                          <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={() => setCustomerActiveTab('order')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-rose-500 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 text-center relative overflow-hidden group"
                            >
                              <div className="size-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                                <Plus className="size-4" />
                              </div>
                              <span className="text-[12px] font-semibold text-gray-900">Ironing</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('order')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-rose-500 hover:shadow-lg transform hover:-translate-y-1 group transition-all text-center relative"
                            >
                              
                              <div className="size-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <Star className="size-4" />
                              </div>
                              <span className="text-[12px] font-semibold text-gray-700">Dry Clean</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('order')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-rose-500 hover:shadow-lg transform hover:-translate-y-1 group transition-all text-center relative"
                            >
                              
                              <div className="size-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <RefreshCw className="size-4" />
                              </div>
                              <span className="text-[12px] font-semibold text-gray-700">Laundry</span>
                            </button>
                          </div>

                          {/* Quick Actions Grid */}
                          <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={() => setCustomerActiveTab('history')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-amber-500 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 text-center group"
                            >
                              <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                                <ShoppingBag className="size-4" />
                              </div>
                              <span className="text-[12px] font-semibold text-gray-900">My Orders</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('prices')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 transition-all text-center"
                            >
                              <div className="size-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <FileText className="size-4" />
                              </div>
                              <span className="text-[12px] font-semibold text-gray-900">Price List</span>
                            </button>
                            <button 
                              onClick={() => setCustomerActiveTab('support')}
                              className="flex flex-col items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-emerald-500 transition-all text-center"
                            >
                              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <HelpCircle className="size-4" />
                              </div>
                              <span className="text-[12px] font-semibold text-gray-900">Support</span>
                            </button>
                          </div>

                          {/* Refer & Earn Banner */}
                          <div
                            onClick={() => setCustomerActiveTab('rewards')}
                            className="rounded-xl cursor-pointer text-left relative overflow-hidden shadow-lg shadow-rose-500/15 mt-1 animate-slide-up stagger-3 h-32"
                          >
                            <img
                              src="https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&h=400&fit=crop"
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ filter: 'saturate(1.15) contrast(1.05)' }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-rose-600/90 via-rose-500/70 to-amber-500/40"></div>
                            <div className="relative z-10 h-full flex flex-col justify-center p-4">
                              <h3 className="font-display text-white font-semibold text-lg tracking-wide leading-tight break-words whitespace-normal drop-shadow-md">Refer &amp; Earn ₹50</h3>
                              <p className="text-[11px] text-white/90 mt-0.5">Invite a friend, you both get rewarded</p>
                            </div>
                            <div className="absolute right-3 bottom-3 opacity-90">
                              <Gift className="size-6 text-white drop-shadow-md" />
                            </div>
                          </div>

                          {/* Festive Offer Banner */}
                          {festiveOffer.enabled && (
                            <div 
                              onClick={() => setCustomerActiveTab('order')}
                              className="relative rounded-2xl overflow-hidden shadow-lg mt-1 cursor-pointer group border border-gray-200"
                            >
                              <img src={festiveOffer.img} className="w-full h-36 object-cover" alt={festiveOffer.title} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4">
                                <h3 className="text-white font-black text-lg tracking-wide group-active:scale-95 transition-transform">{festiveOffer.title}</h3>
                                <p className="text-gray-200 text-xs mt-0.5 font-medium">{festiveOffer.subtitle}</p>
                              </div>
                            </div>
                          )}

                          {/* Steam Press Feature Banner */}
                          <div
                            onClick={() => setCustomerActiveTab('order')}
                            className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md flex items-center gap-3 cursor-pointer p-3 hover:border-rose-350 transition-all mt-1 animate-slide-up stagger-4"
                          >
                            <img
                              src="https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop"
                              alt="Steam Ironing"
                              className="size-20 rounded-xl object-cover shrink-0 border border-gray-100 shadow-sm"
                              style={{ filter: 'saturate(1.15) contrast(1.05)' }}
                            />
                            <div className="text-left flex-1 min-w-0">
                              <h4 className="font-display text-sm font-semibold text-gray-950 tracking-wide">Professional Steam Press</h4>
                              <p className="text-[11px] text-gray-500 leading-normal mt-0.5">We use high-temperature steam vacuum tables for premium garment care.</p>
                            </div>
                          </div>

                          {/* Flash Images - Quick Book */}
                          <div className="mt-2 mb-4 animate-slide-up stagger-5">
                            <h4 className="text-xs font-bold text-gray-900 mb-2 pl-1">Quick Book by Category</h4>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
                              {flashOffers.map(f => (
                                <button 
                                  key={f.name}
                                  onClick={() => { setActiveCategory(f.cat); setCustomerActiveTab('order'); }}
                                  className="relative shrink-0 size-24 rounded-2xl overflow-hidden shadow-md active:scale-95 transition-all"
                                >
                                  <img src={f.img} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <span className="text-[12px] font-bold text-white tracking-wider">{f.name}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Quick Tracker shortcut */}
                          {orders.filter(o => o.customerPhone === currentCustomer.phone).length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-left">
                              <div className="flex justify-between items-center pb-2 border-b border-gray-200 mb-3">
                                <span className="text-xs font-bold text-gray-900">Active Order</span>
                                <span className="text-[12px] text-gray-500">
                                  {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].id}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold text-rose-500">
                                    Status: {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].status}
                                  </div>
                                  <div className="text-[12px] text-gray-500 mt-1">
                                    Pickup: {orders.filter(o => o.customerPhone === currentCustomer.phone)[0].pickupDate}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setSelectedOrderForTracking(orders.filter(o => o.customerPhone === currentCustomer.phone)[0]);
                                    setCustomerActiveTab('history');
                                  }}
                                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold"
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
                            
                            <div className="size-16 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 mb-3 relative z-10 shrink-0">
                              <Gift className="size-8 text-white" />
                            </div>
                            <h2 className="text-base font-black text-white relative z-10 tracking-tight leading-tight break-words whitespace-normal">Earn ₹50 Per Friend</h2>
                            <p className="text-xs text-gray-300 mt-2 relative z-10 max-w-[250px] leading-relaxed">
                              Invite your friends to PressGo. When they complete their first order, you <strong className="text-white">both get ₹50</strong> added to your wallets!
                            </p>
                          </div>

                          {/* Code Display */}
                          <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-2 flex flex-col items-center shadow-sm">
                            <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2">Your Unique Code</span>
                            <div className="bg-gray-50 border-2 border-dashed border-rose-500/30 text-rose-500 font-mono text-2xl font-black px-6 py-3 rounded-xl tracking-[0.2em] w-full text-center select-all">
                              {currentCustomer.referralCode || 'PRESSGO-NEW'}
                            </div>
                            
                            <button
                              onClick={() => {
                                const text = `Hey! Use my code ${currentCustomer.referralCode || 'PRESSGO-NEW'} to get ₹50 off your first PressGo ironing & laundry order! 🧺✨\nDownload the app and sign up now!`;
                                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                                window.open(whatsappUrl, '_blank');
                              }}
                              className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-4 shadow-md transition-all"
                            >
                              Share via WhatsApp
                            </button>

                            <div className="flex flex-col items-center mt-4 pt-4 border-t border-gray-100 w-full">
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(currentCustomer.referralCode || 'PRESSGO-NEW')}`}
                                alt="Referral code QR"
                                className="size-[110px] rounded-lg border border-gray-200"
                              />
                              <span className="text-[11px] text-gray-500 mt-2">Let a friend scan this to grab your code</span>
                            </div>
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
                                      <span className="text-[11px] text-gray-500">{order.createdAt}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                      Status updated to <strong className="text-rose-400">{order.status}</strong>. 
                                      {order.status === 'Delivered' ? ' Thank you for choosing PressGo!' : ' We are working on it.'}
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
                              <span className="text-[11px] text-gray-500 font-normal">Editable</span>
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase">Customer Name</label>
                                <input 
                                  type="text" 
                                  value={orderName} 
                                  onChange={e => setOrderName(e.target.value)}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase">Phone Number</label>
                                <input 
                                  type="text" 
                                  value={orderPhone} 
                                  onChange={e => setOrderPhone(e.target.value)}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-gray-500 uppercase">Select Address</label>
                                
                                {currentCustomer?.addresses?.map(addr => (
                                  <div 
                                    key={addr.id}
                                    onClick={() => setOrderAddress(addr.fullAddress)}
                                    className={`p-2 border rounded-lg cursor-pointer flex justify-between items-center ${orderAddress === addr.fullAddress ? 'border-rose-500 bg-rose-500/10' : 'border-gray-200 bg-gray-50'}`}
                                  >
                                    <div>
                                      <div className="text-xs font-bold text-gray-900">{addr.label}</div>
                                      <div className="text-[12px] text-gray-500 truncate w-48">{addr.fullAddress}</div>
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
                                      className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 mb-2 text-xs text-gray-900 outline-none focus:border-rose-500"
                                    />
                                    <textarea 
                                      value={newAddressText}
                                      onChange={e => setNewAddressText(e.target.value)}
                                      placeholder="Full Address Details..."
                                      className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 mb-2 text-xs text-gray-900 outline-none focus:border-rose-500 resize-none h-16"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={handleAddAddress} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold py-1.5 rounded transition-colors">Save Address</button>
                                      <button onClick={() => setShowAddAddress(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 text-[12px] font-bold py-1.5 rounded transition-colors">Cancel</button>
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
                                {name: 'Ironing', desc: 'Crisp pressing', img: '/hero_banner.png', comingSoon: false},
                                {name: 'Dry Cleaning', desc: 'Delicate care', img: 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=400&h=300&fit=crop', comingSoon: true},
                                {name: 'Laundry', desc: 'Wash & fold', img: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400&h=300&fit=crop', comingSoon: true}
                              ].map(svc => (
                                <button
                                  key={svc.name}
                                  onClick={() => svc.comingSoon ? customAlert(`${svc.name} is launching soon — Ironing is available to book right now!`) : setSelectedService(svc.name as any)}
                                  className={`snap-center shrink-0 w-[105px] rounded-xl border transition-all text-left flex flex-col overflow-hidden relative ${svc.comingSoon ? 'bg-white border-gray-200 cursor-not-allowed' : selectedService === svc.name ? 'bg-gray-50 border-rose-500 ring-2 ring-rose-500 shadow-[0_2px_8px_rgba(225,29,72,0.3)]' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                                >
                                  <div className="h-[65px] w-full bg-gray-50 relative">
                                    <img src={svc.img} alt={svc.name} className={`w-full h-full object-cover transition-all duration-500 ${svc.comingSoon ? 'opacity-40 grayscale' : selectedService === svc.name ? 'opacity-100 scale-105' : 'opacity-60 grayscale-[30%]'}`} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                                  </div>
                                  <div className="p-1.5 absolute bottom-0 left-0 right-0">
                                    <h4 className="text-[12px] font-black text-white">{svc.name}</h4>
                                    <p className="text-[11px] text-gray-300 line-clamp-1">{svc.comingSoon ? 'Coming soon' : svc.desc}</p>
                                  </div>
                                  {svc.comingSoon ? (
                                    <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md">SOON</div>
                                  ) : selectedService === svc.name && (
                                    <div className="absolute top-1.5 right-1.5 bg-rose-500 rounded-full p-0.5 shadow-md flex items-center justify-center">
                                      <Check className="size-2 text-white" />
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
                                  <span className={`text-[12px] font-medium ${pickupDate === d.value ? 'text-rose-100' : ''}`}>{d.label}</span>
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
                                  <Clock className={`size-3.5 mr-2 ${pickupTime === slot ? 'text-rose-400' : 'text-gray-500'}`} />
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
                              {Array.from(new Set(priceList.filter(p => p.serviceType === selectedService).map(p => p.category)))
                                .map(catName => ({ name: catName, img: CATEGORY_IMAGES[catName] || FALLBACK_CATEGORY_IMAGE }))
                                .map(cat => (
                                <button
                                  key={cat.name}
                                  onClick={() => setActiveCategory(cat.name)}
                                  className={`relative shrink-0 w-[120px] h-[80px] rounded-2xl overflow-hidden transition-all shadow-sm ${
                                    activeCategory === cat.name
                                    ? 'ring-2 ring-rose-500 ring-offset-2 scale-105 shadow-[0_4px_12px_rgba(225,29,72,0.3)]'
                                    : 'hover:border-rose-500 hover:shadow-lg transform hover:-translate-y-1 group grayscale-[40%] hover:grayscale-0'
                                  }`}
                                >
                                  <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                                  <div className="absolute bottom-2 left-0 right-0 text-center">
                                    <span className="text-[12px] font-bold text-white tracking-wide uppercase drop-shadow-md">{cat.name}</span>
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
                                        <div className="text-[12px] text-rose-400 mt-0.5 font-semibold">₹{item.price} / pc</div>
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
                            <label className="text-[11px] font-bold text-gray-500 uppercase">Special Instructions</label>
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
                                  customAlert('Coupon Applied!');
                                } else {
                                  customAlert('Invalid or Expired Coupon');
                                }
                              }}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-2 rounded-xl text-xs font-semibold"
                            >
                              Apply
                            </button>
                          </div>

                          {/* Price calculation summary */}
                          <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-1 text-[12px] text-gray-500">
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
                            disabled={isCreatingCheckout}
                            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 disabled:pointer-events-none text-white py-2.5 rounded-xl text-xs font-semibold shadow-md active:translate-y-0.5 text-center"
                          >
                            {isCreatingCheckout ? 'Preparing checkout…' : 'Proceed to Digital Payment'}
                          </button>
                        </div>
                      )}

                      {/* PRICES TAB */}
                      {customerActiveTab === 'prices' && (
                        <div className="flex flex-col gap-3 text-left">
                          <h3 className="text-sm font-bold text-gray-900">Service Price List</h3>

                          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {(['Ironing', 'Dry Cleaning', 'Laundry'] as const).map(svc => {
                              const comingSoon = svc !== 'Ironing';
                              return (
                                <button
                                  key={svc}
                                  onClick={() => comingSoon ? customAlert(`${svc} is launching soon — Ironing is available to book right now!`) : setSelectedService(svc)}
                                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5 ${comingSoon ? 'bg-white border-gray-200 text-gray-400 cursor-not-allowed' : selectedService === svc ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                  {svc}
                                  {comingSoon && <span className="text-[8px] bg-amber-100 text-amber-600 px-1 rounded-full font-bold">SOON</span>}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1">
                            {Array.from(new Set(priceList.filter(p => p.serviceType === selectedService).map(p => p.category)))
                              .map(cat => ({ cat, items: priceList.filter(item => item.serviceType === selectedService && item.category === cat) }))
                              .filter(group => group.items.length > 0)
                              .map(group => (
                                <div key={group.cat} className="flex flex-col gap-2">
                                  <h4 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider px-1">{group.cat}</h4>
                                  <div className="flex flex-col gap-2">
                                    {group.items.map(item => (
                                      <div key={item.name} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200">
                                        <div className="text-xs font-bold text-gray-900">{item.name}</div>
                                        <div className="text-sm font-extrabold text-rose-500">₹{item.price}</div>
                                      </div>
                                    ))}
                                  </div>
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
                                <span className="text-[12px] font-bold text-rose-500">{selectedOrderForTracking.id}</span>
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
                                      <div className={`size-5 rounded-full flex items-center justify-center text-[12px] font-bold border-2 ${isActive ? 'bg-rose-500 border-rose-500 text-gray-900 shadow-sm' : 'border-gray-200 text-gray-500'}`}>
                                        {isActive ? <Check className="size-2.5" /> : idx + 1}
                                      </div>
                                      <span className={`text-xs font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
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
                                  
                                  <div className="relative z-10 mt-4 text-[12px] font-bold text-gray-700">
                                    {selectedOrderForTracking.status === 'Delivered' ? 'Driver reached destination' : 'Driver is on the way...'}
                                  </div>
                                </div>
                              )}

                              <div className="bg-gray-50/60 p-3 rounded-xl text-[12px] text-gray-500 flex flex-col gap-1 border border-gray-200">
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
                                <div className="text-center py-10 text-xs text-gray-500">No active orders placed yet.</div>
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
                                        <div className="text-[11px] text-gray-500 mt-0.5">{o.createdAt}</div>
                                        <div className="text-[12px] font-semibold text-rose-500 mt-1">{o.status}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-xs font-extrabold text-gray-900">₹{o.total}</div>
                                        <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded mt-1 ${o.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
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
                              <span className="text-[12px] font-bold text-rose-600">Call Us Directly</span>
                              <span className="text-[11px] text-rose-500/80 -mt-1">+91 97910 19505</span>
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
                              <span className="text-[12px] font-bold text-emerald-600">Chat with Us</span>
                              <span className="text-[11px] text-emerald-500/80 -mt-1">Active on WhatsApp</span>
                            </a>
                          </div>

                          <p className="text-[12px] text-gray-500 text-center -mt-1">We're available 8 AM – 8 PM every day — call or WhatsApp us directly above.</p>

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
                                        className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[12px] font-bold text-gray-700 hover:bg-gray-100"
                                      >
                                        <span>{item.q}</span>
                                        <ChevronRight className={`size-3 text-gray-500 transition-all ${expandedFaq === keyIndex ? 'rotate-90' : ''}`} />
                                      </button>
                                      {expandedFaq === keyIndex && (
                                        <div className="p-2.5 bg-white text-[11px] text-gray-500 leading-relaxed border-t border-gray-100">
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
                                  className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[12px] font-bold text-gray-700 hover:bg-gray-100"
                                >
                                  <span>Where is my active order?</span>
                                  <ChevronRight className={`size-3 text-gray-500 transition-all ${expandedFaq === 20 ? 'rotate-90' : ''}`} />
                                </button>
                                {expandedFaq === 20 && (
                                  <div className="p-2.5 bg-white text-[11px] text-gray-500 leading-relaxed border-t border-gray-100">
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
                                  className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[12px] font-bold text-gray-700 hover:bg-gray-100"
                                >
                                  <span>Transaction failed but money deducted?</span>
                                  <ChevronRight className={`size-3 text-gray-500 transition-all ${expandedFaq === 30 ? 'rotate-90' : ''}`} />
                                </button>
                                {expandedFaq === 30 && (
                                  <div className="p-2.5 bg-white text-[11px] text-gray-500 leading-relaxed border-t border-gray-100">
                                    Do not worry! In case of gateway failures, deducted funds are automatically refunded to your original payment source within 3-5 working days by Cashfree.
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
                                        className="w-full text-left bg-gray-50 p-2.5 flex justify-between items-center text-[12px] font-bold text-gray-700 hover:bg-gray-100"
                                      >
                                        <span>{item.q}</span>
                                        <ChevronRight className={`size-3 text-gray-500 transition-all ${expandedFaq === keyIndex ? 'rotate-90' : ''}`} />
                                      </button>
                                      {expandedFaq === keyIndex && (
                                        <div className="p-2.5 bg-white text-[11px] text-gray-500 leading-relaxed border-t border-gray-100">
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
                            <h3 className="text-sm font-bold text-gray-900">PressGo Prime Plans</h3>
                          </div>
                          
                          <div className="w-full h-32 rounded-2xl overflow-hidden relative shadow-lg">
                            <img src="/subscription_banner_1785298423353.png" alt="Prime Subscription" className="w-full h-full object-cover opacity-80 mix-blend-screen" />
                            <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-slate-950 to-transparent">
                              <h4 className="font-display font-semibold text-white text-2xl drop-shadow-md">PressGo Prime</h4>
                              <p className="text-amber-300 text-xs font-bold mt-0.5 drop-shadow-md">Subscribe & Save</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 pb-2">
                            {[
                              { name: 'Bronze', discount: 15, price: 299, color: 'text-orange-300', bg: 'bg-orange-300/10', border: 'border-orange-300' },
                              { name: 'Silver', discount: 25, price: 499, color: 'text-gray-700', bg: 'bg-slate-300/10', border: 'border-slate-300' },
                              { name: 'Gold', discount: 35, price: 699, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400' }
                            ].map(plan => (
                              <div key={plan.name} className={`border ${userSubscription === plan.name ? plan.border : 'border-gray-200'} bg-white rounded-xl p-4 relative overflow-hidden transition-all`}>
                                {userSubscription === plan.name && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[11px] font-bold px-2 py-1.5 rounded-bl-lg">ACTIVE</div>}
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className={`font-bold ${plan.color} text-sm flex items-center gap-1.5`}>
                                    <Star className="size-4" fill="currentColor" /> {plan.name} Plan
                                  </h4>
                                  <span className="text-gray-900 font-extrabold">₹{plan.price}<span className="text-[11px] text-gray-500 font-normal">/mo</span></span>
                                </div>
                                <p className="text-[12px] text-gray-500">Gets flat {plan.discount}% discount on all orders placed. Plus free delivery on orders near to your location!</p>
                                <button
                                  onClick={() => handleSubscribe(plan.name)}
                                  disabled={userSubscription === plan.name}
                                  className={`w-full mt-3 py-2 rounded-lg text-xs font-bold ${userSubscription === plan.name ? 'bg-gray-200 text-gray-500' : 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm'}`}
                                >
                                  {userSubscription === plan.name ? `Active Plan (${plan.discount}% Discount)` : 'Subscribe Now'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {customerActiveTab === 'profile' && currentCustomer && (
                        <div className="flex flex-col gap-4 text-left pb-6 pr-1 animate-fade-in">
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
                                {(currentCustomer.name || 'User').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-extrabold text-sm truncate">{currentCustomer.name}</h4>
                                <p className="text-[12px] text-gray-300 font-medium truncate mt-0.5">{currentCustomer.phone}</p>
                              </div>
                            </div>
                            <div className="border-t border-white/10 pt-2 text-[12px] text-gray-400 flex justify-between">
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
                                <p className="text-[12px] text-gray-500">No addresses saved yet.</p>
                              ) : (
                                currentCustomer.addresses?.map((addr: any) => (
                                  <div key={addr.id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-250 flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-2">
                                      <span className="text-[11px] font-extrabold uppercase bg-gray-200 text-gray-700 px-1 rounded">{addr.label}</span>
                                      <p className="text-[12px] text-gray-500 leading-snug mt-1 truncate">{addr.fullAddress}</p>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        customConfirm('Delete this address?', () => {
                                          const addresses = (currentCustomer.addresses || []).filter((a: any) => a.id !== addr.id);
                                          const updated = { ...currentCustomer, addresses };
                                          setCurrentCustomer(updated);
                                          fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
                                            method: 'PUT',
                                            headers: authHeaders(),
                                            body: JSON.stringify(updated)
                                          });
                                        });
                                      }}
                                      className="text-rose-500 hover:text-rose-600 text-[12px] font-bold shrink-0 self-center"
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
                                      className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg ${newAddressLabel === lbl ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'}`}
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
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-900 outline-none"
                                />
                                <div className="flex gap-2">
                                  <button onClick={handleAddAddress} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-1.5 rounded text-[12px] font-bold">Save</button>
                                  <button onClick={() => setShowAddAddress(false)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded text-[12px] font-bold">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setShowAddAddress(true)} className="text-left text-[12px] font-bold text-rose-500 hover:underline">
                                + Add New Address
                              </button>
                            )}
                          </div>

                          {/* Help & Support Button inside Profile */}
                          <button 
                            onClick={() => setCustomerActiveTab('support')}
                            className="w-full text-left p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-2xl text-emerald-800 flex justify-between items-center shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <HelpCircle className="size-4 text-emerald-600" />
                              <span className="text-xs font-bold font-sans">Help & Support (FAQ)</span>
                            </div>
                            <ChevronRight className="size-4 text-emerald-600" />
                          </button>

                          {/* App Settings / Information & Legal */}
                          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm">
                            <h4 className="text-xs font-bold text-gray-950 flex items-center gap-1">
                              <Settings className="size-4 text-gray-500" /> Settings & Policies
                            </h4>
                            <div className="flex flex-col gap-1 text-[12px]">
                              <button onClick={() => window.open('/terms.html', '_blank')} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-gray-700 flex justify-between items-center border border-gray-100">
                                <span>Terms & Conditions</span>
                                <ChevronRight className="size-3.5 text-gray-500" />
                              </button>
                              <button onClick={() => window.open('/privacy.html', '_blank')} className="w-full text-left p-2 hover:bg-gray-50 rounded-lg text-gray-700 flex justify-between items-center border border-gray-100">
                                <span>Privacy & Policy</span>
                                <ChevronRight className="size-3.5 text-gray-500" />
                              </button>
                            </div>
                          </div>

                          {/* Danger Zone: Delete Account */}
                          <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                            <h4 className="text-xs font-bold text-rose-800">Danger Zone</h4>
                            <p className="text-[12px] text-gray-500 leading-relaxed">Permanently delete your profile and account information. This action is irreversible.</p>
                            <button
                              onClick={() => {
                                customConfirm('⚠️ WARNING: Deleting your account will remove your address list, purchase logs, and remaining wallet balance. Are you sure you want to proceed?', () => {
                                  customConfirm('Are you absolutely certain? This cannot be undone.', () => {
                                    fetch(`${API_URL}/customers/${currentCustomer.phone}`, {
                                      method: 'DELETE',
                                      headers: authHeaders()
                                    })
                                      .then(res => {
                                        if (!res.ok) throw new Error('Failed to delete account');
                                        setSession(null);
                                        setCurrentCustomer(null);
                                        if (Capacitor.isNativePlatform()) {
                                          FirebaseAuthentication.signOut().catch(() => {});
                                          nativeVerificationIdRef.current = null;
                                        } else {
                                          recaptchaVerifierRef.current?.clear();
                                          recaptchaVerifierRef.current = null;
                                        }
                                        localStorage.removeItem('iron_current_user');
                                        setCustomerActiveTab('home');
                                        customAlert('Your profile has been deleted successfully. We hope to see you again! ❤️');
                                      })
                                      .catch(err => customAlert('Could not delete your account: ' + err.message));
                                  });
                                });
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
                    <div className="border-t border-gray-200/60 pt-3 pb-1 flex justify-around bg-white/90 backdrop-blur-md text-gray-500 -mx-4 px-2 mt-4 sticky bottom-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
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
                            <span className={`text-[11px] font-bold tracking-wide transition-all ${isActive ? 'text-rose-500' : 'text-gray-500'}`}>
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

            {/* Our own in-app checkout modal — the customer picks a method here, then Cashfree's own widget opens for UPI/Card/NetBanking */}
            {showCheckoutModal && (
              <div className="absolute inset-0 bg-white/90 z-40 flex items-end justify-center p-4 rounded-[40px]">
                <div className="w-full bg-gray-50 border border-gray-200 rounded-3xl p-5 text-left flex flex-col gap-4 animate-slide-up">
                  
                  {/* Checkout Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500">PressGo Checkout</h4>
                      <h3 className="font-display text-lg font-semibold text-gray-900 mt-0.5">Pay ₹{confirmedQuote?.total ?? calculateTotals().total}</h3>
                    </div>
                    <button onClick={() => { setShowCheckoutModal(false); setConfirmedQuote(null); setIsSubmittingOrder(false); }} className="text-xs text-gray-500 hover:text-gray-900">Cancel</button>
                  </div>

                  {/* Payment Options */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase">Select Payment Mode</label>
                    
                    <button 
                      onClick={() => setPaymentMethod('UPI')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'UPI' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <CreditCard className="size-4 text-purple-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>UPI Payment (PhonePe, GPay)</span>
                        <div className="text-[11px] opacity-75">Pay digitally using QR/UPI App</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('Wallet')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'Wallet' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <Wallet className="size-4 text-emerald-400" />
                      <div className="text-xs font-semibold text-left">
                        <span>PressGo Wallet</span>
                        <div className="text-[11px] opacity-75">Pay using your prepaid balance</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('Card')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'Card' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <CreditCard className="size-4 text-blue-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>Credit / Debit Cards</span>
                        <div className="text-[11px] opacity-75">Pay securely via Visa, Mastercard, RuPay</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('NetBanking')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'NetBanking' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <Landmark className="size-4 text-amber-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>NetBanking</span>
                        <div className="text-[11px] opacity-75">Pay directly through your bank account</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setPaymentMethod('COD')}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === 'COD' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-white border-gray-200 text-gray-700'}`}
                    >
                      <Truck className="size-4 text-rose-500" />
                      <div className="text-xs font-semibold text-left">
                        <span>Pay On Pickup</span>
                        <div className="text-[11px] opacity-75">Pay cash or digital at pickup time</div>
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
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=upi://pay?pa=${upiDetails.id}&pn=PressGo&cu=INR`} 
                              alt="UPI QR Code" 
                              className="w-16 h-16 object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1 flex flex-col gap-1 text-[12px] text-gray-500">
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
                        href={`upi://pay?pa=${upiDetails.id}&pn=PressGo&cu=INR`} 
                        className="w-full bg-gray-50 hover:bg-gray-200 text-center text-gray-900 py-2 rounded-lg font-bold border border-gray-200 transition-colors mt-2"
                      >
                        Click to Open UPI App
                      </a>

                      <p className="text-[11px] text-gray-500 leading-relaxed italic bg-gray-50/50 p-1.5 rounded mt-1">
                        *Scan QR or click link to pay, then click "Confirm & Submit Order".
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'Card' && (
                    <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-1 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-gray-900">💳 Credit / Debit Card</div>
                      <p className="text-gray-500 text-[11px] leading-relaxed">Tap "Confirm & Submit Order" — you'll enter your card number, expiry, and CVV once, on Cashfree's secure payment screen. We never see or store those details.</p>
                    </div>
                  )}

                  {paymentMethod === 'NetBanking' && (
                    <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-1 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-gray-900">🏦 NetBanking</div>
                      <p className="text-gray-500 text-[11px] leading-relaxed">Tap "Confirm & Submit Order" — you'll pick your bank and log in securely on Cashfree's payment screen.</p>
                    </div>
                  )}

                  {paymentMethod === 'Wallet' && (
                    <div className="bg-white border border-gray-200 p-3 rounded-xl flex flex-col gap-2 mt-1 text-left text-xs animate-fade-in">
                      <div className="font-bold text-gray-900 flex items-center justify-between">
                        <span>💳 PressGo Wallet Balance</span>
                        <span className="text-emerald-500">₹{currentCustomer?.walletBalance || 0}</span>
                      </div>
                      
                      {(currentCustomer?.walletBalance || 0) < (confirmedQuote?.total ?? calculateTotals().total) ? (
                        <div className="flex flex-col gap-1.5 mt-1 border-t border-gray-100 pt-2">
                          <p className="text-rose-500 text-[12px] font-bold">⚠️ Insufficient Wallet Balance (Need ₹{(confirmedQuote?.total ?? calculateTotals().total) - (currentCustomer?.walletBalance || 0)} more)</p>
                          <div className="flex gap-2 mt-1">
                            <input 
                              type="number"
                              placeholder="Amount to Add"
                              value={checkoutAddAmount}
                              onChange={e => setCheckoutAddAmount(e.target.value)}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none"
                            />
                            <button 
                              onClick={handleCheckoutAddFunds}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[12px] px-3.5 py-1.5 rounded-lg transition-colors"
                            >
                              Add & Pay
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-emerald-500 text-[12px] mt-1">Balance is sufficient for this order.</p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleCheckoutSubmit}
                    disabled={isSubmittingOrder}
                    className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 disabled:pointer-events-none text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase text-center mt-2 shadow-md active:translate-y-0.5"
                  >
                    {isSubmittingOrder ? 'Processing…' : 'Confirm & Submit Order'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* --- 2. ADMIN PORTAL / WEB DASHBOARD --- */}
        {(viewMode === 'admin' || viewMode === 'dual') && (
          <div className="flex-1 w-full flex flex-col min-w-0">
            <div className="flex-1 bg-white border border-gray-200 rounded-3xl p-3 sm:p-6 shadow-2xl flex flex-col gap-4 sm:gap-6 min-w-0">

              {/* Admin Tabs — scrolls horizontally on narrow screens instead of
                  cramming all six tabs (plus Sync) into a row that can't fit them */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-3 min-w-0">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                  {[
                    { tab: 'overview', label: 'Overview', icon: TrendingUp },
                    { tab: 'orders', label: 'Manage Orders', icon: ShoppingBag },
                    { tab: 'offers', label: 'Flash Offers', icon: Gift },
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
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${isActive ? 'bg-gray-50 border border-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
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
                  className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 shrink-0 ml-auto"
                >
                  <RefreshCw className="size-3.5" /> <span className="hidden sm:inline">Sync</span>
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
                        <span className="text-[12px] font-bold text-gray-500 uppercase">Total Revenue</span>
                        <div className="text-2xl font-extrabold text-gray-900">₹{totalRevenue.toFixed(2)}</div>
                        <span className="text-[11px] text-emerald-500 font-semibold">100% digital payouts</span>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[12px] font-bold text-gray-500 uppercase">Pending Pickups</span>
                        <div className="text-2xl font-extrabold text-rose-500">
                          {orders.filter(o => o.status === 'Placed').length}
                        </div>
                        <span className="text-[11px] text-gray-500">Needs immediate assignment</span>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[12px] font-bold text-gray-500 uppercase">Active In-process</span>
                        <div className="text-2xl font-extrabold text-amber-500">
                          {orders.filter(o => o.status === 'Picked Up' || o.status === 'Ironing').length}
                        </div>
                        <span className="text-[11px] text-gray-500">Undergoing ironing flow</span>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-1.5">
                        <span className="text-[12px] font-bold text-gray-500 uppercase">Completed orders</span>
                        <div className="text-2xl font-extrabold text-emerald-500">
                          {completedOrders.length}
                        </div>
                        <span className="text-[11px] text-emerald-500 font-semibold">Delivered & Closed</span>
                      </div>

                    </div>

                    {/* Recent Orders Overview */}
                    <div className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-gray-900">Today&apos;s Active Inbound Pickups</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                        {orders.length === 0 ? (
                          <div className="p-8 text-center text-xs text-gray-500">No active orders right now.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-white text-gray-500 uppercase font-bold text-[11px] border-b border-gray-200">
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
                                      <div className="text-[11px] text-gray-500">{o.customerPhone}</div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-gray-900 truncate max-w-[120px]">{o.apartmentNo}</div>
                                      <div className="text-[11px] text-gray-500 truncate max-w-[120px]">{o.address}</div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-gray-900">{o.pickupDate}</div>
                                      <div className="text-[11px] text-gray-500">{o.pickupTime}</div>
                                    </td>
                                    <td className="p-3 font-semibold text-gray-900">₹{o.total}</td>
                                    <td className="p-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${o.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {o.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      <button 
                                        onClick={() => setAdminActiveTab('orders')}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-2 py-1.5 rounded font-bold text-[11px]"
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
                        <div className="bg-gray-50 border border-gray-200 p-8 rounded-2xl text-center text-xs text-gray-500">
                          No order records. Try booking an order in the Customer App on the left!
                        </div>
                      ) : (
                        orders.map(o => (
                          <div key={o.id} className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col lg:flex-row justify-between gap-4">
                            
                            {/* Order Details Left Column */}
                            <div className="flex-1 flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-rose-500">{o.id}</span>
                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${o.speed === 'Urgent' ? 'bg-red-500/20 text-red-400' : o.speed === 'Express' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-200 text-gray-500'}`}>
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
                              <div className="text-[12px] text-gray-500 bg-white p-2.5 rounded-xl border border-gray-200 mt-1 max-w-sm">
                                <div className="font-bold text-gray-900 border-b border-gray-200 pb-1 mb-1">Basket Details:</div>
                                {o.items.map(item => (
                                  <div key={item.name} className="flex justify-between">
                                    <span>{item.name} (x{item.qty})</span>
                                    <span>₹{item.price * item.qty}</span>
                                  </div>
                                ))}
                                {o.specialInstructions && (
                                  <div className="text-[11px] text-amber-400 italic mt-2">
                                    *Instructions: {o.specialInstructions}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status Control Right Column */}
                            <div className="flex flex-col gap-3 lg:items-end justify-between">
                              <div className="lg:text-right">
                                <div className="text-sm font-extrabold text-gray-900">Total Value: ₹{o.total}</div>
                                <div className="flex items-center gap-1.5 lg:justify-end mt-1 text-[12px]">
                                  <span>Payment:</span>
                                  <span className={`font-bold ${o.paymentStatus === 'Paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {o.paymentStatus} ({o.paymentMethod})
                                  </span>
                                  {o.paymentStatus === 'Pending' && (
                                    <button 
                                      onClick={() => markOrderPaid(o.id)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-1.5 py-0.5 rounded text-[11px]"
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
                                    className="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
                                  >
                                    Accept & Pick Up
                                  </button>
                                )}
                                {o.status === 'Picked Up' && (
                                  <button 
                                    onClick={() => updateOrderStatus(o.id, 'Ironing')}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
                                  >
                                    Start Ironing
                                  </button>
                                )}
                                {o.status === 'Ironing' && (
                                  <button 
                                    onClick={() => updateOrderStatus(o.id, 'Ready')}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
                                  >
                                    Mark as Ready
                                  </button>
                                )}
                                {o.status === 'Ready' && (
                                  <button 
                                    onClick={() => updateOrderStatus(o.id, 'Delivered')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
                                  >
                                    Mark as Delivered
                                  </button>
                                )}
                                
                                <button 
                                  onClick={() => setSelectedInvoice(o)}
                                  className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-2 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1"
                                >
                                  <Eye className="size-3" /> Invoice
                                </button>
                                
                                <button 
                                  onClick={() => deleteOrder(o.id)}
                                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-2 py-1.5 rounded-lg text-[12px] font-bold"
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

                {/* OFFERS TAB */}
                {adminActiveTab === 'offers' && (
                  <div className="flex flex-col gap-4 text-left animate-fade-in">
                    <h3 className="text-sm font-bold text-gray-900">Manage Flash Offers (Home Screen Banners)</h3>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-xs text-amber-800 font-medium">
                      Manage the main Festive Banner (e.g. Diwali) and the 4 Quick Book image banners below it.
                    </div>
                    
                    <h4 className="font-bold text-sm text-gray-900 border-b border-gray-200 pb-2 mt-2">1. Main Festive Banner</h4>
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={editingFestive.enabled} onChange={e => setEditingFestive({...editingFestive, enabled: e.target.checked})} id="enableFestive" className="size-4 accent-rose-500" />
                        <label htmlFor="enableFestive" className="text-xs font-bold text-gray-900 cursor-pointer">Enable Main Banner</label>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-bold text-gray-500 uppercase">Banner Title</label>
                        <input type="text" value={editingFestive.title} onChange={e => setEditingFestive({...editingFestive, title: e.target.value})} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:border-rose-500" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-bold text-gray-500 uppercase">Subtitle</label>
                        <input type="text" value={editingFestive.subtitle} onChange={e => setEditingFestive({...editingFestive, subtitle: e.target.value})} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:border-rose-500" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-bold text-gray-500 uppercase">Image URL (Wide Format)</label>
                        <input type="text" value={editingFestive.img} onChange={e => setEditingFestive({...editingFestive, img: e.target.value})} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:border-rose-500" />
                      </div>
                    </div>

                    <h4 className="font-bold text-sm text-gray-900 border-b border-gray-200 pb-2 mt-4">2. Quick Book Category Images</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {editingOffers.map((offer, idx) => (
                        <div key={idx} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex flex-col gap-3">
                          <h4 className="font-bold text-xs text-gray-900">Banner #{idx + 1}</h4>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-bold text-gray-500 uppercase">Banner Name</label>
                            <input type="text" value={offer.name} onChange={e => { const newO = [...editingOffers]; newO[idx].name = e.target.value; setEditingOffers(newO); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:border-rose-500" />
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-bold text-gray-500 uppercase">Image URL (Unsplash or direct link)</label>
                            <input type="text" value={offer.img} onChange={e => { const newO = [...editingOffers]; newO[idx].img = e.target.value; setEditingOffers(newO); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:border-rose-500" />
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-bold text-gray-500 uppercase">Target Category Filter</label>
                            <input type="text" value={offer.cat} onChange={e => { const newO = [...editingOffers]; newO[idx].cat = e.target.value; setEditingOffers(newO); }} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:border-rose-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={async () => {
                          try {
                            const [offersRes, festiveRes] = await Promise.all([
                              fetch(`${API_URL}/settings/flash-offers`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(editingOffers) }),
                              fetch(`${API_URL}/settings/festive-offer`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(editingFestive) })
                            ]);
                            if (!offersRes.ok || !festiveRes.ok) throw new Error('Server rejected the update');
                            setFlashOffers(editingOffers);
                            setFestiveOffer(editingFestive);
                            triggerNotification('✅ Offers updated and saved to DB!');
                          } catch (err: any) {
                            customAlert('Failed to save: ' + err.message);
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-md"
                      >
                        Save Banners to Database
                      </button>
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
                                      <label className="text-[11px] font-bold text-gray-500 flex items-center justify-between">
                                        <span>{item.name}</span>
                                        <span className="text-[11px] bg-gray-100 text-gray-500 px-1 rounded-sm">{item.category}</span>
                                      </label>
                                      <input 
                                        type="number"
                                        value={editingPrices[key] !== undefined ? editingPrices[key] : item.price}
                                        onChange={e => setEditingPrices(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                        className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-rose-500"
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
                            <span className="text-[11px] bg-white text-gray-500 px-2 py-0.5 rounded font-bold">Active Customer</span>
                          </div>
                          <div className="text-[12px] text-gray-500 mt-1 flex flex-col gap-0.5 border-t border-gray-200/80 pt-2">
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
                          <label className="text-[12px] font-semibold text-gray-500">Merchant Phone Number</label>
                          <input 
                            type="text"
                            value={upiDetails.phone}
                            onChange={e => setUpiDetails({ ...upiDetails, phone: e.target.value })}
                            placeholder="e.g. 9791019505"
                            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-rose-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[12px] font-semibold text-gray-500">Merchant UPI ID</label>
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
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=${upiDetails.id}&pn=PressGo&cu=INR`} 
                            alt="Live QR Preview" 
                            className="w-[100px] h-[100px]"
                          />
                        </div>
                        <div className="text-[12px] text-gray-500 pt-2 flex-1">
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
                <h3 className="font-display text-xl font-semibold tracking-tight text-slate-900">PressGo Invoice</h3>
                <span className="text-[12px] text-gray-500 font-mono">No. {selectedInvoice.invoiceNo || `IK${selectedInvoice.id.split('-')[0].toUpperCase()}`}</span>
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
              <div className="text-[12px] text-gray-500 mt-1 font-semibold">{selectedInvoice.apartmentNo}</div>
              <div className="text-[12px] text-gray-500 truncate">{selectedInvoice.address}</div>
            </div>

            {/* Date Details */}
            <div className="grid grid-cols-2 gap-4 text-[12px] border-b border-slate-100 pb-3">
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
              <div className="grid grid-cols-12 text-[12px] font-bold uppercase text-gray-500 pb-1 border-b border-slate-100">
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
              <div className="flex justify-between text-[12px] mt-1">
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
              <label className="text-[12px] font-bold text-gray-500 uppercase">Reason for cancellation</label>
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
                    <span className={`text-[12px] font-medium ${rescheduleDate === d.value ? 'text-rose-100' : ''}`}>{d.label}</span>
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
                    className={`flex items-center justify-center py-2.5 rounded-xl border text-[12px] font-medium transition-all ${
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

      <footer className="border-t border-gray-200 bg-white px-6 py-4 text-center text-xs text-gray-500">
        <p>© 2026 PressGo. <a href="/terms.html" target="_blank" rel="noreferrer" className="underline hover:text-rose-500">Terms</a> · <a href="/privacy.html" target="_blank" rel="noreferrer" className="underline hover:text-rose-500">Privacy</a></p>
      </footer>

    </div>
  );
}
