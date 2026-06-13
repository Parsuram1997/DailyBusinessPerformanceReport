// Firebase Modular Shim for Compat SDK (support for file:// protocol)
const db = window.db;
const collection = (db, path) => db.collection(path);
const doc = (parent, path, id) => {
    if (typeof parent.doc === 'function') {
        return id ? parent.doc(id) : parent.doc(path);
    }
    return db.doc(path + (id ? '/' + id : ''));
};
const query = (col, ...constraints) => {
    let q = col;
    constraints.forEach(c => { if(typeof c === 'function') q = c(q); });
    return q;
};
const where = (f, o, v) => (q) => q.where(f, o, v);
const orderBy = (f, d) => (q) => q.orderBy(f, d);
const limit = (n) => (q) => q.limit(n);
const onSnapshot = (q, next, error) => q.onSnapshot(next, error);
const getDocs = (q) => q.get();
const getDoc = (d) => d.get().then(snap => {
    if (typeof snap.exists !== 'function') {
        const existsProp = snap.exists;
        snap.exists = () => existsProp;
    }
    return snap;
});
const setDoc = (d, data) => d.set(data);
const updateDoc = (d, data) => d.update(data);
const deleteDoc = (d) => d.delete();
const addDoc = (col, data) => col.add(data);
const writeBatch = (db) => db.batch();

/**
 * Returns an array of strings representing the input date in various formats used across the app.
 * This is used for Firestore 'in' queries to ensure legacy records are retrieved.
 */
function getPossibleDateFormats(dateStr) {
    if (!dateStr || dateStr === 'Invalid Date') return [];
    
    try {
        let d;
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                // Handle YYYY-MM-DD
                d = new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
                d = new Date(dateStr);
            }
        } else {
            d = new Date(dateStr);
        }

        if (isNaN(d.getTime())) return [dateStr];

        const formats = new Set();
        formats.add(dateStr); 

        // YYYY-MM-DD
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        formats.add(`${y}-${m}-${day}`);

        // US Format: "May 7, 2026"
        formats.add(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        
        // GB Format with dashes: "7-May-2026"
        const gbShort = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-');
        formats.add(gbShort);
        
        // GB Format with 2-digit day: "07-May-2026"
        const gbTwo = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
        formats.add(gbTwo);

        // Standard locales
        formats.add(d.toLocaleDateString('en-GB')); // DD/MM/YYYY
        formats.add(d.toLocaleDateString('en-IN')); // DD/MM/YYYY
        formats.add(d.toLocaleDateString('en-US')); // MM/DD/YYYY

        return Array.from(formats);
    } catch (e) {
        console.warn("Date formatting error:", e);
        return [dateStr];
    }
}

// Global Dashboard State for Real-Time listeners and Charts
let dashboardUnsubscribe = null;
let incomeExpenseChart = null;
let profitGrowthChart = null;
let incomeGrowthChart = null;
let expenseGrowthChart = null;
let monthlyComparisonChart = null;

// Global Cache for performance
let entriesCache = [];
let entriesLoaded = false;
let entriesUnsubscribe = null;

function setupEntriesListener() {
    if (entriesUnsubscribe) return;
    try {
        // Remove orderBy for now to avoid index requirements that might crash the app
        const q = query(collection(db, "entries")); 
        entriesUnsubscribe = onSnapshot(q, (snapshot) => {
            entriesCache = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
            // Sort in memory instead
            entriesCache.sort((a, b) => new Date(b.date) - new Date(a.date));
            entriesLoaded = true;
            console.log(`[Cache] entries updated: ${entriesCache.length} docs`);
        }, (error) => {
            console.error("[Cache] entries listener error:", error);
            entriesLoaded = true; // Set to true even on error so app doesn't hang, will just use empty list
        });
    } catch (err) {
        console.error("[Cache] setup listener failed:", err);
        entriesLoaded = true;
    }
}

async function loadEntries() {
    // Return cache immediately if available, otherwise fetch once and cache
    if (entriesLoaded) return entriesCache;
    
    // If not loaded, we still return the cache (which might be empty) 
    // to avoid blocking the UI. The listener will update it soon.
    return entriesCache;
}

// Ensure listener starts early
setupEntriesListener();

// ─── Active Session Tracking (app-v2.js) ────────────────────────────────────
// Registers this device in Firestore 'active_sessions' with periodic heartbeats.
// Used by Settings page to show real-time active devices list.
(function startSessionTrackingV2() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn || !db) return;

    let deviceId = sessionStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
        sessionStorage.setItem('deviceId', deviceId);
    }

    const username = sessionStorage.getItem('username') || 'Unknown';
    const role = sessionStorage.getItem('userRole') || 'user';
    const ua = navigator.userAgent;

    async function writeHeartbeatV2() {
        try {
            // app-v2.js uses compat SDK: db.collection().doc().set()
            await db.collection('active_sessions').doc(deviceId).set({
                deviceId,
                username,
                role,
                userAgent: ua,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeenMs: Date.now(),
                page: window.location.pathname.split('/').pop() || 'index.html'
            });
            console.log('[Session v2] Heartbeat written for', deviceId);
        } catch (e) {
            console.error('[Session v2] Firestore write failed:', e.code, e.message);
            // Fallback: try without serverTimestamp
            try {
                await db.collection('active_sessions').doc(deviceId).set({
                    deviceId, username, role, userAgent: ua,
                    lastSeenMs: Date.now(),
                    page: window.location.pathname.split('/').pop() || 'index.html'
                });
                console.log('[Session v2] Heartbeat written (fallback) for', deviceId);
            } catch (e2) {
                console.error('[Session v2] Fallback also failed:', e2.message);
            }
        }
    }

    setTimeout(() => {
        writeHeartbeatV2();
        const interval = setInterval(writeHeartbeatV2, 30000);
        window.addEventListener('beforeunload', () => {
            clearInterval(interval);
            try { db.collection('active_sessions').doc(deviceId).delete().catch(() => {}); } catch(e) {}
        });
    }, 2000);
})();


async function saveEntry(entry) {
    if (!db) return null;
    try {
        const id = String(entry.id || Date.now());
        const docRef = doc(collection(db, "entries"), id);
        
        // Ensure id property is a valid string if it exists in the object
        const dataToSave = { ...entry };
        dataToSave.id = id; 
        
        await setDoc(docRef, dataToSave);
        return { message: "Entry saved" };
    } catch (e) {
        console.error("Firestore save error: ", e);
        return null;
    }
}

async function loadCredits() {
    if (!db) { console.error("Firestore db not initialized in loadCredits"); return []; }
    try {
        const querySnapshot = await getDocs(collection(db, "credits"));
        return querySnapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
    } catch (e) {
        console.error("Error loading credits: ", e);
        return [];
    }
}

async function saveCredit(credit) {
    if (!db) { console.error("Firestore db not initialized in saveCredit"); return null; }
    try {
        const id = String(credit.id || Date.now());
        console.log("Saving credit with doc ID:", id, "Data:", credit);
        await setDoc(doc(db, "credits", id), credit);
        console.log("Credit save successful!");
        await updateCreditLedgerTotalPending();
        return { message: "Credit saved" };
    } catch (e) {
        console.error("Firestore save error (credit): ", e);
        alert("Firestore Error (Credit Save): " + e.message);
        return null;
    }
}

async function updateCredits(credits) {
    try {
        const batch = writeBatch(db);
        credits.forEach(credit => {
            const creditRef = doc(db, "credits", credit.id);
            batch.set(creditRef, credit);
        });
        await batch.commit();
        await updateCreditLedgerTotalPending();
        return { message: "Credits updated" };
    } catch (e) {
        console.error("Error updating credits: ", e);
        return null;
    }
}

async function loadCustomers() {
    if (!db) { console.error("Firestore db not initialized in loadCustomers"); return []; }
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        return querySnapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
    } catch (e) {
        console.error("Error loading customers: ", e);
        return [];
    }
}

async function updateCreditLedgerTotalPending() {
    try {
        const customers = await loadCustomers();
        const credits = await loadCredits();
        let totalPending = 0;
        customers.forEach(cust => {
            const custCredits = credits.filter(cr => String(cr.customerId) === String(cust.id));
            let custTotal = 0;
            let custPaid = 0;
            custCredits.forEach(cr => {
                custTotal += parseFloat(cr.amount || 0);
                custPaid += parseFloat(cr.paid || 0);
            });
            totalPending += (custTotal - custPaid);
        });
        localStorage.setItem('CREDIT_LEDGER_TOTAL_PENDING', totalPending);
        console.log("[CreditLedgerSync] Updated total pending credit:", totalPending);
        return totalPending;
    } catch (e) {
        console.error("Error updating credit ledger total pending:", e);
        return parseFloat(localStorage.getItem('CREDIT_LEDGER_TOTAL_PENDING')) || 0;
    }
}

async function saveCustomer(customer) {
    if (!db) { console.error("Firestore db not initialized in saveCustomer"); return null; }
    try {
        if (customer && customer.name) {
            customer.name = customer.name.replace(/\s+/g, ' ').trim();
            const existing = await loadCustomers();
            const duplicate = existing.find(c => c.name && c.name.replace(/\s+/g, ' ').trim().toLowerCase() === customer.name.toLowerCase() && String(c.id) !== String(customer.id));
            if (duplicate) {
                console.warn(`[saveCustomer] Duplicate blocked: "${customer.name}"`);
                throw new Error("Customer already exists in Credit Ledger.");
            }
        }
        const id = String(customer.id || Date.now());
        console.log("Saving customer with doc ID:", id, "Data:", customer);
        const docRef = doc(db, "customers", id);
        await setDoc(docRef, customer, { merge: true });
        console.log("Customer save successful!");
        await updateCreditLedgerTotalPending();
        return { message: "Customer saved" };
    } catch (e) {
        console.error("Firestore save error (customer): ", e);
        alert("Firestore Error: " + e.message);
        return null;
    }
}

async function deleteEntry(id) {
    try {
        // Compatibility: sometimes id is the date string
        await deleteDoc(doc(db, "entries", id.toString()));
        return { message: "Entry deleted" };
    } catch (e) {
        console.error("Error deleting entry: ", e);
        return null;
    }
}

async function deleteCredit(id) {
    try {
        await deleteDoc(doc(db, "credits", id.toString()));
        await updateCreditLedgerTotalPending();
        return { message: "Credit deleted" };
    } catch (e) {
        console.error("Error deleting credit: ", e);
        return null;
    }
}

async function deleteCustomer(id) {
    try {
        // Delete customer and their credits
        const batch = writeBatch(db);
        batch.delete(doc(db, "customers", id.toString()));

        const q = query(collection(db, "credits"), where("customerId", "==", id));
        const snapshots = await getDocs(q);
        snapshots.forEach(s => batch.delete(s.ref));

        await batch.commit();
        await updateCreditLedgerTotalPending();
        return { message: "Customer and credits deleted" };
    } catch (e) {
        console.error("Error deleting customer: ", e);
        return null;
    }
}

async function loadDamagedCurrency() {
    if (!db) return {};
    try {
        const docSnap = await getDoc(doc(db, "damaged_currency", "latest"));
        return docSnap.exists() ? docSnap.data() : {};
    } catch (e) {
        console.error("Error loading damaged currency: ", e);
        return {};
    }
}

async function loadCashCalculator(date) {
    if (!db) return {};
    try {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const docId = date || todayStr;

        // Helper: check if a counts object has any real data entered
        const hasRealData = (data) => {
            if (!data) return false;
            return Object.entries(data).some(([k, v]) => k !== 'date' && v !== '' && v !== null && v !== undefined && parseFloat(v) > 0);
        };

        // Try loading specifically for the requested date
        const docSnap = await getDoc(doc(db, "cash_calculator_data", docId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (hasRealData(data)) {
                console.log(`[CashCalc] Loaded data for ${docId}`);
                return data;
            }
        }

        // If no data exists for this specific date, return empty to avoid pre-filling old data
        console.log(`[CashCalc] No data for ${docId}, starting fresh`);
        return {};
    } catch (e) {
        console.error("Error loading cash calculator: ", e);
        return {};
    }
}

async function saveCashCalculator(counts, date) {
    if (!db) return null;
    try {
        const docId = date || 'latest';
        await setDoc(doc(db, "cash_calculator_data", docId), { ...counts, date: docId });
        return { message: "Cash calculator saved" };
    } catch (e) {
        console.error("Error saving cash calculator: ", e);
        return null;
    }
}

async function saveDamagedCurrency(counts) {
    if (!db) return null;
    try {
        await setDoc(doc(db, "damaged_currency", "latest"), counts);
        return { message: "Damaged currency saved" };
    } catch (e) {
        console.error("Error saving damaged currency: ", e);
        return null;
    }
}

// --- BEGIN Bank Withdrawals Helpers ---
async function loadBankAccounts() {
    if (!db) return [];
    try {
        const querySnapshot = await getDocs(collection(db, "bank_accounts"));
        const list = querySnapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
        if (!window.cachedBankAccountsMap) window.cachedBankAccountsMap = new Map();
        list.forEach(acc => {
            if (acc.id) window.cachedBankAccountsMap.set(String(acc.id), acc);
        });
        return list;
    } catch (e) {
        console.error("Error loading bank accounts: ", e);
        return [];
    }
}
async function saveBankAccount(account) {
    if (!db) return null;
    try {
        const id = String(account.id || Date.now());
        const docRef = doc(db, "bank_accounts", id);
        await setDoc(docRef, account);
        return { message: "Bank account saved" };
    } catch (e) {
        console.error("Error saving bank account: ", e);
        return null;
    }
}
async function populateBankAccountsDropdown(selectedVal = '') {
    const selectEl = document.getElementById('txn-bank-select');
    const customDropdown = document.getElementById('custom-bank-dropdown');
    const customSearch = document.getElementById('custom-bank-search');
    if (!selectEl) return;
    try {
        const accounts = await loadBankAccounts();
        selectEl.innerHTML = '<option value="">Select Account...</option>';
        if (customDropdown) customDropdown.innerHTML = '';

        const allItemsData = [];

        accounts.forEach(acc => {
            let fullDisplayText = acc.name || '';
            let holder = '';
            let bank = '';
            let number = '';
            let type = 'CURRENT';

            if (acc.name && acc.name.includes('|')) {
                const parts = acc.name.split('|');
                holder = parts[0] || '';
                bank = parts[1] || '';
                number = parts[2] || '';
                type = parts[3] || 'CURRENT';
                fullDisplayText = `${holder.toUpperCase()} — ${type.toUpperCase()} — ${number}`;
            } else if (acc.name && acc.name.includes(' — ')) {
                const parts = acc.name.split(' — ');
                holder = parts[0] || '';
                type = parts[1] || 'CURRENT';
                number = parts[2] || '';
                bank = 'BANK';
                fullDisplayText = acc.name;
            } else {
                holder = acc.name ? acc.name.toUpperCase() : '';
                bank = 'BANK';
                fullDisplayText = holder;
            }

            const last4 = number.length >= 4 ? number.slice(-4) : number;
            const singleLineDisplay = `${holder.toUpperCase()} • ${type.toUpperCase()}${last4 ? ` • ${last4}` : ''}`;

            const option = document.createElement('option');
            option.value = fullDisplayText;
            option.setAttribute('data-account-id', acc.id || '');
            option.textContent = fullDisplayText;
            selectEl.appendChild(option);

            allItemsData.push({
                id: acc.id || '',
                fullValue: fullDisplayText,
                singleLine: singleLineDisplay,
                holder: holder.toUpperCase(),
                bank: bank.toUpperCase(),
                type: type.toUpperCase(),
                last4: last4,
                number: number
            });
        });

        if (!customDropdown || !customSearch) {
            if (selectedVal) selectEl.value = selectedVal;
            return;
        }

        const renderDropdownItems = (filterText = '') => {
            customDropdown.innerHTML = '';
            const filtered = allItemsData.filter(item => {
                const query = filterText.toLowerCase();
                return item.holder.toLowerCase().includes(query) ||
                       item.bank.toLowerCase().includes(query) ||
                       item.type.toLowerCase().includes(query) ||
                       item.number.toLowerCase().includes(query);
            });

            if (filtered.length === 0) {
                customDropdown.innerHTML = '<div class="px-3.5 py-3 text-xs text-slate-400 text-center font-medium">No matching accounts found</div>';
                return;
            }

            filtered.forEach(item => {
                const div = document.createElement('div');
                div.className = 'px-3.5 py-2.5 hover:bg-primary/10 cursor-pointer transition-colors flex flex-col gap-0.5 group/item';
                div.innerHTML = `
                    <div class="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight group-hover/item:text-primary transition-colors">${item.holder}</div>
                    <div class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 uppercase">
                        <span class="text-blue-600 dark:text-blue-400 font-bold">${item.bank}</span>
                        <span>•</span>
                        <span class="text-slate-500 dark:text-slate-300 font-bold">${item.type}</span>
                        ${item.last4 ? `<span>•</span><span class="font-mono font-bold text-slate-600 dark:text-slate-300 tracking-wider">${item.last4}</span>` : ''}
                    </div>
                `;

                div.onmousedown = (e) => {
                    e.preventDefault(); // Prevent input blur
                    selectEl.value = item.fullValue;
                    const opts = Array.from(selectEl.options);
                    const matchedIdx = opts.findIndex(o => o.value === item.fullValue);
                    if (matchedIdx >= 0) selectEl.selectedIndex = matchedIdx;
                    
                    customSearch.value = item.singleLine;
                    customDropdown.classList.add('hidden');
                    document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');
                };

                customDropdown.appendChild(div);
            });
        };

        renderDropdownItems();

        window.updateCustomBankSelectDisplay = (valToMatch) => {
            if (!valToMatch) {
                customSearch.value = '';
                return;
            }
            const matched = allItemsData.find(i => i.fullValue === valToMatch || i.singleLine === valToMatch);
            if (matched) {
                customSearch.value = matched.singleLine;
                selectEl.value = matched.fullValue;
            } else {
                customSearch.value = valToMatch;
                selectEl.value = valToMatch;
            }
        };

        const box = document.getElementById('custom-bank-selected-box');
        const arrow = document.getElementById('custom-bank-arrow');

        const openDropdown = () => {
            renderDropdownItems(customSearch.value);
            customDropdown.classList.remove('hidden');
            arrow?.classList.add('rotate-180');
        };

        const closeDropdown = () => {
            customDropdown.classList.add('hidden');
            arrow?.classList.remove('rotate-180');
            if (selectEl.value) {
                const matched = allItemsData.find(i => i.fullValue === selectEl.value);
                if (matched) customSearch.value = matched.singleLine;
            } else {
                customSearch.value = '';
            }
        };

        if (box) {
            box.onclick = (e) => {
                if (e.target === customSearch) return;
                if (customDropdown.classList.contains('hidden')) {
                    customSearch.focus();
                    openDropdown();
                } else {
                    closeDropdown();
                }
            };
        }

        if (customSearch) {
            customSearch.onfocus = () => {
                customSearch.select();
                openDropdown();
            };

            customSearch.oninput = (e) => {
                renderDropdownItems(e.target.value);
                if (customDropdown.classList.contains('hidden')) {
                    customDropdown.classList.remove('hidden');
                    arrow?.classList.add('rotate-180');
                }
            };

            customSearch.onblur = () => {
                setTimeout(closeDropdown, 150);
            };
        }

        if (selectedVal) {
            selectEl.value = selectedVal;
            window.updateCustomBankSelectDisplay(selectedVal);
        }
    } catch (e) {
        console.error('Error populating bank accounts:', e);
    }
}
window.populateBankAccountsDropdown = populateBankAccountsDropdown;
async function loadBankWithdrawals() {
    if (!db) return [];
    try {
        const querySnapshot = await getDocs(collection(db, "bank_withdrawals"));
        return querySnapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
    } catch (e) {
        console.error("Error loading bank withdrawals: ", e);
        return [];
    }
}
async function saveBankWithdrawal(withdrawal) {
    if (!db) return null;
    try {
        const id = String(withdrawal.id || Date.now());
        const docRef = doc(db, "bank_withdrawals", id);
        await setDoc(docRef, withdrawal);
        return { message: "Withdrawal saved" };
    } catch (e) {
        console.error("Error saving withdrawal: ", e);
        return null;
    }
}
async function deleteBankWithdrawal(id) {
    try {
        await deleteDoc(doc(db, "bank_withdrawals", id.toString()));
        return { message: "Withdrawal deleted" };
    } catch (e) {
        console.error("Error deleting withdrawal: ", e);
        return null;
    }
}
// --- END Bank Withdrawals Helpers ---

async function clearDatabase() {
    try {
        const collections = ['entries', 'credits', 'customers'];
        for (const colName of collections) {
            const snapshot = await getDocs(collection(db, colName));
            const docs = snapshot.docs;

            // Delete in batches of 500
            for (let i = 0; i < docs.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + 500);
                chunk.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
        return { success: true, message: "Database cleared" };
    } catch (e) {
        console.error("Error clearing database: ", e);
        return { success: false, error: e.message };
    }
}

// Auto-dedup: remove duplicate entries for the same date, keep the one with most income
async function deduplicateEntries() {
    try {
        const snapshot = await getDocs(collection(db, "entries"));
        const allDocs = snapshot.docs.map(d => ({ firebaseId: d.id, ref: d.ref, ...d.data() }));

        // Group by date
        const byDate = {};
        allDocs.forEach(e => {
            if (!byDate[e.date]) byDate[e.date] = [];
            byDate[e.date].push(e);
        });

        const batch = writeBatch(db);
        let dupCount = 0;
        Object.values(byDate).forEach(group => {
            if (group.length > 1) {
                // Keep the entry with the highest income (most complete data)
                group.sort((a, b) => (b.income || 0) - (a.income || 0));
                // Delete all but the first (best)
                group.slice(1).forEach(dup => {
                    batch.delete(dup.ref);
                    dupCount++;
                });
            }
        });

        if (dupCount > 0) {
            await batch.commit();
            console.log(`Deduplication complete: removed ${dupCount} duplicate entry/entries.`);
        }
    } catch (e) {
        console.error("Dedup error:", e);
    }
}

async function bulkImport(data) {
    try {
        const batch = writeBatch(db);
        if (data.entries) data.entries.forEach(e => batch.set(doc(db, 'entries', e.id.toString()), e));
        if (data.credits) data.credits.forEach(c => batch.set(doc(db, 'credits', c.id.toString()), c));
        if (data.customers) data.customers.forEach(cust => batch.set(doc(db, 'customers', cust.id.toString()), cust));
        await batch.commit();
        return { message: "Data imported" };
    } catch (e) {
        console.error("Error during bulk import: ", e);
        return null;
    }
}

// Migration from localStorage to SQLite
async function migrateToDatabase() {
    const STORAGE_KEY = 'biz_perf_entries';
    const CREDIT_STORAGE_KEY = 'biz_perf_credits';
    const CUSTOMER_STORAGE_KEY = 'biz_perf_customers';

    const localEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const localCredits = JSON.parse(localStorage.getItem(CREDIT_STORAGE_KEY) || '[]');
    const localCustomers = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || '[]');

    if (localEntries.length > 0 || localCredits.length > 0 || localCustomers.length > 0) {
        console.log('Migrating data to database...');

        for (const customer of localCustomers) {
            await saveCustomer(customer);
        }
        for (const credit of localCredits) {
            await saveCredit(credit);
        }
        for (const entry of localEntries) {
            await saveEntry({ ...entry, id: existingEntryId || entry.id });
        }

        console.log('Migration complete. Clearing localStorage...');
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CREDIT_STORAGE_KEY);
        localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    }
}

// Formatting currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatStandardDate(dateStr) {
    if (!dateStr) return '';
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}


// Formula: Opening Balance = Previous Day Closing + Same Day Capital Add
function calculateOpeningBalance(prevClosing, capitalAdd) {
    return (parseFloat(prevClosing) || 0) + (parseFloat(capitalAdd) || 0);
}

// Logic for Add Entry form
async function initAddEntry() {
    const form = document.getElementById('add-entry-form');
    if (!form) return;

    let existingEntryId = null; // tracks Firestore ID of existing entry for current date

    const datePicker = document.getElementById('entry-date-picker');
    const formTitle = document.getElementById('form-title');
    const formSubtitle = document.getElementById('form-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const submitIcon = document.getElementById('submit-icon');
    const submitText = document.getElementById('submit-text');

    const lockAutoSyncedFields = (isExisting = false) => {
        const autoSyncIds = [
            'go2sms', 'credit', 'pending', 'deposit', 'damages', 'jio', 'expense', 'capital', 'withdrawal',
            'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 
            'business_development', 'settlement_charges', 'internet_expense', 'gold_sip', 'expense_notes'
        ];
        autoSyncIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.readOnly = true;
                input.classList.add('bg-primary/5', 'dark:bg-primary/10', 'border-primary/20', 'cursor-not-allowed', 'ring-1', 'ring-primary/30', 'select-none');
                input.setAttribute('title', 'Auto synced field. Manual editing disabled.');
                input.style.paddingRight = '56px';

                const button = input.parentElement.querySelector('button');
                if (button && id !== 'expense') button.style.display = 'none'; // Keep expense split button visible for viewing
                let rightPos = (button && id === 'expense') ? 'right-9' : 'right-3';
                input.style.paddingRight = (button && id === 'expense') ? '64px' : '40px';

                let indicator = input.parentElement.querySelector('.sync-indicator');
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = `sync-indicator absolute ${rightPos} top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-80 pointer-events-none select-none`;
                    indicator.innerHTML = `
                        <span class="hidden lg:inline text-[9px] font-bold text-primary uppercase px-1.5 py-0.5 bg-primary/10 rounded border border-primary/20">Sync</span>
                        <span class="material-symbols-outlined text-[13px] text-primary">sync</span>
                    `;
                    input.parentElement.appendChild(indicator);
                } else {
                    indicator.className = `sync-indicator absolute ${rightPos} top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-80 pointer-events-none select-none`;
                }
                const icon = indicator.querySelector('.material-symbols-outlined');
                if (icon) {
                    if (isExisting) icon.classList.remove('animate-spin-slow');
                    else icon.classList.add('animate-spin-slow');
                }
            }
        });
    };

    async function checkExisting() {
        if (!datePicker) return;
        const entries = await loadEntries();

        // Convert YYYY-MM-DD picker value to saved format "Mar 15, 2026"
        const [yr, mo, dy] = datePicker.value.split('-');
        const selectedFormatted = new Date(yr, mo - 1, dy)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const existing = entries.find(e => {
            if (!e.date) return false;
            if (e.date === datePicker.value) return true; // Matches CSV "2026-03-27"
            if (e.date === selectedFormatted) return true; // Legacy "Mar 27, 2026"
            if (e.date.startsWith(datePicker.value)) return true;
            return false;
        });

        if (existing) {
            existingEntryId = existing.firebaseId || existing.id || null;
            if (formTitle) formTitle.innerText = "Edit Daily Record";
            if (formSubtitle) formSubtitle.innerText = "Modifying the record for " + datePicker.value;
            if (submitText) submitText.innerText = "Update Entry";
            if (submitIcon) submitIcon.innerText = "edit_note";

            const details = existing.details || {};
            Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                const fieldName = (input.id || input.name || "").toLowerCase();
                // Check both details and top-level fields (capital, expense, withdrawal)
                const val = details[fieldName] !== undefined ? details[fieldName] : (existing[fieldName] || 0);
                input.value = val;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = details[id] !== undefined ? details[id] : '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
            const notesEl = document.getElementById('expense_notes');
            if (notesEl) {
                notesEl.value = details['expense_notes'] || '';
                notesEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            lockAutoSyncedFields(true /* isExisting */);
        } else {
            if (formTitle) formTitle.innerText = "New Daily Record";
            if (formSubtitle) formSubtitle.innerText = "Please fill in the performance metrics for today's business activity.";
            if (submitText) submitText.innerText = "Save Entry";
            if (submitIcon) submitIcon.innerText = "save";
            existingEntryId = null;

            // Pre-fill and lock Credit Ledger total pending balance
            const pendingCredit = await updateCreditLedgerTotalPending();
            const creditInput = document.getElementById('credit');
            if (creditInput) {
                creditInput.value = pendingCredit;
                creditInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            lockAutoSyncedFields(false /* isExisting */);

            // No data for this date — check if there is a local draft
            const draftStr = localStorage.getItem('add_entry_draft');
            if (draftStr) {
                const draft = JSON.parse(draftStr);
                if (draft.date === datePicker.value) {
                    // Restore draft
                    Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                        const fieldName = (input.id || input.name || "").toLowerCase();
                        if (draft.data[fieldName] !== undefined) {
                            input.value = draft.data[fieldName];
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                    ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el && draft.data[id] !== undefined) {
                            el.value = draft.data[id];
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                    const notesEl = document.getElementById('expense_notes');
                    if (notesEl && draft.data['expense_notes'] !== undefined) {
                        notesEl.value = draft.data['expense_notes'];
                        notesEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else {
                    // Draft is for a different date, clear it
                    localStorage.removeItem('add_entry_draft');
                    Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                        input.value = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                    ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }
                    });
                    const notesEl = document.getElementById('expense_notes');
                    if (notesEl) { notesEl.value = ''; notesEl.dispatchEvent(new Event('input', { bubbles: true })); }
                }
            } else {
                // No data and no draft — clear all fields
                Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
                ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }
                });
                const notesEl = document.getElementById('expense_notes');
                if (notesEl) { notesEl.value = ''; notesEl.dispatchEvent(new Event('input', { bubbles: true })); }
            }
        }

        // --- Restore Session Data (from when user navigated away) ---
        const savedFormDataStr = sessionStorage.getItem('add_entry_form_data');
        if (savedFormDataStr) {
            try {
                const savedData = JSON.parse(savedFormDataStr);
                // Restore the date picker first (it's outside the form tag, so not captured by FormData)
                const savedDate = savedData['__entry_date__'];
                if (savedDate && datePicker && datePicker.value !== savedDate) {
                    datePicker.value = savedDate;
                    // Re-run checkExisting for the correct date but with session data — will be restored below
                    // We do NOT re-trigger checkExisting here to avoid infinite loop;
                    // Instead we'll override fields below after database lookup resolves.
                }
                // Apply to all inputs in the form
                Object.keys(savedData).forEach(key => {
                    if (key === '__entry_date__') return; // already handled above
                    const input = form.querySelector(`[name="${key}"]`) || document.getElementById(key);
                    if (input && savedData[key] !== undefined && savedData[key] !== '') {
                        input.value = savedData[key];
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
                // Remove it so it doesn't persist inappropriately
                sessionStorage.removeItem('add_entry_form_data');
            } catch (e) {
                console.error("Error restoring session data:", e);
            }
        }

        // --- Data Transfer Logic ---
        // Apply any pending transfers from Damaged Currency or Cash Calculator
        const selectedDamages = localStorage.getItem('selected_damages_transfer');
        const selectedCash = localStorage.getItem('temp_calculator_cash');

        if (selectedDamages || selectedCash) {
            if (selectedDamages) {
                const damagesInput = document.getElementById('damages');
                if (damagesInput) {
                    damagesInput.value = selectedDamages;
                    damagesInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            if (selectedCash) {
                const cashInput = document.getElementById('cash');
                if (cashInput) {
                    cashInput.value = selectedCash;
                    cashInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            // Clean up to avoid re-applying on subsequent date changes
            localStorage.removeItem('selected_credit_transfer');
            localStorage.removeItem('selected_damages_transfer');
            localStorage.removeItem('temp_calculator_cash');
        }
    }

    if (datePicker) {
        // Check if we have session data (returning from a calculator with a non-today date)
        const pendingSessionData = sessionStorage.getItem('add_entry_form_data');
        let initialDate = null;
        if (pendingSessionData) {
            try {
                const pd = JSON.parse(pendingSessionData);
                if (pd['__entry_date__']) initialDate = pd['__entry_date__'];
            } catch(e) {}
        }
        if (initialDate) {
            // Restore the saved date (e.g. user had selected March 29)
            datePicker.value = initialDate;
        } else {
            // Default to today
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            datePicker.value = `${yyyy}-${mm}-${dd}`;
        }

        datePicker.addEventListener('change', checkExisting);
        
        // Auto-save draft on input
        const saveDraft = () => {
            const draft = {
                date: datePicker.value,
                data: {}
            };
            Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                const fieldName = (input.id || input.name || "").toLowerCase();
                if (input.value !== '') {
                    draft.data[fieldName] = parseFloat(input.value);
                }
            });
            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
                const el = document.getElementById(id);
                if (el && el.value !== '') {
                    draft.data[id] = parseFloat(el.value);
                }
            });
            const notesEl = document.getElementById('expense_notes');
            if (notesEl && notesEl.value !== '') {
                draft.data['expense_notes'] = notesEl.value;
            }
            localStorage.setItem('add_entry_draft', JSON.stringify(draft));
        };
        form.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT') {
                saveDraft();
            }
        });
        ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', saveDraft);
        });
        const notesElForListener = document.getElementById('expense_notes');
        if (notesElForListener) notesElForListener.addEventListener('input', saveDraft);

        // Initial check
        checkExisting();

        // Real-time Total Calculation for Add Entry Form
        const updateRealTimeTotal = () => {
            const display = document.getElementById('realtime-total-display');
            if (!display) return;
            
            // Helper to get numeric value safely
            const v = (id) => parseFloat(document.getElementById(id)?.value) || 0;
            
            // Formula: Cash + Online + Roinet + Jio + Go2Sms + Credit + Pending + Damages - Deposit - Expense
            const total = v('cash') + v('online') + v('roinet') + v('jio') + v('go2sms') + v('credit') + v('pending') + v('damages') - v('deposit') - v('expense');
            
            display.textContent = formatCurrency(isNaN(total) ? 0 : total);
        };

        // Attach listeners to all relevant inputs for instant feedback
        const relevantIds = ['cash', 'online', 'roinet', 'jio', 'go2sms', 'credit', 'pending', 'damages', 'deposit', 'expense'];
        relevantIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', updateRealTimeTotal);
            }
        });

        // Also update when the form is reset or pre-filled
        form.addEventListener('reset', () => setTimeout(updateRealTimeTotal, 0));
        
        // Initial call
        updateRealTimeTotal();
    }

    // --- Online Accounts Split Modal Logic ---
    const onlineSplitModal = document.getElementById('online-split-modal');
    const onlineSplitPanel = document.getElementById('online-split-panel');
    const openOnlineBtn = document.getElementById('open-online-split-btn');
    const closeOnlineBtn = document.getElementById('close-online-split-btn');
    const onlineBackdrop = document.getElementById('online-split-backdrop');
    const useOnlineBtn = document.getElementById('use-online-amount-btn');
    const onlineSplitTotalDisplay = document.getElementById('online-split-total-display');
    const onlineInput = document.getElementById('online');
    
    const p1Input = document.getElementById('online_p1');
    const p2Input = document.getElementById('online_p2');
    const p3Input = document.getElementById('online_p3');

    const updateOnlineSplitTotal = () => {
        if(!p1Input) return 0;
        const p1 = parseFloat(p1Input.value) || 0;
        const p2 = parseFloat(p2Input.value) || 0;
        const p3 = parseFloat(p3Input.value) || 0;
        const total = p1 + p2 + p3;
        if(onlineSplitTotalDisplay) onlineSplitTotalDisplay.textContent = formatCurrency(total);
        return total;
    };

    if (openOnlineBtn && onlineSplitModal) {
        openOnlineBtn.addEventListener('click', () => {
             onlineSplitModal.classList.remove('hidden');
             onlineSplitModal.classList.add('flex');
             void onlineSplitModal.offsetWidth;
             onlineSplitPanel.classList.remove('scale-95', 'opacity-0');
             onlineSplitPanel.classList.add('scale-100', 'opacity-100');
             updateOnlineSplitTotal();
        });

        const closeOnlineModal = () => {
             onlineSplitPanel.classList.remove('scale-100', 'opacity-100');
             onlineSplitPanel.classList.add('scale-95', 'opacity-0');
             setTimeout(() => {
                 onlineSplitModal.classList.add('hidden');
                 onlineSplitModal.classList.remove('flex');
             }, 300);
        };

        if(closeOnlineBtn) closeOnlineBtn.addEventListener('click', closeOnlineModal);
        if(onlineBackdrop) onlineBackdrop.addEventListener('click', closeOnlineModal);

        [p1Input, p2Input, p3Input].forEach(inp => {
            if(inp) inp.addEventListener('input', updateOnlineSplitTotal);
        });

        if(useOnlineBtn) {
            useOnlineBtn.addEventListener('click', () => {
                const total = updateOnlineSplitTotal();
                if(onlineInput) {
                    onlineInput.value = total || '';
                    onlineInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                closeOnlineModal();
            });
        }
    }

    // --- Roinet Accounts Split Modal Logic ---
    const roinetSplitModal = document.getElementById('roinet-split-modal');
    const roinetSplitPanel = document.getElementById('roinet-split-panel');
    const openRoinetBtn = document.getElementById('open-roinet-split-btn');
    const closeRoinetBtn = document.getElementById('close-roinet-split-btn');
    const roinetBackdrop = document.getElementById('roinet-split-backdrop');
    const useRoinetBtn = document.getElementById('use-roinet-amount-btn');
    const roinetSplitTotalDisplay = document.getElementById('roinet-split-total-display');
    const roinetInput = document.getElementById('roinet');
    
    const r1Input = document.getElementById('roinet_1');
    const r2Input = document.getElementById('roinet_2');
    const a1Input = document.getElementById('airtel_1');
    const a2Input = document.getElementById('airtel_2');
    const sInput = document.getElementById('spicemoney');

    const updateRoinetSplitTotal = () => {
        if(!r1Input) return 0;
        const total = (parseFloat(r1Input.value) || 0) + 
                      (parseFloat(r2Input.value) || 0) + 
                      (parseFloat(a1Input.value) || 0) + 
                      (parseFloat(a2Input.value) || 0) + 
                      (parseFloat(sInput.value) || 0);
        if(roinetSplitTotalDisplay) roinetSplitTotalDisplay.textContent = formatCurrency(total);
        return total;
    };

    if (openRoinetBtn && roinetSplitModal) {
        openRoinetBtn.addEventListener('click', () => {
             roinetSplitModal.classList.remove('hidden');
             roinetSplitModal.classList.add('flex');
             void roinetSplitModal.offsetWidth;
             roinetSplitPanel.classList.remove('scale-95', 'opacity-0');
             roinetSplitPanel.classList.add('scale-100', 'opacity-100');
             updateRoinetSplitTotal();
        });

        const closeRoinetModal = () => {
             roinetSplitPanel.classList.remove('scale-100', 'opacity-100');
             roinetSplitPanel.classList.add('scale-95', 'opacity-0');
             setTimeout(() => {
                 roinetSplitModal.classList.add('hidden');
                 roinetSplitModal.classList.remove('flex');
             }, 300);
        };

        if(closeRoinetBtn) closeRoinetBtn.addEventListener('click', closeRoinetModal);
        if(roinetBackdrop) roinetBackdrop.addEventListener('click', closeRoinetModal);

        [r1Input, r2Input, a1Input, a2Input, sInput].forEach(inp => {
            if(inp) inp.addEventListener('input', updateRoinetSplitTotal);
        });

        if(useRoinetBtn) {
            useRoinetBtn.addEventListener('click', () => {
                const total = updateRoinetSplitTotal();
                if(roinetInput) {
                    roinetInput.value = total || '';
                    roinetInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                closeRoinetModal();
            });
        }
    }

    // --- Daily Expense Split Modal Logic ---
    const expenseSplitModal = document.getElementById('expense-split-modal');
    const expenseSplitPanel = document.getElementById('expense-split-panel');
    const openExpenseBtn = document.getElementById('open-expense-split-btn');
    const closeExpenseBtn = document.getElementById('close-expense-split-btn');
    const expenseBackdrop = document.getElementById('expense-split-backdrop');
    const useExpenseBtn = document.getElementById('use-expense-amount-btn');
    const expenseSplitTotalDisplay = document.getElementById('expense-split-total-display');
    const expenseInput = document.getElementById('expense');
    
    const ex_p = document.getElementById('personal_expense');
    const ex_s = document.getElementById('salary_expense');
    const ex_e = document.getElementById('electricity_expense');
    const ex_r = document.getElementById('shop_rent_expense');
    const ex_b = document.getElementById('business_development');
    const ex_i = document.getElementById('internet_expense');
    const ex_st = document.getElementById('settlement_charges');
    const ex_g = document.getElementById('gold_sip');

    const updateExpenseSplitTotal = () => {
        if(!ex_p) return 0;
        const total = (parseFloat(ex_p.value) || 0) + 
                      (parseFloat(ex_s.value) || 0) + 
                      (parseFloat(ex_e.value) || 0) + 
                      (parseFloat(ex_r.value) || 0) + 
                      (parseFloat(ex_b.value) || 0) + 
                      (parseFloat(ex_i.value) || 0) +
                      (parseFloat(ex_st?.value) || 0) +
                      (parseFloat(ex_g?.value) || 0);
        if(expenseSplitTotalDisplay) expenseSplitTotalDisplay.textContent = formatCurrency(total);
        return total;
    };

    if (openExpenseBtn && expenseSplitModal) {
        openExpenseBtn.addEventListener('click', () => {
             expenseSplitModal.classList.remove('hidden');
             expenseSplitModal.classList.add('flex');
             void expenseSplitModal.offsetWidth;
             expenseSplitPanel.classList.remove('scale-95', 'opacity-0');
             expenseSplitPanel.classList.add('scale-100', 'opacity-100');
             updateExpenseSplitTotal();
        });

        const closeExpenseModal = () => {
             expenseSplitPanel.classList.remove('scale-100', 'opacity-100');
             expenseSplitPanel.classList.add('scale-95', 'opacity-0');
             setTimeout(() => {
                 expenseSplitModal.classList.add('hidden');
                 expenseSplitModal.classList.remove('flex');
             }, 300);
        };

        if(closeExpenseBtn) closeExpenseBtn.addEventListener('click', closeExpenseModal);
        if(expenseBackdrop) expenseBackdrop.addEventListener('click', closeExpenseModal);

        [ex_p, ex_s, ex_e, ex_r, ex_b, ex_i, ex_st, ex_g].forEach(inp => {
            if(inp) inp.addEventListener('input', updateExpenseSplitTotal);
        });

        if(useExpenseBtn) {
            useExpenseBtn.addEventListener('click', closeExpenseModal);
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Clear the draft on successful save
        localStorage.removeItem('add_entry_draft');

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Saving...';
        }

        try {
            // Grab all inputs
            const inputs = Array.from(form.querySelectorAll('input[type="number"]'));

            // Validation: Ensure all fields are filled (even with 0)
            let hasEmptyFields = false;
            inputs.forEach(input => {
                if (input.value === '') {
                    input.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/20');
                    hasEmptyFields = true;
                } else {
                    input.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500/20');
                }
            });

            if (hasEmptyFields) {
                let container = document.getElementById('validation-toast-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'validation-toast-container';
                    container.className = 'fixed top-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0';
                    document.body.appendChild(container);
                }
                const toast = document.createElement('div');
                toast.className = 'pointer-events-auto flex items-center gap-3.5 px-4.5 py-4 bg-rose-600/95 dark:bg-rose-500/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-white/20 transform translate-x-full opacity-0 transition-all duration-300 ease-out';
                toast.innerHTML = `
                    <span class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                        <span class="material-symbols-outlined text-xl font-bold">error</span>
                    </span>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[10px] font-black uppercase tracking-widest text-white/80">Validation Alert</span>
                        <span class="text-sm font-bold text-white mt-0.5">Please fill in all fields. Use 0 if empty.</span>
                    </div>
                `;
                container.appendChild(toast);
                requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
                setTimeout(() => {
                    toast.classList.add('opacity-0', 'scale-95');
                    setTimeout(() => toast.remove(), 300);
                }, 3500);

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="material-symbols-outlined text-lg">add_circle</span> Save Entry';
                }
                return;
            }

            // ─── Transaction Checked Verification Validation ───
            const isValidateTxnsChecked = window.getAppSetting ? window.getAppSetting('validate_txns_checked', true) : (localStorage.getItem('validate_txns_checked') !== 'false');
            if (isValidateTxnsChecked) {
                const dateVal = datePicker ? datePicker.value : null;
                if (dateVal) {
                    const dateQueries = getPossibleDateFormats(dateVal);
                    const txnRef = collection(db, "daily_transactions");
                    const txnSnap = await getDocs(query(txnRef, where("date", "in", dateQueries)));
                    
                    const uncheckedTxns = [];
                    const typesToCheck = ['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL'];
                    
                    txnSnap.forEach(docSnap => {
                        const txn = docSnap.data();
                        const txnType = (txn.type || "").toUpperCase();
                        if (typesToCheck.includes(txnType) && txn.checked !== true) {
                            uncheckedTxns.push({
                                type: txn.type,
                                provider: txn.provider || 'N/A',
                                amount: txn.amount || 0
                            });
                        }
                    });
                    
                    if (uncheckedTxns.length > 0) {
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                title: 'Validation Alert',
                                html: `<div class="text-sm font-semibold text-slate-700 dark:text-slate-300">Cannot save daily record because some transaction types (AEPS, MATM, Deposit, or Withdrawal) are unchecked. Please verify all of them on the Daily Txn page first.</div><br><div class="max-h-[200px] overflow-y-auto pr-1">` + 
                                      uncheckedTxns.map(t => `<div class="text-xs text-left mt-1.5 border-b border-primary/10 pb-1.5 flex justify-between"><span>Type: <b>${t.type}</b> (Provider: ${t.provider})</span> <span>Amount: <b>₹${t.amount}</b></span></div>`).join('') + `</div>`,
                                icon: 'error',
                                confirmButtonColor: '#7f13ec'
                            });
                        } else {
                            alert('Cannot save daily record because some transaction types (AEPS, MATM, Deposit, or Withdrawal) are unchecked. Please verify all of them on the Daily Txn page first.');
                        }
                        
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            const btnIcon = existingEntryId ? 'edit_note' : 'save';
                            const btnText = existingEntryId ? 'Update Entry' : 'Save Entry';
                            submitBtn.innerHTML = `<span class="material-symbols-outlined text-lg">${btnIcon}</span> ${btnText}`;
                        }
                        return;
                    }
                }
            }

            let income = 0;
            let expense = 0;
            let capital = 0;
            let withdrawal = 0;
            const details = {};

            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
                const el = document.getElementById(id);
                if (el && parseFloat(el.value) > 0) {
                    details[id] = parseFloat(el.value);
                }
            });
            const notesElSubmit = document.getElementById('expense_notes');
            if (notesElSubmit && notesElSubmit.value.trim() !== '') {
                details['expense_notes'] = notesElSubmit.value.trim();
            }

            inputs.forEach(input => {
                const val = parseFloat(input.value) || 0;
                const fieldName = (input.id || input.name || "").toLowerCase();

                if (val > 0) {
                    details[fieldName] = val; // Store individual non-zero fields
                }

                if (fieldName === 'withdrawal') {
                    withdrawal += val;
                    // Do NOT add to expense
                } else if (fieldName === 'capital') {
                    capital += val;
                    // Do NOT add to income
                } else if (fieldName === 'deposit') {
                    // Do NOT add to income, it's a liability to be subtracted from total
                } else if (['expense', 'purchase', 'bill', 'daily expense'].some(kw => fieldName.includes(kw))) {
                    expense += val;
                } else {
                    income += val;
                }
            });

            let entryDate = new Date();
            if (datePicker && datePicker.value) {
                const [year, month, day] = datePicker.value.split('-');
                entryDate = new Date(year, month - 1, day);
            }

            // Always store date as YYYY-MM-DD for consistent lookups
            const entryDateStr = entryDate.getFullYear() + '-' +
                String(entryDate.getMonth() + 1).padStart(2, '0') + '-' +
                String(entryDate.getDate()).padStart(2, '0');

            let totalCashFlow = (parseFloat(details['cash']) || 0) + (parseFloat(details['online']) || 0) + (parseFloat(details['roinet']) || 0) + (parseFloat(details['jio']) || 0) + (parseFloat(details['go2sms']) || 0) + (parseFloat(details['credit']) || 0) + (parseFloat(details['pending']) || 0) + (parseFloat(details['damages']) || 0) - (parseFloat(details['deposit']) || 0);

            const entry = {
                date: entryDateStr,
                description: `Daily Summary - ${new Date().toLocaleTimeString()}`,
                category: capital > 0 ? 'Capital' : 'Operations',
                income,
                expense,
                capital,
                withdrawal,
                totalCashFlow, // New field for the requested formula
                details, // Save individual field breakdown
                net: income - expense
            };
            const payload = { ...entry };
            if (existingEntryId) {
                payload.id = existingEntryId;
            }
            
            await saveEntry(payload);
            // Success Toast
            (function showAddEntryToast() {
                let container = document.getElementById('success-toast-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'success-toast-container';
                    container.className = 'fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none px-4';
                    document.body.appendChild(container);
                }
                const toast = document.createElement('div');
                toast.className = 'pointer-events-auto flex flex-col items-center gap-3 p-6 sm:px-8 sm:py-7 bg-emerald-500/95 dark:bg-emerald-600/95 backdrop-blur-2xl text-white rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(16,185,129,0.5)] border border-white/20 transform scale-75 opacity-0 transition-all duration-500 ease-out';
                toast.innerHTML = `
                    <div class="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner shrink-0 mb-1">
                        <span class="material-symbols-outlined text-[36px] font-black text-emerald-500">task_alt</span>
                    </div>
                    <div class="flex flex-col text-center">
                        <span class="text-xl font-black text-white tracking-wide">Entry Saved! 🎉</span>
                        <span class="text-sm font-semibold text-emerald-50 mt-1.5 leading-snug">Your daily record has been saved<br>successfully to the ledger.</span>
                    </div>
                `;
                container.appendChild(toast);
                
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => toast.classList.remove('scale-75', 'opacity-0'));
                });
                
                setTimeout(() => {
                    toast.classList.add('opacity-0', 'scale-90', 'translate-y-4');
                    setTimeout(() => toast.remove(), 500);
                }, 3000);
            })();
            form.reset();
            
            // Clear modal inputs which are outside the form
            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { 
                    el.value = ''; 
                    el.dispatchEvent(new Event('input', { bubbles: true })); 
                }
            });
            const notesElForm = document.getElementById('expense_notes');
            if (notesElForm) {
                notesElForm.value = '';
                notesElForm.dispatchEvent(new Event('input', { bubbles: true }));
            }

            if (datePicker) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                datePicker.value = `${yyyy}-${mm}-${dd}`;
                // Trigger checkExisting for the new date to properly reset states like existingEntryId
                datePicker.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                existingEntryId = null;
                if (formTitle) formTitle.innerText = "New Daily Record";
                if (formSubtitle) formSubtitle.innerText = "Please fill in the performance metrics for today's business activity.";
                if (submitBtn) {
                    const iconBox = submitBtn.querySelector('.material-symbols-outlined');
                    if(iconBox) iconBox.innerText = "save";
                    // Note: submitText is handled in finally block
                }
            }
        } catch (err) {
            console.error('Error saving entry:', err);
            alert('Failed to save entry. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="material-symbols-outlined text-lg">add_circle</span> Save Entry';
            }
        }
    });
}

// Logic for Dashboard
async function initDashboard() {
    const dashboardHeader = document.querySelector('h3');
    const isDashboard = dashboardHeader && dashboardHeader.innerText.includes('Business Overview');
    if (!isDashboard) {
        if (dashboardUnsubscribe) {
            dashboardUnsubscribe();
            dashboardUnsubscribe = null;
        }
        return;
    }

    // Clean up previous listener to avoid duplicates
    if (dashboardUnsubscribe) dashboardUnsubscribe();

    const entryCollection = collection(db, 'entries');

    dashboardUnsubscribe = onSnapshot(entryCollection, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // --- 2. All-Time & Daily Aggregation ---
        // Sort entries by date for accurate balance tracking
        const sortedEntries = entries.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentDay = now.getDate();

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const lastMonthDate = new Date(currentYear, currentMonth - 1, currentDay);
        const lastMonthVal = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Financial Year & Quarter Setup
        const nowMonth = now.getMonth();
        const nowYear = now.getFullYear();
        const fyStartYear = nowMonth >= 3 ? nowYear : nowYear - 1;
        const yStart = new Date(fyStartYear, 3, 1); // April 1
        const yEnd = new Date(fyStartYear + 1, 2, 31); // March 31

        const currentQ = Math.floor((nowMonth >= 3 ? nowMonth - 3 : nowMonth + 9) / 3); 
        const qStartMonth = currentQ * 3 + 3;
        const qStartYearVal = qStartMonth > 11 ? fyStartYear + 1 : fyStartYear;
        const qStartActual = qStartMonth > 11 ? 0 : qStartMonth;
        const qStart = new Date(qStartYearVal, qStartActual, 1);
        const qEnd = new Date(qStartYearVal, qStartActual + 3, 0);

        let allTimeIncome = 0, allTimeExpense = 0, allTimeProfit = 0;
        let totalCapital = 0, totalWithdrawal = 0;
        let todayIncome = 0, todayExpense = 0, todayProfit = 0;
        let yesterdayIncome = 0, yesterdayExpense = 0, yesterdayProfit = 0;
        let hasTodayEntry = false;
        let lastMonthTodayIncome = 0, lastMonthTodayExpense = 0;
        let currentMTDIncome = 0, currentMTDExpense = 0;
        let lastMTDIncome = 0, lastMTDExpense = 0;
        let currentFYIncome = 0, currentQIncome = 0;
        let currentFYExpense = 0, currentQExpense = 0;
        let finalRunningBalance = 0;

        // Monthly Comparison Data (1-31 days)
        const currentMonthData = new Array(31).fill(0);
        const previousMonthData = new Array(31).fill(0);

        // Cumulative Data for Charts
        const dailyData = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const isoKey = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            dailyData[isoKey] = { income: 0, expense: 0, profit: 0, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
        }

        sortedEntries.forEach((e) => {
            const entryDate = new Date(e.date);
            const eDay = entryDate.getDate();
            const eMonth = entryDate.getMonth();
            const eYear = entryDate.getFullYear();
            
            const details = e.details || {};
            const cash = parseFloat(details.cash) || 0;
            const online = parseFloat(details.online) || 0;
            const roinet = parseFloat(details.roinet) || 0;
            const jio = parseFloat(details.jio) || 0;
            const go2sms = parseFloat(details.go2sms) || parseFloat(details.crgb_bc) || 0;
            const credit = parseFloat(details.credit) || 0;
            const pending = parseFloat(details.pending) || 0;
            const damages = parseFloat(details.damages) || 0;
            const deposit = parseFloat(details.deposit) || 0;

            const tcf = cash + online + roinet + jio + go2sms + credit + pending + damages - deposit;
            const exp = parseFloat(e.expense) || 0;
            const cap = parseFloat(e.capital) || parseFloat(e.capitalAdd) || 0;
            const wit = parseFloat(details.withdrawal) || parseFloat(e.withdrawal) || 0;

            // Universal Gross Math Logic
            const baseOpn = (e.openingBalance !== undefined && e.openingBalance > 0) ? parseFloat(e.openingBalance) : finalRunningBalance;
            const opn = baseOpn + cap;
            const displayTotalBase = tcf + exp; 
            const dailyInc = Math.max(0, displayTotalBase - opn);
            const dailyProf = dailyInc - exp;
            const netFlow = displayTotalBase - exp;
            const cls = netFlow - wit;
            finalRunningBalance = cls;

            // 1. All-Time Aggregation
            allTimeIncome += dailyInc;
            allTimeExpense += exp;
            allTimeProfit += dailyProf;
            totalCapital += cap;
            totalWithdrawal += wit;

            // 2. Today & Yesterday Comparisons
            if (eDay === currentDay && eMonth === currentMonth && eYear === currentYear) {
                todayIncome = dailyInc; todayExpense = exp; todayProfit = dailyProf;
                hasTodayEntry = true;
            } else if (eDay === yesterday.getDate() && eMonth === yesterday.getMonth() && eYear === yesterday.getFullYear()) {
                yesterdayIncome = dailyInc; yesterdayExpense = exp; yesterdayProfit = dailyProf;
            }

            // 3. MoM & MTD Analytics
            if (eDay === lastMonthDate.getDate() && eMonth === lastMonthDate.getMonth() && eYear === lastMonthDate.getFullYear()) {
                lastMonthTodayIncome += dailyInc;
                lastMonthTodayExpense += exp;
            }
            if (eMonth === currentMonth && eYear === currentYear && eDay <= currentDay) {
                currentMTDIncome += dailyInc;
                currentMTDExpense += exp;
            }
            if (eMonth === lastMonthVal && eYear === lastMonthYear && eDay <= currentDay) {
                lastMTDIncome += dailyInc;
                lastMTDExpense += exp;
            }
            if (entryDate >= yStart && entryDate <= yEnd) {
                currentFYIncome += dailyInc;
                currentFYExpense += exp;
            }
            if (entryDate >= qStart && entryDate <= qEnd) {
                currentQIncome += dailyInc;
                currentQExpense += exp;
            }

            // 4. Monthly Comparison Data (Fixed Month Days)
            if (eMonth === currentMonth && eYear === currentYear) {
                if (eDay >= 1 && eDay <= 31) currentMonthData[eDay - 1] += dailyInc;
            } else if (eMonth === lastMonthVal && eYear === lastMonthYear) {
                if (eDay >= 1 && eDay <= 31) previousMonthData[eDay - 1] += dailyInc;
            }

            // 5. Chart Data (Last 30 Days Sliding Window)
            if (dailyData[e.date]) {
                dailyData[e.date].income += dailyInc;
                dailyData[e.date].expense += exp;
                dailyData[e.date].profit += dailyProf;
            }
        });

        // --- 3. UI Update Helpers ---
        const setVal = (id, val, format = true) => {
            const el = document.getElementById(id);
            if (el) el.innerText = format ? formatCurrency(val) : val;
        };

        const updateTrend = (idVal, idIcon, current, previous) => {
            const valEl = document.getElementById(idVal);
            const iconEl = document.getElementById(idIcon);
            if (!valEl) return;
            let pct = (previous > 0) ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
            const isUp = pct >= 0;
            valEl.innerHTML = `${isUp ? '+' : ''}${pct.toFixed(1)}% <span class="font-normal text-white/70 ml-1">vs yesterday</span>`;
            valEl.parentElement.classList.toggle('text-emerald-500', isUp);
            valEl.parentElement.classList.toggle('text-rose-500', !isUp);
            if (iconEl) iconEl.innerText = isUp ? 'trending_up' : 'trending_down';
        };

        // --- 4. Render Updates ---
        
        // Preserve actual today's value for the MoM table
        const actualTodayIncome = todayIncome;
        const actualTodayExpense = todayExpense;
        const actualTodayProfit = todayProfit;

        // Fallback to yesterday if today is not available for Top Cards
        if (!hasTodayEntry) {
            todayIncome = yesterdayIncome;
            todayExpense = yesterdayExpense;
            todayProfit = yesterdayProfit;
        }

        // Update Labels based on availability
        const todayLabel = hasTodayEntry ? "Today's" : "Yesterday's";
        const incomeLabelEl = document.getElementById('today-income-label');
        const expenseLabelEl = document.getElementById('today-expense-label');
        const profitLabelEl = document.getElementById('today-profit-label');
        if (incomeLabelEl) incomeLabelEl.innerText = todayLabel + " Income";
        if (expenseLabelEl) expenseLabelEl.innerText = todayLabel + " Expense";
        if (profitLabelEl) profitLabelEl.innerText = todayLabel + " Profit";

        // Summary Cards (All-Time)
        setVal('total-income-top', allTimeIncome);
        setVal('total-expense-top', allTimeExpense);
        setVal('total-profit-top', allTimeProfit);
        setVal('closing-balance-top', finalRunningBalance);
        setVal('total-capital-top', totalCapital);
        setVal('total-withdrawals-top', totalWithdrawal);
        
        // Today Detail (Uses fallback)
        setVal('today-income-top', todayIncome);
        setVal('today-expense-top', todayExpense);
        setVal('today-profit-top', todayProfit);

        // This Month Detail
        setVal('this-month-income-top', currentMTDIncome);
        setVal('this-month-expense-top', currentMTDExpense);
        setVal('this-month-profit-top', currentMTDIncome - currentMTDExpense);

        ['income', 'expense', 'profit'].forEach(type => {
            const current = type === 'income' ? currentMTDIncome : (type === 'expense' ? currentMTDExpense : (currentMTDIncome - currentMTDExpense));
            const previous = type === 'income' ? lastMTDIncome : (type === 'expense' ? lastMTDExpense : (lastMTDIncome - lastMTDExpense));
            const valEl = document.getElementById(`this-month-${type}-trend-val`);
            if (valEl) {
                let pct = (previous > 0) ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
                const isUp = pct >= 0;
                valEl.innerHTML = `${isUp ? '+' : ''}${pct.toFixed(1)}% <span class="font-normal text-white/70 ml-1">vs last month</span>`;
                valEl.parentElement.classList.toggle('text-emerald-500', isUp);
                valEl.parentElement.classList.toggle('text-rose-500', !isUp);
            }
        });

        // Trends (Uses fallback if none)
        updateTrend('income-trend-val', 'income-trend-icon', todayIncome, yesterdayIncome);
        updateTrend('expense-trend-val', 'expense-trend-icon', todayExpense, yesterdayExpense);
        updateTrend('profit-trend-val', 'profit-trend-icon', todayProfit, yesterdayProfit);

        // MoM Analytics
        const setSm = (id, val, prev = null) => {
            setVal(id, val);
            if (prev !== null) {
                const pEl = document.getElementById(id.replace('today', 'last').replace('current', 'last'));
                if (pEl) pEl.innerText = `vs ${formatCurrency(prev)}`;
            }
        };
        // Use actual today values for MoM Table instead of fallback
        setSm('mom-today-income', actualTodayIncome, lastMonthTodayIncome);
        setSm('mom-today-expense', actualTodayExpense, lastMonthTodayExpense);
        setSm('mom-today-profit', actualTodayProfit, lastMonthTodayIncome - lastMonthTodayExpense);
        setSm('mtd-current-income', currentMTDIncome, lastMTDIncome);
        setSm('mtd-current-expense', currentMTDExpense, lastMTDExpense);
        setSm('mtd-current-profit', currentMTDIncome - currentMTDExpense, lastMTDIncome - lastMTDExpense);

        // Update MoM Labels with Explicit Dates
        const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMtdStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const labelToday = document.getElementById('mom-today-label');
        if (labelToday) labelToday.innerText = `TODAY (${fmtShort(now).toUpperCase()}) VS LAST MONTH (${fmtShort(lastMonthDate).toUpperCase()})`;

        const labelMtd = document.getElementById('mom-mtd-label');
        if (labelMtd) labelMtd.innerText = `MTD (${fmtShort(mtdStart).toUpperCase()} - ${fmtShort(now).toUpperCase()}) VS LAST MTD (${fmtShort(lastMtdStart).toUpperCase()} - ${fmtShort(lastMonthDate).toUpperCase()})`;

        // 5. Projections - Forecast to Completion Model
        const daysPassed = now.getDate();
        const avgDaily = currentMTDIncome / (daysPassed || 1);
        const avgDailyExp = currentMTDExpense / (daysPassed || 1);
        
        // Month
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysRemainingMonth = Math.max(0, daysInMonth - daysPassed);
        
        // Quarter
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysRemainingQ = Math.max(0, Math.round((qEnd - nowMidnight) / (1000 * 60 * 60 * 24)));
        
        // Year
        const daysRemainingFY = Math.max(0, Math.round((yEnd - nowMidnight) / (1000 * 60 * 60 * 24)));

        setVal('proj-monthly', currentMTDIncome + (avgDaily * daysRemainingMonth));
        setVal('proj-quarterly', currentQIncome + (avgDaily * daysRemainingQ));
        setVal('proj-yearly', currentFYIncome + (avgDaily * daysRemainingFY));

        setVal('proj-monthly-exp', currentMTDExpense + (avgDailyExp * daysRemainingMonth));
        setVal('proj-quarterly-exp', currentQExpense + (avgDailyExp * daysRemainingQ));
        setVal('proj-yearly-exp', currentFYExpense + (avgDailyExp * daysRemainingFY));

        setVal('proj-monthly-profit', (currentMTDIncome + (avgDaily * daysRemainingMonth)) - (currentMTDExpense + (avgDailyExp * daysRemainingMonth)));
        setVal('proj-quarterly-profit', (currentQIncome + (avgDaily * daysRemainingQ)) - (currentQExpense + (avgDailyExp * daysRemainingQ)));
        setVal('proj-yearly-profit', (currentFYIncome + (avgDaily * daysRemainingFY)) - (currentFYExpense + (avgDailyExp * daysRemainingFY)));


        const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const setRange = (selector, s, e) => {
            document.querySelectorAll(selector).forEach(el => {
                el.innerText = `${fmtDate(s)} - ${fmtDate(e)}`;
            });
        };
        setRange('.proj-month-range-text', mStart, mEnd);
        setRange('.proj-quart-range-text', qStart, qEnd);
        setRange('.proj-year-range-text', yStart, yEnd);

        // --- 6. Charts ---
        const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const cIncome = '#10b981';
        const cExpense = '#f43f5e';
        const cProfit = '#0ea5e9';
        const labels = Object.values(dailyData).map(d => d.label);
        const incomeData = Object.values(dailyData).map(d => d.income);
        const expenseData = Object.values(dailyData).map(d => d.expense);
        const profitData = Object.values(dailyData).map(d => d.profit);

        // Income vs Expense
        if (incomeExpenseChart) incomeExpenseChart.destroy();
        const ieCtx = document.getElementById('incomeExpenseChart');
        if (ieCtx) {
            incomeExpenseChart = new Chart(ieCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Income', data: incomeData, backgroundColor: cIncome, borderRadius: 4 },
                        { label: 'Expense', data: expenseData, backgroundColor: cExpense, borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8 } }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
                    }
                }
            });
        }

        // Profit Growth
        if (profitGrowthChart) profitGrowthChart.destroy();
        const pgCtx = document.getElementById('profitGrowthChart');
        if (pgCtx) {
            profitGrowthChart = new Chart(pgCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Net Profit',
                        data: profitData,
                        borderColor: cProfit,
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8 } }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
                    }
                }
            });
        }

        // Income Growth
        if (incomeGrowthChart) incomeGrowthChart.destroy();
        const igCtx = document.getElementById('incomeGrowthChart');
        if (igCtx) {
            incomeGrowthChart = new Chart(igCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Income Growth',
                        data: incomeData,
                        borderColor: cIncome,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
                    }
                }
            });
        }

        // Expense Growth
        if (expenseGrowthChart) expenseGrowthChart.destroy();
        const egCtx = document.getElementById('expenseGrowthChart');
        if (egCtx) {
            expenseGrowthChart = new Chart(egCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Expense Growth',
                        data: expenseData,
                        borderColor: cExpense,
                        backgroundColor: 'rgba(244, 63, 94, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
                    }
                }
            });
        }

        // Monthly Income Comparison Chart
        if (monthlyComparisonChart) monthlyComparisonChart.destroy();
        const mcCtx = document.getElementById('monthlyComparisonChart');
        if (mcCtx) {
            const daysLabels = Array.from({ length: 31 }, (_, i) => i + 1);
            monthlyComparisonChart = new Chart(mcCtx, {
                type: 'line',
                data: {
                    labels: daysLabels,
                    datasets: [
                        {
                            label: 'This Month',
                            data: currentMonthData,
                            borderColor: cIncome,
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Previous Month',
                            data: previousMonthData,
                            borderColor: cProfit, // Using blue for previous month
                            backgroundColor: 'rgba(14, 165, 233, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
                        tooltip: {
                            callbacks: {
                                title: (items) => `Day ${items[0].label}`
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 } } }
                    }
                }
            });
        }

        // --- 7. Interactive Chart Dropdowns ---
        const timeframeSelect = document.getElementById('chart-timeframe-select');
        if (timeframeSelect) {
            timeframeSelect.onchange = (e) => {
                const days = parseInt(e.target.value);
                const slicedLabels = labels.slice(-days);
                const slicedIncome = incomeData.slice(-days);
                const slicedExpense = expenseData.slice(-days);
                const slicedProfit = profitData.slice(-days);

                if (incomeExpenseChart) {
                    incomeExpenseChart.data.labels = slicedLabels;
                    incomeExpenseChart.data.datasets[0].data = slicedIncome;
                    incomeExpenseChart.data.datasets[1].data = slicedExpense;
                    incomeExpenseChart.update();
                }

                if (profitGrowthChart) {
                    profitGrowthChart.data.labels = slicedLabels;
                    profitGrowthChart.data.datasets[0].data = slicedProfit;
                    profitGrowthChart.update();
                }

                if (incomeGrowthChart) {
                    incomeGrowthChart.data.labels = slicedLabels;
                    incomeGrowthChart.data.datasets[0].data = slicedIncome;
                    incomeGrowthChart.update();
                }

                if (expenseGrowthChart) {
                    expenseGrowthChart.data.labels = slicedLabels;
                    expenseGrowthChart.data.datasets[0].data = slicedExpense;
                    expenseGrowthChart.update();
                }
            };
            
            // Trigger it once to match current selection
            timeframeSelect.dispatchEvent(new Event('change'));
        }
    });
}

// Logic for Cash Calculator
async function initCalculator() {
    const tableBody = document.getElementById('cash-denomination-rows');
    const totalValDisplay = document.getElementById('cash-total-val-display');
    const totalNotesDisplay = document.getElementById('cash-total-notes-count');
    const btnReset = document.getElementById('btn-reset');
    const btnUseCash = document.getElementById('btn-use-cash');

    if (!tableBody) return;

    const denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    let calcDatePicker = null;

    const getCurrentDate = () => calcDatePicker ? calcDatePicker.value : null;

    const updateTotals = () => {
        let grandTotal = 0;
        let totalNotes = 0;
        const counts = {};

        const inputs = tableBody.querySelectorAll('input[data-denom]');
        inputs.forEach(input => {
            const denom = parseInt(input.dataset.denom);
            const count = parseInt(input.value) || 0;
            const subtotal = denom * count;

            const subtotalEl = input.closest('tr').querySelector('.subtotal');
            if (subtotalEl) {
                subtotalEl.innerText = formatCurrency(subtotal);
                subtotalEl.classList.toggle('text-slate-400', subtotal === 0);
                subtotalEl.classList.toggle('text-primary', subtotal > 0);
            }

            grandTotal += subtotal;
            totalNotes += count;
            counts[denom] = input.value;
        });

        if (totalValDisplay) totalValDisplay.innerText = formatCurrency(grandTotal);
        if (totalNotesDisplay) totalNotesDisplay.innerText = `${totalNotes} notes total`;

        // Save to Firestore by date
        const currentDate = getCurrentDate();
        if (currentDate) saveCashCalculator(counts, currentDate);
        localStorage.setItem('cash_calculator_counts', JSON.stringify(counts));
    };

    // --- Inject Date Picker into header ---
    const headerFlex = document.querySelector('header .flex');
    calcDatePicker = document.getElementById('calc-date-picker');
    if (!calcDatePicker && headerFlex) {
        const pickerWrapper = document.createElement('div');
        pickerWrapper.className = 'flex flex-col gap-1 min-w-[180px]';
        pickerWrapper.innerHTML = `
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Date</label>
            <input id="calc-date-picker" type="date"
                class="px-4 py-2.5 rounded-lg border border-primary/20 bg-white dark:bg-background-dark/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-semibold text-slate-700 dark:text-slate-200">
        `;
        const resetBtn = headerFlex.querySelector('#btn-reset');
        if (resetBtn) headerFlex.insertBefore(pickerWrapper, resetBtn);
        else headerFlex.appendChild(pickerWrapper);
        calcDatePicker = document.getElementById('calc-date-picker');
    }

    // Determine initial date: use Add Entry session date if coming from there, else today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const sessionData = sessionStorage.getItem('add_entry_form_data');
    let defaultDate = todayStr;
    if (sessionData) {
        try {
            const sd = JSON.parse(sessionData);
            if (sd['__entry_date__']) defaultDate = sd['__entry_date__'];
        } catch(e) {}
    }
    if (calcDatePicker) calcDatePicker.value = defaultDate;

    // Generate table rows with given counts
    const generateRows = (savedCounts) => {
        tableBody.innerHTML = '';
        denominations.forEach(denom => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-primary/5 transition-colors group';
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="size-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">₹</div>
                        <span class="font-semibold text-slate-700 dark:text-slate-300">${denom}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <input type="number" data-denom="${denom}" value="${savedCounts[denom] || ''}"
                        class="w-24 mx-auto block bg-slate-50 dark:bg-background-dark/40 border border-primary/10 px-3 py-2 rounded-lg text-center focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold" 
                        placeholder="0" min="0">
                </td>
                <td class="px-6 py-4 text-right">
                    <span class="subtotal font-mono font-bold text-slate-400 group-hover:text-primary transition-colors">₹0</span>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    };

    // Load and render data for a specific date
    const loadForDate = async (dateStr) => {
        let savedCounts = await loadCashCalculator(dateStr);
        delete savedCounts.date; // remove metadata field
        generateRows(savedCounts);
        // Re-attach event listener after regenerating rows
        tableBody.removeEventListener('input', updateTotals);
        tableBody.addEventListener('input', updateTotals);
        updateTotals();
    };

    // Initial load
    await loadForDate(defaultDate);

    // Date picker change
    if (calcDatePicker) {
        calcDatePicker.addEventListener('change', () => {
            loadForDate(calcDatePicker.value);
        });
    }

    if (btnReset) {
        btnReset.onclick = () => {
            tableBody.querySelectorAll('input[data-denom]').forEach(i => i.value = '');
            updateTotals();
        };
    }

    if (btnUseCash) {
        btnUseCash.onclick = () => {
            const totalText = totalValDisplay.innerText.replace(/[₹,]/g, '');
            const finalAmount = parseFloat(totalText);
            if (finalAmount > 0) {
                localStorage.setItem('temp_calculator_cash', finalAmount);
                window.location.href = 'add-entry-code.html';
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Amount',
                    text: 'Please calculate an amount greater than 0.',
                    confirmButtonColor: '#7f13ec'
                });
            }
        };
    }
}

// Logic for Settings Page
async function initSettings() {
    const isSettings = document.querySelector('h3') && document.querySelector('h3').innerText.includes('App Settings');
    if (!isSettings) return;

    const btnExport = document.getElementById('btn-export');
    const fileImport = document.getElementById('file-import');
    const btnImportTrigger = document.getElementById('btn-import-trigger');
    const btnClear = document.getElementById('btn-clear');

    // Export Logic
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const entries = await loadEntries();
            const credits = await loadCredits();
            const customers = await loadCustomers();

            if (entries.length === 0 && credits.length === 0 && customers.length === 0) {
                alert('No data to export.');
                return;
            }

            const backupData = { entries, credits, customers };
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bizperform_db_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Import Trigger
    if (btnImportTrigger && fileImport) {
        btnImportTrigger.addEventListener('click', () => {
            fileImport.click();
        });

        fileImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const json = JSON.parse(event.target.result);
                    // Support both old (array of entries) and new (object with entries/credits/customers) formats
                    let dataToImport = json;
                    if (Array.isArray(json)) {
                        dataToImport = { entries: json, credits: [], customers: [] };
                    }

                    if (dataToImport.entries || dataToImport.credits || dataToImport.customers) {
                        await bulkImport(dataToImport);
                        localStorage.clear(); // Clear migration flag
                        alert('Data successfully imported to database!');
                        window.location.reload();
                    } else {
                        alert('Invalid backup file format.');
                    }
                } catch (err) {
                    console.error('Import error:', err);
                    alert('Error reading or importing the backup file.');
                }
            };
            reader.readAsText(file);
        });
    }

    // Custom Modal Elements
    const wipeConfirmModal = document.getElementById('wipe-confirm-modal');
    const wipeSuccessModal = document.getElementById('wipe-success-modal');
    const btnCancelWipe = document.getElementById('btn-cancel-wipe');
    const btnConfirmWipe = document.getElementById('btn-confirm-wipe');
    const btnCloseSuccess = document.getElementById('btn-close-success');

    // Clear Data Logic
    if (btnClear) {
        btnClear.onclick = () => {
            if (wipeConfirmModal) wipeConfirmModal.classList.remove('hidden');
        };
    }

    if (btnCancelWipe) {
        btnCancelWipe.onclick = () => {
            if (wipeConfirmModal) wipeConfirmModal.classList.add('hidden');
        };
    }

    if (btnConfirmWipe) {
        btnConfirmWipe.onclick = async () => {
            btnConfirmWipe.disabled = true;
            btnConfirmWipe.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">sync</span> Wiping...';

            try {
                const result = await clearDatabase();
                if (result && result.success) {
                    localStorage.clear();
                    if (wipeConfirmModal) wipeConfirmModal.classList.add('hidden');
                    if (wipeSuccessModal) wipeSuccessModal.classList.remove('hidden');
                } else {
                    throw new Error(result ? result.error : 'Unknown error');
                }
            } catch (err) {
                console.error('Wipe error:', err);
                alert('Error wiping database: ' + err.message);
            } finally {
                btnConfirmWipe.disabled = false;
                btnConfirmWipe.innerHTML = 'Yes, Wipe Data';
            }
        };
    }

    const btnRepair = document.getElementById('btn-repair-data');
    if (btnRepair) {
        btnRepair.onclick = async () => {
            btnRepair.disabled = true;
            btnRepair.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">sync</span> Repairing...';
            
            try {
                const entries = await loadEntries();
                const batch = writeBatch(db);
                let count = 0;

                entries.forEach(e => {
                    const damages = parseFloat(e.details?.damages) || 0;
                    if (damages > 0) {
                        // If damages were added to expense, fix it
                        // Logic: If expense >= damages and user reported this exact symptom
                        // We deduct damages from expense
                        const currentExpense = parseFloat(e.expense) || 0;
                        if (currentExpense >= damages) {
                            const newExpense = currentExpense - damages;
                            batch.update(doc(db, 'entries', e.id.toString()), {
                                expense: newExpense,
                                net: (parseFloat(e.income) || 0) - newExpense
                            });
                            count++;
                        }
                    }
                });

                if (count > 0) {
                    await batch.commit();
                    alert(`Successfully repaired ${count} entries! ✅`);
                    window.location.reload();
                } else {
                    alert('No entries found that need repair.');
                }
            } catch (err) {
                console.error('Repair error:', err);
                alert('Repair failed: ' + err.message);
            } finally {
                btnRepair.disabled = false;
                btnRepair.innerHTML = 'Repair Calculations';
            }
        };
    }

    if (btnCloseSuccess) {
        btnCloseSuccess.onclick = () => {
            window.location.href = 'dashboard-code.html';
        };
    }

    // --- Bulk CSV Import Section ---
    const btnDownloadTemplate = document.getElementById('btn-download-template');
    const btnBulkImportTrigger = document.getElementById('btn-bulk-import-trigger');
    const fileBulkCsv = document.getElementById('file-bulk-csv');

    if (btnDownloadTemplate) {
        btnDownloadTemplate.addEventListener('click', () => {
            const headers = ['Date', 'Capital_Add', 'Cash', 'Online', 'Roinet', 'Jio', 'CRGB_BC', 'Credit', 'Pending', 'Damages', 'Expense', 'Withdrawal'];
            const example = ['2024-01-01', '0', '5000', '2000', '0', '0', '0', '500', '0', '0', '200', '1000'];
            
            const csvContent = "\ufeff" + [headers.join(','), example.join(',')].join('\n');
            const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
            
            const a = document.createElement('a');
            a.setAttribute("href", encodedUri);
            a.setAttribute("download", "BizPerform_Import_Template.csv");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    if (btnBulkImportTrigger && fileBulkCsv) {
        btnBulkImportTrigger.addEventListener('click', () => fileBulkCsv.click());

        fileBulkCsv.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const csvText = event.target.result;
                const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
                if (lines.length < 2) {
                    alert('CSV file is empty or missing data.');
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const entries = [];

                // Mapping configuration
                const fieldMap = {
                    'date': 'date',
                    'capital_add': 'capitalAdd',
                    'cash': 'cash',
                    'online': 'online',
                    'roinet': 'roinet',
                    'jio': 'jio',
                    'crgb_bc': 'go2sms',
                    'credit': 'credit',
                    'pending': 'pending',
                    'damages': 'damages',
                    'expense': 'expense',
                    'withdrawal': 'withdrawal',
                    'description': 'description',
                    'category': 'category'
                };

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((h, idx) => {
                        if (fieldMap[h]) row[fieldMap[h]] = values[idx];
                    });

                    if (!row.date) continue;

                    // Standardize date into YYYY-MM-DD
                    let finalDate = row.date;
                    if (finalDate.includes('/') || finalDate.includes('-')) {
                        const sep = finalDate.includes('/') ? '/' : '-';
                        const parts = finalDate.split(sep);
                        // Case 1: YYYY-MM-DD or YYYY-M-D
                        if (parts[0].length === 4) {
                            finalDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        } 
                        // Case 2: DD-MM-YYYY or D-M-YYYY
                        else if (parts.length === 3 && parts[2].length === 4) {
                            finalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    }

                    const details = {
                        cash: parseFloat(row.cash) || 0,
                        online: parseFloat(row.online) || 0,
                        roinet: parseFloat(row.roinet) || 0,
                        jio: parseFloat(row.jio) || 0,
                        go2sms: parseFloat(row.go2sms) || 0,
                        credit: parseFloat(row.credit) || 0,
                        pending: parseFloat(row.pending) || 0,
                        damages: parseFloat(row.damages) || 0,
                        withdrawal: parseFloat(row.withdrawal) || 0
                    };

                    const tcf = Object.values(details).reduce((a, b) => a + b, 0);
                    const capital = parseFloat(row.capitalAdd) || 0;
                    const expense = parseFloat(row.expense) || 0;
                    const withdrawal = parseFloat(row.withdrawal) || 0;

                    // Compute income and profit (Basic calculation for historical data)
                    // Note: True income calculation requires previous day closing, but we'll set raw values here.
                    // The dashboard refactored logic will re-calculate income correctly in the loop if we provide the base fields.
                    
                    entries.push({
                        id: Date.parse(finalDate) || Date.now() + i,
                        date: finalDate,
                        capitalAdd: capital,
                        details: details,
                        totalCashFlow: tcf,
                        expense: expense,
                        withdrawal: withdrawal,
                        description: row.description || "Bulk Import",
                        category: row.category || "Historical",
                        timestamp: Date.now()
                    });
                }

                if (entries.length > 0) {
                    btnBulkImportTrigger.disabled = true;
                    btnBulkImportTrigger.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">sync</span> Importing History...';
                    
                    try {
                        // Batch in chunks of 400 (Firestore limit is 500)
                        for (let i = 0; i < entries.length; i += 400) {
                            const chunk = entries.slice(i, i + 400);
                            const batch = writeBatch(db);
                            chunk.forEach(entry => {
                                batch.set(doc(db, 'entries', entry.id.toString()), entry, { merge: true });
                            });
                            await batch.commit();
                        }
                        alert(`Successfully imported ${entries.length} historical records! ✅`);
                        window.location.reload();
                    } catch (err) {
                        console.error('Bulk Import Error:', err);
                        alert('Failed to import data: ' + err.message);
                    } finally {
                        btnBulkImportTrigger.disabled = false;
                        btnBulkImportTrigger.innerHTML = '<span class="material-symbols-outlined">publish</span> Upload Historical CSV';
                    }
                }
            };
            reader.readAsText(file);
        });
    }
}

// Logic for Transactions Page
async function initTransactions() {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return; // Only runs on transactions-code.html

    const entries = await loadEntries();

    // Sort by date so newest is always at top. Secondary sort by ID for same-day entries.
    entries.sort((a, b) => {
        const d1 = new Date(a.date);
        const d2 = new Date(b.date);
        if (d1.getTime() !== d2.getTime()) return d2 - d1;
        return (b.id || 0) - (a.id || 0);
    });

    if (entries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="16" class="px-6 py-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50">No transactions recorded yet.</td></tr>`;
        return;
    }

    // Process from oldest to newest to calculate running balances properly
    // loadEntries returns newest first, so we reverse it
    const chronological = [...entries].reverse();

    let runningBalance = 0; // Removed hardcoded base balance
    const rowList = [];

    // Iterate and build each row
    chronological.forEach((e, index) => {
        // Safety extract details
        const details = e.details || {};
        const getVal = (key) => parseFloat(details[key]) || 0;

        const capitalAdd = parseFloat(e.capital) || parseFloat(e.capitalAdd) || 0;
        const cash = getVal('cash');
        const online = getVal('online');
        const roinet = getVal('roinet');
        const jio = getVal('jio');
        const go2sms = getVal('go2sms');
        const credit = getVal('credit');
        const pending = getVal('pending');
        const damages = getVal('damages');
        const deposit = getVal('deposit');

        const income = e.income || 0;
        const expense = e.expense || 0;
        const withdrawal = getVal('withdrawal') || parseFloat(e.withdrawal) || 0;

        // CSP Ledger Logic:
        // 1. Prev Closing Balance (Carryforward or Explicit historical Opening)
        const prevCls = (e.openingBalance !== undefined && e.openingBalance > 0) ? parseFloat(e.openingBalance) : runningBalance;
        
        // 2. Capital Add
        const capital = capitalAdd || 0;
        
        // 3. Opening Balance (Display Only) = Prev Closing + Capital Add
        const opnBalance = calculateOpeningBalance(prevCls, capital);
        
        // 4. Base Cash Flow
        const totalCashFlow = cash + online + roinet + jio + go2sms + credit + pending + damages - deposit;
        
        // Universal Gross Math Logic
        const displayTotal = totalCashFlow + expense;  
        const displayIncome = Math.max(0, displayTotal - opnBalance); 
        const displayProfit = displayIncome - expense; 
        const displayNet = displayTotal - expense; 
        const displayCls = displayNet - withdrawal;

        // Carryforward for NEXT day uses true closing
        runningBalance = displayCls;

        // Display values for the table template
        const displayPrevCls = prevCls;
        const displayCap = capital;
        const displayOpn = opnBalance;

        const dailyTotal = income; // Keep legacy variable names if used below, but update logic constants

        // Formatting helper
        const f = (num) => num === 0 ? `<span class="text-slate-300 dark:text-slate-600">0</span>` : formatCurrency(num);
        const fDate = (dString) => {
            const d = new Date(dString);
            return isNaN(d) ? dString : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-');
        };

        rowList.push(`
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-200 dark:border-slate-700/50 text-[10px]">
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-bold bg-slate-100/50 dark:bg-slate-800/50">#ID#</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-medium whitespace-nowrap">${fDate(e.date)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono italic text-slate-500">${f(displayPrevCls)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/10 font-mono text-blue-600">${f(displayCap)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono font-bold bg-slate-50 dark:bg-slate-800/50">${f(displayOpn)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-emerald-600 dark:text-emerald-400">${f(cash)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-emerald-600 dark:text-emerald-400">${f(online)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-emerald-600 dark:text-emerald-400">${f(roinet)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-emerald-600 dark:text-emerald-400">${f(jio)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-emerald-600 dark:text-emerald-400">${f(go2sms)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-amber-600 dark:text-amber-400">${f(credit)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-orange-600 dark:text-orange-400">${f(pending)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-rose-500 dark:text-rose-400">${f(damages)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-rose-600 dark:text-rose-400 font-bold italic">${f(deposit)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-primary bg-primary/5">${f(displayTotal)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-900/10">${f(displayIncome)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-rose-600 dark:text-rose-400">${f(expense)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-900/10">${f(displayProfit)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-emerald-700 dark:text-emerald-500">${f(displayNet)}</td>
                <td class="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700 font-mono text-purple-600 dark:text-purple-400">${f(withdrawal)}</td>
                <td class="px-2 py-1.5 font-mono font-bold bg-primary/10 text-primary border-l-2 border-primary/30">
                    <div>${f(displayCls)}</div>
                </td>
            </tr>
        `);
    });

    // Reverse the rows to show newest at top, and fix S.No (total_length - current_index)
    const finalHtml = rowList.reverse().map((row, i) => row.replace('#ID#', rowList.length - i)).join('');
    tableBody.innerHTML = finalHtml;

    // Attach CSV Download Logic
    const dlBtn = document.getElementById('download-csv-btn');
    if (dlBtn) {
        dlBtn.addEventListener('click', () => {
            const table = document.querySelector('table');
            if (!table) return;

            let csvContent = "";
            const rows = table.querySelectorAll('tr');

            rows.forEach((row) => {
                const rowData = [];
                // Get header cells or data cells
                const cols = row.querySelectorAll('th, td');
                cols.forEach((col) => {
                    // Extract text content and escape internal quotes
                    // Handle currency formats and clean up unnecessary line breaks/spaces
                    let text = col.innerText || col.textContent;
                    // Remove rupee symbol and commas for clean numeric export if applicable
                    text = text.replace(/₹/g, '').replace(/\n/g, ' ').trim();
                    // Wrap every cell in quotes to handle commas natively
                    text = text.replace(/"/g, '""');
                    rowData.push('"' + text + '"');
                });
                csvContent += rowData.join(",") + "\n";
            });

            // Trigger file download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.setAttribute("download", "transactions_ledger.csv");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }
}

// Logic for Credit Ledger Page
async function initCreditLedger() {
    const addCustomerForm = document.getElementById('add-customer-form');
    if (!addCustomerForm) return;

    const addTransactionForm = document.getElementById('credit-transaction-form');
    const addTransactionSection = document.getElementById('add-transaction-section');
    const backBtn = document.getElementById('back-to-ledger');
    const tableBody = document.getElementById('credit-table-body');
    const ledgerHeader = document.getElementById('ledger-header');
    const historyHeader = document.getElementById('history-header');
    const ledgerTitle = document.getElementById('ledger-title');
    const addCustomerBtn = document.getElementById('add-customer-btn');
    const addCustomerModal = document.getElementById('add-customer-modal');

    const summaryTotal = document.getElementById('summary-total-credit');
    const summaryReceived = document.getElementById('summary-received');
    const summaryPending = document.getElementById('summary-pending');
    const searchInput = document.getElementById('customer-search');

    let currentView = 'ledger'; // 'ledger' or 'details'
    let activeCustomerId = null;

    async function renderView() {
        console.log("Rendering Credit Ledger View...");
        try {
            const customers = await loadCustomers();
            const credits = await loadCredits();

            let displayTotal = 0;
            let displayReceived = 0;
            let displayPending = 0;

            const nowMs = Date.now();
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const thirtyDaysAgoMs = nowMs - thirtyDaysMs;
            const sixtyDaysAgoMs = nowMs - (2 * thirtyDaysMs);

            let currPeriodCredit = 0;
            let prevPeriodCredit = 0;
            let currPeriodReceived = 0;
            let prevPeriodReceived = 0;
            let totalCreditUpToThirtyDaysAgo = 0;
            let totalPaidUpToThirtyDaysAgo = 0;

            credits.forEach(cr => {
                const crDateMs = new Date(cr.date).getTime();
                const amt = parseFloat(cr.amount || 0);
                const pd = parseFloat(cr.paid || 0);

                if (!isNaN(crDateMs)) {
                    if (crDateMs >= thirtyDaysAgoMs) {
                        currPeriodCredit += amt;
                        currPeriodReceived += pd;
                    } else if (crDateMs >= sixtyDaysAgoMs && crDateMs < thirtyDaysAgoMs) {
                        prevPeriodCredit += amt;
                        prevPeriodReceived += pd;
                    }

                    if (crDateMs < thirtyDaysAgoMs) {
                        totalCreditUpToThirtyDaysAgo += amt;
                        totalPaidUpToThirtyDaysAgo += pd;
                    }
                }
            });

            tableBody.innerHTML = '';

            if (currentView === 'ledger') {
                if (ledgerTitle) ledgerTitle.innerText = "Ledger Details";
                if (backBtn) backBtn.classList.add('hidden');
                if (addTransactionSection) addTransactionSection.classList.add('hidden');
                if (addCustomerBtn) addCustomerBtn.classList.remove('hidden');
                if (ledgerHeader) ledgerHeader.classList.remove('hidden');
                if (historyHeader) historyHeader.classList.add('hidden');

                const getSetting = window.getAppSetting || ((k, d) => localStorage.getItem(k) !== 'false');
                const showActions = getSetting('CREDIT_LEDGER_SHOW_ACTIONS', true);
                const actionTh = document.getElementById('ledger-action-th');
                if (actionTh) {
                    if (showActions) actionTh.classList.remove('hidden');
                    else actionTh.classList.add('hidden');
                }
                const actionColClass = showActions ? '' : 'hidden';

                const tableContainer = document.getElementById('table-card-container');
                if (tableContainer) tableContainer.className = "lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-primary/10 shadow-sm overflow-hidden flex flex-col";
                const summarySidebar = document.getElementById('customer-summary-sidebar');
                if (summarySidebar) summarySidebar.classList.add('hidden');

                const queryStr = searchInput ? searchInput.value.toLowerCase() : '';
                const filteredCustomers = customers.filter(c => (c.name || '').toLowerCase().includes(queryStr));

                if (filteredCustomers.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-slate-500 font-medium">No customers found. Add one above!</td></tr>`;
                } else {
                    filteredCustomers.forEach((cust, index) => {
                        const custCredits = credits.filter(cr => String(cr.customerId) === String(cust.id));
                        let custTotal = 0;
                        let custPaid = 0;
                        custCredits.forEach(cr => {
                            custTotal += parseFloat(cr.amount || 0);
                            custPaid += parseFloat(cr.paid || 0);
                        });
                        const custBal = custTotal - custPaid;

                        displayTotal += custTotal;
                        displayReceived += custPaid;
                        displayPending += custBal;

                        const status = custBal <= 0 && custTotal > 0 ? 'PAID' : (custPaid > 0 ? 'PARTIAL' : 'PENDING');
                        const statusClass = status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                            (status === 'PARTIAL' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20');

                        const custNameStr = cust.name || 'Unknown';
                        const initial = custNameStr.split(' ').map(n => n[0] || '').join('').toUpperCase().substring(0, 2);
                        const phoneDisplay = cust.phone ? `<span class="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">${safeEscape(cust.phone)}</span>` : `<span class="text-sm font-medium italic text-slate-400">Not Added</span>`;

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer group border-b border-slate-100 dark:border-slate-800/50";
                        tr.onclick = (e) => {
                            if (e.target.closest('button')) return;
                            showCustomerDetails(cust.id);
                        };

                        tr.innerHTML = `
                            <td class="px-4 py-2.5 align-middle text-sm font-bold text-slate-500 w-14">${index + 1}</td>
                            <td class="px-4 py-2.5 align-middle">
                                <div class="flex items-center gap-3">
                                    <div class="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs shadow-inner shrink-0">${initial}</div>
                                    <span class="text-sm font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">${safeEscape(custNameStr)}</span>
                                </div>
                            </td>
                            <td class="px-4 py-2.5 align-middle whitespace-nowrap">${phoneDisplay}</td>
                            <td class="px-4 py-2.5 align-middle text-sm font-bold text-right whitespace-nowrap ${custBal > 0 ? 'text-orange-600 dark:text-orange-400 font-black' : 'text-emerald-600 dark:text-emerald-400'}">${formatCurrency(custBal)}</td>
                            <td class="px-4 py-2.5 align-middle text-sm font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">${formatCurrency(custPaid)}</td>
                            <td class="px-4 py-2.5 align-middle text-sm font-black text-slate-800 dark:text-white text-right whitespace-nowrap">${formatCurrency(custTotal)}</td>
                            <td class="px-4 py-2.5 align-middle text-center whitespace-nowrap">
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${statusClass}">${status}</span>
                            </td>
                            <td class="px-4 py-2.5 align-middle text-right action-col ${actionColClass}">
                                <div class="flex gap-1 justify-end whitespace-nowrap items-center">
                                    <button onclick="event.stopPropagation(); showCustomerDetails('${cust.id}')" class="p-1.5 text-primary hover:bg-primary/10 rounded-xl transition-all" title="View Details">
                                        <span class="material-symbols-outlined text-base">visibility</span>
                                    </button>
                                    <button onclick="event.stopPropagation(); openEditCustomerModal('${cust.id}', '${safeEscape(custNameStr)}', '${safeEscape(cust.phone || '')}')" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all" title="Edit Contact">
                                        <span class="material-symbols-outlined text-base">edit</span>
                                    </button>
                                    <button onclick="event.stopPropagation(); deleteLedgerCustomer('${cust.id}', ${custBal})" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all" title="Delete Customer">
                                        <span class="material-symbols-outlined text-base">delete</span>
                                    </button>
                                </div>
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
            } else {
                const cust = customers.find(c => String(c.id) === String(activeCustomerId));
                if (!cust) {
                    showMainLedger();
                    return;
                }

                const custName = cust.name || 'Unknown';
                if (ledgerTitle) ledgerTitle.innerText = custName;
                if (backBtn) backBtn.classList.remove('hidden');
                if (addTransactionSection) addTransactionSection.classList.add('hidden');
                if (addCustomerBtn) addCustomerBtn.classList.add('hidden');
                if (ledgerHeader) ledgerHeader.classList.add('hidden');
                if (historyHeader) historyHeader.classList.remove('hidden');

                const tableContainer = document.getElementById('table-card-container');
                if (tableContainer) tableContainer.className = "lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-primary/10 shadow-sm overflow-hidden flex flex-col";
                const summarySidebar = document.getElementById('customer-summary-sidebar');
                if (summarySidebar) summarySidebar.classList.remove('hidden');

                const custCredits = credits.filter(cr => String(cr.customerId) === String(activeCustomerId));
                custCredits.sort((a, b) => {
                    const d1 = new Date(a.date);
                    const d2 = new Date(b.date);
                    if (d1.getTime() !== d2.getTime()) return d2 - d1;
                    return (b.id || 0) - (a.id || 0);
                });

                let custTotalCredit = 0;
                let custTotalPaid = 0;
                custCredits.forEach(cr => {
                    custTotalCredit += parseFloat(cr.amount || 0);
                    custTotalPaid += parseFloat(cr.paid || 0);
                });
                const custBalanceDue = custTotalCredit - custTotalPaid;
                const statusStr = custBalanceDue <= 0 && custTotalCredit > 0 ? 'PAID' : (custTotalPaid > 0 ? 'PARTIAL' : 'PENDING');
                const statusBadgeClass = statusStr === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : (statusStr === 'PARTIAL' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20');

                const initialStr = custName.split(' ').map(n => n[0] || '').join('').toUpperCase().substring(0, 2);
                const summaryAvatar = document.getElementById('summary-avatar');
                const summaryName = document.getElementById('summary-name');
                const summaryPhone = document.getElementById('summary-phone');
                const summaryBalance = document.getElementById('summary-balance');
                const summaryStatusBadge = document.getElementById('summary-status-badge');
                const summaryProgressPct = document.getElementById('summary-progress-pct');
                const summaryProgressBar = document.getElementById('summary-progress-bar');
                const summaryStatTotal = document.getElementById('summary-stat-total');
                const summaryStatPaid = document.getElementById('summary-stat-paid');
                const summaryCount = document.getElementById('summary-count');
                const summaryLastDate = document.getElementById('summary-last-date');

                if (summaryAvatar) summaryAvatar.innerText = initialStr;
                if (summaryName) summaryName.innerText = custName;
                if (summaryPhone) summaryPhone.innerText = cust.phone ? "+91 " + cust.phone : "No Contact Added";
                if (summaryBalance) summaryBalance.innerText = formatCurrency(custBalanceDue);
                if (summaryStatusBadge) {
                    summaryStatusBadge.innerText = statusStr;
                    summaryStatusBadge.className = `mt-2 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm ${statusBadgeClass}`;
                }
                const progressPctVal = custTotalCredit > 0 ? Math.min(100, Math.round((custTotalPaid / custTotalCredit) * 100)) : 0;
                if (summaryProgressPct) summaryProgressPct.innerText = `${progressPctVal}%`;
                if (summaryProgressBar) summaryProgressBar.style.width = `${progressPctVal}%`;
                if (summaryStatTotal) summaryStatTotal.innerText = formatCurrency(custTotalCredit);
                if (summaryStatPaid) summaryStatPaid.innerText = formatCurrency(custTotalPaid);
                if (summaryCount) summaryCount.innerText = custCredits.length;
                if (summaryLastDate) {
                    summaryLastDate.innerText = custCredits.length > 0 ? formatStandardDate(custCredits[0].date) : '-';
                }

                if (custCredits.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500 font-medium">No transactions yet for this customer.</td></tr>`;
                } else {
                    custCredits.forEach((cr, index) => {
                        const creditAmt = parseFloat(cr.amount || 0);
                        const paidAmt = parseFloat(cr.paid || 0);

                        displayTotal += creditAmt;
                        displayReceived += paidAmt;

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors py-1.5 border-b border-slate-100 dark:border-slate-800/50";
                        tr.innerHTML = `
                            <td class="px-4 py-2.5 align-middle text-sm font-bold text-slate-500 w-14">${index + 1}</td>
                            <td class="px-4 py-2.5 align-middle text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">${formatStandardDate(cr.date)}</td>
                            <td class="px-4 py-2.5 align-middle text-sm font-bold text-right text-orange-600 dark:text-orange-400 whitespace-nowrap">${creditAmt > 0 ? formatCurrency(creditAmt) : '-'}</td>
                            <td class="px-4 py-2.5 align-middle text-sm font-bold text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${paidAmt > 0 ? formatCurrency(paidAmt) : '-'}</td>
                            <td class="px-4 py-2.5 align-middle text-sm text-slate-600 dark:text-slate-300 font-medium italic">${safeEscape(cr.note || '')}</td>
                        `;
                        tableBody.appendChild(tr);
                    });
                    displayPending = displayTotal - displayReceived;
                }
            }

            if (summaryTotal) summaryTotal.innerText = formatCurrency(displayTotal);
            if (summaryReceived) summaryReceived.innerText = formatCurrency(displayReceived);
            if (summaryPending) {
                summaryPending.innerText = formatCurrency(displayPending);
                localStorage.setItem('CREDIT_LEDGER_TOTAL_PENDING', displayPending);
            }

            const currPendingVal = displayTotal - displayReceived;
            const prevPendingVal = totalCreditUpToThirtyDaysAgo - totalPaidUpToThirtyDaysAgo;

            const updateTrendEl = (elId, currVal, prevVal) => {
                const el = document.getElementById(elId);
                if (!el) return;
                if (prevVal <= 0) {
                    el.style.display = 'none';
                    el.innerHTML = '';
                } else {
                    el.style.display = 'flex';
                    const pct = ((currVal - prevVal) / prevVal) * 100;
                    if (pct > 0) {
                        el.className = 'text-emerald-500 font-bold text-xs flex items-center bg-emerald-500/10 px-2.5 py-0.5 rounded-full shadow-sm tracking-wide';
                        el.innerHTML = '<span class="material-symbols-outlined text-xs mr-0.5 font-bold">arrow_upward</span>+' + pct.toFixed(1) + '%';
                    } else if (pct < 0) {
                        el.className = 'text-rose-500 font-bold text-xs flex items-center bg-rose-500/10 px-2.5 py-0.5 rounded-full shadow-sm tracking-wide';
                        el.innerHTML = '<span class="material-symbols-outlined text-xs mr-0.5 font-bold">arrow_downward</span>' + pct.toFixed(1) + '%';
                    } else {
                        el.className = 'text-slate-500 font-bold text-xs flex items-center bg-slate-500/10 px-2.5 py-0.5 rounded-full shadow-sm tracking-wide';
                        el.innerHTML = '0%';
                    }
                }
            };

            updateTrendEl('trend-total-credit', currPeriodCredit, prevPeriodCredit);
            updateTrendEl('trend-received', currPeriodReceived, prevPeriodReceived);
            updateTrendEl('trend-pending', currPendingVal, prevPendingVal);

            const pagInfo = document.getElementById('pagination-info');
            if (pagInfo) {
                pagInfo.innerText = currentView === 'ledger' ?
                    `Showing ${customers.length} customers` :
                    `Showing transactions for customer`;
            }
        } catch (err) {
            console.error("renderView error:", err);
        }
    }

    // Success Toast
    function showSuccessToast(message) {
        let toast = document.getElementById('cl-success-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cl-success-toast';
            toast.style.cssText = `
                position: fixed; top: 24px; right: 24px; z-index: 9999;
                display: flex; align-items: center; gap: 12px;
                background: #fff; border: 1px solid #e2e8f0;
                border-left: 4px solid #22c55e;
                padding: 14px 20px; border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.12);
                font-family: Inter, sans-serif; font-size: 14px; font-weight: 600;
                color: #1e293b; min-width: 260px;
                transform: translateX(120%); transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `
            <span style="color:#22c55e;font-size:22px;line-height:1" class="material-symbols-outlined">check_circle</span>
            <span>${message}</span>
        `;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
        });
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
        }, 2500);
    }

    function showErrorToast(message) {
        let toast = document.getElementById('cl-error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cl-error-toast';
            toast.style.cssText = `
                position: fixed; top: 24px; right: 24px; z-index: 9999;
                display: flex; align-items: center; gap: 12px;
                background: #fff; border: 1px solid #e2e8f0;
                border-left: 4px solid #ef4444;
                padding: 14px 20px; border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.12);
                font-family: Inter, sans-serif; font-size: 14px; font-weight: 600;
                color: #1e293b; min-width: 260px;
                transform: translateX(120%); transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `
            <span style="color:#ef4444;font-size:22px;line-height:1" class="material-symbols-outlined">error</span>
            <span>${message}</span>
        `;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
        });
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
        }, 2500);
    }

    // Modal Handlers
    window.openAddCustomerModal = () => {
        if (addCustomerModal) addCustomerModal.classList.remove('hidden');
        const input = document.getElementById('new-customer-name');
        if (input) input.focus();
    };

    window.closeAddCustomerModal = () => {
        if (addCustomerModal) addCustomerModal.classList.add('hidden');
        if (addCustomerForm) addCustomerForm.reset();
    };

    window.openEditCustomerModal = (id, name, phone) => {
        const modal = document.getElementById('edit-customer-modal');
        const idInput = document.getElementById('edit-customer-id');
        const nameInput = document.getElementById('edit-customer-name');
        const phoneInput = document.getElementById('edit-customer-phone');
        const errorEl = document.getElementById('edit-phone-error');

        if (modal) modal.classList.remove('hidden');
        if (idInput) idInput.value = id;
        if (nameInput) nameInput.value = name;
        if (phoneInput) phoneInput.value = phone || '';
        if (errorEl) errorEl.classList.add('hidden');
    };

    window.closeEditCustomerModal = () => {
        const modal = document.getElementById('edit-customer-modal');
        if (modal) modal.classList.add('hidden');
    };

    const editCustomerForm = document.getElementById('edit-customer-form');
    if (editCustomerForm) {
        editCustomerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-customer-id')?.value;
            const phone = document.getElementById('edit-customer-phone')?.value?.trim() || '';
            const errorEl = document.getElementById('edit-phone-error');

            if (!/^\d{10}$/.test(phone)) {
                if (errorEl) errorEl.classList.remove('hidden');
                return;
            }
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const customers = await loadCustomers();
                const existingCust = customers.find(c => String(c.id) === String(id) || String(c.firebaseId) === String(id));
                if (existingCust) {
                    existingCust.phone = phone;
                    const res = await saveCustomer(existingCust);
                    if (res) {
                        closeEditCustomerModal();
                        showSuccessToast('Contact number saved successfully! ✅');
                        await renderView();
                    }
                } else {
                    showErrorToast('Customer record not found.');
                }
            } catch (err) {
                console.error("Save contact error:", err);
                showErrorToast('Failed to save contact number.');
            }
        });
    }

    // Handlers
    addCustomerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-customer-name');
        const phoneInput = document.getElementById('new-customer-phone');
        const rawName = input?.value || '';
        const rawPhone = phoneInput?.value?.trim() || '';
        const normalizedName = rawName.replace(/\s+/g, ' ').trim();

        if (rawPhone && !/^\d{10}$/.test(rawPhone)) {
            document.getElementById('add-phone-error')?.classList.remove('hidden');
            return;
        }
        document.getElementById('add-phone-error')?.classList.add('hidden');

        if (normalizedName) {
            try {
                const existingCustomers = await loadCustomers();
                const isDuplicate = existingCustomers.some(c => c.name && c.name.replace(/\s+/g, ' ').trim().toLowerCase() === normalizedName.toLowerCase() && String(c.id) !== String(activeCustomerId));
                if (isDuplicate) {
                    showErrorToast('Customer already exists in Credit Ledger.');
                    return;
                }
                const res = await saveCustomer({ id: Date.now(), name: normalizedName, phone: rawPhone });
                if (res) {
                    if (typeof closeAddCustomerModal === 'function') closeAddCustomerModal();
                    else addCustomerForm.reset();
                    showSuccessToast('Customer added successfully! 🎉');
                    await renderView();
                }
            } catch (err) {
                console.error("Add customer error:", err);
                showErrorToast(err.message);
            }
        }
    });

    if (addTransactionForm) {
        addTransactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const amtVal = parseFloat(document.getElementById('trans-amount').value) || 0;
                const credit = {
                    id: Date.now(),
                    customerId: activeCustomerId,
                    amount: amtVal,
                    paid: 0,
                    type: document.getElementById('trans-type').value,
                    date: document.getElementById('trans-date').value,
                    note: document.getElementById('trans-note').value
                };

                if (credit.type === 'payment') {
                    credit.paid = credit.amount;
                    credit.amount = 0;
                }

                const rawDate = new Date(credit.date);
                credit.date = isNaN(rawDate) ? credit.date : rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                if (credit.amount > 0 || credit.paid > 0) {
                    const res = await saveCredit(credit);
                    if (res) {
                        addTransactionForm.reset();
                        const dateInput = document.getElementById('trans-date');
                        if (dateInput) dateInput.valueAsDate = new Date();
                        showSuccessToast('Transaction saved successfully! ✅');
                        await renderView();
                    }
                }
            } catch (err) {
                console.error("Credit save error:", err);
                alert("Error: " + err.message);
            }
        });
    }

    window.showCustomerDetails = async (id) => {
        currentView = 'details';
        activeCustomerId = id;
        const dateInput = document.getElementById('trans-date');
        if (dateInput) dateInput.valueAsDate = new Date();
        await renderView();
    };

    window.showMainLedger = async () => {
        currentView = 'ledger';
        activeCustomerId = null;
        await renderView();
    };

    // Delete Modal Elements
    const deleteModal = document.getElementById('delete-confirm-modal');
    const deleteModalTitle = document.getElementById('delete-modal-title');
    const deleteModalDesc = document.getElementById('delete-modal-description');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    let deleteId = null;
    let deleteType = null; // 'customer' or 'transaction'

    function showDeleteBlockedModal() {
        let modal = document.getElementById('delete-blocked-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'delete-blocked-modal';
            modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn';
            modal.innerHTML = `
                <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scaleUp">
                    <div class="p-6 bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 flex items-start gap-4">
                        <div class="size-10 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            <span class="material-symbols-outlined text-2xl font-bold">warning</span>
                        </div>
                        <div class="space-y-1.5 flex-1">
                            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-snug font-inter">Action Blocked</h3>
                            <p class="text-sm text-rose-700 dark:text-rose-300 font-medium leading-relaxed font-inter">
                                Customer delete nahi kiya ja sakta.<br>
                                Pehle Daily TXN page me credit received entry karke due balance clear karein.
                            </p>
                        </div>
                    </div>
                    <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end border-t border-slate-100 dark:border-slate-800">
                        <button onclick="document.getElementById('delete-blocked-modal').classList.add('hidden')" class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-sm font-bold rounded-xl transition-all shadow-sm">
                            Understood
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            modal.classList.remove('hidden');
        }
    }

    window.deleteLedgerCustomer = (id, balanceDue = 0) => {
        if (balanceDue > 0.01) {
            showDeleteBlockedModal();
            return;
        }
        deleteId = id;
        deleteType = 'customer';
        if (deleteModalTitle) deleteModalTitle.innerText = "Delete Customer?";
        if (deleteModalDesc) deleteModalDesc.innerText = "Are you sure you want to delete this customer? This will also remove all their credit and payment transactions. This action cannot be undone.";
        if (deleteModal) deleteModal.classList.remove('hidden');
    };

    window.deleteLedgerCredit = (id) => {
        deleteId = id;
        deleteType = 'transaction';
        if (deleteModalTitle) deleteModalTitle.innerText = "Delete Transaction?";
        if (deleteModalDesc) deleteModalDesc.innerText = "Are you sure you want to delete this transaction from the ledger? This action cannot be undone.";
        if (deleteModal) deleteModal.classList.remove('hidden');
    };

    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = async () => {
            if (deleteId && deleteType) {
                const performDelete = async () => {
                    confirmDeleteBtn.disabled = true;
                    if (cancelDeleteBtn) cancelDeleteBtn.disabled = true;
                    const originalText = confirmDeleteBtn.innerHTML;
                    confirmDeleteBtn.innerHTML = '<div class="flex items-center justify-center gap-2"><span class="material-symbols-outlined animate-spin text-lg">sync</span><span>Deleting...</span></div>';
                    
                    try {
                        if (deleteType === 'customer') {
                            await deleteCustomer(deleteId);
                            showSuccessToast('Customer deleted successfully. 🗑️');
                        } else {
                            await deleteCredit(deleteId);
                            showSuccessToast('Transaction deleted successfully. ✅');
                        }
                        
                        if (deleteModal) deleteModal.classList.add('hidden');
                        await renderView();
                    } catch (err) {
                        console.error("Delete error:", err);
                        const errorModal = document.createElement('div');
                        errorModal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn';
                        errorModal.innerHTML = `
                            <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scaleUp p-8 text-center">
                                <div class="size-16 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-6">
                                    <span class="material-symbols-outlined text-4xl">error</span>
                                </div>
                                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Deletion Failed</h3>
                                <p class="text-sm text-slate-500 font-medium mb-8">An error occurred while trying to delete.</p>
                                <div class="flex items-center gap-3">
                                    <button class="cancel-err-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
                                    <button class="retry-err-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition-all">Retry</button>
                                </div>
                            </div>
                        `;
                        document.body.appendChild(errorModal);
                        errorModal.querySelector('.cancel-err-btn').onclick = () => {
                            errorModal.remove();
                            if (deleteModal) deleteModal.classList.add('hidden');
                            deleteId = null;
                            deleteType = null;
                        };
                        errorModal.querySelector('.retry-err-btn').onclick = () => {
                            errorModal.remove();
                            performDelete();
                        };
                    } finally {
                        confirmDeleteBtn.disabled = false;
                        if (cancelDeleteBtn) cancelDeleteBtn.disabled = false;
                        confirmDeleteBtn.innerHTML = originalText;
                        if (deleteModal && deleteModal.classList.contains('hidden')) {
                            deleteId = null;
                            deleteType = null;
                        }
                    }
                };
                performDelete();
            }
        };
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = () => {
            if (deleteModal) deleteModal.classList.add('hidden');
            deleteId = null;
            deleteType = null;
        };
    }

    if (searchInput) {
        searchInput.addEventListener('input', renderView);
    }

    renderView();
}

window.goToCashCalculator = () => {
    const form = document.getElementById('add-entry-form');
    const datePicker = document.getElementById('entry-date-picker');
    if (form) {
        const formData = {};
        new FormData(form).forEach((value, key) => formData[key] = value);
        // Also save the date since date picker is outside the <form> tag
        if (datePicker) formData['__entry_date__'] = datePicker.value;
        sessionStorage.setItem('add_entry_form_data', JSON.stringify(formData));
    }
    window.location.href = 'cash-calculator-code.html';
};

window.goToDamagesToSelect = () => {
    const form = document.getElementById('add-entry-form');
    const datePicker = document.getElementById('entry-date-picker');
    if (form) {
        const formData = {};
        new FormData(form).forEach((value, key) => formData[key] = value);
        // Also save the date since date picker is outside the <form> tag
        if (datePicker) formData['__entry_date__'] = datePicker.value;
        sessionStorage.setItem('add_entry_form_data', JSON.stringify(formData));
    }
    window.location.href = 'damaged-currency-code.html';
};

window.useTotalDamages = (amount) => {
    localStorage.setItem('selected_damages_transfer', amount);
    window.location.href = 'add-entry-code.html';
};

async function initDamagedCurrency() {
    const tableBody = document.getElementById('damaged-denomination-rows');
    if (!tableBody) return;

    // Clear any existing rows to prevent duplication if called twice
    tableBody.innerHTML = '';

    const denominations = [500, 200, 100, 50, 20, 10];
    const totalDisplay = document.getElementById('damaged-total-val-display');

    const updateTotals = () => {
        let grandTotal = 0;
        const counts = {};
        denominations.forEach(d => {
            const countInput = document.getElementById(`count-${d}`);
            const count = parseInt(countInput.value) || 0;
            const value = count * d;
            document.getElementById(`val-${d}`).innerText = formatCurrency(value);
            grandTotal += value;
            counts[d] = countInput.value;
        });
        totalDisplay.innerText = formatCurrency(grandTotal);

        // Save state to Firebase
        saveDamagedCurrency(counts);
        // Also keep local storage as backup/fallback
        localStorage.setItem('damaged_currency_counts', JSON.stringify(counts));
    };

    // Restore previous state from Firebase (with localStorage fallback)
    let savedCounts = await loadDamagedCurrency();
    if (Object.keys(savedCounts).length === 0) {
        savedCounts = JSON.parse(localStorage.getItem('damaged_currency_counts') || '{}');
    }

    denominations.forEach(d => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="size-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">₹</div>
                    <span class="text-sm font-semibold">${d}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <input type="number" id="count-${d}" value="${savedCounts[d] || ''}" class="w-24 px-3 py-2 text-center rounded-lg border border-primary/10 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold" placeholder="0">
            </td>
            <td id="val-${d}" class="px-6 py-4 text-sm font-bold text-right text-slate-700 dark:text-slate-300">₹0</td>
        `;
        tableBody.appendChild(tr);

        const input = tr.querySelector('input');
        input.addEventListener('input', updateTotals);
    });

    window.transferTotal = () => {
        const totalText = totalDisplay.innerText;
        const total = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;
        if (total > 0) {
            window.useTotalDamages(total);
        } else {
            if (confirm('The total is ₹0. Transfer this as clear?')) {
                window.useTotalDamages(0);
            }
        }
    };

    // Initial calculation
    updateTotals();
}

// Sidebar Toggle Logic removed in favor of CSS Hover Implementation

// Logic for Reports Page
async function initReports() {
    const reportContainer = document.getElementById('tab-overall');
    if (!reportContainer) return;
    const tableBody = document.getElementById('reports-table-body'); // Still kept as null if missing

    const tabs = document.querySelectorAll('.filter-tab');
    const searchInput = document.getElementById('report-search');
    const dateInput = document.getElementById('report-date');
    const monthSelect = document.getElementById('report-month');
    const yearSelect = document.getElementById('report-year');
    const btnApply = document.getElementById('btn-apply-filters');
    const countBadge = document.getElementById('entries-count-badge');

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const navDisplay = document.getElementById('nav-display-label');
    const navLabelTop = document.getElementById('nav-label-top');

    const containers = {
        date: document.getElementById('filter-date-container'),
        month: document.getElementById('filter-month-container'),
        year: document.getElementById('filter-year-container')
    };

    let currentMode = 'overall';

    const getFinancialYear = (d) => {
        if (isNaN(d)) return null;
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        if (month >= 4) {
            return `FY ${year}-${(year + 1).toString().slice(-2)}`;
        } else {
            return `FY ${year - 1}-${year.toString().slice(-2)}`;
        }
    };

    // Populate Filters
    async function populateFilters() {
        const entries = await loadEntries();
        if (entries.length === 0) return;

        // Default date to today
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Month options
        const months = [...new Set(entries.map(e => {
            const d = new Date(e.date);
            if (isNaN(d)) return null;
            return d.toLocaleString('default', { month: 'long', year: 'numeric' });
        }))].filter(Boolean).sort((a, b) => new Date(b) - new Date(a));

        if (monthSelect && months.length > 0) {
            monthSelect.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
        }

        // Financial Year options
        const fySet = new Set();
        entries.forEach(e => {
            const d = new Date(e.date);
            const fy = getFinancialYear(d);
            if (fy) fySet.add(fy);
        });
        const years = [...fySet].sort((a, b) => b.localeCompare(a));

        if (yearSelect && years.length > 0) {
            yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        }
    }

    function updateUI() {
        tabs.forEach(tab => {
            const isActive = tab.dataset.mode === currentMode;
            tab.classList.toggle('bg-primary', isActive);
            tab.classList.toggle('text-white', isActive);
            tab.classList.remove('text-slate-500');
            tab.classList.remove('hover:text-primary');
            
            if (!isActive) {
                tab.classList.add('text-slate-500');
                tab.classList.add('hover:text-primary');
            }
        });

        // Show/hide containers
        Object.keys(containers).forEach(mode => {
            if (containers[mode]) {
                containers[mode].classList.toggle('hidden', mode !== currentMode);
            }
        });

        // Toggle Nav Bar State
        if (currentMode === 'overall') {
            btnPrev?.classList.add('opacity-30', 'pointer-events-none');
            btnNext?.classList.add('opacity-30', 'pointer-events-none');
            if (navLabelTop) navLabelTop.innerText = 'Analysis Scope';
            if (navDisplay) navDisplay.innerText = 'All Time Records';
        } else {
            btnPrev?.classList.remove('opacity-30', 'pointer-events-none');
            btnNext?.classList.remove('opacity-30', 'pointer-events-none');
            if (navLabelTop) navLabelTop.innerText = `Viewing ${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}`;
            updateNavLabel();
        }
    }

    function updateNavLabel() {
        if (navDisplay) {
            if (currentMode === 'date') {
                const d = new Date(dateInput?.value);
                navDisplay.innerText = isNaN(d) ? 'Select Date' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
            } else if (currentMode === 'month') {
                navDisplay.innerText = monthSelect?.value || 'Select Month';
            } else if (currentMode === 'year') {
                navDisplay.innerText = yearSelect?.value || 'Select Year';
            }
        }
    }

    tabs.forEach(tab => {
        tab.onclick = () => {
            currentMode = tab.dataset.mode;
            updateUI();
            renderReport();
        };
    });

    // Navigation Logic
    if (btnPrev) btnPrev.onclick = () => navigate(-1);
    if (btnNext) btnNext.onclick = () => navigate(1);

    function navigate(direction) {
        if (currentMode === 'date' && dateInput) {
            const d = new Date(dateInput.value);
            d.setDate(d.getDate() + direction);
            dateInput.value = d.toISOString().split('T')[0];
        } else if (currentMode === 'month' && monthSelect) {
            const idx = monthSelect.selectedIndex;
            const nextIdx = idx - direction; // Months are usually desc, so -direction to go "next/prev" logically
            if (nextIdx >= 0 && nextIdx < monthSelect.options.length) {
                monthSelect.selectedIndex = nextIdx;
            }
        } else if (currentMode === 'year' && yearSelect) {
            const idx = yearSelect.selectedIndex;
            const nextIdx = idx - direction;
            if (nextIdx >= 0 && nextIdx < yearSelect.options.length) {
                yearSelect.selectedIndex = nextIdx;
            }
        }
        updateNavLabel();
        renderReport();
    }

    async function renderReport() {
        const entries = await loadEntries();
        const bankWithdrawals = await loadBankWithdrawals();
        const bankAccounts = await loadBankAccounts();
        const activeAccountIds = new Set(bankAccounts.map(a => String(a.id)));

        const searchInput = document.getElementById('report-search');
        const query = (searchInput?.value || '').toLowerCase();
        
        console.log(`[Reports Debug] Mode: ${currentMode}, Query: "${query}", Total DB Entries: ${entries.length}`);

        let filtered = entries.filter(e => {
            const desc = (e.description || '').toLowerCase();
            const cat = (e.category || '').toLowerCase();
            const dateStr = (e.date || '').toLowerCase();

            const matchesSearch = desc.includes(query) || cat.includes(query) || dateStr.includes(query);
            if (!matchesSearch) return false;

            if (currentMode === 'overall') return true;

            const entryDate = new Date(e.date);
            if (isNaN(entryDate)) return false;

            const y = entryDate.getFullYear();
            const m = entryDate.getMonth();
            const d = entryDate.getDate();

            if (currentMode === 'date' && dateInput) {
                const [selY, selM, selD] = dateInput.value.split('-').map(Number);
                return y === selY && (m + 1) === selM && d === selD;
            }

            if (currentMode === 'month' && monthSelect) {
                const [selMonthName, selYearStr] = (monthSelect.value || '').split(' ');
                const entryMonthName = entryDate.toLocaleString('default', { month: 'long' });
                return entryMonthName === selMonthName && y.toString() === selYearStr;
            }

            if (currentMode === 'year' && yearSelect) {
                return getFinancialYear(entryDate) === yearSelect.value;
            }
            return false;
        });

        const filterWithdrawals = (w) => {
            if (currentMode === 'overall') return true;
            const wDate = new Date(w.date);
            if (isNaN(wDate)) return false;

            const y = wDate.getFullYear();
            const m = wDate.getMonth();
            const d = wDate.getDate();

            if (currentMode === 'date' && dateInput) {
                const [selY, selM, selD] = dateInput.value.split('-').map(Number);
                return y === selY && (m+1) === selM && d === selD;
            }
            if (currentMode === 'month' && monthSelect) {
                const [selMonthName, selYearStr] = (monthSelect.value || '').split(' ');
                const wMonthName = wDate.toLocaleString('default', { month: 'long' });
                return wMonthName === selMonthName && y.toString() === selYearStr;
            }
            if (currentMode === 'year' && yearSelect) {
                return getFinancialYear(wDate) === yearSelect.value;
            }
            return false;
        };

        const filteredWithdrawals = bankWithdrawals
            .filter(w => activeAccountIds.has(String(w.accountId)))
            .filter(filterWithdrawals);

        // --- Daily Transaction Analytics Calculation ---
        // Show loading state in cards
        const txnTypeIds = ['total', 'aeps', 'matm', 'deposit', 'withdrawal', 'photocopy', 'printout', 'online_work', 'passport'];
        txnTypeIds.forEach(id => {
            const el = document.getElementById(`summary-txn-${id}-amount`);
            if (el) el.innerText = '...';
        });

        let dailyTxns = [];
        const dailyTxnCollection = collection(db, 'daily_transactions');
        
        try {
            let q;
            if (currentMode === 'date' && dateInput) {
                q = query(dailyTxnCollection, where('date', '==', dateInput.value));
            } else if (currentMode === 'month' && monthSelect) {
                // For month, we use range query on date string "YYYY-MM-DD"
                const [selMonthName, selYearStr] = (monthSelect.value || '').split(' ');
                // Get month index (0-11)
                const monthIdx = new Date(`${selMonthName} 1, ${selYearStr}`).getMonth();
                const start = `${selYearStr}-${String(monthIdx + 1).padStart(2, '0')}-01`;
                const end = `${selYearStr}-${String(monthIdx + 1).padStart(2, '0')}-31`;
                q = query(dailyTxnCollection, where('date', '>=', start), where('date', '<=', end));
            } else if (currentMode === 'year' && yearSelect) {
                const year = yearSelect.value; // e.g. "2024-25"
                const startYear = year.split('-')[0];
                const endYear = "20" + year.split('-')[1];
                const start = `${startYear}-04-01`;
                const end = `${endYear}-03-31`;
                q = query(dailyTxnCollection, where('date', '>=', start), where('date', '<=', end));
            } else {
                q = query(dailyTxnCollection);
            }

            const dailyTxnSnapshot = await getDocs(q);
            dailyTxns = dailyTxnSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching daily transactions for report:", error);
        }

        const txnStats = dailyTxns.reduce((acc, t) => {
            const type = t.type;
            if (!acc[type]) acc[type] = { count: 0, amount: 0, charges: 0 };
            acc[type].count++;
            acc[type].amount += parseFloat(t.amount || 0);
            acc[type].charges += parseFloat(t.charges || 0);
            acc.totalAmount += parseFloat(t.amount || 0);
            if (type !== 'SETTLEMENT' && type !== 'DAILY_EXPENSE' && type !== 'GOLD_SIP') {
                acc.totalCharges += parseFloat(t.charges || 0);
            }
            acc.totalCount++;
            return acc;
        }, { totalAmount: 0, totalCharges: 0, totalCount: 0 });


        console.log(`[Reports Debug] Filtered Count: ${filtered.length}`);

        // Sort by date ASC for running balance (same as Dashboard)
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

        // --- Use same running-balance formula as Dashboard ---
        // We now use the cached entries for instant access
        const allEntries = [...entriesCache];
        allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Build a map of date -> dailyIncome using running balance on ALL entries
        let runningBalance = 0;
        const dailyIncomeMap = {};
        // Sort strictly chronologically to ensure accurate running balance calculation
        allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        allEntries.forEach(e => {
            const details = e.details || {};
            const cash = parseFloat(details.cash) || 0;
            const online = parseFloat(details.online) || 0;
            const roinet = parseFloat(details.roinet) || 0;
            const jio = parseFloat(details.jio) || 0;
            const go2sms = parseFloat(details.go2sms) || 0;
            const crgbBc = parseFloat(details.crgb_bc) || parseFloat(details.go2sms) || 0;
            const credit = parseFloat(details.credit) || 0;
            const pending = parseFloat(details.pending) || 0;
            const damages = parseFloat(details.damages) || 0;
            const deposit = parseFloat(details.deposit) || 0;

            const tcf = cash + online + roinet + jio + (crgbBc || go2sms) + credit + pending + damages - deposit;
            const cap = parseFloat(e.capital) || parseFloat(e.capitalAdd) || 0;
            const wit = parseFloat(details.withdrawal) || parseFloat(e.withdrawal) || 0;
            const exp = parseFloat(e.expense) || 0;

            const baseOpn = (e.openingBalance !== undefined && e.openingBalance > 0) ? parseFloat(e.openingBalance) : runningBalance;
            const opn = baseOpn + cap;
            const displayTotalBase = tcf + exp; 
            const dailyInc = Math.max(0, displayTotalBase - opn);
            const netFlow = displayTotalBase - exp;
            const cls = netFlow - wit;
            runningBalance = cls;

            dailyIncomeMap[e.date] = { inc: dailyInc, exp, cap };
        });

        // Find cumulative capital up to the latest date in the filtered view
        let maxFilteredDate = 0;
        if (filtered.length > 0) {
            filtered.forEach(e => {
                const ts = new Date(e.date).getTime();
                if (ts > maxFilteredDate) maxFilteredDate = ts;
            });
        }

        let totalCapitalAdd = 0;
        if (maxFilteredDate > 0) {
            allEntries.forEach(e => {
                if (new Date(e.date).getTime() <= maxFilteredDate) {
                    const mapped = dailyIncomeMap[e.date] || {};
                    totalCapitalAdd += (mapped.cap || 0);
                }
            });
        }

        // Calculate Category Wise Expenses across both Entries and Daily Transactions to ensure real-time accuracy
        const dtxnCatByDate = {};
        dailyTxns.forEach(t => {
            const date = t.date;
            if (!dtxnCatByDate[date]) {
                dtxnCatByDate[date] = { personal: 0, salary: 0, electricity: 0, rent: 0, bizDev: 0, settlement: 0, internet: 0, goldSip: 0 };
            }
            const amt = parseFloat(t.amount || 0);
            const chg = parseFloat(t.charges || 0);
            if (t.type === 'GOLD_SIP') {
                dtxnCatByDate[date].goldSip += amt;
            } else if (t.type === 'SETTLEMENT' && chg > 0) {
                dtxnCatByDate[date].settlement += chg;
            } else if (t.type === 'DAILY_EXPENSE') {
                const note = (t.note || '').toUpperCase();
                if (note === 'PERSONAL EXPENSE') dtxnCatByDate[date].personal += amt;
                else if (note === 'SALARY EXPENSE') dtxnCatByDate[date].salary += amt;
                else if (note === 'ELECTRICITY EXPENSE') dtxnCatByDate[date].electricity += amt;
                else if (note === 'SHOP RENT EXPENSE') dtxnCatByDate[date].rent += amt;
                else if (note === 'BUSINESS DEVLOPMENT' || note === 'BUSINESS DEVELOPMENT') dtxnCatByDate[date].bizDev += amt;
                else if (note === 'SETTLEMENT CHARGES') dtxnCatByDate[date].settlement += amt;
                else if (note === 'INTERNET EXPENSE') dtxnCatByDate[date].internet += amt;
            }
        });

        const allReportDates = new Set([...filtered.map(e => e.date), ...Object.keys(dtxnCatByDate)]);
        const entryByDate = {};
        filtered.forEach(e => { entryByDate[e.date] = e; });

        const realTimeCategories = { personal: 0, salary: 0, electricity: 0, rent: 0, bizDev: 0, settlement: 0, internet: 0, goldSip: 0 };
        allReportDates.forEach(d => {
            const entryDet = (entryByDate[d] && entryByDate[d].details) ? entryByDate[d].details : {};
            const dtxnDet = dtxnCatByDate[d] || {};
            realTimeCategories.personal += Math.max(parseFloat(entryDet.personal_expense) || 0, dtxnDet.personal || 0);
            realTimeCategories.salary += Math.max(parseFloat(entryDet.salary_expense) || 0, dtxnDet.salary || 0);
            realTimeCategories.electricity += Math.max(parseFloat(entryDet.electricity_expense) || 0, dtxnDet.electricity || 0);
            realTimeCategories.rent += Math.max(parseFloat(entryDet.shop_rent_expense) || 0, dtxnDet.rent || 0);
            realTimeCategories.bizDev += Math.max(parseFloat(entryDet.business_development) || 0, dtxnDet.bizDev || 0);
            realTimeCategories.settlement += Math.max(parseFloat(entryDet.settlement_charges) || 0, dtxnDet.settlement || 0);
            realTimeCategories.internet += Math.max(parseFloat(entryDet.internet_expense) || 0, dtxnDet.internet || 0);
            realTimeCategories.goldSip += Math.max(parseFloat(entryDet.gold_sip) || 0, dtxnDet.goldSip || 0);
        });

        // Now aggregate metrics only for filtered entries
        let peakDayIncome = -Infinity;
        let peakDayDate = "N/A";
        const monthTotals = {};
        const yearTotals = {};

        const totals = filtered.reduce((acc, e) => {
            const mapped = dailyIncomeMap[e.date] || {};
            const inc = mapped.inc || 0;
            const exp = mapped.exp || parseFloat(e.expense) || 0;
            acc.income += inc;
            acc.expense += exp;
            acc.profit += (inc - exp);
            acc.periodCap += (parseFloat(e.capital) || parseFloat(e.capitalAdd) || 0);

            const details = e.details || {};
            acc.withdrawal += (parseFloat(details.withdrawal) || parseFloat(e.withdrawal) || 0);

            if (inc > peakDayIncome) {
                peakDayIncome = inc;
                peakDayDate = new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            }

            const mKey = new Date(e.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            monthTotals[mKey] = (monthTotals[mKey] || 0) + inc;

            const dt = new Date(e.date);
            const yStart = dt.getMonth() < 3 ? dt.getFullYear() - 1 : dt.getFullYear();
            const yKey = `FY ${yStart}-${(yStart + 1).toString().slice(-2)}`;
            yearTotals[yKey] = (yearTotals[yKey] || 0) + inc;

            return acc;
        }, { 
            income: 0, 
            expense: 0, 
            profit: 0, 
            periodCap: 0, 
            withdrawal: 0,
            categories: realTimeCategories
        });

        // Aggregate Bank Withdrawal Methods
        const withdrawalMethods = filteredWithdrawals.reduce((acc, w) => {
            const method = w.method || 'Other';
            const amt = parseFloat(w.amount) || 0;
            if (method.includes('Cheque')) acc.cheque += amt;
            else if (method.includes('ATM QR Code')) acc.qr += amt;
            else if (method.includes('ATM Inside Branch')) acc.inside += amt;
            else if (method.includes('ATM')) acc.atm += amt;
            else if (method.includes('Yono')) acc.yono += amt;
            else acc.other += amt;
            return acc;
        }, { cheque: 0, qr: 0, inside: 0, atm: 0, yono: 0, other: 0 });

        console.log(`[Reports Debug] Resulting Totals:`, totals);

        // Averages
        const daysCount = filtered.length || 1;
        const avgIncome = totals.income / daysCount;
        const avgExpense = totals.expense / daysCount;
        const avgProfit = totals.profit / daysCount;

        // ROI
        const roi = totalCapitalAdd > 0 ? (totals.profit / totalCapitalAdd) * 100 : 0;

        // Peak Month
        let peakMonthName = "N/A";
        let maxMonthIncome = -Infinity;
        Object.entries(monthTotals).forEach(([m, val]) => {
            if (val > maxMonthIncome) {
                maxMonthIncome = val;
                peakMonthName = m;
            }
        });

        // Peak Year
        let peakYearName = "N/A";
        let maxYearIncome = -Infinity;
        Object.entries(yearTotals).forEach(([y, val]) => {
            if (val > maxYearIncome) {
                maxYearIncome = val;
                peakYearName = y;
            }
        });

        // Growth Rate
        let growthRate = 0;
        if (filtered.length >= 4) {
            const midpoint = Math.floor(filtered.length / 2);
            const latestHalf = filtered.slice(0, midpoint).reduce((s, x) => s + (parseFloat(x.income) || 0), 0);
            const earlierHalf = filtered.slice(midpoint).reduce((s, x) => s + (parseFloat(x.income) || 0), 0);
            if (earlierHalf > 0) growthRate = ((latestHalf - earlierHalf) / earlierHalf) * 100;
        }

        // Update UI
        const updateText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        updateText('summary-avg-income', formatCurrency(avgIncome));
        updateText('summary-avg-expense', formatCurrency(avgExpense));
        updateText('summary-avg-profit', formatCurrency(avgProfit));
        updateText('summary-roi', roi.toFixed(1) + '%');
        updateText('summary-peak-day', peakDayDate);
        updateText('summary-peak-month', peakMonthName);
        updateText('summary-growth-rate', (growthRate >= 0 ? '+' : '') + growthRate.toFixed(1) + '%');
        updateText('summary-net-profit', formatCurrency(totals.profit));

        // New Total Metrics Row
        updateText('summary-total-income', formatCurrency(totals.income));
        updateText('summary-total-expense', formatCurrency(totals.expense));
        updateText('summary-total-profit', formatCurrency(totals.profit));
        updateText('summary-entries-count', filtered.length);
        updateText('summary-period-capital', formatCurrency(totals.periodCap));
        updateText('summary-total-capital', formatCurrency(totalCapitalAdd));
        updateText('summary-peak-year', peakYearName);
        updateText('summary-total-withdrawal', formatCurrency(totals.withdrawal));

        // Update Daily Transaction Analytics UI
        const updateTxnCard = (idPrefix, data) => {
            const amtEl = document.getElementById(`summary-txn-${idPrefix}-amount`);
            const cntEl = document.getElementById(`summary-txn-${idPrefix}-count`);
            const chgEl = document.getElementById(`summary-txn-${idPrefix}-charges`);
            if (amtEl) amtEl.innerText = formatCurrency(data.amount || 0);
            if (cntEl) cntEl.innerText = `${(data.count || 0)} Transactions`;
            if (chgEl) chgEl.innerText = `F: ${formatCurrency(data.charges || 0)}`;
        };

        updateTxnCard('total', { amount: txnStats.totalAmount, count: txnStats.totalCount, charges: txnStats.totalCharges });
        updateTxnCard('aeps', txnStats['AEPS'] || {});
        updateTxnCard('matm', txnStats['MATM'] || {});
        updateTxnCard('deposit', txnStats['DEPOSIT'] || {});
        updateTxnCard('withdrawal', txnStats['WITHDRAWAL'] || {});

        // Update Service Stats in Reports
        const updateServiceCard = (idPrefix, data) => {
            const amtEl = document.getElementById(`summary-txn-${idPrefix}-amount`);
            const cntEl = document.getElementById(`summary-txn-${idPrefix}-count`);
            // Note: For services, 'amount' in txnStats is actually the fee/charge because amount was 0
            // But txnStats calculation adds t.amount to amount and t.charges to totalCharges.
            // Wait, I need to make sure txnStats aggregates charges too for individual types.
            if (amtEl) amtEl.innerText = formatCurrency(data.charges || 0);
            if (cntEl) cntEl.innerText = `${(data.count || 0)} Items`;
        };

        updateServiceCard('photocopy', txnStats['PHOTOCOPY'] || {});
        updateServiceCard('printout', txnStats['PRINTOUT'] || {});
        updateServiceCard('online_work', txnStats['ONLINE_WORK'] || {});
        updateServiceCard('passport', txnStats['PASSPORT'] || {});
        updateServiceCard('lamination', txnStats['LAMINATION'] || {});
        
        const totalChargesEl = document.getElementById('summary-txn-total-charges');
        if (totalChargesEl) totalChargesEl.innerText = formatCurrency(txnStats.totalCharges);

        // Render Category Wise Expenses Table
        const categoryBody = document.getElementById('category-expense-body');
        if (categoryBody) {
            const catMap = [
                { label: 'Personal Expense', val: totals.categories.personal, icon: 'person', color: 'text-blue-500' },
                { label: 'Salary Expense', val: totals.categories.salary, icon: 'payments', color: 'text-emerald-500' },
                { label: 'Electricity Expense', val: totals.categories.electricity, icon: 'bolt', color: 'text-amber-500' },
                { label: 'Shop Rent Expense', val: totals.categories.rent, icon: 'store', color: 'text-purple-500' },
                { label: 'Business Development', val: totals.categories.bizDev, icon: 'trending_up', color: 'text-cyan-500' },
                { label: 'Settlement Charges', val: totals.categories.settlement, icon: 'price_check', color: 'text-indigo-500' },
                { label: 'Internet Expense', val: totals.categories.internet, icon: 'wifi', color: 'text-rose-500' },
                { label: 'Gold SIP', val: totals.categories.goldSip, icon: 'savings', color: 'text-amber-600' }
            ];

            const totalCatExpense = Object.values(totals.categories).reduce((a, b) => a + b, 0);

            if (totalCatExpense === 0) {
                categoryBody.innerHTML = `
                    <tr>
                        <td colspan="2" class="px-6 py-10 text-center">
                            <div class="flex flex-col items-center gap-2 opacity-40">
                                <span class="material-symbols-outlined text-4xl">info</span>
                                <p class="text-sm font-medium">Data Not Available</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                categoryBody.innerHTML = catMap.map(cat => `
                    <tr class="hover:bg-primary/5 transition-colors group">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <div class="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${cat.color} group-hover:scale-110 transition-transform">
                                    <span class="material-symbols-outlined text-lg">${cat.icon}</span>
                                </div>
                                <span class="font-semibold text-slate-700 dark:text-slate-200">${cat.label}</span>
                            </div>
                        </td>
                        <td class="px-6 py-4 text-right font-black italic text-slate-900 dark:text-white">
                            ${formatCurrency(cat.val)}
                        </td>
                    </tr>
                `).join('');
            }
        }

        // Render Withdrawal Methods Table
        const methodBody = document.getElementById('method-withdrawal-body');
        if (methodBody) {
            const methodMap = [
                { label: 'Self Cheque', val: withdrawalMethods.cheque, icon: 'receipt_long', color: 'text-purple-500' },
                { label: 'ATM Withdrawal', val: withdrawalMethods.atm, icon: 'atm', color: 'text-blue-500' },
                { label: 'ATM QR Code', val: withdrawalMethods.qr, icon: 'qr_code_2', color: 'text-indigo-500' },
                { label: 'ATM Inside Branch', val: withdrawalMethods.inside, icon: 'apartment', color: 'text-amber-500' },
                { label: 'Yono Cash', val: withdrawalMethods.yono, icon: 'smartphone', color: 'text-pink-500' },
                { label: 'Other Branch Cash', val: withdrawalMethods.other, icon: 'account_balance', color: 'text-slate-500' }
            ];

            const totalMethodWithdrawal = Object.values(withdrawalMethods).reduce((a, b) => a + b, 0);

            if (totalMethodWithdrawal === 0) {
                methodBody.innerHTML = `
                    <tr>
                        <td colspan="2" class="px-6 py-10 text-center">
                            <div class="flex flex-col items-center gap-2 opacity-40">
                                <span class="material-symbols-outlined text-4xl">info</span>
                                <p class="text-sm font-medium">Data Not Available</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                methodBody.innerHTML = methodMap.map(m => `
                    <tr class="hover:bg-primary/5 transition-colors group">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <div class="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${m.color} group-hover:scale-110 transition-transform">
                                    <span class="material-symbols-outlined text-lg">${m.icon}</span>
                                </div>
                                <span class="font-semibold text-slate-700 dark:text-slate-200">${m.label}</span>
                            </div>
                        </td>
                        <td class="px-6 py-4 text-right font-black italic text-slate-900 dark:text-white">
                            ${formatCurrency(m.val)}
                        </td>
                    </tr>
                `).join('');
            }
        }
    }

    function modeToTitle(mode) {
        if (mode === 'date') return 'Daily';
        if (mode === 'month') return monthSelect?.value;
        if (mode === 'year') return yearSelect?.value;
        return 'Overall';
    }

    // Reactive Events
    [searchInput, dateInput, monthSelect, yearSelect].forEach(el => {
        if (el) el.oninput = () => {
            updateNavLabel();
            renderReport();
        };
    });
    if (btnApply) btnApply.onclick = renderReport;

    await populateFilters();
    updateUI();
    renderReport();
}

// --- Logic for Bank Withdrawals ---
async function initBankWithdrawals() {
    console.log("[DEBUG] initBankWithdrawals starting for redesigned analytics dashboard...");
    const tableBody = document.getElementById('bank-data-body');
    if (!tableBody) return;

    const accountForm = document.getElementById('account-form') || document.getElementById('add-account-form');
    const withdrawalForm = document.getElementById('withdrawal-form');
    const accountViewHeader = document.getElementById('account-view-header');
    const addWithdrawalSection = document.getElementById('add-withdrawal-section');
    const backBtn = document.getElementById('back-to-accounts');
    const addAccountBtn = document.getElementById('add-job-account-btn');
    const accountsHeader = document.getElementById('accounts-header');
    const withdrawalsHeader = document.getElementById('withdrawals-header');

    // Stats
    const fyTotalDisplay = document.getElementById('fy-total-display');
    const fyPercentage = document.getElementById('fy-percentage');
    const fyProgressBar = document.getElementById('fy-progress-bar');
    const fyDatesDisplay = document.getElementById('fy-dates-display');

    let currentView = 'accounts'; // accounts or withdrawals
    let activeAccountId = null;
    let deleteTargetId = null;
    let deleteTargetType = null; // 'account' or 'withdrawal'

    window.currentTimeFilter = window.currentTimeFilter || 'ALL';

    // Account Modal Elements
    const accountModal = document.getElementById('account-modal');
    const modalTitle = document.getElementById('account-modal-title');

    function openAccountModal(id = null) {
        if (accountModal) {
            accountModal.classList.remove('hidden');
            if (id) {
                if (modalTitle) modalTitle.innerText = "Edit Account";
            } else {
                if (modalTitle) modalTitle.innerText = "Add Account";
                if (accountForm) accountForm.reset();
                const editIdEl = document.getElementById('edit-account-id');
                if (editIdEl) editIdEl.value = '';
            }
        }
    }
    window.openAccountModal = openAccountModal;

    function closeAccountModal() {
        if (accountModal) accountModal.classList.add('hidden');
    }
    window.closeAccountModal = closeAccountModal;

    // Delete Modal Elements
    const deleteModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    function getCurrentFYDates() {
        const today = new Date();
        const year = today.getFullYear();
        let startYear, endYear;

        if (today.getMonth() >= 3) { // April to Dec
            startYear = year;
            endYear = year + 1;
        } else { // Jan to March
            startYear = year - 1;
            endYear = year;
        }

        const start = new Date(startYear, 3, 1);
        const end = new Date(endYear, 2, 31, 23, 59, 59);
        return { start, end, label: `FY ${startYear}-${endYear}` };
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    function updateAnalyticsPanel(withdrawalsList, totalLimit, currentFYTotal) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 1. Remaining Limit
        const remaining = Math.max(0, totalLimit - currentFYTotal);
        const remDisplay = document.getElementById('remaining-limit-display');
        if (remDisplay) remDisplay.innerText = formatCurrency(remaining);

        // 2. This Month's Withdrawals
        const monthlyTotal = withdrawalsList.reduce((sum, w) => {
            const d = new Date(w.date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                return sum + (parseFloat(w.amount) || 0);
            }
            return sum;
        }, 0);
        const monthDisplay = document.getElementById('monthly-total-display');
        if (monthDisplay) monthDisplay.innerText = formatCurrency(monthlyTotal);

        // 3. Last Withdrawal
        let latestW = null;
        let latestTime = 0;
        withdrawalsList.forEach(w => {
            const t = new Date(w.date).getTime();
            if (t > latestTime) {
                latestTime = t;
                latestW = w;
            }
        });
        const lastAmountEl = document.getElementById('last-withdrawal-amount');
        const lastDateEl = document.getElementById('last-withdrawal-date');
        if (latestW) {
            if (lastAmountEl) lastAmountEl.innerText = formatCurrency(parseFloat(latestW.amount) || 0);
            if (lastDateEl) lastDateEl.innerText = new Date(latestW.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + (latestW.method ? ` • ${latestW.method}` : '');
        } else {
            if (lastAmountEl) lastAmountEl.innerText = "-";
            if (lastDateEl) lastDateEl.innerText = "No entries found";
        }

        // 4. Most Used Method & Distribution
        const methodCounts = {};
        const methodAmounts = {};
        let totalAmountAll = 0;

        withdrawalsList.forEach(w => {
            const m = w.method || 'Other';
            const amt = parseFloat(w.amount) || 0;
            methodCounts[m] = (methodCounts[m] || 0) + 1;
            methodAmounts[m] = (methodAmounts[m] || 0) + amt;
            totalAmountAll += amt;
        });

        let topMethod = "-";
        let maxCount = 0;
        Object.entries(methodCounts).forEach(([m, count]) => {
            if (count > maxCount) {
                maxCount = count;
                topMethod = m;
            }
        });
        const mostUsedEl = document.getElementById('most-used-method-display');
        if (mostUsedEl) mostUsedEl.innerText = topMethod === '-' ? '-' : `${topMethod} (${maxCount} times)`;

        // Distribution Bars
        const breakdownContainer = document.getElementById('method-breakdown-container');
        if (breakdownContainer) {
            if (Object.keys(methodAmounts).length === 0) {
                breakdownContainer.innerHTML = `<p class="text-purple-200/50 text-center py-2 text-[11px]">No method data available</p>`;
            } else {
                const colors = {
                    'ATM': 'from-blue-400 to-blue-600',
                    'ATM QR Code': 'from-indigo-400 to-indigo-600',
                    'ATM Inside Branch': 'from-amber-400 to-amber-600',
                    'Cheque': 'from-purple-400 to-purple-600',
                    'Yono': 'from-pink-400 to-pink-600',
                    'Other': 'from-emerald-400 to-emerald-600'
                };
                
                let html = '';
                Object.entries(methodAmounts).sort((a,b) => b[1] - a[1]).forEach(([m, amt]) => {
                    const pct = totalAmountAll > 0 ? (amt / totalAmountAll) * 100 : 0;
                    let color = colors['Other'];
                    if (m === 'ATM') color = colors['ATM'];
                    else if (m === 'ATM QR Code') color = colors['ATM QR Code'];
                    else if (m === 'ATM Inside Branch') color = colors['ATM Inside Branch'];
                    else if (m.includes('Cheque')) color = colors['Cheque'];
                    else if (m.includes('Yono')) color = colors['Yono'];

                    html += `
                        <div class="space-y-1 group/bar">
                            <div class="flex justify-between text-[11px] font-extrabold tracking-wider">
                                <span class="text-purple-100 group-hover/bar:text-white transition-colors">${m}</span>
                                <span class="text-purple-200 font-mono">${formatCurrency(amt)} (${pct.toFixed(0)}%)</span>
                            </div>
                            <div class="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
                                <div class="h-full bg-gradient-to-r ${color} rounded-full transition-all duration-1000 shadow-sm" style="width: ${pct}%"></div>
                            </div>
                        </div>
                    `;
                });
                breakdownContainer.innerHTML = html;
            }
        }
    }

    async function renderView() {
        console.log("[DEBUG] renderView starting, currentView:", currentView);
        try {
            const accounts = await loadBankAccounts();
            const withdrawalsList = await loadBankWithdrawals();
            console.log(`[DEBUG] Loaded ${accounts.length} accounts and ${withdrawalsList.length} withdrawals.`);

            tableBody.innerHTML = '';

            const fy = getCurrentFYDates();
            if (fyDatesDisplay) fyDatesDisplay.innerText = fy.label;

            const limitDisplay = document.getElementById('limit-display');

            if (currentView === 'accounts') {
                let grandFyTotal = 0;
                withdrawalsList.forEach(w => {
                    const wDate = new Date(w.date);
                    if (wDate >= fy.start && wDate <= fy.end) {
                        grandFyTotal += (parseFloat(w.amount) || 0);
                    }
                });

                const totalAccounts = Math.max(1, accounts.length);
                const grandLimit = totalAccounts * 10000000;
                const grandPercent = (grandFyTotal / grandLimit) * 100;

                if (fyTotalDisplay) {
                    fyTotalDisplay.innerText = formatCurrency(grandFyTotal);
                    const prevEl = fyTotalDisplay.previousElementSibling;
                    if (prevEl && prevEl.querySelector('#fy-label-title')) {
                        prevEl.querySelector('#fy-label-title').innerText = "TOTAL YEAR WITHDRAWALS (ALL ACCOUNTS)";
                    }
                }
                if (fyPercentage) {
                    fyPercentage.innerText = `${grandPercent.toFixed(1)}% Used`;
                    fyPercentage.className = `px-2.5 py-1 rounded-lg text-[11px] font-black border ${grandPercent >= 100 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : (grandPercent >= 80 ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30')}`;
                }
                if (fyProgressBar) {
                    fyProgressBar.style.width = `${Math.min(grandPercent, 100)}%`;
                    fyProgressBar.className = `h-full rounded-full transition-all duration-1000 ${grandPercent >= 100 ? 'bg-gradient-to-r from-rose-400 to-rose-600 shadow-rose-500/50' : (grandPercent >= 80 ? 'bg-gradient-to-r from-orange-400 to-orange-600 shadow-orange-500/50' : 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-emerald-500/50')}`;
                }
                if (limitDisplay) limitDisplay.innerText = `Combined Limit: ${formatCurrency(grandLimit)} (Sec 194N)`;

                updateAnalyticsPanel(withdrawalsList, grandLimit, grandFyTotal);

                const tableTitle = document.getElementById('table-title-label');
                const tableSub = document.getElementById('table-subtitle-label');
                if (tableTitle) tableTitle.innerText = "Bank Accounts Overview";
                if (tableSub) tableSub.innerText = "Select an account below to explore its detailed cash withdrawal history";

                if (backBtn) backBtn.classList.add('hidden');
                if (addAccountBtn) addAccountBtn.classList.remove('hidden');
                if (addWithdrawalSection) addWithdrawalSection.classList.add('hidden');
                if (accountsHeader) accountsHeader.classList.remove('hidden');
                if (withdrawalsHeader) withdrawalsHeader.classList.add('hidden');

                let filteredAccounts = accounts;
                const searchInput = document.getElementById('search-filter');
                if (searchInput && searchInput.value) {
                    const q = searchInput.value.toLowerCase().trim();
                    filteredAccounts = filteredAccounts.filter(acc => (acc.name || '').toLowerCase().includes(q));
                }

                if (filteredAccounts.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400 font-bold">No matching bank accounts found.</td></tr>`;
                } else {
                    filteredAccounts.forEach((acc, index) => {
                        const accWithdrawals = withdrawalsList.filter(w => String(w.accountId) === String(acc.id));
                        let fyTotal = 0;
                        accWithdrawals.forEach(w => {
                            const wDate = new Date(w.date);
                            if (wDate >= fy.start && wDate <= fy.end) {
                                fyTotal += (parseFloat(w.amount) || 0);
                            }
                        });

                        const limit = 10000000;
                        const pecent = (fyTotal / limit) * 100;
                        const statusClass = pecent >= 100 ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800' : (pecent >= 80 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800');
                        const statusText = pecent >= 100 ? 'OVER LIMIT' : (pecent >= 80 ? 'WARNING' : 'SAFE');

                        let holder = acc.name;
                        let bank = "-";
                        let accNo = "-";
                        let type = "-";

                        if (acc.name.includes('|')) {
                            const parts = acc.name.split('|');
                            holder = parts[0] || "-";
                            bank = parts[1] || "-";
                            accNo = parts[2] || "-";
                            type = parts[3] || "-";
                        } else {
                            const nameParts = acc.name.toUpperCase().split(/\s+/);
                            const banks = ["SBI", "HDFC", "ICICI", "AXIS", "PNB", "BOB", "CANARA", "UNION", "IDFC", "KOTAK", "CRGB"];
                            const types = ["CURRENT", "SAVING", "FD", "RD", "LOAN", "CC"];

                            let foundBankIdx = -1;
                            let foundTypeIdx = -1;

                            nameParts.forEach((part, i) => {
                                if (banks.includes(part)) foundBankIdx = i;
                                if (types.includes(part)) foundTypeIdx = i;
                            });

                            if (foundBankIdx !== -1) {
                                bank = nameParts[foundBankIdx];
                                holder = nameParts.slice(0, foundBankIdx).join(" ");
                            }
                            if (foundTypeIdx !== -1) {
                                type = nameParts[foundTypeIdx];
                                if (foundBankIdx === -1) {
                                    holder = nameParts.slice(0, foundTypeIdx).join(" ");
                                } else if (foundTypeIdx > foundBankIdx) {
                                    const middle = nameParts.slice(foundBankIdx + 1, foundTypeIdx).join(" ");
                                    if (middle && !middle.includes("A/C")) accNo = middle;
                                }
                            }
                            const acMatch = acc.name.match(/A\/c\s*(\d+)/i) || acc.name.match(/(\d{4,})/);
                            if (acMatch) {
                                accNo = acMatch[1];
                                holder = holder.replace(acMatch[0], "").trim();
                            }
                            if (!holder) holder = acc.name;
                        }

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 dark:hover:bg-primary/10 transition-all cursor-pointer group border-b border-slate-100 dark:border-slate-800/60 animate-in fade-in slide-in-from-left-2 duration-300 font-semibold";
                        tr.style.animationDelay = `${index * 30}ms`;
                        tr.onclick = () => { showAccountDetails(acc.id); };
                        tr.innerHTML = `
                            <td class="px-5 py-4 align-middle text-center text-sm font-bold text-slate-400 w-14">${index + 1}</td>
                            <td class="px-5 py-4 align-middle">
                                <div class="flex flex-col leading-tight">
                                    <span class="text-sm font-extrabold text-slate-800 dark:text-white group-hover:text-primary transition-colors">${holder}</span>
                                    <span class="text-xs text-slate-400 font-bold uppercase lg:hidden mt-0.5">${bank} • ${type} • A/c ${accNo}</span>
                                </div>
                            </td>
                            <td class="px-5 py-4 align-middle text-center hidden md:table-cell"><span class="text-sm font-bold text-slate-600 dark:text-slate-300">${bank}</span></td>
                            <td class="px-5 py-4 align-middle text-center hidden lg:table-cell"><span class="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">${accNo}</span></td>
                            <td class="px-5 py-4 align-middle text-center hidden md:table-cell"><span class="text-xs font-black px-3 py-1 bg-primary/10 text-primary dark:text-purple-300 rounded-xl border border-primary/20 tracking-wider uppercase">${type}</span></td>
                            <td class="px-5 py-4 align-middle text-right whitespace-nowrap"><span class="text-sm font-black text-rose-600 dark:text-rose-400">${formatCurrency(fyTotal)}</span></td>
                            <td class="px-5 py-4 align-middle text-center whitespace-nowrap"><span class="px-3 py-1 rounded-full text-xs font-extrabold border ${statusClass}">${statusText} (${pecent.toFixed(1)}%)</span></td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
            } else {
                const acc = accounts.find(a => String(a.id) === String(activeAccountId));
                if (!acc) { showAccountsList(); return; }

                let holder = acc.name;
                let bank = "Bank";
                let accNo = "";
                if (acc.name.includes('|')) {
                    const parts = acc.name.split('|');
                    holder = parts[0];
                    bank = parts[1] || "Bank";
                    accNo = parts[2] ? ` • A/c ${parts[2]}` : "";
                }

                const tableTitle = document.getElementById('table-title-label');
                const tableSub = document.getElementById('table-subtitle-label');
                if (tableTitle) tableTitle.innerText = `Account: ${holder}`;
                if (tableSub) tableSub.innerText = `Showing withdrawal history and limits for ${bank}${accNo}`;

                if (backBtn) backBtn.classList.remove('hidden');
                if (addAccountBtn) addAccountBtn.classList.add('hidden');
                if (addWithdrawalSection) addWithdrawalSection.classList.remove('hidden');
                if (accountsHeader) accountsHeader.classList.add('hidden');
                if (withdrawalsHeader) withdrawalsHeader.classList.remove('hidden');

                const accWithdrawals = withdrawalsList.filter(w => String(w.accountId) === String(activeAccountId));
                accWithdrawals.sort((a, b) => {
                    const d1 = new Date(a.date);
                    const d2 = new Date(b.date);
                    if (d1.getTime() !== d2.getTime()) return d2 - d1;
                    return (b.id || 0) - (a.id || 0);
                });

                let fyTotal = 0;
                accWithdrawals.forEach(w => {
                    const amount = parseFloat(w.amount) || 0;
                    const wDate = new Date(w.date);
                    if (wDate >= fy.start && wDate <= fy.end) {
                        fyTotal += amount;
                    }
                });

                const limit = 10000000;
                const pecent = (fyTotal / limit) * 100;
                if (fyTotalDisplay) {
                    fyTotalDisplay.innerText = formatCurrency(fyTotal);
                    const prevEl = fyTotalDisplay.previousElementSibling;
                    if (prevEl && prevEl.querySelector('#fy-label-title')) {
                        prevEl.querySelector('#fy-label-title').innerText = `TOTAL FY WITHDRAWALS (${holder.toUpperCase()})`;
                    }
                }
                if (fyPercentage) {
                    fyPercentage.innerText = `${pecent.toFixed(1)}% Used`;
                    fyPercentage.className = `px-2.5 py-1 rounded-lg text-[11px] font-black border ${pecent >= 100 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : (pecent >= 80 ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30')}`;
                }
                if (fyProgressBar) {
                    fyProgressBar.style.width = `${Math.min(pecent, 100)}%`;
                    fyProgressBar.className = `h-full rounded-full transition-all duration-1000 ${pecent >= 100 ? 'bg-gradient-to-r from-rose-400 to-rose-600 shadow-rose-500/50' : (pecent >= 80 ? 'bg-gradient-to-r from-orange-400 to-orange-600 shadow-orange-500/50' : 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-emerald-500/50')}`;
                }
                if (limitDisplay) limitDisplay.innerText = `Limit: ₹1.00 Cr (Sec 194N)`;

                updateAnalyticsPanel(accWithdrawals, limit, fyTotal);

                // Apply Filters
                let filteredWithdrawals = accWithdrawals;

                const now = new Date();
                if (window.currentTimeFilter === 'TODAY') {
                    const todayStr = now.toISOString().split('T')[0];
                    filteredWithdrawals = filteredWithdrawals.filter(w => w.date === todayStr);
                } else if (window.currentTimeFilter === 'MONTH') {
                    const curMonth = now.getMonth();
                    const curYear = now.getFullYear();
                    filteredWithdrawals = filteredWithdrawals.filter(w => {
                        const d = new Date(w.date);
                        return d.getMonth() === curMonth && d.getFullYear() === curYear;
                    });
                } else if (window.currentTimeFilter === 'FY') {
                    filteredWithdrawals = filteredWithdrawals.filter(w => {
                        const d = new Date(w.date);
                        return d >= fy.start && d <= fy.end;
                    });
                }

                const methodSel = document.getElementById('method-filter');
                if (methodSel && methodSel.value && methodSel.value !== 'ALL') {
                    const selMethod = methodSel.value;
                    if (selMethod === 'Cheque') {
                        filteredWithdrawals = filteredWithdrawals.filter(w => (w.method || '').includes('Cheque'));
                    } else if (selMethod === 'Yono') {
                        filteredWithdrawals = filteredWithdrawals.filter(w => (w.method || '').includes('Yono'));
                    } else {
                        filteredWithdrawals = filteredWithdrawals.filter(w => (w.method || '') === selMethod);
                    }
                }

                const searchInput = document.getElementById('search-filter');
                if (searchInput && searchInput.value) {
                    const q = searchInput.value.toLowerCase().trim();
                    filteredWithdrawals = filteredWithdrawals.filter(w => {
                        return (w.method || '').toLowerCase().includes(q) ||
                               (w.note || '').toLowerCase().includes(q) ||
                               String(w.amount || '').includes(q) ||
                               (w.date || '').includes(q);
                    });
                }

                if (filteredWithdrawals.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-400 font-bold">No matching withdrawal records found.</td></tr>`;
                } else {
                    filteredWithdrawals.forEach((w, index) => {
                        const amount = parseFloat(w.amount) || 0;
                        const wDate = new Date(w.date);

                        let methodHtml = `<span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700">${w.method}</span>`;
                        if (w.method === 'ATM') methodHtml = `<span class="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-xl text-xs font-black border border-blue-500/20 shadow-sm">ATM</span>`;
                        if (w.method === 'ATM QR Code') methodHtml = `<span class="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-xl text-xs font-black border border-indigo-500/20 shadow-sm">ATM QR</span>`;
                        if (w.method === 'ATM Inside Branch') methodHtml = `<span class="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-xl text-xs font-black border border-amber-500/20 shadow-sm">In-Branch ATM</span>`;
                        if (w.method.includes('Cheque')) methodHtml = `<span class="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-xl text-xs font-black border border-purple-500/20 shadow-sm">Cheque</span>`;
                        if (w.method.includes('Yono')) methodHtml = `<span class="bg-pink-500/10 text-pink-600 dark:text-pink-400 px-3 py-1 rounded-xl text-xs font-black border border-pink-500/20 shadow-sm">Yono Cash</span>`;

                        let autoBadge = w.dailyTxnId ? `<span class="ml-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border border-emerald-500/30 align-middle"><span class="material-symbols-outlined text-[12px]">auto_awesome</span> Auto Entry</span>` : '';

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 dark:hover:bg-primary/10 transition-all group border-b border-slate-100 dark:border-slate-800/60 animate-in fade-in slide-in-from-right-2 duration-300 font-semibold";
                        tr.style.animationDelay = `${index * 30}ms`;
                        tr.innerHTML = `
                            <td class="px-5 py-4 align-middle text-center text-sm font-bold text-slate-400 w-14">${index + 1}</td>
                            <td class="px-5 py-4 align-middle whitespace-nowrap"><span class="text-sm font-bold text-slate-800 dark:text-slate-200">${wDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></td>
                            <td class="px-5 py-4 align-middle text-right whitespace-nowrap"><span class="text-sm font-black text-rose-600 dark:text-rose-400">${formatCurrency(amount)}</span></td>
                            <td class="px-5 py-4 align-middle text-center whitespace-nowrap">${methodHtml}</td>
                            <td class="px-5 py-4 align-middle"><span class="text-sm text-slate-700 dark:text-slate-300 font-semibold">${w.note || "-"}</span>${autoBadge}</td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
            }
        } catch (e) { console.error("render error:", e); }
    }

    if (accountForm) {
        accountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const holder = document.getElementById('modal-acc-holder') ? document.getElementById('modal-acc-holder').value.trim() : document.getElementById('new-account-name').value.trim();
            const bank = document.getElementById('modal-acc-bank') ? document.getElementById('modal-acc-bank').value.trim() : '';
            const number = document.getElementById('modal-acc-number') ? document.getElementById('modal-acc-number').value.trim() : '';
            const type = document.getElementById('modal-acc-type') ? document.getElementById('modal-acc-type').value.trim() : 'CURRENT';
            const branch = document.getElementById('modal-acc-branch') ? document.getElementById('modal-acc-branch').value.trim() : '';

            const editId = document.getElementById('edit-account-id') ? document.getElementById('edit-account-id').value : '';

            if (holder) {
                const combinedName = bank ? `${holder}|${bank}|${number}|${type}|${branch}` : holder;
                const uniqueId = editId || Date.now();
                await saveBankAccount({ id: uniqueId, name: combinedName });
                closeAccountModal();
                if (accountForm.reset) accountForm.reset();
                await renderView();
                if (window.populateBankAccountsDropdown) await populateBankAccountsDropdown();
            }
        });
    }

    async function showAccountDetails(id) {
        currentView = 'withdrawals';
        activeAccountId = id;
        await renderView();
    }
    window.showAccountDetails = showAccountDetails;

    async function showAccountsList() {
        currentView = 'accounts';
        activeAccountId = null;
        await renderView();
    }
    window.showAccountsList = showAccountsList;

    async function editBankAccountRecord(id) {
        const accs = await loadBankAccounts();
        const acc = accs.find(x => String(x.id) === String(id));
        if (acc) {
            document.getElementById('edit-account-id').value = acc.id;
            if (acc.name.includes('|')) {
                const parts = acc.name.split('|');
                if(document.getElementById('modal-acc-holder')) document.getElementById('modal-acc-holder').value = parts[0] || '';
                if(document.getElementById('modal-acc-bank')) document.getElementById('modal-acc-bank').value = parts[1] || '';
                if(document.getElementById('modal-acc-number')) document.getElementById('modal-acc-number').value = parts[2] || '';
                if(document.getElementById('modal-acc-type')) document.getElementById('modal-acc-type').value = parts[3] || 'CURRENT';
                if(document.getElementById('modal-acc-branch')) document.getElementById('modal-acc-branch').value = parts[4] || '';
            } else {
                if(document.getElementById('modal-acc-holder')) document.getElementById('modal-acc-holder').value = acc.name;
                if(document.getElementById('new-account-name')) document.getElementById('new-account-name').value = acc.name;
            }
            openAccountModal(acc.id);
        }
    }
    window.editBankAccountRecord = editBankAccountRecord;

    function deleteBankAccountRecord(id) {
        deleteTargetId = id;
        deleteTargetType = 'account';
        const titleEl = document.getElementById('delete-modal-title');
        const descEl = document.getElementById('delete-modal-description');
        if (titleEl) titleEl.innerText = "Delete Bank Account?";
        if (descEl) descEl.innerText = "Are you sure you want to delete this bank account? All associated withdrawal history will be permanently removed. This action cannot be undone.";
        if (deleteModal) deleteModal.classList.remove('hidden');
    }
    window.deleteBankAccountRecord = deleteBankAccountRecord;

    async function editBankWithdrawalRecord(id) {
        const wList = await loadBankWithdrawals();
        const w = wList.find(x => String(x.id) === String(id));
        if (w) {
            if (w.dailyTxnId) {
                Swal.fire({
                    icon: 'info',
                    title: 'Auto-Generated Entry',
                    text: 'This withdrawal record was automatically generated from Daily Transactions. Please edit or delete the original transaction on the Daily Transactions page to update this record.',
                    confirmButtonColor: '#7c3aed'
                });
                return;
            }
            document.getElementById('withdrawal-date').value = w.date;
            document.getElementById('withdrawal-amount').value = w.amount;
            document.getElementById('withdrawal-method').value = w.method;
            document.getElementById('withdrawal-note').value = w.note || '';

            let editIdInput = document.getElementById('edit-withdrawal-id');
            if (!editIdInput) {
                editIdInput = document.createElement('input');
                editIdInput.type = 'hidden';
                editIdInput.id = 'edit-withdrawal-id';
                withdrawalForm.appendChild(editIdInput);
            }
            editIdInput.value = w.id;

            const submitBtn = withdrawalForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">update</span> Update Withdrawal';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
    window.editBankWithdrawalRecord = editBankWithdrawalRecord;

    async function deleteBankWithdrawalRecord(id) {
        const wList = await loadBankWithdrawals();
        const w = wList.find(x => String(x.id) === String(id));
        if (w && w.dailyTxnId) {
            Swal.fire({
                icon: 'info',
                title: 'Auto-Generated Entry',
                text: 'This withdrawal record was automatically generated from Daily Transactions. Please delete the original transaction on the Daily Transactions page to remove this record.',
                confirmButtonColor: '#7c3aed'
            });
            return;
        }
        deleteTargetId = id;
        deleteTargetType = 'withdrawal';
        const titleEl = document.getElementById('delete-modal-title');
        const descEl = document.getElementById('delete-modal-description');
        if (titleEl) titleEl.innerText = "Delete Withdrawal Record?";
        if (descEl) descEl.innerText = "Are you sure you want to delete this withdrawal record? This action cannot be undone.";
        if (deleteModal) deleteModal.classList.remove('hidden');
    }
    window.deleteBankWithdrawalRecord = deleteBankWithdrawalRecord;

    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = async () => {
            if (!deleteTargetId) return;
            const performDelete = async () => {
                confirmDeleteBtn.disabled = true;
                if (cancelDeleteBtn) cancelDeleteBtn.disabled = true;
                const originalText = confirmDeleteBtn.innerHTML;
                confirmDeleteBtn.innerHTML = '<div class="flex items-center justify-center gap-2"><span class="material-symbols-outlined animate-spin text-lg">sync</span><span>Deleting...</span></div>';

                try {
                    if (deleteTargetType === 'account') {
                        // Delete the account
                        await deleteDoc(doc(db, "bank_accounts", deleteTargetId.toString()));

                        // Cascading delete: Delete all withdrawals for this account
                        const allWithdrawals = await loadBankWithdrawals();
                        const toDelete = allWithdrawals.filter(w => String(w.accountId) === String(deleteTargetId));
                        console.log(`[Cascading Delete] Removing ${toDelete.length} withdrawals for account ${deleteTargetId}`);

                        for (const w of toDelete) {
                            try {
                                await deleteDoc(doc(db, "bank_withdrawals", String(w.id || w.firebaseId)));
                            } catch (e) {
                                console.error(`Failed to delete withdrawal ${w.id}:`, e);
                            }
                        }
                    } else {
                        await deleteBankWithdrawal(deleteTargetId);
                    }

                    if (deleteModal) deleteModal.classList.add('hidden');
                    await renderView();
                    if (window.populateBankAccountsDropdown) await populateBankAccountsDropdown();
                    
                    let container = document.getElementById('txn-toast-container');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'txn-toast-container';
                        container.className = 'fixed top-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0';
                        document.body.appendChild(container);
                    }
                    const toast = document.createElement('div');
                    toast.className = 'pointer-events-auto flex items-center gap-3.5 px-4.5 py-4 bg-emerald-600/95 dark:bg-emerald-500/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-white/20 transform translate-x-full opacity-0 transition-all duration-300 ease-out';
                    toast.innerHTML = `
                        <span class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                            <span class="material-symbols-outlined text-xl font-bold">check_circle</span>
                        </span>
                        <div class="flex flex-col leading-tight">
                            <span class="text-[10px] font-black uppercase tracking-widest text-white/80">SUCCESS</span>
                            <span class="text-sm font-bold text-white mt-0.5">Record deleted successfully</span>
                        </div>
                    `;
                    container.appendChild(toast);
                    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
                    setTimeout(() => {
                        toast.classList.add('translate-x-full', 'opacity-0');
                        setTimeout(() => toast.remove(), 350);
                    }, 4000);

                } catch (err) {
                    console.error("Delete error:", err);
                    const errorModal = document.createElement('div');
                    errorModal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn';
                    errorModal.innerHTML = `
                        <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scaleUp p-8 text-center">
                            <div class="size-16 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-6">
                                <span class="material-symbols-outlined text-4xl">error</span>
                            </div>
                            <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Deletion Failed</h3>
                            <p class="text-sm text-slate-500 font-medium mb-8">An error occurred while trying to delete.</p>
                            <div class="flex items-center gap-3">
                                <button class="cancel-err-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
                                <button class="retry-err-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition-all">Retry</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(errorModal);
                    errorModal.querySelector('.cancel-err-btn').onclick = () => {
                        errorModal.remove();
                        if (deleteModal) deleteModal.classList.add('hidden');
                        deleteTargetId = null;
                        deleteTargetType = null;
                    };
                    errorModal.querySelector('.retry-err-btn').onclick = () => {
                        errorModal.remove();
                        performDelete();
                    };
                } finally {
                    confirmDeleteBtn.disabled = false;
                    if (cancelDeleteBtn) cancelDeleteBtn.disabled = false;
                    confirmDeleteBtn.innerHTML = originalText;
                    if (deleteModal && deleteModal.classList.contains('hidden')) {
                        deleteTargetId = null;
                        deleteTargetType = null;
                    }
                }
            };
            performDelete();
        };
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = () => {
            if (deleteModal) deleteModal.classList.add('hidden');
            deleteTargetId = null;
            deleteTargetType = null;
        };
    }

    window.applyWithdrawalsFilter = async () => {
        await renderView();
    };

    window.setTimeFilter = async (tf) => {
        window.currentTimeFilter = tf;
        document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
        if (event && event.target) {
            event.target.classList.add('active');
        }
        await renderView();
    };

    window.exportWithdrawalsCSV = async () => {
        const withdrawals = await loadBankWithdrawals();
        const accounts = await loadBankAccounts();
        
        let toExport = withdrawals;
        if (currentView === 'withdrawals' && activeAccountId) {
            toExport = withdrawals.filter(w => String(w.accountId) === String(activeAccountId));
        }
        
        if (toExport.length === 0) {
            alert("No withdrawal data available to export.");
            return;
        }
        
        let csv = "ID,Account,Date,Amount,Method,Note,AutoSynced\n";
        toExport.forEach(w => {
            const acc = accounts.find(a => String(a.id) === String(w.accountId));
            let accName = acc ? acc.name : "Unknown";
            if (accName.includes('|')) accName = accName.split('|')[0];
            csv += `"${w.id}","${accName}","${w.date}","${w.amount}","${w.method}","${(w.note || '').replace(/"/g, '""')}","${w.dailyTxnId ? 'YES' : 'NO'}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Withdrawals_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    await renderView();
}

function protectPrivilegedLinks() {
    const selectors = [
        'a[href="add-entry-code.html"]',
        'a[data-page="add-entry-code.html"]',
        'a[href="settings-code.html"]',
        'a[data-page="settings-code.html"]'
    ].join(', ');

    document.querySelectorAll(selectors).forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            
            if (document.getElementById('pin-modal')) return;

            const targetHref = link.getAttribute('href') || link.getAttribute('data-page');
            const routeName = (targetHref && targetHref.includes('settings')) ? 'Settings' : 'Add Entry';

            const modalHTML = `
            <div id="pin-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);">
                <div style="background:white;padding:24px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.2);text-align:center;width:90%;max-width:320px;" class="dark:bg-slate-800">
                    <h3 style="margin-top:0;font-weight:bold;color:#1e293b;font-size:18px;margin-bottom:8px;" class="dark:text-white">Security Check</h3>
                    <p style="color:#64748b;font-size:13px;margin-bottom:20px;" class="dark:text-slate-400">Enter the 6-digit PIN to access ${routeName}.</p>
                    
                    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:24px;" id="pin-container">
                        ${[1, 2, 3, 4, 5, 6].map(() => `
                            <input type="password" class="pin-digit dark:bg-slate-900 dark:border-slate-700 dark:text-white focus:border-primary" style="width:40px;height:48px;font-size:24px;text-align:center;border:2px solid #e2e8f0;border-radius:8px;outline:none;" maxlength="1" inputmode="numeric">
                        `).join('')}
                    </div>

                    <div style="display:flex;gap:12px;">
                        <button id="pin-cancel" style="flex:1;padding:12px;border:none;background:#f1f5f9;color:#475569;border-radius:8px;font-weight:bold;cursor:pointer;" class="dark:bg-slate-700 dark:text-white">Cancel</button>
                        <button id="pin-submit" style="flex:1;padding:12px;border:none;background:#7f13ec;color:white;border-radius:8px;font-weight:bold;cursor:pointer;">Unlock</button>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            const inputs = document.querySelectorAll('.pin-digit');
            setTimeout(() => inputs[0].focus(), 100);
            
            const close = () => {
                const m = document.getElementById('pin-modal');
                if (m) m.remove();
            };
            document.getElementById('pin-cancel').addEventListener('click', close);
            
            const attemptUnlock = () => {
                const pin = Array.from(inputs).map(i => i.value).join('');
                if (pin.length < 6) return; // Wait until all are filled

                if (pin === "202526") {
                    close();
                    if(targetHref) window.location.href = targetHref;
                } else {
                    inputs.forEach(i => { i.style.borderColor = "#ef4444"; i.value = ""; });
                    inputs[0].focus();
                    setTimeout(() => inputs.forEach(i => i.style.borderColor = ""), 1000);
                }
            };
            
            document.getElementById('pin-submit').addEventListener('click', attemptUnlock);

            inputs.forEach((input, index) => {
                input.addEventListener('input', () => {
                    if (input.value && index < 5) inputs[index + 1].focus();
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !input.value && index > 0) {
                        inputs[index - 1].focus();
                        inputs[index - 1].value = ''; // auto clear previous box
                    }
                    if (e.key === 'Enter') attemptUnlock();
                });

                input.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const pastedData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
                    for (let i = 0; i < pastedData.length; i++) {
                        inputs[i].value = pastedData[i];
                    }
                    if (pastedData.length > 0) {
                        inputs[Math.min(pastedData.length, 5)].focus();
                    }
                });
            });
        });
    });
}

async function syncCreditFromDailyTxn(newTxn, dailyTxnId, isDelete = false) {
    try {
        const existingCredits = await loadCredits();
        let linkedCredit = existingCredits.find(cr => cr.dailyTxnId === dailyTxnId);
        
        if (!linkedCredit && newTxn && newTxn.note) {
            const targetName = newTxn.note.trim().toLowerCase();
            const customers = await loadCustomers();
            const customer = customers.find(c => c.name && c.name.trim().toLowerCase() === targetName);
            if (customer) {
                // Ensure we do not hijack an existing credit entry that is already linked to another daily transaction
                linkedCredit = existingCredits.find(cr => !cr.dailyTxnId && (cr.description === 'Synced from Daily Txn' || cr.note === newTxn.note.trim() || cr.note?.startsWith(newTxn.note.trim())) && cr.date === newTxn.date && String(cr.customerId) === String(customer.id));
            }
        }

        if (isDelete) {
            if (linkedCredit) {
                await deleteCredit(linkedCredit.id);
                console.log('[CreditSync] Successfully deleted linked credit entry:', linkedCredit.id);
            }
            return;
        }

        if (!newTxn || !['CREDIT_GIVEN', 'CREDIT_RECEIVED'].includes(newTxn.type)) {
            if (linkedCredit) {
                await deleteCredit(linkedCredit.id);
                console.log('[CreditSync] Deleted linked credit entry because txn type changed or cleared:', linkedCredit.id);
            }
            return;
        }

        const customers = await loadCustomers();
        const targetName = newTxn.note.trim().toLowerCase();
        let customer = customers.find(c => c.name && c.name.trim().toLowerCase() === targetName);
        
        if (!customer) {
            const newCust = {
                id: Date.now().toString(),
                name: newTxn.note.trim(),
                phone: '',
                address: newTxn.address || '',
                date: newTxn.date
            };
            await saveCustomer(newCust);
            customer = newCust;
        }

        const amountVal = newTxn.type === 'CREDIT_GIVEN' ? Number(newTxn.amount || 0) : 0;
        const paidVal = newTxn.type === 'CREDIT_RECEIVED' ? Number(newTxn.amount || 0) : 0;
        const remarkStr = newTxn.remark ? newTxn.remark.trim() : '';
        const noteStr = remarkStr ? remarkStr : (newTxn.address ? `(${newTxn.address})` : 'Synced from Daily Txn');

        if (linkedCredit) {
            linkedCredit.amount = amountVal;
            linkedCredit.paid = paidVal;
            linkedCredit.date = newTxn.date;
            linkedCredit.note = noteStr;
            linkedCredit.type = newTxn.type === 'CREDIT_GIVEN' ? 'given' : 'received';
            await saveCredit(linkedCredit);
            console.log('[CreditSync] Successfully updated credit entry for:', customer.name);
        } else {
            const creditEntry = {
                id: (Date.now() + 1).toString(),
                dailyTxnId: dailyTxnId,
                customerId: customer.id,
                amount: amountVal,
                paid: paidVal,
                date: newTxn.date,
                note: noteStr,
                description: `Synced from Daily Txn`,
                type: newTxn.type === 'CREDIT_GIVEN' ? 'given' : 'received'
            };
            await saveCredit(creditEntry);
            console.log('[CreditSync] Successfully created credit entry for:', customer.name);
        }
    } catch (err) {
        console.error('[CreditSync] Error syncing credit:', err);
    }
}

async function syncBankWithdrawalFromDailyTxn(newTxn, dailyTxnId, isDelete = false) {
    try {
        const existingWithdrawals = await loadBankWithdrawals();
        let linkedWithdrawal = existingWithdrawals.find(w => String(w.dailyTxnId) === String(dailyTxnId));

        if (isDelete) {
            if (linkedWithdrawal) {
                await deleteBankWithdrawal(linkedWithdrawal.id || linkedWithdrawal.firebaseId);
                console.log('[BankWithdrawalSync] Successfully deleted linked withdrawal entry:', linkedWithdrawal.id);
            }
            return;
        }

        if (!newTxn || newTxn.type !== 'CASH_WITHDRAWAL') {
            if (linkedWithdrawal) {
                await deleteBankWithdrawal(linkedWithdrawal.id || linkedWithdrawal.firebaseId);
                console.log('[BankWithdrawalSync] Deleted linked withdrawal entry because txn type changed or cleared:', linkedWithdrawal.id);
            }
            return;
        }

        let accountId = newTxn.accountId;
        if (!accountId && newTxn.bankName) {
            const accounts = await loadBankAccounts();
            const matched = accounts.find(a => a.name === newTxn.bankName);
            if (matched) accountId = matched.id;
        }

        if (!accountId) {
            console.warn('[BankWithdrawalSync] No accountId found for Cash Withdrawal transaction. Skipping sync.');
            return;
        }

        const amountVal = Number(newTxn.amount || 0);
        const remarkStr = newTxn.remark ? newTxn.remark.trim() : '';
        const noteStr = remarkStr ? remarkStr : (newTxn.note ? newTxn.note.trim() : 'Generated from Daily Transactions');

        if (linkedWithdrawal) {
            linkedWithdrawal.accountId = accountId;
            linkedWithdrawal.amount = amountVal;
            linkedWithdrawal.date = newTxn.date;
            linkedWithdrawal.note = noteStr;
            linkedWithdrawal.method = newTxn.method || linkedWithdrawal.method || "ATM";
            await saveBankWithdrawal(linkedWithdrawal);
            console.log('[BankWithdrawalSync] Successfully updated linked withdrawal entry:', linkedWithdrawal.id);
        } else {
            const newW = {
                id: Date.now().toString() + Math.floor(Math.random() * 1000),
                accountId: accountId,
                date: newTxn.date,
                amount: amountVal,
                method: newTxn.method || "ATM",
                note: noteStr,
                dailyTxnId: dailyTxnId,
                autoCreated: true
            };
            await saveBankWithdrawal(newW);
            console.log('[BankWithdrawalSync] Successfully created new linked withdrawal entry ID:', newW.id);
        }
    } catch (err) {
        console.error('[BankWithdrawalSync] Error during sync:', err);
    }
}

const MASTER_TXN_TYPES = [
    { type: 'ALL', label: 'All Transactions', icon: 'account_balance_wallet', bg: 'bg-primary/10', text: 'text-primary', borderLeft: 'bg-primary' },
    { type: 'AEPS', label: 'AEPS', icon: 'fingerprint', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },
    { type: 'MATM', label: 'Micro ATM', icon: 'credit_card', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },
    { type: 'DEPOSIT', label: 'Money Transfer', icon: 'send', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },
    { type: 'WITHDRAWAL', label: 'Online Wdrl', icon: 'account_balance', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },
    { type: 'CASH_WITHDRAWAL', label: 'Cash Wdrl (Bank)', icon: 'move_down', bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400', borderLeft: 'bg-teal-500' },
    { type: 'CASH_DEPOSIT', label: 'Cash Dep (Bank)', icon: 'move_up', bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-700 dark:text-teal-400', borderLeft: 'bg-teal-500' },
    { type: 'PHOTOCOPY', label: 'Photocopy', icon: 'file_copy', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', borderLeft: 'bg-indigo-500' },
    { type: 'PRINTOUT', label: 'Printout', icon: 'print', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', borderLeft: 'bg-indigo-500' },
    { type: 'ONLINE_WORK', label: 'Online Work', icon: 'language', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', borderLeft: 'bg-indigo-500' },
    { type: 'PASSPORT', label: 'Passport Photo', icon: 'photo_camera', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', borderLeft: 'bg-indigo-500' },
    { type: 'LAMINATION', label: 'Lamination', icon: 'layers', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', borderLeft: 'bg-indigo-500' },
    { type: 'PAN_CARD', label: 'PAN Card', icon: 'id_card', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-400', borderLeft: 'bg-indigo-500' },
    { type: 'JIO_TOPUP', label: 'Jio Topup', icon: 'cell_tower', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', borderLeft: 'bg-blue-500' },
    { type: 'JIO_RECHARGE', label: 'Jio Recharge', icon: 'phone_iphone', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', borderLeft: 'bg-blue-500' },
    { type: 'DISHTV_RECHARGE', label: 'Dish TV', icon: 'tv', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', borderLeft: 'bg-blue-500' },
    { type: 'ELECTRICITY_BILL', label: 'Electricity Bill', icon: 'bolt', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', borderLeft: 'bg-blue-500' },
    { type: 'GOLD_SIP', label: 'Gold SIP', icon: 'savings', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', borderLeft: 'bg-amber-500' },
    { type: 'CSP_COMMISSION', label: 'CSP Comm', icon: 'account_balance', bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', borderLeft: 'bg-purple-500' },
    { type: 'ROINET_COMMISSION', label: 'Roinet Comm', icon: 'receipt_long', bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', borderLeft: 'bg-purple-500' },
    { type: 'DAILY_EXPENSE', label: 'Daily Expense', icon: 'receipt', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-400', borderLeft: 'bg-rose-500' },
    { type: 'OTHER_INCOME', label: 'Other Income', icon: 'add_circle', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },
    { type: 'FREE_DEPOSIT', label: 'Free Deposit', icon: 'input', bg: 'bg-slate-50 dark:bg-slate-500/10', text: 'text-slate-700 dark:text-slate-400', borderLeft: 'bg-slate-500' },
    { type: 'FREE_WITHDRAWAL', label: 'Free Wdrl', icon: 'output', bg: 'bg-slate-50 dark:bg-slate-500/10', text: 'text-slate-700 dark:text-slate-400', borderLeft: 'bg-slate-500' },
    { type: 'CREDIT_GIVEN', label: 'Credit Given', icon: 'person_remove', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', text: 'text-fuchsia-700 dark:text-fuchsia-400', borderLeft: 'bg-fuchsia-500' },
    { type: 'CREDIT_RECEIVED', label: 'Credit Recd', icon: 'person_add', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', text: 'text-fuchsia-700 dark:text-fuchsia-400', borderLeft: 'bg-fuchsia-500' },
    { type: 'CUST_MONEY_IN', label: 'Cust Money In', icon: 'wallet', bg: 'bg-lime-50 dark:bg-lime-500/10', text: 'text-lime-700 dark:text-lime-400', borderLeft: 'bg-lime-500' },
    { type: 'CUST_MONEY_OUT', label: 'Cust Money Out', icon: 'account_balance_wallet', bg: 'bg-lime-50 dark:bg-lime-500/10', text: 'text-lime-700 dark:text-lime-400', borderLeft: 'bg-lime-500' },
    { type: 'PENDING', label: 'Pending Net', icon: 'pending', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', borderLeft: 'bg-amber-500' },
    { type: 'SETTLEMENT', label: 'Settlement', icon: 'published_with_changes', bg: 'bg-zinc-50 dark:bg-zinc-500/10', text: 'text-zinc-700 dark:text-zinc-400', borderLeft: 'bg-zinc-500' },
    { type: 'DAMAGED_CURRENCY', label: 'Damaged Curr', icon: 'money_off', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-400', borderLeft: 'bg-rose-500' },
    { type: 'DAMAGED_RECOVERY', label: 'Damaged Recov', icon: 'attach_money', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },
    { type: 'ADD_CAPITAL', label: 'Add Capital', icon: 'account_balance', bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-400', borderLeft: 'bg-cyan-500' },
    { type: 'SHARE_WITHDRAWN', label: 'Share Wdrl', icon: 'exit_to_app', bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-400', borderLeft: 'bg-cyan-500' }
];

// Logic for Daily Transactions
async function initDailyTxn() {
    console.log('Initializing DailyTxn module...');
    const form = document.getElementById('daily-txn-form');
    if (!form) {
        console.warn('Daily Txn form not found on this page.');
        return;
    }

    const tableBody = document.getElementById('daily-txn-table-body');
    const txnAmount = document.getElementById('txn-amount');
    const amountLabel = document.getElementById('amount-label');
    const txnRemaining = document.getElementById('txn-remaining');
    const remainingContainer = document.getElementById('remaining-field-container');
    const txnType = document.getElementById('txn-type');
    const txnNote = document.getElementById('txn-note');
    const txnRemark = document.getElementById('txn-remark');
    const txnAddress = document.getElementById('txn-address');
    const txnCharges = document.getElementById('txn-charges');
    const txnChargesType = document.getElementById('txn-charges-type');
    const txnExpenseType = document.getElementById('txn-expense-type');
    const txnConditional = document.getElementById('txn-conditional');
    const txnProvider = document.getElementById('txn-provider');
    const txnDepositBy = document.getElementById('txn-depositby');
    const depositByContainer = document.getElementById('depositby-field-container');
    const txnReceivedIn = document.getElementById('txn-receivedin');
    const receivedInContainer = document.getElementById('receivedin-field-container');
    const txnChargesAccount = document.getElementById('txn-charges-account');
    const chargesAccountContainer = document.getElementById('charges-account-container');
    const conditionalLabel = document.getElementById('conditional-label');
    const conditionalContainer = document.getElementById('conditional-field-container');
    const providerContainer = document.getElementById('provider-field-container');
    const amountFieldContainer = document.getElementById('amount-field-container');
    const noteFieldContainer = document.getElementById('note-field-container');
    const remarkFieldContainer = document.getElementById('remark-field-container');
    const addressFieldContainer = document.getElementById('address-field-container');
    const txnBank = document.getElementById('txn-bank');
    const bankContainer = document.getElementById('bank-field-container');
    const txnMethod = document.getElementById('txn-method');
    const methodContainer = document.getElementById('method-field-container');
    const chargesFieldContainer = document.getElementById('charges-field-container');
    const chargesModeContainer = document.getElementById('charges-mode-container');
    const txnQuantity = document.getElementById('txn-quantity');
    const quantityFieldContainer = document.getElementById('quantity-field-container');
    const quantityLabel = document.getElementById('quantity-label');
    const txnLaminationSize = document.getElementById('txn-lamination-size');
    const laminationSizeContainer = document.getElementById('lamination-size-container');
    const txnDateText = document.getElementById('current-date-text');
    const txnViewDate = document.getElementById('txn-view-date');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');

    let editingTxnId = null;
    let editingTxnTimestamp = null;
    let deletingTxnId = null;
    let unsubscribe = null;
    let currentSelectedDate = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    let allTxnsForDate = [];
    let currentTxnFilter = 'ALL';
    let currentStartCash = 0;
    let currentStartOnline = 0;

    // All-Time Search Functionality
    window.isAllTimeSearchMode = false;
    const toggleAllTimeSearchBtn = document.getElementById('toggle-all-time-search-btn');
    const allTimeSearchBanner = document.getElementById('all-time-search-banner');
    const allTimeSearchCountBadge = document.getElementById('all-time-search-count-badge');
    const summaryBalancesGrid = document.getElementById('summary-balances-grid');
    const summaryBadgesArea = document.getElementById('summary-badges-area');
    const searchInput = document.getElementById('txn-search-input');

    const loadAllTimeTransactions = (fromDate, toDate) => {
        try {
            if (unsubscribe) unsubscribe();

            const rangeLabel = `${fromDate} → ${toDate}`;
            if (txnDateText) txnDateText.innerText = `Transactions: ${rangeLabel}`;

            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="100" class="px-6 py-24 text-center">
                            <div class="inline-flex flex-col items-center justify-center gap-5 p-8 rounded-3xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/10 backdrop-blur-xl shadow-xl max-w-sm w-full mx-auto animate-fadeIn">
                                <div class="relative flex items-center justify-center">
                                    <div class="absolute size-14 rounded-full bg-primary/20 blur-md animate-pulse"></div>
                                    <div class="size-12 rounded-full border-4 border-primary/10 border-t-primary border-r-primary/50 animate-spin"></div>
                                    <div class="absolute size-3 rounded-full bg-primary animate-ping"></div>
                                </div>
                                <div class="space-y-2">
                                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">Loading Transactions</h4>
                                    <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Fetching ${rangeLabel}...</p>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }

            if (allTimeSearchCountBadge) allTimeSearchCountBadge.innerText = "Fetching...";
            const dateRangeLabelText = document.getElementById('date-range-label-text');
            if (dateRangeLabelText) dateRangeLabelText.innerText = rangeLabel;

            const txnCollection = collection(db, 'daily_transactions');
            const q = query(txnCollection, where('date', '>=', fromDate), where('date', '<=', toDate), orderBy('date', 'desc'));
            
            unsubscribe = onSnapshot(q, (snapshot) => {
                let txns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                txns.sort((a, b) => {
                    const dateA = a.date || "";
                    const dateB = b.date || "";
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
                });

                allTxnsForDate = txns;
                
                if (allTimeSearchCountBadge) {
                    allTimeSearchCountBadge.innerText = `${txns.length} Transactions`;
                }

                renderBadgesAndTable();
            }, (error) => {
                console.error('Date Range Transactions Listener Error:', error);
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="px-6 py-10 text-center text-rose-500 font-bold border-2 border-rose-100 rounded-xl bg-rose-50/50">
                                <span class="material-symbols-outlined text-4xl mb-2">error</span>
                                <div class="text-lg">Failed to load transactions</div>
                                <div class="text-xs opacity-70 font-medium mt-1">Error: ${error.message}</div>
                            </td>
                        </tr>
                    `;
                }
            });
        } catch (e) {
            console.error('Error setting up date range transactions listener:', e);
        }
    };

    const dateRangePanel = document.getElementById('date-range-panel');
    const rangeFromDate = document.getElementById('range-from-date');
    const rangeToDate = document.getElementById('range-to-date');
    const loadDateRangeBtn = document.getElementById('load-date-range-btn');
    const closeDateRangeBtn = document.getElementById('close-date-range-btn');

    // Set default dates: first day of current month → today
    const _today = new Date();
    const _firstOfMonth = new Date(_today.getFullYear(), _today.getMonth(), 1);
    const _fmt = (d) => d.toISOString().split('T')[0];
    if (rangeFromDate) rangeFromDate.value = _fmt(_firstOfMonth);
    if (rangeToDate) rangeToDate.value = _fmt(_today);

    if (toggleAllTimeSearchBtn) {
        toggleAllTimeSearchBtn.onclick = () => {
            window.isAllTimeSearchMode = !window.isAllTimeSearchMode;
            if (window.isAllTimeSearchMode) {
                toggleAllTimeSearchBtn.classList.add('bg-indigo-100', 'text-indigo-700', 'border-indigo-200', 'dark:bg-indigo-500/10', 'dark:text-indigo-400');
                toggleAllTimeSearchBtn.classList.remove('bg-slate-100', 'text-slate-600');
                if (dateRangePanel) dateRangePanel.classList.remove('hidden');
                if (summaryBalancesGrid) summaryBalancesGrid.classList.add('hidden');
                if (summaryBadgesArea) summaryBadgesArea.classList.add('hidden');
            } else {
                toggleAllTimeSearchBtn.classList.remove('bg-indigo-100', 'text-indigo-700', 'border-indigo-200', 'dark:bg-indigo-500/10', 'dark:text-indigo-400');
                toggleAllTimeSearchBtn.classList.add('bg-slate-100', 'text-slate-600');
                if (dateRangePanel) dateRangePanel.classList.add('hidden');
                if (allTimeSearchBanner) allTimeSearchBanner.classList.add('hidden');

                const getSetting = window.getAppSetting || ((k, d) => localStorage.getItem(k) !== 'false');
                if (getSetting('dtxn_showBalancesGrid', true) && summaryBalancesGrid) {
                    summaryBalancesGrid.classList.remove('hidden');
                }
                if (getSetting('dtxn_showSummary', true) && summaryBadgesArea) {
                    summaryBadgesArea.classList.remove('hidden');
                }

                loadTransactions(currentSelectedDate);
            }
        };
    }

    if (loadDateRangeBtn) {
        loadDateRangeBtn.onclick = () => {
            const from = rangeFromDate ? rangeFromDate.value : '';
            const to = rangeToDate ? rangeToDate.value : '';
            if (!from || !to) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ title: 'Select Dates', text: 'Please select both From and To dates.', icon: 'warning', confirmButtonColor: '#7f13ec' });
                } else {
                    alert('Please select both From and To dates.');
                }
                return;
            }
            if (from > to) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ title: 'Invalid Range', text: 'From date cannot be after To date.', icon: 'error', confirmButtonColor: '#7f13ec' });
                } else {
                    alert('From date cannot be after To date.');
                }
                return;
            }
            if (allTimeSearchBanner) allTimeSearchBanner.classList.remove('hidden');
            loadAllTimeTransactions(from, to);
        };
    }

    if (closeDateRangeBtn) {
        closeDateRangeBtn.onclick = () => {
            window.isAllTimeSearchMode = false;
            toggleAllTimeSearchBtn.classList.remove('bg-indigo-100', 'text-indigo-700', 'border-indigo-200', 'dark:bg-indigo-500/10', 'dark:text-indigo-400');
            toggleAllTimeSearchBtn.classList.add('bg-slate-100', 'text-slate-600');
            if (dateRangePanel) dateRangePanel.classList.add('hidden');
            if (allTimeSearchBanner) allTimeSearchBanner.classList.add('hidden');
            const getSetting = window.getAppSetting || ((k, d) => localStorage.getItem(k) !== 'false');
            if (getSetting('dtxn_showBalancesGrid', true) && summaryBalancesGrid) summaryBalancesGrid.classList.remove('hidden');
            if (getSetting('dtxn_showSummary', true) && summaryBadgesArea) summaryBadgesArea.classList.remove('hidden');
            loadTransactions(currentSelectedDate);
        };
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (window.isAllTimeSearchMode) {
                renderBadgesAndTable();
            }
        });
    }
    let currentAvailableCash = 0; // Tracks live cash for validation
    let currentAvailableOnline = 0; // Tracks live online for validation
    let currentAvailableJio = 0; // Tracks live Jio balance for validation
    let currentAvailableDamaged = 0; // Tracks live damaged currency for validation
    let currentAvailableCrgb = 0; // Tracks live CRGB BC balance for validation
    let currentAvailableRoinet1 = 0; // Tracks live Roinet(Parsu) balance for validation
    let currentAvailableRoinet2 = 0; // Tracks live Roinet(Dalai) balance for validation
    let currentAvailableAirtel1 = 0; // Tracks live Airtel(Parsu) balance for validation
    let currentAvailableAirtel2 = 0; // Tracks live Airtel(Dalai) balance for validation
    let currentAvailableSpiceMoney = 0; // Tracks live Spice Money for validation

    // Initialize date picker
    let previousViewDateVal = currentSelectedDate;
    if (txnViewDate) {
        txnViewDate.value = currentSelectedDate;
        txnViewDate.addEventListener('change', (e) => {
            if (!window._isConfirmedDateSwitch && window.hasUnsavedData && window.hasUnsavedData()) {
                if (!confirm("You have unsaved transaction data. Continue changing date?")) {
                    e.target.value = previousViewDateVal;
                    return;
                }
            }
            window._isConfirmedDateSwitch = false;
            previousViewDateVal = e.target.value;
            loadTransactions(e.target.value);
        });
    }

    // Populate customer suggestions for Credit transactions
    const populateCustomerSuggestions = async () => {
        try {
            const customers = await loadCustomers();
            const list = document.getElementById('customer-list');
            if (list) {
                list.innerHTML = '';
                // Use a Set to avoid duplicates and ensure unique names
                const names = [...new Set(customers.map(c => c.name).filter(Boolean))];
                names.sort().forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    list.appendChild(option);
                });
                console.log(`[DailyTxn] Populated ${names.length} customer suggestions.`);
            }
        } catch (e) {
            console.error("[DailyTxn] Failed to populate customer suggestions:", e);
        }
    };
    populateCustomerSuggestions();

    const showDeleteModal = (id) => {
        deletingTxnId = id;
        deleteModal.classList.remove('hidden');
        setTimeout(() => document.getElementById('delete-modal-content').classList.remove('scale-95'), 10);
    };

    const hideDeleteModal = () => {
        document.getElementById('delete-modal-content').classList.add('scale-95');
        setTimeout(() => deleteModal.classList.add('hidden'), 200);
        deletingTxnId = null;
    };

    if (cancelDeleteBtn) cancelDeleteBtn.onclick = hideDeleteModal;
    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = async () => {
            if (!deletingTxnId) return;
            const performDelete = async () => {
                confirmDeleteBtn.disabled = true;
                if (cancelDeleteBtn) cancelDeleteBtn.disabled = true;
                const originalText = confirmDeleteBtn.innerHTML;
                confirmDeleteBtn.innerHTML = '<div class="flex items-center justify-center gap-2"><span class="material-symbols-outlined animate-spin text-lg">sync</span><span>Deleting...</span></div>';
                
                try {
                    const snap = await getDocs(collection(db, 'daily_transactions'));
                    const targetTxnDoc = snap.docs.find(d => d.id === deletingTxnId);
                    if (targetTxnDoc) {
                        await syncCreditFromDailyTxn(targetTxnDoc.data(), deletingTxnId, true);
                        await syncBankWithdrawalFromDailyTxn(targetTxnDoc.data(), deletingTxnId, true);
                    } else {
                        await syncCreditFromDailyTxn(null, deletingTxnId, true);
                        await syncBankWithdrawalFromDailyTxn(null, deletingTxnId, true);
                    }
                    await deleteDoc(doc(db, 'daily_transactions', deletingTxnId));
                    hideDeleteModal();
                    
                    let container = document.getElementById('txn-toast-container');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'txn-toast-container';
                        container.className = 'fixed top-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0';
                        document.body.appendChild(container);
                    }
                    const toast = document.createElement('div');
                    toast.className = 'pointer-events-auto flex items-center gap-3.5 px-4.5 py-4 bg-emerald-600/95 dark:bg-emerald-500/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-white/20 transform translate-x-full opacity-0 transition-all duration-300 ease-out';
                    toast.innerHTML = `
                        <span class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                            <span class="material-symbols-outlined text-xl font-bold">check_circle</span>
                        </span>
                        <div class="flex flex-col leading-tight">
                            <span class="text-[10px] font-black uppercase tracking-widest text-white/80">SUCCESS</span>
                            <span class="text-sm font-bold text-white mt-0.5">Transaction deleted successfully</span>
                        </div>
                    `;
                    container.appendChild(toast);
                    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
                    setTimeout(() => {
                        toast.classList.add('translate-x-full', 'opacity-0');
                        setTimeout(() => toast.remove(), 350);
                    }, 4000);

                } catch(e) {
                    console.error(e);
                    const errorModal = document.createElement('div');
                    errorModal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn';
                    errorModal.innerHTML = `
                        <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scaleUp p-8 text-center">
                            <div class="size-16 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-6">
                                <span class="material-symbols-outlined text-4xl">error</span>
                            </div>
                            <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Deletion Failed</h3>
                            <p class="text-sm text-slate-500 font-medium mb-8">An error occurred while trying to delete the transaction.</p>
                            <div class="flex items-center gap-3">
                                <button class="cancel-err-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Cancel</button>
                                <button class="retry-err-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition-all">Retry</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(errorModal);
                    errorModal.querySelector('.cancel-err-btn').onclick = () => {
                        errorModal.remove();
                        hideDeleteModal();
                    };
                    errorModal.querySelector('.retry-err-btn').onclick = () => {
                        errorModal.remove();
                        performDelete();
                    };
                } finally {
                    confirmDeleteBtn.disabled = false;
                    if (cancelDeleteBtn) cancelDeleteBtn.disabled = false;
                    confirmDeleteBtn.innerHTML = originalText;
                }
            };
            performDelete();
        };
    }

    const resetFormState = () => {
        editingTxnId = null;
        editingTxnTimestamp = null;
        form.reset();
        txnType.value = 'AEPS';
        txnProvider.value = '';
        if (txnRemark) txnRemark.value = '';
        txnRemaining.value = '';
        txnBank.value = '';
        const txnBankSelect = document.getElementById('txn-bank-select');
        if (txnBankSelect) {
            txnBankSelect.value = '';
            txnBankSelect.required = false;
        }
        const customSearch = document.getElementById('custom-bank-search');
        if (customSearch) customSearch.value = '';
        const customContainer = document.getElementById('custom-bank-select-container');
        if (customContainer) customContainer.classList.add('hidden');
        if (amountLabel) amountLabel.innerText = 'Amount';
        if (remainingContainer) remainingContainer.classList.add('hidden');
        if (bankContainer) bankContainer.classList.add('hidden');
        if (txnMethod) txnMethod.value = 'ATM';
        if (methodContainer) methodContainer.classList.add('hidden');
        if (remarkFieldContainer) remarkFieldContainer.classList.add('hidden');
        if (txnReceivedIn) txnReceivedIn.value = '';
        if (receivedInContainer) receivedInContainer.classList.add('hidden');
        const chargesLabel = document.getElementById('charges-account-label');
        if (chargesLabel) chargesLabel.innerText = 'Charges Account';
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
            submitBtn.classList.remove('bg-amber-500');
            submitBtn.classList.add('bg-primary');
        }
        updateConditionalField();
        if (txnType) txnType.focus();
    };

    console.log('DailyTxn elements found, attaching listeners...');

    const updateConditionalField = () => {
        if (!txnType || !conditionalContainer) return;
        
        const chargesOnlyTypes = ['PHOTOCOPY', 'PRINTOUT', 'PASSPORT', 'LAMINATION', 'ROINET_COMMISSION', 'OTHER_INCOME'];
        const simplifiedTypes = ['JIO_TOPUP', 'DISHTV_RECHARGE', 'ELECTRICITY_BILL', 'SETTLEMENT'];
        const amountOnlyTypes = ['JIO_RECHARGE', 'GOLD_SIP', 'DAMAGED_CURRENCY'];
        const noteAndAmountTypes = ['ADMIN_DEPOSIT', 'ADMIN_WITHDRAWAL'];
        const creditTypes = ['CREDIT_GIVEN', 'CREDIT_RECEIVED', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE'];
        const isDamagedRecovery = txnType.value === 'DAMAGED_RECOVERY';
        const isCashMovement = ['CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value);
        const isChargesOnly = chargesOnlyTypes.includes(txnType.value);
        const isSimplified = simplifiedTypes.includes(txnType.value);
        const isAmountOnly = amountOnlyTypes.includes(txnType.value);
        const isNoteAndAmount = noteAndAmountTypes.includes(txnType.value);
        const isCredit = creditTypes.includes(txnType.value);

        // Disable/Enable fields
        txnAmount.disabled = isChargesOnly;
        txnNote.disabled = (isChargesOnly && txnType.value !== 'OTHER_INCOME') || isSimplified || isAmountOnly || isDamagedRecovery || isCashMovement;
        txnAddress.disabled = isChargesOnly || isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery || isCashMovement;
        txnConditional.disabled = isChargesOnly || isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery || isCashMovement;

        // Reset Labels
        if (chargesModeContainer) {
            const label = chargesModeContainer.querySelector('label');
            if (label) label.innerText = isDamagedRecovery ? 'CONVERTED TO' : 'CHARGES MODE';
        }

        if (isChargesOnly || isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery || isCashMovement) {
            conditionalContainer.classList.add('hidden');
            if (amountFieldContainer) {
                if (isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery || isCashMovement) amountFieldContainer.classList.remove('hidden');
                else amountFieldContainer.classList.add('hidden');
            }
            if (noteFieldContainer) {
                if ((isNoteAndAmount || isCredit || txnType.value === 'OTHER_INCOME') && !isDamagedRecovery && !isCashMovement) {
                    noteFieldContainer.classList.remove('hidden');
                    const label = noteFieldContainer.querySelector('label');
                    if (txnType.value === 'DAILY_EXPENSE') {
                        if (label) label.innerText = 'Expense Type';
                        if (txnNote) txnNote.classList.add('hidden');
                        if (txnExpenseType) txnExpenseType.classList.remove('hidden');
                    } else if (txnType.value === 'OTHER_INCOME') {
                        if (label) label.innerText = 'Income Type';
                        if (txnNote) {
                            txnNote.classList.remove('hidden');
                            txnNote.placeholder = 'e.g. Commission, Bonus...';
                        }
                        if (txnExpenseType) txnExpenseType.classList.add('hidden');
                    } else {
                        if (label) label.innerText = 'Customer Name';
                        if (txnNote) {
                            txnNote.classList.remove('hidden');
                            txnNote.placeholder = 'Enter Name...';
                        }
                        if (txnExpenseType) txnExpenseType.classList.add('hidden');
                    }
                }
                else noteFieldContainer.classList.add('hidden');
            }
            if (remarkFieldContainer) {
                if (['CREDIT_GIVEN', 'CREDIT_RECEIVED', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT', 'DAILY_EXPENSE'].includes(txnType.value)) {
                    remarkFieldContainer.classList.remove('hidden');
                    const label = remarkFieldContainer.querySelector('label');
                    if (txnType.value === 'DAILY_EXPENSE') {
                        if (label) label.innerText = 'Description';
                        if (txnRemark) txnRemark.placeholder = 'Enter description...';
                    } else {
                        if (label) label.innerText = 'Note / Remark';
                        if (txnRemark) txnRemark.placeholder = 'Enter remark...';
                    }
                } else {
                    remarkFieldContainer.classList.add('hidden');
                    if (txnRemark) txnRemark.value = '';
                }
            }
            if (addressFieldContainer) addressFieldContainer.classList.add('hidden');
            
            // Charges Field Visibility
            if (chargesFieldContainer) {
                if (isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery || isCashMovement) {
                    chargesFieldContainer.classList.add('hidden');
                    if (chargesModeContainer) {
                        chargesModeContainer.classList.add('hidden');
                    }
                } else if (['JIO_TOPUP', 'ROINET_COMMISSION', 'SETTLEMENT'].includes(txnType.value)) {
                    chargesFieldContainer.classList.remove('hidden');
                    if (chargesModeContainer) chargesModeContainer.classList.add('hidden');
                } else {
                    chargesFieldContainer.classList.remove('hidden');
                    if (chargesModeContainer) {
                        chargesModeContainer.classList.remove('hidden');
                        const label = chargesModeContainer.querySelector('label');
                        if (label) label.innerText = isDamagedRecovery ? 'CONVERTED TO' : (['DISHTV_RECHARGE', 'JIO_RECHARGE', 'ELECTRICITY_BILL'].includes(txnType.value) ? 'CUST PAID IN' : 'CHARGES MODE');
                    }
                }
            }
            
            if (isChargesOnly) txnAmount.value = '';
            if (isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery || isCashMovement) txnCharges.value = '';
            if (!isNoteAndAmount && !isCredit && txnType.value !== 'OTHER_INCOME' && !isDamagedRecovery && !isCashMovement) txnNote.value = '';
            txnAddress.value = '';
            txnConditional.value = '';
        } else {
            if (amountFieldContainer) amountFieldContainer.classList.remove('hidden');
            if (noteFieldContainer) {
                noteFieldContainer.classList.remove('hidden');
                const label = noteFieldContainer.querySelector('label');
                if (txnType.value === 'ONLINE_WORK') {
                    if (label) label.innerText = 'Work Name';
                    if (txnNote) {
                        txnNote.classList.remove('hidden');
                        txnNote.placeholder = 'e.g. Pan Card, Voter ID...';
                    }
                    if (txnExpenseType) txnExpenseType.classList.add('hidden');
                } else if (txnType.value === 'ELECTRICITY_BILL') {
                    if (label) label.innerText = 'Customer Name';
                    if (txnNote) {
                        txnNote.classList.remove('hidden');
                        txnNote.placeholder = 'Enter Consumer No/Name...';
                    }
                    if (txnExpenseType) txnExpenseType.classList.add('hidden');
                } else {
                    if (label) label.innerText = 'Customer Name';
                    if (txnNote) {
                        txnNote.classList.remove('hidden');
                        txnNote.placeholder = 'Enter Name...';
                    }
                    if (txnExpenseType) txnExpenseType.classList.add('hidden');
                }
            }
            if (remarkFieldContainer) {
                remarkFieldContainer.classList.add('hidden');
                if (txnRemark) txnRemark.value = '';
            }
            if (addressFieldContainer) {
                if (['ONLINE_WORK', 'ELECTRICITY_BILL'].includes(txnType.value)) addressFieldContainer.classList.add('hidden');
                else addressFieldContainer.classList.remove('hidden');
            }
            if (chargesFieldContainer) chargesFieldContainer.classList.remove('hidden');
            if (chargesModeContainer) {
                chargesModeContainer.classList.remove('hidden');
                const label = chargesModeContainer.querySelector('label');
                if (label) label.innerText = (['DISHTV_RECHARGE', 'JIO_RECHARGE', 'ELECTRICITY_BILL'].includes(txnType.value)) ? 'CUST PAID IN' : 'CHARGES MODE';
            }
            
            if (txnType.value === 'AEPS') {
                conditionalContainer.classList.remove('hidden');
                conditionalLabel.innerText = 'Aadhar (Last 4 Digits)';
                txnConditional.placeholder = 'Last 4 digits...';
            } else if (txnType.value === 'MATM') {
                conditionalContainer.classList.remove('hidden');
                conditionalLabel.innerText = 'Debit Card (Last 4)';
                txnConditional.placeholder = 'Last 4 digits...';
            } else {
                conditionalContainer.classList.add('hidden');
            }
        }

        if (quantityFieldContainer && quantityLabel && txnQuantity) {
            if (['PHOTOCOPY', 'PRINTOUT', 'PASSPORT', 'LAMINATION'].includes(txnType.value)) {
                quantityFieldContainer.classList.remove('hidden');
                if (txnType.value === 'PASSPORT') {
                    quantityLabel.innerText = 'PIECES / QUANTITY';
                    txnQuantity.placeholder = 'No. of pieces...';
                } else if (txnType.value === 'LAMINATION') {
                    quantityLabel.innerText = 'QUANTITY';
                    txnQuantity.placeholder = 'Quantity...';
                } else {
                    quantityLabel.innerText = 'PAGES / QUANTITY';
                    txnQuantity.placeholder = 'No. of pages...';
                }
            } else {
                quantityFieldContainer.classList.add('hidden');
                txnQuantity.value = '';
            }
        }

        if (laminationSizeContainer && txnLaminationSize) {
            if (txnType.value === 'LAMINATION') {
                laminationSizeContainer.classList.remove('hidden');
            } else {
                laminationSizeContainer.classList.add('hidden');
                txnLaminationSize.value = 'ID Card';
            }
        }

        // Set Default Charges Mode based on Type
        if (['JIO_TOPUP', 'ROINET_COMMISSION'].includes(txnType.value)) {
            if (txnChargesType) txnChargesType.value = 'Online';
        } else if (!editingTxnId && txnChargesType) {
            // Default to Cash for others if creating new
            txnChargesType.value = 'Cash';
        }

        // Service Provider & Remaining Amount Visibility
        const providerTypes = ['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL', 'FREE_DEPOSIT', 'FREE_WITHDRAWAL', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'DISHTV_RECHARGE', 'JIO_RECHARGE', 'ELECTRICITY_BILL', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE', 'SETTLEMENT', 'ONLINE_WORK', 'DAMAGED_RECOVERY'];
        const remainingTypes = ['AEPS', 'MATM'];
        
        const providerLabel = document.querySelector('#provider-field-container label');
        const providerFirstOpt = txnProvider ? txnProvider.querySelector('option[value=""]') : null;

        if (providerTypes.includes(txnType.value)) {
            providerContainer.classList.remove('hidden');
            if (['FREE_DEPOSIT', 'FREE_WITHDRAWAL'].includes(txnType.value)) {
                if (providerLabel) providerLabel.innerText = 'Reason';
                if (providerFirstOpt) providerFirstOpt.innerText = 'Select Reason...';
                if (amountLabel) amountLabel.innerText = 'Amount';
            } else if (isCredit || ['DAMAGED_RECOVERY', 'ONLINE_WORK', 'JIO_RECHARGE'].includes(txnType.value)) {
                if (providerLabel) providerLabel.innerText = txnType.value === 'DAILY_EXPENSE' ? 'Exp Mode' : (txnType.value === 'DAMAGED_RECOVERY' ? 'Recovered To' : 'Pay Mode');
                if (providerFirstOpt) providerFirstOpt.innerText = txnType.value === 'DAILY_EXPENSE' ? 'Select Exp Mode...' : (txnType.value === 'DAMAGED_RECOVERY' ? 'Select Option...' : 'Select Pay Mode...');
                if (amountLabel) amountLabel.innerText = txnType.value === 'ONLINE_WORK' ? 'Txn Amount' : (txnType.value === 'JIO_RECHARGE' ? 'Recharge Amount' : 'Amount');
            } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL'].includes(txnType.value)) {
                if (providerLabel) providerLabel.innerText = 'Service Provider';
                if (providerFirstOpt) providerFirstOpt.innerText = 'Select Provider...';
                if (amountLabel) amountLabel.innerText = txnType.value === 'ELECTRICITY_BILL' ? 'Bill Amount' : 'Recharge Amount';
            } else {
                if (providerLabel) providerLabel.innerText = 'Service Provider';
                if (providerFirstOpt) providerFirstOpt.innerText = 'Select Provider...';
                if (amountLabel) amountLabel.innerText = 'Txn Amount';
            }
        } else {
            providerContainer.classList.add('hidden');
            txnProvider.value = '';
            if (amountLabel) amountLabel.innerText = 'Amount';
        }

        // Deposit By / Received By field visibility (DEPOSIT & WITHDRAWAL only)
        if (depositByContainer && txnDepositBy) {
            if (['ONLINE_WORK', 'DEPOSIT', 'WITHDRAWAL', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value)) {
                depositByContainer.classList.remove('hidden');
                const depositByLabel = document.getElementById('depositby-label');
                if (depositByLabel) {
                    if (txnType.value === 'ONLINE_WORK' || txnType.value === 'CASH_WITHDRAWAL') {
                        depositByLabel.innerText = 'Debited By';
                    } else if (txnType.value === 'CASH_DEPOSIT') {
                        depositByLabel.innerText = 'Credit By';
                    } else {
                        depositByLabel.innerText = txnType.value === 'WITHDRAWAL' ? 'Received By' : 'Deposit By';
                    }
                }
            } else {
                depositByContainer.classList.add('hidden');
                txnDepositBy.value = '';
            }
        }

        // Received In field visibility (ONLINE_WORK only, when pay mode is Online)
        if (receivedInContainer && txnReceivedIn) {
            if (txnType.value === 'ONLINE_WORK' && txnProvider && txnProvider.value === 'Online') {
                receivedInContainer.classList.remove('hidden');
            } else {
                receivedInContainer.classList.add('hidden');
                txnReceivedIn.value = '';
            }
        }

        if (chargesAccountContainer && txnChargesAccount) {
            if (txnChargesType && txnChargesType.value === 'Online') {
                chargesAccountContainer.classList.remove('hidden');
                chargesAccountContainer.style.order = txnType.value === 'ONLINE_WORK' ? '8' : '99';
                const chargesLabel = document.getElementById('charges-account-label');
                if (chargesLabel) {
                    chargesLabel.innerText = txnType.value === 'ONLINE_WORK' ? 'Received In' : 'Charges Account';
                }
            } else {
                chargesAccountContainer.classList.add('hidden');
                chargesAccountContainer.style.order = '';
                txnChargesAccount.value = '';
            }
        }

        // Service Provider Options Filtering
        if (txnProvider) {
            const aepsMatmProviders = ['Airtel(Parsu)', 'Airtel(Dalai)', 'Roinet(Parsu)', 'Roinet(Dalai)', 'SpiceMoney', 'Crgb Bc'];
            const depositWithdrawProviders = ['Phonepay', 'Gpay', 'Slice', 'Yono sbi', 'Online(Parsu)', 'Online(Dalai)', 'Online'];
            
            const isAepsMatm = ['AEPS', 'MATM', 'SETTLEMENT'].includes(txnType.value);
            const isDepositWithdraw = ['DEPOSIT', 'WITHDRAWAL'].includes(txnType.value);
            const isCredit = ['CREDIT_GIVEN', 'CREDIT_RECEIVED', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE'].includes(txnType.value);
            
            Array.from(txnProvider.options).forEach(opt => {
                if (!opt.value) return; // Skip placeholder
                
                if (txnType.value === 'FREE_DEPOSIT') {
                    opt.style.display = ['aeps and deposit', 'matm and deposit', 'Other reason'].includes(opt.value) ? '' : 'none';
                } else if (txnType.value === 'FREE_WITHDRAWAL') {
                    opt.style.display = ['transfer and matm', 'transfer and aeps', 'service and withdrawl', 'Other reason'].includes(opt.value) ? '' : 'none';
                } else if (isAepsMatm) {
                    opt.style.display = aepsMatmProviders.includes(opt.value) ? '' : 'none';
                } else if (isDepositWithdraw) {
                    opt.style.display = depositWithdrawProviders.includes(opt.value) ? '' : 'none';
                } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL'].includes(txnType.value)) {
                    opt.style.display = ['Online', 'Airtel(Parsu)', 'Airtel(Dalai)', 'Roinet(Parsu)', 'Roinet(Dalai)', 'SpiceMoney'].includes(opt.value) ? '' : 'none';
                } else if (isCredit || ['JIO_RECHARGE', 'ONLINE_WORK', 'DAMAGED_RECOVERY'].includes(txnType.value)) {
                    opt.style.display = ['Cash', 'Online'].includes(opt.value) ? '' : 'none';
                } else {
                    opt.style.display = ''; // Show all for other types
                }
            });

            // If current selected option is now hidden, reset to empty
            if (txnProvider.selectedOptions[0] && txnProvider.selectedOptions[0].style.display === 'none') {
                txnProvider.value = '';
            }
        }

        if (remainingTypes.includes(txnType.value)) {
            remainingContainer.classList.remove('hidden');
        } else {
            remainingContainer.classList.add('hidden');
            txnRemaining.value = '';
        }

        // Bank Name Visibility
        if (['AEPS', 'MATM', 'SETTLEMENT', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value)) {
            bankContainer.classList.remove('hidden');
            const bankLabel = bankContainer.querySelector('label');
            const isCashMove = ['CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value);
            if (bankLabel) bankLabel.innerText = isCashMove ? 'Bank Account' : 'Bank Name';
            
            const txnBankSelect = document.getElementById('txn-bank-select');
            const customContainer = document.getElementById('custom-bank-select-container');
            if (isCashMove) {
                if (txnBank) {
                    txnBank.classList.add('hidden');
                    txnBank.required = false;
                }
                if (customContainer) customContainer.classList.remove('hidden');
            } else {
                if (customContainer) customContainer.classList.add('hidden');
                if (txnBankSelect) {
                    txnBankSelect.value = '';
                }
                const customSearch = document.getElementById('custom-bank-search');
                if (customSearch) customSearch.value = '';
                if (txnBank) {
                    txnBank.classList.remove('hidden');
                    txnBank.placeholder = 'Enter or select bank...';
                }
            }
        } else {
            bankContainer.classList.add('hidden');
            if (txnBank) txnBank.value = '';
            const txnBankSelect = document.getElementById('txn-bank-select');
            if (txnBankSelect) {
                txnBankSelect.value = '';
            }
            const customSearch = document.getElementById('custom-bank-search');
            if (customSearch) customSearch.value = '';
            const customContainer = document.getElementById('custom-bank-select-container');
            if (customContainer) customContainer.classList.add('hidden');
        }

        if (txnType.value === 'CASH_WITHDRAWAL') {
            if (methodContainer) methodContainer.classList.remove('hidden');
        } else {
            if (methodContainer) methodContainer.classList.add('hidden');
            if (txnMethod) txnMethod.value = 'ATM';
        }

        if (txnNote) {
            if (['CREDIT_GIVEN', 'CREDIT_RECEIVED'].includes(txnType.value)) {
                txnNote.setAttribute('list', 'customer-list');
                populateCustomerSuggestions();
            } else {
                txnNote.removeAttribute('list');
            }
        }

        // Reset order for all form containers
        [providerContainer, bankContainer, methodContainer, amountFieldContainer, remainingContainer, noteFieldContainer, remarkFieldContainer, addressFieldContainer, conditionalContainer, laminationSizeContainer, quantityFieldContainer, chargesFieldContainer, chargesModeContainer, depositByContainer, receivedInContainer, chargesAccountContainer].forEach(c => {
            if (c) c.style.order = '0';
        });

        if (txnType.value === 'ONLINE_WORK') {
            if (noteFieldContainer) noteFieldContainer.style.order = '1';
            if (amountFieldContainer) amountFieldContainer.style.order = '2';
            if (depositByContainer) depositByContainer.style.order = '3';
            if (providerContainer) providerContainer.style.order = '4';
            if (receivedInContainer) receivedInContainer.style.order = '5';
            if (chargesFieldContainer) chargesFieldContainer.style.order = '6';
            if (chargesModeContainer) chargesModeContainer.style.order = '7';
            if (chargesAccountContainer) chargesAccountContainer.style.order = '8';
        }
    };

    if (txnType) {
        txnType.addEventListener('change', updateConditionalField);
        if (txnProvider) txnProvider.addEventListener('change', updateConditionalField);
        if (txnAmount) txnAmount.addEventListener('input', updateConditionalField);
        if (txnChargesType) txnChargesType.addEventListener('change', updateConditionalField);
        updateConditionalField();
        txnType.focus();
        setTimeout(() => txnType.focus(), 50);
    }

    function showValidationToast(msg) {
        let container = document.getElementById('validation-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'validation-toast-container';
            container.className = 'fixed top-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto flex items-center gap-3.5 px-4.5 py-4 bg-rose-600/95 dark:bg-rose-500/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-white/20 transform translate-x-full opacity-0 transition-all duration-300 ease-out';
        toast.innerHTML = `
            <span class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <span class="material-symbols-outlined text-xl font-bold">error</span>
            </span>
            <div class="flex flex-col leading-tight">
                <span class="text-[10px] font-black uppercase tracking-widest text-white/80">Validation Alert</span>
                <span class="text-sm font-bold text-white mt-0.5">${msg}</span>
            </div>
        `;
        container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });
        
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 350);
        }, 4000);
    }

    function validateDailyTxnForm() {
        form.querySelectorAll('.border-rose-500').forEach(el => {
            el.classList.remove('border-rose-500', 'ring-2', 'ring-rose-500', 'animate-shake');
        });

        const valType = txnType ? txnType.value.trim() : '';
        if (!valType) {
            return { valid: false, element: txnType, message: 'Please select a Transaction Type' };
        }

        const isVisible = (el) => {
            if (!el) return false;
            const container = el.closest('div[id]');
            if (container && container.classList.contains('hidden')) return false;
            if (el.classList.contains('hidden') || el.style.display === 'none') return false;
            return true;
        };

        if (isVisible(txnProvider)) {
            if (!txnProvider.value.trim()) {
                const labelText = txnProvider.closest('div').querySelector('label')?.innerText || 'Service Provider / Mode';
                return { valid: false, element: txnProvider, message: `Please select ${labelText}` };
            }
        }

        const bankContainer = document.getElementById('bank-field-container');
        if (bankContainer && !bankContainer.classList.contains('hidden')) {
            const customBankContainer = document.getElementById('custom-bank-select-container');
            if (customBankContainer && !customBankContainer.classList.contains('hidden')) {
                const txnBankSelect = document.getElementById('txn-bank-select');
                if (!txnBankSelect || !txnBankSelect.value.trim()) {
                    const selBox = document.getElementById('custom-bank-selected-box') || customBankContainer;
                    return { valid: false, element: selBox, message: 'Please select a Bank Account' };
                }
            } else if (isVisible(txnBank)) {
                if (!txnBank.value.trim()) {
                    return { valid: false, element: txnBank, message: 'Please enter or select a Bank Name' };
                }
            }
        }

        const methodContainer = document.getElementById('method-field-container');
        if (methodContainer && !methodContainer.classList.contains('hidden')) {
            const txnMethod = document.getElementById('txn-method');
            if (txnMethod && !txnMethod.value.trim()) {
                return { valid: false, element: txnMethod, message: 'Please select a Withdrawal Method' };
            }
        }

        if (isVisible(txnAmount)) {
            if (txnAmount.value.trim() === '') {
                const labelText = document.getElementById('amount-label')?.innerText || 'Amount';
                return { valid: false, element: txnAmount, message: `Please enter ${labelText}` };
            }
            const amtVal = parseFloat(txnAmount.value);
            if (isNaN(amtVal) || amtVal <= 0) {
                const labelText = document.getElementById('amount-label')?.innerText || 'Amount';
                return { valid: false, element: txnAmount, message: `Please enter a valid ${labelText} (> 0)` };
            }
        }

        const remainingContainer = document.getElementById('remaining-field-container');
        if (remainingContainer && !remainingContainer.classList.contains('hidden')) {
            const txnRemaining = document.getElementById('txn-remaining');
            if (txnRemaining && txnRemaining.value.trim() === '') {
                return { valid: false, element: txnRemaining, message: 'Please enter Remaining Amount' };
            }
        }

        const noteContainer = document.getElementById('note-field-container');
        if (noteContainer && !noteContainer.classList.contains('hidden')) {
            const txnExpenseType = document.getElementById('txn-expense-type');
            if (isVisible(txnExpenseType)) {
                if (!txnExpenseType.value.trim()) {
                    return { valid: false, element: txnExpenseType, message: 'Please select Expense Type' };
                }
            } else if (isVisible(txnNote)) {
                if (!txnNote.value.trim()) {
                    const labelText = noteContainer.querySelector('label')?.innerText || 'Customer Name';
                    return { valid: false, element: txnNote, message: `Please enter ${labelText}` };
                }
            }
        }

        const remarkContainer = document.getElementById('remark-field-container');
        if (remarkContainer && !remarkContainer.classList.contains('hidden')) {
            const txnRemark = document.getElementById('txn-remark');
            if (txnRemark && !txnRemark.value.trim()) {
                const labelText = remarkContainer.querySelector('label')?.innerText || 'Note / Remark';
                return { valid: false, element: txnRemark, message: `Please enter ${labelText}` };
            }
        }

        const addressContainer = document.getElementById('address-field-container');
        if (addressContainer && !addressContainer.classList.contains('hidden')) {
            const txnAddress = document.getElementById('txn-address');
            if (txnAddress && !txnAddress.value.trim()) {
                return { valid: false, element: txnAddress, message: 'Please enter Address / City / Village' };
            }
        }

        const conditionalContainer = document.getElementById('conditional-field-container');
        if (conditionalContainer && !conditionalContainer.classList.contains('hidden')) {
            const txnConditional = document.getElementById('txn-conditional');
            if (txnConditional && !txnConditional.value.trim()) {
                const labelText = document.getElementById('conditional-label')?.innerText || 'Aadhar / Debit Card';
                return { valid: false, element: txnConditional, message: `Please enter ${labelText}` };
            }
        }

        const laminationContainer = document.getElementById('lamination-size-container');
        if (laminationContainer && !laminationContainer.classList.contains('hidden')) {
            const txnLaminationSize = document.getElementById('txn-lamination-size');
            if (txnLaminationSize && !txnLaminationSize.value.trim()) {
                return { valid: false, element: txnLaminationSize, message: 'Please select Lamination Size' };
            }
        }

        const quantityContainer = document.getElementById('quantity-field-container');
        if (quantityContainer && !quantityContainer.classList.contains('hidden')) {
            const txnQuantity = document.getElementById('txn-quantity');
            if (txnQuantity && !txnQuantity.value.trim()) {
                const labelText = document.getElementById('quantity-label')?.innerText || 'Pages / Quantity';
                return { valid: false, element: txnQuantity, message: `Please enter ${labelText}` };
            }
            const qtyVal = parseInt(txnQuantity.value);
            if (isNaN(qtyVal) || qtyVal <= 0) {
                const labelText = document.getElementById('quantity-label')?.innerText || 'Pages / Quantity';
                return { valid: false, element: txnQuantity, message: `Please enter valid ${labelText} (> 0)` };
            }
        }

        const chargesContainer = document.getElementById('charges-field-container');
        if (chargesContainer && !chargesContainer.classList.contains('hidden')) {
            const txnCharges = document.getElementById('txn-charges');
            if (txnCharges && txnCharges.value.trim() === '') {
                return { valid: false, element: txnCharges, message: 'Please enter Charges (e.g. 0)' };
            }
        }

        const chargesModeContainer = document.getElementById('charges-mode-container');
        if (chargesModeContainer && !chargesModeContainer.classList.contains('hidden')) {
            const txnChargesType = document.getElementById('txn-charges-type');
            if (txnChargesType && !txnChargesType.value.trim()) {
                const labelText = chargesModeContainer.querySelector('label')?.innerText || 'Charges Mode';
                return { valid: false, element: txnChargesType, message: `Please select ${labelText}` };
            }
        }

        if (isVisible(txnDepositBy)) {
            if (!txnDepositBy.value.trim()) {
                const labelText = document.getElementById('depositby-label')?.innerText || 'Deposit By';
                return { valid: false, element: txnDepositBy, message: `Please select ${labelText}` };
            }
        }

        if (isVisible(txnReceivedIn)) {
            if (!txnReceivedIn.value.trim()) {
                const labelText = document.getElementById('receivedin-label')?.innerText || 'Received In';
                return { valid: false, element: txnReceivedIn, message: `Please select ${labelText}` };
            }
        }

        if (isVisible(txnChargesAccount)) {
            if (!txnChargesAccount.value.trim()) {
                const labelText = document.getElementById('charges-account-label')?.innerText || 'Charges Account';
                return { valid: false, element: txnChargesAccount, message: `Please select ${labelText}` };
            }
        }

        return { valid: true };
    }

    // Attach Submit Listener EARLY
    form.onsubmit = async (e) => {
        e.preventDefault();
        console.log('Save Button Clicked - Starting process');
        
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const validation = validateDailyTxnForm();
        if (!validation.valid) {
            showValidationToast(validation.message);
            if (validation.element) {
                validation.element.classList.add('border-rose-500', 'ring-2', 'ring-rose-500', 'animate-shake');
                validation.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                validation.element.focus();
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
            }
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Saving...';
        }

        try {
            const chargesOnlyTypes = ['PHOTOCOPY', 'PRINTOUT', 'PASSPORT', 'LAMINATION', 'ROINET_COMMISSION', 'OTHER_INCOME'];
            const isChargesOnly = chargesOnlyTypes.includes(txnType.value);
            
            const amountVal = isChargesOnly ? 0 : parseFloat(txnAmount.value);
            const chargesVal = parseFloat(txnCharges.value || 0);

            // Strict Customer Validation for Credit Transactions
            if (['CREDIT_GIVEN', 'CREDIT_RECEIVED'].includes(txnType.value)) {
                const customers = await loadCustomers();
                const inputName = txnNote.value.trim().toLowerCase();
                const exists = customers.some(c => c.name && c.name.trim().toLowerCase() === inputName);
                if (!exists) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Customer Not Found',
                        text: 'Please add customer first in Credit Ledger page.',
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
            }

            const existingTxn = editingTxnId ? allTxnsForDate.find(t => t.id === editingTxnId) : null;

            // Validation & Checks for Cash Movements
            if (['CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value)) {
                const txnBankSelect = document.getElementById('txn-bank-select');
                const selectedBankVal = txnBankSelect ? txnBankSelect.value.trim() : (txnBank ? txnBank.value.trim() : '');
                let effOnline = currentAvailableOnline;
                let effCash = currentAvailableCash;
                if (existingTxn && existingTxn.type === 'CASH_WITHDRAWAL') {
                    effOnline += parseFloat(existingTxn.amount || 0);
                    effCash -= parseFloat(existingTxn.amount || 0);
                } else if (existingTxn && existingTxn.type === 'CASH_DEPOSIT') {
                    effCash += parseFloat(existingTxn.amount || 0);
                    effOnline -= parseFloat(existingTxn.amount || 0);
                }
                if (txnType.value === 'CASH_WITHDRAWAL' && amountVal > effOnline) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Online Balance',
                        text: `You only have ₹ ${effOnline.toLocaleString('en-IN')} available online to withdraw. Please check your account balances.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
                if (txnType.value === 'CASH_DEPOSIT' && amountVal > effCash) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Cash Balance',
                        text: `You only have ₹ ${effCash.toLocaleString('en-IN')} available in cash to deposit. Please check your shop cash balance.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
                if (amountVal > 50000) {
                    const actionText = txnType.value === 'CASH_WITHDRAWAL' ? 'withdraw' : 'deposit';
                    const confirm = await Swal.fire({
                        icon: 'warning',
                        title: 'Large Cash Movement',
                        text: `Are you sure you want to ${actionText} ₹ ${amountVal.toLocaleString('en-IN')}?`,
                        showCancelButton: true,
                        confirmButtonColor: '#10b981',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: 'Yes, proceed'
                    });
                    if (!confirm.isConfirmed) {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                        }
                        return;
                    }
                }
            }

            // Cash Sufficiency Check for AEPS, MATM, WITHDRAWAL, DAMAGED_CURRENCY
            if (['AEPS', 'MATM', 'WITHDRAWAL', 'DAMAGED_CURRENCY'].includes(txnType.value)) {
                let effCash = currentAvailableCash;
                if (existingTxn && ['AEPS', 'MATM', 'WITHDRAWAL', 'DAMAGED_CURRENCY'].includes(existingTxn.type)) {
                    effCash += parseFloat(existingTxn.amount || 0);
                }
                if (amountVal > effCash) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Cash',
                        text: `You only have ₹ ${effCash.toLocaleString('en-IN')} available in cash. Please add more cash or check your balances.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
            }

            // Online Sufficiency Check for DEPOSIT
            if (txnType.value === 'DEPOSIT') {
                let effOnline = currentAvailableOnline;
                if (existingTxn && existingTxn.type === 'DEPOSIT') {
                    effOnline += parseFloat(existingTxn.amount || 0);
                }
                if (amountVal > effOnline) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Online Balance',
                        text: `You only have ₹ ${effOnline.toLocaleString('en-IN')} available online. Please check your account balances.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
            }

            // Sufficiency Check for SHARE_WITHDRAWN
            if (txnType.value === 'SHARE_WITHDRAWN') {
                let available = txnProvider.value === 'Online' ? currentAvailableOnline : currentAvailableCash;
                if (existingTxn && existingTxn.type === 'SHARE_WITHDRAWN' && existingTxn.provider === txnProvider.value) {
                    available += parseFloat(existingTxn.amount || 0);
                }
                const mode = txnProvider.value || 'Cash';
                if (amountVal > available) {
                    Swal.fire({
                        icon: 'error',
                        title: `Insufficient ${mode} Balance`,
                        text: `You only have ₹ ${available.toLocaleString('en-IN')} available in ${mode.toLowerCase()}.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
            }

            // Jio Sufficiency Check for JIO_RECHARGE
            if (txnType.value === 'JIO_RECHARGE') {
                let effJio = currentAvailableJio;
                if (existingTxn && existingTxn.type === 'JIO_RECHARGE') {
                    effJio += parseFloat(existingTxn.amount || 0);
                }
                if (amountVal > effJio) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Jio Balance',
                        text: `You only have ₹ ${effJio.toLocaleString('en-IN')} available in Jio. Please add funds to Jio balance first.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
            }


            // Damaged Currency Sufficiency Check for DAMAGED_RECOVERY
            if (txnType.value === 'DAMAGED_RECOVERY') {
                let effDamaged = currentAvailableDamaged;
                if (existingTxn && existingTxn.type === 'DAMAGED_RECOVERY') {
                    effDamaged += parseFloat(existingTxn.amount || 0);
                }
                if (amountVal > effDamaged) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Damaged Balance',
                        text: `You only have ₹ ${effDamaged.toLocaleString('en-IN')} available in damaged currency. You cannot recover more than what you have.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
            }

            // Settlement Sufficiency Check
            if (txnType.value === 'SETTLEMENT') {
                const provider = txnProvider.value;
                let available = 0;
                let providerName = provider;

                if (provider === 'Roinet(Parsu)') { available = currentAvailableRoinet1; }
                else if (provider === 'Roinet(Dalai)') { available = currentAvailableRoinet2; }
                else if (provider === 'Airtel(Parsu)') { available = currentAvailableAirtel1; }
                else if (provider === 'Airtel(Dalai)') { available = currentAvailableAirtel2; }
                else if (provider === 'SpiceMoney') { available = currentAvailableSpiceMoney; }
                else if (provider === 'Crgb Bc') { available = currentAvailableCrgb; }
                else {
                    // Fallback to general Online if provider not specifically tracked
                    available = currentAvailableOnline;
                    providerName = provider || 'Selected Provider';
                }

                if (existingTxn && existingTxn.type === 'SETTLEMENT' && existingTxn.provider === provider) {
                    available += parseFloat(existingTxn.amount || 0);
                    available += parseFloat(existingTxn.charges || 0);
                }

                if (amountVal > available) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Provider Balance',
                        text: `The ${providerName} ID only has ₹ ${available.toLocaleString('en-IN')} available. You cannot settle more than what is in the ID.`,
                        confirmButtonColor: '#7c3aed'
                    });
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return;
                }
            }

            const capitalizeWords = (str) => {
                if (!str) return "";
                return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
            };

            const newTxn = {
                type: txnType.value,
                amount: amountVal,
                method: txnType.value === 'CASH_WITHDRAWAL' ? (txnMethod ? txnMethod.value : 'ATM') : '',
                charges: isNaN(chargesVal) ? 0 : chargesVal,
                pages: (['PHOTOCOPY', 'PRINTOUT', 'PASSPORT', 'LAMINATION'].includes(txnType.value)) ? (parseInt(txnQuantity.value) || 0) : 0,
                laminationSize: (txnType.value === 'LAMINATION') ? txnLaminationSize.value : '',
                note: txnType.value === 'DAILY_EXPENSE' ? (txnExpenseType.value || 'Daily Expense') : capitalizeWords(txnNote.value.trim()),
                remark: txnRemark ? capitalizeWords(txnRemark.value.trim()) : '',
                address: capitalizeWords(txnAddress.value.trim()),
                extraDetails: (['AEPS', 'MATM'].includes(txnType.value)) ? txnConditional.value.trim() : '',
                chargesAccount: typeof txnChargesAccount !== 'undefined' && txnChargesAccount ? txnChargesAccount.value : '',
                depositBy: (['ONLINE_WORK', 'DEPOSIT', 'WITHDRAWAL', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value)) ? (txnDepositBy ? txnDepositBy.value : '') : '',
                receivedIn: (txnType.value === 'ONLINE_WORK' && txnProvider.value === 'Online') ? (txnReceivedIn ? txnReceivedIn.value : '') : '',
                provider: (['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL', 'FREE_DEPOSIT', 'FREE_WITHDRAWAL', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'DISHTV_RECHARGE', 'JIO_RECHARGE', 'ELECTRICITY_BILL', 'PAN_CARD', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE', 'SETTLEMENT', 'ONLINE_WORK', 'DAMAGED_RECOVERY', 'ADD_CAPITAL', 'SHARE_WITHDRAWN', 'CSP_COMMISSION', 'ROINET_COMMISSION'].includes(txnType.value)) ? txnProvider.value : '',
                chargesType: txnChargesType ? txnChargesType.value : 'Cash',
                remainingAmount: (['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL'].includes(txnType.value)) ? parseFloat(txnRemaining.value || 0) : 0,
                bankName: (['CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value)) ? (document.getElementById('txn-bank-select') ? document.getElementById('txn-bank-select').value.trim() : '') : ((['AEPS', 'MATM', 'SETTLEMENT'].includes(txnType.value)) ? txnBank.value.trim() : ''),
                accountId: (['CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txnType.value)) ? (document.getElementById('txn-bank-select')?.options[document.getElementById('txn-bank-select')?.selectedIndex]?.getAttribute('data-account-id') || '') : '',
                date: currentSelectedDate,
                timestamp: editingTxnId && editingTxnTimestamp ? editingTxnTimestamp : { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
            };

            // --- Summary Confirmation Popup for specific types ---
            if (['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL'].includes(newTxn.type)) {
                const formatAmt = (amt) => '₹ ' + parseFloat(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                const formattedAmount = formatAmt(newTxn.amount);
                const remainingAmt = parseFloat(newTxn.remainingAmount || 0);
                const remainingColor = remainingAmt >= 500 ? 'text-emerald-600' : 'text-rose-600';

                const result = await Swal.fire({
                    title: '<span class="text-xl font-black text-slate-800">Confirm Transaction</span>',
                    html: `
                        <div class="flex flex-col gap-3 text-left mt-4">
                            <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span class="text-sm font-semibold text-slate-500">Transaction Type</span>
                                <span class="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${newTxn.type}</span>
                            </div>
                            <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span class="text-sm font-semibold text-slate-500">Customer Name</span>
                                <span class="text-sm font-bold text-slate-800">${newTxn.note || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span class="text-sm font-semibold text-slate-500">Aadhaar/Account</span>
                                <span class="text-sm font-mono font-bold text-slate-700">${newTxn.extraDetails || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span class="text-sm font-semibold text-slate-500">Bank/Provider</span>
                                <span class="text-sm font-bold text-slate-800">${newTxn.bankName || newTxn.provider || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span class="text-sm font-semibold text-slate-500">Charges</span>
                                <span class="text-sm font-black ${newTxn.charges > 0 ? 'text-rose-500' : 'text-slate-800'}">₹ ${parseFloat(newTxn.charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div class="flex flex-col gap-2 mt-2">
                                <div class="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                                    <span class="text-sm font-bold text-slate-600">Transaction Amount</span>
                                    <span class="text-2xl font-black text-primary">${formattedAmount}</span>
                                </div>
                                <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <span class="text-sm font-bold text-slate-600">Remaining Balance</span>
                                    <span class="text-lg font-black ${remainingColor}">${formatAmt(remainingAmt)}</span>
                                </div>
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: '<span class="material-symbols-outlined align-middle text-[18px] mr-1">check_circle</span> Confirm & Save',
                    cancelButtonText: '<span class="material-symbols-outlined align-middle text-[18px] mr-1">edit</span> Cancel / Edit',
                    confirmButtonColor: '#7c3aed',
                    cancelButtonColor: '#64748b',
                    reverseButtons: true,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    customClass: {
                        popup: 'rounded-[2rem] shadow-2xl border border-slate-100',
                        title: 'pt-2',
                        confirmButton: 'rounded-xl px-6 py-3 font-bold transition-transform hover:scale-105 active:scale-95',
                        cancelButton: 'rounded-xl px-6 py-3 font-bold transition-transform hover:scale-105 active:scale-95',
                        actions: 'gap-3 mt-6'
                    }
                });

                if (!result.isConfirmed) {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                    }
                    return; // Abort save
                }
                
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Saving...';
                }
            }
            // --- End Summary Confirmation Popup ---

            console.log('Attempting to ' + (editingTxnId ? 'update' : 'add') + ' doc in Firestore:', newTxn);
            const txnCollection = collection(db, 'daily_transactions');
            
            if (editingTxnId) {
                await updateDoc(doc(db, 'daily_transactions', editingTxnId), newTxn);
                console.log('Update Success!');
                await syncCreditFromDailyTxn(newTxn, editingTxnId, false);
                await syncBankWithdrawalFromDailyTxn(newTxn, editingTxnId, false);
            } else {
                const docRef = await addDoc(txnCollection, newTxn);
                console.log('Add Success!');
                await syncCreditFromDailyTxn(newTxn, docRef.id, false);
                await syncBankWithdrawalFromDailyTxn(newTxn, docRef.id, false);
            }

            resetFormState();
        } catch (err) {
            console.error('CRITICAL ERROR during save:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
            }
            setTimeout(() => { if (txnType) txnType.focus(); }, 10);
        }
    };

    // Setup Custom Keyboard TAB Navigation & Focus Trap strictly for Daily Txn Form
    function setupDailyTxnFocusTrap() {
        if (!form) return;
        
        if (window._dailyTxnFocusTrapHandler) {
            document.removeEventListener('keydown', window._dailyTxnFocusTrapHandler, true);
        }

        window._dailyTxnFocusTrapHandler = (e) => {
            const currentForm = document.getElementById('daily-txn-form');
            if (!currentForm) return;

            if (e.key === 'Tab') {
                e.preventDefault(); // Completely prevent default browser TAB behavior

                const focusableQuery = 'input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
                const elements = Array.from(currentForm.querySelectorAll(focusableQuery))
                    .filter(el => el.tabIndex >= 0 && el.offsetParent !== null && !el.closest('.hidden'));

                if (elements.length === 0) return;

                // Sort primarily by container's flex order if set, then tabindex
                elements.sort((a, b) => {
                    const containerA = a.closest('[style*="order"]');
                    const containerB = b.closest('[style*="order"]');
                    const orderA = containerA ? (parseInt(containerA.style.order) || 0) : 0;
                    const orderB = containerB ? (parseInt(containerB.style.order) || 0) : 0;

                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }

                    const tA = a.tabIndex > 0 ? a.tabIndex : 999;
                    const tB = b.tabIndex > 0 ? b.tabIndex : 999;
                    return tA - tB;
                });

                const currentIndex = elements.indexOf(document.activeElement);

                if (e.shiftKey) {
                    if (currentIndex <= 0) {
                        elements[elements.length - 1].focus();
                    } else {
                        elements[currentIndex - 1].focus();
                    }
                } else {
                    if (currentIndex === -1 || currentIndex >= elements.length - 1) {
                        elements[0].focus();
                    } else {
                        elements[currentIndex + 1].focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', window._dailyTxnFocusTrapHandler, true);
    }
    setupDailyTxnFocusTrap();


    async function updateDailyBalances(date, transactions, openingBalances) {
        if (!openingBalances) {
            console.error("updateDailyBalances called without openingBalances");
            return;
        }

        try {
            const opValues = {
                cash: parseFloat(openingBalances.cash || 0),
                online: parseFloat(openingBalances.online || 0),
                roinet: parseFloat(openingBalances.roinet || 0),
                jio: parseFloat(openingBalances.jio || 0),
                crgb: parseFloat(openingBalances.go2sms || 0),
                pending: parseFloat(openingBalances.pending || 0),
                expense: 0,
                damaged: parseFloat(openingBalances.damaged || 0),
                'credit-ledger': parseFloat(openingBalances['credit-ledger'] || 0),
                'cust-deposit': parseFloat(openingBalances['cust-deposit'] || 0)
            };

            const ids = ['cash', 'online', 'roinet', 'jio', 'crgb', 'pending', 'expense', 'damaged', 'credit-ledger', 'cust-deposit'];
            let balances = {
                cash: 0, online: 0, roinet: 0, jio: 0, crgb: 0, pending: 0, expense: 0, damaged: 0, 'credit-ledger': 0, 'cust-deposit': 0
            };
            
            // Per-provider roinet breakdown tracking
            const roinetBreakdown = { roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0 };
            const lastRoinetChanges = { roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0, total: 0 };

            // Per-provider online breakdown tracking
            const onlineBreakdown = { online_p1: 0, online_p2: 0, online_p3: 0, other: 0 };
            const lastOnlineChanges = { online_p1: 0, online_p2: 0, online_p3: 0, other: 0, total: 0 };
            const getOnlineDest = (prov) => {
                const lower = (prov || '').toLowerCase();
                if (lower.includes('parsu')) return 'online_p1';
                if (lower.includes('shop')) return 'online_p2';
                if (lower.includes('dalai')) return 'online_p3';
                return 'other';
            };

            const getSubAccountKey = (prov) => {
                if (prov.includes('roinet(parsu)') || prov === 'roinet_1') return 'roinet_1';
                if (prov.includes('roinet(dalai)') || prov === 'roinet_2') return 'roinet_2';
                if (prov.includes('airtel(parsu)') || prov === 'airtel_1') return 'airtel_1';
                if (prov.includes('airtel(dalai)') || prov === 'airtel_2') return 'airtel_2';
                if (prov.includes('spicemoney')) return 'spicemoney';
                if (prov.includes('airtel')) return 'airtel_1';
                if (prov.includes('roinet')) return 'roinet_1';
                return null;
            };

            const updateRoinetBreakdown = (prov, value) => {
                const key = getSubAccountKey(prov);
                if (key) {
                    roinetBreakdown[key] += value;
                }
            };

            // Re-calculate based on transactions
            transactions.forEach(t => {
                const amt = parseFloat(t.amount || 0);
                const chg = parseFloat(t.charges || 0);
                const provider = (t.provider || "").trim().toLowerCase();
                
                const prevBals = { ...balances };
                const prevOnlineBreakdown = { ...onlineBreakdown };
                const prevRoinetBreakdown = { ...roinetBreakdown };
                
                if (t.chargesType === 'Online') balances.online += chg;
                else balances.cash += chg;

                if (['AEPS', 'MATM', 'WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
                    balances.cash -= amt; 
                    // Add to Total Online
                    balances.online += amt;
                    // Also track individual account — Airtel & SpiceMoney go into Roinet
                    if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
                        balances.roinet += amt;
                        updateRoinetBreakdown(provider, amt);
                    }
                    else if (provider.includes('crgb')) balances.crgb += amt;
                    else if (provider.includes('jio')) balances.jio += amt;
                } else if (['DEPOSIT', 'ADMIN_DEPOSIT'].includes(t.type)) {
                    balances.cash += amt;
                    // Subtract from Total Online
                    balances.online -= amt;
                    // Also track individual account — Airtel & SpiceMoney go into Roinet
                    if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) balances.roinet -= amt;
                    else if (provider.includes('crgb')) balances.crgb -= amt;
                    else if (provider.includes('jio')) balances.jio -= amt;
                } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL'].includes(t.type)) {
                    balances.online -= amt;
                    if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
                        balances.roinet -= amt;
                        updateRoinetBreakdown(provider, -amt);
                    }
                    if (t.chargesType === 'Online') balances.online += amt;
                    else balances.cash += amt;
                } else if (t.type === 'JIO_RECHARGE') {
                    balances.jio -= amt;
                    balances.online -= amt; // Total digital decreases by recharge amount
                    if (provider === 'cash') balances.cash += amt;
                    else balances.online += amt; // Added back to digital if paid digitally
                } else if (t.type === 'JIO_TOPUP') {
                    balances.jio += (amt + chg); // Both topup and commission stay in Jio wallet
                    balances.online -= amt;
                    // Remove chg from where it was generically added at the start of the loop
                    if (t.chargesType === 'Online') balances.online -= chg;
                    else balances.cash -= chg;
                } else if (t.type === 'ROINET_COMMISSION') {
                    balances.roinet += chg;
                    balances.online += chg;
                } else if (t.type === 'OTHER_INCOME') {
                    if (provider === 'cash') balances.cash += amt;
                    else balances.online += amt;
                } else if (t.type === 'CREDIT_GIVEN') {
                    if (provider === 'cash') balances.cash -= amt;
                    else balances.online -= amt;
                    balances['credit-ledger'] += amt;
                } else if (t.type === 'CREDIT_RECEIVED') {
                    if (provider === 'cash') balances.cash += amt;
                    else balances.online += amt;
                    balances['credit-ledger'] -= amt;
                } else if (t.type === 'CUST_MONEY_IN') {
                    if (provider === 'cash') balances.cash += amt;
                    else balances.online += amt;
                    balances['cust-deposit'] += amt;
                } else if (t.type === 'CUST_MONEY_OUT') {
                    if (provider === 'cash') balances.cash -= amt;
                    else balances.online -= amt;
                    balances['cust-deposit'] -= amt;
                } else if (t.type === 'DAILY_EXPENSE') {
                    if (provider === 'cash') balances.cash -= amt;
                    else balances.online -= amt;
                    balances.expense += amt;
                } else if (t.type === 'DAMAGED_CURRENCY') {
                    balances.cash -= amt;
                    balances.damaged += amt;
                } else if (t.type === 'DAMAGED_RECOVERY') {
                    balances.damaged -= amt;
                    if (provider === 'cash') balances.cash += amt;
                    else {
                        balances.online += amt;
                        if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) balances.roinet += amt;
                        else if (provider.includes('crgb')) balances.crgb += amt;
                        else if (provider.includes('jio')) balances.jio += amt;
                    }
                } else if (t.type === 'CASH_WITHDRAWAL') {
                    balances.online -= amt;
                    balances.cash += amt;
                } else if (t.type === 'CASH_DEPOSIT') {
                    balances.cash -= amt;
                    balances.online += amt;
                } else if (t.type === 'SETTLEMENT') {
                    // Settlement between digital accounts has no net effect on 'Total Online'
                    if (provider === 'cash') {
                        balances.cash -= amt;
                        balances.online += amt;
                    }
                    // Subtract charges from where they were generically added
                    if (t.chargesType === 'Online') balances.online -= chg;
                    else balances.cash -= chg;

                    // But track individual account changes (Amount + Charges deducted from wallet)
                    const totalDeduction = amt + chg;
                    if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
                        balances.roinet -= totalDeduction;
                        // Track breakdown per provider
                        updateRoinetBreakdown(provider, -totalDeduction);
                    }
                    else if (provider.includes('crgb')) balances.crgb -= totalDeduction;
                    else if (provider.includes('jio')) balances.jio -= totalDeduction;
                    
                    // Add charges to expense
                    balances.expense += chg;
                } else if (t.type === 'ONLINE_WORK') {
                    balances.online -= amt;
                    const debitedDest = getOnlineDest(t.depositBy);
                    onlineBreakdown[debitedDest] -= amt;

                    if (provider === 'cash') {
                        balances.cash += amt;
                    } else {
                        balances.online += amt;
                        const receivedDest = getOnlineDest(t.receivedIn);
                        onlineBreakdown[receivedDest] += amt;
                    }

                    // Handle charges
                    if (t.chargesType === 'Online') {
                        const chargesProv = t.chargesAccount || t.receivedIn || t.depositBy;
                        const chgDest = getOnlineDest(chargesProv);
                        onlineBreakdown[chgDest] += chg;
                    }
                } else if (t.type === 'GOLD_SIP') {
                    balances.online -= amt;
                    balances.expense += amt;
                } else if (t.type === 'ONLINE_EXCHANGE') {
                    let sourceDest = 'other';
                    let targetDest = 'other';
                    const sourceProv = (t.paymentApp || '').toLowerCase();
                    const targetProv = (t.provider || '').toLowerCase();
                    
                    if (sourceProv.includes('parsu')) sourceDest = 'online_p1';
                    else if (sourceProv.includes('shop')) sourceDest = 'online_p2';
                    else if (sourceProv.includes('dalai')) sourceDest = 'online_p3';

                    if (targetProv.includes('parsu')) targetDest = 'online_p1';
                    else if (targetProv.includes('shop')) targetDest = 'online_p2';
                    else if (targetProv.includes('dalai')) targetDest = 'online_p3';

                    onlineBreakdown[sourceDest] -= amt;
                    onlineBreakdown[targetDest] += amt;
                }

                // Calculate exact deltas for Online breakdown if there was online movement
                const hasOnlineMovement = 
                    (balances.online !== prevBals.online) ||
                    (onlineBreakdown.online_p1 !== prevOnlineBreakdown.online_p1) ||
                    (onlineBreakdown.online_p2 !== prevOnlineBreakdown.online_p2) ||
                    (onlineBreakdown.online_p3 !== prevOnlineBreakdown.online_p3) ||
                    (onlineBreakdown.other !== prevOnlineBreakdown.other);

                if (hasOnlineMovement) {
                    lastOnlineChanges.online_p1 = onlineBreakdown.online_p1 - prevOnlineBreakdown.online_p1;
                    lastOnlineChanges.online_p2 = onlineBreakdown.online_p2 - prevOnlineBreakdown.online_p2;
                    lastOnlineChanges.online_p3 = onlineBreakdown.online_p3 - prevOnlineBreakdown.online_p3;
                    lastOnlineChanges.other = onlineBreakdown.other - prevOnlineBreakdown.other;
                    lastOnlineChanges.total = balances.online - prevBals.online;
                }

                // Calculate exact deltas for Roinet breakdown if there was roinet movement
                const hasRoinetMovement = 
                    (balances.roinet !== prevBals.roinet) ||
                    (roinetBreakdown.roinet_1 !== prevRoinetBreakdown.roinet_1) ||
                    (roinetBreakdown.roinet_2 !== prevRoinetBreakdown.roinet_2) ||
                    (roinetBreakdown.airtel_1 !== prevRoinetBreakdown.airtel_1) ||
                    (roinetBreakdown.airtel_2 !== prevRoinetBreakdown.airtel_2) ||
                    (roinetBreakdown.spicemoney !== prevRoinetBreakdown.spicemoney);

                if (hasRoinetMovement) {
                    lastRoinetChanges.roinet_1 = roinetBreakdown.roinet_1 - prevRoinetBreakdown.roinet_1;
                    lastRoinetChanges.roinet_2 = roinetBreakdown.roinet_2 - prevRoinetBreakdown.roinet_2;
                    lastRoinetChanges.airtel_1 = roinetBreakdown.airtel_1 - prevRoinetBreakdown.airtel_1;
                    lastRoinetChanges.airtel_2 = roinetBreakdown.airtel_2 - prevRoinetBreakdown.airtel_2;
                    lastRoinetChanges.spicemoney = roinetBreakdown.spicemoney - prevRoinetBreakdown.spicemoney;
                    lastRoinetChanges.total = balances.roinet - prevBals.roinet;
                }
            });

            const fmt = (val) => `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            
            ids.forEach(id => {
                const d = document.getElementById(`summary-${id}-balance`);
                const o = document.getElementById(`op-${id}`);
                const c = document.getElementById(`cl-${id}`);
                if (d) d.innerText = fmt(balances[id]);
                if (o) o.innerText = `₹ ${parseFloat(opValues[id] || 0).toLocaleString('en-IN')}`;
                if (c) c.innerText = `₹ ${(parseFloat(opValues[id] || 0) + (balances[id] || 0)).toLocaleString('en-IN')}`;
            });
            // Update global available balances for validation
            currentAvailableCash = (parseFloat(opValues.cash || 0) + (balances.cash || 0));
            currentAvailableOnline = (parseFloat(opValues.online || 0) + (balances.online || 0));
            currentAvailableJio = (parseFloat(opValues.jio || 0) + (balances.jio || 0));
            currentAvailableDamaged = (parseFloat(opValues.damaged || 0) + (balances.damaged || 0));
            currentAvailableCrgb = (parseFloat(opValues.crgb || 0) + (balances.crgb || 0));
            
            // ID Specific breakdown for validation & Modal
            const opRoinet = parseFloat(openingBalances.roinet_1 || 0) + parseFloat(openingBalances.roinet_2 || 0);
            const opAirtel = parseFloat(openingBalances.airtel_1 || 0) + parseFloat(openingBalances.airtel_2 || 0);
            const opSpiceMoney = parseFloat(openingBalances.spicemoney || 0);
            const totalSplitOpening = opRoinet + opAirtel + opSpiceMoney;
            const roinetOpeningFallback = totalSplitOpening > 0 ? totalSplitOpening : parseFloat(opValues.roinet || 0);

            currentAvailableRoinet1 = parseFloat(openingBalances.roinet_1 || 0) + roinetBreakdown.roinet_1;
            currentAvailableRoinet2 = parseFloat(openingBalances.roinet_2 || 0) + roinetBreakdown.roinet_2;
            currentAvailableAirtel1 = parseFloat(openingBalances.airtel_1 || 0) + roinetBreakdown.airtel_1;
            currentAvailableAirtel2 = parseFloat(openingBalances.airtel_2 || 0) + roinetBreakdown.airtel_2;
            currentAvailableSpiceMoney = parseFloat(openingBalances.spicemoney || 0) + roinetBreakdown.spicemoney;

            window._roinetBreakdown = {
                opening: {
                    roinet_1: parseFloat(openingBalances.roinet_1 || 0),
                    roinet_2: parseFloat(openingBalances.roinet_2 || 0),
                    airtel_1: parseFloat(openingBalances.airtel_1 || 0),
                    airtel_2: parseFloat(openingBalances.airtel_2 || 0),
                    spicemoney: parseFloat(openingBalances.spicemoney || 0),
                    total: roinetOpeningFallback
                },
                closing: {
                    roinet_1: parseFloat(openingBalances.roinet_1 || 0) + roinetBreakdown.roinet_1,
                    roinet_2: parseFloat(openingBalances.roinet_2 || 0) + roinetBreakdown.roinet_2,
                    airtel_1: parseFloat(openingBalances.airtel_1 || 0) + roinetBreakdown.airtel_1,
                    airtel_2: parseFloat(openingBalances.airtel_2 || 0) + roinetBreakdown.airtel_2,
                    spicemoney: parseFloat(openingBalances.spicemoney || 0) + roinetBreakdown.spicemoney,
                    total: roinetOpeningFallback + (balances.roinet || 0)
                },
                lastChange: {
                    roinet_1: lastRoinetChanges.roinet_1,
                    roinet_2: lastRoinetChanges.roinet_2,
                    airtel_1: lastRoinetChanges.airtel_1,
                    airtel_2: lastRoinetChanges.airtel_2,
                    spicemoney: lastRoinetChanges.spicemoney,
                    total: lastRoinetChanges.total
                }
            };

            const opOnlineP1 = parseFloat(openingBalances.online_p1 || 0);
            const opOnlineP2 = parseFloat(openingBalances.online_p2 || 0);
            const opOnlineP3 = parseFloat(openingBalances.online_p3 || 0);
            const totalSplitOnline = opOnlineP1 + opOnlineP2 + opOnlineP3;
            const onlineOpeningFallback = parseFloat(opValues.online || 0);

            window._onlineBreakdown = {
                opening: {
                    online_p1: opOnlineP1,
                    online_p2: opOnlineP2,
                    online_p3: opOnlineP3,
                    other: totalSplitOnline > 0 ? (onlineOpeningFallback - totalSplitOnline) : onlineOpeningFallback,
                    total: onlineOpeningFallback
                },
                closing: {
                    online_p1: opOnlineP1 + onlineBreakdown.online_p1,
                    online_p2: opOnlineP2 + onlineBreakdown.online_p2,
                    online_p3: opOnlineP3 + onlineBreakdown.online_p3,
                    other: (totalSplitOnline > 0 ? (onlineOpeningFallback - totalSplitOnline) : onlineOpeningFallback) + onlineBreakdown.other,
                    total: onlineOpeningFallback + balances.online
                },
                lastChange: {
                    online_p1: lastOnlineChanges.online_p1,
                    online_p2: lastOnlineChanges.online_p2,
                    online_p3: lastOnlineChanges.online_p3,
                    other: lastOnlineChanges.other,
                    total: lastOnlineChanges.total
                }
            };
        } catch (err) {
            console.error('Error updating daily balances:', err);
        }
    };

    const loadTransactions = (date) => {
        console.log('Loading Transactions for:', date);
        if (unsubscribe) unsubscribe();
        currentSelectedDate = date;

        const displayDate = new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        if (txnDateText) txnDateText.innerText = displayDate;

        try {
            const tableBody = document.getElementById('daily-txn-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="100" class="px-6 py-24 text-center">
                            <div class="inline-flex flex-col items-center justify-center gap-5 p-8 rounded-3xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/10 backdrop-blur-xl shadow-xl max-w-sm w-full mx-auto animate-fadeIn">
                                <div class="relative flex items-center justify-center">
                                    <div class="absolute size-14 rounded-full bg-primary/20 blur-md animate-pulse"></div>
                                    <div class="size-12 rounded-full border-4 border-primary/10 border-t-primary border-r-primary/50 animate-spin"></div>
                                    <div class="absolute size-3 rounded-full bg-primary animate-ping"></div>
                                </div>
                                <div class="space-y-2">
                                    <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest leading-none">Fetching Transactions</h4>
                                    <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Please wait while we sync with database...</p>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }

            const dateQueries = getPossibleDateFormats(date);
            const txnCollection = collection(db, 'daily_transactions');
            const q = query(txnCollection, where('date', 'in', dateQueries));

            unsubscribe = onSnapshot(q, async (snapshot) => {
                let txns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // AUTO GOLD SIP LOGIC
                const todayStr = new Date().toISOString().split('T')[0];
                if (date === todayStr) {
                    const hasGoldSip = txns.some(t => t.type === 'GOLD_SIP');
                    if (!hasGoldSip) {
                        const newTxn = {
                            type: 'GOLD_SIP',
                            amount: 206,
                            charges: 0,
                            chargesType: 'Online',
                            note: 'Auto Daily Deduction',
                            address: '',
                            extraDetails: '',
                            provider: '',
                            remainingAmount: 0,

                            bankName: '',
                            date: todayStr,
                            timestamp: { seconds: Math.floor(new Date().setHours(0,0,0,0) / 1000) + 60, nanoseconds: 0 }
                        };
                        addDoc(txnCollection, newTxn).catch(e => console.error("Auto Gold SIP error:", e));
                    }
                }

                allTxnsForDate = txns;
                
                let startCash = 0;
                let startOnline = 0;
                let entryData = {};

                const normalizeDate = (dStr) => {
                    if (!dStr) return 0;
                    // Parse YYYY-MM-DD safely without timezone shift
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
                        const [y, m, d] = dStr.split('-').map(Number);
                        return new Date(y, m - 1, d).getTime();
                    }
                    // Parse "May 9, 2026" style
                    const d = new Date(dStr);
                    if (isNaN(d.getTime())) return 0;
                    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                };

                // Wait for cache to be ready (up to 3 seconds)
                if (!entriesLoaded) {
                    await new Promise(resolve => {
                        const start = Date.now();
                        const check = () => entriesLoaded ? resolve() : (Date.now() - start < 3000 ? setTimeout(check, 100) : resolve());
                        check();
                    });
                }

                const selectedTime = normalizeDate(date);
                if (entriesCache && entriesCache.length > 0) {
                    const sorted = [...entriesCache].sort((a, b) => normalizeDate(b.date) - normalizeDate(a.date));
                    const foundEntry = sorted.find(e => normalizeDate(e.date) < selectedTime);
                    if (foundEntry) {
                        entryData = foundEntry;
                        console.log(`[Lookback] Cache hit: found ${foundEntry.date} for selected date ${date}`);
                    }
                }
                
                if (!entryData.date) {
                    const [y, m, d] = date.split('-').map(Number);
                    let lbDate = new Date(y, m - 1, d);
                    const entriesRef = collection(db, "entries");
                    for (let i = 0; i < 7; i++) {
                        lbDate.setDate(lbDate.getDate() - 1);
                        const lbStr = lbDate.getFullYear() + '-' + String(lbDate.getMonth() + 1).padStart(2, '0') + '-' + String(lbDate.getDate()).padStart(2, '0');
                        const lbQueries = getPossibleDateFormats(lbStr);
                        const lbSnap = await getDocs(query(entriesRef, where("date", "in", lbQueries)));
                        if (!lbSnap.empty) {
                            entryData = lbSnap.docs[0].data();
                            break;
                        }
                    }
                }

                if (entryData.details) {
                    const d = entryData.details;
                    startCash = parseFloat(d.cash || 0);
                    const isNewLogic = normalizeDate(date) >= normalizeDate('2026-05-01');
                    startOnline = parseFloat(d.online || 0) + parseFloat(d.roinet || 0) + parseFloat(d.go2sms || 0) + parseFloat(d.pending || 0) + (isNewLogic ? 0 : parseFloat(d.jio || 0));
                }

                // Update summary badges with fetched opening balances
                const openingBalances = entryData.details ? {
                    ...entryData.details,
                    'credit-ledger': entryData.details.credit || 0,
                    'cust-deposit': entryData.details.deposit || 0,
                    'damaged': entryData.details.damages || 0
                } : {
                    cash: 0, online: 0, roinet: 0, jio: 0, go2sms: 0, pending: 0, damages: 0, credit: 0, deposit: 0
                };
                
                await updateDailyBalances(date, txns, openingBalances);
                
                currentStartCash = startCash;
                currentStartOnline = startOnline;

                // Calculate running balances
                txns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
                let currentCash = startCash;
                let currentOnline = startOnline;

                allTxnsForDate = txns.map(t => {
                    const prevCash = currentCash;
                    const prevOnline = currentOnline;

                    const amt = parseFloat(t.amount || 0);
                    const chg = parseFloat(t.charges || 0);
                    const provider = (t.provider || "").trim().toLowerCase();
                    const isNewLogic = normalizeDate(date) >= normalizeDate('2026-05-01');
                    const isJio = provider.includes('jio');
                    
                    if (t.type !== 'ROINET_COMMISSION') {
                        if (t.chargesType === 'Online') currentOnline += chg;
                        else currentCash += chg;
                    }

                    if (['AEPS', 'MATM', 'WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
                        currentCash -= amt;
                        if (!(isNewLogic && isJio)) {
                            currentOnline += amt;
                        }
                    } else if (['DEPOSIT', 'ADMIN_DEPOSIT'].includes(t.type)) {
                        currentCash += amt;
                        if (!(isNewLogic && isJio)) {
                            currentOnline -= amt;
                        }
                    } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL'].includes(t.type)) {
                        currentOnline -= amt;
                        if (t.chargesType === 'Online') currentOnline += amt;
                        else currentCash += amt;
                    } else if (t.type === 'JIO_RECHARGE') {
                        if (!isNewLogic) currentOnline -= amt;
                        if (t.provider === 'Online') currentOnline += amt;
                        else currentCash += amt;
                    } else if (t.type === 'JIO_TOPUP') {
                        currentOnline -= amt;
                        // Commission stays in JIO wallet, so remove it from generic Cash/Online addition
                        if (t.chargesType === 'Online') currentOnline -= chg;
                        else currentCash -= chg;
                    } else if (t.type === 'ROINET_COMMISSION') {
                        if (!(isNewLogic && isJio)) {
                            currentOnline += chg;
                        }
                    } else if (t.type === 'GOLD_SIP') {
                        currentOnline -= amt;
                    } else if (t.type === 'CREDIT_GIVEN') {
                        if (provider === 'cash') currentCash -= amt;
                        else currentOnline -= amt;
                    } else if (t.type === 'CREDIT_RECEIVED') {
                        if (provider === 'cash') currentCash += amt;
                        else currentOnline += amt;
                    } else if (t.type === 'CUST_MONEY_IN') {
                        if (provider === 'cash') currentCash += amt;
                        else currentOnline += amt;
                    } else if (t.type === 'CUST_MONEY_OUT') {
                        if (provider === 'cash') currentCash -= amt;
                        else currentOnline -= amt;
                    } else if (t.type === 'DAILY_EXPENSE') {
                        if (provider === 'cash') currentCash -= amt;
                        else currentOnline -= amt;
                    } else if (t.type === 'DAMAGED_CURRENCY') {
                        currentCash -= amt;
                    } else if (t.type === 'DAMAGED_RECOVERY') {
                        if (provider === 'cash') currentCash += amt;
                        else currentOnline += amt;
                    } else if (t.type === 'CASH_WITHDRAWAL') {
                        currentOnline -= amt;
                        currentCash += amt;
                    } else if (t.type === 'CASH_DEPOSIT') {
                        currentCash -= amt;
                        currentOnline += amt;
                    } else if (t.type === 'OTHER_INCOME') {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            if (!(isNewLogic && isJio)) {
                                currentOnline += amt;
                            }
                        }
                    } else if (t.type === 'SETTLEMENT') {
                        // Settlement between digital accounts has no net effect on 'Total Online'
                        if (provider === 'cash') {
                            currentCash -= amt;
                            currentOnline += amt;
                        } else if (isNewLogic && isJio) {
                            currentOnline += amt;
                        }
                        // Subtract charges from where they were generically added
                        if (t.chargesType === 'Online') currentOnline -= chg;
                        else currentCash -= chg;
                    } else if (t.type === 'ONLINE_WORK') {
                        currentOnline -= amt;
                        if (provider === 'cash') currentCash += amt;
                        else currentOnline += amt;
                    }
                    return { 
                        ...t, 
                        runningCash: currentCash, 
                        runningOnline: currentOnline,
                        cashDiff: currentCash - prevCash,
                        onlineDiff: currentOnline - prevOnline
                    };
                });

                // Sort by latest first for display
                allTxnsForDate.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

                renderBadgesAndTable();
            }, (error) => {
                console.error('Daily Transactions Listener Error:', error);
                const tableBody = document.getElementById('daily-txn-table-body');
                if (tableBody) {
                    tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-rose-500 font-bold">Error loading data: ${error.message}</td></tr>`;
                }
            });
        } catch (e) {
            console.error('Error setting up daily txn listener:', e);
        }
    };

    const renderBadgesAndTable = () => {
        const tableBody = document.getElementById('daily-txn-table-body');
        if (!tableBody) return;

        // Calculate type-wise stats (Always based on ALL txns for the date)
        const stats = allTxnsForDate.reduce((acc, txn) => {
            const type = txn.type;
            if (!acc[type]) acc[type] = { count: 0, amount: 0, charges: 0 };
            acc[type].count++;
            acc[type].amount += parseFloat(txn.amount || 0);
            acc[type].charges += parseFloat(txn.charges || 0);
            return acc;
        }, {});

        const excludedTypes = ['ADMIN_DEPOSIT', 'ADMIN_WITHDRAWAL', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'JIO_RECHARGE', 'GOLD_SIP', 'DAMAGED_CURRENCY', 'DAMAGED_RECOVERY', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT'];
        const includedVolumeTypes = ['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL'];
        
        const countableTxns = allTxnsForDate.filter(t => !excludedTypes.includes(t.type));
        const volumeTxns = allTxnsForDate.filter(t => includedVolumeTypes.includes(t.type));

        const totalDayAmount = volumeTxns.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const totalDayCharges = countableTxns.reduce((sum, t) => sum + parseFloat(t.charges || 0), 0);

        const summaryArea = document.getElementById('summary-badges-area');
        if (summaryArea) {
            summaryArea.innerHTML = '';
            MASTER_TXN_TYPES.forEach(config => {
                let count = 0;
                let amount = 0;
                let fees = 0;

                if (config.type === 'ALL') {
                    count = countableTxns.length;
                    amount = totalDayAmount;
                    fees = totalDayCharges;
                } else if (config.type === 'PENDING') {
                    const sAdd = stats['PENDING_ADD'] || { count: 0, amount: 0, charges: 0 };
                    const sRem = stats['PENDING_REMOVE'] || { count: 0, amount: 0, charges: 0 };
                    count = sAdd.count + sRem.count;
                    amount = sAdd.amount - sRem.amount;
                    fees = sAdd.charges + sRem.charges;
                } else {
                    const s = stats[config.type] || { count: 0, amount: 0, charges: 0 };
                    count = s.count;
                    amount = s.amount;
                    fees = s.charges;
                }

                const isActive = currentTxnFilter === config.type;
                const card = document.createElement('div');
                card.className = `flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border ${isActive ? 'border-primary ring-2 ring-primary/40 shadow-md scale-[1.02]' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm'} transition-all cursor-pointer group select-none relative overflow-hidden`;
                card.onclick = () => {
                    currentTxnFilter = config.type;
                    renderBadgesAndTable();
                };

                card.innerHTML = `
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 ${config.borderLeft || 'bg-primary'}"></div>
                    <div class="flex items-center gap-2 pl-2 w-full">
                        <div class="size-8 rounded-xl ${config.bg} ${config.text} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <span class="material-symbols-outlined text-base">${config.icon}</span>
                        </div>
                        <div class="flex flex-col flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-1 w-full">
                                <span class="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 truncate leading-none">${config.label}</span>
                                <span class="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[9px] font-extrabold text-slate-600 dark:text-slate-300 leading-none shrink-0">${count}</span>
                            </div>
                            <div class="flex items-baseline justify-between gap-1.5 mt-1">
                                <span class="text-xs font-black ${isActive ? 'text-primary' : 'text-slate-900 dark:text-white'} truncate">${amount < 0 ? '-' : ''}₹${Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                <span class="text-[9px] font-bold ${config.type === 'ALL' ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'} italic shrink-0">F: ₹${fees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                `;
                summaryArea.appendChild(card);
            });
        }

        // Now filter the table data
        let txnsToRender = currentTxnFilter === 'ALL' ? allTxnsForDate : (currentTxnFilter === 'PENDING' ? allTxnsForDate.filter(t => ['PENDING_ADD', 'PENDING_REMOVE'].includes(t.type)) : allTxnsForDate.filter(t => t.type === currentTxnFilter));

        if (window.isAllTimeSearchMode) {
            const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const keywords = term.split(/\s+/).filter(k => k.length > 0);
            
            if (keywords.length > 0) {
                txnsToRender = txnsToRender.filter(txn => {
                    const bankName = (txn.bankName || '').toLowerCase();
                    const note = (txn.note || '').toLowerCase();
                    const remark = (txn.remark || '').toLowerCase();
                    const address = (txn.address || '').toLowerCase();
                    const extraDetails = (txn.extraDetails || '').toLowerCase();
                    const type = (txn.type || '').toLowerCase();
                    const amount = (txn.amount || '').toString();
                    const date = (txn.date || '').toLowerCase();
                    const provider = (txn.provider || '').toLowerCase();

                    const fullText = `${bankName} ${note} ${remark} ${address} ${extraDetails} ${type} ${amount} ${date} ${provider}`;
                    return keywords.every(k => fullText.includes(k));
                });
                txnsToRender = txnsToRender.slice(0, 500);
                if (allTimeSearchCountBadge) {
                    allTimeSearchCountBadge.innerText = `Found ${txnsToRender.length} matches`;
                }
            } else {
                txnsToRender = txnsToRender.slice(0, 100);
                if (allTimeSearchCountBadge) {
                    allTimeSearchCountBadge.innerText = `Showing latest 100 (Total: ${allTxnsForDate.length})`;
                }
            }
        }
        
        const getSetting = window.getAppSetting || ((k, d) => localStorage.getItem(k) !== 'false');
        const showBalanceDiff = getSetting('dtxn_showBalanceDiff', true);

        const countableIds = countableTxns.map(t => t.id);

        const getShortBankName = (name) => {
            if (!name) return "";
            const n = name.toUpperCase().trim();
            const map = {
                'CHHATTISGARH GRAMEEN BANK': 'CRGB',
                'CHHATTISGARH RAJYA GRAMIN BANK': 'CRGB',
                'STATE BANK OF INDIA': 'SBI',
                'INDIA POST PAYMENT BANK': 'IPPB',
                'BANK OF BARODA': 'BOB',
                'UCO BANK': 'UCO',
                'UNION BANK': 'UBI',
                'AIRTEL BANK': 'AIRTEL',
                'FINO BANK': 'FINO',
                'INDIAN BANK': 'INDIAN',
                'JILLA SAKAHARI BANK': 'JSB',
                'CHHATTISGARH GRAMIN BANK': 'CRGB',
                'PUNJAB NATIONAL BANK': 'PNB',
                'HDFC BANK': 'HDFC',
                'ICICI BANK': 'ICICI',
                'AXIS BANK': 'AXIS',
                'CANARA BANK': 'CANARA',
                'BANK OF INDIA': 'BOI',
                'CENTRAL BANK OF INDIA': 'CBI',
                'IDBI BANK': 'IDBI',
                'KOTAK MAHINDRA BANK': 'KOTAK',
                'PAYTM PAYMENTS BANK': 'PAYTM'
            };
            return map[n] || name;
        };

        const parseBankUrn = (txn) => {
            if (!txn.bankName) return { accName: '', accNumber: '', bankDisplay: '', typeDisplay: '' };
            let holder = '';
            let bank = '';
            let type = '';
            let number = '';

            if (txn.accountId && window.cachedBankAccountsMap && window.cachedBankAccountsMap.has(String(txn.accountId))) {
                const acc = window.cachedBankAccountsMap.get(String(txn.accountId));
                if (acc && acc.name && acc.name.includes('|')) {
                    const p = acc.name.split('|');
                    holder = p[0] || '';
                    bank = p[1] || '';
                    number = p[2] || '';
                    type = p[3] || 'CURRENT';
                }
            }
            if (!bank && window.cachedBankAccountsMap) {
                for (const acc of window.cachedBankAccountsMap.values()) {
                    if (acc.name && acc.name.includes('|')) {
                        const p = acc.name.split('|');
                        const h = p[0] || '';
                        const t = p[3] || 'CURRENT';
                        const n = p[2] || '';
                        const matchStr = `${h.toUpperCase()} — ${t.toUpperCase()} — ${n}`;
                        if (matchStr === txn.bankName) {
                            holder = h;
                            bank = p[1] || '';
                            number = n;
                            type = t;
                            break;
                        }
                    }
                }
            }
            if (!bank && txn.bankName.includes(' — ')) {
                const parts = txn.bankName.split(' — ');
                if (parts.length >= 3) {
                    holder = parts[0];
                    type = parts[1];
                    number = parts[2];
                    bank = 'BANK';
                } else if (parts.length === 2) {
                    holder = parts[0];
                    type = parts[1];
                    bank = 'BANK';
                }
            }
            if (!bank) {
                bank = txn.bankName;
            }
            return { accName: holder, accNumber: number, bankDisplay: bank, typeDisplay: type };
        };

        tableBody.innerHTML = '';
        txnsToRender.forEach((txn) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-primary/5 transition-colors group';
            
            const time = txn.timestamp ? new Date(txn.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const isExcluded = excludedTypes.includes(txn.type);
            const serialPos = isExcluded ? null : (countableIds.length - countableIds.indexOf(txn.id));

            const { accName, accNumber, bankDisplay, typeDisplay } = parseBankUrn(txn);

            tr.innerHTML = `
                <td class="px-3 py-1.5 serial-cell" data-original="${serialPos}" data-excluded="${isExcluded}"><span class="serial-text text-xs font-bold text-slate-500">${isExcluded ? '<span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-400">—</span>' : '#' + serialPos}</span></td>
                <td class="px-3 py-1.5">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${time}</span>
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">${txn.date}</span>
                    </div>
                </td>
                <td class="px-3 py-1.5">
                    <div class="flex flex-col items-start gap-1">
                        <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit ${txn.type === 'DEPOSIT' || txn.type === 'FREE_DEPOSIT' || txn.type === 'ADMIN_DEPOSIT' || txn.type === 'CREDIT_RECEIVED' || txn.type === 'CUST_MONEY_IN' || txn.type === 'OTHER_INCOME' || txn.type === 'PENDING_ADD' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20' :
                    txn.type === 'WITHDRAWAL' || txn.type === 'FREE_WITHDRAWAL' || txn.type === 'ADMIN_WITHDRAWAL' || txn.type === 'CREDIT_GIVEN' || txn.type === 'DAMAGED_CURRENCY' || txn.type === 'CUST_MONEY_OUT' || txn.type === 'DAILY_EXPENSE' || txn.type === 'PENDING_REMOVE' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20' :
                        txn.type === 'GOLD_SIP' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20' :
                            txn.type === 'ROINET_COMMISSION' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20' :
                                txn.type === 'CASH_WITHDRAWAL' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-700/10 border border-emerald-200 dark:border-emerald-700/20 shadow-sm' :
                                    txn.type === 'CASH_DEPOSIT' ? 'bg-blue-100 text-blue-700 dark:bg-blue-700/10 border border-blue-200 dark:border-blue-700/20 shadow-sm' :
                                txn.type.includes('RECHARGE') || txn.type.includes('TOPUP') ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20' :
                                    'bg-primary/10 text-primary border border-primary/20 dark:border-primary/30'
                }">${
                    txn.type === 'CASH_WITHDRAWAL' ? 'CASH WDRL <span class="material-symbols-outlined text-[12px]">arrow_downward</span>' :
                    (txn.type === 'CASH_DEPOSIT' ? 'CASH DEP <span class="material-symbols-outlined text-[12px]">arrow_upward</span>' : txn.type.replace('_', ' '))
                }</span>
                        ${txn.provider ? `
                            <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 w-fit">
                                <span class="material-symbols-outlined text-[14px] text-amber-600 min-w-[14px]">account_balance_wallet</span>
                                <span class="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">${txn.provider}</span>
                            </div>
                        ` : ''}
                    </div>
                </td>
                 <td class="px-3 py-1.5">
                    <div class="flex flex-col gap-1.5 max-w-[200px]">
                        ${bankDisplay ? `
                            <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 w-fit">
                                <span class="material-symbols-outlined text-[14px] text-blue-600 min-w-[14px]">account_balance</span>
                                <div class="flex items-center gap-1 whitespace-nowrap">
                                    <span class="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide truncate" title="${bankDisplay}">${getShortBankName(bankDisplay)}</span>
                                    ${typeDisplay ? `<span class="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">${typeDisplay}</span>` : ''}
                                </div>
                            </div>
                        ` : ''}
                        ${txn.provider ? `
                            <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 w-fit">
                                <span class="material-symbols-outlined text-[14px] text-amber-600">account_balance_wallet</span>
                                <span class="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">${txn.provider}</span>
                            </div>
                        ` : (!bankDisplay ? '<span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-fit">N/A</span>' : '')}
                        ${txn.type === 'ONLINE_WORK' ? `
                            ${txn.depositBy ? `
                                <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 w-fit">
                                    <span class="material-symbols-outlined text-[14px] text-purple-600">person</span>
                                    <span class="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">Debit: ${txn.depositBy}</span>
                                </div>
                            ` : ''}
                        ` : txn.depositBy ? `
                            <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 w-fit">
                                <span class="material-symbols-outlined text-[14px] text-purple-600">person</span>
                                <span class="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">${txn.type === 'WITHDRAWAL' ? 'Recv:' : (txn.type === 'CASH_WITHDRAWAL' ? 'Debit:' : (txn.type === 'CASH_DEPOSIT' ? 'Credit:' : 'Dep:'))} ${txn.depositBy}</span>
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td class="px-3 py-1.5">
                    <div class="flex flex-col gap-0.5 max-w-[220px]">
                        ${txn.type === 'SETTLEMENT' ? `
                            <div class="flex items-center gap-1.5 py-0.5 flex-wrap">
                                <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                                    <span class="material-symbols-outlined text-[13px] text-amber-600">account_balance_wallet</span>
                                    ${txn.provider || 'Wallet'}
                                </span>
                                <span class="material-symbols-outlined text-indigo-500 text-sm font-black select-none">east</span>
                                <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">
                                    <span class="material-symbols-outlined text-[13px] text-indigo-600">account_balance</span>
                                    ${getShortBankName(bankDisplay) || txn.bankName || 'Bank'}
                                </span>
                            </div>
                            ${accName ? `
                                <div class="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mt-1">
                                    <span class="material-symbols-outlined text-[13px] text-slate-500">person</span>
                                    <span>${accName}</span>
                                </div>
                            ` : ''}
                            ${accNumber ? `
                                <div class="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 tracking-wider mt-0.5">
                                    <span class="material-symbols-outlined text-[13px]">pin</span>
                                    <span>A/C: ${accNumber}</span>
                                </div>
                            ` : ''}
                            ${txn.remark ? `
                                <div class="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                                    <span class="material-symbols-outlined text-[13px]">notes</span>
                                    <span>${txn.remark}</span>
                                </div>
                            ` : ''}
                        ` : (
                            ['CSP_COMMISSION', 'ROINET_COMMISSION'].includes(txn.type) ? `
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center gap-1.5 py-0.5 flex-wrap">
                                        <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">
                                            <span class="material-symbols-outlined text-[13px] text-purple-600">account_balance_wallet</span>
                                            ${txn.provider || (txn.type === 'ROINET_COMMISSION' ? 'Roinet' : 'CSP Wallet')}
                                        </span>
                                        <span class="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Commission</span>
                                    </div>
                                    <div class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                        <span class="material-symbols-outlined text-emerald-500 text-sm">monetization_on</span>
                                        <span>${txn.type === 'ROINET_COMMISSION' ? 'Roinet Commission Received' : 'CSP Commission Earned'}</span>
                                    </div>
                                    ${txn.remark ? `
                                        <div class="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                                            <span class="material-symbols-outlined text-[13px]">notes</span>
                                            <span>${txn.remark}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : (
                                accName ? `
                                <span class="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">${accName}</span>
                                ${accNumber ? `<span class="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 tracking-wider">${accNumber}</span>` : ''}
                            ` : (
                                (['CREDIT_GIVEN', 'CREDIT_RECEIVED', 'DAILY_EXPENSE'].includes(txn.type)) ? `
                                    <span class="text-sm font-bold text-slate-800 dark:text-slate-100">${txn.note || (txn.type === 'DAILY_EXPENSE' ? 'Daily Expense' : 'No Name')}</span>
                                    ${txn.remark ? `<span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">${txn.remark}</span>` : ''}
                                ` : `
                                    <span class="text-sm font-bold text-slate-800 dark:text-slate-100">${txn.remark || (txn.note || (txn.pages ? (txn.type === 'PHOTOCOPY' ? 'Photocopy' : (txn.type === 'PRINTOUT' ? 'Printout' : (txn.type === 'PASSPORT' ? 'Passport Photos' : 'Lamination'))) : 'No Details'))}</span>
                                    ${txn.type === 'ONLINE_WORK' && txn.provider !== 'cash' && txn.receivedIn ? `
                                        <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 w-fit mt-1">
                                            <span class="material-symbols-outlined text-[14px] text-purple-600">person</span>
                                            <span class="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">Recv: ${txn.receivedIn}</span>
                                        </div>
                                    ` : ''}
                                `
                            )
                        )
                    )}
                        ${txn.pages ? `<span class="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20 w-fit mt-0.5"><span class="material-symbols-outlined text-[13px]">${txn.type === 'PASSPORT' ? 'photo_camera' : (txn.type === 'LAMINATION' ? 'layers' : 'file_copy')}</span>${txn.type === 'LAMINATION' && txn.laminationSize ? `${txn.laminationSize} (${txn.pages})` : `${txn.pages} ${txn.type === 'PASSPORT' ? (txn.pages === 1 ? 'Piece' : 'Pieces') : (txn.type === 'LAMINATION' ? (txn.pages === 1 ? 'Item' : 'Items') : (txn.pages === 1 ? 'Page' : 'Pages'))}`}</span>` : ''}
                        ${txn.address || txn.extraDetails ? `
                            <div class="flex items-center gap-3 text-[10px] text-slate-500 font-medium mt-0.5">
                                ${txn.address ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">location_on</span>${txn.address}</span>` : ''}
                                ${txn.extraDetails ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">fingerprint</span>${txn.extraDetails}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td class="px-3 py-1.5 text-right">
                    <div class="flex flex-col items-end">
                        ${(['CSP_COMMISSION', 'ROINET_COMMISSION', 'PHOTOCOPY', 'PRINTOUT', 'PASSPORT', 'LAMINATION'].includes(txn.type)) ? `
                            <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-fit">N/A</span>
                        ` : `
                            <span class="text-sm font-black ${txn.type === 'DAILY_EXPENSE' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}">₹${parseFloat(txn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        `}
                        ${txn.remainingAmount ? `<span class="text-[9px] text-amber-600 font-bold">Rem: ₹${parseFloat(txn.remainingAmount).toLocaleString('en-IN')}</span>` : ''}
                    </div>
                </td>
                <td class="px-3 py-1.5 text-right charges-col-cell">
                    <div class="flex flex-col items-end">
                        ${(['PENDING_ADD', 'PENDING_REMOVE'].includes(txn.type)) ? '' : ((['GOLD_SIP', 'FREE_DEPOSIT', 'FREE_WITHDRAWAL', 'ADMIN_DEPOSIT', 'ADMIN_WITHDRAWAL', 'DAMAGED_CURRENCY', 'DAMAGED_RECOVERY', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE', 'JIO_RECHARGE', 'DISH_TV', 'JIO_TOPUP', 'SETTLEMENT', 'CSP_COMMISSION', 'ROINET_COMMISSION', 'OTHER_INCOME', 'ADD_CAPITAL', 'SHARE_WITHDRAWN', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(txn.type)) && parseFloat(txn.charges || 0) === 0) ? `
                            <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-fit">N/A</span>
                        ` : `
                            <span class="text-sm font-bold text-primary italic">₹${parseFloat(txn.charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            <span class="text-[8px] font-black uppercase tracking-widest ${(['SETTLEMENT', 'CSP_COMMISSION', 'ROINET_COMMISSION'].includes(txn.type)) ? 'text-indigo-500' : (txn.chargesType === 'Online' ? 'text-blue-500' : 'text-emerald-500')}">${(['SETTLEMENT', 'CSP_COMMISSION', 'ROINET_COMMISSION'].includes(txn.type)) ? 'Wallet' : (txn.chargesType || 'Cash')}</span>
                        `}
                    </div>
                </td>
                <td class="px-3 py-1.5 balance-col-cell">
                    <div class="flex flex-col items-center justify-center gap-1 min-w-[100px]">
                        <span class="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20 w-full flex justify-between items-center">
                            <span>C: ${window.isAllTimeSearchMode ? '—' : '₹' + (txn.runningCash || 0).toLocaleString('en-IN')}</span>
                            ${!window.isAllTimeSearchMode && showBalanceDiff && txn.cashDiff !== undefined && txn.cashDiff !== 0 ? `<span class="text-[9px] font-bold ${txn.cashDiff > 0 ? 'text-emerald-500' : 'text-rose-500'}">(${txn.cashDiff > 0 ? '+' : ''}${txn.cashDiff.toLocaleString('en-IN')})</span>` : '<span></span>'}
                        </span>
                        <span onclick="${window.isAllTimeSearchMode ? '' : `window.showOnlineBreakdown(${JSON.stringify(txn.breakdown || {}).replace(/"/g, '&quot;')})`}" class="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-500/20 w-full flex justify-between items-center ${window.isAllTimeSearchMode ? '' : 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors'}" title="${window.isAllTimeSearchMode ? '' : 'Click to view breakdown'}">
                            <span>O: ${window.isAllTimeSearchMode ? '—' : '₹' + (txn.runningOnline || 0).toLocaleString('en-IN')}</span>
                            ${!window.isAllTimeSearchMode && showBalanceDiff && txn.onlineDiff !== undefined && txn.onlineDiff !== 0 ? `<span class="text-[9px] font-bold ${txn.onlineDiff > 0 ? 'text-blue-500' : 'text-rose-500'}">(${txn.onlineDiff > 0 ? '+' : ''}${txn.onlineDiff.toLocaleString('en-IN')})</span>` : '<span></span>'}
                        </span>
                    </div>
                </td>
                <td class="px-3 py-1.5">
                    <div class="flex justify-center gap-2">
                        <button class="edit-txn-btn size-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 lg:opacity-0 lg:group-hover:opacity-100 transition-all hover:bg-blue-500 hover:text-white flex items-center justify-center" data-id="${txn.id}">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button class="delete-txn-btn size-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 lg:opacity-0 lg:group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white flex items-center justify-center" data-id="${txn.id}">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        if (!window.isAllTimeSearchMode) {
            // Add Opening Balance Row at the bottom
            const opRow = document.createElement('tr');
            opRow.className = 'bg-slate-50/50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10';
            opRow.innerHTML = `
                <td class="px-3 py-2 text-center" colspan="5"><span class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Opening Balance for ${currentSelectedDate}</span></td>
                <td class="px-3 py-2 text-right font-black text-slate-400 text-[10px]" colspan="2">Starting Balances:</td>
                <td class="px-3 py-2 text-right">
                    <div class="flex flex-col items-center justify-center gap-1 min-w-[100px]">
                        <span class="text-[10px] font-black text-emerald-500/70 px-2 py-0.5 rounded border border-emerald-500/10 w-full text-center">C: ₹${currentStartCash.toLocaleString('en-IN')}</span>
                        <span class="text-[10px] font-black text-blue-500/70 px-2 py-0.5 rounded border border-blue-500/10 w-full text-center">O: ₹${currentStartOnline.toLocaleString('en-IN')}</span>
                    </div>
                </td>
                <td class="px-3 py-2 text-center"><span class="material-symbols-outlined text-slate-300 text-sm">start</span></td>
            `;
            tableBody.appendChild(opRow);
        }

        // Re-attach edit/delete listeners
        document.querySelectorAll('.edit-txn-btn').forEach(btn => {
            btn.onclick = () => {
                const txn = allTxnsForDate.find(t => t.id === btn.dataset.id);
                if (txn) {
                    editingTxnId = txn.id;
                    editingTxnTimestamp = txn.timestamp || null;
                    txnType.value = txn.type;
                    updateConditionalField();
                    txnAmount.value = txn.amount;
                    txnCharges.value = txn.charges;
                    if (txnQuantity) txnQuantity.value = txn.pages || '';
                    if (txnLaminationSize && txn.laminationSize) txnLaminationSize.value = txn.laminationSize;
                    txnNote.value = txn.note;
                    if (txnRemark) txnRemark.value = txn.remark || '';
                    if (txn.type === 'DAILY_EXPENSE' && txnExpenseType) txnExpenseType.value = txn.note;
                    txnAddress.value = txn.address;
                    txnConditional.value = txn.extraDetails || '';
                    txnProvider.value = txn.provider || '';
                    if (txnDepositBy) txnDepositBy.value = txn.depositBy || '';
                    if (txnReceivedIn) txnReceivedIn.value = txn.receivedIn || '';
                    if (txnChargesAccount) txnChargesAccount.value = txn.chargesAccount || '';
                    txnRemaining.value = txn.remainingAmount || '';
                    txnBank.value = txn.bankName || '';
                    const txnBankSelect = document.getElementById('txn-bank-select');
                    if (txnBankSelect) txnBankSelect.value = txn.bankName || '';
                    if (typeof window.updateCustomBankSelectDisplay === 'function') {
                        window.updateCustomBankSelectDisplay(txn.bankName || '');
                    }
                    if (txnMethod && txn.method) txnMethod.value = txn.method;
                    updateConditionalField();

                    const submitBtn = form.querySelector('button[type="submit"]');
                    submitBtn.innerHTML = '<span class="material-symbols-outlined">edit</span> Update Transaction';
                    submitBtn.classList.remove('bg-primary');
                    submitBtn.classList.add('bg-amber-500');
                    form.scrollIntoView({ behavior: 'smooth' });
                }
            };
        });

        document.querySelectorAll('.delete-txn-btn').forEach(btn => {
            btn.onclick = () => {
                showDeleteModal(btn.dataset.id);
            };
        });
    };

    // Dynamic cards manage their own filter clicks

    // Initial load
    if (window.populateBankAccountsDropdown) await populateBankAccountsDropdown();
    loadTransactions(currentSelectedDate);
}

async function startApp() {
    // Disable scrolling to change numbers on input type="number"
    document.addEventListener('wheel', function(e) {
        if (document.activeElement.type === 'number') {
            document.activeElement.blur();
        }
    }, { passive: true });

    // Apply privileged page PIN Protection (Add Entry & Settings)
    protectPrivilegedLinks();

    // Migration & Cleanup in background (don't block initial render)
    migrateToDatabase().catch(e => console.error("Migration failed:", e));
    deduplicateEntries().catch(e => console.error("Dedup failed:", e));

    const modules = [
        { name: 'Settings', fn: initSettings }, // Prioritize Settings
        { name: 'AddEntry', fn: initAddEntry },
        { name: 'Dashboard', fn: initDashboard },
        { name: 'Calculator', fn: initCalculator },
        { name: 'Transactions', fn: initTransactions },
        { name: 'Reports', fn: initReports }, // New module
        { name: 'CreditLedger', fn: initCreditLedger },
        { name: 'DailyTxn', fn: initDailyTxn },
        { name: 'DamagedCurrency', fn: initDamagedCurrency },
        { name: 'BankWithdrawals', fn: initBankWithdrawals }
    ];

    for (const m of modules) {
        try {
            await m.fn();
        } catch (err) {
            console.error(`Module ${m.name} failed to init:`, err);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

