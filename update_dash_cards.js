const fs = require('fs');

let content = fs.readFileSync('d:/BusinessPerformance/dashboard-code.html', 'utf8');

const replacements = {
    'total-income-top': 'bg-gradient-to-br from-emerald-400 to-green-500',
    'total-expense-top': 'bg-gradient-to-br from-orange-400 to-rose-500',
    'total-profit-top': 'bg-gradient-to-br from-cyan-400 to-blue-500',
    'closing-balance-top': 'bg-gradient-to-br from-purple-500 to-indigo-600',
    'total-capital-top': 'bg-gradient-to-br from-blue-400 to-indigo-500',
    'total-withdrawals-top': 'bg-gradient-to-br from-rose-400 to-red-500',
    'month-income-top': 'bg-gradient-to-br from-teal-400 to-emerald-500',
    'month-expense-top': 'bg-gradient-to-br from-amber-400 to-orange-500',
    'month-profit-top': 'bg-gradient-to-br from-indigo-400 to-blue-500',
    'today-income-top': 'bg-gradient-to-br from-lime-400 to-green-500',
    'today-expense-top': 'bg-gradient-to-br from-red-400 to-rose-500',
    'today-profit-top': 'bg-gradient-to-br from-sky-400 to-blue-500',
};

for (const id in replacements) {
    const bgGrad = replacements[id];
    
    let idIndex = content.indexOf(`id="${id}"`);
    if(idIndex === -1) {
        console.log("NOT FOUND: " + id);
        continue;
    }
    
    let divIndex = content.lastIndexOf('<div class="bg-', idIndex);
    if(divIndex === -1) {
        console.log("DIV NOT FOUND FOR: " + id);
        continue;
    }
    
    let nextDivIndex = content.indexOf('<div class="bg-', idIndex);
    let nextCommentIndex = content.indexOf('<!--', idIndex);
    
    if (nextDivIndex === -1) nextDivIndex = 9999999;
    if (nextCommentIndex === -1) nextCommentIndex = 9999999;
    
    let endTarget = Math.min(nextDivIndex, nextCommentIndex);
    if (endTarget === 9999999) endTarget = content.length;
    
    let block = content.substring(divIndex, endTarget);
    
    block = block.replace(/<div class="bg-[^"]+ p-6 rounded-xl[^"]*"/, `<div class="${bgGrad} p-6 rounded-xl shadow-lg relative overflow-hidden group border border-white/20 text-white"`);
    
    block = block.replace(/text-3xl font-bold mt-2[^"]*"/, 'text-3xl font-bold mt-2 text-white"');
    block = block.replace(/<p class="text-sm font-semibold[^"]*"/, '<p class="text-sm font-semibold text-white/80"');
    
    block = block.replace(/bg-[a-z]+-\d+\/10/g, 'bg-white/20');
    block = block.replace(/bg-primary\/20/g, 'bg-white/20');
    block = block.replace(/text-[a-z]+-\d+/g, 'text-white');
    block = block.replace(/text-primary/g, 'text-white');
    
    content = content.substring(0, divIndex) + block + content.substring(endTarget);
    console.log("Processed: " + id);
}

fs.writeFileSync('d:/BusinessPerformance/dashboard-code.html', content, 'utf8');
