const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCK232KSsVHiWhP6Cj_A2Du4biM1o63d14",
  authDomain: "dailybusinessperformancereport.firebaseapp.com",
  projectId: "dailybusinessperformancereport"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkNotes() {
  const snap = await getDocs(collection(db, "quick_notes"));
  snap.docs.forEach(d => {
    console.log('ID:', d.id);
    console.log('Data:', JSON.stringify(d.data(), null, 2));
  });
}
checkNotes().catch(console.error);

