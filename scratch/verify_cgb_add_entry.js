const fs = require('fs');

const html = fs.readFileSync('add-entry-code.html', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');
const appV2Js = fs.readFileSync('app-v2.js', 'utf8');

const htmlChecks = [
  'id="open-cgb-split-btn"',
  'id="cgb-split-modal"',
  'id="cgb_1"',
  'id="cgb_2"',
  'id="diff-cgb_1"',
  'id="diff-cgb_2"',
  'id="expected-cgb_1"',
  'id="expected-cgb_2"',
  'id="expected-cgb-split-total-display"',
  'id="cgb-split-total-display"',
  'id="cgb-split-diff-display"',
  'id="use-cgb-amount-btn"',
  'checkDiffValidation(\'use-cgb-amount-btn\''
];

console.log('--- Verifying add-entry-code.html ---');
htmlChecks.forEach(check => {
  const ok = html.includes(check);
  console.log(`  ${check}: ${ok ? 'PASSED' : 'FAILED'}`);
  if (!ok) process.exit(1);
});

const jsChecks = [
  'updateCgbSplitTotal',
  'expected-cgb-split-total-display',
  'expected-cgb_1',
  'cgb_1',
  'cgb_2',
  'use-cgb-amount-btn'
];

console.log('--- Verifying app.js ---');
jsChecks.forEach(check => {
  const ok = appJs.includes(check);
  console.log(`  ${check}: ${ok ? 'PASSED' : 'FAILED'}`);
  if (!ok) process.exit(1);
});

console.log('--- Verifying app-v2.js ---');
jsChecks.forEach(check => {
  const ok = appV2Js.includes(check);
  console.log(`  ${check}: ${ok ? 'PASSED' : 'FAILED'}`);
  if (!ok) process.exit(1);
});

console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');

