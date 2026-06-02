const fs = require('fs');
let app = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

// 1. SETTLEMENT Fix
app = app.replace(
    'totalSysIncome += chg;',
    'if (t.type !== \'SETTLEMENT\') { totalSysIncome += chg; }'
);

// 2. roinet_fallback Fix - opValues
const opValuesOriginal = `            const opValues = {
                online: Number(details.online || 0),
                roinet_1: Number(details.roinet_1 || 0),
                roinet_2: Number(details.roinet_2 || 0),
                airtel_1: Number(details.airtel_1 || 0),
                airtel_2: Number(details.airtel_2 || 0),
                spicemoney: Number(details.spicemoney || 0),`;

const opValuesNew = `            const opRoinet1 = Number(details.roinet_1 || 0);
            const opRoinet2 = Number(details.roinet_2 || 0);
            const opAirtel1 = Number(details.airtel_1 || 0);
            const opAirtel2 = Number(details.airtel_2 || 0);
            const opSpice = Number(details.spicemoney || 0);
            const roinetFallback = (opRoinet1 || opRoinet2 || opAirtel1 || opAirtel2 || opSpice) ? 0 : Number(details.roinet || 0);

            const opValues = {
                online: Number(details.online || 0),
                roinet_1: opRoinet1,
                roinet_2: opRoinet2,
                airtel_1: opAirtel1,
                airtel_2: opAirtel2,
                spicemoney: opSpice,
                roinet_fallback: roinetFallback,`;

app = app.replace(opValuesOriginal, opValuesNew);

// 3. roinet_fallback Fix - deltas
app = app.replace(
    'const deltas = { online: 0, roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0, jio: 0, crgb_bc: 0, pending: 0, deposit: 0, capital: 0, withdrawal: 0, expense: 0, damaged: 0, expenseDetails: {} };',
    'const deltas = { online: 0, roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0, roinet_fallback: 0, jio: 0, crgb_bc: 0, pending: 0, deposit: 0, capital: 0, withdrawal: 0, expense: 0, damaged: 0, expenseDetails: {} };'
);

// 4. roinet_fallback Fix - provider === 'roinet'
app = app.replace(
    "else if (prov === 'roinet') deltas.roinet_1 += diff;",
    "else if (prov === 'roinet') deltas.roinet_fallback += diff;"
);

// 5. roinet_fallback Fix - ONLINE_FIELDS
app = app.replace(
    'const ONLINE_FIELDS = ["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "jio", "crgb_bc", "pending"];',
    'const ONLINE_FIELDS = ["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "roinet_fallback", "jio", "crgb_bc", "pending"];'
);

// 6. roinet_fallback Fix - ALL_SYNC_FIELDS
app = app.replace(
    'const ALL_SYNC_FIELDS = ["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "jio", "crgb_bc", "pending", "deposit", "capital", "withdrawal", "expense", "damaged"];',
    'const ALL_SYNC_FIELDS = ["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "roinet_fallback", "jio", "crgb_bc", "pending", "deposit", "capital", "withdrawal", "expense", "damaged"];'
);

fs.writeFileSync('d:/BusinessPerformance/app.js', app);
console.log('Successfully patched app.js');
