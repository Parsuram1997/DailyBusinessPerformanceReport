with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove old DOB block
old_dob_block = """                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <div>
                          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">DOB</label>
                          <input type="date" id="dob"
                              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                      </div>
                  </div>"""

if old_dob_block in content:
    content = content.replace(old_dob_block, '')
else:
    print("Could not find old DOB block")

# 2. Modify Account Holder Name
old_holder = """                <div>
                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Account Holder Name</label>
                    <input type="text" id="accountHolderName" required placeholder="Enter full name"
                        class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                </div>"""

new_holder = """                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Account Holder Name</label>
                        <input type="text" id="accountHolderName" required placeholder="Enter full name"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">DOB</label>
                        <input type="date" id="dob"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                </div>"""

if old_holder in content:
    content = content.replace(old_holder, new_holder)
else:
    print("Could not find Account Holder Name block")

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Moved DOB field next to Account Holder Name")
