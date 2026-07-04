const fs = require('fs');

const code = `
window.addEventListener('appSettingsUpdated', () => {
    const hex = localStorage.getItem('biz_accent_color');
    if (hex) {
        let styleEl = document.getElementById('dynamic-accent-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-accent-styles';
            document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = \`
            :root { --color-primary: \${hex} !important; }
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
        
        const hexVal = document.getElementById('accent-hex-value');
        if (hexVal) {
            hexVal.innerText = hex;
            hexVal.style.color = hex;
        }
        const picker = document.getElementById('accent-picker-container');
        if (picker) {
            const btns = picker.querySelectorAll('.accent-btn');
            btns.forEach(b => {
                b.classList.remove('scale-110', 'ring-2', 'ring-offset-2', 'dark:ring-offset-slate-900');
                b.style.borderColor = 'transparent';
                b.style.boxShadow = 'none';
                b.classList.add('border-transparent');
                if (b.getAttribute('data-color').toLowerCase() === hex.toLowerCase()) {
                    b.classList.add('scale-110', 'ring-2', 'ring-offset-2', 'dark:ring-offset-slate-900');
                    b.style.borderColor = '#ffffff';
                    b.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                    b.style.setProperty('--tw-ring-color', hex);
                    b.classList.remove('border-transparent');
                }
            });
        }
    }
});
`;

let content = fs.readFileSync('app.js', 'utf8');
if (!content.includes("localStorage.getItem('biz_accent_color')")) {
    fs.appendFileSync('app.js', code);
    console.log('Appended successfully to app.js');
} else {
    // Already has it, or maybe it has the other code. Let's just append.
    if (!content.includes("window.addEventListener('appSettingsUpdated', () => {")) {
        fs.appendFileSync('app.js', code);
        console.log('Appended successfully to app.js');
    } else {
        console.log('Already appended to app.js');
    }
}
