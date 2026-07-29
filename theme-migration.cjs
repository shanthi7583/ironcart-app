const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  // Backgrounds
  [/bg-slate-950/g, 'bg-white'],
  [/bg-slate-900/g, 'bg-gray-50'],
  [/bg-slate-850/g, 'bg-gray-100'],
  [/bg-slate-800\/50/g, 'bg-gray-100/50'],
  [/bg-slate-800/g, 'bg-gray-200'],
  [/bg-slate-700/g, 'bg-gray-300'],
  
  // Hover Backgrounds
  [/hover:bg-slate-850/g, 'hover:bg-gray-100'],
  [/hover:bg-slate-800/g, 'hover:bg-gray-200'],
  [/hover:bg-slate-700/g, 'hover:bg-gray-300'],

  // Borders
  [/border-slate-850/g, 'border-gray-200'],
  [/border-slate-800\/50/g, 'border-gray-200/80'],
  [/border-slate-800/g, 'border-gray-200'],
  [/border-slate-700/g, 'border-gray-300'],

  // Text Colors
  [/text-slate-100/g, 'text-gray-900'],
  [/text-slate-200/g, 'text-gray-800'],
  [/text-slate-300/g, 'text-gray-700'],
  [/text-slate-400/g, 'text-gray-500'],
  [/text-slate-500/g, 'text-gray-400'],
];

replacements.forEach(([regex, replacement]) => {
  content = content.replace(regex, replacement);
});

// For elements that were dark but are now light, we need to swap text-white to text-gray-900 if they don't have a colored background (like bg-rose-500)
// For example, in inputs: `text-white` inside `bg-gray-50` becomes invisible.
content = content.replace(/className="([^"]*)bg-gray-50([^"]*)text-white([^"]*)"/g, 'className="$1bg-gray-50$2text-gray-900$3"');
content = content.replace(/className="([^"]*)bg-white([^"]*)text-white([^"]*)"/g, 'className="$1bg-white$2text-gray-900$3"');
content = content.replace(/className="([^"]*)text-white([^"]*)bg-gray-50([^"]*)"/g, 'className="$1text-gray-900$2bg-gray-50$3"');
content = content.replace(/className="([^"]*)text-white([^"]*)bg-white([^"]*)"/g, 'className="$1text-gray-900$2bg-white$3"');

// Update the booking form to show the newly added icon
content = content.replace(
  /<div className=\"flex justify-between items-center mb-1\">\s*<h4 className=\"font-bold text-sm text-gray-900\">\s*\{item\.name\}\s*<\/h4>/g,
  '<div className="flex justify-between items-center mb-1">\n                                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">\n                                    <span className="text-xl bg-gray-100 p-1 rounded-lg shadow-sm border border-gray-200">{item.icon || \'👕\'}</span>\n                                    {item.name}\n                                  </h4>'
);

// Update price list screen
content = content.replace(
  /<div className=\"font-bold text-gray-900\">\s*\{item\.name\}\s*<\/div>/g,
  '<div className="font-bold text-gray-900 flex items-center gap-2">\n                                  <span className="text-xl bg-white shadow-sm border border-gray-200 p-1.5 rounded-xl">{item.icon || \'👕\'}</span>\n                                  {item.name}\n                                </div>'
);

fs.writeFileSync('src/App.tsx', content);
console.log('Migration complete!');
