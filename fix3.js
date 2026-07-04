const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const target = `            try {
                const customers = await loadCustomers();
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.name = name;
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust, "deposit_customers");`;

const replacement = `            try {
                const customers = await loadCustomers("deposit_customers");
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.name = name;
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust, "deposit_customers");`;

if (appJs.includes(target)) {
    appJs = appJs.replace(target, replacement);
    console.log("Replaced deposit customers bug");
} else {
    // If exact spacing mismatch, we can do a targeted regex
    console.log("Could not find exact string. Using regex.");
    const regex = /const customers = await loadCustomers\(\);\s*const existingCust = customers\.find\(c => String\(c\.id\) === String\(id\) \|\| String\(c\.firebaseId\) === String\(id\)\);\s*if \(existingCust\) {\s*existingCust\.name = name;\s*existingCust\.phone = phone;\s*const res = await saveCustomer\(existingCust, "deposit_customers"\);/;
    
    if (regex.test(appJs)) {
        appJs = appJs.replace(regex, `const customers = await loadCustomers("deposit_customers");
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.name = name;
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust, "deposit_customers");`);
        console.log("Replaced using regex.");
    } else {
        console.log("Regex also failed.");
    }
}

fs.writeFileSync('app.js', appJs);
