const fs = require('fs');
const file = 'src/App.tsx';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Fix header title ternary
  content = content.replace(
    `                            {customerActiveTab === 'order' ? 'Place Order' : \n                             customerActiveTab === 'prices' ? 'Pricing' :\n                             customerActiveTab === 'history' ? 'My Orders' : \n                             customerActiveTab === 'notifications' ? 'Notifications' : 'Support'}`,
    `                            {customerActiveTab === 'order' ? 'Place Order' : \n                             customerActiveTab === 'prices' ? 'Pricing' :\n                             customerActiveTab === 'history' ? 'My Orders' : \n                             customerActiveTab === 'notifications' ? 'Notifications' : \n                             customerActiveTab === 'rewards' ? 'Refer & Earn' :\n                             customerActiveTab === 'profile' ? 'Profile' : \n                             customerActiveTab === 'subscriptions' ? 'Prime Plans' : 'Support'}`
  );

  // 2. Default pickupTime to empty string
  content = content.replace(
    "const [pickupTime, setPickupTime] = useState('09:00 - 12:00');",
    "const [pickupTime, setPickupTime] = useState('');"
  );

  // 3. Delete pickupDate pre-population useEffect
  content = content.replace(
    `  useEffect(() => {
    if (!pickupDate && availableDates.length > 0) {
      setPickupDate(availableDates[0].value);
    }
  }, [pickupDate]);`,
    ''
  );

  // 4. Validate pickupTime during place order
  content = content.replace(
    `    if (!pickupDate) {
      alert('Please select a pickup date');
      return;
    }`,
    `    if (!pickupDate) {
      alert('Please select a pickup date');
      return;
    }
    if (!pickupTime) {
      alert('Please select a pickup slot time');
      return;
    }`
  );

  // 5. Change "IC" to "IK" logo text
  content = content.replace(
    'text-lg tracking-wider">IC</span>',
    'text-lg tracking-wider">IK</span>'
  );

  // 6. Update service selection carousel images and resizing
  content = content.replace(
    `                              {[
                                {name: 'Ironing', desc: 'Crisp, wrinkle-free pressing', img: '/ironing_icon.png'},
                                {name: 'Dry Cleaning', desc: 'Deep chemical cleaning for delicate fabrics', img: 'https://images.unsplash.com/photo-1616423640778-28d1b53229bd?w=400&h=300&fit=crop'},
                                {name: 'Laundry', desc: 'Everyday wash, dry, and fold', img: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400&h=300&fit=crop'}
                              ].map(svc => (
                                <button 
                                  key={svc.name}
                                  onClick={() => setSelectedService(svc.name as any)}
                                  className={\`snap-center shrink-0 w-[220px] rounded-2xl border transition-all text-left flex flex-col overflow-hidden relative \${selectedService === svc.name ? 'bg-gray-50 border-rose-500 ring-2 ring-rose-500 shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'bg-white border-gray-200 hover:border-gray-300'}\`}
                                >
                                  <div className="h-[120px] w-full bg-gray-50 relative">
                                    <img src={svc.img} alt={svc.name} className={\`w-full h-full object-cover transition-all duration-500 \${selectedService === svc.name ? 'opacity-100 scale-105' : 'opacity-60 grayscale-[30%]'}\`} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                                  </div>
                                  <div className="p-3 absolute bottom-0 left-0 right-0">
                                    <h4 className={\`text-sm font-extrabold \${selectedService === svc.name ? 'text-gray-900' : 'text-gray-700'}\`}>{svc.name}</h4>
                                    <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{svc.desc}</p>
                                  </div>`,
    `                              {[
                                {name: 'Ironing', desc: 'Crisp pressing', img: 'https://images.unsplash.com/photo-1517677129300-07b130802f46?w=400&h=300&fit=crop'},
                                {name: 'Dry Cleaning', desc: 'Delicate care', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop'},
                                {name: 'Laundry', desc: 'Wash & fold', img: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400&h=300&fit=crop'}
                              ].map(svc => (
                                <button 
                                  key={svc.name}
                                  onClick={() => setSelectedService(svc.name as any)}
                                  className={\`snap-center shrink-0 w-[140px] rounded-xl border transition-all text-left flex flex-col overflow-hidden relative \${selectedService === svc.name ? 'bg-gray-50 border-rose-500 ring-2 ring-rose-500 shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'bg-white border-gray-200 hover:border-gray-300'}\`}
                                >
                                  <div className="h-[90px] w-full bg-gray-50 relative">
                                    <img src={svc.img} alt={svc.name} className={\`w-full h-full object-cover transition-all duration-500 \${selectedService === svc.name ? 'opacity-100 scale-105' : 'opacity-60 grayscale-[30%]'}\`} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                                  </div>
                                  <div className="p-3 absolute bottom-0 left-0 right-0">
                                    <h4 className="text-xs font-black text-white">{svc.name}</h4>
                                    <p className="text-[8px] text-gray-300 mt-0.5 line-clamp-1">{svc.desc}</p>
                                  </div>`
  );

  // 7. Add Steam Press Feature Banner on Home Tab
  content = content.replace(
    `                           {/* Refer & Earn Banner */}
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
                           </div>`,
    `                           {/* Refer & Earn Banner */}
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

                           {/* Steam Press Feature Banner */}
                           <div 
                             onClick={() => setCustomerActiveTab('order')}
                             className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md flex items-center gap-3 cursor-pointer p-3 hover:border-rose-350 transition-all"
                           >
                             <img 
                               src="https://images.unsplash.com/photo-1517677129300-07b130802f46?w=200&h=150&fit=crop" 
                               alt="Steam Ironing" 
                               className="size-16 rounded-xl object-cover shrink-0" 
                             />
                             <div className="text-left flex-1 min-w-0">
                               <h4 className="text-xs font-black text-gray-950 uppercase tracking-wider">Professional Steam Press</h4>
                               <p className="text-[9px] text-gray-500 leading-normal mt-0.5">We use high-temperature steam vacuum tables for premium garment care.</p>
                             </div>
                           </div>`
  );

  // 8. Fix rewards tab black screen
  content = content.replace(
    `                          {/* Header Graphic */}
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
                          </div>`,
    `                          {/* Header Graphic */}
                          <div className="bg-gradient-to-tr from-rose-500/10 to-amber-500/10 rounded-[24px] p-6 border border-rose-500/25 shadow-sm flex flex-col items-center justify-center text-center mt-1 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl"></div>
                            
                            <div className="size-16 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-full flex items-center justify-center shadow-md mb-3 relative z-10">
                              <Gift className="size-8 text-white" />
                            </div>
                            <h2 className="text-xl font-black text-gray-950 relative z-10 tracking-tight">Refer & Earn ₹50</h2>
                            <p className="text-xs text-gray-600 mt-2 relative z-10 max-w-[250px] leading-relaxed">
                              Invite your friends to Iron Kart. When they complete their first order, you <strong className="text-rose-600">both get ₹50</strong> added to your wallets!
                            </p>
                          </div>`
  );

  // 9. Fill correct customer details in confirmOrderPayment
  content = content.replace(
    `    const newOrder: Order = {
      id: \`ORD-\${Math.floor(100000 + Math.random() * 900000)}\`,
      invoiceNo: \`IC-\${Math.floor(1000 + Math.random() * 9000)}\`,
      customerName: orderName || 'Walk-in Customer',
      customerPhone: orderPhone || '',
      apartmentNo: '',
      address: orderAddress || '',`,
    `    const newOrder: Order = {
      id: \`ORD-\${Math.floor(100000 + Math.random() * 900000)}\`,
      invoiceNo: \`IK-\${Math.floor(1000 + Math.random() * 9000)}\`,
      customerName: currentCustomer?.name || orderName || 'Walk-in Customer',
      customerPhone: currentCustomer?.phone || orderPhone || '',
      apartmentNo: currentCustomer?.apartmentNo || '',
      address: orderAddress || currentCustomer?.address || '',`
  );

  // 10. Replace support active tab layout
  const oldSupportBlock = `                      {/* SUPPORT & ADMIN GATEWAY TAB */}
                      {customerActiveTab === 'support' && (
                        <div className="flex flex-col gap-3 text-left">
                          <h3 className="text-sm font-bold text-gray-900">Help & Support</h3>
                          
                          <div className="bg-white border border-gray-200 p-4 rounded-2xl flex flex-col gap-4">
                            <div>
                              <h4 className="text-xs font-bold text-gray-900 mb-1">📞 Contact Support</h4>
                              <p className="text-[10px] text-gray-500 leading-relaxed">For immediate support regarding delivery schedules, reach us:</p>
                              <div className="flex flex-col gap-1.5 mt-2.5 text-[10px]">
                                <a href="tel:+919791019505" className="text-rose-500 font-bold hover:underline">Phone: +91 9791019505</a>
                                <a href="mailto:support@ironcart.com" className="text-rose-500 font-bold hover:underline">Email: support@ironcart.com</a>
                              </div>
                            </div>
                            
                            <div className="border-t border-gray-200 pt-3">
                              <h4 className="text-xs font-bold text-gray-900 mb-1">💬 WhatsApp Chat</h4>
                              <a 
                                href="https://wa.me/919791019505" 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl mt-2 text-center"
                              >
                                Chat on WhatsApp
                              </a>
                            </div>

                            {/* FAQ Section */}
                            <div className="border-t border-gray-200 pt-3">
                              <h4 className="text-xs font-bold text-gray-950 mb-2">❓ Frequently Asked Questions</h4>
                              <div className="flex flex-col gap-2">
                                {[
                                  { q: "How long does ironing take?", a: "Standard turnaround time is 24 to 48 hours depending on your pickup schedule." },
                                  { q: "How do I top up my wallet?", a: "Go to the Home tab and tap '+ Add Money to Wallet'. You can pay securely using UPI, Credit/Debit cards, or NetBanking." },
                                  { q: "Can I reschedule my pickup?", a: "Yes, go to 'My Orders' tab, select your active order, and tap the 'Reschedule' button to select a new slot." },
                                  { q: "Do you iron designer sarees?", a: "Yes! Designer sarees, silk garments, and wedding sets fall under our Premium category and are ironed with special low-temperature steam care." }
                                ].map((faq, idx) => (
                                  <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                                    <button 
                                      onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                                      className="w-full text-left bg-gray-50 hover:bg-gray-100 p-2.5 flex justify-between items-center text-[10px] font-bold text-gray-700"
                                    >
                                      <span>{faq.q}</span>
                                      <ChevronRight className={\`size-3 text-gray-400 transition-all \${expandedFaq === idx ? 'rotate-90' : ''}\`} />
                                    </button>
                                    {expandedFaq === idx && (
                                      <div className="p-2.5 bg-white text-[9px] text-gray-500 leading-relaxed border-t border-gray-100">
                                        {faq.a}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Owner Admin Gateway Switcher */}
                            <div className="border-t border-gray-200 pt-3 bg-white/60 p-2.5 rounded-xl border border-dashed border-gray-200">
                              <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <Key className="size-3.5 text-amber-500 animate-pulse" />
                                Owner Portal Gateway
                              </h4>
                              <p className="text-[9px] text-gray-400 mt-1">If you are the business owner, enter your access PIN to open the dashboard:</p>
                              <div className="flex gap-2 mt-3">
                                <input 
                                  type="password"
                                  maxLength={4}
                                  placeholder="PIN"
                                  value={adminPin}
                                  onChange={e => setAdminPin(e.target.value.replace(/\\D/g, ''))}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 w-24 text-center outline-none"
                                />
                                <button 
                                  onClick={handleAdminAccess}
                                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1 rounded-lg"
                                >
                                  Enter Portal
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}`;

  const newSupportBlock = `                      {/* SUPPORT & ADMIN GATEWAY TAB */}
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
                                        <ChevronRight className={\`size-3 text-gray-400 transition-all \${expandedFaq === keyIndex ? 'rotate-90' : ''}\`} />
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
                                  <ChevronRight className={\`size-3 text-gray-400 transition-all \${expandedFaq === 20 ? 'rotate-90' : ''}\`} />
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
                                  <ChevronRight className={\`size-3 text-gray-400 transition-all \${expandedFaq === 30 ? 'rotate-90' : ''}\`} />
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
                                        <ChevronRight className={\`size-3 text-gray-400 transition-all \${expandedFaq === keyIndex ? 'rotate-90' : ''}\`} />
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

                          {/* Owner Admin Gateway Switcher */}
                          <div className="border-t border-gray-200 pt-3 bg-white/60 p-2.5 rounded-xl border border-dashed border-gray-200">
                            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                              <Key className="size-3.5 text-amber-500 animate-pulse" />
                              Owner Portal Gateway
                            </h4>
                            <p className="text-[9px] text-gray-400 mt-1">If you are the business owner, enter your access PIN to open the dashboard:</p>
                            <div className="flex gap-2 mt-3">
                              <input 
                                type="password"
                                maxLength={4}
                                placeholder="PIN"
                                value={adminPin}
                                onChange={e => setAdminPin(e.target.value.replace(/\\D/g, ''))}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 w-24 text-center outline-none"
                              />
                              <button 
                                onClick={handleAdminAccess}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1 rounded-lg"
                              >
                                Enter Portal
                              </button>
                            </div>
                          </div>

                        </div>
                      )}`;

  if (content.includes(oldSupportBlock.trim()) || content.indexOf('Contact Support') !== -1) {
    // Replaced via custom block or raw replacement
    fs.writeFileSync(file, content);
    console.log('App.tsx basic replacements done.');
  }

  // To be safe, let's write a targeted replace for the support tab block
  let freshContent = fs.readFileSync(file, 'utf8');
  const supportStartTag = "{customerActiveTab === 'support' && (";
  const startIndex = freshContent.indexOf(supportStartTag);
  if (startIndex !== -1) {
    // Find the matching end index
    let braceCount = 1;
    let endIndex = startIndex + supportStartTag.length;
    while (braceCount > 0 && endIndex < freshContent.length) {
      if (freshContent[endIndex] === '{') braceCount++;
      else if (freshContent[endIndex] === '}') braceCount--;
      endIndex++;
    }
    const fullTabSection = freshContent.substring(startIndex, endIndex);
    freshContent = freshContent.replace(fullTabSection, newSupportBlock);
    fs.writeFileSync(file, freshContent);
    console.log('App.tsx support tab replaced successfully.');
  }
}
