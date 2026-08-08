import re

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = """    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('openingDate').valueAsDate = new Date();
            document.getElementById('dob').value = '';
            document.getElementById('aadhar').value = '';
        loadAccounts();
        document.getElementById('searchInput').addEventListener('input', renderAccounts);
        document.getElementById('statusFilter').addEventListener('change', renderAccounts);
    });"""

new = """    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('openingDate').valueAsDate = new Date();
        document.getElementById('dob').value = '';
        document.getElementById('aadhar').value = '';
        loadAccounts();
        document.getElementById('searchInput').addEventListener('input', window.renderAccounts);
        document.getElementById('statusFilter').addEventListener('change', window.renderAccounts);
        document.getElementById('accountForm').addEventListener('submit', window.saveAccount);
    });"""

if old in content:
    content = content.replace(old, new)
    with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed: added accountForm submit listener")
else:
    print("Could not find DOMContentLoaded block to patch")
    # Try to find approximate location
    idx = content.find("document.getElementById('openingDate').valueAsDate = new Date()")
    print("openingDate line at:", idx)
    print(content[idx-200:idx+400])
