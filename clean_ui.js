const fs = require('fs');
const path = require('path');

const htmlFiles = [
    "dashboard-code.html",
    "add-entry-code.html",
    "cash-calculator-code.html",
    "credit-ledger-code.html",
    "reports-code.html"
];

const basedir = "d:/BusinessPerformance";

function cleanFiles(filepath, filename) {
    let content = fs.readFileSync(filepath, 'utf-8');
    
    // 1. Remove the Navigation Right side profile (JD avatar and notifications)
    // Looking for: <div class="flex items-center gap-4"> ... </div> right before </header>
    const headerProfileRegex = /<div class="flex items-center gap-4">[\s\S]*?<\/div>[\s]*<\/header>/;
    if (headerProfileRegex.test(content)) {
        content = content.replace(headerProfileRegex, '</header>');
    } else {
         // Some pages might have a slightly different structure, let's catch the profile block specifically
         const profileBlockRegex = /<div class="flex items-center gap-[34]">[\s\S]*?<div class="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">JD<\/div>[\s]*<\/div>/;
         content = content.replace(profileBlockRegex, '');
    }

    // 2. Remove "Upgrade to Pro" from sidebar
    // Looking for: <div class="p-4 mt-auto"> ... </div> inside </aside>
    const upgradeBannerRegex = /<div class="p-4 mt-auto">[\s\S]*?<div class="bg-primary\/5 rounded-xl p-4 border border-primary\/10">[\s\S]*?Upgrade to Pro[\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/;
    if (upgradeBannerRegex.test(content)) {
       content = content.replace(upgradeBannerRegex, '</aside>');
    }
    
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log("Cleaned", filename);
}

for (const fn of htmlFiles) {
    cleanFiles(path.join(basedir, fn), fn);
}
