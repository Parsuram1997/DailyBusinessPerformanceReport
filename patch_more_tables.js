const fs = require('fs');

let cw = fs.readFileSync('d:/BusinessPerformance/credit-ledger-code.html', 'utf8');
cw = cw.replace('<div class="p-3 md:p-8 flex-1 overflow-y-auto space-y-4 md:space-y-8">', '<div class="p-0 sm:p-4 md:p-8 flex-1 overflow-y-auto space-y-4 md:space-y-8">');
cw = cw.replace('<section class="flex flex-col gap-1">', '<section class="px-3 md:px-0 flex flex-col gap-1">');
cw = cw.replace('<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">', '<div class="px-3 md:px-0 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">');
cw = cw.replace('<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">', '<div class="px-3 md:px-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">');
fs.writeFileSync('d:/BusinessPerformance/credit-ledger-code.html', cw);

let bw = fs.readFileSync('d:/BusinessPerformance/bank-withdrawals-code.html', 'utf8');
bw = bw.replace('<div class="p-3 md:p-8 max-w-[1700px] mx-auto w-full space-y-4 md:space-y-8">', '<div class="p-0 sm:p-4 md:p-8 max-w-[1700px] mx-auto w-full space-y-4 md:space-y-8">');
bw = bw.replace('<section class="flex flex-col gap-1">', '<section class="px-3 md:px-0 flex flex-col gap-1">');
bw = bw.replace('<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12">', '<div class="px-2 md:px-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12">');
fs.writeFileSync('d:/BusinessPerformance/bank-withdrawals-code.html', bw);

console.log('Fixed padding for other table pages');
