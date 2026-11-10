const fs = require('fs');

let content = fs.readFileSync('app-v2.js', 'utf8');

// 1. In app-v2.js, update showOnlyLast10 check
content = content.replace(
`        if (window.showOnlyLast10 && !window.isAllTimeSearchMode) {
            txnsToRender = txnsToRender.slice(0, 10);
        }`,
`        if (!isAccFilter && window.showOnlyLast10 && !window.isAllTimeSearchMode) {
            txnsToRender = txnsToRender.slice(0, 10);
        }`
);

// 2. In accFilterSelect.onchange and selectAccountFilter
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

// 3. In loadTransactions, add curOnlineP1/P2/P3/Other tracking
const searchMarkerStart = "                // Calculate running balances\r\n                txns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));\r\n                let currentCash = startCash;\r\n                let currentOnline = startOnline;\r\n\r\n                allTxnsForDate = txns.map(t => {";
const searchMarkerStartLF = "                // Calculate running balances\n                txns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));\n                let currentCash = startCash;\n                let currentOnline = startOnline;\n\n                allTxnsForDate = txns.map(t => {";
let startMarker = content.includes(searchMarkerStart) ? searchMarkerStart : searchMarkerStartLF;

const searchMarkerEnd = "                // Sort by latest first for display\r\n                allTxnsForDate.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));\r\n\r\n                renderBadgesAndTable();";
const searchMarkerEndLF = "                // Sort by latest first for display\n                allTxnsForDate.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));\n\n                renderBadgesAndTable();";
let endMarker = content.includes(searchMarkerEnd) ? searchMarkerEnd : searchMarkerEndLF;

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find markers in app-v2.js!", { startIdx, endIdx });
  process.exit(1);
}

const replacement = `                // Calculate running balances
                txns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
                let currentCash = startCash;
                let currentOnline = startOnline;

                let curOnlineP1 = parseFloat(openingBalances.online_p1 || 0);
                let curOnlineP2 = parseFloat(openingBalances.online_p2 || 0);
                let curOnlineP3 = parseFloat(openingBalances.online_p3 || 0);
                let curOther = parseFloat(openingBalances.other || 0);

                allTxnsForDate = txns.map(t => {
                    const prevCash = currentCash;
                    const prevOnline = currentOnline;

                    const prevOnlineP1 = curOnlineP1;
                    const prevOnlineP2 = curOnlineP2;
                    const prevOnlineP3 = curOnlineP3;
                    const prevOther = curOther;

                    const amt = parseFloat(t.amount || 0);
                    const chg = parseFloat(t.charges || 0);
                    const provider = (t.provider || "").trim().toLowerCase();
                    const isNewLogic = normalizeDate(date) >= normalizeDate('2026-05-01');
                    const isJio = provider.includes('jio');

                    const modifyOnlineSub = (dest, val) => {
                        if (dest === 'online_p1') curOnlineP1 += val;
                        else if (dest === 'online_p2') curOnlineP2 += val;
                        else if (dest === 'online_p3') curOnlineP3 += val;
                        else curOther += val;
                    };
                    
                    if (!['CSP_COMMISSION', 'CSP_SUBSCRIPTION'].includes(t.type)) {
                        if (t.chargesType === 'Online') {
                            currentOnline += chg;
                            const dest = getOnlineDest(t.chargesAccount || t.receivedIn || t.depositBy || provider);
                            modifyOnlineSub(dest, chg);
                        } else {
                            currentCash += chg;
                        }
                    }

                    if (['AEPS', 'MATM', 'WITHDRAWAL', 'QR_WITHDRAWAL', 'FREE_WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
                        currentCash -= amt;
                        if (!(isNewLogic && isJio)) {
                            currentOnline += amt;
                        }
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                            const dest = getOnlineDest(t.depositBy || t.paymentApp || provider);
                            modifyOnlineSub(dest, amt);
                        }
                    } else if (t.type === 'AADHAAR_PAY') {
                        const provCharge = parseFloat(t.providerCharge || 0);
                        currentCash -= amt;
                        const walletCredit = amt - provCharge;
                        if (!(isNewLogic && isJio)) {
                            currentOnline += walletCredit;
                        }
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                            const dest = getOnlineDest(t.depositBy || t.paymentApp || provider);
                            modifyOnlineSub(dest, walletCredit);
                        }
                    } else if (['DEPOSIT', 'AADHAAR_DEPOSIT', 'FREE_DEPOSIT', 'ADMIN_DEPOSIT'].includes(t.type)) {
                        currentCash += amt;
                        if (!(isNewLogic && isJio)) {
                            currentOnline -= amt;
                        }
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                            const dest = getOnlineDest(t.depositBy || provider);
                            modifyOnlineSub(dest, -amt);
                        }
                    } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL', 'PAN_CARD', 'LOAN_REPAYMENT'].includes(t.type)) {
                        currentOnline -= amt;
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney')) {
                            const dest = getOnlineDest(provider.includes('online') ? provider : t.depositBy);
                            modifyOnlineSub(dest, -amt);
                        }
                        if (t.chargesType === 'Online') {
                            currentOnline += amt;
                            const dest = getOnlineDest(t.chargesAccount || t.depositBy);
                            modifyOnlineSub(dest, amt);
                        } else {
                            currentCash += amt;
                        }
                    } else if (t.type === 'JIO_RECHARGE') {
                        if (!isNewLogic) currentOnline -= amt;
                        if (t.provider === 'Online' || provider !== 'cash') {
                            currentOnline += amt;
                            const dest = getOnlineDest(t.receivedIn || t.depositBy || provider);
                            modifyOnlineSub(dest, amt);
                        } else {
                            currentCash += amt;
                        }
                    } else if (t.type === 'JIO_TOPUP') {
                        currentOnline -= amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        if (t.chargesType === 'Online') {
                            currentOnline -= chg;
                            modifyOnlineSub(getOnlineDest(t.chargesAccount || t.depositBy), -chg);
                        } else {
                            currentCash -= chg;
                        }

                        if (!(isNewLogic && isJio)) {
                            currentOnline += chg;
                        }
                    } else if (t.type === 'GOLD_SIP') {
                        currentOnline -= amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || 'shop'), -amt);
                    } else if (t.type === 'CREDIT_GIVEN') {
                        if (provider === 'cash') currentCash -= amt;
                        else {
                            currentOnline -= amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        }
                    } else if (t.type === 'CREDIT_RECEIVED') {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            currentOnline += amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                        }
                    } else if (t.type === 'CUST_MONEY_IN') {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            currentOnline += amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                        }
                    } else if (t.type === 'CUST_MONEY_OUT') {
                        if (provider === 'cash') currentCash -= amt;
                        else {
                            currentOnline -= amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        }
                    } else if (t.type === 'DAILY_EXPENSE') {
                        if (provider === 'cash') currentCash -= amt;
                        else {
                            currentOnline -= amt;
                            modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                        }
                    } else if (t.type === 'DAMAGED_CURRENCY') {
                        currentCash -= amt;
                    } else if (t.type === 'DAMAGED_RECOVERY') {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            currentOnline += amt;
                            if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                                modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                            }
                        }
                    } else if (t.type === 'CASH_WITHDRAWAL') {
                        currentOnline -= amt;
                        currentCash += amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
                    } else if (t.type === 'CASH_DEPOSIT') {
                        currentCash -= amt;
                        currentOnline += amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                    } else if (t.type === 'OTHER_INCOME') {
                        if (provider === 'cash') currentCash += amt;
                        else {
                            if (!(isNewLogic && isJio)) {
                                currentOnline += amt;
                            }
                            if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                                modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                            }
                        }
                    } else if (t.type === 'SETTLEMENT') {
                        modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
                        if (provider === 'cash') {
                            currentCash -= amt;
                            currentOnline += amt;
                        } else if (isNewLogic && isJio) {
                            currentOnline += amt;
                        }
                        if (t.chargesType === 'Online') {
                            currentOnline -= chg;
                            modifyOnlineSub(getOnlineDest(t.chargesAccount || t.depositBy || provider), -chg);
                        } else {
                            currentCash -= chg;
                        }
                        const totalDeduction = amt + chg;
                        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
                            modifyOnlineSub(getOnlineDest(t.depositBy), -totalDeduction);
                        }
                    } else if (t.type === 'ONLINE_WORK') {
                        currentOnline -= amt;
                        modifyOnlineSub(getOnlineDest(t.depositBy), -amt);
                        if (provider === 'cash') {
                            currentCash += amt;
                        } else {
                            currentOnline += amt;
                            modifyOnlineSub(getOnlineDest(t.receivedIn), amt);
                        }
                    } else if (t.type === 'ONLINE_EXCHANGE') {
                        let sourceDest = getOnlineDest(t.paymentApp || t.depositBy);
                        let targetDest = getOnlineDest(t.provider || t.receivedIn);
                        modifyOnlineSub(sourceDest, -amt);
                        modifyOnlineSub(targetDest, amt);
                    }
                    return { 
                        ...t, 
                        runningCash: currentCash, 
                        runningOnline: currentOnline, 
                        cashDiff: currentCash - prevCash, 
                        onlineDiff: currentOnline - prevOnline,
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
                    online_p1: parseFloat(openingBalances.online_p1 || 0),
                    online_p2: parseFloat(openingBalances.online_p2 || 0),
                    online_p3: parseFloat(openingBalances.online_p3 || 0),
                    other: parseFloat(openingBalances.other || 0),
                    total: parseFloat(openingBalances.online_p1 || 0) + parseFloat(openingBalances.online_p2 || 0) + parseFloat(openingBalances.online_p3 || 0) + parseFloat(openingBalances.other || 0)
                };
                window._onlineBreakdown.closing = {
                    online_p1: curOnlineP1,
                    online_p2: curOnlineP2,
                    online_p3: curOnlineP3,
                    other: curOther,
                    total: curOnlineP1 + curOnlineP2 + curOnlineP3 + curOther
                };

                // Sort by latest first for display
                allTxnsForDate.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

                renderBadgesAndTable();`;

content = content.slice(0, startIdx) + replacement + content.slice(endIdx + endMarker.length);

fs.writeFileSync('app-v2.js', content, 'utf8');
console.log('Successfully patched app-v2.js');

