const fs = require('fs');
const content = fs.readFileSync('app-v2.js', 'utf8');
const lines = content.split('\n');

console.log('Total lines in app-v2.js:', lines.length);

const targets = [
  'const opRoinet1 =',
  'const ALL_SYNC_FIELDS =',
  'const lockAutoSyncedFields =',
  '// Expected Roinet Split Total',
  'const roinetSplitModal =',
  'checkDifferences([\'roinet_1\'',
  'details[id] = parseFloat(el.value);'
];

targets.forEach(t => {
  lines.forEach((l, i) => {
    if (l.includes(t)) console.log(`Found "${t}" at line ${i+1}`);
  });
});

