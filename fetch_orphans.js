import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
                        name: data.customerName || 'Unknown (ID: ' + cid + ')',
                        due: 0
                    });
                }
                const amt = Number(data.amount) || 0;
                const paid = Number(data.paid) || 0;
                const net = amt - paid;
                orphanedCustomers.get(cid).due += net;
                orphanedDue += net;
            }
        });

        console.log(`Total Orphaned Due: ₹${orphanedDue}`);
        for (const [cid, info] of orphanedCustomers.entries()) {
            if (info.due !== 0) {
                console.log(`Orphaned Customer ID: ${cid} | Name: ${info.name} | Due: ₹${info.due}`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

findOrphanedCredits();
