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

async function loadCashCalculator() {
    if (!db) return {};
    try {
        const docSnap = await getDoc(doc(db, "cash_calculator", "latest"));
        return docSnap.exists() ? docSnap.data() : {};
    } catch (e) {
        console.error("Error loading cash calculator: ", e);
        return {};
    }
}

async function saveCashCalculator(counts) {
    if (!db) return null;
    try {
        await setDoc(doc(db, "cash_calculator", "latest"), counts);
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

        const existing = entries.find(e => e.date === selectedFormatted);

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
                } else {
                    // Draft is for a different date, clear it
                    localStorage.removeItem('add_entry_draft');
                    Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                        input.value = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    });
                }
            } else {
                // No data and no draft — clear all fields
                Array.from(form.querySelectorAll('input[type="number"]')).forEach(input => {
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
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
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        datePicker.value = `${yyyy}-${mm}-${dd}`;

        datePicker.addEventListener('change', checkExisting);
        
        // Auto-save draft on input
        form.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
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
                localStorage.setItem('add_entry_draft', JSON.stringify(draft));
            }
        });

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
                date: formattedDate,
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

            if (datePicker) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                datePicker.value = `${yyyy}-${mm}-${dd}`;
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
        const todayStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // --- 2. Consolidated Aggregation Loop ---
        // Basic Dates for Filtering
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentDay = now.getDate();
        const lastMonthDate = new Date(currentYear, currentMonth - 1, currentDay);
        const lastMonthStr = lastMonthDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const lastMonthVal = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        let allTimeIncome = 0, allTimeExpense = 0, allTimeProfit = 0;
        let totalCapital = 0, totalWithdrawal = 0;
        let todayIncome = 0, todayExpense = 0, todayProfit = 0;
        let yesterdayIncome = 0, yesterdayExpense = 0, yesterdayProfit = 0;
        let lastMonthTodayIncome = 0, lastMonthTodayExpense = 0;
        let currentMTDIncome = 0, currentMTDExpense = 0;
        let lastMTDIncome = 0, lastMTDExpense = 0;
        let finalRunningBalance = 0;

        // Cumulative Data for Charts
        const dailyData = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const s = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            dailyData[s] = { income: 0, expense: 0, profit: 0, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
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
            const go2sms = parseFloat(details.go2sms) || 0;
            const credit = parseFloat(details.credit) || 0;
            const pending = parseFloat(details.pending) || 0;
            const damages = parseFloat(details.damages) || 0;

            const tcf = cash + online + roinet + jio + go2sms + credit + pending + damages;
            const exp = parseFloat(e.expense) || 0;
            const cap = parseFloat(e.capital) || 0;
            const wit = parseFloat(details.withdrawal) || 0;

            
            // Formula Logic (Consistent with CSP Ledger):
            const opn = finalRunningBalance + cap;
            const dailyInc = tcf - opn;
            const dailyProf = dailyInc - exp;
            const cls = tcf - exp - wit;
            finalRunningBalance = cls;

            // 1. All-Time Aggregation
            allTimeIncome += dailyInc;
            allTimeExpense += exp;
            allTimeProfit += dailyProf;
            totalCapital += cap;
            totalWithdrawal += wit;

            // 2. Today & Yesterday Comparisons
            if (e.date === todayStr) {
                todayIncome = dailyInc; todayExpense = exp; todayProfit = dailyProf;
            } else if (e.date === yesterdayStr) {
                yesterdayIncome = dailyInc; yesterdayExpense = exp; yesterdayProfit = dailyProf;
            }

            // 3. MoM & MTD Analytics
            if (e.date === lastMonthStr) {
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

        // 5. Projections
        const daysPassed = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const avgDaily = currentMTDIncome / (daysPassed || 1);
        const daysInYear = (now.getFullYear() % 4 === 0) ? 366 : 365;
        setVal('proj-monthly', avgDaily * daysInMonth);
        setVal('proj-quarterly', avgDaily * (daysInYear / 4));
        setVal('proj-yearly', avgDaily * daysInYear);

        const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
        const yStart = new Date(now.getFullYear(), 0, 1);
        const yEnd = new Date(now.getFullYear(), 11, 31);
        
        const setRange = (id, s, e) => {
            const el = document.getElementById(id);
            if (el) el.innerText = `${fmtDate(s)} - ${fmtDate(e)}`;
        };
        setRange('proj-month-range', mStart, mEnd);
        setRange('proj-quart-range', qStart, qEnd);
        setRange('proj-year-range', yStart, yEnd);

        // --- 6. Charts ---
        const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const chartColor = '#7f13ec';
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
                        { label: 'Income', data: incomeData, backgroundColor: chartColor, borderRadius: 4 },
                        { label: 'Expense', data: expenseData, backgroundColor: 'rgba(127, 19, 236, 0.2)', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
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
                        borderColor: chartColor,
                        backgroundColor: 'rgba(127, 19, 236, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } }
                    }
                }
            });
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

    const updateTotals = () => {
        let grandTotal = 0;
        let totalNotes = 0;
        const counts = {};

        const inputs = tableBody.querySelectorAll('input');
        inputs.forEach(input => {
            const denom = parseInt(input.dataset.denom);
            const count = parseInt(input.value) || 0;
            const subtotal = denom * count;

            const subtotalEl = input.closest('tr').querySelector('.subtotal');
            subtotalEl.innerText = formatCurrency(subtotal);
            subtotalEl.classList.toggle('text-slate-400', subtotal === 0);
            subtotalEl.classList.toggle('text-primary', subtotal > 0);

            grandTotal += subtotal;
            totalNotes += count;
            counts[denom] = input.value;
        });

        if (totalValDisplay) totalValDisplay.innerText = formatCurrency(grandTotal);
        if (totalNotesDisplay) totalNotesDisplay.innerText = `${totalNotes} notes total`;

        // Persistence
        saveCashCalculator(counts);
        localStorage.setItem('cash_calculator_counts', JSON.stringify(counts));
    };

    // Restore state
    let savedCounts = await loadCashCalculator();
    if (Object.keys(savedCounts).length === 0) {
        savedCounts = JSON.parse(localStorage.getItem('cash_calculator_counts') || '{}');
    }

    // Generate Rows
    tableBody.innerHTML = denominations.map(denom => `
        <tr class="hover:bg-primary/5 transition-colors group">
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
        </tr>
    `).join('');

    // Events
    tableBody.addEventListener('input', updateTotals);

    if (btnReset) {
        btnReset.onclick = () => {
            tableBody.querySelectorAll('input').forEach(i => i.value = '');
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

    updateTotals();
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
            const headers = ['Date', 'Capital_Add', 'Cash', 'Online', 'Roinet', 'Jio', 'CRGB_BC', 'Credit', 'Pending', 'Damages', 'Expense', 'Withdrawal', 'Description', 'Category'];
            const example = ['2024-01-01', '0', '5000', '2000', '0', '0', '0', '500', '0', '0', '200', '1000', 'Opening Balance 2024', 'General'];
            // Add UTF-8 BOM for better Excel compatibility
            const csvContent = "\ufeff" + [headers.join(','), example.join(',')].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bizperform_import_template.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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
                    if (finalDate.includes('/')) {
                        const parts = finalDate.split('/');
                        if (parts[0].length === 4) finalDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        else finalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    }

                    const details = {
                        cash: parseFloat(row.cash) || 0,
                        online: parseFloat(row.online) || 0,
                        roinet: parseFloat(row.roinet) || 0,
                        jio: parseFloat(row.jio) || 0,
                        go2sms: parseFloat(row.go2sms) || 0,
                        credit: parseFloat(row.credit) || 0,
                        pending: parseFloat(row.pending) || 0,
                        damages: parseFloat(row.damages) || 0
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
                        timestamp: serverTimestamp()
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

        const capitalAdd = e.capital || 0;
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
        const withdrawal = getVal('withdrawal');

        // CSP Ledger Logic:
        // 1. Prev Closing Balance (Carryforward from yesterday)
        const prevCls = runningBalance;
        
        // 2. Capital Add
        const capital = capitalAdd || 0;
        
        // 3. Opening Balance (Display Only) = Prev Closing + Capital Add
        const opnBalance = calculateOpeningBalance(prevCls, capital);
        
        // 4. Total (Cash Flow) = Cash + Online + Roinet + Jio + Go2Sms + Credit + Pending + Damages
        const totalCashFlow = cash + online + roinet + jio + go2sms + credit + pending + damages;
        
        // 5. Income = Total - Opening
        const dailyIncome = totalCashFlow - opnBalance;
        
        // 6. Profit = Income - Expense
        const dailyProfit = dailyIncome - expense;
        
        // 7. Net = Total - Expense
        const netFlow = totalCashFlow - expense;
        
        // 8. Closing Balance = Net - Withdraw
        const finalCls = netFlow - withdrawal;

        // Carryforward for NEXT day
        runningBalance = finalCls;

        // Display values
        const displayPrevCls = prevCls;
        const displayCap = capital;
        const displayOpn = opnBalance;
        const displayTotal = totalCashFlow;
        const displayIncome = dailyIncome;
        const displayProfit = dailyProfit;
        const displayNet = netFlow;
        const displayCls = finalCls;

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
    if (form) {
        const formData = {};
        new FormData(form).forEach((value, key) => formData[key] = value);
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

window.goToDamagesToSelect = () => {
    const form = document.getElementById('add-entry-form');
    if (form) {
        const formData = {};
        new FormData(form).forEach((value, key) => formData[key] = value);
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

        // Year options
        const years = [...new Set(entries.map(e => {
            const d = new Date(e.date);
            return isNaN(d) ? null : d.getFullYear();
        }))].filter(Boolean).sort((a, b) => b - a);

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
                return y.toString() === yearSelect.value;
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
            const wit = parseFloat(details.withdrawal) || 0;
            const exp = parseFloat(e.expense) || 0;

            const opn = runningBalance + cap;
            const dailyInc = tcf - opn;
            const cls = tcf - exp - wit;
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
        { name: 'DamagedCurrency', fn: initDamagedCurrency }
    ];

    for (const m of modules) {
        try {
            await m.fn();
        } catch (err) {
            console.error(`Module ${m.name} failed to init:`, err);
        }
    }
});

