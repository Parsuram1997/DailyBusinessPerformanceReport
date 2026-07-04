const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

appJs = appJs.replace(/\r\n/g, '\n');

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
    console.log("Replaced form1Target");
} else {
    console.log("Could not find form1Target");
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
    console.log("Replaced form2Target");
} else {
    console.log("Could not find form2Target");
}

fs.writeFileSync('app.js', appJs);
console.log("Done");
