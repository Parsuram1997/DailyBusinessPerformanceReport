const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCK232KSsVHiWhP6Cj_A2Du4biM1o63d14",
  authDomain: "dailybusinessperformancereport.firebaseapp.com",
  databaseURL: "https://dailybusinessperformancereport-default-rtdb.firebaseio.com",
  projectId: "dailybusinessperformancereport",
  storageBucket: "dailybusinessperformancereport.firebasestorage.app",
  messagingSenderId: "503528502725",
  appId: "1:503528502725:web:fdc97f768d76b7303987ac"
};

async function run() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const entriesSnap = await getDocs(query(collection(db, 'entries'), where('date', 'in', ['2026-11-09', '09-11-2026'])));
  let entryData = {};
  if (!entriesSnap.empty) entryData = entriesSnap.docs[0].data();
  const d = entryData.details || {};

  const snap = await getDocs(query(collection(db, 'daily_transactions'), where('date', 'in', ['2026-11-10', '10-11-2026'])));
  let txns = [];
  snap.forEach(doc => txns.push({ id: doc.id, ...doc.data() }));

  const getOnlineDest = (prov) => {
    const lower = (prov || '').toLowerCase();
    if (lower.includes('parsu')) return 'online_p1';
    if (lower.includes('shop')) return 'online_p2';
    if (lower.includes('dalai')) return 'online_p3';
    return 'other';
  };

  let startOnlineP1 = parseFloat(d.online_p1 || 0);
  let startOnlineP2 = parseFloat(d.online_p2 || 0);
  let startOnlineP3 = parseFloat(d.online_p3 || 0);
  let startOther = parseFloat(d.other || 0);

  txns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

  let curOnlineP1 = startOnlineP1;
  let curOnlineP2 = startOnlineP2;
  let curOnlineP3 = startOnlineP3;
  let curOther = startOther;

  const mappedTxns = txns.map(t => {
    const prevOnlineP1 = curOnlineP1;
    const prevOnlineP2 = curOnlineP2;
    const prevOnlineP3 = curOnlineP3;
    const prevOther = curOther;

    const amt = parseFloat(t.amount || 0);
    const chg = parseFloat(t.charges || 0);
    const provider = (t.provider || '').trim().toLowerCase();

    const modifyOnlineSub = (dest, val) => {
      if (dest === 'online_p1') curOnlineP1 += val;
      else if (dest === 'online_p2') curOnlineP2 += val;
      else if (dest === 'online_p3') curOnlineP3 += val;
      else curOther += val;
    };

    if (!['CSP_COMMISSION', 'CSP_SUBSCRIPTION'].includes(t.type)) {
      if (t.chargesType === 'Online') {
        const dest = getOnlineDest(t.chargesAccount || t.receivedIn || t.depositBy || provider);
        modifyOnlineSub(dest, chg);
      }
    }

    if (['AEPS', 'MATM', 'WITHDRAWAL', 'QR_WITHDRAWAL', 'FREE_WITHDRAWAL', 'ADMIN_WITHDRAWAL'].includes(t.type)) {
      if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
        const dest = getOnlineDest(t.depositBy || t.paymentApp || provider);
        modifyOnlineSub(dest, amt);
      }
    } else if (t.type === 'AADHAAR_PAY') {
      const provCharge = parseFloat(t.providerCharge || 0);
      const walletCredit = amt - provCharge;
      if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
        const dest = getOnlineDest(t.depositBy || t.paymentApp || provider);
        modifyOnlineSub(dest, walletCredit);
      }
    } else if (['DEPOSIT', 'AADHAAR_DEPOSIT', 'FREE_DEPOSIT', 'ADMIN_DEPOSIT'].includes(t.type)) {
      if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
        const dest = getOnlineDest(t.depositBy || provider);
        modifyOnlineSub(dest, -amt);
      }
    } else if (['DISHTV_RECHARGE', 'ELECTRICITY_BILL', 'PAN_CARD', 'LOAN_REPAYMENT'].includes(t.type)) {
      if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney')) {
        const dest = getOnlineDest(provider.includes('online') ? provider : t.depositBy);
        modifyOnlineSub(dest, -amt);
      }
      if (t.chargesType === 'Online') {
        const dest = getOnlineDest(t.chargesAccount || t.depositBy);
        modifyOnlineSub(dest, amt);
      }
    } else if (t.type === 'JIO_RECHARGE') {
      if (t.provider === 'Online' || provider !== 'cash') {
        const dest = getOnlineDest(t.receivedIn || t.depositBy || provider);
        modifyOnlineSub(dest, amt);
      }
    } else if (t.type === 'JIO_TOPUP') {
      modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
      if (t.chargesType === 'Online') {
        modifyOnlineSub(getOnlineDest(t.chargesAccount || t.depositBy), -chg);
      }
    } else if (['CSP_COMMISSION', 'OTHER_INCOME'].includes(t.type)) {
      if (t.provider !== 'Cash' && provider !== 'cash') {
        if (t.type === 'OTHER_INCOME') {
          if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
            modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt + chg);
          }
        }
      }
    } else if (t.type === 'CSP_SUBSCRIPTION') {
      const cspProv = provider;
      if (!cspProv.includes('roinet') && !cspProv.includes('airtel') && !cspProv.includes('spicemoney') && !cspProv.includes('crgb')) {
        modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
      }
    } else if (t.type === 'GOLD_SIP') {
      modifyOnlineSub(getOnlineDest(t.depositBy || 'shop'), -amt);
    } else if (t.type === 'CREDIT_GIVEN') {
      if (provider !== 'cash') modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
    } else if (['CREDIT_RECEIVED', 'CUST_MONEY_IN'].includes(t.type)) {
      if (provider !== 'cash') modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
    } else if (['CUST_MONEY_OUT', 'DAILY_EXPENSE'].includes(t.type)) {
      if (provider !== 'cash') modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
    } else if (t.type === 'DAMAGED_RECOVERY') {
      if (provider !== 'cash') {
        if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
          modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
        }
      }
    } else if (t.type === 'CASH_WITHDRAWAL') {
      modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
    } else if (t.type === 'CASH_DEPOSIT') {
      modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
    } else if (t.type === 'SETTLEMENT') {
      modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
      if (t.chargesType === 'Online') {
        modifyOnlineSub(getOnlineDest(t.chargesAccount || t.depositBy || provider), -chg);
      }
      const totalDeduction = amt + chg;
      if (!provider.includes('roinet') && !provider.includes('airtel') && !provider.includes('spicemoney') && !provider.includes('crgb') && !provider.includes('jio')) {
        modifyOnlineSub(getOnlineDest(t.depositBy), -totalDeduction);
      }
    } else if (t.type === 'ONLINE_WORK') {
      modifyOnlineSub(getOnlineDest(t.depositBy), -amt);
      if (provider !== 'cash') {
        modifyOnlineSub(getOnlineDest(t.receivedIn), amt);
      }
    } else if (t.type === 'ADD_CAPITAL') {
      if (provider !== 'cash') modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
    } else if (t.type === 'SHARE_WITHDRAWN') {
      if (provider !== 'cash') modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
    } else if (t.type === 'PENDING_ADD') {
      if (provider !== 'cash') modifyOnlineSub(getOnlineDest(t.depositBy || provider), -amt);
    } else if (t.type === 'PENDING_REMOVE') {
      if (provider !== 'cash') modifyOnlineSub(getOnlineDest(t.depositBy || provider), amt);
    } else if (t.type === 'ONLINE_EXCHANGE') {
      let sourceDest = getOnlineDest(t.paymentApp || t.depositBy);
      let targetDest = getOnlineDest(t.provider || t.receivedIn);
      modifyOnlineSub(sourceDest, -amt);
      modifyOnlineSub(targetDest, amt);
    }

    return {
      ...t,
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

  const names = { online_p1: 'online(parsu)', online_p2: 'online(shop)', online_p3: 'online(dalai)' };
  ['online_p1', 'online_p2', 'online_p3'].forEach(acc => {
    const accTxns = mappedTxns.filter(t => t.subAccountDeltas && Math.abs(t.subAccountDeltas[acc] || 0) > 0);
    const cr = accTxns.reduce((sum, t) => sum + (t.subAccountDeltas[acc] > 0 ? t.subAccountDeltas[acc] : 0), 0);
    const dr = accTxns.reduce((sum, t) => sum + (t.subAccountDeltas[acc] < 0 ? Math.abs(t.subAccountDeltas[acc]) : 0), 0);
    const op = parseFloat(d[acc] || 0);
    console.log(`\n================== Account: ${names[acc]} (${acc}) ==================`);
    console.log(`Opening: Rs. ${op}, Found: ${accTxns.length} txns, Credit: +Rs. ${cr}, Debit: -Rs. ${dr}, Closing: Rs. ${op + cr - dr}`);
    accTxns.forEach((t, i) => {
      const delta = t.subAccountDeltas[acc];
      const sign = delta > 0 ? `+Rs. ${delta} (Credit)` : `-Rs. ${Math.abs(delta)} (Debit)`;
      console.log(`  [${i+1}] Type: ${t.type.padEnd(16)} | Amt: ${String(t.amount).padEnd(6)} | Change: ${sign.padEnd(20)} | Bal: Rs. ${t.subAccountBalances[acc]}`);
    });
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

