import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

async function findOrphanedCredits() {
    try {
        const custSnap = await getDocs(collection(db, "customers"));
        const validCustomerIds = new Set();
        custSnap.forEach(doc => validCustomerIds.add(String(doc.id)));

        const creditSnap = await getDocs(collection(db, "credits"));
        let orphanedDue = 0;
        const orphanedCustomers = new Map();

        creditSnap.forEach(doc => {
            const data = doc.data();
            const cid = String(data.customerId);
            if (!validCustomerIds.has(cid)) {
                if (!orphanedCustomers.has(cid)) {
                    orphanedCustomers.set(cid, {
                        id: cid,
                        due: 0,
                        transactions: []
                    });
                }
                const amt = Number(data.amount) || 0;
                const paid = Number(data.paid) || 0;
                const net = amt - paid;
                const c = orphanedCustomers.get(cid);
                c.due += net;
                c.transactions.push({ date: data.date, amount: amt, paid: paid, note: data.note });
                orphanedDue += net;
            }
        });

        console.log("Found missing exact amount: " + orphanedDue);
        
        let i = 1;
        for (const [cid, info] of orphanedCustomers.entries()) {
            if (info.due !== 0) {
                // Determine a likely name from the notes if available
                let guessedName = "Recovered Customer " + i;
                const namesFromNotes = info.transactions.map(t => t.note).filter(n => n && n.trim().length > 0 && !n.includes('Synced'));
                if (namesFromNotes.length > 0) {
                    guessedName = namesFromNotes[0] + " (Recovered)";
                }
                
                console.log(`Restoring: ${guessedName} (Due: ₹${info.due})`);
                
                // RESTORE THEM to database so they show up again in UI!
                await setDoc(doc(db, "customers", cid), {
                    id: cid,
                    name: guessedName,
                    phone: '',
                    recovered: true
                }, { merge: true });
                
                i++;
            }
        }
        
        console.log("Recovery complete! The missing 9617 should now be visible again.");
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

findOrphanedCredits();
