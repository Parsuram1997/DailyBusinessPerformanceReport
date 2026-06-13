const fs = require('fs');
const content = fs.readFileSync('../daily-txn.html', 'utf8');
const start = content.indexOf('id="txn-depositby"');
const end = content.indexOf('</select>', start);
console.log(content.substring(start, end + 9));
