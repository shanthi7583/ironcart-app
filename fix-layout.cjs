const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The new category block that was placed incorrectly
const categoryBlock = `
                            <div className="flex overflow-x-auto scrollbar-hide pb-3 -mx-2 px-2 gap-3 border-b border-gray-200">
                              {[
                                { name: 'Light Weight', img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=150&fit=crop' },
                                { name: 'Medium/Heavy', img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=200&h=150&fit=crop' },
                                { name: 'Premium', img: 'https://images.unsplash.com/photo-1610030469983-98e550d61dc0?w=200&h=150&fit=crop' },
                                { name: 'Household', img: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=200&h=150&fit=crop' }
                              ].map(cat => (
                                <button
                                  key={cat.name}
                                  onClick={() => setActiveCategory(cat.name)}
                                  className={\`relative shrink-0 w-[120px] h-[80px] rounded-2xl overflow-hidden transition-all shadow-sm \${
                                    activeCategory === cat.name 
                                    ? 'ring-2 ring-rose-500 ring-offset-2 scale-105 shadow-[0_4px_12px_rgba(225,29,72,0.3)]' 
                                    : 'opacity-70 hover:opacity-100 grayscale-[40%] hover:grayscale-0'
                                  }\`}
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
`;

// Remove the block from the wrong spot
content = content.replace(categoryBlock.trim(), '');
content = content.replace(categoryBlock.trim(), ''); // just in case

// Insert it at the right spot
content = content.replace(
  '{/* Garment Categorized Selection */}\n                          <div className="flex flex-col gap-2 mt-2">',
  '{/* Garment Categorized Selection */}\n                          <div className="flex flex-col gap-2 mt-2">\n' + categoryBlock
);

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed Layout');
