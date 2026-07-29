const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace all remaining text-white with text-gray-900 globally!
content = content.replace(/text-white/g, 'text-gray-900');

// Now, restore text-white ONLY for elements that have a primary colored background
const primaryClasses = [
  'bg-emerald-600', 'bg-emerald-500', 
  'bg-rose-500', 'bg-rose-600', 
  'bg-blue-600', 'bg-blue-700',
  'bg-amber-600', 'bg-amber-700',
  'bg-\\[#25D366\\]', 'bg-\\[#1ebd5a\\]',
  'from-rose-500', 'to-rose-600'
];

primaryClasses.forEach(cls => {
  // Regex to match: className="... {primaryClass} ... text-gray-900 ..."
  const regex1 = new RegExp(`className="([^"]*)${cls}([^"]*)text-gray-900([^"]*)"`, 'g');
  content = content.replace(regex1, `className="$1${cls}$2text-white$3"`);
  
  // Regex to match: className="... text-gray-900 ... {primaryClass} ..."
  const regex2 = new RegExp(`className="([^"]*)text-gray-900([^"]*)${cls}([^"]*)"`, 'g');
  content = content.replace(regex2, `className="$1text-white$2${cls}$3"`);
});

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed text-white');
