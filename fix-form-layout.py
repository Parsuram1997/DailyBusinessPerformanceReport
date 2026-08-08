import re

with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract from <form id="accountForm" ...> to </form>
start_idx = content.find('<form id="accountForm"')
end_idx = content.find('</form>', start_idx) + len('</form>')

if start_idx != -1 and end_idx != -1:
    new_form_html = """<form id="accountForm" class="space-y-6">
                <!-- Row 1: Account Number & Opening Date -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Account Number</label>
                        <input type="text" id="accountNumber" readonly required
                            class="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium dark:text-white cursor-not-allowed">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Opening Date</label>
                        <input type="date" id="openingDate" required
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                </div>

                <!-- Row 2: Account Holder Name & DOB -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                </div>

                <!-- Row 3: Account Type & Mobile Number -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Account Type</label>
                        <select id="accountType" required
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                            <option value="">Select Type</option>
                            <option value="Savings">Savings</option>
                            <option value="Current">Current</option>
                            <option value="Fixed Deposit">Fixed Deposit</option>
                            <option value="Recurring Deposit">Recurring Deposit</option>
                            <option value="Loan">Loan</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mobile Number</label>
                        <input type="tel" id="mobileNumber" required placeholder="Enter mobile number" pattern="[0-9]{10}"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                </div>

                <!-- Row 4: Address -->
                <div>
                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Address</label>
                    <input type="text" id="address" required placeholder="Enter address details"
                        class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                </div>

                <!-- Row 5: Aadhar & ID/Reference Number -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                <!-- Row 6: Nominee Name & Status -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nominee Name</label>
                        <input type="text" id="nomineeName" placeholder="Enter nominee name"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
                        <select id="status" required
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all">
                            <option value="Active">Active</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>
                </div>

                <!-- Row 7: Remarks -->
                <div>
                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Remarks</label>
                    <textarea id="remarks" rows="2" placeholder="Any additional notes..."
                        class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary dark:text-white transition-all resize-none"></textarea>
                </div>

                <!-- Form Actions -->
                <div class="pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-3">
                    <button type="button" onclick="closeModal()"
                        class="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" id="saveAccountBtn"
                        class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:ring-4 focus:ring-primary/20 transition-all shadow-lg shadow-primary/30">
                        Save Account
                    </button>
                </div>
            </form>"""
    
    content = content[:start_idx] + new_form_html + content[end_idx:]
    
    with open('c:/Projects/DailyBusinessPerformanceReport/account-register-code.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Form replaced successfully")
else:
    print("Could not find form boundaries")
