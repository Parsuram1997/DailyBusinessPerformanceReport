const fs = require('fs');
const content = fs.readFileSync('quick-note-code.html', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('pinnedNotesGrid') || l.includes('allNotesGrid') || l.includes('note-card') || l.includes('COLOR_MAP')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});

