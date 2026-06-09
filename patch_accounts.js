const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

// Remove the mobile-only subtitle
content = content.replace('<span class="text-xs text-slate-400 font-bold uppercase lg:hidden mt-0.5">${bank} • ${type} • A/c ${accNo}</span>', '');

// Add whitespace-nowrap to the columns
content = content.replace('<td class="px-5 py-4 align-middle">', '<td class="px-5 py-4 align-middle whitespace-nowrap">');
content = content.replace('<td class="px-5 py-4 align-middle text-center "><span class="text-sm font-bold text-slate-600 dark:text-slate-300">${bank}</span></td>', '<td class="px-5 py-4 align-middle text-center whitespace-nowrap"><span class="text-sm font-bold text-slate-600 dark:text-slate-300">${bank}</span></td>');
content = content.replace('<td class="px-5 py-4 align-middle text-center "><span class="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">${accNo}</span></td>', '<td class="px-5 py-4 align-middle text-center whitespace-nowrap"><span class="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">${accNo}</span></td>');
content = content.replace('<td class="px-5 py-4 align-middle text-center "><span class="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary dark:text-purple-300 rounded border border-primary/20 tracking-wider uppercase">${type}</span></td>', '<td class="px-5 py-4 align-middle text-center whitespace-nowrap"><span class="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary dark:text-purple-300 rounded border border-primary/20 tracking-wider uppercase">${type}</span></td>');

fs.writeFileSync('d:/BusinessPerformance/app.js', content);
console.log('Fixed whitespace-nowrap in accounts table columns');
