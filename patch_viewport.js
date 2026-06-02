const fs = require('fs');
const path = require('path');

const dir = 'd:/BusinessPerformance';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const regex1 = /<meta content="width=device-width, initial-scale=1\.0" name="viewport"\s*\/>/g;
const regex2 = /<meta name="viewport" content="width=device-width, initial-scale=1\.0"\s*>/g;

const replacement = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />';

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content.replace(regex1, replacement).replace(regex2, replacement);
    
    // Also handle slightly different formats if any
    updated = updated.replace(/<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"\s*\/>/g, replacement);

    if (content !== updated) {
        fs.writeFileSync(filePath, updated);
        console.log('Updated', file);
    }
});
