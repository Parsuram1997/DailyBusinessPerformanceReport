const fs = require('fs');
const content = fs.readFileSync('daily-txn.html', 'utf8');
const getSelect = (id) => {
  const regex = new RegExp('<select[^>]*id=["\']' + id + '["\'][^>]*>([\\s\\S]*?)</select>');
  const match = content.match(regex);
  return match ? match[1] : 'NOT FOUND';
};
console.log('=== txn-provider ===\n' + getSelect('txn-provider').trim());
console.log('\n=== txn-csp-provider ===\n' + getSelect('txn-csp-provider').trim());
console.log('\n=== txn-qr-wallet ===\n' + getSelect('txn-qr-wallet').trim());

