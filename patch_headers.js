const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/daily-txn.html', 'utf8');

content = content.replace('<th class="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Time</th>', '<th class="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left whitespace-nowrap">Time</th>');

content = content.replace('<th id="balance-col-header" class="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Balance (C/O)</th>', '<th id="balance-col-header" class="px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Balance (C/O)</th>');

fs.writeFileSync('d:/BusinessPerformance/daily-txn.html', content);
console.log('Fixed whitespace-nowrap in daily-txn.html headers');
