const fs = require('fs');
const path = require('path');

const files = [
    'index.html',
    'dashboard-code.html',
    'transactions-code.html',
    'reports-code.html',
    'settings-code.html',
    'credit-ledger-code.html',
    'bank-withdrawals-code.html',
    'cash-calculator-code.html',
    'damaged-currency-code.html',
    'img-to-pdf.html',
    'add-entry-code.html'
];

const newLogoHtml = `
                <div class="size-10 rounded-lg overflow-hidden flex-shrink-0">
                    <img src="logo.svg" class="w-full h-full object-cover">
                </div>`;

const newLogoIconPlaceholder = `
                    <div class="size-16 rounded-2xl overflow-hidden shadow-lg shadow-primary/30 mb-6 mx-auto">
                        <img src="logo.svg" class="w-full h-full object-cover">
                    </div>`;

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Update Favicon link
    content = content.replace(/<link rel="icon"[^>]*>/g, '<link rel="icon" type="image/svg+xml" href="logo.svg"/>');
    content = content.replace(/<link rel="apple-touch-icon"[^>]*>/g, '<link rel="apple-touch-icon" href="logo.svg">');

    // 2. Update Sidebar Logo (BizPerform Pages)
    // Looking for the container that holds the primay bg and analytics icon
    const sidebarLogoPattern = /<div class="size-10 rounded-lg bg-primary flex items-center justify-center text-white flex-shrink-0">\s*<span class="material-symbols-outlined">analytics<\/span>\s*<\/div>/g;
    content = content.replace(sidebarLogoPattern, newLogoHtml);

    // 3. Update Login Page Left Side Logo
    if (file === 'index.html') {
        // Left side large logo
        const loginLeftLogoPattern = /<div class="size-16 rounded-2xl bg-white\/20 backdrop-blur flex items-center justify-center text-white shadow-lg mb-8 group border border-white\/30">\s*<span class="material-symbols-outlined text-3xl">trending_up<\/span>\s*<\/div>/g;
        content = content.replace(loginLeftLogoPattern, `
            <div class="size-16 rounded-2xl overflow-hidden shadow-lg mb-8 border border-white/30">
                <img src="logo.svg" class="w-full h-full object-cover">
            </div>`);

        // Right side mobile logo
        const loginRightMobileLogoPattern = /<div class="lg:hidden size-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-primary\/30 mb-6 transition-transform">\s*<span class="material-symbols-outlined text-3xl">analytics<\/span>\s*<\/div>/g;
        content = content.replace(loginRightMobileLogoPattern, newLogoIconPlaceholder);
    }

    // 4. Update Img-to-PDF Tool Back Button/Logo area if applicable
    if (file === 'img-to-pdf.html') {
        // The header logo is slightly different
        const imgPdfLogoPattern = /<a href="index.html" class="bg-slate-900 border-2 border-slate-900 size-12 rounded-xl flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg shadow-black\/10 text-white group">/g;
        // We actually want to keep the back button but maybe add the logo next to it or replace the back icon?
        // User said "logo consistent banao", let's replace the arrow-back bg with the logo if it's the main branding.
        // Actually, let's just ensure the favicon and meta tags are updated.
    }

    fs.writeFileSync(filePath, content);
    console.log(`Updated branding for ${file}`);
});
