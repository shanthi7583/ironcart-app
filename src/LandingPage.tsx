import { useState, useEffect } from 'react';
import {
  ChevronRight, Truck, Sparkles, ShieldCheck, MapPin, Wallet,
  CalendarCheck, PackageCheck, CheckCircle2, Shirt, Menu, X
} from 'lucide-react';

// Rotating hero shots, mirroring how iztri.com's homepage cycles several images:
// authentic close-ups of the actual work rather than posed stock portraits.
// These are our own freely-licensed photos (Pexels) — deliberately NOT iztri's,
// whose images are their copyrighted content.
const HERO_IMAGES = [
  { src: '/img-hero-steam-machine.jpg', alt: 'Modern handheld garment steamer finishing a shirt' },
  { src: '/img-hero-ironing-action.jpg', alt: 'Close-up of a steam iron pressing a garment' },
  { src: '/img-hero-pro-ironing.jpg', alt: 'Professional pressing freshly laundered linens' },
  { src: '/img-folded-shirts-blue.jpg', alt: 'Freshly cleaned and neatly folded clothes' }
];

const SERVICES = [
  {
    name: 'Steam Ironing',
    img: '/img-steam-ironing-blue.jpg',
    desc: 'Fabric-safe steam pressing for crisp, wrinkle-free clothes — no burns, no shine, just a clean finish.'
  },
  {
    name: 'Dry Cleaning',
    img: '/img-category-premium.jpg',
    desc: 'Careful handling for delicate fabrics, formalwear and special-occasion pieces that need extra attention.'
  },
  {
    name: 'Laundry',
    img: '/img-service-laundry.jpg',
    desc: 'Washed, dried and neatly folded — everyday clothes, fresh and ready to wear again.'
  }
];

const STEPS = [
  { icon: CalendarCheck, title: 'Schedule a pickup', desc: 'Pick a date and time slot that works for you, right from the app.' },
  { icon: Truck, title: 'We collect', desc: 'A pickup partner collects your garments from your doorstep.' },
  { icon: Sparkles, title: 'Expert care', desc: 'Each item is steam-pressed, dry-cleaned or laundered with real care.' },
  { icon: PackageCheck, title: 'Quality check', desc: 'Every piece is inspected and packed before it heads back to you.' },
  { icon: CheckCircle2, title: 'Delivered fresh', desc: 'Your clothes arrive back at your door, crisp and ready to wear.' }
];

const FEATURES = [
  { icon: MapPin, title: 'Doorstep convenience', desc: 'Free pickup and delivery, scheduled around your day — no trip to a shop.' },
  { icon: Sparkles, title: 'Fabric-safe steam care', desc: 'Professional steam ironing that’s gentle on every fabric, every time.' },
  { icon: Truck, title: 'Real-time order tracking', desc: 'Know exactly where your order is, from pickup to delivery.' },
  { icon: ShieldCheck, title: 'Secure digital payments', desc: 'Pay safely by card, UPI or wallet — whichever you prefer.' }
];

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Why PressGo', href: '#why-pressgo' },
  { label: 'About', href: '#about' }
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${compact ? 'size-8' : 'size-9'} rounded-xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 shadow-md flex items-center justify-center border-2 border-white shrink-0`}>
        <svg viewBox="0 0 48 48" className={compact ? 'size-4.5' : 'size-5'} fill="none">
          <path d="M32 8c0 1.2-1.6 1.2-1.6 2.4s1.6 1.2 1.6 2.4" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <path d="M36 6c0 1.2-1.6 1.2-1.6 2.4s1.6 1.2 1.6 2.4" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <circle cx="24" cy="9" r="2" stroke="white" strokeWidth="3.4" />
          <path d="M24 11v3" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M24 14 L9 27a2.5 2.5 0 0 0 1.5 4.5h27a2.5 2.5 0 0 0 1.5-4.5L24 14Z" stroke="white" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M14.5 34h19" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      </div>
      <span className="font-display text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-600 tracking-tight">PressGo</span>
    </div>
  );
}

// The lead-capture form lived here. It is removed while the first-order campaign is
// paused: it advertised two free orders and collected a phone number, but nothing
// grants those credits and the leads table does not exist, so a visitor who filled it
// in got an error and no offer. Recoverable from git history when the campaign runs —
// note that it carried a deliberately unticked consent checkbox, which WhatsApp
// requires before it will approve a marketing template.

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setHeroIndex(i => (i + 1) % HERO_IMAGES.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Logo compact />
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} className="text-sm font-semibold text-gray-600 hover:text-blue-700 transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onGetStarted}
              className="hidden sm:flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm shadow-blue-600/30 transition-colors"
            >
              Get Started <ChevronRight className="size-4" />
            </button>
            <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 text-gray-600" aria-label="Toggle menu">
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 px-5 py-4 flex flex-col gap-4 bg-white">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-gray-700">
                {link.label}
              </a>
            ))}
            <button
              onClick={onGetStarted}
              className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
            >
              Get Started <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50"></div>
        <div className="absolute -top-24 -right-24 size-96 bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 size-96 bg-teal-400/10 rounded-full blur-3xl"></div>
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.05]">
              Crisp, fresh clothes,<br className="hidden sm:block" /> delivered to your door.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-md mx-auto md:mx-0 leading-relaxed">
              Professional steam ironing, dry cleaning and laundry — picked up and delivered back to you, hassle-free.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
              <button
                onClick={onGetStarted}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-colors"
              >
                Get Started <ChevronRight className="size-4" />
              </button>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-800 text-sm font-bold px-7 py-3.5 rounded-xl border border-gray-200 transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden shadow-2xl shadow-blue-900/20">
            {HERO_IMAGES.map((img, i) => (
              <img
                key={img.src}
                src={img.src}
                alt={img.alt}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out"
                style={{ opacity: i === heroIndex ? 1 : 0 }}
              />
            ))}
            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {HERO_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === heroIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">Our services</h2>
          <p className="mt-3 text-gray-600">Everything your wardrobe needs, handled with care.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map(svc => (
            <div key={svc.name} className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-44">
                <img src={svc.img} alt={svc.name} className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Shirt className="size-4 text-blue-600" /> {svc.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{svc.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gradient-to-b from-blue-50/60 to-transparent py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">How it works</h2>
            <p className="mt-3 text-gray-600">From pickup to delivery, simple and seamless.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="size-10 rounded-xl bg-blue-600/10 flex items-center justify-center mb-3">
                    <Icon className="size-5 text-blue-700" />
                  </div>
                  <span className="absolute top-4 right-4 text-xs font-bold text-gray-300">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-display font-bold text-gray-900 text-sm">{step.title}</h3>
                  <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why PressGo */}
      <section id="why-pressgo" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">Why PressGo</h2>
          <p className="mt-3 text-gray-600">Built around your day, not the other way round.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="text-center sm:text-left">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 flex items-center justify-center mb-4 mx-auto sm:mx-0 shadow-md shadow-blue-500/30">
                  <Icon className="size-6 text-white" />
                </div>
                <h3 className="font-display font-bold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">About PressGo</h2>
          <p className="mt-5 text-blue-50 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            PressGo brings professional garment care to your doorstep — steam ironing, dry cleaning and laundry,
            without the trip to a shop. We handle every piece the way you would yourself, so you get a little more
            time back for everything else.
          </p>
          <button
            onClick={onGetStarted}
            className="mt-8 inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-700 text-sm font-bold px-7 py-3.5 rounded-xl shadow-lg transition-colors"
          >
            Get Started <ChevronRight className="size-4" />
          </button>
        </div>
      </section>

      {/* The lead-capture section is withheld while the first-order campaign is paused.
          It advertised two free orders and asked for a phone number, but nothing grants
          those credits and the leads table does not exist, so a visitor who filled it in
          got an error and no offer. LeadForm below is intact for when the campaign runs. */}

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo compact />
          <p className="text-xs text-gray-500 text-center">
            © 2026 PressGo. <a href="/terms.html" target="_blank" rel="noreferrer" className="underline hover:text-blue-700">Terms</a> · <a href="/privacy.html" target="_blank" rel="noreferrer" className="underline hover:text-blue-700">Privacy</a>
          </p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Wallet className="size-3.5" /> Support: 8 AM – 8 PM daily
          </div>
        </div>
      </footer>
    </div>
  );
}
