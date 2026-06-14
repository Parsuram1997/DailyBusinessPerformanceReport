
GHOST_CSS = """
        /* Ghost Privacy Toggle Button */
        #privacy-toggle-btn {
            background: transparent !important;
            border: none;
            outline: none;
            cursor: pointer;
            padding: 6px 8px;
            border-radius: 10px;
            transition: background 0.25s ease, opacity 0.25s ease;
            opacity: 0;
            pointer-events: auto;
        }
        #privacy-toggle-btn .mat-icon {
            font-size: 20px;
            color: transparent;
            transition: color 0.25s ease;
            user-select: none;
        }
        #privacy-toggle-btn:hover {
            opacity: 1;
            background: rgba(127, 19, 236, 0.07) !important;
        }
        #privacy-toggle-btn:hover .mat-icon {
            color: rgba(127, 19, 236, 0.55);
        }
        #privacy-toggle-btn.hide-mode:hover {
            background: rgba(244, 63, 94, 0.08) !important;
        }
        #privacy-toggle-btn.hide-mode:hover .mat-icon {
            color: rgba(244, 63, 94, 0.55);
        }
        .dark #privacy-toggle-btn:hover {
            background: rgba(127, 19, 236, 0.1) !important;
        }
        .dark #privacy-toggle-btn:hover .mat-icon {
            color: rgba(167, 100, 255, 0.5);
        }
        .dark #privacy-toggle-btn.hide-mode:hover .mat-icon {
            color: rgba(253, 100, 120, 0.5);
        }
"""

PRIVACY_SCRIPT = """    <!-- ====== Global Privacy / Value-Hide Toggle ====== -->
    <script>
    (function() {
        const LS_KEY  = 'biz_hide_values';
        const DIVISOR = 2;

        // Analytics page value element IDs
        const VALUE_IDS = [
            'summary-avg-income', 'summary-avg-expense', 'summary-avg-profit',
            'summary-net-profit', 'summary-total-income', 'summary-total-expense',
            'summary-total-profit', 'summary-period-capital', 'summary-total-capital',
            'summary-total-withdrawal', 'income-dist-total',
            'recon-manual-cash-card', 'recon-system-cash-card', 'recon-cash-diff-card',
            'recon-manual-online-card', 'recon-system-online-card', 'recon-online-diff-card',
            'recon-manual-income-card', 'recon-system-income-card', 'recon-income-diff-card'
        ];

        const _raw = {};
        let _observing = false;

        function isHideModeOn() {
            const v = localStorage.getItem(LS_KEY);
            return v === null ? true : v === 'true';
        }

        function parseCurrency(text) {
            if (!text || text === '...') return null;
            const n = parseFloat(text.replace(/[\u20b9,\\s]/g, ''));
            return isNaN(n) ? null : n;
        }

        function fmt(val) {
            if (typeof formatCurrency === 'function') return formatCurrency(val);
            return '\u20b9' + Math.round(val).toLocaleString('en-IN');
        }

        const observer = new MutationObserver((mutations) => {
            if (!isHideModeOn()) return;
            observer.disconnect();
            _observing = false;
            mutations.forEach(m => {
                const el = m.target.nodeType === Node.TEXT_NODE
                    ? m.target.parentElement : m.target;
                if (!el || !VALUE_IDS.includes(el.id)) return;
                const text = (el.innerText || '').trim();
                if (!text || text === '...' || !text.includes('\u20b9')) return;
                const num = parseCurrency(text);
                if (num === null) return;
                _raw[el.id] = num;
                el.innerText = fmt(num / DIVISOR);
            });
            startObserving();
        });

        function startObserving() {
            if (_observing) return;
            VALUE_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (el) observer.observe(el, { childList: true, subtree: true, characterData: true });
            });
            _observing = true;
        }

        function stopObserving() {
            observer.disconnect();
            _observing = false;
        }

        function applyHide() {
            VALUE_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const text = (el.innerText || '').trim();
                if (!text || text === '...' || !text.includes('\u20b9')) return;
                const num = parseCurrency(text);
                if (num === null) return;
                _raw[id] = num;
                el.innerText = fmt(num / DIVISOR);
            });
        }

        function applyShow() {
            VALUE_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (!el || _raw[id] === undefined) return;
                el.innerText = fmt(_raw[id]);
            });
        }

        function updateButtonUI(hideOn) {
            const btn  = document.getElementById('privacy-toggle-btn');
            const icon = document.getElementById('privacy-toggle-icon');
            if (!btn || !icon) return;
            if (hideOn) {
                btn.classList.add('hide-mode');
                icon.textContent = 'visibility_off';
                btn.title = 'Values hidden (\u00f72) \u2014 Click to show real values';
            } else {
                btn.classList.remove('hide-mode');
                icon.textContent = 'visibility';
                btn.title = 'Values visible \u2014 Click to hide';
            }
        }

        function togglePrivacy() {
            const newHide = !isHideModeOn();
            localStorage.setItem(LS_KEY, String(newHide));
            updateButtonUI(newHide);
            if (newHide) {
                applyHide();
                startObserving();
            } else {
                stopObserving();
                applyShow();
            }
        }

        document.addEventListener('DOMContentLoaded', function () {
            const btn = document.getElementById('privacy-toggle-btn');
            if (btn) btn.addEventListener('click', togglePrivacy);
            const hideOn = isHideModeOn();
            updateButtonUI(hideOn);
            if (hideOn) startObserving();
        });
    })();
    </script>"""

with open('reports-code.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add CSS before closing </style> in the first style block (after input number styles)
css_anchor = """        input[type="number"] {
            -moz-appearance: textfield;
            appearance: textfield;
        }
    </style>"""
new_css_anchor = """        input[type="number"] {
            -moz-appearance: textfield;
            appearance: textfield;
        }
""" + GHOST_CSS + """    </style>"""

if css_anchor in html:
    html = html.replace(css_anchor, new_css_anchor, 1)
    print("CSS added OK")
else:
    print("ERROR: CSS anchor not found")

# 2. Analytics page has no sticky header - the content starts right in <main>
# We need to add a header. Let's add it inside the <main> tag before the content div
old_main = """    <main class="flex-1 flex flex-col overflow-y-auto w-full pb-20 lg:pb-0">
        <div class="flex-1 overflow-y-auto p-3 md:p-8 space-y-4 md:space-y-6 pb-20 md:pb-6">"""
new_main = """    <main class="flex-1 flex flex-col overflow-y-auto w-full pb-20 lg:pb-0">
        <!-- Analytics Header with ghost privacy toggle -->
        <header class="h-16 border-b border-primary/10 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md flex items-center justify-between px-3 md:px-8 sticky top-0 z-10 shadow-sm flex-shrink-0">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-primary text-xl">bar_chart</span>
                <h2 class="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent tracking-tight">
                    <span class="hidden md:inline">Business </span>Analytics Report
                </h2>
            </div>
            <!-- Ghost Privacy Toggle Button (invisible unless hovered) -->
            <button id="privacy-toggle-btn" title="Toggle Value Privacy" aria-label="Toggle value privacy mode">
                <span class="material-symbols-outlined mat-icon" id="privacy-toggle-icon">visibility_off</span>
            </button>
        </header>
        <div class="flex-1 overflow-y-auto p-3 md:p-8 space-y-4 md:space-y-6 pb-20 md:pb-6">"""

if old_main in html:
    html = html.replace(old_main, new_main, 1)
    print("Header added OK")
else:
    print("ERROR: main anchor not found")

# 3. Add privacy script before </body>
old_end = """    <script>
        // Sync theme toggle icon/label with current theme
        (function() {
            const isDark = document.documentElement.classList.contains('dark');
            const icon = document.getElementById('theme-icon');
            const lbl = document.getElementById('theme-label');
            if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
            if (lbl) lbl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        })();
    </script>
</body>"""
new_end = """    <script>
        // Sync theme toggle icon/label with current theme
        (function() {
            const isDark = document.documentElement.classList.contains('dark');
            const icon = document.getElementById('theme-icon');
            const lbl = document.getElementById('theme-label');
            if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
            if (lbl) lbl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        })();
    </script>

""" + PRIVACY_SCRIPT + """
</body>"""

if old_end in html:
    html = html.replace(old_end, new_end, 1)
    print("Script added OK")
else:
    print("ERROR: script anchor not found")

with open('reports-code.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done! File size:", len(html))
