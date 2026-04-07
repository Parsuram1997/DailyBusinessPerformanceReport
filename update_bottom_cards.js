const fs = require('fs');
let html = fs.readFileSync('d:/BusinessPerformance/dashboard-code.html', 'utf8');

// ==== 1. Update MoM Inner Cards ====
const momReplacements = [
    {
        // Today Income
        id: 'mom-today-income',
        bg: 'bg-gradient-to-r from-emerald-400 to-green-500 shadow-md border-0 text-white'
    },
    {
        // Today Expense
        id: 'mom-today-expense',
        bg: 'bg-gradient-to-r from-orange-400 to-rose-500 shadow-md border-0 text-white'
    },
    {
        // Today Profit
        id: 'mom-today-profit',
        bg: 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-md border-0 text-white'
    },
    {
        // MTD Income
        id: 'mtd-current-income',
        bg: 'bg-gradient-to-r from-teal-400 to-emerald-500 shadow-md border-0 text-white'
    },
    {
        // MTD Expense
        id: 'mtd-current-expense',
        bg: 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-md border-0 text-white'
    },
    {
        // MTD Net
        id: 'mtd-current-profit',
        bg: 'bg-gradient-to-r from-indigo-400 to-blue-500 shadow-md border-0 text-white'
    }
];

// Helper to replace within block
function replaceMoMCard(targetId, newBgClass) {
    let idIdx = html.indexOf(`id="${targetId}"`);
    if(idIdx === -1) return;
    
    // Nearest previous <div class="p-3
    let outerDiv = html.lastIndexOf('<div class="p-3', idIdx);
    // Nearest next </div>
    let endDiv = html.indexOf('</div>', idIdx) + 6;
    
    let block = html.substring(outerDiv, endDiv);
    
    // Replace bg
    block = block.replace(/class="p-3[^"]+"/, `class="p-3 rounded-lg ${newBgClass}"`);
    
    // Replace text colors
    block = block.replace(/text-slate-400/g, 'text-white/80');
    block = block.replace(/text-slate-500/g, 'text-white/60');
    block = block.replace(/text-primary\/60/g, 'text-white/60');
    block = block.replace(/text-primary/g, 'text-white/80');
    
    html = html.substring(0, outerDiv) + block + html.substring(endDiv);
}

for (const rep of momReplacements) {
    replaceMoMCard(rep.id, rep.bg);
}

// ==== 2. Update Projection Blocks ====
const projReplacements = [
    {
        startMarker: 'Income Projections',
        titleIconColor: 'text-primary',
        pillBg: 'bg-primary/10',
        pillText: 'text-primary',
        grad: 'bg-gradient-to-br from-green-500 to-emerald-600 border border-white/20 text-white'
    },
    {
        startMarker: 'Expense Projections',
        titleIconColor: 'text-orange-500',
        pillBg: 'bg-orange-500/10',
        pillText: 'text-orange-500',
        grad: 'bg-gradient-to-br from-rose-500 to-red-600 border border-white/20 text-white'
    },
    {
        startMarker: 'Profit Projections',
        titleIconColor: 'text-emerald-500',
        pillBg: 'bg-emerald-500/10',
        pillText: 'text-emerald-500',
        grad: 'bg-gradient-to-br from-indigo-500 to-blue-600 border border-white/20 text-white'
    }
];

function replaceProjBlock(config) {
    let markerIdx = html.indexOf(config.startMarker);
    if(markerIdx === -1) return;
    
    let divIdx = html.lastIndexOf('<div class="bg-white', markerIdx);
    if (divIdx === -1) return;
    
    // find end of block: next <!--
    let endIdx = html.indexOf('<!--', markerIdx);
    if (endIdx === -1) endIdx = html.indexOf('</div>\n    </div>\n</div>', markerIdx);
    if (endIdx === -1) return; // fail safe
    
    let block = html.substring(divIdx, endIdx);
    
    // 1. Swap main container class
    block = block.replace(/class="bg-white[^"]+"/, `class="${config.grad} p-6 rounded-xl shadow-lg relative overflow-hidden group flex flex-col h-full"`);
    
    // 2. Main title & Icon
    block = block.replace(new RegExp(config.titleIconColor, 'g'), 'text-white');
    
    // 3. The "Estimated" pill
    block = block.replace(config.pillBg, 'bg-white/20');
    block = block.replace(config.pillText, 'text-white font-bold tracking-widest uppercase');
    
    // 4. Inner rows background/border
    block = block.replace(/bg-slate-50 dark:bg-slate-900\/50/g, 'bg-black/10 border border-transparent');
    block = block.replace(/border border-slate-100 dark:border-slate-700\/50/g, 'bg-transparent border border-white/20');
    
    // 5. Inner text colors
    block = block.replace(/text-slate-500/g, 'text-white/80');
    block = block.replace(/text-slate-400/g, 'text-white/60');
    block = block.replace(/text-slate-700 dark:text-slate-300/g, 'text-white');
    
    // For numbers which have colors like text-primary, text-orange-500, text-emerald-500
    // proj-monthly, proj-monthly-exp, proj-monthly-profit
    block = block.replace(/text-primary/g, 'text-white');
    block = block.replace(/text-orange-500/g, 'text-white');
    block = block.replace(/text-emerald-500/g, 'text-white');
    
    html = html.substring(0, divIdx) + block + html.substring(endIdx);
}

for (const cfg of projReplacements) {
    replaceProjBlock(cfg);
}

fs.writeFileSync('d:/BusinessPerformance/dashboard-code.html', html, 'utf8');
console.log('Update bottom cards completed.');
