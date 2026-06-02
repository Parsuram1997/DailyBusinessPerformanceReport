const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/dashboard-code.html', 'utf8');

// Fix header padding
content = content.replace('px-8 sticky top-0', 'px-3 md:px-8 sticky top-0');

// Fix main container padding
content = content.replace('<div class="p-3 md:p-8 w-full space-y-4 md:space-y-8">', '<div class="p-2 md:p-8 w-full space-y-4 md:space-y-8">');

fs.writeFileSync('d:/BusinessPerformance/dashboard-code.html', content);
console.log('Fixed padding in dashboard');
