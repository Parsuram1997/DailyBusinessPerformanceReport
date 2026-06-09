const fs = require('fs');
const path = require('path');

const basedir = "d:/BusinessPerformance";
const files = fs.readdirSync(basedir).filter(f => f.endsWith('.html') && !f.includes('image-compressor') && !f.includes('img-to-pdf') && !f.includes('passport'));

// 1. Early theme init script (prevents flash on load) — injected into <head>
const earlyInitScript = `
    <script>
        // Theme: apply saved preference before render to avoid flash
        (function() {
            const saved = localStorage.getItem('biz_theme');
            if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        })();
    </script>`;

// 2. Theme toggle button HTML — injected into sidebar before profile card
const themeToggleBtn = `
                <!-- Theme Toggle -->
                <div class="px-4 pb-2 theme-toggle-container">
                    <button id="theme-toggle-btn" onclick="(function(){const isDark=document.documentElement.classList.toggle('dark');localStorage.setItem('biz_theme',isDark?'dark':'light');const icon=document.getElementById('theme-icon');if(icon)icon.textContent=isDark?'light_mode':'dark_mode';const lbl=document.getElementById('theme-label');if(lbl)lbl.textContent=isDark?'Light Mode':'Dark Mode';})()" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-primary/5 hover:text-primary transition-all nav-link">
                        <span id="theme-icon" class="material-symbols-outlined">dark_mode</span>
                        <span id="theme-label" class="text-sm nav-text font-semibold">Dark Mode</span>
                    </button>
                </div>`;

// 3. JS to update icon/label after page load based on current theme
const themeInitAfterLoad = `
    <script>
        // Sync theme toggle icon/label with current theme
        (function() {
            const isDark = document.documentElement.classList.contains('dark');
            const icon = document.getElementById('theme-icon');
            const lbl = document.getElementById('theme-label');
            if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
            if (lbl) lbl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        })();
    </script>`;

let count = 0;
for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');

    // Skip if already patched
    if (content.includes('biz_theme') && content.includes('theme-toggle-btn')) {
        console.log(`[SKIP] ${f} — already patched`);
        continue;
    }

    // 1. Inject early init script before </head>
    if (!content.includes('biz_theme')) {
        content = content.replace('</head>', earlyInitScript + '\n</head>');
    }

    // 2. Inject theme toggle button before profile card (the mt-auto p-4 border-t section)
    const profileCardMarker = '<div class="mt-auto p-4 border-t border-primary/10">';
    if (content.includes(profileCardMarker) && !content.includes('theme-toggle-btn')) {
        content = content.replace(profileCardMarker, themeToggleBtn + '\n                ' + profileCardMarker);
    }

    // 3. Inject post-load script before </body>
    if (!content.includes('theme-icon') || !content.includes('Sync theme toggle')) {
        content = content.replace('</body>', themeInitAfterLoad + '\n</body>');
    }

    fs.writeFileSync(p, content, 'utf-8');
    console.log(`[OK] Patched theme toggle into ${f}`);
    count++;
}
console.log(`\nDone. Patched ${count} files.`);
