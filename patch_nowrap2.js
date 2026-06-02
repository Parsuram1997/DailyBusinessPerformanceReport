const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

content = content.replace(
    '<td class="px-3 py-1.5">\n                                        <div class="flex flex-col">\n                                            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${time}</span>\n                                            <span class="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">${txn.date}</span>\n                                        </div>\n                                    </td>',
    '<td class="px-3 py-1.5 whitespace-nowrap">\n                                        <div class="flex flex-col">\n                                            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${time}</span>\n                                            <span class="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">${txn.date}</span>\n                                        </div>\n                                    </td>'
);

content = content.replace(
    '<td class="px-3 py-1.5 balance-col-cell">\n                                        <div class="flex flex-col items-center justify-center gap-1 min-w-[100px]">',
    '<td class="px-3 py-1.5 balance-col-cell whitespace-nowrap">\n                                        <div class="flex flex-col items-center justify-center gap-1 min-w-[100px]">'
);

fs.writeFileSync('d:/BusinessPerformance/app.js', content);
console.log('Fixed whitespace-nowrap in daily txn table columns properly');
