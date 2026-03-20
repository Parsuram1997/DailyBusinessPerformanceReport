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

const sidebarTemplate = `
<aside class="w-64 flex-shrink-0 border-r border-primary/10 bg-white dark:bg-background-dark/50 flex flex-col z-20">
<div class="p-6 flex items-center gap-3">
<div class="size-10 rounded-lg bg-primary flex items-center justify-center text-white">
<span class="material-symbols-outlined">analytics</span>
</div>
<div>
<h1 class="text-sm font-bold leading-none">BizPerform</h1>
<p class="text-[10px] text-primary/70 uppercase tracking-wider font-semibold">Management Portal</p>
</div>
</div>
<nav class="flex-1 px-4 space-y-1">
<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors" href="dashboard-code.html" data-page="dashboard-code.html">
<span class="material-symbols-outlined">dashboard</span>
<span class="text-sm">Dashboard</span>
</a>
<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors" href="add-entry-code.html" data-page="add-entry-code.html">
<span class="material-symbols-outlined">add_circle</span>
<span class="text-sm">Add Entry</span>
</a>
<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors" href="reports-code.html" data-page="reports-code.html">
<span class="material-symbols-outlined">bar_chart</span>
<span class="text-sm">Reports</span>
</a>
<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors" href="credit-ledger-code.html" data-page="credit-ledger-code.html">
<span class="material-symbols-outlined">menu_book</span>
<span class="text-sm">Credit Ledger</span>
</a>
<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors" href="cash-calculator-code.html" data-page="cash-calculator-code.html">
<span class="material-symbols-outlined">calculate</span>
<span class="text-sm">Cash Calculator</span>
</a>
<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors" href="#" data-page="#">
<span class="material-symbols-outlined">settings</span>
<span class="text-sm">Settings</span>
</a>
</nav>
<div class="p-4 mt-auto">
<div class="bg-primary/5 rounded-xl p-4 border border-primary/10">
<p class="text-xs font-medium text-primary mb-2">Upgrade to Pro</p>
<p class="text-[10px] text-slate-500 mb-3">Get advanced analytics and multi-user support.</p>
<button class="w-full bg-primary text-white text-xs font-bold py-2 rounded-lg">Upgrade Now</button>
</div>
</div>
</aside>
`.trim();

function patchFile(filepath, filename) {
    let content = fs.readFileSync(filepath, 'utf-8');
    
    // Replace existing aside. We use a regex that matches from <aside to </aside>
    const asideRegex = /<aside[\s\S]*?<\/aside>/i;
    
    // Create localized sidebar
    let localizedSidebar = sidebarTemplate;
    
    // Replace active state for the current page
    const inactiveClasses = "text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors";
    const activeClasses = "bg-primary/10 text-primary font-semibold";
    
    const targetLinkString = '<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl ' + inactiveClasses + '" href="' + filename + '" data-page="' + filename + '">';
    const replacementLinkString = '<a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl ' + activeClasses + '" href="' + filename + '" data-page="' + filename + '">';

    localizedSidebar = localizedSidebar.replace(targetLinkString, replacementLinkString);
    
    if (asideRegex.test(content)) {
        content = content.replace(asideRegex, localizedSidebar);
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log("Patched", filename);
    } else {
        console.log("Could not find <aside> in", filename);
    }
}

for (const fn of htmlFiles) {
    patchFile(path.join(basedir, fn), fn);
}
