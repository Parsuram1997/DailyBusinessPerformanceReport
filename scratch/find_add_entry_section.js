const fs = require('fs');
const content = fs.readFileSync('add-entry-code.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('DAILY REVENUE') || line.includes('CSP Wallet') || line.includes('CGB BC') || line.toLowerCase().includes('cgb') || line.includes('openCsp') || line.includes('openOnline')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

