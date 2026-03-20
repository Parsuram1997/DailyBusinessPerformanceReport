const fs = require('fs');
const path = require('path');

const htmlFiles = [
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
    
    // The header block typically looks like:
    // <!-- Navbar -->
    // <header class="h-16 border-b ..."> ... </header>
    
    // We can use a regex that matches <header> to </header> and the preceding comment if it exists.
    content = content.replace(/<!--\s*Navbar\s*-->\s*<header[\s\S]*?<\/header>/g, '');
    
    // And just in case the comment was already removed or missing:
    content = content.replace(/<header[\s\S]*?<\/header>/g, '');
    
    fs.writeFileSync(p, content, 'utf-8');
    console.log("Removed header from", fn);
}
