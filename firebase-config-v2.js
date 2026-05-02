// Firebase configuration
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

// Initialize Firebase using Compat SDK for file:// protocol support
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const analytics = firebase.analytics();

// Export to window for non-module scripts
window.db = db;
window.analytics = analytics;
window.firebaseConfig = firebaseConfig;
