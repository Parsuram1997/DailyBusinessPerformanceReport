const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'account-register-code.html');
let html = fs.readFileSync(filePath, 'utf8');

// 1. Make Account Number Editable
html = html.replace(
    /<input type="text" id="accountNumber" required readonly placeholder="Auto-generated"\s*class="w-full bg-slate-50 dark:bg-slate-800\/50 border border-slate-200 dark:border-white\/10 rounded-xl px-4 py-2\.5 text-sm focus:outline-none dark:text-slate-400 cursor-not-allowed">/g,
    `<input type="text" id="accountNumber" required placeholder="Enter or auto-generate"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">`
);

// 2. Replace the script tag
const oldScriptStart = '<script>';
const scriptStartIdx = html.lastIndexOf(oldScriptStart);
const scriptEndIdx = html.indexOf('</script>', scriptStartIdx) + '</script>'.length;

const newScript = `
<script type="module">
    import { db } from './firebase-config.js';
    import {
        collection, getDocs, addDoc, updateDoc, deleteDoc, doc
    } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

    window.allAccounts = [];

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('openingDate').valueAsDate = new Date();
        loadAccounts();
        document.getElementById('searchInput').addEventListener('input', renderAccounts);
        document.getElementById('statusFilter').addEventListener('change', renderAccounts);
    });

    window.loadAccounts = async function() {
        try {
            const querySnapshot = await getDocs(collection(db, "accounts"));
            window.allAccounts = [];
            querySnapshot.forEach((doc) => {
                window.allAccounts.push({ id: doc.id, ...doc.data() });
            });
            // sort by created_at desc if you have it, else just render
            renderAccounts();
        } catch (err) {
            console.error('Failed to load accounts', err);
            Swal.fire('Error', 'Failed to load accounts from Firebase', 'error');
        }
    };

    window.renderAccounts = function() {
        const tbody = document.getElementById('accountsTableBody');
        const search = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const filtered = window.allAccounts.filter(acc => {
            const matchesSearch = (acc.accountHolderName && acc.accountHolderName.toLowerCase().includes(search)) ||
                                  (acc.accountNumber && acc.accountNumber.toLowerCase().includes(search)) ||
                                  (acc.mobileNumber && acc.mobileNumber.toLowerCase().includes(search));
            const matchesStatus = statusFilter === 'All' || acc.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-5 py-8 text-center text-slate-500">No accounts found.</td></tr>';
        } else {
            filtered.forEach(acc => {
                const statusClass = acc.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400';
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group';
                tr.innerHTML = \`
                    <td class="px-5 py-3 whitespace-nowrap">\${acc.openingDate}</td>
                    <td class="px-5 py-3 whitespace-nowrap font-medium text-slate-900 dark:text-white">\${acc.accountNumber}</td>
                    <td class="px-5 py-3">\${acc.accountHolderName}</td>
                    <td class="px-5 py-3 whitespace-nowrap"><span class="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium">\${acc.accountType || '-'}</span></td>
                    <td class="px-5 py-3 whitespace-nowrap">\${acc.mobileNumber || '-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap text-xs">\${acc.idReference || '-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider \${statusClass}">\${acc.status}</span>
                    </td>
                    <td class="px-5 py-3 whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="window.editAccount('\${acc.id}')" class="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit">
                                <span class="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onclick="window.deleteAccount('\${acc.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete">
                                <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </td>
                \`;
                tbody.appendChild(tr);
            });
        }
        document.getElementById('recordCount').innerText = \`Showing \${filtered.length} of \${window.allAccounts.length} accounts\`;
    };

    window.generateAccountNumber = function() {
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const random = Math.floor(1000 + Math.random() * 9000);
        return \`ACC-\${dateStr}-\${random}\`;
    };

    window.openModal = function(id = null) {
        const modal = document.getElementById('accountModal');
        const content = document.getElementById('modalContent');
        const form = document.getElementById('accountForm');
        form.reset();
        if (id) {
            const acc = window.allAccounts.find(a => a.id == id);
            if (acc) {
                document.getElementById('modalTitle').innerText = 'Edit Account';
                document.getElementById('accountId').value = acc.id;
                document.getElementById('accountNumber').value = acc.accountNumber;
                document.getElementById('accountHolderName').value = acc.accountHolderName;
                document.getElementById('accountType').value = acc.accountType || '';
                document.getElementById('openingDate').value = acc.openingDate;
                document.getElementById('mobileNumber').value = acc.mobileNumber || '';
                document.getElementById('address').value = acc.address || '';
                document.getElementById('idReference').value = acc.idReference || '';
                document.getElementById('nomineeName').value = acc.nomineeName || '';
                document.getElementById('status').value = acc.status || 'Active';
                document.getElementById('remarks').value = acc.remarks || '';
            }
        } else {
            document.getElementById('modalTitle').innerText = 'Open New Account';
            document.getElementById('accountId').value = '';
            document.getElementById('accountNumber').value = window.generateAccountNumber();
            document.getElementById('openingDate').valueAsDate = new Date();
            document.getElementById('status').value = 'Active';
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        }, 10);
    };

    window.editAccount = function(id) {
        window.openModal(id);
    };

    window.closeModal = function() {
        const modal = document.getElementById('accountModal');
        const content = document.getElementById('modalContent');
        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    };

    window.saveAccount = async function(e) {
        e.preventDefault();
        const id = document.getElementById('accountId').value;
        const data = {
            accountNumber: document.getElementById('accountNumber').value,
            accountHolderName: document.getElementById('accountHolderName').value,
            accountType: document.getElementById('accountType').value,
            openingDate: document.getElementById('openingDate').value,
            mobileNumber: document.getElementById('mobileNumber').value,
            address: document.getElementById('address').value,
            idReference: document.getElementById('idReference').value,
            nomineeName: document.getElementById('nomineeName').value,
            status: document.getElementById('status').value,
            remarks: document.getElementById('remarks').value,
            updated_at: new Date().toISOString()
        };

        try {
            if (id) {
                const accountRef = doc(db, "accounts", id);
                await updateDoc(accountRef, data);
            } else {
                data.created_at = new Date().toISOString();
                await addDoc(collection(db, "accounts"), data);
            }
            
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: id ? 'Account updated' : 'Account created',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            window.closeModal();
            window.loadAccounts();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to save to Firebase', 'error');
        }
    };

    window.deleteAccount = async function(id) {
        const result = await Swal.fire({
            title: 'Delete Account?',
            text: "This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "accounts", id));
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Account removed.',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                window.loadAccounts();
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'Failed to delete from Firebase', 'error');
            }
        }
    };
</script>
`;

html = html.substring(0, scriptStartIdx) + newScript + html.substring(scriptEndIdx);

fs.writeFileSync(filePath, html);
console.log('Successfully patched account-register-code.html');
