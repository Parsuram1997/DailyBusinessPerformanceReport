const fs = require('fs');

['daily-txn.html', 'app.js', 'app-v2.js'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  console.log(`Checking ${file}...`);
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('aepsMatmProviders') || line.includes('aadhaarDepositProviders') || line.includes('openAccountProviders') || line.includes('cspWallets')) {
      console.log(`  Line ${i+1}: ${line.trim()}`);
    }
  });
});

