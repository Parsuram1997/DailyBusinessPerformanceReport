import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

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
    console.log("Fetching daily transactions...");
    try {
        const q = query(
            collection(db, "daily_transactions"), 
            where("type", "in", ["CREDIT_GIVEN", "CREDIT_RECEIVED", "CUST_MONEY_IN", "CUST_MONEY_OUT"])
        );
        const snapshot = await getDocs(q);
        console.log(`Found ${snapshot.docs.length} credit/deposit transactions in daily_transactions`);
        
        const customerMap = new Map();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.note || data.remark || 'Unknown').trim();
            if (name.includes('Synced from') || name.includes('Credit')) return; // ignore generic ones
            
            if (!customerMap.has(name)) {
                customerMap.set(name, { given: 0, received: 0, moneyIn: 0, moneyOut: 0, names: new Set([name]) });
            }
            const c = customerMap.get(name);
            const amt = Number(data.amount || 0);
            
            if (data.type === 'CREDIT_GIVEN') c.given += amt;
            if (data.type === 'CREDIT_RECEIVED') c.received += amt;
            if (data.type === 'CUST_MONEY_IN') c.moneyIn += amt;
            if (data.type === 'CUST_MONEY_OUT') c.moneyOut += amt;
        });

        console.log("\n--- Suspected Customers and their Credit Due ---");
        for (const [name, c] of customerMap.entries()) {
            const due = c.given - c.received;
            const depDue = c.moneyIn - c.moneyOut;
            if (due !== 0 || depDue !== 0) {
                console.log(`Name: ${name} | Credit Due: ${due} | Deposit Balance: ${depDue} | (Total Given: ${c.given}, Paid: ${c.received}, Total In: ${c.moneyIn}, Total Out: ${c.moneyOut})`);
            }
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

findDeletedCustomers();
