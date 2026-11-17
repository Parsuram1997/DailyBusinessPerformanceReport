const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('DISHTV_RECHARGE') && (line.includes('charge') || line.includes('simplified') || line.includes('hidden') || line.includes('disable'))) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

