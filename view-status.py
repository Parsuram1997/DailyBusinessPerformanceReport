import re

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('Nominee Name</label>')
print(content[idx-300:idx+800])
