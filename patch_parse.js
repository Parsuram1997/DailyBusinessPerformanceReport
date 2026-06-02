const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

// Replace the buggy regex with a robust one that strips everything except digits and decimal point
appJs = appJs.replace(/const totalText = totalValDisplay\.innerText\.replace\(\/\[.*?\]\/g, ''\);/g, "const totalText = totalValDisplay.innerText.replace(/[^0-9.-]+/g, '');");

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('Fixed parsing');
