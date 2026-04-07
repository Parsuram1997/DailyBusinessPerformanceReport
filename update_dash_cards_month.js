const fs = require('fs');

let content = fs.readFileSync('d:/BusinessPerformance/dashboard-code.html', 'utf8');

const replacements = {
    'this-month-income-top': 'bg-gradient-to-br from-teal-400 to-emerald-500',
    'this-month-expense-top': 'bg-gradient-to-br from-amber-400 to-orange-500',
    'this-month-profit-top': 'bg-gradient-to-br from-indigo-400 to-blue-500'
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
    
    block = block.replace(/text-3xl font-bold mt-[^"]*"/, 'text-3xl font-bold mt-2 text-white"');
    block = block.replace(/<p class="text-sm font-semibold[^"]*"/, '<p class="text-sm font-semibold text-white/80"');
    
    block = block.replace(/bg-[a-z]+-\d+\/10/g, 'bg-white/20');
    block = block.replace(/bg-primary\/20/g, 'bg-white/20');
    block = block.replace(/text-[a-z]+-\d+/g, 'text-white');
    block = block.replace(/text-primary/g, 'text-white');
    
    content = content.substring(0, divIndex) + block + content.substring(endTarget);
    console.log("Processed: " + id);
}

fs.writeFileSync('d:/BusinessPerformance/dashboard-code.html', content, 'utf8');
