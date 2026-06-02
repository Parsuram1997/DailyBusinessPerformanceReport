const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/daily-txn.html', 'utf8');

// Change p-2 md:p-8 to p-0 sm:p-4 md:p-8
content = content.replace('<div class="p-2 md:p-8 w-full space-y-4 md:space-y-8">', '<div class="p-0 sm:p-4 md:p-8 w-full space-y-4 md:space-y-8">');

// Add px-3 to the header section
content = content.replace('<div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">', '<div class="px-3 md:px-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">');

// There are other sections that need px-3 so they are not edge-to-edge
content = content.replace('<div class="grid grid-cols-1 md:grid-cols-2 gap-4">', '<div class="px-3 md:px-0 grid grid-cols-1 md:grid-cols-2 gap-4">');

fs.writeFileSync('d:/BusinessPerformance/daily-txn.html', content);
console.log('Fixed padding in daily txn');
