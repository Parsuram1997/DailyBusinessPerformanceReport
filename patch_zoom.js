const fs = require('fs');
const path = require('path');

const dir = 'd:/BusinessPerformance';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const injection = `
    <style>
        /* Prevent double-tap to zoom */
        * { touch-action: manipulation; }
        /* Prevent input focus zoom on iOS */
        @media screen and (max-width: 767px) {
            input, select, textarea { font-size: 16px !important; }
        }
    </style>
    <script>
        // Prevent pinch-zoom on iOS
        document.addEventListener('touchmove', function(event) {
            if (event.scale !== undefined && event.scale !== 1) { 
                event.preventDefault(); 
            }
        }, { passive: false });
    </script>
</head>`;

files.forEach(f => {
    const p = path.join(dir, f);
    let content = fs.readFileSync(p, 'utf8');
    
    // Check if already injected
    if (!content.includes('Prevent double-tap to zoom')) {
        content = content.replace('</head>', injection);
        fs.writeFileSync(p, content);
        console.log('Injected into', f);
    }
});
