const fs = require('fs');
['app.js', 'app-v2.js'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('SYNC') || line.includes('sync-btn') || line.includes('sync') && line.includes('button')) {
      console.log(`${file}:${i+1}: ${line.trim()}`);
    }
  });
});

