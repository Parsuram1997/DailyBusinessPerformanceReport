import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findDeletedCustomers() {
    try {
        const custSnap = await getDocs(collection(db, "customers"));
        const currentCustomers = new Set();
        custSnap.forEach(doc => {
            const name = (doc.data().name || '').trim().toLowerCase();
            if (name) currentCustomers.add(name);
        });

        const q = query(
            collection(db, "daily_transactions"), 
            where("type", "in", ["CREDIT_GIVEN", "CREDIT_RECEIVED", "CUST_MONEY_IN", "CUST_MONEY_OUT"])
        );
        const snapshot = await getDocs(q);
        
        const customerMap = new Map();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const rawName = data.note || data.remark || 'Unknown';
            const name = rawName.trim();
            if (name.includes('Synced from') || name.includes('Credit')) return;
            
            if (!customerMap.has(name)) {
                customerMap.set(name, { given: 0, received: 0, moneyIn: 0, moneyOut: 0, originalName: name });
            }
            const c = customerMap.get(name);
            const amt = Number(data.amount || 0);
            
            if (data.type === 'CREDIT_GIVEN') c.given += amt;
            if (data.type === 'CREDIT_RECEIVED') c.received += amt;
            if (data.type === 'CUST_MONEY_IN') c.moneyIn += amt;
            if (data.type === 'CUST_MONEY_OUT') c.moneyOut += amt;
        });

        console.log("--- MISSING CUSTOMERS (Deleted from Credit Ledger/Deposits) ---");
        for (const [name, c] of customerMap.entries()) {
            const lowerName = name.toLowerCase();
            if (!currentCustomers.has(lowerName)) {
                const due = c.given - c.received;
                const depDue = c.moneyIn - c.moneyOut;
                if (due !== 0 || depDue !== 0) {
                    console.log(`Name: ${c.originalName}`);
                    if (due !== 0) console.log(`   -> Credit Ledger Due: ₹${due} (Given: ${c.given}, Paid: ${c.received})`);
                    if (depDue !== 0) console.log(`   -> Deposit Balance: ₹${depDue} (In: ${c.moneyIn}, Out: ${c.moneyOut})`);
                    console.log("-----------------------------------------");
                }
            }
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

findDeletedCustomers();
