import re

NEW_SCRIPT = '''    <!-- ====== Global Privacy / Value-Hide Toggle ====== -->
    <script>
    (function() {
        const LS_KEY  = 'biz_hide_values';
        const DIVISOR = 2;

        const VALUE_IDS = [
            'total-income-top', 'total-expense-top', 'total-profit-top',
            'closing-balance-top', 'total-capital-top', 'total-withdrawals-top',
            'today-income-top', 'today-expense-top', 'today-profit-top',
            'this-month-income-top', 'this-month-expense-top', 'this-month-profit-top',
            'mom-today-income', 'mom-today-expense', 'mom-today-profit',
            'mom-last-income', 'mom-last-expense', 'mom-last-profit',
            'mtd-current-income', 'mtd-current-expense', 'mtd-current-profit',
            'mtd-last-income', 'mtd-last-expense', 'mtd-last-profit',
            'proj-monthly', 'proj-quarterly', 'proj-yearly',
            'proj-monthly-exp', 'proj-quarterly-exp', 'proj-yearly-exp',
            'proj-monthly-profit', 'proj-quarterly-profit', 'proj-yearly-profit'
        ];

        // Raw numeric originals - NEVER cleared, persist across all toggles
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

        // MutationObserver intercepts fresh values written by app.js
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
                _raw[el.id] = num;           // save real value
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

        // ONE click = hide, NEXT click = unhide (simple flip)
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
    </script>'''

with open('dashboard-code.html', 'r', encoding='utf-8') as f:
    html = f.read()

start_marker = '    <!-- ====== Global Privacy / Value-Hide Toggle ====== -->'
end_marker = '    </script>\n</body>'

si = html.find(start_marker)
ei = html.find(end_marker, si)

if si == -1 or ei == -1:
    print('ERROR: markers not found')
    exit(1)

# Replace from start_marker to end_marker (exclusive - keep </body> etc.)
new_html = html[:si] + NEW_SCRIPT + '\n</body>\n\n</html>\n'

with open('dashboard-code.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print('SUCCESS: replaced', ei - si, 'chars with', len(NEW_SCRIPT), 'chars. New size:', len(new_html))
