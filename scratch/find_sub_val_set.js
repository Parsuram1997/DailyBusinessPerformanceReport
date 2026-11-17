const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('.value =') && (line.includes('roinet_1') || line.includes('online_p1'))) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

