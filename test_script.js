const fs = require('fs');
const content = fs.readFileSync('app-v2.js', 'utf8');

// Extract updateDailyBalances function
const startIdx = content.indexOf('async function updateDailyBalances(');
let endIdx = content.indexOf('async function initializeApp()');
if (endIdx === -1) endIdx = content.length;
let funcBody = content.substring(startIdx, endIdx);

// Mock DOM updates
funcBody = funcBody.replace(/document\.getElementById/g, '(() => ({}))');
funcBody = funcBody.replace(/ids\.forEach/g, '// ids.forEach');
funcBody = funcBody.replace(/renderBadgesAndTable/g, 'console.log(\"cashDiff:\", allTxnsForDate[0].cashDiff); console.log(\"balances.cash:\", balances.cash); // renderBadgesAndTable');

const testScript = 
const fmt = (v) => v;
const getOnlineDest = () => 'online_p1';
const updateRoinetDelta = () => {};
const ids = [];
let onlineBreakdown = { online_p1: 0, online_p2: 0, online_p3: 0, other: 0 };
let roinetBreakdown = { wallet: 0 };
let lastOnlineChanges = {};

 + funcBody + 

updateDailyBalances(new Date(), [{ type: 'PAN_CARD', amount: 107, charges: 193, chargesType: 'Cash', provider: 'roinet' }], {cash:0}).catch(console.error);
;

fs.writeFileSync('run_test.js', testScript);
console.log('Script written.');
