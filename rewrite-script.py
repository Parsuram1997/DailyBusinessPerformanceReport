import re

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Find the SweetAlert CDN script tag position  
swal_pos = c.find('<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11">')
print(f"Cutting at position: {swal_pos}")

# Keep everything BEFORE the SweetAlert script
base = c[:swal_pos]

new_end = '''<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

<script type="module">
    import { db } from './firebase-config.js';
    import {
        collection, getDocs, addDoc, updateDoc, deleteDoc, doc
    } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

    window.allAccounts = [];

    window.loadAccounts = async function() {
        try {
            const snap = await getDocs(collection(db, "accounts"));
            window.allAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            window.renderAccounts();
        } catch (err) {
            console.error('Load failed', err);
            document.getElementById('recordCount').innerText = 'Error loading data';
        }
    };

    window.renderAccounts = function() {
        const tbody = document.getElementById('accountsTableBody');
        const search = (document.getElementById('searchInput').value || '').toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const filtered = window.allAccounts.filter(acc => {
            const m = (acc.accountHolderName||'').toLowerCase().includes(search) ||
                      (acc.accountNumber||'').toLowerCase().includes(search) ||
                      (acc.mobileNumber||'').toLowerCase().includes(search);
            const s = statusFilter === 'All' || acc.status === statusFilter;
            return m && s;
        });
        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-5 py-8 text-center text-slate-500">No accounts found.</td></tr>';
        } else {
            filtered.forEach(acc => {
                const sc = acc.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400';
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group';
                tr.innerHTML = `
                    <td class="px-5 py-3 whitespace-nowrap">${acc.openingDate||'-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap">${acc.dob||'-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap font-medium text-slate-900 dark:text-white">${acc.accountNumber||'-'}</td>
                    <td class="px-5 py-3">${acc.accountHolderName||'-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap"><span class="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium">${acc.accountType||'-'}</span></td>
                    <td class="px-5 py-3 whitespace-nowrap">${acc.mobileNumber||'-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap">${acc.aadhar||'-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap text-xs">${acc.idReference||'-'}</td>
                    <td class="px-5 py-3 whitespace-nowrap">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${sc}">${acc.status||'-'}</span>
                    </td>
                    <td class="px-5 py-3 whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="window.openModal('${acc.id}')" class="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit">
                                <span class="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onclick="window.deleteAccount('${acc.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete">
                                <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        document.getElementById('recordCount').innerText =
            `Showing ${filtered.length} of ${window.allAccounts.length} accounts`;
    };

    window.generateAccountNumber = function() {
        const d = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const r = Math.floor(1000 + Math.random() * 9000);
        return `ACC-${d}-${r}`;
    };

    window.openModal = function(id) {
        const modal   = document.getElementById('accountModal');
        const content = document.getElementById('modalContent');
        const form    = document.getElementById('accountForm');
        form.reset();
        if (id) {
            const acc = window.allAccounts.find(a => a.id === id);
            if (acc) {
                document.getElementById('modalTitle').innerText    = 'Edit Account';
                document.getElementById('accountId').value         = acc.id;
                document.getElementById('accountNumber').value     = acc.accountNumber || '';
                document.getElementById('accountHolderName').value = acc.accountHolderName || '';
                document.getElementById('accountType').value       = acc.accountType || '';
                document.getElementById('openingDate').value       = acc.openingDate || '';
                document.getElementById('mobileNumber').value      = acc.mobileNumber || '';
                document.getElementById('dob').value               = acc.dob || '';
                document.getElementById('aadhar').value            = acc.aadhar || '';
                document.getElementById('address').value           = acc.address || '';
                document.getElementById('idReference').value       = acc.idReference || '';
                document.getElementById('nomineeName').value       = acc.nomineeName || '';
                document.getElementById('status').value            = acc.status || 'Active';
                document.getElementById('remarks').value           = acc.remarks || '';
            }
        } else {
            document.getElementById('modalTitle').innerText    = 'Open New Account';
            document.getElementById('accountId').value         = '';
            document.getElementById('accountNumber').value     = window.generateAccountNumber();
            document.getElementById('openingDate').valueAsDate = new Date();
            document.getElementById('dob').value               = '';
            document.getElementById('aadhar').value            = '';
            document.getElementById('status').value            = 'Active';
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('translate-x-full');
            content.classList.add('translate-x-0');
        });
    };

    window.closeModal = function() {
        const modal   = document.getElementById('accountModal');
        const content = document.getElementById('modalContent');
        modal.classList.add('opacity-0');
        content.classList.remove('translate-x-0');
        content.classList.add('translate-x-full');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    };

    window.saveAccount = async function(e) {
        e.preventDefault();
        const id = document.getElementById('accountId').value;
        const data = {
            accountNumber:     document.getElementById('accountNumber').value,
            accountHolderName: document.getElementById('accountHolderName').value,
            accountType:       document.getElementById('accountType').value,
            openingDate:       document.getElementById('openingDate').value,
            mobileNumber:      document.getElementById('mobileNumber').value,
            dob:               document.getElementById('dob').value,
            aadhar:            document.getElementById('aadhar').value,
            address:           document.getElementById('address').value,
            idReference:       document.getElementById('idReference').value,
            nomineeName:       document.getElementById('nomineeName').value,
            status:            document.getElementById('status').value,
            remarks:           document.getElementById('remarks').value,
            updated_at:        new Date().toISOString()
        };
        try {
            if (id) {
                await updateDoc(doc(db, "accounts", id), data);
            } else {
                data.created_at = new Date().toISOString();
                await addDoc(collection(db, "accounts"), data);
            }
            Swal.fire({ icon:'success', title:'Saved!', toast:true, position:'top-end', showConfirmButton:false, timer:2500 });
            window.closeModal();
            window.loadAccounts();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to save: ' + err.message, 'error');
        }
    };

    window.deleteAccount = async function(id) {
        const res = await Swal.fire({
            title:'Delete Account?', text:'This cannot be undone.', icon:'warning',
            showCancelButton:true, confirmButtonColor:'#ef4444',
            cancelButtonColor:'#64748b', confirmButtonText:'Yes, delete!'
        });
        if (res.isConfirmed) {
            try {
                await deleteDoc(doc(db, "accounts", id));
                Swal.fire({ icon:'success', title:'Deleted!', toast:true, position:'top-end', showConfirmButton:false, timer:2500 });
                window.loadAccounts();
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'Failed to delete: ' + err.message, 'error');
            }
        }
    };

    // Init
    document.getElementById('searchInput').addEventListener('input', window.renderAccounts);
    document.getElementById('statusFilter').addEventListener('change', window.renderAccounts);
    document.getElementById('accountForm').addEventListener('submit', window.saveAccount);
    window.loadAccounts();

</script>

</body>
</html>
'''

final = base + new_end
with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'w', encoding='utf-8') as f:
    f.write(final)

print(f"Done. Module scripts: {final.count('type=\"module\"')}")
print(f"New file length: {len(final)}")
