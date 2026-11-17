const fs = require('fs');

let raw = fs.readFileSync('app-v2.js', 'utf8');
const isCrlf = raw.includes('\r\n');
let code = raw.replace(/\r\n/g, '\n');

// 1. In fetchSystemOnline: opening values
const oldOpBlock = `            const opRoinet1 = Number(details.roinet_1 || 0);
            const opRoinet2 = Number(details.roinet_2 || 0);
            const opAirtel1 = Number(details.airtel_1 || 0);
            const opAirtel2 = Number(details.airtel_2 || 0);
            const opSpice = Number(details.spicemoney || 0);
            const roinetFallback = (opRoinet1 || opRoinet2 || opAirtel1 || opAirtel2 || opSpice) ? 0 : Number(details.roinet || 0);

            const opValues = {
                online: Number(details.online || 0) - yesterdayWithdrawalsOnline,
                online_p1: Number(details.online_p1 || 0) - (yesterdaySubWithdrawals['online_p1'] || 0),
                online_p2: Number(details.online_p2 || 0) - (yesterdaySubWithdrawals['online_p2'] || 0),
                online_p3: Number(details.online_p3 || 0) - (yesterdaySubWithdrawals['online_p3'] || 0),
                other: Number(details.other || 0) - (yesterdaySubWithdrawals['other'] || 0),
                roinet_1: opRoinet1,
                roinet_2: opRoinet2,
                airtel_1: opAirtel1,
                airtel_2: opAirtel2,
                spicemoney: opSpice,
                roinet_fallback: roinetFallback,
                jio: Number(details.jio || 0),
                crgb_bc: Number(details.crgb_bc || details.go2sms || 0),
                pending: Number(details.pending || 0),
                deposit: Number(details.deposit || 0),
                capital: Number(details.capital || 0),
                damaged: Number(details.damages || 0)
            };`;

const newOpBlock = `            const opRoinet1 = Number(details.roinet_1 || 0);
            const opRoinet2 = Number(details.roinet_2 || 0);
            const opAirtel1 = Number(details.airtel_1 || 0);
            const opAirtel2 = Number(details.airtel_2 || 0);
            const opSpice = Number(details.spicemoney || 0);
            const roinetFallback = (opRoinet1 || opRoinet2 || opAirtel1 || opAirtel2 || opSpice) ? 0 : Number(details.roinet || 0);

            const opCgb1 = Number(details.cgb_1 || details.crgb_1 || 0);
            const opCgb2 = Number(details.cgb_2 || details.crgb_2 || 0);
            const opCgbTotal = (opCgb1 || opCgb2) ? (opCgb1 + opCgb2) : Number(details.crgb_bc || details.go2sms || 0);
            const opCgb1Final = (opCgb1 || opCgb2) ? opCgb1 : opCgbTotal;
            const opCgb2Final = opCgb2;

            const opValues = {
                online: Number(details.online || 0) - yesterdayWithdrawalsOnline,
                online_p1: Number(details.online_p1 || 0) - (yesterdaySubWithdrawals['online_p1'] || 0),
                online_p2: Number(details.online_p2 || 0) - (yesterdaySubWithdrawals['online_p2'] || 0),
                online_p3: Number(details.online_p3 || 0) - (yesterdaySubWithdrawals['online_p3'] || 0),
                other: Number(details.other || 0) - (yesterdaySubWithdrawals['other'] || 0),
                roinet_1: opRoinet1,
                roinet_2: opRoinet2,
                airtel_1: opAirtel1,
                airtel_2: opAirtel2,
                spicemoney: opSpice,
                roinet_fallback: roinetFallback,
                jio: Number(details.jio || 0),
                crgb_bc: opCgbTotal,
                cgb_1: opCgb1Final,
                cgb_2: opCgb2Final,
                pending: Number(details.pending || 0),
                deposit: Number(details.deposit || 0),
                capital: Number(details.capital || 0),
                damaged: Number(details.damages || 0)
            };`;

if (!code.includes(oldOpBlock)) {
    console.error('Could not find oldOpBlock in app-v2.js!');
    process.exit(1);
}
code = code.replace(oldOpBlock, newOpBlock);

// 2. In fetchSystemOnline: deltas definition and updateCgbSubDelta
const oldDeltaBlock = `            // 3. Calculate Deltas for each online module
            const deltas = { online: 0, online_p1: 0, online_p2: 0, online_p3: 0, other: 0, roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0, roinet_fallback: 0, jio: 0, crgb_bc: 0, pending: 0, deposit: 0, capital: 0, withdrawal: 0, expense: 0, damaged: 0, expenseDetails: {} };`;

const newDeltaBlock = `            // 3. Calculate Deltas for each online module
            const deltas = { online: 0, online_p1: 0, online_p2: 0, online_p3: 0, other: 0, roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0, roinet_fallback: 0, jio: 0, crgb_bc: 0, cgb_1: 0, cgb_2: 0, pending: 0, deposit: 0, capital: 0, withdrawal: 0, expense: 0, damaged: 0, expenseDetails: {} };

            const updateCgbSubDelta = (providerStr, amount, isAdd) => {
                if (!providerStr) return;
                const p = String(providerStr).trim().toLowerCase().replace(/[\\s\\-_]+/g, '');
                const diff = isAdd ? amount : -amount;
                if (p.includes('dalai') || p.includes('cgb2') || p.includes('crgb2')) {
                    deltas.cgb_2 += diff;
                } else {
                    deltas.cgb_1 += diff;
                }
            };`;

if (!code.includes(oldDeltaBlock)) {
    console.error('Could not find oldDeltaBlock in app-v2.js!');
    process.exit(1);
}
code = code.replace(oldDeltaBlock, newDeltaBlock);

// 3. In fetchSystemOnline: txns processing
// AEPS / MATM
const oldAeps = `                    } else if (provider.includes('crgb')) {
                        deltas.crgb_bc += amt;
                    }`;
const newAeps = `                    } else if (provider.includes('crgb') || provider.includes('cgb')) {
                        deltas.crgb_bc += amt;
                        updateCgbSubDelta(t.provider, amt, true);
                    }`;
code = code.replace(oldAeps, newAeps);

// AADHAAR_PAY
const oldAadhaar = `                    } else if (provider.includes('crgb')) {
                        deltas.crgb_bc += walletCredit;
                    }`;
const newAadhaar = `                    } else if (provider.includes('crgb') || provider.includes('cgb')) {
                        deltas.crgb_bc += walletCredit;
                        updateCgbSubDelta(t.provider, walletCredit, true);
                    }`;
code = code.replace(oldAadhaar, newAadhaar);

// DEPOSIT / AADHAAR_DEPOSIT
const oldDep = `                    } else if (provider.includes('crgb')) {
                        deltas.crgb_bc -= amt;
                    }`;
const newDep = `                    } else if (provider.includes('crgb') || provider.includes('cgb')) {
                        deltas.crgb_bc -= amt;
                        updateCgbSubDelta(t.provider, amt, false);
                    }`;
code = code.replace(oldDep, newDep);

// CSP_COMMISSION
const oldComm = `                } else if (['CSP_COMMISSION'].includes(t.type)) {
                    if (provider.includes('crgb')) deltas.crgb_bc += chg;`;
const newComm = `                } else if (['CSP_COMMISSION'].includes(t.type)) {
                    if (provider.includes('crgb') || provider.includes('cgb')) {
                        deltas.crgb_bc += chg;
                        updateCgbSubDelta(t.provider, chg, true);
                    }`;
code = code.replace(oldComm, newComm);

// CSP_SUBSCRIPTION
const oldSub = `                    } else if (cspProv.includes('crgb')) {
                        deltas.crgb_bc -= amt;
                    }`;
const newSub = `                    } else if (cspProv.includes('crgb') || cspProv.includes('cgb')) {
                        deltas.crgb_bc -= amt;
                        updateCgbSubDelta(t.provider, amt, false);
                    }`;
code = code.replace(oldSub, newSub);

// DAMAGED_RECOVERY
const oldDmgRec = `                        else if (provider.includes('crgb')) deltas.crgb_bc += amt;`;
const newDmgRec = `                        else if (provider.includes('crgb') || provider.includes('cgb')) {
                            deltas.crgb_bc += amt;
                            updateCgbSubDelta(t.provider, amt, true);
                        }`;
code = code.replace(oldDmgRec, newDmgRec);

// SETTLEMENT
const oldSet = `                    else if (provider.includes('crgb')) deltas.crgb_bc -= totalDeduction;`;
const newSet = `                    else if (provider.includes('crgb') || provider.includes('cgb')) {
                        deltas.crgb_bc -= totalDeduction;
                        updateCgbSubDelta(t.provider, totalDeduction, false);
                    }`;
code = code.replace(oldSet, newSet);

// CSP_WALLET_LOAD
const oldLoad = `                    if (destWallet.includes('crgb')) {
                        deltas.crgb_bc += amt;
                    }`;
const newLoad = `                    if (destWallet.includes('crgb') || destWallet.includes('cgb')) {
                        deltas.crgb_bc += amt;
                        updateCgbSubDelta(t.provider, amt, true);
                    }`;
code = code.replace(oldLoad, newLoad);

// ALL_SYNC_FIELDS in fetchSystemOnline
const oldSyncFields = `            const ALL_SYNC_FIELDS = ["online", "online_p1", "online_p2", "online_p3", "other", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "roinet_fallback", "jio", "crgb_bc", "pending", "deposit", "capital", "withdrawal", "expense", "damaged"];`;
const newSyncFields = `            const ALL_SYNC_FIELDS = ["online", "online_p1", "online_p2", "online_p3", "other", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "roinet_fallback", "jio", "crgb_bc", "cgb_1", "cgb_2", "pending", "deposit", "capital", "withdrawal", "expense", "damaged"];`;
code = code.replace(oldSyncFields, newSyncFields);

// 4. lockAutoSyncedFields button handling
const oldLockBtn = `                const button = input.parentElement.querySelector('button');
                if (button && id !== 'expense') button.style.display = 'none'; // Keep expense split button visible for viewing
                let rightPos = (button && id === 'expense') ? 'right-9' : 'right-3';
                input.style.paddingRight = (button && id === 'expense') ? '64px' : '40px';`;

const newLockBtn = `                const button = input.parentElement.querySelector('button');
                if (button && id !== 'expense' && id !== 'go2sms') button.style.display = 'none'; // Keep expense & CGB split buttons visible
                let hasButton = button && (id === 'expense' || id === 'go2sms');
                let rightPos = hasButton ? 'right-9' : 'right-3';
                input.style.paddingRight = hasButton ? '64px' : '40px';`;
code = code.replace(oldLockBtn, newLockBtn);

// 5. setupRealTimeSync expected totals
const oldRoinetExp = `            // Expected Roinet Split Total
            const expectedRoinetTotal = (breakdown.roinet_1?.closing || 0) +
                (breakdown.roinet_2?.closing || 0) +
                (breakdown.airtel_1?.closing || 0) +
                (breakdown.airtel_2?.closing || 0) +
                (breakdown.spicemoney?.closing || 0) +
                (breakdown.roinet_fallback?.closing || 0);

            const expRoinetDisp = document.getElementById('expected-split-total-display');
            if (expRoinetDisp) {
                expRoinetDisp.dataset.val = expectedRoinetTotal;
                expRoinetDisp.innerText = formatCurrency(expectedRoinetTotal);
                if (typeof updateRoinetSplitTotal === 'function') updateRoinetSplitTotal();
            }`;

const newRoinetExp = `            // Expected Roinet Split Total
            const expectedRoinetTotal = (breakdown.roinet_1?.closing || 0) +
                (breakdown.roinet_2?.closing || 0) +
                (breakdown.airtel_1?.closing || 0) +
                (breakdown.airtel_2?.closing || 0) +
                (breakdown.spicemoney?.closing || 0) +
                (breakdown.roinet_fallback?.closing || 0);

            const expRoinetDisp = document.getElementById('expected-split-total-display');
            if (expRoinetDisp) {
                expRoinetDisp.dataset.val = expectedRoinetTotal;
                expRoinetDisp.innerText = formatCurrency(expectedRoinetTotal);
                if (typeof updateRoinetSplitTotal === 'function') updateRoinetSplitTotal();
            }

            // Expected CGB BC Split Total
            const expectedCgbTotal = (breakdown.cgb_1?.closing || 0) + (breakdown.cgb_2?.closing || 0);
            const expCgbDisp = document.getElementById('expected-cgb-split-total-display');
            if (expCgbDisp) {
                expCgbDisp.dataset.val = expectedCgbTotal;
                expCgbDisp.innerText = formatCurrency(expectedCgbTotal);
                if (typeof updateCgbSplitTotal === 'function') updateCgbSplitTotal();
            }`;
code = code.replace(oldRoinetExp, newRoinetExp);

// setupRealTimeSync individual expected labels
code = code.replace(
    `['roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'online_p1', 'online_p2', 'online_p3'].forEach(k => {`,
    `['roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'online_p1', 'online_p2', 'online_p3', 'cgb_1', 'cgb_2'].forEach(k => {`
);

// 6. Replace sub-account input arrays to include cgb_1 and cgb_2
const targetArray = `['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip']`;
const replacementArray = `['online_p1', 'online_p2', 'online_p3', 'roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'cgb_1', 'cgb_2', 'personal_expense', 'salary_expense', 'electricity_expense', 'shop_rent_expense', 'business_development', 'internet_expense', 'settlement_charges', 'gold_sip']`;

while (code.includes(targetArray)) {
    code = code.replace(targetArray, replacementArray);
}

// 7. Add CGB BC Modal Logic right after roinetSplitModal in app-v2.js
const cgbModalLogic = `
    // --- CGB BC Accounts Split Modal Logic ---
    const cgbSplitModal = document.getElementById('cgb-split-modal');
    const cgbSplitPanel = document.getElementById('cgb-split-panel');
    const openCgbBtn = document.getElementById('open-cgb-split-btn');
    const closeCgbBtn = document.getElementById('close-cgb-split-btn');
    const cgbBackdrop = document.getElementById('cgb-split-backdrop');
    const useCgbBtn = document.getElementById('use-cgb-amount-btn');
    const cgbSplitTotalDisplay = document.getElementById('cgb-split-total-display');
    const cgbInput = document.getElementById('go2sms');

    const c1Input = document.getElementById('cgb_1');
    const c2Input = document.getElementById('cgb_2');

    const updateCgbSplitTotal = () => {
        if (!c1Input) return 0;
        ['cgb_1', 'cgb_2'].forEach(updateIndividualDiff);
        const total = (parseFloat(c1Input.value) || 0) + (parseFloat(c2Input.value) || 0);
        if (cgbSplitTotalDisplay) cgbSplitTotalDisplay.textContent = formatCurrency(total);
        
        const cgbSplitDiffDisplay = document.getElementById('cgb-split-diff-display');
        const expectedCgbDisp = document.getElementById('expected-cgb-split-total-display');
        if (cgbSplitDiffDisplay && expectedCgbDisp && expectedCgbDisp.dataset.val) {
            const expected = parseFloat(expectedCgbDisp.dataset.val) || 0;
            const diff = total - expected;
            const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
            cgbSplitDiffDisplay.textContent = sign + formatCurrency(Math.abs(diff));
            cgbSplitDiffDisplay.className = diff > 0 ? 'text-sm font-black text-emerald-500 font-mono' : (diff < 0 ? 'text-sm font-black text-rose-500 font-mono' : 'text-sm font-black text-slate-400 font-mono');
        }
        return total;
    };

    if (openCgbBtn && cgbSplitModal) {
        openCgbBtn.addEventListener('click', () => {
            // Pre-fill from expected if both empty
            if ((!c1Input.value || parseFloat(c1Input.value) === 0) && (!c2Input.value || parseFloat(c2Input.value) === 0)) {
                const exp1 = parseFloat(document.getElementById('expected-cgb_1')?.dataset?.val) || 0;
                const exp2 = parseFloat(document.getElementById('expected-cgb_2')?.dataset?.val) || 0;
                if (exp1 > 0 || exp2 > 0) {
                    c1Input.value = exp1 || '';
                    c2Input.value = exp2 || '';
                }
            }
            cgbSplitModal.classList.remove('hidden');
            cgbSplitModal.classList.add('flex');
            void cgbSplitModal.offsetWidth;
            cgbSplitPanel.classList.remove('scale-95', 'opacity-0');
            cgbSplitPanel.classList.add('scale-100', 'opacity-100');
            updateCgbSplitTotal();
        });

        const closeCgbModal = () => {
            cgbSplitPanel.classList.remove('scale-100', 'opacity-100');
            cgbSplitPanel.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                cgbSplitModal.classList.add('hidden');
                cgbSplitModal.classList.remove('flex');
            }, 300);
        };

        if (closeCgbBtn) closeCgbBtn.addEventListener('click', closeCgbModal);
        if (cgbBackdrop) cgbBackdrop.addEventListener('click', closeCgbModal);

        [c1Input, c2Input].forEach(inp => {
            if (inp) inp.addEventListener('input', updateCgbSplitTotal);
        });

        if (useCgbBtn) {
            useCgbBtn.addEventListener('click', () => {
                const total = updateCgbSplitTotal();
                
                // Add Validation
                const isValidate = localStorage.getItem('validate_csp_diff') !== 'false';
                if (isValidate) {
                    const inputs = ['cgb_1', 'cgb_2'];
                    let hasExceeded = false;
                    for (const inputId of inputs) {
                        const input = document.getElementById(inputId);
                        const expectedEl = document.getElementById(\`expected-\${inputId}\`);
                        if (input && input.value !== '' && expectedEl && expectedEl.dataset.val !== undefined) {
                            const entered = parseFloat(input.value) || 0;
                            const expected = parseFloat(expectedEl.dataset.val) || 0;
                            if (Math.abs(entered - expected) > 2000) {
                                hasExceeded = true;
                                break;
                            }
                        }
                    }
                    if (hasExceeded) {
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                title: 'Validation Error',
                                text: 'The difference for one of the individual CGB BC accounts exceeds ₹2,000. Please verify and correct your transactions on the Daily Txn page.',
                                icon: 'error',
                                confirmButtonColor: '#e11d48'
                            });
                        } else {
                            alert('The difference for one of the individual CGB BC accounts exceeds ₹2,000.');
                        }
                        return;
                    }
                }

                if (cgbInput) {
                    cgbInput.value = total || '';
                    cgbInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                closeCgbModal();
            });
        }
    }
`;

const roinetModalLogicEnd = `                if(roinetInput) {
                    roinetInput.value = total || '';
                    roinetInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                closeRoinetModal();
            });
        }
    }`;

if (!code.includes(roinetModalLogicEnd)) {
    console.error('Could not find roinetModalLogicEnd in app-v2.js!');
    process.exit(1);
}
code = code.replace(roinetModalLogicEnd, roinetModalLogicEnd + '\n' + cgbModalLogic);

// 8. Form submit validation nameMap and checkDifferences
const oldCheckDiff = `            checkDifferences(['online_p1', 'online_p2', 'online_p3'], 'validate_online_diff');
            if (!hasValidationError) {
                checkDifferences(['roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney'], 'validate_csp_diff');
            }`;

const newCheckDiff = `            checkDifferences(['online_p1', 'online_p2', 'online_p3'], 'validate_online_diff');
            if (!hasValidationError) {
                checkDifferences(['roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney', 'cgb_1', 'cgb_2'], 'validate_csp_diff');
            }`;
code = code.replace(oldCheckDiff, newCheckDiff);

const oldNameMapApp = `'airtel_2': 'Airtel(Dalai)',
                    'spicemoney': 'SpiceMoney'`;
const newNameMapApp = `'airtel_2': 'Airtel(Dalai)',
                    'spicemoney': 'SpiceMoney',
                    'cgb_1': 'CGB BC (Parsu)',
                    'cgb_2': 'CGB BC (Dalai)'`;
code = code.replace(oldNameMapApp, newNameMapApp);

const oldMainDiff = `            if (!hasValidationError) checkMainDifference('online', 'expected-online-split-total-display', 'Online', 'validate_online_diff');
            if (!hasValidationError) checkMainDifference('roinet', 'expected-split-total-display', 'CSP Wallet', 'validate_csp_diff');`;

const newMainDiff = `            if (!hasValidationError) checkMainDifference('online', 'expected-online-split-total-display', 'Online', 'validate_online_diff');
            if (!hasValidationError) checkMainDifference('roinet', 'expected-split-total-display', 'CSP Wallet', 'validate_csp_diff');
            if (!hasValidationError) checkMainDifference('go2sms', 'expected-cgb-split-total-display', 'CGB BC', 'validate_csp_diff');`;
code = code.replace(oldMainDiff, newMainDiff);

if (isCrlf) {
    code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync('app-v2.js', code, 'utf8');
console.log('Successfully patched app-v2.js!');

