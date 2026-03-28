import { db } from './firebase-config.js';

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    where,
    updateDoc,
    writeBatch,
    setDoc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Global Dashboard State for Real-Time listeners and Charts
let dashboardUnsubscribe = null;
let incomeExpenseChart = null;
let profitGrowthChart = null;
let incomeGrowthChart = null;
let expenseGrowthChart = null;

// Helper for Firestore calls (maintaining naming for compatibility where possible)
async function loadEntries() {
    if (!db) { console.error("Firestore db not initialized in loadEntries"); return []; }
    try {
        const querySnapshot = await getDocs(collection(db, "entries"));
        return querySnapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
    } catch (e) {
        console.error("Error loading entries: ", e);
        return [];
    }
}

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

async function saveCustomer(customer) {
    if (!db) { console.error("Firestore db not initialized in saveCustomer"); return null; }
    try {
        const id = String(customer.id || Date.now());
        console.log("Saving customer with doc ID:", id, "Data:", customer);
        const docRef = doc(db, "customers", id);
        await setDoc(docRef, customer);
        console.log("Customer save successful!");
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

        // 1. Try new date-specific collection
        const docSnap = await getDoc(doc(db, "cash_calculator_data", docId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (hasRealData(data)) {
                console.log(`[CashCalc] Loaded from new collection for ${docId}`);
                return data;
            }
            // doc exists but is empty — fall through to check legacy for today
        }

        // 2. For today's date only: check old 'cash_calculator/latest' as migration source
        if (docId === todayStr) {
            const legacySnap = await getDoc(doc(db, "cash_calculator", "latest"));
            if (legacySnap.exists()) {
                const legacyData = legacySnap.data();
                if (hasRealData(legacyData)) {
                    console.log(`[CashCalc] Migrating legacy data to ${docId}`);
                    // Save to new collection so future loads use the new path
                    await setDoc(doc(db, "cash_calculator_data", docId), { ...legacyData, date: docId });
                    return legacyData;
                }
            }
        }

        // 3. No real data for this date → return empty
        console.log(`[CashCalc] No data for ${docId}, showing empty`);
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
        // Apply any pending transfers from Credit Ledger, Damaged Currency, or Cash Calculator
        const selectedCredit = localStorage.getItem('selected_credit_transfer');
        const selectedDamages = localStorage.getItem('selected_damages_transfer');
        const selectedCash = localStorage.getItem('temp_calculator_cash');

        if (selectedCredit || selectedDamages || selectedCash) {
            if (selectedCredit) {
                const creditInput = document.getElementById('credit');
                if (creditInput) {
                    creditInput.value = selectedCredit;
                    creditInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
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
            
            // Formula: Cash + Online + Roinet + Jio + Go2Sms + Credit + Pending + Damages
            const total = v('cash') + v('online') + v('roinet') + v('jio') + v('go2sms') + v('credit') + v('pending') + v('damages');
            
            display.textContent = formatCurrency(total);
        };

        // Attach listeners to all relevant inputs for instant feedback
        const relevantIds = ['cash', 'online', 'roinet', 'jio', 'go2sms', 'credit', 'pending', 'damages'];
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

            const formattedDate = entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            let totalCashFlow = (details['cash'] || 0) + (details['online'] || 0) + (details['roinet'] || 0) + (details['jio'] || 0) + (details['go2sms'] || 0) + (details['credit'] || 0) + (details['pending'] || 0) + (details['damages'] || 0);

            const entry = {
                date: (datePicker && datePicker.value) ? datePicker.value : formattedDate,
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
        let lastMonthTodayIncome = 0, lastMonthTodayExpense = 0;
        let currentMTDIncome = 0, currentMTDExpense = 0;
        let lastMTDIncome = 0, lastMTDExpense = 0;
        let currentFYIncome = 0, currentQIncome = 0;
        let finalRunningBalance = 0;


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

            const tcf = cash + online + roinet + jio + go2sms + credit + pending + damages;
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
            }
            if (entryDate >= qStart && entryDate <= qEnd) {
                currentQIncome += dailyInc;
            }


            // 4. Chart Data
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
            valEl.innerHTML = `${isUp ? '+' : ''}${pct.toFixed(1)}% <span class="font-normal text-slate-400 ml-1">vs yesterday</span>`;
            valEl.parentElement.classList.toggle('text-emerald-500', isUp);
            valEl.parentElement.classList.toggle('text-rose-500', !isUp);
            if (iconEl) iconEl.innerText = isUp ? 'trending_up' : 'trending_down';
        };

        // --- 4. Render Updates ---
        // Summary Cards (All-Time)
        setVal('total-income-top', allTimeIncome);
        setVal('total-expense-top', allTimeExpense);
        setVal('total-profit-top', allTimeProfit);
        setVal('closing-balance-top', finalRunningBalance);
        setVal('total-capital-top', totalCapital);
        setVal('total-withdrawals-top', totalWithdrawal);
        
        // Today Detail
        setVal('today-income-top', todayIncome);
        setVal('today-expense-top', todayExpense);
        setVal('today-profit-top', todayProfit);

        // Trends
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
        setSm('mom-today-income', todayIncome, lastMonthTodayIncome);
        setSm('mom-today-expense', todayExpense, lastMonthTodayExpense);
        setSm('mom-today-profit', todayProfit, lastMonthTodayIncome - lastMonthTodayExpense);
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


        const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const setRange = (id, s, e) => {
            const el = document.getElementById(id);
            if (el) el.innerText = `${fmtDate(s)} - ${fmtDate(e)}`;
        };
        setRange('proj-month-range', mStart, mEnd);
        setRange('proj-quart-range', qStart, qEnd);
        setRange('proj-year-range', yStart, yEnd);

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

    // Sort by date so newest is always at top regardless of Firestore order
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

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
        const getVal = (key) => details[key] || 0;

        const capitalAdd = parseFloat(e.capital) || parseFloat(e.capitalAdd) || 0;
        const cash = getVal('cash');
        const online = getVal('online');
        const roinet = getVal('roinet');
        const jio = getVal('jio');
        const go2sms = getVal('go2sms');
        const credit = getVal('credit');
        const pending = getVal('pending');
        const damages = getVal('damages');

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
        const totalCashFlow = cash + online + roinet + jio + go2sms + credit + pending + damages;
        
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

    // Reverse the rows to show newest at top, and fix S.No (index)
    const finalHtml = rowList.reverse().map((row, i) => row.replace('#ID#', i + 1)).join('');
    tableBody.innerHTML = finalHtml;
}

// Logic for Credit Ledger Page
async function initCreditLedger() {
    const addCustomerForm = document.getElementById('add-customer-form');
    if (!addCustomerForm) return;

    const addTransactionForm = document.getElementById('credit-transaction-form');
    const customerViewHeader = document.getElementById('customer-view-header');
    const addTransactionSection = document.getElementById('add-transaction-section');
    const backBtn = document.getElementById('back-to-ledger');
    const tableBody = document.getElementById('credit-table-body');
    const ledgerHeader = document.getElementById('ledger-header');
    const historyHeader = document.getElementById('history-header');

    const summaryTotal = document.getElementById('summary-total-credit');
    const summaryReceived = document.getElementById('summary-received');
    const summaryPending = document.getElementById('summary-pending');
    const searchInput = document.getElementById('customer-search');
    const useTotalBtn = document.getElementById('use-total-btn');

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
                customerViewHeader.querySelector('h3').innerText = "Customer Management";
                if (backBtn) backBtn.classList.add('hidden');
                if (addTransactionSection) addTransactionSection.classList.add('hidden');
                if (addCustomerForm) addCustomerForm.classList.remove('hidden');
                if (ledgerHeader) ledgerHeader.classList.remove('hidden');
                if (historyHeader) historyHeader.classList.add('hidden');
                if (useTotalBtn) useTotalBtn.classList.remove('hidden');

                const queryStr = searchInput ? searchInput.value.toLowerCase() : '';
                const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(queryStr));

                if (filteredCustomers.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">No customers found. Add one above!</td></tr>`;
                } else {
                    filteredCustomers.forEach(cust => {
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

                        const initial = cust.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 transition-colors cursor-pointer group";
                        tr.onclick = (e) => {
                            if (e.target.closest('button')) return;
                            showCustomerDetails(cust.id);
                        };

                        const urlParamsObj = new URLSearchParams(window.location.search);
                        const isSelectModeFlag = urlParamsObj.get('mode') === 'select';

                        tr.innerHTML = `
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-3">
                                    <div class="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">${initial}</div>
                                    <span class="text-sm font-bold group-hover:text-primary transition-colors">${cust.name}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-sm font-bold text-right">${formatCurrency(custTotal)}</td>
                            <td class="px-6 py-4 text-sm text-right">${formatCurrency(custPaid)}</td>
                            <td class="px-6 py-4 text-sm ${custBal > 0 ? 'text-orange-600' : 'text-green-600'} font-bold text-right">${formatCurrency(custBal)}</td>
                            <td class="px-6 py-4 text-center">
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${statusClass}">${status}</span>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <div class="flex gap-2 justify-end">
                                    ${isSelectModeFlag ? `
                                        <button onclick="useCustomerBalance(${custBal})" class="bg-primary text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm hover:bg-primary/90">
                                            Use Balance
                                        </button>
                                    ` : `
                                        <button onclick="event.stopPropagation(); showCustomerDetails('${cust.id}')" class="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="View Details">
                                            <span class="material-symbols-outlined text-lg">visibility</span>
                                        </button>
                                        <button onclick="event.stopPropagation(); deleteLedgerCustomer('${cust.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg" title="Delete Customer">
                                            <span class="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    `}
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

                customerViewHeader.querySelector('h3').innerText = "Customer: " + cust.name;
                if (backBtn) backBtn.classList.remove('hidden');
                if (addTransactionSection) addTransactionSection.classList.remove('hidden');
                if (addCustomerForm) addCustomerForm.classList.add('hidden');
                if (ledgerHeader) ledgerHeader.classList.add('hidden');
                if (historyHeader) historyHeader.classList.remove('hidden');
                if (useTotalBtn) useTotalBtn.classList.add('hidden');

                const titleEl = document.getElementById('transaction-form-title');
                if (titleEl) titleEl.innerText = `Add Transaction for ${cust.name}`;

                const custCredits = credits.filter(cr => String(cr.customerId) === String(activeCustomerId));
                custCredits.sort((a, b) => new Date(b.date) - new Date(a.date));

                if (custCredits.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No transactions yet for this customer.</td></tr>`;
                } else {
                    custCredits.forEach(cr => {
                        const creditAmt = cr.amount || 0;
                        const paidAmt = cr.paid || 0;

                        displayTotal += creditAmt;
                        displayReceived += paidAmt;

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 transition-colors";
                        tr.innerHTML = `
                            <td class="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">${cr.date}</td>
                            <td class="px-6 py-4 text-sm font-bold text-right text-orange-600">${creditAmt > 0 ? formatCurrency(creditAmt) : '-'}</td>
                            <td class="px-6 py-4 text-sm font-bold text-right text-green-600">${paidAmt > 0 ? formatCurrency(paidAmt) : '-'}</td>
                            <td class="px-6 py-4 text-xs text-slate-500 italic">${cr.note || ''}</td>
                            <td class="px-6 py-4 text-right">
                                <button onclick="deleteLedgerCredit('${cr.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg" title="Delete Transaction">
                                    <span class="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });
                    displayPending = displayTotal - displayReceived;
                }
            }

            if (summaryTotal) summaryTotal.innerText = formatCurrency(displayTotal);
            if (summaryReceived) summaryReceived.innerText = formatCurrency(displayReceived);
            if (summaryPending) summaryPending.innerText = formatCurrency(displayPending);

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

    // Handlers
    addCustomerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-customer-name');
        const name = input?.value.trim();
        if (name) {
            try {
                const existingCustomers = await loadCustomers();
                const isDuplicate = existingCustomers.some(c => c.name.toLowerCase() === name.toLowerCase());
                if (isDuplicate) {
                    showErrorToast(`"${name}" already exists!`);
                    return;
                }
                const res = await saveCustomer({ id: Date.now(), name });
                if (res) {
                    addCustomerForm.reset();
                    showSuccessToast('Customer added successfully! 🎉');
                    await renderView();
                }
            } catch (err) {
                console.error("Add customer error:", err);
                alert("Error: " + err.message);
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

// Inter-page logic for selecting credit
window.goToLedgerToSelect = () => {
    const form = document.querySelector('form');
    const datePicker = document.getElementById('entry-date-picker');
    if (form) {
        const formData = {};
        new FormData(form).forEach((value, key) => formData[key] = value);
        // Also save the date since date picker is outside the <form> tag
        if (datePicker) formData['__entry_date__'] = datePicker.value;
        sessionStorage.setItem('add_entry_form_data', JSON.stringify(formData));
    }
    window.location.href = 'credit-ledger-code.html?mode=select';
};

window.useCustomerBalance = (amount) => {
    localStorage.setItem('selected_credit_transfer', amount);
    window.location.href = 'add-entry-code.html';
};

window.useTotalPendingBalance = () => {
    const pendingEl = document.getElementById('summary-pending');
    if (pendingEl) {
        // Extract only numbers from the currency string (e.g. ₹7,500 -> 7500)
        const amount = parseFloat(pendingEl.innerText.replace(/[^0-9.-]/g, '')) || 0;
        window.useCustomerBalance(amount);
    }
};

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
            if (!isActive) tab.classList.add('text-slate-500');
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

        console.log(`[Reports Debug] Filtered Count: ${filtered.length}`);

        // Sort by date ASC for running balance (same as Dashboard)
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

        // --- Use same running-balance formula as Dashboard ---
        // We need ALL entries sorted ASC to compute the running balance correctly,
        // then we pick only the filtered ones for aggregation.
        const allEntries = await loadEntries();
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

            const tcf = cash + online + roinet + jio + (crgbBc || go2sms) + credit + pending + damages;
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

        // Now aggregate metrics only for filtered entries
        let totalCapitalAdd = 0;
        let peakDayIncome = -Infinity;
        let peakDayDate = "N/A";
        const monthTotals = {};

        const totals = filtered.reduce((acc, e) => {
            const mapped = dailyIncomeMap[e.date] || {};
            const inc = mapped.inc || 0;
            const exp = mapped.exp || parseFloat(e.expense) || 0;
            acc.income += inc;
            acc.expense += exp;
            acc.profit += (inc - exp);
            totalCapitalAdd += (mapped.cap || parseFloat(e.capitalAdd) || 0);

            if (inc > peakDayIncome) {
                peakDayIncome = inc;
                peakDayDate = new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            }

            const mKey = new Date(e.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            monthTotals[mKey] = (monthTotals[mKey] || 0) + inc;

            return acc;
        }, { income: 0, expense: 0, profit: 0 });

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
                            <td class="px-6 py-4 font-bold group-hover:text-primary transition-colors">${acc.name}</td>
                            <td class="px-6 py-4 font-bold text-slate-700 text-right">${formatCurrency(fyTotal)}</td>
                            <td class="px-6 py-4 text-center">
                                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${statusClass}">${statusText} (${pecent.toFixed(1)}%)</span>
                            </td>
                            <td class="px-6 py-4 text-right flex justify-end gap-1">
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
                accWithdrawals.sort((a,b) => new Date(b.date) - new Date(a.date));

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
                        if(w.method.includes('Cheque')) methodHtml = `<span class="bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-xs font-bold">Cheque</span>`;
                        if(w.method.includes('Yono')) methodHtml = `<span class="bg-pink-100 text-pink-600 px-2 py-0.5 rounded text-xs font-bold">Yono Cash</span>`;

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-primary/5 transition-colors";
                        tr.innerHTML = `
                            <td class="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">${wDate.toLocaleDateString('en-GB')}</td>
                            <td class="px-6 py-4 text-sm font-bold text-right text-rose-600">${formatCurrency(amount)}</td>
                            <td class="px-6 py-4">${methodHtml}</td>
                            <td class="px-6 py-4 text-xs text-slate-500 italic">${w.note || ""}</td>
                            <td class="px-6 py-4 text-right flex justify-end gap-1">
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

    window.deleteBankAccountRecord = async (id) => {
        if(confirm("Are you sure you want to delete this Bank Account?")) {
            await deleteDoc(doc(db, "bank_accounts", id.toString()));
            await renderView();
        }
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

    window.deleteBankWithdrawalRecord = async (id) => {
        if(confirm("Are you sure you want to delete this withdrawal record?")) {
            await deleteBankWithdrawal(id);
            await renderView();
        }
    };

    await renderView();
}

document.addEventListener('DOMContentLoaded', async () => {
    // Migration first
    await migrateToDatabase();
    // Auto-clean duplicate entries for same date
    await deduplicateEntries();

    const modules = [
        { name: 'Settings', fn: initSettings }, // Prioritize Settings
        { name: 'AddEntry', fn: initAddEntry },
        { name: 'Dashboard', fn: initDashboard },
        { name: 'Calculator', fn: initCalculator },
        { name: 'Transactions', fn: initTransactions },
        { name: 'Reports', fn: initReports }, // New module
        { name: 'CreditLedger', fn: initCreditLedger },
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
});

