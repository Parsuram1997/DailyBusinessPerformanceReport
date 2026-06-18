const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');
db.all("SELECT * FROM daily_transactions WHERE date = '2026-06-18' OR date = '18-06-2026' OR date = '18-Jun-2026'", [], (err, rows) => {
    if (err) throw err;
    console.log('Total Txns:', rows.length);
    let cashChange = 0;
    rows.forEach(t => {
        const amt = parseFloat(t.amount || 0);
        const chg = parseFloat(t.charges || 0);
        const provider = (t.provider || '').toLowerCase();
        
        let rowCash = 0;
        if (!['CSP_COMMISSION', 'CSP_SUBSCRIPTION'].includes(t.type)) {
            if (t.chargesType !== 'Online') rowCash += chg;
        }

        if (['AEPS', 'MATM', 'WITHDRAWAL', 'QR_WITHDRAWAL', 'FREE_WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
            rowCash -= amt;
        } else if (['DEPOSIT', 'AADHAAR_DEPOSIT', 'FREE_DEPOSIT', 'ADMIN_DEPOSIT'].includes(t.type)) {
            rowCash += amt;
        } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL', 'PAN_CARD'].includes(t.type)) {
            if (t.chargesType !== 'Online') rowCash += amt;
        } else if (t.type === 'JIO_RECHARGE') {
            if (provider === 'cash') rowCash += amt;
        } else if (t.type === 'JIO_TOPUP') {
            if (t.chargesType !== 'Online') rowCash -= chg;
        } else if (t.type === 'CREDIT_GIVEN') {
            if (provider === 'cash') rowCash -= amt;
        } else if (t.type === 'CREDIT_RECEIVED') {
            if (provider === 'cash') rowCash += amt;
        } else if (t.type === 'CUST_MONEY_IN') {
            if (provider === 'cash') rowCash += amt;
        } else if (t.type === 'CUST_MONEY_OUT') {
            if (provider === 'cash') rowCash -= amt;
        } else if (t.type === 'DAILY_EXPENSE') {
            if (provider === 'cash') rowCash -= amt;
        } else if (t.type === 'DAMAGED_CURRENCY') {
            rowCash -= amt;
        } else if (t.type === 'DAMAGED_RECOVERY') {
            if (provider === 'cash') rowCash += amt;
        } else if (t.type === 'OTHER_INCOME') {
            if (provider === 'cash') rowCash += amt;
        } else if (t.type === 'SETTLEMENT') {
            if (t.chargesType !== 'Online') rowCash -= chg;
        } else if (t.type === 'ONLINE_WORK') {
            if (provider === 'cash') rowCash += amt;
        } else if (t.type === 'ADD_CAPITAL') {
            if (provider === 'cash') rowCash += amt;
        } else if (t.type === 'SHARE_WITHDRAWN') {
            if (provider === 'cash') rowCash -= amt;
        } else if (t.type === 'CASH_WITHDRAWAL') {
            rowCash += amt;
        } else if (t.type === 'CASH_DEPOSIT') {
            rowCash -= amt;
        }
        cashChange += rowCash;
    });
    console.log('Calculated Cash Delta for 18th:', cashChange);
});
db.all("SELECT id, date, details FROM entries ORDER BY id DESC LIMIT 5", [], (err, rows) => {
    console.log('Recent Entries:', JSON.stringify(rows.map(r => ({id: r.id, date: r.date, cash: JSON.parse(r.details).cash, online: JSON.parse(r.details).online})), null, 2));
});
