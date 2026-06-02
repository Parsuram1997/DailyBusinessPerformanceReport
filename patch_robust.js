const fs = require('fs');
let app = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

const r1 = /const opValues = \{\s*online: Number\(details\.online \|\| 0\),\s*roinet_1: Number\(details\.roinet_1 \|\| 0\),\s*roinet_2: Number\(details\.roinet_2 \|\| 0\),\s*airtel_1: Number\(details\.airtel_1 \|\| 0\),\s*airtel_2: Number\(details\.airtel_2 \|\| 0\),\s*spicemoney: Number\(details\.spicemoney \|\| 0\),/;

const newOpValues = `const opRoinet1 = Number(details.roinet_1 || 0);
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

if (r1.test(app)) {
    app = app.replace(r1, newOpValues);
    console.log("opValues replaced!");
} else {
    console.log("opValues NOT FOUND!");
}

const r2 = /const deltas = \{ online: 0, roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0, jio: 0, crgb_bc: 0, pending: 0, deposit: 0, capital: 0, withdrawal: 0, expense: 0, damaged: 0, expenseDetails: \{\} \};/;
if (r2.test(app)) {
    app = app.replace(r2, 'const deltas = { online: 0, roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0, roinet_fallback: 0, jio: 0, crgb_bc: 0, pending: 0, deposit: 0, capital: 0, withdrawal: 0, expense: 0, damaged: 0, expenseDetails: {} };');
    console.log("deltas replaced!");
}

const r3 = /else if \(prov === 'roinet'\) deltas\.roinet_1 \+= diff;/;
if (r3.test(app)) {
    app = app.replace(r3, "else if (prov === 'roinet') deltas.roinet_fallback += diff;");
    console.log("provider roinet replaced!");
}

const r4 = /const ONLINE_FIELDS = \["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "jio", "crgb_bc", "pending"\];/;
if (r4.test(app)) {
    app = app.replace(r4, 'const ONLINE_FIELDS = ["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "roinet_fallback", "jio", "crgb_bc", "pending"];');
    console.log("ONLINE_FIELDS replaced!");
}

const r5 = /const ALL_SYNC_FIELDS = \["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "jio", "crgb_bc", "pending", "deposit", "capital", "withdrawal", "expense", "damaged"\];/;
if (r5.test(app)) {
    app = app.replace(r5, 'const ALL_SYNC_FIELDS = ["online", "roinet_1", "roinet_2", "airtel_1", "airtel_2", "spicemoney", "roinet_fallback", "jio", "crgb_bc", "pending", "deposit", "capital", "withdrawal", "expense", "damaged"];');
    console.log("ALL_SYNC_FIELDS replaced!");
}

fs.writeFileSync('d:/BusinessPerformance/app.js', app);
