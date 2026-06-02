const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/dashboard-code.html', 'utf8');

// Responsive gap for grids
content = content.replace(/gap-6/g, 'gap-4 md:gap-6');
content = content.replace(/gap-4 md:gap-4 md:gap-6/g, 'gap-4 md:gap-6'); // in case of duplicate replacement

// Responsive padding for chart cards and projection cards
content = content.replace(/p-6/g, 'p-4 md:p-6');
content = content.replace(/p-4 md:p-4 md:p-6/g, 'p-4 md:p-6'); // in case of duplicate replacement

// Also ensure container is px-2 py-4 md:p-8
content = content.replace('<div class="p-2 md:p-8 w-full space-y-4 md:space-y-8">', '<div class="p-2 sm:p-4 md:p-8 w-full space-y-4 md:space-y-8">');

fs.writeFileSync('d:/BusinessPerformance/dashboard-code.html', content);
console.log('Fixed responsive padding and gaps in dashboard');
