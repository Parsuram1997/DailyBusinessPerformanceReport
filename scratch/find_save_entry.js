const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('daily_entries') || line.includes('daily_reports') || line.includes('daily_records') || line.includes('dailyEntry') || line.includes('Save Entry') || line.includes('entryForm')) {
    if (i < 3000) console.log(`${i+1}: ${line.trim()}`);
  }
});

