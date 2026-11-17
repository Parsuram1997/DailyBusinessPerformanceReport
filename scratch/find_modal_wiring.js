const fs = require('fs');

['add-entry-code.html', 'app.js', 'app-v2.js'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('roinet-split-modal') || line.includes('open-roinet-split-btn') || line.includes('open-online-split-btn') || line.includes('online-split-modal')) {
      console.log(`${file}:${i+1}: ${line.trim()}`);
    }
  });
});

