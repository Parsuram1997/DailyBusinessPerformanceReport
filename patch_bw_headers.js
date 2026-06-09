const fs = require('fs');
let bw = fs.readFileSync('d:/BusinessPerformance/bank-withdrawals-code.html', 'utf8');

// Replace all th classes that don't have whitespace-nowrap to include it
bw = bw.replace(/<th class="([^"]*?)(?<!whitespace-nowrap)"/g, '<th class="$1 whitespace-nowrap"');

// Clean up any double spaces or duplicate whitespace-nowrap just in case
bw = bw.replace(/whitespace-nowrap whitespace-nowrap/g, 'whitespace-nowrap');

fs.writeFileSync('d:/BusinessPerformance/bank-withdrawals-code.html', bw);
console.log('Added whitespace-nowrap to headers');
