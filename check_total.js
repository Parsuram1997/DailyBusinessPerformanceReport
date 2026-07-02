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

async function checkCurrentCredits() {
    try {
        const creditSnap = await getDocs(collection(db, "credits"));
        let totalDue = 0;
        creditSnap.forEach(doc => {
            const data = doc.data();
            const amt = Number(data.amount) || 0;
            const paid = Number(data.paid) || 0;
            totalDue += (amt - paid);
        });
        console.log(`Current Total Credit Due in DB: ₹${totalDue}`);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

checkCurrentCredits();
