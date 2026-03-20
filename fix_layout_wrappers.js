const fs = require('fs');
const path = require('path');

const htmlFiles = [
    "dashboard-code.html",
    "add-entry-code.html",
    "cash-calculator-code.html",
    "credit-ledger-code.html",
    "reports-code.html",
    "settings-code.html",
    "transactions-code.html"
];

const basedir = "d:/BusinessPerformance";

for (const fn of htmlFiles) {
    const p = path.join(basedir, fn);
    if (!fs.existsSync(p)) continue;
    
    let content = fs.readFileSync(p, 'utf-8');
    
    // Fix wrapper div right after body
    content = content.replace(/<div class="flex min-h-screen overflow-x-hidden">/g, '<div class="flex h-screen overflow-hidden">');
    
    // Fix main tags
    content = content.replace(/<main class="flex-1 flex flex-col min-w-0">/g, '<main class="flex-1 flex flex-col overflow-y-auto w-full">');
    content = content.replace(/<main class="flex-1 flex flex-col overflow-hidden">/g, '<main class="flex-1 flex flex-col overflow-y-auto w-full">');
    content = content.replace(/<main class="flex-1 flex flex-col overflow-y-auto">/g, '<main class="flex-1 flex flex-col overflow-y-auto w-full">');
    content = content.replace(/<main class="flex-1 overflow-y-auto p-8 bg-background-light dark:bg-background-dark">/g, '<main class="flex-1 flex flex-col overflow-y-auto w-full p-8 bg-background-light dark:bg-background-dark">');
    
    fs.writeFileSync(p, content, 'utf-8');
    console.log("Fixed layout wrappers in", fn);
}
