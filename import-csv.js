// CSV to Firestore Import Script
// Run: node import-csv.js

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, Timestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper: Parse Indian number format (₹ 1,00,000 → 100000)
function parseAmount(str) {
  if (!str || str.trim() === '' || str.trim() === '₹ 0' || str.trim() === '₹0') return 0;
  // Remove ₹ symbol, spaces, commas, and handle negative
  let cleaned = str.toString().replace(/[₹\s,]/g, '').trim();
  if (cleaned === '' || cleaned === '0') return 0;
  return parseFloat(cleaned) || 0;
}

// Helper: Parse date (1-Jun-2023 → Date)
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  dateStr = dateStr.trim();
  
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  // Format: 1-Jun-2023
  const match = dateStr.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  if (match) {
    const day = parseInt(match[1]);
    const month = months[match[2]];
    const year = parseInt(match[3]);
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }
  return null;
}

// Helper: Format date as YYYY-MM-DD (document ID)
function formatDateId(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const records = [];
  
  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV (handle quoted fields with commas)
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    
    // Minimum fields check
    if (fields.length < 16) continue;
    
    const sno = fields[0]?.trim();
    const dateStr = fields[1]?.trim();
    
    // Skip if no serial number or date
    if (!sno || !dateStr || isNaN(parseInt(sno))) continue;
    
    const date = parseDate(dateStr);
    if (!date) continue;
    
    const prevClosing = parseAmount(fields[2]);
    const capitalAdd = parseAmount(fields[3]);
    const openingBalance = parseAmount(fields[4]);
    const cash = parseAmount(fields[5]);
    const online = parseAmount(fields[6]);
    const roinet = parseAmount(fields[7]);
    const jio = parseAmount(fields[8]);
    const go2sms = parseAmount(fields[9]);
    const credit = parseAmount(fields[10]);
    const pending = parseAmount(fields[11]);
    const damages = parseAmount(fields[12]);
    const expense = parseAmount(fields[13]);
    const total = parseAmount(fields[14]);
    const withdrawal = parseAmount(fields[15]);
    const closingBalance = parseAmount(fields[16]);
    
    // Calculate income using running balance formula (same as Dashboard)
    // Total cash flow = cash + online + roinet + jio + go2sms + credit + pending
    const totalCashFlow = total;
    const income = totalCashFlow - openingBalance;
    
    // Profit = closingBalance - openingBalance (after withdrawal and damages)
    const profit = closingBalance - openingBalance;
    
    records.push({
      sno: parseInt(sno),
      date: formatDateId(date),
      dateObj: date,
      prevClosing,
      capitalAdd,
      openingBalance,
      cash,
      online,
      roinet,
      jio,
      go2sms,
      credit,
      pending,
      damages,
      expense,
      total,
      withdrawal,
      closingBalance,
      income,
      profit
    });
  }
  
  return records;
}

// Import to Firestore
async function importToFirestore(records) {
  console.log(`\n📊 Total records to import: ${records.length}`);
  console.log('🚀 Starting import...\n');
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    
    try {
      // Create Firestore document
      const docData = {
        date: r.date,
        openingBalance: r.openingBalance,
        closingBalance: r.closingBalance,
        capitalAdd: r.capitalAdd,
        prevClosing: r.prevClosing,
        cash: r.cash,
        online: r.online,
        roinet: r.roinet,
        jio: r.jio,
        go2sms: r.go2sms,
        credit: r.credit,
        pending: r.pending,
        damages: r.damages,
        expense: r.expense,
        total: r.total,
        withdrawal: r.withdrawal,
        income: r.income,
        profit: r.profit,
        timestamp: Timestamp.fromDate(r.dateObj),
        importedAt: Timestamp.now()
      };
      
      // Use date as document ID
      await setDoc(doc(db, 'entries', r.date), docData);
      success++;
      
      // Progress update every 50 records
      if ((i + 1) % 50 === 0 || i === records.length - 1) {
        console.log(`✅ Progress: ${i + 1}/${records.length} records (${success} success, ${failed} failed, ${skipped} skipped)`);
      }
      
      // Small delay to avoid rate limiting
      if (i % 20 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      failed++;
      console.error(`❌ Failed: ${r.date} - ${error.message}`);
    }
  }
  
  console.log('\n🎉 Import Complete!');
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  
  process.exit(0);
}

// Main
async function main() {
  const csvPath = path.join(__dirname, 'Dynamic Daily Business Report.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    process.exit(1);
  }
  
  console.log('📂 Reading CSV file:', csvPath);
  const records = parseCSV(csvPath);
  console.log(`📋 Parsed ${records.length} valid records`);
  
  if (records.length === 0) {
    console.error('❌ No valid records found in CSV');
    process.exit(1);
  }
  
  // Show first and last record for verification
  const first = records[0];
  const last = records[records.length - 1];
  console.log(`\n📅 Date Range: ${first.date} → ${last.date}`);
  console.log(`💰 First record - Opening: ₹${first.openingBalance}, Closing: ₹${first.closingBalance}`);
  console.log(`💰 Last record  - Opening: ₹${last.openingBalance}, Closing: ₹${last.closingBalance}`);
  
  await importToFirestore(records);
}

main().catch(console.error);
