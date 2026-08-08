with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Check the Open New Account button - get more before
idx = content.find('Open New Account')
print("Button HTML (wider):")
print(content[idx-400:idx+200])
