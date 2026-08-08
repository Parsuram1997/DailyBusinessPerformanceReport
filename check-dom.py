with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()
print("dob present:", 'id="dob"' in content)
print("aadhar present:", 'id="aadhar"' in content)
