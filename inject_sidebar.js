const fs = require('fs');
const path = require('path');

const basedir = "d:/BusinessPerformance";
const files = fs.readdirSync(basedir).filter(f => f.endsWith('.html'));

// The new CSS block to inject before </style>
const cssLines = `
        /* Sidebar Collapse Styles */
        #sidebar { transition: width 0.3s ease; }
        #sidebar.collapsed { width: 5rem !important; }
        #sidebar.collapsed .sidebar-text { display: none; }
        #sidebar.collapsed .nav-text { display: none; }
        #sidebar.collapsed .sidebar-logo-container { justify-content: center; padding-left: 0; padding-right: 0; }
        #sidebar.collapsed .nav-link { justify-content: center; padding-left: 0; padding-right: 0; }
        #sidebar.collapsed .toggle-container { justify-content: center; }
`;

for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    // 1. Inject CSS
    if (!content.includes('/* Sidebar Collapse Styles */')) {
        content = content.replace('</style>', cssLines + '\n    </style>');
    }
    
    // 2. Identify and update <aside> tag
    content = content.replace(/<aside class="([^"]+)">/, (match, classes) => {
        if (!classes.includes('transition-all')) {
            return `<aside id="sidebar" class="${classes} transition-all duration-300">`;
        }
        return match;
    });

    // 3. Update the logo / header area to include the toggle button
    const oldHeader = `<div class="p-6 flex items-center gap-3">
<div class="size-10 rounded-lg bg-primary flex items-center justify-center text-white">
<span class="material-symbols-outlined">analytics</span>
</div>
<div>
<h1 class="text-sm font-bold leading-none">BizPerform</h1>
<p class="text-[10px] text-primary/70 uppercase tracking-wider font-semibold">Management Portal</p>
</div>
</div>`;

    const newHeader = `<div class="px-4 py-4 flex justify-end toggle-container">
    <button id="sidebar-toggle" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-primary/10 transition-colors flex items-center justify-center">
        <span class="material-symbols-outlined" id="toggle-icon">menu_open</span>
    </button>
</div>
<div class="px-6 pb-6 flex items-center gap-3 sidebar-logo-container">
    <div class="size-10 rounded-lg bg-primary flex items-center justify-center text-white flex-shrink-0">
        <span class="material-symbols-outlined">analytics</span>
    </div>
    <div class="sidebar-text overflow-hidden whitespace-nowrap">
        <h1 class="text-sm font-bold leading-none">BizPerform</h1>
        <p class="text-[10px] text-primary/70 uppercase tracking-wider font-semibold">Management Portal</p>
    </div>
</div>`;
    
    // Try to replace the exact old header block (standard formatting)
    if (content.includes(oldHeader)) {
        content = content.replace(oldHeader, newHeader);
    } else {
        // Fallback regex replacement if formatting slightly differs
        const regexHeader = /<div class="p-6 flex items-center gap-3">[\s\S]*?<p class="text-\[10px\].*?Management Portal<\/p>\s*<\/div>\s*<\/div>/;
        content = content.replace(regexHeader, newHeader);
    }

    // 4. Wrap the span text in the nav links with .nav-text so we can hide it
    content = content.replace(/<span class="text-sm">([^<]+)<\/span>/g, '<span class="text-sm nav-text">$1</span>');

    
    fs.writeFileSync(p, content, 'utf-8');
    console.log(`Injected sidebar UI into ${f}`);
}
