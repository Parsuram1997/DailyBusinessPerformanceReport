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
        console.log("Analyzing...");
        const custSnap = await getDocs(collection(db, "customers"));
        const customerIdToName = new Map();
        custSnap.forEach(doc => {
            customerIdToName.set(doc.id, (doc.data().name || '').trim());
        });

        const creditSnap = await getDocs(collection(db, "credits"));
        const currentCredits = new Map(); // name -> net due
        creditSnap.forEach(doc => {
            const data = doc.data();
            const cid = data.customerId;
            const name = customerIdToName.get(cid) || 'Unknown';
            if (!currentCredits.has(name)) currentCredits.set(name, 0);
            currentCredits.set(name, currentCredits.get(name) + (Number(data.amount) || 0) - (Number(data.paid) || 0));
        });

        const q = query(
            collection(db, "daily_transactions"), 
            where("type", "in", ["CREDIT_GIVEN", "CREDIT_RECEIVED"])
        );
        const snapshot = await getDocs(q);
        
        const historyCredits = new Map();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const rawName = data.note || data.remark || 'Unknown';
            const name = rawName.trim();
            if (name.includes('Synced from') || name.includes('Credit')) return;
            
            if (!historyCredits.has(name)) {
                historyCredits.set(name, { given: 0, received: 0, originalName: name });
            }
            const c = historyCredits.get(name);
            const amt = Number(data.amount || 0);
            
            if (data.type === 'CREDIT_GIVEN') c.given += amt;
            if (data.type === 'CREDIT_RECEIVED') c.received += amt;
        });

        console.log("--- CUSTOMERS WITH MISSING CREDIT DATA ---");
        for (const [name, c] of historyCredits.entries()) {
            const historyDue = c.given - c.received;
            const currentDue = currentCredits.get(name) || 0;
            
            // If they had a history due but it's not currently reflected in credits
            if (historyDue !== 0 && historyDue !== currentDue) {
                console.log(`Name: ${c.originalName}`);
                console.log(`   -> Missing Credit Ledger Due: ₹${historyDue} (They had ₹${historyDue} in history, but current database says ₹${currentDue})`);
                console.log("-----------------------------------------");
            }
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

findDeletedCustomers();
