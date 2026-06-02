const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');
appJs = appJs.split("['DEPOSIT', 'FREE_DEPOSIT', 'ADMIN_DEPOSIT']").join("['DEPOSIT', 'AADHAAR_DEPOSIT', 'FREE_DEPOSIT', 'ADMIN_DEPOSIT']");
fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('Replaced arrays');
