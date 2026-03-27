const fs = require('fs');
const path = require('path');

const basedir = "d:/BusinessPerformance";
const files = fs.readdirSync(basedir).filter(f => f.endsWith('.html') && f !== 'index.html');

const logoutHtml = `
<a id="logout-btn" href="#" class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors mt-auto cursor-pointer">
<span class="material-symbols-outlined">logout</span>
<span class="text-sm nav-text font-semibold">Logout</span>
</a>
`;

for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    // 1. Inject auth.js script in <head>
    if (!content.includes('<script src="auth.js"></script>')) {
        content = content.replace('</head>', '    <script src="auth.js"></script>\n</head>');
    }
    
    // 2. Inject Logout button at the end of <nav>
    if (!content.includes('id="logout-btn"') && content.includes('</nav>')) {
        content = content.replace('</nav>', logoutHtml + '</nav>');
    }
    
    fs.writeFileSync(p, content, 'utf-8');
    console.log(`Injected auth.js & logout into ${f}`);
}
