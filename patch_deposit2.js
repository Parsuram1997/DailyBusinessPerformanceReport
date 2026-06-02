const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

// includedVolumeTypes
appJs = appJs.split("['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL']").join("['AEPS', 'MATM', 'DEPOSIT', 'AADHAAR_DEPOSIT', 'WITHDRAWAL']");

// MASTER_TXN_TYPES
appJs = appJs.replace(
    "{ type: 'DEPOSIT', label: 'Money Transfer', icon: 'send', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },",
    "{ type: 'DEPOSIT', label: 'Money Transfer', icon: 'send', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },\n    { type: 'AADHAAR_DEPOSIT', label: 'Aadhaar Deposit', icon: 'fingerprint', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', borderLeft: 'bg-emerald-500' },"
);

// Validation
appJs = appJs.replace(
    "if (txnType.value === 'DEPOSIT') {",
    "if (txnType.value === 'DEPOSIT' || txnType.value === 'AADHAAR_DEPOSIT') {"
);

appJs = appJs.replace(
    "if (existingTxn && existingTxn.type === 'DEPOSIT') {",
    "if (existingTxn && (existingTxn.type === 'DEPOSIT' || existingTxn.type === 'AADHAAR_DEPOSIT')) {"
);

// provider payload
appJs = appJs.replace(
    "['AEPS', 'MATM', 'DEPOSIT', 'WITHDRAWAL', 'FREE_DEPOSIT'",
    "['AEPS', 'MATM', 'DEPOSIT', 'AADHAAR_DEPOSIT', 'WITHDRAWAL', 'FREE_DEPOSIT'"
);

// Color formatting
appJs = appJs.replace(
    "txn.type === 'DEPOSIT' || txn.type === 'FREE_DEPOSIT'",
    "txn.type === 'DEPOSIT' || txn.type === 'AADHAAR_DEPOSIT' || txn.type === 'FREE_DEPOSIT'"
);

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('Final DEPOSIT replacements done');
