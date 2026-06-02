const fs = require('fs');
['d:/BusinessPerformance/add-entry-code.html', 'd:/BusinessPerformance/cash-calculator-code.html'].forEach(file => {
    let html = fs.readFileSync(file, 'utf8');
    if (!html.includes('sweetalert2')) {
        html = html.replace('</head>', '    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>\n</head>');
        fs.writeFileSync(file, html);
        console.log('Added SweetAlert to ' + file);
    }
});
