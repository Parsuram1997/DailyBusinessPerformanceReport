const fs = require('fs');
let html = fs.readFileSync('d:/BusinessPerformance/reports-code.html', 'utf8');

html = html.replace(/group-hover:scale-110(\s*)<span/g, 'group-hover:scale-110">$1<span');
html = html.replace(/group-hover:scale-110">">/g, 'group-hover:scale-110">');

fs.writeFileSync('d:/BusinessPerformance/reports-code.html', html, 'utf8');
