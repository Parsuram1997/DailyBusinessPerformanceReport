const fs = require('fs');
const content = fs.readFileSync('transactions-code.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('<option') && (line.toLowerCase().includes('crgb') || line.toLowerCase().includes('cgb'))) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
});

