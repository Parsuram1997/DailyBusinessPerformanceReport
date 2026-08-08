with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix all onclick calls to use window. prefix since functions are in module scope
replacements = [
    ('onclick="openModal()"', 'onclick="window.openModal()"'),
    ("onclick='openModal()'", "onclick='window.openModal()'"),
    ('onclick="closeModal()"', 'onclick="window.closeModal()"'),
    ("onclick='closeModal()'", "onclick='window.closeModal()'"),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print(f"Replaced: {old} -> {new}")
    else:
        print(f"Not found: {old}")

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
