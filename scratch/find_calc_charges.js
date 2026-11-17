const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (i >= 10100 && i <= 10400 && (line.includes('chg') || line.includes('charges'))) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

