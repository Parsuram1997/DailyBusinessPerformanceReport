const fs = require('fs');
const content = fs.readFileSync('daily-txn.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('account-register-code.html') || line.includes('Account Register')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});

