import re

file_path = 'c:/Projects/DailyBusinessPerformanceReport/account-register-code.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'<script type="module">(.*?)</script>', content, re.DOTALL)
if match:
    with open('c:/Projects/DailyBusinessPerformanceReport/temp-script.js', 'w', encoding='utf-8') as fw:
        fw.write(match.group(1))
    print("Extracted to temp-script.js")
else:
    print("Could not find module script")
