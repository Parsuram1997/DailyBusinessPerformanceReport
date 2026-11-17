const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('expected-roinet_1') || line.includes('expected-online_p1') || line.includes('expected_roinet') || line.includes('expectedSplit') || line.includes('expected-split-total')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

