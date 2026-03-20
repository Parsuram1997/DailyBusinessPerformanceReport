const fs = require('fs');
const path = require('path');

const basedir = "d:/BusinessPerformance";
const files = fs.readdirSync(basedir).filter(f => f.endsWith('.html'));

const additionalCSS = `
        /* Hide number input arrows */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        input[type="number"] {
            -moz-appearance: textfield;
        }
`;

for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    // Check if we already applied this fix
    if (content.includes('Hide number input arrows')) {
        console.log(`Skipping ${f}, already has hidden number input spinners.`);
        continue;
    }
    
    // Insert just before the closing </style>
    if (content.includes('</style>')) {
        content = content.replace('</style>', additionalCSS + '\n    </style>');
        fs.writeFileSync(p, content, 'utf-8');
        console.log(`Added spinner CSS to ${f}`);
    } else {
        console.log(`No closing style tag found in ${f}`);
    }
}
