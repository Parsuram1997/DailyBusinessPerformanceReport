const fs = require('fs');
let html = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

html = html.replace('text-slate-400 ml-1">vs yesterday', 'text-white/70 ml-1">vs yesterday');
html = html.replace('text-slate-400 ml-1">vs last month', 'text-white/70 ml-1">vs last month');

fs.writeFileSync('d:/BusinessPerformance/app.js', html, 'utf8');
