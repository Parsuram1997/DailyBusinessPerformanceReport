const fs = require('fs');
const content = fs.readFileSync('daily-txn.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('<nav') && line.includes('fixed') || line.includes('bottom-0')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

