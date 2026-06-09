const fs = require('fs');
const lines = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('function renderAccounts'));
for(let i=start; i<start+50; i++) {
    if(lines[i] && lines[i].includes('class="px-5')) {
        console.log(lines[i].trim());
    }
}
