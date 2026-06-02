const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/dashboard-code.html', 'utf8');

appJs = appJs.replace('<div class="p-8 w-full space-y-8">', '<div class="p-3 md:p-8 w-full space-y-4 md:space-y-8">');

fs.writeFileSync('d:/BusinessPerformance/dashboard-code.html', appJs);
console.log('Fixed dashboard');
