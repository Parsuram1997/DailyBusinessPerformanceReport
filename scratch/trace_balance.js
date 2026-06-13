const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCK232KSsVHiWhP6Cj_A2Du4biM1o63d14",
  authDomain: "dailybusinessperformancereport.firebaseapp.com",
  databaseURL: "https://dailybusinessperformancereport-default-rtdb.firebaseio.com",
  projectId: "dailybusinessperformancereport",
  storageBucket: "dailybusinessperformancereport.firebasestorage.app",
  messagingSenderId: "503528502725",
  appId: "1:503528502725:web:fdc97f768d76b7303987ac",
  measurementId: "G-834C94PFQM"
};

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const dateStr = "2026-06-13";
  
  // Get the lookback entry for opening balances
  const entriesRef = collection(db, "entries");
  const lbSnap = await getDocs(query(entriesRef, where("date", "==", "2026-06-12")));
  let entryData = {};
  if (!lbSnap.empty) {
    entryData = lbSnap.docs[0].data();
  }
  
  const details = entryData.details || {};
  const opValues = {
    cash: details.cash || 0,
    online: details.online || 0,
    roinet: details.roinet || 0,
    jio: details.jio || 0,
    crgb: details.go2sms || 0,
    pending: details.pending || 0,
    expense: 0,
    damaged: details.damages || 0,
    'credit-ledger': details.credit || 0,
    'cust-deposit': details.deposit || 0
  };
  
  const opOnlineP1 = parseFloat(details.online_p1 || 0);
  const opOnlineP2 = parseFloat(details.online_p2 || 0);
  const opOnlineP3 = parseFloat(details.online_p3 || 0);
  const totalSplitOnline = opOnlineP1 + opOnlineP2 + opOnlineP3;
  const onlineOpeningFallback = parseFloat(opValues.online || 0);
  
  console.log("OPENING BALANCES:");
  console.log(`- Online(Parsu): ${opOnlineP1}`);
  console.log(`- Online(Shop): ${opOnlineP2}`);
  console.log(`- Online(Dalai): ${opOnlineP3}`);
  console.log(`- Other: ${totalSplitOnline > 0 ? (onlineOpeningFallback - totalSplitOnline) : onlineOpeningFallback}`);
  console.log(`- Total: ${onlineOpeningFallback}\n`);

  // Fetch transactions
  const q = query(collection(db, 'daily_transactions'), where('date', '==', dateStr));
  const snap = await getDocs(q);
  const txns = [];
  snap.forEach(doc => {
    txns.push({ id: doc.id, ...doc.data() });
  });
  
  txns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

  const balances = {
    cash: 0, online: 0, roinet: 0, crgb: 0, jio: 0, pending: 0, expense: 0, damaged: 0, 'credit-ledger': 0, 'cust-deposit': 0
  };
  
  const roinetBreakdown = { roinet_1: 0, roinet_2: 0, airtel_1: 0, airtel_2: 0, spicemoney: 0 };
  const onlineBreakdown = { online_p1: 0, online_p2: 0, online_p3: 0, other: 0 };
  
  const getSubAccountKey = (prov) => {
    if (prov.includes('roinet(parsu)') || prov === 'roinet_1') return 'roinet_1';
    if (prov.includes('roinet(dalai)') || prov === 'roinet_2') return 'roinet_2';
    if (prov.includes('airtel(parsu)') || prov === 'airtel_1') return 'airtel_1';
    if (prov.includes('airtel(dalai)') || prov === 'airtel_2') return 'airtel_2';
    if (prov.includes('spicemoney')) return 'spicemoney';
    if (prov.includes('airtel')) return 'airtel_1';
    if (prov.includes('roinet')) return 'roinet_1';
    return null;
  };
  
  const updateRoinetDelta = (prov, val) => {
    const key = getSubAccountKey(prov);
    if (key) roinetBreakdown[key] += val;
  };

  txns.forEach((t, i) => {
    const amt = parseFloat(t.amount || 0);
    const chg = parseFloat(t.charges || 0);
    const provider = (t.provider || "").trim().toLowerCase();
    
    const prevBals = { ...balances };
    
    if (['ROINET_COMMISSION', 'CSP_COMMISSION'].includes(t.type)) {
      // commission skip global
    } else {
      if (t.chargesType === 'Online') balances.online += chg;
      else balances.cash += chg;
    }
    
    if (['AEPS', 'MATM', 'WITHDRAWAL', 'QR_WITHDRAWAL', 'FREE_WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
      balances.cash -= amt;
      if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
        balances.roinet += amt;
        updateRoinetDelta(provider, amt);
      }
      else if (provider.includes('crgb')) balances.crgb += amt;
      else if (provider.includes('jio')) balances.jio += amt;
      else balances.online += amt;
    } else if (['DEPOSIT', 'AADHAAR_DEPOSIT', 'FREE_DEPOSIT', 'ADMIN_DEPOSIT'].includes(t.type)) {
      balances.cash += amt;
      if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
        balances.roinet -= amt;
        updateRoinetDelta(provider, -amt);
      }
      else if (provider.includes('crgb')) balances.crgb -= amt;
      else if (provider.includes('jio')) balances.jio -= amt;
      else balances.online -= amt;
    } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL', 'PAN_CARD'].includes(t.type)) {
      if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
        balances.roinet -= amt;
        updateRoinetDelta(provider, -amt);
      } else {
        balances.online -= amt;
      }
      if (t.chargesType === 'Online') balances.online += amt;
      else balances.cash += amt;
    } else if (t.type === 'JIO_RECHARGE') {
      balances.jio -= amt;
      if (provider === 'cash') balances.cash += amt;
      else balances.online += amt;
    } else if (t.type === 'JIO_TOPUP') {
      balances.jio += (amt + chg);
      balances.online -= amt;
      if (t.chargesType === 'Online') balances.online -= chg;
      else balances.cash -= chg;
    } else if (t.type === 'GOLD_SIP') {
      balances.online -= amt;
    } else if (t.type === 'CREDIT_GIVEN') {
      if (provider === 'cash') balances.cash -= amt;
      else balances.online -= amt;
    } else if (t.type === 'CREDIT_RECEIVED') {
      if (provider === 'cash') balances.cash += amt;
      else balances.online += amt;
    } else if (t.type === 'CUST_MONEY_IN') {
      if (provider === 'cash') balances.cash += amt;
      else balances.online += amt;
    } else if (t.type === 'CUST_MONEY_OUT') {
      if (provider === 'cash') balances.cash -= amt;
      else balances.online -= amt;
    } else if (t.type === 'DAILY_EXPENSE') {
      if (provider === 'cash') balances.cash -= amt;
      else balances.online -= amt;
    } else if (t.type === 'DAMAGED_CURRENCY') {
      balances.cash -= amt;
    } else if (t.type === 'DAMAGED_RECOVERY') {
      if (provider === 'cash') balances.cash += amt;
      else {
        balances.online += amt;
        if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) balances.roinet += amt;
      }
    } else if (t.type === 'CASH_WITHDRAWAL') {
      balances.online -= amt;
      balances.cash += amt;
    } else if (t.type === 'CASH_DEPOSIT') {
      balances.cash -= amt;
      balances.online += amt;
    } else if (t.type === 'SETTLEMENT') {
      balances.online += amt;
      if (t.chargesType === 'Online') balances.online -= chg;
      else balances.cash -= chg;
      const totalDeduction = amt + chg;
      if (provider.includes('roinet') || provider.includes('airtel') || provider.includes('spicemoney')) {
        balances.roinet -= totalDeduction;
        updateRoinetDelta(provider, -totalDeduction);
      }
      else if (provider.includes('crgb')) balances.crgb -= totalDeduction;
      else balances.online -= totalDeduction;
    } else if (t.type === 'ONLINE_WORK') {
      balances.online -= amt;
      if (provider === 'cash') balances.cash += amt;
      else balances.online += amt;
    } else if (t.type === 'ONLINE_EXCHANGE') {
      let sourceDest = 'other';
      let targetDest = 'other';
      const sourceProv = (t.paymentApp || '').toLowerCase();
      const targetProv = (t.provider || '').toLowerCase();
      if (sourceProv.includes('parsu')) sourceDest = 'online_p1';
      else if (sourceProv.includes('shop')) sourceDest = 'online_p2';
      else if (sourceProv.includes('dalai')) sourceDest = 'online_p3';
      if (targetProv.includes('parsu')) targetDest = 'online_p1';
      else if (targetProv.includes('shop')) targetDest = 'online_p2';
      else if (targetProv.includes('dalai')) targetDest = 'online_p3';
      
      onlineBreakdown[sourceDest] -= amt;
      onlineBreakdown[targetDest] += amt;
    }

    // Capture changes
    Object.keys(balances).forEach(key => {
      const diff = balances[key] - prevBals[key];
      if (diff !== 0) {
        if (key === 'online') {
          const onlineChargesDiff = (t.chargesType === 'Online' && !['ROINET_COMMISSION', 'CSP_COMMISSION', 'JIO_TOPUP', 'SETTLEMENT'].includes(t.type)) ? chg : 0;
          const onlineAmountDiff = diff - onlineChargesDiff;
          
          const getOnlineDest = (prov) => {
            const lower = (prov || '').toLowerCase();
            if (lower.includes('parsu')) return 'online_p1';
            if (lower.includes('shop')) return 'online_p2';
            if (lower.includes('dalai')) return 'online_p3';
            return 'other';
          };
          
          let amtDest = 'other';
          let actualProviderForAmt = provider;
          if (['CUST_MONEY_IN', 'CUST_MONEY_OUT', 'CREDIT_GIVEN', 'CREDIT_RECEIVED', 'ADD_CAPITAL', 'SHARE_WITHDRAWN', 'JIO_TOPUP', 'DAILY_EXPENSE'].includes(t.type) && provider === 'online') {
            actualProviderForAmt = t.depositBy || provider;
          } else if (['DEPOSIT', 'WITHDRAWAL', 'FREE_DEPOSIT', 'FREE_WITHDRAWAL', 'QR_WITHDRAWAL', 'SETTLEMENT', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT'].includes(t.type) && t.depositBy) {
            actualProviderForAmt = t.depositBy;
          }
          amtDest = getOnlineDest(actualProviderForAmt);
          
          let destDiffs = { online_p1: 0, online_p2: 0, online_p3: 0, other: 0 };
          if (onlineAmountDiff !== 0) destDiffs[amtDest] += onlineAmountDiff;
          if (onlineChargesDiff !== 0) {
            const chargesProv = t.chargesAccount || actualProviderForAmt;
            const chgDest = getOnlineDest(chargesProv);
            destDiffs[chgDest] += onlineChargesDiff;
          }
          
          Object.keys(destDiffs).forEach(d => {
            if (destDiffs[d] !== 0) {
              onlineBreakdown[d] += destDiffs[d];
            }
          });
        }
      }
    });

    // Print step trace for target cash withdrawals or settlements
    if (t.type === 'CASH_WITHDRAWAL' || t.type === 'SETTLEMENT' || t.amount >= 10000) {
      console.log(`Step [${i+1}] ${t.type} (Amount: ${t.amount}, depositBy: ${t.depositBy}):`);
      console.log(`  onlineBreakdown changes: Parsu: ${onlineBreakdown.online_p1}, Shop: ${onlineBreakdown.online_p2}, Dalai: ${onlineBreakdown.online_p3}, Other: ${onlineBreakdown.other}`);
    }
  });

  console.log("\nFINAL RESULTS:");
  console.log(`- Parsu Closing: ${opOnlineP1 + onlineBreakdown.online_p1} (Calculated change: ${onlineBreakdown.online_p1})`);
  console.log(`- Shop Closing: ${opOnlineP2 + onlineBreakdown.online_p2} (Calculated change: ${onlineBreakdown.online_p2})`);
  console.log(`- Dalai Closing: ${opOnlineP3 + onlineBreakdown.online_p3} (Calculated change: ${onlineBreakdown.online_p3})`);
  console.log(`- Other Closing: ${onlineBreakdown.other}`);
  console.log(`- Total Closing: ${onlineOpeningFallback + balances.online} (Calculated change: ${balances.online})`);
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
