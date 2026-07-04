const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Fix initGlobalSettings biz_accent_color
const initGlobalTarget = `            checkAndSet('dtxn_showCharges', data.dtxn_showCharges);
            checkAndSet('security_pin_enabled_add_entry', data.security_pin_enabled_add_entry !== undefined ? data.security_pin_enabled_add_entry : data.security_pin_enabled);`;
const initGlobalReplace = `            checkAndSet('dtxn_showCharges', data.dtxn_showCharges);
            checkAndSet('biz_accent_color', data.biz_accent_color);
            checkAndSet('security_pin_enabled_add_entry', data.security_pin_enabled_add_entry !== undefined ? data.security_pin_enabled_add_entry : data.security_pin_enabled);`;

if (appJs.includes(initGlobalTarget)) {
    appJs = appJs.replace(initGlobalTarget, initGlobalReplace);
}

// 2. Fix editCustomerForm #1
const form1Target = `            const id = document.getElementById('edit-customer-id')?.value;
            const phone = document.getElementById('edit-customer-phone')?.value?.trim() || '';
            const errorEl = document.getElementById('edit-phone-error');

            if (!/^\\d{10}$/.test(phone)) {
                if (errorEl) errorEl.classList.remove('hidden');
                return;
            }
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const customers = await loadCustomers();
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust);`;
                    
const form1Replace = `            const id = document.getElementById('edit-customer-id')?.value;
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

if (appJs.includes(form1Target)) {
    appJs = appJs.replace(form1Target, form1Replace);
}

// 3. Fix editCustomerForm #2
const form2Target = `            const id = document.getElementById('edit-customer-id')?.value;
            const phone = document.getElementById('edit-customer-phone')?.value?.trim() || '';
            const errorEl = document.getElementById('edit-phone-error');

            if (!/^\\d{10}$/.test(phone)) {
                if (errorEl) errorEl.classList.remove('hidden');
                return;
            }
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const customers = await loadCustomers();
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust, "deposit_customers");`;

const form2Replace = `            const id = document.getElementById('edit-customer-id')?.value;
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

if (appJs.includes(form2Target)) {
    appJs = appJs.replace(form2Target, form2Replace);
}

fs.writeFileSync('app.js', appJs);
console.log("Fixed app.js successfully");
