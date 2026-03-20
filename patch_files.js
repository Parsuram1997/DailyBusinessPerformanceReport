const fs = require('fs');
const path = require('path');

const htmlFiles = [
    "dashboard-code.html",
    "add-entry-code.html",
    "cash-calculator-code.html",
    "credit-ledger-code.html",
    "reports-code.html"
];

const basedir = "d:/BusinessPerformance";

function patchFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');
    
    // Simple regex replacing of href based on text content
    content = content.replace(/href="#"([^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<span[^>]*>\s*Dashboard\s*<\/span>)/g, 'href="dashboard-code.html"$1');
    content = content.replace(/href="#"([^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<span[^>]*>\s*Add Entry\s*<\/span>)/g, 'href="add-entry-code.html"$1');
    content = content.replace(/href="#"([^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<span[^>]*>\s*Reports\s*<\/span>)/g, 'href="reports-code.html"$1');
    content = content.replace(/href="#"([^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<span[^>]*>\s*Credit Ledger\s*<\/span>)/g, 'href="credit-ledger-code.html"$1');
    content = content.replace(/href="#"([^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<span[^>]*>\s*Cash Calculator\s*<\/span>)/g, 'href="cash-calculator-code.html"$1');
    
    // Inject script tag before </body> if not already there
    if (!content.includes('<script src="app.js"></script>')) {
        content = content.replace('</body>', '<script src="app.js"></script>\n</body>');
    }
    
    fs.writeFileSync(filepath, content, 'utf-8');
}

for (const fn of htmlFiles) {
    patchFile(path.join(basedir, fn));
}

const appJs = `
const STORAGE_KEY = 'biz_perf_entries';

// Initial data structure if empty
function loadEntries() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveEntry(entry) {
    const entries = loadEntries();
    entries.unshift(entry); // Add to beginning
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Formatting currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// Logic for Add Entry form
function initAddEntry() {
    const form = document.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Grab all inputs
        const inputs = Array.from(form.querySelectorAll('input[type="number"]'));
        
        let income = 0;
        let expense = 0;
        
        inputs.forEach(input => {
            const val = parseFloat(input.value) || 0;
            // Simplified logic: Expense and Withdrawal are expenses, rest are income
            const fieldName = input.closest('div.flex-col').querySelector('label').innerText.trim().toLowerCase();
            if (fieldName.includes('expense') || fieldName.includes('withdrawal')) {
                expense += val;
            } else {
                income += val;
            }
        });
        
        const entry = {
            id: Date.now(),
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            description: \`Daily Summary - \${new Date().toLocaleTimeString()}\`,
            category: 'Operations',
            income,
            expense,
            net: income - expense
        };
        
        saveEntry(entry);
        alert('Entry Saved Successfully!');
        form.reset();
        updateAddEntryStats();
    });

    // Auto update stats on input
    form.addEventListener('input', () => {
        updateAddEntryStats();
    });

    function updateAddEntryStats() {
        const inputs = Array.from(form.querySelectorAll('input[type="number"]'));
        let income = 0;
        let expense = 0;
        inputs.forEach(input => {
            const val = parseFloat(input.value) || 0;
            const fieldName = input.closest('div.flex-col').querySelector('label').innerText.trim().toLowerCase();
            if (fieldName.includes('expense') || fieldName.includes('withdrawal')) {
                expense += val;
            } else {
                income += val;
            }
        });
        
        const summaryDiv = document.querySelector('.mt-12 .bg-white'); // The stats box
        if (summaryDiv) {
            const spans = summaryDiv.querySelectorAll('span.font-bold');
            if (spans.length >= 3) {
                spans[0].innerText = formatCurrency(income);
                spans[1].innerText = formatCurrency(expense);
                spans[2].innerText = formatCurrency(income - expense);
            }
        }
    }
}

// Logic for Dashboard
function initDashboard() {
    const isDashboard = document.querySelector('h3') && document.querySelector('h3').innerText.includes('Business Overview');
    if (!isDashboard) return;

    const entries = loadEntries();
    let totalIncome = 0;
    let totalExpense = 0;
    
    entries.forEach(e => {
        totalIncome += e.income;
        totalExpense += e.expense;
    });

    const netProfit = totalIncome - totalExpense;
    // Base balance from existing UI
    const baseBalance = 42910.20; 
    const closingBalance = baseBalance + netProfit;

    // Update Highlights
    const h4s = document.querySelectorAll('.grid-cols-4 h4');
    if (h4s.length >= 4) {
        h4s[0].innerText = formatCurrency(totalIncome > 0 ? totalIncome : 12450.00);
        h4s[1].innerText = formatCurrency(totalExpense > 0 ? totalExpense : 4820.50);
        h4s[2].innerText = formatCurrency(netProfit !== 0 ? netProfit : 7629.50);
        h4s[3].innerText = formatCurrency(closingBalance);
    }

    // Render Recent Entries - skip if empty
    if(entries.length > 0) {
        const tbody = document.querySelector('table tbody');
        if (tbody) {
            tbody.innerHTML = ''; // Clear demo data
            entries.slice(0, 5).forEach(e => {
                const isIncome = e.income >= Math.abs(e.expense);
                const amt = isIncome ? e.net : Math.abs(e.net);
                const typeClass = isIncome ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400";
                const textClass = isIncome ? "text-emerald-500" : "text-rose-500";
                const sign = isIncome ? "+" : "-";
                const typeText = isIncome ? "INCOME" : "EXPENSE";

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors";
                tr.innerHTML = \`
                    <td class="px-6 py-4 text-sm font-medium">\${e.date}</td>
                    <td class="px-6 py-4 text-sm">\${e.description}</td>
                    <td class="px-6 py-4 text-xs font-semibold uppercase text-slate-500">\${e.category}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full \${typeClass} text-[10px] font-bold">\${typeText}</span>
                    </td>
                    <td class="px-6 py-4 text-sm font-bold text-right \${textClass}">\${sign}\${formatCurrency(amt)}</td>
                \`;
                tbody.appendChild(tr);
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAddEntry();
    initDashboard();
});
`;

fs.writeFileSync(path.join(basedir, "app.js"), appJs, 'utf-8');
console.log("Patching complete and app.js created.");
