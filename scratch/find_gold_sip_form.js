const fs = require('fs');

function findGoldSipInFunc(filename) {
    console.log('=== ' + filename + ' ===');
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('GOLD_SIP')) {
            console.log((index + 1) + ': ' + line.trim());
        }
    });
}

findGoldSipInFunc('../app.js');
