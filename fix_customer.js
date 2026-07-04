const fs = require('fs');

function fixHtmlFile(path) {
    let content = fs.readFileSync(path, 'utf8');
    
    // We want to replace the entire <div id="edit-customer-modal"... up to the closing </div>
    // for this modal.
    // The safest way is regex or finding the indices.
    const startIdx = content.indexOf('<div id="edit-customer-modal"');
    if (startIdx === -1) return;
    
    // Find the end of this modal. It's followed by <!-- Delete Confirm Modal --> or similar.
    const endIdx = content.indexOf('<!--', startIdx + 10);
    
    if (endIdx !== -1) {
        const replacement = `<div id="edit-customer-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-primary/10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div class="p-6 border-b border-primary/10 flex items-center justify-between">
                <h3 class="text-lg font-bold text-slate-800 dark:text-white">Edit Customer Contact</h3>
                <button type="button" onclick="closeEditCustomerModal()" class="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <form id="edit-customer-form" class="p-6 space-y-4">
                <input type="hidden" id="edit-customer-id" />
                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Name</label>
                    <input id="edit-customer-name" class="w-full rounded-xl border-primary/10 bg-background-light dark:bg-slate-800 text-sm focus:border-primary focus:ring-primary/20 font-semibold text-slate-800 dark:text-white" type="text" required />
                </div>
                <div class="space-y-1.5">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Number</label>
                    <input id="edit-customer-phone" class="w-full rounded-xl border-primary/10 bg-background-light dark:bg-slate-800 text-sm focus:border-primary focus:ring-primary/20 font-mono font-bold text-slate-800 dark:text-white" placeholder="10-digit mobile number" type="text" maxlength="10" />
                    <p id="edit-phone-error" class="text-xs text-rose-500 font-medium hidden">Please enter a valid 10-digit mobile number.</p>
                </div>
                <div class="pt-4 flex gap-3">
                    <button type="button" onclick="closeEditCustomerModal()" class="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" class="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-sm">save</span>
                        Save
                    </button>
                </div>
            </form>
        </div>
    </div>
    
    `;
        content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
        fs.writeFileSync(path, content);
        console.log("Fixed " + path);
    }
}

fixHtmlFile('credit-ledger-code.html');
fixHtmlFile('customer-deposit-code.html');

let appJs = fs.readFileSync('app.js', 'utf8');
// Fix submit 1
const regex1 = /const id = document\.getElementById\('edit-customer-id'\)\?\.value;[\s\S]*?if \(!\/\^\\d\{10\}\$\/\.test\(phone\)\) {[\s\S]*?existingCust\.phone = phone;\s*const res = await saveCustomer\(existingCust\);/m;
const replacement1 = `const id = document.getElementById('edit-customer-id')?.value;
            const name = document.getElementById('edit-customer-name')?.value?.trim();
            const phone = document.getElementById('edit-customer-phone')?.value?.trim() || '';
            const errorEl = document.getElementById('edit-phone-error');

            if (!name) return;

            if (phone && !/^\\d{10}$/.test(phone)) {
                if (errorEl) errorEl.classList.remove('hidden');
                return;
            }
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const customers = await loadCustomers();
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.name = name;
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust);`;
appJs = appJs.replace(regex1, replacement1);

// Fix submit 2
const regex2 = /const id = document\.getElementById\('edit-customer-id'\)\?\.value;[\s\S]*?if \(!\/\^\\d\{10\}\$\/\.test\(phone\)\) {[\s\S]*?existingCust\.phone = phone;\s*const res = await saveCustomer\(existingCust, "deposit_customers"\);/m;
const replacement2 = `const id = document.getElementById('edit-customer-id')?.value;
            const name = document.getElementById('edit-customer-name')?.value?.trim();
            const phone = document.getElementById('edit-customer-phone')?.value?.trim() || '';
            const errorEl = document.getElementById('edit-phone-error');

            if (!name) return;

            if (phone && !/^\\d{10}$/.test(phone)) {
                if (errorEl) errorEl.classList.remove('hidden');
                return;
            }
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const customers = await loadCustomers();
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.name = name;
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust, "deposit_customers");`;
appJs = appJs.replace(regex2, replacement2);

fs.writeFileSync('app.js', appJs);
console.log("Fixed app.js");
