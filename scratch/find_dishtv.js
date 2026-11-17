const fs = require('fs');

['daily-txn.html', 'app.js', 'app-v2.js'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('DISHTV') || line.toLowerCase().includes('dishtv') || line.toLowerCase().includes('dish tv')) {
      console.log(`${file}:${i+1}: ${line.trim()}`);
    }
  });
});

