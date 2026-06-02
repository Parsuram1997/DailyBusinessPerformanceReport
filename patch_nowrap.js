const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');
let lines = content.split('\n');

if (lines[7729].includes('class="px-3 py-1.5"')) {
    lines[7729] = lines[7729].replace('class="px-3 py-1.5"', 'class="px-3 py-1.5 whitespace-nowrap"');
}
if (lines[7815].includes('class="px-3 py-1.5 balance-col-cell"')) {
    lines[7815] = lines[7815].replace('class="px-3 py-1.5 balance-col-cell"', 'class="px-3 py-1.5 balance-col-cell whitespace-nowrap"');
}

fs.writeFileSync('d:/BusinessPerformance/app.js', lines.join('\n'));
console.log('Fixed whitespace-nowrap in daily txn table columns');
