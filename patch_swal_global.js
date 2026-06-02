const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

const GLOBAL_STYLE = `
// Inject global SweetAlert2 mobile row style
if (typeof document !== 'undefined') {
    const swalStyle = document.createElement('style');
    swalStyle.innerHTML = \`
        @media (max-width: 640px) {
            div.swal2-actions {
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                width: 100% !important;
                padding: 0 1rem !important;
                box-sizing: border-box !important;
            }
            div.swal2-actions button {
                flex: 1 1 0% !important;
                margin: 0 0.25rem !important;
                width: 100% !important;
                font-size: 0.85rem !important;
                padding: 0.75rem 0.25rem !important;
            }
        }
    \`;
    document.head.appendChild(swalStyle);
}
`;

// Insert it at the top of app.js after imports
appJs = appJs.replace(/(import .*;\n)+/, match => match + GLOBAL_STYLE);

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('Added global swal style');
