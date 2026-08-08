const fs = require('fs');

const dashboardHTML = fs.readFileSync('c:\\Projects\\DailyBusinessPerformanceReport\\dashboard-code.html', 'utf8');

// Find where main content starts and ends
const mainStartToken = '<!-- Main Content (Dashboard) -->';
const mainEndToken = '</main>';

let startIdx = dashboardHTML.indexOf(mainStartToken);
if (startIdx === -1) {
    startIdx = dashboardHTML.indexOf('<main');
}

const endIdx = dashboardHTML.indexOf(mainEndToken, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find main content boundaries.");
    process.exit(1);
}

const beforeMain = dashboardHTML.substring(0, startIdx);
const afterMain = dashboardHTML.substring(endIdx + mainEndToken.length);

const accountRegisterMain = `
<!-- Main Content (Account Register) -->
<main class="flex-1 lg:ml-[5.5rem] p-4 md:p-6 lg:p-8 ml-0 lg:ml-0 transition-all duration-300 min-h-screen">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <span class="material-symbols-outlined text-3xl text-primary drop-shadow-sm">menu_book</span>
                Account Register
            </h1>
            <p class="text-slate-500 text-sm mt-1">Manage and track digital account openings</p>
        </div>
        <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div class="relative flex-1 md:w-64">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input type="text" id="searchInput" placeholder="Search accounts..." 
                    class="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:text-white transition-all shadow-sm">
            </div>
            <select id="statusFilter" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white shadow-sm">
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
            </select>
            <button onclick="openModal()" class="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-primary/30 active:scale-95">
                <span class="material-symbols-outlined text-[20px]">add</span>
                Open New Account
            </button>
        </div>
    </div>

    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-none overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div class="overflow-x-auto flex-1 p-0 custom-scrollbar">
            <table class="w-full text-sm text-left relative">
                <thead class="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                    <tr>
                        <th class="px-5 py-4 font-semibold">Date</th>
                        <th class="px-5 py-4 font-semibold">Acc No.</th>
                        <th class="px-5 py-4 font-semibold">Holder Name</th>
                        <th class="px-5 py-4 font-semibold">Type</th>
                        <th class="px-5 py-4 font-semibold">Mobile</th>
                        <th class="px-5 py-4 font-semibold">ID/Ref</th>
                        <th class="px-5 py-4 font-semibold">Status</th>
                        <th class="px-5 py-4 font-semibold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody id="accountsTableBody" class="divide-y divide-slate-100 dark:divide-white/5 text-slate-600 dark:text-slate-300">
                </tbody>
            </table>
        </div>
        <div class="px-5 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center text-xs text-slate-500 shrink-0">
            <span id="recordCount">Loading records...</span>
        </div>
    </div>

    <div id="accountModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] hidden items-center justify-center p-4 opacity-0 transition-opacity duration-300">
        <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl scale-95 transition-transform duration-300 p-6 md:p-8 custom-scrollbar border border-slate-100 dark:border-white/10" id="modalContent">
            
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 id="modalTitle" class="text-xl font-bold text-slate-900 dark:text-white">Open New Account</h2>
                    <p class="text-sm text-slate-500 mt-1">Fill in the details to register a new account.</p>
                </div>
                <button type="button" onclick="closeModal()" class="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center transition-colors">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>

            <form id="accountForm" onsubmit="saveAccount(event)" class="space-y-5">
                <input type="hidden" id="accountId">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Account Number</label>
                        <input type="text" id="accountNumber" required readonly placeholder="Auto-generated"
                            class="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none dark:text-slate-400 cursor-not-allowed">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Opening Date</label>
                        <input type="date" id="openingDate" required
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Account Holder Name</label>
                    <input type="text" id="accountHolderName" required placeholder="Enter full name"
                        class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Account Type</label>
                        <select id="accountType" required
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                            <option value="">Select Type</option>
                            <option value="Savings">Savings</option>
                            <option value="Current">Current</option>
                            <option value="Fixed Deposit">Fixed Deposit</option>
                            <option value="Loan">Loan</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mobile Number</label>
                        <input type="tel" id="mobileNumber" placeholder="Enter mobile number"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Address</label>
                    <input type="text" id="address" placeholder="Enter address details"
                        class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">ID/Reference Number</label>
                        <input type="text" id="idReference" placeholder="Aadhar/PAN/etc."
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nominee Name</label>
                        <input type="text" id="nomineeName" placeholder="Enter nominee name"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
                        <select id="status" required
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                            <option value="Active">Active</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Remarks</label>
                    <textarea id="remarks" rows="2" placeholder="Any additional notes..."
                        class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all"></textarea>
                </div>
                <div class="pt-6 mt-6 border-t border-slate-100 dark:border-white/5 flex gap-3 justify-end">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button type="submit" class="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg shadow-primary/30 active:scale-95">
                        Save Account
                    </button>
                </div>
            </form>
        </div>
    </div>
</main>
`;

let finalHTML = beforeMain.replace(/<title>.*<\/title>/, '<title>Account Register - BizPerform</title>');

finalHTML += accountRegisterMain;

let customScript = "\n<script src=\"https://cdn.jsdelivr.net/npm/sweetalert2@11\"></script>\n<script>\n";
customScript += "let allAccounts = [];\n";
customScript += "document.addEventListener('DOMContentLoaded', () => {\n";
customScript += "    document.getElementById('openingDate').valueAsDate = new Date();\n";
customScript += "    loadAccounts();\n";
customScript += "    document.getElementById('searchInput').addEventListener('input', renderAccounts);\n";
customScript += "    document.getElementById('statusFilter').addEventListener('change', renderAccounts);\n";
customScript += "});\n";
customScript += "async function loadAccounts() {\n";
customScript += "    try {\n";
customScript += "        const res = await fetch('/api/accounts');\n";
customScript += "        allAccounts = await res.json();\n";
customScript += "        renderAccounts();\n";
customScript += "    } catch (err) {\n";
customScript += "        console.error('Failed to load accounts', err);\n";
customScript += "        Swal.fire('Error', 'Failed to load accounts', 'error');\n";
customScript += "    }\n";
customScript += "}\n";
customScript += "function renderAccounts() {\n";
customScript += "    const tbody = document.getElementById('accountsTableBody');\n";
customScript += "    const search = document.getElementById('searchInput').value.toLowerCase();\n";
customScript += "    const statusFilter = document.getElementById('statusFilter').value;\n";
customScript += "    const filtered = allAccounts.filter(acc => {\n";
customScript += "        const matchesSearch = (acc.accountHolderName && acc.accountHolderName.toLowerCase().includes(search)) ||\n";
customScript += "                              (acc.accountNumber && acc.accountNumber.toLowerCase().includes(search)) ||\n";
customScript += "                              (acc.mobileNumber && acc.mobileNumber.toLowerCase().includes(search));\n";
customScript += "        const matchesStatus = statusFilter === 'All' || acc.status === statusFilter;\n";
customScript += "        return matchesSearch && matchesStatus;\n";
customScript += "    });\n";
customScript += "    tbody.innerHTML = '';\n";
customScript += "    if (filtered.length === 0) {\n";
customScript += "        tbody.innerHTML = '<tr><td colspan=\"8\" class=\"px-5 py-8 text-center text-slate-500\">No accounts found.</td></tr>';\n";
customScript += "    } else {\n";
customScript += "        filtered.forEach(acc => {\n";
customScript += "            const statusClass = acc.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400';\n";
customScript += "            const tr = document.createElement('tr');\n";
customScript += "            tr.className = 'hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group';\n";
customScript += "            tr.innerHTML = `\n";
customScript += "                <td class=\"px-5 py-3 whitespace-nowrap\">${acc.openingDate}</td>\n";
customScript += "                <td class=\"px-5 py-3 whitespace-nowrap font-medium text-slate-900 dark:text-white\">${acc.accountNumber}</td>\n";
customScript += "                <td class=\"px-5 py-3\">${acc.accountHolderName}</td>\n";
customScript += "                <td class=\"px-5 py-3 whitespace-nowrap\"><span class=\"px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium\">${acc.accountType || '-'}</span></td>\n";
customScript += "                <td class=\"px-5 py-3 whitespace-nowrap\">${acc.mobileNumber || '-'}</td>\n";
customScript += "                <td class=\"px-5 py-3 whitespace-nowrap text-xs\">${acc.idReference || '-'}</td>\n";
customScript += "                <td class=\"px-5 py-3 whitespace-nowrap\">\n";
customScript += "                    <span class=\"px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusClass}\">${acc.status}</span>\n";
customScript += "                </td>\n";
customScript += "                <td class=\"px-5 py-3 whitespace-nowrap text-right\">\n";
customScript += "                    <div class=\"flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity\">\n";
customScript += "                        <button onclick=\"editAccount('${acc.id}')\" class=\"p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors\" title=\"Edit\">\n";
customScript += "                            <span class=\"material-symbols-outlined text-[18px]\">edit</span>\n";
customScript += "                        </button>\n";
customScript += "                        <button onclick=\"deleteAccount('${acc.id}')\" class=\"p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors\" title=\"Delete\">\n";
customScript += "                            <span class=\"material-symbols-outlined text-[18px]\">delete</span>\n";
customScript += "                        </button>\n";
customScript += "                    </div>\n";
customScript += "                </td>\n";
customScript += "            `;\n";
customScript += "            tbody.appendChild(tr);\n";
customScript += "        });\n";
customScript += "    }\n";
customScript += "    document.getElementById('recordCount').innerText = `Showing ${filtered.length} of ${allAccounts.length} accounts`;\n";
customScript += "}\n";
customScript += "function generateAccountNumber() {\n";
customScript += "    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');\n";
customScript += "    const random = Math.floor(1000 + Math.random() * 9000);\n";
customScript += "    return `ACC-${dateStr}-${random}`;\n";
customScript += "}\n";
customScript += "function openModal(id = null) {\n";
customScript += "    const modal = document.getElementById('accountModal');\n";
customScript += "    const content = document.getElementById('modalContent');\n";
customScript += "    const form = document.getElementById('accountForm');\n";
customScript += "    form.reset();\n";
customScript += "    if (id) {\n";
customScript += "        const acc = allAccounts.find(a => a.id == id);\n";
customScript += "        if (acc) {\n";
customScript += "            document.getElementById('modalTitle').innerText = 'Edit Account';\n";
customScript += "            document.getElementById('accountId').value = acc.id;\n";
customScript += "            document.getElementById('accountNumber').value = acc.accountNumber;\n";
customScript += "            document.getElementById('accountHolderName').value = acc.accountHolderName;\n";
customScript += "            document.getElementById('accountType').value = acc.accountType || '';\n";
customScript += "            document.getElementById('openingDate').value = acc.openingDate;\n";
customScript += "            document.getElementById('mobileNumber').value = acc.mobileNumber || '';\n";
customScript += "            document.getElementById('address').value = acc.address || '';\n";
customScript += "            document.getElementById('idReference').value = acc.idReference || '';\n";
customScript += "            document.getElementById('nomineeName').value = acc.nomineeName || '';\n";
customScript += "            document.getElementById('status').value = acc.status || 'Active';\n";
customScript += "            document.getElementById('remarks').value = acc.remarks || '';\n";
customScript += "        }\n";
customScript += "    } else {\n";
customScript += "        document.getElementById('modalTitle').innerText = 'Open New Account';\n";
customScript += "        document.getElementById('accountId').value = '';\n";
customScript += "        document.getElementById('accountNumber').value = generateAccountNumber();\n";
customScript += "        document.getElementById('openingDate').valueAsDate = new Date();\n";
customScript += "        document.getElementById('status').value = 'Active';\n";
customScript += "    }\n";
customScript += "    modal.classList.remove('hidden');\n";
customScript += "    modal.classList.add('flex');\n";
customScript += "    setTimeout(() => {\n";
customScript += "        modal.classList.remove('opacity-0');\n";
customScript += "        content.classList.remove('scale-95');\n";
customScript += "        content.classList.add('scale-100');\n";
customScript += "    }, 10);\n";
customScript += "}\n";
customScript += "function closeModal() {\n";
customScript += "    const modal = document.getElementById('accountModal');\n";
customScript += "    const content = document.getElementById('modalContent');\n";
customScript += "    modal.classList.add('opacity-0');\n";
customScript += "    content.classList.remove('scale-100');\n";
customScript += "    content.classList.add('scale-95');\n";
customScript += "    setTimeout(() => {\n";
customScript += "        modal.classList.add('hidden');\n";
customScript += "        modal.classList.remove('flex');\n";
customScript += "    }, 300);\n";
customScript += "}\n";
customScript += "async function saveAccount(e) {\n";
customScript += "    e.preventDefault();\n";
customScript += "    const id = document.getElementById('accountId').value;\n";
customScript += "    const data = {\n";
customScript += "        accountNumber: document.getElementById('accountNumber').value,\n";
customScript += "        accountHolderName: document.getElementById('accountHolderName').value,\n";
customScript += "        accountType: document.getElementById('accountType').value,\n";
customScript += "        openingDate: document.getElementById('openingDate').value,\n";
customScript += "        mobileNumber: document.getElementById('mobileNumber').value,\n";
customScript += "        address: document.getElementById('address').value,\n";
customScript += "        idReference: document.getElementById('idReference').value,\n";
customScript += "        nomineeName: document.getElementById('nomineeName').value,\n";
customScript += "        status: document.getElementById('status').value,\n";
customScript += "        remarks: document.getElementById('remarks').value,\n";
customScript += "    };\n";
customScript += "    const url = id ? `/api/accounts/${id}` : '/api/accounts';\n";
customScript += "    const method = id ? 'PUT' : 'POST';\n";
customScript += "    try {\n";
customScript += "        const res = await fetch(url, {\n";
customScript += "            method,\n";
customScript += "            headers: { 'Content-Type': 'application/json' },\n";
customScript += "            body: JSON.stringify(data)\n";
customScript += "        });\n";
customScript += "        if (res.ok) {\n";
customScript += "            Swal.fire({\n";
customScript += "                icon: 'success',\n";
customScript += "                title: 'Success',\n";
customScript += "                text: id ? 'Account updated' : 'Account created',\n";
customScript += "                toast: true,\n";
customScript += "                position: 'top-end',\n";
customScript += "                showConfirmButton: false,\n";
customScript += "                timer: 3000\n";
customScript += "            });\n";
customScript += "            closeModal();\n";
customScript += "            loadAccounts();\n";
customScript += "        } else {\n";
customScript += "            const err = await res.json();\n";
customScript += "            Swal.fire('Error', err.error || 'Failed to save', 'error');\n";
customScript += "        }\n";
customScript += "    } catch (err) {\n";
customScript += "        console.error(err);\n";
customScript += "        Swal.fire('Error', 'Network error', 'error');\n";
customScript += "    }\n";
customScript += "}\n";
customScript += "async function deleteAccount(id) {\n";
customScript += "    const result = await Swal.fire({\n";
customScript += "        title: 'Delete Account?',\n";
customScript += "        text: \"This action cannot be undone.\",\n";
customScript += "        icon: 'warning',\n";
customScript += "        showCancelButton: true,\n";
customScript += "        confirmButtonColor: '#ef4444',\n";
customScript += "        cancelButtonColor: '#64748b',\n";
customScript += "        confirmButtonText: 'Yes, delete it!'\n";
customScript += "    });\n";
customScript += "    if (result.isConfirmed) {\n";
customScript += "        try {\n";
customScript += "            const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });\n";
customScript += "            if (res.ok) {\n";
customScript += "                Swal.fire({\n";
customScript += "                    icon: 'success',\n";
customScript += "                    title: 'Deleted!',\n";
customScript += "                    text: 'Account removed.',\n";
customScript += "                    toast: true,\n";
customScript += "                    position: 'top-end',\n";
customScript += "                    showConfirmButton: false,\n";
customScript += "                    timer: 3000\n";
customScript += "                });\n";
customScript += "                loadAccounts();\n";
customScript += "            } else {\n";
customScript += "                const err = await res.json();\n";
customScript += "                Swal.fire('Error', err.error || 'Failed to delete', 'error');\n";
customScript += "            }\n";
customScript += "        } catch (err) {\n";
customScript += "            console.error(err);\n";
customScript += "            Swal.fire('Error', 'Network error', 'error');\n";
customScript += "        }\n";
customScript += "    }\n";
customScript += "}\n";
customScript += "</script>\n";

let bodyEnd = afterMain.indexOf('</body>');
finalHTML += afterMain.substring(0, bodyEnd);
finalHTML += customScript;
finalHTML += afterMain.substring(bodyEnd);

fs.writeFileSync('c:\\Projects\\DailyBusinessPerformanceReport\\account-register-code.html', finalHTML);
console.log("account-register-code.html created successfully.");
