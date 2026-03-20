const fs = require('fs');
const path = require('path');

const basedir = "d:/BusinessPerformance";
const ObjectFiles = fs.readdirSync(basedir).filter(f => f.endsWith('.html'));

for (const f of ObjectFiles) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    // Check if it already has padding-top added by us to avoid double adding
    if (content.includes('padding-top: 1.5rem !important;')) {
        console.log(`Skipping ${f}, already has top padding.`);
        continue;
    }
    
    // We add padding-top: 1.5rem !important; to #sidebar .sidebar-logo-container
    let updated = content.replace(
        /#sidebar \.sidebar-logo-container \{ justify-content: center !important; padding-left: 0 !important; padding-right: 0 !important;/g,
        '#sidebar .sidebar-logo-container { padding-top: 1.5rem !important; justify-content: center !important; padding-left: 0 !important; padding-right: 0 !important;'
    );
    
    updated = updated.replace(
        /#sidebar:hover \.sidebar-logo-container \{ justify-content: flex-start !important; padding-left: 1\.5rem !important; padding-right: 1\.5rem !important;/g,
        '#sidebar:hover .sidebar-logo-container { padding-top: 1.5rem !important; justify-content: flex-start !important; padding-left: 1.5rem !important; padding-right: 1.5rem !important;'
    );
    
    if (updated !== content) {
        fs.writeFileSync(p, updated, 'utf-8');
        console.log(`Updated padding in ${f}`);
    } else {
        console.log(`No match for CSS rules in ${f}`);
    }
}
