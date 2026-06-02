const fs = require('fs');
const path = require('path');

const dir = 'd:/BusinessPerformance';

const replacements = [
    {
        file: 'bank-withdrawals-code.html',
        oldStr: '<div class="p-8 max-w-[1700px] mx-auto w-full space-y-8">',
        newStr: '<div class="p-3 md:p-8 max-w-[1700px] mx-auto w-full space-y-4 md:space-y-8">'
    },
    {
        file: 'credit-ledger-code.html',
        oldStr: '<div class="p-8 flex-1 overflow-y-auto space-y-8">',
        newStr: '<div class="p-3 md:p-8 flex-1 overflow-y-auto space-y-4 md:space-y-8">'
    },
    {
        file: 'daily-txn.html',
        oldStr: '<div class="p-4 md:p-8 w-full space-y-6 md:space-y-8">',
        newStr: '<div class="p-2 md:p-8 w-full space-y-4 md:space-y-8">'
    },
    {
        file: 'damaged-currency-code.html',
        oldStr: '<header class="p-8 pb-0">',
        newStr: '<header class="p-3 md:p-8 pb-0">'
    },
    {
        file: 'settings-code.html',
        oldStr: '<div class="p-8 max-w-4xl mx-auto w-full space-y-8">',
        newStr: '<div class="p-3 md:p-8 max-w-4xl mx-auto w-full space-y-4 md:space-y-8">'
    },
    {
        file: 'transactions-code.html',
        oldStr: '<div class="p-6 md:p-8 w-full mx-auto space-y-8">',
        newStr: '<div class="p-3 md:p-8 w-full mx-auto space-y-4 md:space-y-8">'
    },
    {
        file: 'cash-calculator-code.html',
        oldStr: 'px-4 sm:px-6 lg:px-8 pt-3 lg:pt-4 space-y-3">',
        newStr: 'px-2 sm:px-6 lg:px-8 pt-3 lg:pt-4 space-y-3">'
    }
];

replacements.forEach(({ file, oldStr, newStr }) => {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(oldStr)) {
            content = content.replace(oldStr, newStr);
            fs.writeFileSync(filePath, content);
            console.log('Updated', file);
        } else {
            console.log('String not found in', file);
        }
    }
});
