const fs = require('fs');

['app.js', 'app-v2.js'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('spicemoney') && line.includes('[')) {
      console.log(`${file}:${i+1}: ${line.trim()}`);
    }
  });
});

