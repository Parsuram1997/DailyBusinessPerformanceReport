const fs = require('fs');
const path = require('path');
const basedir = "d:/BusinessPerformance";

const files = fs.readdirSync(basedir).filter(f => f.endsWith('.html'));
const regex = /<a[^>]*href="cash-calculator-code\.html"[^>]*>[\s\S]*?<\/a>\s*/gm;

for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    if (regex.test(content)) {
        content = content.replace(regex, '');
        fs.writeFileSync(p, content, 'utf-8');
        console.log(`Deleted cash calculator link from ${f}`);
    }
}
