const fs = require('fs');
const lines = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8').split('\n');

if (lines[7730].includes('class="px-3 py-1.5"')) {
    lines[7730] = lines[7730].replace('class="px-3 py-1.5"', 'class="px-3 py-1.5 whitespace-nowrap"');
}
if (lines[7816].includes('class="px-3 py-1.5 balance-col-cell"')) {
    lines[7816] = lines[7816].replace('class="px-3 py-1.5 balance-col-cell"', 'class="px-3 py-1.5 balance-col-cell whitespace-nowrap"');
}

fs.writeFileSync('d:/BusinessPerformance/app.js', lines.join('\n'));
console.log('Successfully patched lines 7730 and 7816');
