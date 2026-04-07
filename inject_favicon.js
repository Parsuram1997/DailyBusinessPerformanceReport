const fs = require('fs');
const path = require('path');
const basedir = "d:/BusinessPerformance";
const files = fs.readdirSync(basedir).filter(f => f.endsWith('.html'));

const faviconTag = '<link rel="icon" type="image/png" href="favicon.png"/>';

for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    if (content.includes('href="favicon.png"')) {
        continue;
    }
    
    // Inject just before </head>
    content = content.replace('</head>', `    ${faviconTag}\n</head>`);
    fs.writeFileSync(p, content, 'utf-8');
    console.log(`Injected favicon into ${f}`);
}
