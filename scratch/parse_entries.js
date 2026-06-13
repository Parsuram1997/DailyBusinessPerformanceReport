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

const term = 'GOLD_SIP';
const idx = content.indexOf(term);
if (idx !== -1) {
    console.log('Found ' + term + ' at index ' + idx);
    console.log(content.substring(idx - 200, idx + 500));
} else {
    console.log('Term ' + term + ' not found in raw content.');
}
