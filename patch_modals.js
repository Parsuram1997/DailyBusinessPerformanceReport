const fs = require('fs');
let app = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

const targetContent = `        syncListenerUnsubscribe = onSnapshot(q, async (snapshot) => {
            const systemData = await fetchSystemOnline(dateStr);
            const breakdown = systemData.breakdown;
            const pendingCredit = await updateCreditLedgerTotalPending();`;

const newContent = `        syncListenerUnsubscribe = onSnapshot(q, async (snapshot) => {
            const systemData = await fetchSystemOnline(dateStr);
            const breakdown = systemData.breakdown;
            const pendingCredit = await updateCreditLedgerTotalPending();

            window._roinetBreakdown = breakdown;
            
            if (breakdown.online) {
                const expOnlineDisp = document.getElementById('expected-online-split-total-display');
                if (expOnlineDisp) {
                    expOnlineDisp.dataset.val = breakdown.online.closing;
                    expOnlineDisp.innerText = formatCurrency(breakdown.online.closing);
                    if (typeof updateOnlineSplitTotal === 'function') updateOnlineSplitTotal();
                }
            }

            // Expected Roinet Split Total
            const expectedRoinetTotal = (breakdown.roinet_1?.closing || 0) +
                (breakdown.roinet_2?.closing || 0) +
                (breakdown.airtel_1?.closing || 0) +
                (breakdown.airtel_2?.closing || 0) +
                (breakdown.spicemoney?.closing || 0) +
                (breakdown.roinet_fallback?.closing || 0);

            const expRoinetDisp = document.getElementById('expected-roinet-split-total-display');
            if (expRoinetDisp) {
                expRoinetDisp.dataset.val = expectedRoinetTotal;
                expRoinetDisp.innerText = formatCurrency(expectedRoinetTotal);
                if (typeof updateRoinetSplitTotal === 'function') updateRoinetSplitTotal();
            }`;

if (app.includes(targetContent)) {
    app = app.replace(targetContent, newContent);
    fs.writeFileSync('d:/BusinessPerformance/app.js', app);
    console.log("Successfully patched app.js modals.");
} else {
    console.log("Could not find target content.");
}
