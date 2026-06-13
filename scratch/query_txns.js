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
  console.log("Querying daily_transactions for date:", dateStr);
  
  const q = query(collection(db, 'daily_transactions'), where('date', '==', dateStr));
  const snap = await getDocs(q);
  
  console.log(`Found ${snap.size} documents.`);
  const txns = [];
  snap.forEach(doc => {
    txns.push({ id: doc.id, ...doc.data() });
  });
  
  txns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
  
  txns.forEach((t, i) => {
    console.log(`[${i+1}] Type: ${t.type}, Amount: ${t.amount}, Provider: ${t.provider}, DepositBy: ${t.depositBy}, Charges: ${t.charges}, ChargesType: ${t.chargesType}, ChargesAccount: ${t.chargesAccount}`);
  });
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
