const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('roinet_1') && (line.includes('val') || line.includes('doc') || line.includes('save') || line.includes('data') || line.includes('details') || line.includes('setDoc') || line.includes('addDoc') || line.includes('value'))) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

