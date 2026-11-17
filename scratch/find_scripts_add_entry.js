const fs = require('fs');

const content = fs.readFileSync('add-entry-code.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('<script')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

