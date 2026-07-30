const fs = require('fs');
const file = 'src/App.tsx';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Remove Owner Portal Gateway under Support tab
  const gatewayBlock = `                          {/* Owner Admin Gateway Switcher */}
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
                          </div>`;
  content = content.replace(gatewayBlock, '');

  // 2. Compact & Resize service selection buttons (for mobile compatibility without horizontal scroll)
  content = content.replace(
    "className={`snap-center shrink-0 w-[140px] rounded-xl border transition-all text-left flex flex-col overflow-hidden relative ${selectedService === svc.name ? 'bg-gray-50 border-rose-500 ring-2 ring-rose-500 shadow-[0_4px_15px_rgba(225,29,72,0.4)]' : 'bg-white border-gray-200 hover:border-gray-300'}`}",
    "className={`snap-center shrink-0 w-[105px] rounded-xl border transition-all text-left flex flex-col overflow-hidden relative ${selectedService === svc.name ? 'bg-gray-50 border-rose-500 ring-2 ring-rose-500 shadow-[0_2px_8px_rgba(225,29,72,0.3)]' : 'bg-white border-gray-200 hover:border-gray-300'}`}"
  );
  content = content.replace(
    'className="h-[90px] w-full bg-gray-50 relative"',
    'className="h-[65px] w-full bg-gray-50 relative"'
  );
  content = content.replace(
    'className="p-3 absolute bottom-0 left-0 right-0"',
    'className="p-1.5 absolute bottom-0 left-0 right-0"'
  );
  content = content.replace(
    'className="text-xs font-black text-white"',
    'className="text-[10px] font-black text-white"'
  );
  content = content.replace(
    'className="text-[8px] text-gray-300 mt-0.5 line-clamp-1"',
    'className="text-[7px] text-gray-300 line-clamp-1"'
  );

  // 3. Update category picker images in Book tab (Lightweight, medium, premium, household)
  content = content.replace(
    "img: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=300&fit=crop'",
    "img: 'https://images.unsplash.com/photo-1517677129300-07b130802f46?w=400&h=300&fit=crop'"
  );
  content = content.replace(
    "img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=300&fit=crop'",
    "img: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=400&h=300&fit=crop'"
  );
  content = content.replace(
    "img: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&h=300&fit=crop'",
    "img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop'"
  );

  // 4. UPI settings database insert call: remove non-existent service_type column
  content = content.replace(
    `                  category: 'system',
                  item_name: 'upi_details',
                  price: 0,
                  icon: packed,
                  service_type: 'system'`,
    `                  category: 'system',
                  item_name: 'upi_details',
                  price: 0,
                  icon: packed`
  );

  // 5. Checkout payment mode: Add Card input fields and Bank Selector fields
  const cardBlock = `                  {paymentMethod === 'Card' && (
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
                  )}`;

  // Find where to insert cardBlock (right before Wallet render block)
  content = content.replace(
    `                  {paymentMethod === 'Wallet' && (`,
    `${cardBlock}\n\n                  {paymentMethod === 'Wallet' && (`
  );

  fs.writeFileSync(file, content);
  console.log('App.tsx version 2 fixes applied successfully.');
}
