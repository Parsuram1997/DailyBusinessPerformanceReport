import os
import re

file_path = 'c:/Projects/DailyBusinessPerformanceReport/account-register-code.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Table Headers
# Insert "DOB" after "Date", and "Aadhar" after "Mobile"
content = content.replace(
    '<th class="px-5 py-4 font-semibold">Date</th>',
    '<th class="px-5 py-4 font-semibold">Date</th>\n                        <th class="px-5 py-4 font-semibold">DOB</th>'
)
content = content.replace(
    '<th class="px-5 py-4 font-semibold">Mobile</th>',
    '<th class="px-5 py-4 font-semibold">Mobile</th>\n                        <th class="px-5 py-4 font-semibold">Aadhar</th>'
)

# 2. Update Table Rows in renderAccounts
content = content.replace(
    '<td class="px-5 py-3 whitespace-nowrap">${acc.openingDate}</td>',
    '<td class="px-5 py-3 whitespace-nowrap">${acc.openingDate}</td>\n                    <td class="px-5 py-3 whitespace-nowrap">${acc.dob || \'-\'}</td>'
)
content = content.replace(
    '<td class="px-5 py-3 whitespace-nowrap">${acc.mobileNumber || \'-\'}</td>',
    '<td class="px-5 py-3 whitespace-nowrap">${acc.mobileNumber || \'-\'}</td>\n                    <td class="px-5 py-3 whitespace-nowrap">${acc.aadhar || \'-\'}</td>'
)

# 3. Update Modal HTML
# Add DOB field
dob_html = """                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">DOB</label>
                          <input type="date" id="dob"
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>"""

# Replace the start of the ID/Reference grid to inject Aadhar
aadhar_html = """                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Aadhar Number</label>
                          <input type="text" id="aadhar" placeholder="Enter Aadhar number"
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">ID/Reference Number</label>
                          <input type="text" id="idReference" placeholder="PAN/Voter ID/etc."
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nominee Name</label>"""

# Find where to inject DOB (maybe after opening date or Account Type? Let's just put DOB after mobile number instead, in a new grid row)

mobile_grid = """<label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mobile Number</label>
                          <input type="text" id="mobileNumber" placeholder="Enter mobile number"
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                  </div>"""

content = content.replace(mobile_grid, mobile_grid + '\n' + dob_html.replace('<div class="grid grid-cols-1 md:grid-cols-2 gap-5">', '<div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">').replace('<div>', '<div>') + '</div></div>')

id_ref_html = """                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">ID/Reference Number</label>
                          <input type="text" id="idReference" placeholder="Aadhar/PAN/etc."
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nominee Name</label>"""

content = content.replace(id_ref_html, aadhar_html)

# 4. JS JS JS Update
content = content.replace(
    "document.getElementById('mobileNumber').value = acc.mobileNumber || '';",
    "document.getElementById('mobileNumber').value = acc.mobileNumber || '';\n                document.getElementById('dob').value = acc.dob || '';\n                document.getElementById('aadhar').value = acc.aadhar || '';"
)

content = content.replace(
    "document.getElementById('openingDate').valueAsDate = new Date();",
    "document.getElementById('openingDate').valueAsDate = new Date();\n            document.getElementById('dob').value = '';\n            document.getElementById('aadhar').value = '';"
)

content = content.replace(
    "mobileNumber: document.getElementById('mobileNumber').value,",
    "mobileNumber: document.getElementById('mobileNumber').value,\n            dob: document.getElementById('dob').value,\n            aadhar: document.getElementById('aadhar').value,"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched completely.")
