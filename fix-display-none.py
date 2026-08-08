with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('style="display:none;"', '')

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed display:none")
