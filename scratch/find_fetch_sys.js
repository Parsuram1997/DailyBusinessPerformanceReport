const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('fetchSystemOnline') || line.includes('crgb_bc') || line.includes('cgb_1') || line.includes('cgb_2')) {
    if (i < 2000) console.log(`${i+1}: ${line.trim()}`);
  }
});

