with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace label and placeholder
content = content.replace('ID/Reference Number', 'Reference Number')
content = content.replace('PAN/Voter ID/etc.', 'Enter reference number')

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
