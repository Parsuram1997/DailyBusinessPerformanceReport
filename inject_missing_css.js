const fs = require('fs');
const path = require('path');

const basedir = "d:/BusinessPerformance";
const files = ['add-entry-code.html', 'cash-calculator-code.html', 'credit-ledger-code.html'];

const newCss = `
    <style>
        /* Sidebar Hover Expansion Styles */
        #sidebar { 
            width: 5.5rem !important; /* Default collapsed */
            overflow: hidden;
            white-space: nowrap;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        #sidebar:hover { 
            width: 16rem !important; /* Expanded w-64 */
            box-shadow: 4px 0 15px rgba(0,0,0,0.03);
        }
        
        /* Center icons when collapsed */
        #sidebar .sidebar-logo-container { padding-top: 1.5rem !important; justify-content: center !important; padding-left: 0 !important; padding-right: 0 !important; transition: all 0.3s; }
        #sidebar .nav-link { justify-content: center !important; padding-left: 0 !important; padding-right: 0 !important; transition: all 0.3s; margin-left: auto; margin-right: auto; }
        #sidebar .toggle-container { display: none !important; } /* Hide the toggle button permanently */

        /* Restore alignment on hover */
        #sidebar:hover .sidebar-logo-container { padding-top: 1.5rem !important; justify-content: flex-start !important; padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
        #sidebar:hover .nav-link { justify-content: flex-start !important; padding-left: 1rem !important; padding-right: 1rem !important; margin-left: 0; margin-right: 0; }
        
        /* Fade texts in/out */
        #sidebar .sidebar-text, 
        #sidebar .nav-text { 
            opacity: 0; 
            transform: translateX(-10px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            display: inline-block;
            width: 0;
            overflow: hidden;
        }
        
        #sidebar:hover .sidebar-text, 
        #sidebar:hover .nav-text { 
            opacity: 1; 
            transform: translateX(0);
            transition: opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s;
            width: auto;
            margin-left: 0.75rem;
        }
    </style>
`;

for (const f of files) {
    const p = path.join(basedir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    if (!content.includes('/* Sidebar Hover Expansion Styles */')) {
        content = content.replace('</head>', newCss + '</head>');
        fs.writeFileSync(p, content, 'utf-8');
        console.log(`Injected style block into ${f}`);
    } else {
        console.log(`Already injected in ${f}`);
    }
}
