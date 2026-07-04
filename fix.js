const fs = require('fs');

let content = fs.readFileSync('settings-code.html', 'utf8');

const targetStr = "    hexVal.innerText = savedAccent;\n    hexVal.style.color = savedAccent;\n\n    for (let x in localStorage) {";
const targetStr2 = "    hexVal.innerText = savedAccent;\r\n    hexVal.style.color = savedAccent;\r\n\r\n    for (let x in localStorage) {";

const insertStr = `    hexVal.innerText = savedAccent;
    hexVal.style.color = savedAccent;

    const btns = picker.querySelectorAll('.accent-btn');
    btns.forEach(btn => {
        const color = btn.getAttribute('data-color');
        
        // Highlight active accent color button
        if (color.toLowerCase() === savedAccent.toLowerCase()) {
            btn.classList.add('scale-110', 'ring-2', 'ring-offset-2', 'dark:ring-offset-slate-900');
            btn.style.borderColor = '#ffffff';
            btn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            btn.style.setProperty('--tw-ring-color', color);
            btn.classList.remove('border-transparent');
        }

        btn.addEventListener('click', () => {
            btns.forEach(b => {
                b.classList.remove('scale-110', 'ring-2', 'ring-offset-2', 'dark:ring-offset-slate-900');
                b.style.borderColor = 'transparent';
                b.style.boxShadow = 'none';
                b.classList.add('border-transparent');
            });
            btn.classList.add('scale-110', 'ring-2', 'ring-offset-2', 'dark:ring-offset-slate-900');
            btn.style.borderColor = '#ffffff';
            btn.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            btn.style.setProperty('--tw-ring-color', color);
            hexVal.innerText = color;
            hexVal.style.color = color;
            applyAccentColor(color);
        });
    });
}

function applyAccentColor(hex) {
    localStorage.setItem('biz_accent_color', hex);
    if (window.saveAppSettings) {
        window.saveAppSettings({ biz_accent_color: hex });
    }
    
    let styleEl = document.getElementById('dynamic-accent-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-accent-styles';
        document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = \`
        :root {
            --color-primary: \${hex} !important;
        }
        .text-primary { color: \${hex} !important; }
        .bg-primary { background-color: \${hex} !important; }
        .border-primary { border-color: \${hex} !important; }
        .border-primary\\\\/10 { border-color: \${hex}1a !important; }
        .border-primary\\\\/20 { border-color: \${hex}33 !important; }
        .bg-primary\\\\/5 { background-color: \${hex}0d !important; }
        .bg-primary\\\\/10 { background-color: \${hex}1a !important; }
        .hover\\\\:bg-primary\\\\/5:hover { background-color: \${hex}0d !important; }
        .hover\\\\:bg-primary\\\\/10:hover { background-color: \${hex}1a !important; }
        .peer-checked\\\\:bg-purple-600:checked ~ div, .peer-checked\\\\:bg-purple-600:peer-checked { background-color: \${hex} !important; }
        .shadow-primary\\\\/20 { --tw-shadow-color: \${hex}33 !important; }
    \`;
}

// ─── SYSTEM DIAGNOSTICS & CACHE LOGIC ─────────────────────────
function updateSystemDiagnostics() {
    let totalBytes = 0;
    for (let x in localStorage) {`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, insertStr);
    fs.writeFileSync('settings-code.html', content);
    console.log('Fixed LF');
} else if (content.includes(targetStr2)) {
    content = content.replace(targetStr2, insertStr);
    fs.writeFileSync('settings-code.html', content);
    console.log('Fixed CRLF');
} else {
    console.log('Not found');
}
