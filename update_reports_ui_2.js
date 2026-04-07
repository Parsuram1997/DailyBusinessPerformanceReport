const fs = require('fs');

let content = fs.readFileSync('d:/BusinessPerformance/reports-code.html', 'utf8');

const replacements = {
    'summary-avg-income': { bg: 'bg-gradient-to-br from-emerald-400 to-green-500', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-avg-expense': { bg: 'bg-gradient-to-br from-orange-400 to-red-500', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-avg-profit': { bg: 'bg-gradient-to-br from-cyan-500 to-blue-500', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-roi': { bg: 'bg-gradient-to-br from-purple-500 to-pink-500', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-peak-day': { bg: 'bg-gradient-to-br from-violet-500 to-fuchsia-500', class: 'text-xl font-black italic tracking-tighter text-white' },
    'summary-peak-month': { bg: 'bg-gradient-to-br from-fuchsia-500 to-rose-500', class: 'text-xl font-black italic tracking-tighter text-white' },
    'summary-growth-rate': { bg: 'bg-gradient-to-br from-teal-400 to-teal-600', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-net-profit': { bg: 'bg-gradient-to-br from-indigo-400 to-blue-600', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-entries-count': { bg: 'bg-gradient-to-br from-slate-500 to-slate-700', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-period-capital': { bg: 'bg-gradient-to-br from-indigo-400 to-cyan-500', class: 'text-2xl font-black italic tracking-tighter text-white' },
    'summary-peak-year': { bg: 'bg-gradient-to-br from-pink-500 to-orange-400', class: 'text-xl font-black italic tracking-tighter text-white' },
    'summary-total-withdrawal': { bg: 'bg-gradient-to-br from-amber-500 to-orange-500', class: 'text-2xl font-black italic tracking-tighter text-white' }
};

for (const id in replacements) {
    const r = replacements[id];
    
    if(!content.includes(`id="${id}"`)) {
        console.log("NOT FOUND ID: " + id);
        continue;
    }
    
    let parts = content.split(`id="${id}"`);
    let beforeId = parts[0];
    let lastDivIdx = beforeId.lastIndexOf('<div class="bg-white');
    
    if (lastDivIdx === -1) {
        console.log("NOT FOUND DIV FOR: " + id);
        continue;
    }
    
    // Replace the div class before it
    beforeId = beforeId.substring(0, lastDivIdx) + `<div class="${r.bg} p-5 rounded-2xl shadow-lg relative overflow-hidden group">` + beforeId.substring(beforeId.indexOf('>', lastDivIdx) + 1);
    
    // Replace h4 color
    beforeId = beforeId.replace(/text-slate-400 dark:text-slate-500/g, 'text-white/70');
    
    let afterId = parts[1];
    let endOfPClass = afterId.indexOf('">');
    let pContentStart = endOfPClass + 2;
    
    content = beforeId + `id="${id}" class="${r.class}">` + afterId.substring(pContentStart);
    
    // Update icons
    let afterStart = content.indexOf(`id="${id}"`);
    let endOfBlock = content.indexOf(`</div>`, content.indexOf(`</div>`, afterStart) + 1);
    
    let block = content.substring(afterStart, endOfBlock + 6);
    block = block.replace(/opacity-[^\s]+ group-hover:opacity-[^\s]+ transition-[^\s]+/, 'opacity-20 transition-transform group-hover:scale-110');
    block = block.replace(/material-symbols-outlined text-6xl/, 'material-symbols-outlined text-6xl text-white');
    
    content = content.substring(0, afterStart) + block + content.substring(endOfBlock + 6);
    
    console.log("REPLACED: " + id);
}

fs.writeFileSync('d:/BusinessPerformance/reports-code.html', content, 'utf8');
