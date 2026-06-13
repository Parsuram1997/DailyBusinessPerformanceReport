const fs = require('fs');
const content = fs.readFileSync('../app.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('chargesAccount') || line.includes('charges-account') || line.includes('txnChargesAccount')) {
        if (index > 6000 && index < 7500) {
            console.log((index + 1) + ': ' + line.trim());
        }
    }
});
