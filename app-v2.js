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
        await setDoc(docRef, customer);
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
        return querySnapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
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

            const creditInput = document.getElementById('credit');
            if (creditInput) {
                creditInput.readOnly = false;
                creditInput.classList.remove('bg-slate-50', 'dark:bg-slate-800/50', 'border-primary/20', 'cursor-not-allowed', 'ring-1', 'ring-primary/30');
                const indicator = creditInput.parentElement?.querySelector('.sync-indicator');
                if (indicator) indicator.remove();
            }

            const details = existing.details || {};
            Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                const fieldName = (input.id || input.name || "").toLowerCase();
                // Check both details and top-level fields (capital, expense, withdrawal)
                const val = details[fieldName] !== undefined ? details[fieldName] : (existing[fieldName] || 0);
                input.value = val;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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
                creditInput.readOnly = true;
                creditInput.classList.add('bg-slate-50', 'dark:bg-slate-800/50', 'border-primary/20', 'cursor-not-allowed', 'ring-1', 'ring-primary/30');
                let indicator = creditInput.parentElement?.querySelector('.sync-indicator');
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = `sync-indicator absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-60 pointer-events-none`;
                    indicator.innerHTML = `
                        <span class="text-[8px] font-black text-primary uppercase tracking-tighter">Sync</span>
                        <span class="material-symbols-outlined text-[14px] text-primary animate-spin-slow">sync</span>
                    `;
                    creditInput.parentElement?.appendChild(indicator);
                }
                creditInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

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
                    ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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
                    ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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
                ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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
            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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
        ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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

    const updateExpenseSplitTotal = () => {
        if(!ex_p) return 0;
        const total = (parseFloat(ex_p.value) || 0) + 
                      (parseFloat(ex_s.value) || 0) + 
                      (parseFloat(ex_e.value) || 0) + 
                      (parseFloat(ex_r.value) || 0) + 
                      (parseFloat(ex_b.value) || 0) + 
                      (parseFloat(ex_i.value) || 0);
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

        [ex_p, ex_s, ex_e, ex_r, ex_b, ex_i].forEach(inp => {
            if(inp) inp.addEventListener('input', updateExpenseSplitTotal);
        });

        if(useExpenseBtn) {
            useExpenseBtn.addEventListener('click', () => {
                const total = updateExpenseSplitTotal();
                if(expenseInput) {
                    expenseInput.value = total || '';
                    expenseInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                closeExpenseModal();
            });
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
                alert('Please fill in all fields. Use 0 if there is no amount for a specific field.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="material-symbols-outlined text-lg">add_circle</span> Save Entry';
                }
                return;
            }

            let income = 0;
            let expense = 0;
            let capital = 0;
            let withdrawal = 0;
            const details = {};

            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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
                let toast = document.getElementById('ae-success-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'ae-success-toast';
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
                    <div>
                        <div style="font-size:14px;font-weight:700">Entry Saved! 🎉</div>
                        <div style="font-size:12px;font-weight:400;color:#64748b">Daily record has been saved successfully.</div>
                    </div>
                `;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
                });
                clearTimeout(toast._t);
                toast._t = setTimeout(() => { toast.style.transform = 'translateX(120%)'; }, 3000);
            })();
            form.reset();
            
            // Clear modal inputs which are outside the form
            ['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense'].forEach(id => {
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
                alert('Please calculate an amount greater than 0.');
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

            tableBody.innerHTML = '';

            if (currentView === 'ledger') {
                if (ledgerTitle) ledgerTitle.innerText = "Ledger Details";
                if (backBtn) backBtn.classList.add('hidden');
                if (addTransactionSection) addTransactionSection.classList.add('hidden');
                if (addCustomerBtn) addCustomerBtn.classList.remove('hidden');
                if (ledgerHeader) ledgerHeader.classList.remove('hidden');
                if (historyHeader) historyHeader.classList.add('hidden');

                const tableContainer = document.getElementById('table-card-container');
                if (tableContainer) tableContainer.className = "lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-primary/10 shadow-sm overflow-hidden flex flex-col";
                const summarySidebar = document.getElementById('customer-summary-sidebar');
                if (summarySidebar) summarySidebar.classList.add('hidden');

                const queryStr = searchInput ? searchInput.value.toLowerCase() : '';
                const filteredCustomers = customers.filter(c => (c.name || '').toLowerCase().includes(queryStr));

                if (filteredCustomers.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-slate-500">No customers found. Add one above!</td></tr>`;
                } else {
                    filteredCustomers.forEach((cust, index) => {
                        const custCredits = credits.filter(cr => String(cr.customerId) === String(cust.id));
                        let custTotal = 0;
                        let custPaid = 0;
                        custCredits.forEach(cr => {
                            custTotal += (cr.amount || 0);
                            custPaid += (cr.paid || 0);
                        });
                        const custBal = custTotal - custPaid;

                        displayTotal += custTotal;
                        displayReceived += custPaid;
                        displayPending += custBal;

                        const status = custBal <= 0 && custTotal > 0 ? 'PAID' : (custPaid > 0 ? 'PARTIAL' : 'PENDING');
                        const statusClass = status === 'PAID' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                            (status === 'PARTIAL' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                                'bg-red-100 text-red-600 dark:bg-red-900/30');

                        const custNameStr = cust.name || 'Unknown';
                        const initial = custNameStr.split(' ').map(n => n[0] || '').join('').toUpperCase().substring(0, 2);

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 transition-colors cursor-pointer group";
                        tr.onclick = (e) => {
                            if (e.target.closest('button')) return;
                            showCustomerDetails(cust.id);
                        };

                        tr.innerHTML = `
                            <td class="px-6 py-2 text-xs font-bold text-slate-500 w-16">${index + 1}</td>
                            <td class="px-6 py-2">
                                <div class="flex items-center gap-3">
                                    <div class="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">${initial}</div>
                                    <span class="text-sm font-bold group-hover:text-primary transition-colors">${custNameStr}</span>
                                </div>
                            </td>
                            <td class="px-6 py-2 text-sm ${custBal > 0 ? 'text-orange-600' : 'text-green-600'} font-bold text-right">${formatCurrency(custBal)}</td>
                            <td class="px-6 py-2 text-sm text-right">${formatCurrency(custPaid)}</td>
                            <td class="px-6 py-2 text-sm font-bold text-right">${formatCurrency(custTotal)}</td>
                            <td class="px-6 py-2 text-center">
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${statusClass}">${status}</span>
                            </td>
                            <td class="px-6 py-2 text-right">
                                <div class="flex gap-2 justify-end">
                                    <button onclick="event.stopPropagation(); showCustomerDetails('${cust.id}')" class="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="View Details">
                                        <span class="material-symbols-outlined text-lg">visibility</span>
                                    </button>
                                    <button onclick="event.stopPropagation(); deleteLedgerCustomer('${cust.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg" title="Delete Customer">
                                        <span class="material-symbols-outlined text-lg">delete</span>
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
                    custTotalCredit += (cr.amount || 0);
                    custTotalPaid += (cr.paid || 0);
                });
                const custBalanceDue = custTotalCredit - custTotalPaid;
                const statusStr = custBalanceDue <= 0 && custTotalCredit > 0 ? 'PAID' : (custTotalPaid > 0 ? 'PARTIAL' : 'PENDING');
                const statusBadgeClass = statusStr === 'PAID' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : (statusStr === 'PARTIAL' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30');

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
                if (summaryPhone) summaryPhone.innerText = "Customer Profile";
                if (summaryBalance) summaryBalance.innerText = formatCurrency(custBalanceDue);
                if (summaryStatusBadge) {
                    summaryStatusBadge.innerText = statusStr;
                    summaryStatusBadge.className = `mt-2 px-3 py-1 rounded-full text-xs font-black uppercase ${statusBadgeClass}`;
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
                    tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No transactions yet for this customer.</td></tr>`;
                } else {
                    custCredits.forEach((cr, index) => {
                        const creditAmt = cr.amount || 0;
                        const paidAmt = cr.paid || 0;

                        displayTotal += creditAmt;
                        displayReceived += paidAmt;

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 transition-colors py-1.5";
                        tr.innerHTML = `
                            <td class="px-6 py-2.5 text-xs font-bold text-slate-500 w-16">${index + 1}</td>
                            <td class="px-6 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">${formatStandardDate(cr.date)}</td>
                            <td class="px-6 py-2.5 text-sm font-bold text-right text-orange-600">${creditAmt > 0 ? formatCurrency(creditAmt) : '-'}</td>
                            <td class="px-6 py-2.5 text-sm font-bold text-right text-green-600">${paidAmt > 0 ? formatCurrency(paidAmt) : '-'}</td>
                            <td class="px-6 py-2.5 text-xs text-slate-500 italic">${cr.note || ''}</td>
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
        // Slide in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
        });
        // Slide out after 2.5s
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

    // Handlers
    addCustomerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-customer-name');
        const rawName = input?.value || '';
        const normalizedName = rawName.replace(/\s+/g, ' ').trim();
        if (normalizedName) {
            try {
                const existingCustomers = await loadCustomers();
                const isDuplicate = existingCustomers.some(c => c.name && c.name.replace(/\s+/g, ' ').trim().toLowerCase() === normalizedName.toLowerCase());
                if (isDuplicate) {
                    showErrorToast('Customer already exists in Credit Ledger.');
                    return;
                }
                const res = await saveCustomer({ id: Date.now(), name: normalizedName });
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

    window.deleteLedgerCustomer = (id) => {
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
                confirmDeleteBtn.disabled = true;
                const originalText = confirmDeleteBtn.innerHTML;
                confirmDeleteBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">sync</span> Deleting...';
                
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
                    showErrorToast('Failed to delete item.');
                } finally {
                    confirmDeleteBtn.disabled = false;
                    confirmDeleteBtn.innerHTML = 'Yes, Delete';
                    deleteId = null;
                    deleteType = null;
                }
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
    const tableBody = document.getElementById('bank-data-body');
    if (!tableBody) return; // Only runs on bank-withdrawals-code.html

    const addAccountForm = document.getElementById('add-account-form');
    const withdrawalForm = document.getElementById('withdrawal-form');
    const accountViewHeader = document.getElementById('account-view-header');
    const addWithdrawalSection = document.getElementById('add-withdrawal-section');
    const backBtn = document.getElementById('back-to-accounts');
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

    // Delete Modal Elements
    const deleteModal = document.getElementById('delete-confirm-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    // Helper to calculate current FY range
    function getCurrentFYDates() {
        const today = new Date();
        const year = today.getFullYear();
        let startYear, endYear;
        
        if (today.getMonth() >= 3) { // April (3) to Dec (11)
            startYear = year;
            endYear = year + 1;
        } else { // Jan (0) to March (2)
            startYear = year - 1;
            endYear = year;
        }
        
        const start = new Date(startYear, 3, 1); // April 1st
        const end = new Date(endYear, 2, 31, 23, 59, 59); // March 31st
        return { start, end, label: `FY ${startYear}-${endYear}` };
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    async function renderView() {
        try {
            const accounts = await loadBankAccounts();
            const withdrawalsList = await loadBankWithdrawals();

            tableBody.innerHTML = '';
            
            const fy = getCurrentFYDates();
            if(fyDatesDisplay) fyDatesDisplay.innerText = fy.label;

            const limitDisplay = fyDatesDisplay ? fyDatesDisplay.nextElementSibling : null;

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
                    fyTotalDisplay.previousElementSibling.innerText = "TOTAL YEAR WITHDRAWALS (ALL ACCOUNTS)";
                }
                if (fyPercentage) {
                    fyPercentage.innerText = `${grandPercent.toFixed(1)}% Used`;
                    fyPercentage.className = `text-lg font-bold px-3 py-1 rounded-lg ${grandPercent >= 100 ? 'bg-rose-100 text-rose-600' : (grandPercent >= 80 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600')}`;
                }
                if (fyProgressBar) {
                    fyProgressBar.style.width = `${Math.min(grandPercent, 100)}%`;
                    fyProgressBar.className = `h-full transition-all duration-700 ${grandPercent >= 100 ? 'bg-rose-500' : (grandPercent >= 80 ? 'bg-orange-500' : 'bg-emerald-500')}`;
                }
                if (limitDisplay) limitDisplay.innerText = `Combined Limit: ${formatCurrency(grandLimit)} (Sec 194N)`;
                if (fyDatesDisplay) fyDatesDisplay.innerText = `${fy.label}`;
                
                accountViewHeader.querySelector('h3').innerText = "Bank Accounts";
                if (backBtn) backBtn.classList.add('hidden');
                if (addWithdrawalSection) addWithdrawalSection.classList.add('hidden');
                if (addAccountForm) addAccountForm.classList.remove('hidden');
                if (accountsHeader) accountsHeader.classList.remove('hidden');
                if (withdrawalsHeader) withdrawalsHeader.classList.add('hidden');

                if (accounts.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">No bank accounts added yet.</td></tr>`;
                } else {
                    accounts.forEach(acc => {
                        const accWithdrawals = withdrawalsList.filter(w => String(w.accountId) === String(acc.id));
                        let fyTotal = 0;
                        accWithdrawals.forEach(w => {
                            const wDate = new Date(w.date);
                            if (wDate >= fy.start && wDate <= fy.end) {
                                fyTotal += (parseFloat(w.amount) || 0);
                            }
                        });

                        const limit = 10000000; // 1 Crore
                        const pecent = (fyTotal / limit) * 100;
                        const statusClass = pecent >= 100 ? 'bg-rose-100 text-rose-600' : (pecent >= 80 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600');
                        const statusText = pecent >= 100 ? 'OVER LIMIT' : (pecent >= 80 ? 'WARNING' : 'SAFE');
                        
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 transition-colors cursor-pointer group";
                        tr.onclick = (e) => {
                            if(e.target.closest('button')) return;
                            showAccountDetails(acc.id);
                        };
                        tr.innerHTML = `
                            <td class="px-6 py-2 font-bold group-hover:text-primary transition-colors">${acc.name}</td>
                            <td class="px-6 py-2 font-bold text-slate-700 text-right">${formatCurrency(fyTotal)}</td>
                            <td class="px-6 py-2 text-center">
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${statusClass}">${statusText} (${pecent.toFixed(1)}%)</span>
                            </td>
                            <td class="px-6 py-2 text-right flex justify-end gap-1">
                                <button onclick="event.stopPropagation(); showAccountDetails('${acc.id}')" class="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="View">
                                    <span class="material-symbols-outlined text-lg">visibility</span>
                                </button>
                                <button onclick="event.stopPropagation(); editBankAccountRecord('${acc.id}')" class="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg" title="Edit">
                                    <span class="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button onclick="event.stopPropagation(); deleteBankAccountRecord('${acc.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg" title="Delete">
                                    <span class="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
            } else {
                const acc = accounts.find(a => String(a.id) === String(activeAccountId));
                if (!acc) { showAccountsList(); return; }

                accountViewHeader.querySelector('h3').innerText = "Account: " + acc.name;
                if (backBtn) backBtn.classList.remove('hidden');
                if (addWithdrawalSection) addWithdrawalSection.classList.remove('hidden');
                if (addAccountForm) addAccountForm.classList.add('hidden');
                if (accountsHeader) accountsHeader.classList.add('hidden');
                if (withdrawalsHeader) withdrawalsHeader.classList.remove('hidden');

                const accWithdrawals = withdrawalsList.filter(w => String(w.accountId) === String(activeAccountId));
                accWithdrawals.sort((a,b) => {
                    const d1 = new Date(a.date);
                    const d2 = new Date(b.date);
                    if (d1.getTime() !== d2.getTime()) return d2 - d1;
                    return (b.id || 0) - (a.id || 0);
                });

                let fyTotal = 0;
                
                if (accWithdrawals.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No withdrawals recorded yet.</td></tr>`;
                } else {
                    accWithdrawals.forEach(w => {
                        const amount = parseFloat(w.amount) || 0;
                        const wDate = new Date(w.date);
                        if(wDate >= fy.start && wDate <= fy.end) {
                            fyTotal += amount;
                        }

                        let methodHtml = `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">${w.method}</span>`;
                        if(w.method === 'ATM') methodHtml = `<span class="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-xs font-bold">ATM</span>`;
                        if(w.method === 'ATM QR Code') methodHtml = `<span class="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-xs font-bold">ATM QR Code</span>`;
                        if(w.method === 'ATM Inside Branch') methodHtml = `<span class="bg-amber-100 text-amber-600 px-2 py-0.5 rounded text-xs font-bold">ATM Inside Branch</span>`;
                        if(w.method.includes('Cheque')) methodHtml = `<span class="bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-xs font-bold">Cheque</span>`;
                        if(w.method.includes('Yono')) methodHtml = `<span class="bg-pink-100 text-pink-600 px-2 py-0.5 rounded text-xs font-bold">Yono Cash</span>`;

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 transition-colors";
                        tr.innerHTML = `
                            <td class="px-6 py-2 text-xs font-medium text-slate-500 whitespace-nowrap">${wDate.toLocaleDateString('en-GB')}</td>
                            <td class="px-6 py-2 text-sm font-bold text-right text-rose-600">${formatCurrency(amount)}</td>
                            <td class="px-6 py-2">${methodHtml}</td>
                            <td class="px-6 py-2 text-xs text-slate-500 italic">${w.note || ""}</td>
                            <td class="px-6 py-2 text-right flex justify-end gap-1">
                                <button onclick="editBankWithdrawalRecord('${w.id}')" class="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg" title="Edit">
                                    <span class="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button onclick="deleteBankWithdrawalRecord('${w.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg" title="Delete">
                                    <span class="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }

                // Update limit UI
                const limit = 10000000; // 1 Crore
                const pecent = (fyTotal / limit) * 100;
                if(fyTotalDisplay) {
                    fyTotalDisplay.innerText = formatCurrency(fyTotal);
                    fyTotalDisplay.previousElementSibling.innerText = "TOTAL FY WITHDRAWALS (" + acc.name.toUpperCase() + ")";
                }
                if(fyPercentage) {
                    fyPercentage.innerText = `${pecent.toFixed(1)}% Used`;
                    fyPercentage.className = `text-lg font-bold px-3 py-1 rounded-lg ${pecent >= 100 ? 'bg-rose-100 text-rose-600' : (pecent >= 80 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600')}`;
                }
                if(fyProgressBar) {
                    fyProgressBar.style.width = `${Math.min(pecent, 100)}%`;
                    fyProgressBar.className = `h-full transition-all duration-700 ${pecent >= 100 ? 'bg-rose-500' : (pecent >= 80 ? 'bg-orange-500' : 'bg-emerald-500')}`;
                }
                if (limitDisplay) limitDisplay.innerText = `Limit: ${formatCurrency(limit)} (Sec 194N)`;
                if (fyDatesDisplay) fyDatesDisplay.innerText = `${fy.label}`;
            }

        } catch (e) { console.error("render error:", e); }
    }

    if(addAccountForm) {
        addAccountForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const name = document.getElementById('new-account-name').value.trim();
            const editIdInput = document.getElementById('edit-account-id');
            const isEditing = editIdInput && editIdInput.value;
            
            if(name) {
                const uniqueId = isEditing ? editIdInput.value : Date.now();
                await saveBankAccount({ id: uniqueId, name });
                addAccountForm.reset();
                if (editIdInput) editIdInput.value = '';
                const submitBtn = addAccountForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">add_card</span> Add Account';
                await renderView();
            }
        });
    }

    if(withdrawalForm) {
        const dInput = document.getElementById('withdrawal-date');
        if(dInput) dInput.valueAsDate = new Date();
        
        withdrawalForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const editIdInput = document.getElementById('edit-withdrawal-id');
            const isEditing = editIdInput && editIdInput.value;
            
            const withdrawal = {
                id: isEditing ? editIdInput.value : Date.now(),
                accountId: activeAccountId,
                date: document.getElementById('withdrawal-date').value,
                amount: parseFloat(document.getElementById('withdrawal-amount').value),
                method: document.getElementById('withdrawal-method').value,
                note: document.getElementById('withdrawal-note').value
            };
            await saveBankWithdrawal(withdrawal);
            withdrawalForm.reset();
            document.getElementById('withdrawal-date').valueAsDate = new Date();
            if (editIdInput) editIdInput.value = '';
            const submitBtn = withdrawalForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> Check & Save';
            await renderView();
        });
    }

    window.showAccountDetails = async (id) => {
        currentView = 'withdrawals';
        activeAccountId = id;
        await renderView();
    };

    window.showAccountsList = async () => {
        currentView = 'accounts';
        activeAccountId = null;
        await renderView();
    };
    
    window.editBankAccountRecord = async (id) => {
        const accs = await loadBankAccounts();
        const acc = accs.find(x => String(x.id) === String(id));
        if (acc) {
            document.getElementById('new-account-name').value = acc.name;
            let editIdInput = document.getElementById('edit-account-id');
            if (!editIdInput) {
                editIdInput = document.createElement('input');
                editIdInput.type = 'hidden';
                editIdInput.id = 'edit-account-id';
                addAccountForm.appendChild(editIdInput);
            }
            editIdInput.value = acc.id;
            const submitBtn = addAccountForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<span class="material-symbols-outlined text-sm">update</span> Update Account';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    window.deleteBankAccountRecord = (id) => {
        deleteTargetId = id;
        deleteTargetType = 'account';
        const titleEl = document.getElementById('delete-modal-title');
        const descEl = document.getElementById('delete-modal-description');
        if (titleEl) titleEl.innerText = "Delete Bank Account?";
        if (descEl) descEl.innerText = "Are you sure you want to delete this bank account? All associated withdrawal history will NOT be deleted from the system, but you will lose this account entry. This action cannot be undone.";
        if (deleteModal) deleteModal.classList.remove('hidden');
    };
    
    window.editBankWithdrawalRecord = async (id) => {
        const wList = await loadBankWithdrawals();
        const w = wList.find(x => String(x.id) === String(id));
        if (w) {
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
    };

    window.deleteBankWithdrawalRecord = (id) => {
        deleteTargetId = id;
        deleteTargetType = 'withdrawal';
        const titleEl = document.getElementById('delete-modal-title');
        const descEl = document.getElementById('delete-modal-description');
        if (titleEl) titleEl.innerText = "Delete Withdrawal Record?";
        if (descEl) descEl.innerText = "Are you sure you want to delete this withdrawal record? This action cannot be undone.";
        if (deleteModal) deleteModal.classList.remove('hidden');
    };

    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = async () => {
            if (!deleteTargetId) return;
            
            confirmDeleteBtn.disabled = true;
            const originalText = confirmDeleteBtn.innerHTML;
            confirmDeleteBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">sync</span> Deleting...';

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
            } catch (err) {
                console.error("Delete error:", err);
                alert("Failed to delete record.");
            } finally {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.innerHTML = originalText;
                deleteTargetId = null;
                deleteTargetType = null;
            }
        };
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = () => {
            if (deleteModal) deleteModal.classList.add('hidden');
            deleteTargetId = null;
            deleteTargetType = null;
        };
    }

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
                linkedCredit = existingCredits.find(cr => (cr.description === 'Synced from Daily Txn' || cr.note === newTxn.note.trim() || cr.note?.startsWith(newTxn.note.trim())) && cr.date === newTxn.date && String(cr.customerId) === String(customer.id));
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
    const txnConditional = document.getElementById('txn-conditional');
    const txnProvider = document.getElementById('txn-provider');
    const conditionalLabel = document.getElementById('conditional-label');
    const conditionalContainer = document.getElementById('conditional-field-container');
    const providerContainer = document.getElementById('provider-field-container');
    const amountFieldContainer = document.getElementById('amount-field-container');
    const noteFieldContainer = document.getElementById('note-field-container');
    const remarkFieldContainer = document.getElementById('remark-field-container');
    const addressFieldContainer = document.getElementById('address-field-container');
    const txnBank = document.getElementById('txn-bank');
    const bankContainer = document.getElementById('bank-field-container');
    const txnDateText = document.getElementById('current-date-text');
    const txnCountBadge = document.getElementById('txn-count-badge');
    const txnViewDate = document.getElementById('txn-view-date');
    const aepsCountBadge = document.getElementById('aeps-count-badge');
    const matmCountBadge = document.getElementById('matm-count-badge');
    const depositCountBadge = document.getElementById('deposit-count-badge');
    const withdrawalCountBadge = document.getElementById('withdrawal-count-badge');
    const photocopyCountBadge = document.getElementById('photocopy-count-badge');
    const printoutCountBadge = document.getElementById('printout-count-badge');
    const onlineWorkCountBadge = document.getElementById('online-work-count-badge');
    const passportCountBadge = document.getElementById('passport-count-badge');
    const laminationCountBadge = document.getElementById('lamination-count-badge');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');

    let editingTxnId = null;
    let deletingTxnId = null;
    let unsubscribe = null;
    let currentSelectedDate = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    let allTxnsForDate = [];
    let currentStartCash = 0;
    let currentStartOnline = 0;
    let currentAvailableCash = 0; // Tracks live cash for validation
    let currentAvailableOnline = 0; // Tracks live online for validation
    let currentAvailableJio = 0; // Tracks live Jio balance for validation
    let currentAvailableDamaged = 0; // Tracks live damaged currency for validation
    let currentAvailableCrgb = 0; // Tracks live CRGB BC balance for validation
    let currentAvailableRoinet = 0; // Tracks live Roinet (ID specific) for validation
    let currentAvailableAirtel = 0; // Tracks live Airtel for validation
    let currentAvailableSpiceMoney = 0; // Tracks live Spice Money for validation

    // Initialize date picker
    if (txnViewDate) {
        txnViewDate.value = currentSelectedDate;
        txnViewDate.addEventListener('change', (e) => {
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
            if (deletingTxnId) {
                try {
                    const snap = await getDocs(collection(db, 'daily_transactions'));
                    const targetTxnDoc = snap.docs.find(d => d.id === deletingTxnId);
                    if (targetTxnDoc) {
                        await syncCreditFromDailyTxn(targetTxnDoc.data(), deletingTxnId, true);
                    } else {
                        await syncCreditFromDailyTxn(null, deletingTxnId, true);
                    }
                } catch(e) { console.error(e); }
                await deleteDoc(doc(db, 'daily_transactions', deletingTxnId));
                hideDeleteModal();
            }
        };
    }

    const resetFormState = () => {
        editingTxnId = null;
        form.reset();
        txnType.value = 'AEPS';
        txnProvider.value = '';
        if (txnRemark) txnRemark.value = '';
        txnRemaining.value = '';
        txnBank.value = '';
        if (amountLabel) amountLabel.innerText = 'Amount';
        if (remainingContainer) remainingContainer.classList.add('hidden');
        if (bankContainer) bankContainer.classList.add('hidden');
        if (remarkFieldContainer) remarkFieldContainer.classList.add('hidden');
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
        const simplifiedTypes = ['JIO_TOPUP', 'DISHTV_RECHARGE', 'SETTLEMENT'];
        const amountOnlyTypes = ['JIO_RECHARGE', 'GOLD_SIP', 'DAMAGED_CURRENCY'];
        const noteAndAmountTypes = ['ADMIN_DEPOSIT', 'ADMIN_WITHDRAWAL'];
        const creditTypes = ['CREDIT_GIVEN', 'CREDIT_RECEIVED', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE'];
        const isDamagedRecovery = txnType.value === 'DAMAGED_RECOVERY';
        const isChargesOnly = chargesOnlyTypes.includes(txnType.value);
        const isSimplified = simplifiedTypes.includes(txnType.value);
        const isAmountOnly = amountOnlyTypes.includes(txnType.value);
        const isNoteAndAmount = noteAndAmountTypes.includes(txnType.value);
        const isCredit = creditTypes.includes(txnType.value);

        // Disable/Enable fields
        txnAmount.disabled = isChargesOnly;
        txnNote.disabled = (isChargesOnly && txnType.value !== 'OTHER_INCOME') || isSimplified || isAmountOnly || isDamagedRecovery;
        txnAddress.disabled = isChargesOnly || isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery;
        txnConditional.disabled = isChargesOnly || isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery;

        // Reset Labels
        if (chargesModeContainer) {
            const label = chargesModeContainer.querySelector('label');
            if (label) label.innerText = isDamagedRecovery ? 'CONVERTED TO' : 'CHARGES MODE';
        }

        if (isChargesOnly || isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery) {
            conditionalContainer.classList.add('hidden');
            if (amountFieldContainer) {
                if (isSimplified || isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery) amountFieldContainer.classList.remove('hidden');
                else amountFieldContainer.classList.add('hidden');
            }
            if (noteFieldContainer) {
                if ((isNoteAndAmount || isCredit || txnType.value === 'OTHER_INCOME') && !isDamagedRecovery) {
                    noteFieldContainer.classList.remove('hidden');
                    const label = noteFieldContainer.querySelector('label');
                    const input = noteFieldContainer.querySelector('input');
                    if (label) label.innerText = txnType.value === 'DAILY_EXPENSE' ? 'DESCRIPTION' : 'CUSTOMER NAME';
                    if (input) input.placeholder = txnType.value === 'DAILY_EXPENSE' ? 'Enter description...' : 'Enter Name...';
                }
                else noteFieldContainer.classList.add('hidden');
            }
            if (remarkFieldContainer) {
                if (['CREDIT_GIVEN', 'CREDIT_RECEIVED'].includes(txnType.value)) {
                    remarkFieldContainer.classList.remove('hidden');
                } else {
                    remarkFieldContainer.classList.add('hidden');
                    if (txnRemark) txnRemark.value = '';
                }
            }
            if (addressFieldContainer) addressFieldContainer.classList.add('hidden');
            
            // Charges Field Visibility
            if (chargesFieldContainer) {
                if (isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery) {
                    chargesFieldContainer.classList.add('hidden');
                    if (chargesModeContainer) {
                        chargesModeContainer.classList.add('hidden');
                    }
                } else if (['JIO_TOPUP', 'ROINET_COMMISSION', 'DISHTV_RECHARGE', 'JIO_RECHARGE', 'SETTLEMENT'].includes(txnType.value)) {
                    chargesFieldContainer.classList.remove('hidden');
                    if (chargesModeContainer) chargesModeContainer.classList.add('hidden');
                } else {
                    chargesFieldContainer.classList.remove('hidden');
                    if (chargesModeContainer) chargesModeContainer.classList.remove('hidden');
                }
            }
            
            if (isChargesOnly) txnAmount.value = '';
            if (isAmountOnly || isNoteAndAmount || isCredit || isDamagedRecovery) txnCharges.value = '';
            if (!isNoteAndAmount && !isCredit && txnType.value !== 'OTHER_INCOME' && !isDamagedRecovery) txnNote.value = '';
            txnAddress.value = '';
            txnConditional.value = '';
        } else {
            if (amountFieldContainer) amountFieldContainer.classList.remove('hidden');
            if (noteFieldContainer) noteFieldContainer.classList.remove('hidden');
            if (remarkFieldContainer) {
                remarkFieldContainer.classList.add('hidden');
                if (txnRemark) txnRemark.value = '';
            }
            if (addressFieldContainer) addressFieldContainer.classList.remove('hidden');
            if (chargesFieldContainer) chargesFieldContainer.classList.remove('hidden');
            if (chargesModeContainer) chargesModeContainer.classList.remove('hidden');
            
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

        // Set Default Charges Mode based on Type
        if (['JIO_TOPUP', 'ROINET_COMMISSION'].includes(txnType.value)) {
            if (txnChargesType) txnChargesType.value = 'Online';
        } else if (['DISHTV_RECHARGE', 'JIO_RECHARGE'].includes(txnType.value)) {
            // Sync with Pay Mode for recharges
            if (txnProvider && txnChargesType) {
                txnChargesType.value = txnProvider.value || 'Cash';
            }
        } else if (!editingTxnId && txnChargesType) {
            // Default to Cash for others if creating new
            txnChargesType.value = 'Cash';
        }

        // Service Provider & Remaining Amount Visibility
        const providerTypes = ['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'DISHTV_RECHARGE', 'JIO_RECHARGE', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE', 'SETTLEMENT', 'ONLINE_WORK', 'DAMAGED_RECOVERY'];
        const remainingTypes = ['AEPS', 'MATM'];
        
        const providerLabel = document.querySelector('#provider-field-container label');

        if (providerTypes.includes(txnType.value)) {
            providerContainer.classList.remove('hidden');
            if (isCredit || ['DISHTV_RECHARGE', 'JIO_RECHARGE', 'DAMAGED_RECOVERY'].includes(txnType.value)) {
                if (providerLabel) providerLabel.innerText = txnType.value === 'DAILY_EXPENSE' ? 'Exp Mode' : (txnType.value === 'DAMAGED_RECOVERY' ? 'Recovered To' : 'Pay Mode');
                if (amountLabel) amountLabel.innerText = 'Amount';
            } else {
                if (providerLabel) providerLabel.innerText = 'Service Provider';
                if (amountLabel) amountLabel.innerText = 'Txn Amount';
            }
        } else {
            providerContainer.classList.add('hidden');
            txnProvider.value = '';
            if (amountLabel) amountLabel.innerText = 'Amount';
        }

        // Service Provider Options Filtering
        if (txnProvider) {
            const aepsMatmProviders = ['Airtel', 'Roinet', 'SpiceMoney', 'Crgb Bc'];
            const depositWithdrawProviders = ['Phonepay', 'Gpay', 'Slice', 'Yono sbi'];
            
            const isAepsMatm = ['AEPS', 'MATM', 'SETTLEMENT'].includes(txnType.value);
            const isDepositWithdraw = ['DEPOSIT', 'WITHDRAWAL'].includes(txnType.value);
            const isCredit = ['CREDIT_GIVEN', 'CREDIT_RECEIVED', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE'].includes(txnType.value);
            
            Array.from(txnProvider.options).forEach(opt => {
                if (!opt.value) return; // Skip placeholder
                
                if (isAepsMatm) {
                    opt.style.display = aepsMatmProviders.includes(opt.value) ? '' : 'none';
                } else if (isDepositWithdraw) {
                    opt.style.display = depositWithdrawProviders.includes(opt.value) ? '' : 'none';
                } else if (isCredit || ['DISHTV_RECHARGE', 'JIO_RECHARGE', 'ONLINE_WORK', 'DAMAGED_RECOVERY'].includes(txnType.value)) {
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
        if (['AEPS', 'MATM', 'SETTLEMENT'].includes(txnType.value)) {
            bankContainer.classList.remove('hidden');
        } else {
            bankContainer.classList.add('hidden');
            txnBank.value = '';
        }

        if (txnNote) {
            if (['CREDIT_GIVEN', 'CREDIT_RECEIVED'].includes(txnType.value)) {
                txnNote.setAttribute('list', 'customer-list');
                populateCustomerSuggestions();
            } else {
                txnNote.removeAttribute('list');
            }
        }
    };

    if (txnType) {
        txnType.addEventListener('change', updateConditionalField);
        updateConditionalField();
    }

    // Attach Submit Listener EARLY
    form.onsubmit = async (e) => {
        e.preventDefault();
        console.log('Save Button Clicked - Starting process');
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Saving...';
        }

        try {
            const chargesOnlyTypes = ['PHOTOCOPY', 'PRINTOUT', 'PASSPORT', 'LAMINATION', 'ROINET_COMMISSION', 'OTHER_INCOME'];
            const isChargesOnly = chargesOnlyTypes.includes(txnType.value);
            
            const amountVal = isChargesOnly ? 0 : parseFloat(txnAmount.value);
            const chargesVal = parseFloat(txnCharges.value || 0);

            if (!isChargesOnly && isNaN(amountVal)) {
                alert('Please enter a valid amount.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Save Transaction';
                }
                return;
            }

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

            // Cash Sufficiency Check for AEPS, MATM, WITHDRAWAL, DAMAGED_CURRENCY
            if (['AEPS', 'MATM', 'WITHDRAWAL', 'DAMAGED_CURRENCY'].includes(txnType.value)) {
                if (amountVal > currentAvailableCash) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Cash',
                        text: `You only have ₹ ${currentAvailableCash.toLocaleString('en-IN')} available in cash. Please add more cash or check your balances.`,
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
                if (amountVal > currentAvailableOnline) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Online Balance',
                        text: `You only have ₹ ${currentAvailableOnline.toLocaleString('en-IN')} available online. Please check your account balances.`,
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
                if (amountVal > currentAvailableJio) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Jio Balance',
                        text: `You only have ₹ ${currentAvailableJio.toLocaleString('en-IN')} available in Jio. Please add funds to Jio balance first.`,
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
                if (amountVal > currentAvailableDamaged) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Insufficient Damaged Balance',
                        text: `You only have ₹ ${currentAvailableDamaged.toLocaleString('en-IN')} available in damaged currency. You cannot recover more than what you have.`,
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

                if (provider === 'Roinet') { available = currentAvailableRoinet; }
                else if (provider === 'Airtel') { available = currentAvailableAirtel; }
                else if (provider === 'SpiceMoney') { available = currentAvailableSpiceMoney; }
                else if (provider === 'Crgb Bc') { available = currentAvailableCrgb; }
                else {
                    // Fallback to general Online if provider not specifically tracked
                    available = currentAvailableOnline;
                    providerName = provider || 'Selected Provider';
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
                charges: isNaN(chargesVal) ? 0 : chargesVal,
                note: capitalizeWords(txnNote.value.trim()),
                remark: txnRemark ? capitalizeWords(txnRemark.value.trim()) : '',
                address: capitalizeWords(txnAddress.value.trim()),
                extraDetails: (['AEPS', 'MATM'].includes(txnType.value)) ? txnConditional.value.trim() : '',
                provider: (['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'DISHTV_RECHARGE', 'JIO_RECHARGE', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE', 'SETTLEMENT', 'ONLINE_WORK', 'DAMAGED_RECOVERY'].includes(txnType.value)) ? txnProvider.value : '',
                chargesType: txnChargesType ? txnChargesType.value : 'Cash',
                remainingAmount: (['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL'].includes(txnType.value)) ? parseFloat(txnRemaining.value || 0) : 0,
                bankName: (['AEPS', 'MATM', 'SETTLEMENT'].includes(txnType.value)) ? txnBank.value.trim() : '',
                date: currentSelectedDate,
                timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
            };

            console.log('Attempting to ' + (editingTxnId ? 'update' : 'add') + ' doc in Firestore:', newTxn);
            const txnCollection = collection(db, 'daily_transactions');
            
            if (editingTxnId) {
                await updateDoc(doc(db, 'daily_transactions', editingTxnId), newTxn);
                console.log('Update Success!');
                await syncCreditFromDailyTxn(newTxn, editingTxnId, false);
            } else {
                const docRef = await addDoc(txnCollection, newTxn);
                console.log('Add Success!');
                await syncCreditFromDailyTxn(newTxn, docRef.id, false);
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
        }
    };

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
            const roinetBreakdown = { roinet: 0, airtel: 0, spicemoney: 0 };

            // Re-calculate based on transactions
            transactions.forEach(t => {
                const amt = parseFloat(t.amount || 0);
                const chg = parseFloat(t.charges || 0);
                const provider = (t.provider || "").trim().toLowerCase();
                
                if (t.chargesType === 'Online') balances.online += chg;
                else balances.cash += chg;

                if (['AEPS', 'MATM', 'WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
                    balances.cash -= amt; 
                    // Add to Total Online
                    balances.online += amt;
                    // Also track individual account — Airtel & SpiceMoney go into Roinet
                    if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
                        balances.roinet += amt;
                        if (provider.includes('airtel')) roinetBreakdown.airtel += amt;
                        else if (provider.includes('spicemoney')) roinetBreakdown.spicemoney += amt;
                        else roinetBreakdown.roinet += amt;
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
                } else if (t.type === 'DISHTV_RECHARGE') {
                    balances.roinet -= amt; 
                    balances.online -= amt; // Total digital decreases by recharge amount
                    if (provider === 'cash') balances.cash += amt;
                    else balances.online += amt; // Added back to digital if paid digitally
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
                        if (provider.includes('airtel')) roinetBreakdown.airtel -= totalDeduction;
                        else if (provider.includes('spicemoney')) roinetBreakdown.spicemoney -= totalDeduction;
                        else roinetBreakdown.roinet -= totalDeduction;
                    }
                    else if (provider.includes('crgb')) balances.crgb -= totalDeduction;
                    else if (provider.includes('jio')) balances.jio -= totalDeduction;
                    
                    // Add charges to expense
                    balances.expense += chg;
                } else if (t.type === 'ONLINE_WORK') {
                    balances.online -= amt; // Work cost
                    if (provider === 'cash') balances.cash += amt;
                    else balances.online += amt; // Paid from bank
                } else if (t.type === 'GOLD_SIP') {
                    balances.online -= amt;
                    balances.expense += amt;
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

            currentAvailableRoinet = (totalSplitOpening > 0 ? opRoinet : roinetOpeningFallback) + roinetBreakdown.roinet;
            currentAvailableAirtel = opAirtel + roinetBreakdown.airtel;
            currentAvailableSpiceMoney = opSpiceMoney + roinetBreakdown.spicemoney;

            window._roinetBreakdown = {
                opening: {
                    roinet: totalSplitOpening > 0 ? opRoinet : roinetOpeningFallback,
                    airtel: opAirtel,
                    spicemoney: opSpiceMoney,
                    total: roinetOpeningFallback
                },
                closing: {
                    roinet: (totalSplitOpening > 0 ? opRoinet : roinetOpeningFallback) + roinetBreakdown.roinet,
                    airtel: opAirtel + roinetBreakdown.airtel,
                    spicemoney: opSpiceMoney + roinetBreakdown.spicemoney,
                    total: roinetOpeningFallback + (balances.roinet || 0)
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
                        <td colspan="7" class="px-6 py-20 text-center">
                            <div class="flex flex-col items-center justify-center gap-4">
                                <div class="size-12 border-[4px] border-primary/10 border-t-primary rounded-full animate-spin"></div>
                                <div class="space-y-1">
                                    <p class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest animate-pulse">Fetching Transactions</p>
                                    <p class="text-[10px] font-bold text-slate-400 uppercase">Please wait while we sync with database...</p>
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
                    } else if (t.type === 'DISHTV_RECHARGE' || t.type === 'JIO_RECHARGE') {
                        if (!(isNewLogic && t.type === 'JIO_RECHARGE')) {
                            currentOnline -= amt;
                        }
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

        const excludedTypes = ['ADMIN_DEPOSIT', 'ADMIN_WITHDRAWAL', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'JIO_RECHARGE', 'GOLD_SIP', 'DAMAGED_CURRENCY', 'DAMAGED_RECOVERY', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE'];
        const includedVolumeTypes = ['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL'];
        
        const countableTxns = allTxnsForDate.filter(t => !excludedTypes.includes(t.type));
        const volumeTxns = allTxnsForDate.filter(t => includedVolumeTypes.includes(t.type));

        const totalDayAmount = volumeTxns.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const totalDayCharges = countableTxns.reduce((sum, t) => sum + parseFloat(t.charges || 0), 0);

        if (txnCountBadge) txnCountBadge.innerHTML = `
            <div class="flex flex-col items-start leading-tight">
                <span class="text-[10px] opacity-60 uppercase font-black">All TXNS</span>
                <span class="text-sm font-black">${countableTxns.length} | ₹${totalDayAmount.toLocaleString('en-IN')}</span>
                <span class="text-[9px] text-amber-500 font-bold">Fees: ₹${totalDayCharges.toLocaleString('en-IN')}</span>
            </div>
        `;

        const updateBadge = (badge, type, label) => {
            if (!badge) return;
            const s = stats[type] || { count: 0, amount: 0, charges: 0 };
            badge.innerHTML = `
                <div class="flex flex-col items-start leading-tight">
                    <span class="text-[10px] opacity-60 uppercase font-black">${label}</span>
                    <span class="text-xs font-black">${s.count} | ₹${s.amount.toLocaleString('en-IN')}</span>
                    <span class="text-[8px] opacity-80 font-bold italic">F: ₹${s.charges.toLocaleString('en-IN')}</span>
                </div>
            `;
        };

        updateBadge(aepsCountBadge, 'AEPS', 'AEPS');
        updateBadge(matmCountBadge, 'MATM', 'MATM');
        updateBadge(depositCountBadge, 'DEPOSIT', 'DEPOSIT');
        updateBadge(withdrawalCountBadge, 'WITHDRAWAL', 'WITHDRAW');
        updateBadge(photocopyCountBadge, 'PHOTOCOPY', 'PHOTOCOPY');
        updateBadge(printoutCountBadge, 'PRINTOUT', 'PRINTOUT');
        updateBadge(onlineWorkCountBadge, 'ONLINE_WORK', 'ONLINE WORK');
        updateBadge(passportCountBadge, 'PASSPORT', 'PASSPORT');
        updateBadge(laminationCountBadge, 'LAMINATION', 'LAMINATN');

        // Now filter the table data
        const txnsToRender = currentTxnFilter === 'ALL' ? allTxnsForDate : allTxnsForDate.filter(t => t.type === currentTxnFilter);
        
        const showBalanceDiff = localStorage.getItem('dtxn_showBalanceDiff') !== 'false';

        const countableIds = countableTxns.map(t => t.id);

        tableBody.innerHTML = '';
        txnsToRender.forEach((txn) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-primary/5 transition-colors group';
            
            const time = txn.timestamp ? new Date(txn.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
            
            const isExcluded = excludedTypes.includes(txn.type);
            const serialPos = isExcluded ? null : (countableIds.length - countableIds.indexOf(txn.id));

            tr.innerHTML = `
                <td class="px-6 py-4"><span class="text-xs font-bold text-slate-500">${isExcluded ? '—' : '#' + serialPos}</span></td>
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${time}</span>
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">${txn.date}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-col items-start gap-1">
                        <span class="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            txn.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10' :
                            txn.type === 'WITHDRAWAL' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10' :
                            'bg-primary/10 text-primary'
                        }">${txn.type}</span>
                        ${txn.provider ? `<span class="text-[9px] text-primary font-bold uppercase tracking-tight flex items-center gap-1"><span class="material-symbols-outlined text-[11px]">account_balance_wallet</span>${txn.provider}</span>` : ''}
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-col gap-1.5">
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-100">${txn.note || '-'}</span>
                        ${txn.bankName ? `
                            <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 w-fit">
                                <span class="material-symbols-outlined text-[14px] text-blue-600">account_balance</span>
                                <span class="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">${txn.bankName}</span>
                            </div>
                        ` : ''}
                        ${txn.address || txn.extraDetails ? `
                            <div class="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                                ${txn.address ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">location_on</span>${txn.address}</span>` : ''}
                                ${txn.extraDetails ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">fingerprint</span>${txn.extraDetails}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex flex-col items-end">
                        <span class="text-sm font-black text-slate-900 dark:text-white">₹${parseFloat(txn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        ${txn.remainingAmount ? `<span class="text-[9px] text-amber-600 font-bold">Rem: ₹${parseFloat(txn.remainingAmount).toLocaleString('en-IN')}</span>` : ''}
                    </div>
                </td>
                <td class="px-3 py-1.5 text-right charges-col-cell">
                    <div class="flex flex-col items-end">
                        ${((['GOLD_SIP', 'ADMIN_DEPOSIT', 'ADMIN_WITHDRAWAL', 'DAMAGED_CURRENCY', 'DAMAGED_RECOVERY', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'CUST_MONEY_IN', 'CUST_MONEY_OUT', 'DAILY_EXPENSE', 'JIO_RECHARGE', 'DISH_TV', 'JIO_TOPUP', 'SETTLEMENT', 'ROINET_COMMISSION', 'OTHER_INCOME'].includes(txn.type)) && parseFloat(txn.charges || 0) === 0) ? `
                            <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-bold text-slate-400 uppercase tracking-widest w-fit">N/A</span>
                        ` : `
                            <span class="text-sm font-bold text-primary italic">₹${parseFloat(txn.charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            <span class="text-[8px] font-black uppercase tracking-widest ${txn.chargesType === 'Online' ? 'text-blue-500' : 'text-emerald-500'}">${txn.chargesType || 'Cash'}</span>
                        `}
                    </div>
                </td>
                <td class="px-3 py-1.5 balance-col-cell">
                    <div class="flex flex-col items-center justify-center gap-1 min-w-[100px]">
                        <span class="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20 w-full flex justify-between items-center">
                            <span>C: ₹${(txn.runningCash || 0).toLocaleString('en-IN')}</span>
                            ${showBalanceDiff && txn.cashDiff !== 0 ? `<span class="text-[9px] font-bold ${txn.cashDiff > 0 ? 'text-emerald-500' : 'text-rose-500'}">(${txn.cashDiff > 0 ? '+' : ''}${txn.cashDiff.toLocaleString('en-IN')})</span>` : '<span></span>'}
                        </span>
                        <span class="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-500/20 w-full flex justify-between items-center">
                            <span>O: ₹${(txn.runningOnline || 0).toLocaleString('en-IN')}</span>
                            ${showBalanceDiff && txn.onlineDiff !== 0 ? `<span class="text-[9px] font-bold ${txn.onlineDiff > 0 ? 'text-blue-500' : 'text-rose-500'}">(${txn.onlineDiff > 0 ? '+' : ''}${txn.onlineDiff.toLocaleString('en-IN')})</span>` : '<span></span>'}
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4">
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

        // Re-attach edit/delete listeners
        document.querySelectorAll('.edit-txn-btn').forEach(btn => {
            btn.onclick = () => {
                const txn = allTxnsForDate.find(t => t.id === btn.dataset.id);
                if (txn) {
                    editingTxnId = txn.id;
                    txnType.value = txn.type;
                    txnAmount.value = txn.amount;
                    txnCharges.value = txn.charges;
                    txnNote.value = txn.note;
                    if (txnRemark) txnRemark.value = txn.remark || '';
                    txnAddress.value = txn.address;
                    txnConditional.value = txn.extraDetails || '';
                    txnProvider.value = txn.provider || '';
                    txnRemaining.value = txn.remainingAmount || '';
                    txnBank.value = txn.bankName || '';
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

    // Filter listeners
    document.querySelectorAll('.txn-filter-badge').forEach(badge => {
        badge.onclick = () => {
            currentTxnFilter = badge.getAttribute('data-type');
            
            // UI Visual Feedback
            document.querySelectorAll('.txn-filter-badge').forEach(b => {
                b.classList.remove('active-filter', 'ring-2');
            });
            badge.classList.add('active-filter', 'ring-2');
            
            renderBadgesAndTable();
        };
    });

    // Initial load
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

