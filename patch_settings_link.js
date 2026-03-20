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

function patchSettingsLink(filepath, filename) {
    let content = fs.readFileSync(filepath, 'utf-8');
    
    // Replace the settings link
    const targetRegex = /href="#" data-page="#"/g;
    if (targetRegex.test(content)) {
        content = content.replace(targetRegex, 'href="settings-code.html" data-page="settings-code.html"');
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log("Patched link in", filename);
    }
}

for (const fn of htmlFiles) {
    patchSettingsLink(path.join(basedir, fn), fn);
}
