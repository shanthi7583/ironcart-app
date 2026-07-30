const fs = require('fs');

const files = [
  'src/App.tsx',
  'server/server.js',
  'index.html',
  'package.json'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/IronCart/g, 'Iron Kart');
    fs.writeFileSync(file, content);
    console.log(`Rebranded ${file}`);
  }
});
