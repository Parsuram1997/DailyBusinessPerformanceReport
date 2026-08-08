const fs = require('fs');
const file = 'c:/Projects/DailyBusinessPerformanceReport/account-register-code.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Inject DOB in the HTML
// Let's find the closing </div></div> of the Account Type / Mobile grid, and insert DOB grid there.
const dobHtml = `
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">DOB</label>
                          <input type="date" id="dob"
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                  </div>
`;

// Insert dobHtml before the ID/Reference grid
if (!content.includes('id="dob"')) {
    content = content.replace(
        /<div class="grid grid-cols-1 md:grid-cols-2 gap-5">\s*<div>\s*<label[^>]*>ID\/Reference Number<\/label>/,
        dobHtml + '\n                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">\n                      <div>\n                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">ID/Reference Number</label>'
    );
}

// 2. Inject Aadhar in the HTML
// Replace ID/Ref grid to include Aadhar
if (!content.includes('id="aadhar"')) {
    content = content.replace(
        /<div class="grid grid-cols-1 md:grid-cols-2 gap-5">\s*<div>\s*<label class="block[^>]*>ID\/Reference Number<\/label>\s*<input type="text" id="idReference" placeholder="Aadhar\/PAN\/etc\."[^>]*>\s*<\/div>/g,
        `<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Aadhar Number</label>
                          <input type="text" id="aadhar" placeholder="Enter Aadhar number"
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">ID/Reference Number</label>
                          <input type="text" id="idReference" placeholder="PAN/Voter ID/etc."
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5" style="display:none;">
                      <div>`
    );
}

fs.writeFileSync(file, content);
console.log('Fixed DOM elements');
