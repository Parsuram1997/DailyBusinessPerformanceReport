import os
import glob
import re

html_files = glob.glob('c:/Projects/DailyBusinessPerformanceReport/*.html')

new_link = """                <a class="nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary/5 transition-colors"
                    href="account-register-code.html" data-page="account-register-code.html">
                    <span class="material-symbols-outlined">menu_book</span>
                    <span class="text-sm nav-text">Account Register</span>
                </a>"""

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'href="account-register-code.html"' not in content:
        # Find the block for credit ledger to inject after it
        # Try to find exactly <a class="..." href="credit-ledger-code.html" ... </a>
        match = re.search(r'(<a[^>]*href="credit-ledger-code\.html"[^>]*>.*?</a>)', content, re.DOTALL)
        if match:
            new_content = content[:match.end()] + '\n' + new_link + content[match.end():]
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Patched {os.path.basename(file)}")
        else:
            print(f"Could not find credit ledger link in {os.path.basename(file)}")
    else:
        print(f"Already patched {os.path.basename(file)}")
