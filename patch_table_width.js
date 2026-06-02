const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/transactions-code.html', 'utf8');

// Change p-3 md:p-8 to p-0 sm:p-4 md:p-8 to remove left/right padding on mobile for full width table
content = content.replace('<div class="p-3 md:p-8 w-full mx-auto space-y-4 md:space-y-8">', '<div class="p-0 sm:p-4 md:p-8 w-full mx-auto space-y-4 md:space-y-8">');

// Add px-3 to the section so the title isn't glued to the screen edge
content = content.replace('<section class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">', '<section class="px-3 md:px-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">');

fs.writeFileSync('d:/BusinessPerformance/transactions-code.html', content);
console.log('Fixed padding in transactions table');
