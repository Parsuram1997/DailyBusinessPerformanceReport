const fs = require('fs');
const path = require('path');

const basedir = "d:/BusinessPerformance";
const files = fs.readdirSync(basedir).filter(f => f.endsWith('.html'));

for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    // Replace various specific dollar sign patterns
    content = content.replace(/>\$</g, '>₹<');
    content = content.replace(/>\+\$</g, '>+₹<');
    content = content.replace(/>-\$</g, '>-₹<');
    content = content.replace(/\(\$/g, '(₹');
    content = content.replace(/>\$(\d)/g, '>₹$1'); // Matches >$123
    content = content.replace(/"\$"/g, '"₹"'); // Matches "$" (in attributes or JS strings within HTML)
    
    fs.writeFileSync(p, content, 'utf-8');
    console.log(`Replaced $ with ₹ in ${f}`);
}
