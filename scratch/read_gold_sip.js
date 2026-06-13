const fs = require('fs');

let buffer = fs.readFileSync('../entries.json');
let content;
if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.toString('utf16le');
} else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    content = buffer.toString('utf16be');
} else {
    content = buffer.toString('utf8');
}

// Strip BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
}

// In case it's not a single JSON array but newline-delimited or contains some other formatting,
// let's do a safe parse or search.
try {
    const data = JSON.parse(content);
    const goldSipTxns = data.filter(t => t.type === 'GOLD_SIP');
    console.log('Found ' + goldSipTxns.length + ' GOLD_SIP transactions:');
    goldSipTxns.slice(0, 5).forEach(t => console.log(JSON.stringify(t, null, 2)));
} catch (e) {
    console.log('JSON Parse failed, showing first 500 characters:');
    console.log(content.substring(0, 500));
}
