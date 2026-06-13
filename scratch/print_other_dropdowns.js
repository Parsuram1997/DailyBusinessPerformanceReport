const fs = require('fs');
const content = fs.readFileSync('../daily-txn.html', 'utf8');

function printDropdown(id) {
    const start = content.indexOf('id="' + id + '"');
    if (start === -1) {
        console.log(id + ' not found');
        return;
    }
    const end = content.indexOf('</select>', start);
    console.log(content.substring(start, end + 9));
}

printDropdown('txn-receivedin');
printDropdown('txn-charges-account');
printDropdown('txn-qr-wallet');
