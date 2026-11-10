const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

// 1. Replace the inner mapping and setup
const searchMarkerStart = "                    if (['AEPS', 'MATM', 'WITHDRAWAL', 'QR_WITHDRAWAL', 'FREE_WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {";
const searchMarkerEnd = "                renderBadgesAndTable();\r\n            }, (error) => {";
const searchMarkerEndLF = "                renderBadgesAndTable();\n            }, (error) => {";

let endMarker = content.includes(searchMarkerEnd) ? searchMarkerEnd : searchMarkerEndLF;

const startIdx = content.indexOf(searchMarkerStart);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find markers!", { startIdx, endIdx });
  process.exit(1);
}

const replacement = `                    if (['AEPS', 'MATM', 'WITHDRAWAL', 'QR_WITHDRAWAL', 'FREE_WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
                        currentCash -= amt;
                        addAmt(provider, amt);
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                            const dest = getOnlineDest(t.depositBy || t.paymentApp || provider);
                            modifyOnlineSub(dest, amt);
                        }
                    } else if (t.type === 'AADHAAR_PAY') {
                        const provCharge = parseFloat(t.providerCharge || 0);
                        currentCash -= amt;
                        const walletCredit = amt - provCharge;
                        addAmt(provider, walletCredit);
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                            const dest = getOnlineDest(t.depositBy || t.paymentApp || provider);
                            modifyOnlineSub(dest, walletCredit);
                        }
                    } else if (['DEPOSIT', 'AADHAAR_DEPOSIT', 'FREE_DEPOSIT', 'ADMIN_DEPOSIT'].includes(t.type)) {
                        currentCash -= amt;
                        addAmt(provider, -amt);
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                            const dest = getOnlineDest(t.depositBy || provider);
                            modifyOnlineSub(dest, -amt);
                        }
                    } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL', 'PAN_CARD', 'LOAN_REPAYMENT'].includes(t.type)) {
                        if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
                            curRoinet -= amt;
                        } else {
                            curBank -= amt;
                            const dest = getOnlineDest(provider.includes('online') ? provider : t.depositBy);
                            modifyOnlineSub(dest, -amt);
                        }
                        if (t.chargesType === 'Online') {
                            curBank += amt;
                            const dest = getOnlineDest(t.chargesAccount || t.depositBy);
                            modifyOnlineSub(dest, amt);
                        } else {
                            currentCash += amt;
                        }
                    } else if (t.type === 'JIO_RECHARGE') {
                        curJio -= amt; // Jio wallet decreases
                        if (t.provider === 'Online' || provider !== 'cash') {
                            curBank += amt; // Paid via online bank, net zero
                            const dest = getOnlineDest(t.receivedIn || t.depositBy || provider);
                            modifyOnlineSub(dest, amt);
                        } else {
                            currentCash += amt;
                        }
                    } else if (t.type === 'JIO_TOPUP') {
                        curJio += (amt + chg);
                        curBank -= amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        if (t.chargesType === 'Online') {
                            curBank -= chg;
                            modifyOnlineSub(getOnlineDest(t.chargesAccount || t.depositBy), -chg);
                        } else {
                            currentCash -= chg;
                        }
                    } else if (['CSP_COMMISSION', 'OTHER_INCOME'].includes(t.type)) {
                        if (t.provider === 'Cash' || provider === 'cash') {
                            currentCash += (amt + chg);
                        } else {
                            if (t.type === 'OTHER_INCOME') {
                                addAmt(provider, amt + chg);
                                if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                                    modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt + chg);
                                }
                            } else {
                                addAmt(provider, chg);
                            }
                        }
                    } else if (t.type === 'CSP_SUBSCRIPTION') {
                        const cspProv = provider;
                        if (cspProv.includes('roinet') || cspProv.includes('airtel') || cspProv.includes('spicemoney')) {
                            curRoinet -= amt;
                        } else if (cspProv.includes('crgb')) {
                            curCrgb -= amt;
                        } else {
                            curBank -= amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        }
                    } else if (t.type === 'GOLD_SIP') {
                        if (t.depositBy) addAmt(t.depositBy, -amt);
                        else addAmt('shop', -amt);
                        modifyOnlineSub(getOnlineDest(t.depositBy || 'shop'), -amt);
                    } else if (t.type === 'CREDIT_GIVEN') {
                        if (provider === 'cash') currentCash -= amt;
                        else {
                            curBank -= amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        }
                    } else if (['CREDIT_RECEIVED', 'CUST_MONEY_IN'].includes(t.type)) {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            curBank -= amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                        }
                    } else if (['CUST_MONEY_OUT', 'DAILY_EXPENSE'].includes(t.type)) {
                        if (provider === 'cash') currentCash -= amt;
                        else {
                            curBank -= amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        }
                    } else if (t.type === 'DAMAGED_CURRENCY') {
                        currentCash -= amt;
                    } else if (t.type === 'DAMAGED_RECOVERY') {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            curBank += amt;
                            addAmt(provider, amt);
                            if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                                modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                            }
                        }
                    } else if (t.type === 'CASH_WITHDRAWAL') {
                        curBank -= amt;
                        currentCash += amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                    } else if (t.type === 'CASH_DEPOSIT') {
                        currentCash -= amt;
                        curBank += amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                    } else if (t.type === 'SETTLEMENT') {
                        curBank += amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                        if (t.chargesType === 'Online') {
                            curBank -= chg;
                            modifyOnlineSub(getOnlineDest(t.chargesAccount || t.depositBy || provider), -chg);
                        } else {
                            currentCash -= chg;
                        }
                        
                        const totalDeduction = amt + chg;
                        if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
                            curRoinet -= totalDeduction;
                        } else if (provider.includes('crgb')) {
                            curCrgb -= totalDeduction;
                        } else if (provider.includes('jio')) {
                            curJio -= totalDeduction;
                        } else {
                            curBank -= totalDeduction;
                            modifyOnlineSub(getOnlineDest(t.depositBy), -totalDeduction);
                        }
                    } else if (t.type === 'ONLINE_WORK') {
                        curBank -= amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy), -amt);
                        if (provider === 'cash') {
                            currentCash += amt;
                        } else {
                            curBank += amt;
                            modifyOnlineSub(getOnlineDest(t.receivedIn), amt);
                        }
                    } else if (t.type === 'ADD_CAPITAL') {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            curBank += amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                        }
                    } else if (t.type === 'SHARE_WITHDRAWN') {
                        if (provider === 'cash') currentCash -= amt;
                        else {
                            curBank += amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        }
                    } else if (t.type === 'PENDING_ADD') {
                        curPending += amt;
                        curBank -= amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                    } else if (t.type === 'PENDING_REMOVE') {
                        curPending -= amt;
                        curBank -= amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                    } else if (t.type === 'ONLINE_EXCHANGE') {
                        let sourceDest = getOnlineDest(t.paymentApp || t.depositBy);
                        let targetDest = getOnlineDest(t.provider || t.receivedIn);
                        modifyOnlineSub(sourceDest, -amt);
                        modifyOnlineSub(targetDest, amt);
                    }
                    
                    // Always perfectly sync currentOnline with its components
                    currentOnline = curBank + curRoinet + curCrgb + curJio + curPending;

                    return {
                        ...t,
                        runningCash: currentCash,
                        runningOnline: currentOnline,
                        cashDiff: currentCash - prevCash,
                        onlineDiff: currentOnline - prevOnline,
                        breakdown: {
                            bank: curBank, diffBank: curBank - prevBank,
                            roinet: curRoinet, diffRoinet: curRoinet - prevRoinet,
                            jio: curJio, diffJio: curJio - prevJio,
                            crgb: curCrgb, diffCrgb: curCrgb - prevCrgb,
                            pending: curPending, diffPending: curPending - prevPending
                        },
                        subAccountDeltas: {
                            online_p1: curOnlineP1 - prevOnlineP1,
                            online_p2: curOnlineP2 - prevOnlineP2,
                            online_p3: curOnlineP3 - prevOnlineP3,
                            other: curOther - prevOther
                        },
                        subAccountBalances: {
                            online_p1: curOnlineP1,
                            online_p2: curOnlineP2,
                            online_p3: curOnlineP3,
                            other: curOther
                        }
                    };
                });

                if (!window._onlineBreakdown) window._onlineBreakdown = { opening: {}, closing: {} };
                window._onlineBreakdown.opening = {
                    online_p1: startOnlineP1,
                    online_p2: startOnlineP2,
                    online_p3: startOnlineP3,
                    other: startOther,
                    total: startOnlineP1 + startOnlineP2 + startOnlineP3 + startOther
                };
                window._onlineBreakdown.closing = {
                    online_p1: curOnlineP1,
                    online_p2: curOnlineP2,
                    online_p3: curOnlineP3,
                    other: curOther,
                    total: curOnlineP1 + curOnlineP2 + curOnlineP3 + curOther
                };

                allTxnsForDate = txns;
                window.allTxnsForDate = txns;
                currentSelectedDate = date;
                currentStartCash = startCash;
                currentStartOnline = startOnline;
                renderBadgesAndTable();

                // Update daily summary badges
                updateDailyBalances(date, txns);
            }, (error) => {`;

content = content.slice(0, startIdx) + replacement + content.slice(endIdx + endMarker.length);

// 2. Also update accFilterSelect.onchange and selectAccountFilter
content = content.replace(
`        accFilterSelect.onchange = (e) => {
            currentAccountFilter = e.target.value;
            window.currentAccountFilter = currentAccountFilter;
            renderBadgesAndTable();
        };`,
`        accFilterSelect.onchange = (e) => {
            currentAccountFilter = e.target.value;
            window.currentAccountFilter = currentAccountFilter;
            if (currentAccountFilter !== 'ALL') {
                currentTxnFilter = 'ALL';
                window.currentTxnFilter = 'ALL';
            }
            renderBadgesAndTable();
        };`
);

content = content.replace(
`    window.selectAccountFilter = (accKey) => {
        currentAccountFilter = accKey || 'ALL';
        window.currentAccountFilter = currentAccountFilter;
        const sel = document.getElementById('account-filter-select');
        if (sel) sel.value = currentAccountFilter;
        renderBadgesAndTable();
    };`,
`    window.selectAccountFilter = (accKey) => {
        currentAccountFilter = accKey || 'ALL';
        window.currentAccountFilter = currentAccountFilter;
        if (currentAccountFilter !== 'ALL') {
            currentTxnFilter = 'ALL';
            window.currentTxnFilter = 'ALL';
        }
        const sel = document.getElementById('account-filter-select');
        if (sel) sel.value = currentAccountFilter;
        renderBadgesAndTable();
    };`
);

content = content.replace(
`        accResetBtn.onclick = () => {
            currentAccountFilter = 'ALL';
            window.currentAccountFilter = 'ALL';
            if (accFilterSelect) accFilterSelect.value = 'ALL';
            renderBadgesAndTable();
        };`,
`        accResetBtn.onclick = () => {
            currentAccountFilter = 'ALL';
            window.currentAccountFilter = 'ALL';
            currentTxnFilter = 'ALL';
            window.currentTxnFilter = 'ALL';
            if (accFilterSelect) accFilterSelect.value = 'ALL';
            renderBadgesAndTable();
        };`
);

fs.writeFileSync('app.js', content, 'utf8');
console.log('Successfully patched app.js');

