const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('cgb_1') || line.includes('cgb_2') || line.includes('cgbBreakdown') || line.includes('_cgbBreakdown')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

