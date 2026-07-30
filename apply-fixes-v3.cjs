const fs = require('fs');
const file = 'src/App.tsx';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Declare state for showConsoleInput
  content = content.replace(
    "const [activeCategory, setActiveCategory] = useState<string>('Light Weight');",
    "const [activeCategory, setActiveCategory] = useState<string>('Light Weight');\n  const [showConsoleInput, setShowConsoleInput] = useState(false);"
  );

  // 2. Add Steam Iron SVG inside the header logo instead of letters "IK"
  content = content.replace(
    `<div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 shadow-md">
              <span className="font-extrabold text-gray-900 text-lg tracking-wider">IK</span>
            </div>`,
    `<div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 shadow-md text-gray-900">
              <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 16h20" />
                <path d="M6 16a4 4 0 0 1-4-4V6h15a5 5 0 0 1 5 5v5" />
                <path d="M9 6v10" />
                <path d="M14 6v10" />
                <path d="M18 10h4" />
              </svg>
            </div>`
  );

  // 3. Add Console switcher at the bottom of the Customer Home tab content
  // We will insert it right before the closing div of home tab screen panel
  const targetEnd = `                          {/* Quick Tracker shortcut */}
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
                          )}`;

  const consoleBlock = `
                          {/* Console Gateway Link */}
                          <div className="mt-6 pt-4 border-t border-gray-150 flex flex-col items-center gap-2">
                            {showConsoleInput ? (
                              <div className="flex gap-2 items-center animate-fade-in">
                                <input 
                                  type="password"
                                  maxLength={4}
                                  placeholder="PIN"
                                  value={adminPin}
                                  onChange={e => setAdminPin(e.target.value.replace(/\\D/g, ''))}
                                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 w-20 text-center outline-none focus:border-rose-500"
                                />
                                <button 
                                  onClick={() => {
                                    handleAdminAccess();
                                    setShowConsoleInput(false);
                                  }}
                                  className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] px-3.5 py-1 rounded-lg transition-colors"
                                >
                                  Go
                                </button>
                                <button 
                                  onClick={() => setShowConsoleInput(false)}
                                  className="text-gray-400 hover:text-gray-600 text-xs px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setShowConsoleInput(true)}
                                className="text-[9px] font-bold text-gray-400 hover:text-rose-500 transition-colors uppercase tracking-wider"
                              >
                                Console
                              </button>
                            )}
                          </div>`;

  if (content.includes(targetEnd)) {
    content = content.replace(targetEnd, targetEnd + consoleBlock);
  } else {
    // If user has no active orders tracker visible, we still need a fallback replacement location
    content = content.replace(
      `                          {/* Services Grid */}`,
      `${consoleBlock}\n\n                          {/* Services Grid */}`
    );
  }

  fs.writeFileSync(file, content);
  console.log('App.tsx version 3 fixes applied successfully.');
}
