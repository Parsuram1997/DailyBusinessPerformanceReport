import os
import re

html_files = [
    "dashboard-code.html",
    "add-entry-code.html",
    "cash-calculator-code.html",
    "credit-ledger-code.html",
    "reports-code.html"
]

basedir = "d:/BusinessPerformance"

def patch_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Simple regex replacing of href based on text content
    
    # For dashboard
    content = re.sub(r'href="#"([^>]*>\s*<span[^>]*>[^<]*</span>\s*<span[^>]*>\s*Dashboard\s*</span>)', r'href="dashboard-code.html"\1', content)
    # For add entry
    content = re.sub(r'href="#"([^>]*>\s*<span[^>]*>[^<]*</span>\s*<span[^>]*>\s*Add Entry\s*</span>)', r'href="add-entry-code.html"\1', content)
    # For Reports
    content = re.sub(r'href="#"([^>]*>\s*<span[^>]*>[^<]*</span>\s*<span[^>]*>\s*Reports\s*</span>)', r'href="reports-code.html"\1', content)
    # For Credit Ledger
    content = re.sub(r'href="#"([^>]*>\s*<span[^>]*>[^<]*</span>\s*<span[^>]*>\s*Credit Ledger\s*</span>)', r'href="credit-ledger-code.html"\1', content)
    # For Cash Calculator
    content = re.sub(r'href="#"([^>]*>\s*<span[^>]*>[^<]*</span>\s*<span[^>]*>\s*Cash Calculator\s*</span>)', r'href="cash-calculator-code.html"\1', content)
    
    # Inject script tags before </body> if not already there
    if '<script src="app.js"></script>' not in content:
        content = content.replace("</body>", '<script src="app.js"></script>\n</body>')
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

for fn in html_files:
    patch_file(os.path.join(basedir, fn))

app_js = """
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
            description: `Daily Summary - ${new Date().toLocaleTimeString()}`,
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
    // Just a dummy closing balance logic
    const baseBalance = 35280.70; 
    const closingBalance = baseBalance + netProfit;

    // Update Highlights
    const h4s = document.querySelectorAll('.grid-cols-4 h4');
    if (h4s.length >= 4) {
        h4s[0].innerText = formatCurrency(totalIncome);
        h4s[1].innerText = formatCurrency(totalExpense);
        h4s[2].innerText = formatCurrency(netProfit);
        h4s[3].innerText = formatCurrency(closingBalance);
    }

    // Render Recent Entries - skip if empty
    if(entries.length > 0) {
        const tbody = document.querySelector('table tbody');
        if (tbody) {
            tbody.innerHTML = ''; // Clear demo data
            entries.slice(0, 5).forEach(e => {
                const isIncome = e.income > 0;
                const amt = isIncome ? e.income : e.expense;
                const typeClass = isIncome ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400";
                const textClass = isIncome ? "text-emerald-500" : "text-rose-500";
                const sign = isIncome ? "+" : "-";
                const typeText = isIncome ? "INCOME" : "EXPENSE";

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors";
                tr.innerHTML = `
                    <td class="px-6 py-4 text-sm font-medium">${e.date}</td>
                    <td class="px-6 py-4 text-sm">${e.description}</td>
                    <td class="px-6 py-4 text-xs font-semibold uppercase text-slate-500">${e.category}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full ${typeClass} text-[10px] font-bold">${typeText}</span>
                    </td>
                    <td class="px-6 py-4 text-sm font-bold text-right ${textClass}">${sign}${formatCurrency(amt)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAddEntry();
    initDashboard();
});
"""

with open(os.path.join(basedir, "app.js"), "w", encoding="utf-8") as f:
    f.write(app_js)

print("Patching complete and app.js created.")
