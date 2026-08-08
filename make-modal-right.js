const fs = require('fs');
const file = 'c:/Projects/DailyBusinessPerformanceReport/account-register-code.html';
let content = fs.readFileSync(file, 'utf8');

// Update modal container classes
content = content.replace(
    'class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] hidden items-center justify-center p-4 opacity-0 transition-opacity duration-300"',
    'class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] hidden justify-end opacity-0 transition-opacity duration-300"'
);

// Update modal content panel classes
content = content.replace(
    'class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl scale-95 transition-transform duration-300 p-6 md:p-8 custom-scrollbar border border-slate-100 dark:border-white/10" id="modalContent"',
    'class="bg-white dark:bg-slate-900 w-full max-w-2xl h-full overflow-y-auto shadow-2xl translate-x-full transition-transform duration-300 p-6 md:p-8 custom-scrollbar border-l border-slate-100 dark:border-white/10" id="modalContent"'
);

// Update JS animations
// Open Modal
content = content.replace(
    /content\.classList\.remove\('scale-95'\);\s*content\.classList\.add\('scale-100'\);/g,
    "content.classList.remove('translate-x-full');\n            content.classList.add('translate-x-0');"
);

// Close Modal
content = content.replace(
    /content\.classList\.remove\('scale-100'\);\s*content\.classList\.add\('scale-95'\);/g,
    "content.classList.remove('translate-x-0');\n        content.classList.add('translate-x-full');"
);

fs.writeFileSync(file, content);
console.log('Modal style updated to right slide-over');
