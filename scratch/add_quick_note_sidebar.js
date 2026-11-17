const fs = require('fs');

const pages = [
  'dashboard-code.html',
  'add-entry-code.html',
  'daily-txn.html',
  'transactions-code.html',
  'reports-code.html',
  'credit-ledger-code.html',
  'account-register-code.html',
  'customer-deposit-code.html',
  'pending-code.html',
  'bank-withdrawals-code.html',
  'settings-code.html'
];

const quickNoteLink = `                    <a class="nav-link flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors" href="quick-note-code.html" data-page="quick-note-code.html">
                        <span class="material-symbols-outlined text-[20px]">sticky_note_2</span>
                        <span class="text-sm nav-text">Quick Note</span>
                    </a>`;

pages.forEach(file => {
  if (!fs.existsSync(file)) return;
  let raw = fs.readFileSync(file, 'utf8');
  if (raw.includes('quick-note-code.html')) {
    console.log(`${file} already has quick-note link.`);
    return;
  }

  const isCrlf = raw.includes('\r\n');
  let content = raw.replace(/\r\n/g, '\n');

  // Find a good anchor to insert after: e.g. bank-withdrawals-code.html link
  const anchorBankRegex = /(<a[^>]*href=["']bank-withdrawals-code\.html["'][^>]*>[\s\S]*?<\/a>)/;
  const anchorAccRegex = /(<a[^>]*href=["']account-register-code\.html["'][^>]*>[\s\S]*?<\/a>)/;

  if (anchorBankRegex.test(content)) {
    content = content.replace(anchorBankRegex, `$1\n${quickNoteLink}`);
    console.log(`Added quick-note after Bank Cashout in ${file}`);
  } else if (anchorAccRegex.test(content)) {
    content = content.replace(anchorAccRegex, `$1\n${quickNoteLink}`);
    console.log(`Added quick-note after Acc Register in ${file}`);
  } else {
    console.log(`Could not find anchor in ${file}`);
  }

  if (isCrlf) content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(file, content, 'utf8');
});

