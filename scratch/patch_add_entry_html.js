const fs = require('fs');

let raw = fs.readFileSync('add-entry-code.html', 'utf8');
const isCrlf = raw.includes('\r\n');
let html = raw.replace(/\r\n/g, '\n');

// 1. Replace CGB BC field to add split button and change icon
const oldCgbField = `            <!-- CGB BC Field -->
            <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <span class="material-symbols-outlined text-primary text-xs">sms</span> CGB BC
                </label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none select-none">₹</span>
                    <input id="go2sms" name="go2sms" class="w-full pl-8 pr-4 py-2 rounded-xl text-sm font-semibold border border-primary/20 bg-slate-50 dark:bg-background-dark/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-800 dark:text-slate-100 shadow-inner" placeholder="0.00" type="number"/>
                </div>
            </div>`;

const newCgbField = `            <!-- CGB BC Field -->
            <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <span class="material-symbols-outlined text-primary text-xs">account_balance</span> CGB BC
                </label>
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none select-none">₹</span>
                    <input id="go2sms" name="go2sms" class="w-full pl-8 pr-10 py-2 rounded-xl text-sm font-semibold border border-primary/20 bg-slate-50 dark:bg-background-dark/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-800 dark:text-slate-100 shadow-inner" placeholder="0.00" type="number"/>
                    <button type="button" id="open-cgb-split-btn" class="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:bg-primary/10 rounded-lg p-1 transition-colors flex items-center justify-center" title="Split CGB BC Balances">
                        <span class="material-symbols-outlined text-base">splitscreen</span>
                    </button>
                </div>
            </div>`;

if (!html.includes(oldCgbField)) {
    console.error('Could not find oldCgbField!');
    process.exit(1);
}
html = html.replace(oldCgbField, newCgbField);

// 2. Add CGB BC Details Modal after roinet-split-modal
const cgbModal = `
<!-- CGB BC Details Modal -->
<div id="cgb-split-modal" class="fixed inset-0 z-[100] hidden items-center justify-center p-4 sm:p-0">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" id="cgb-split-backdrop"></div>
    
    <!-- Modal Content -->
    <div class="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-primary/20 w-full max-w-md transform scale-95 opacity-0 transition-all duration-300 flex flex-col max-h-[90vh]" id="cgb-split-panel">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-primary/10 flex-shrink-0">
            <div class="flex items-center gap-3">
                <div class="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined">account_balance</span>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">CGB BC Sub-Accounts</h3>
                    <p class="text-xs text-slate-500 font-medium">Split amounts across CGB BC IDs</p>
                </div>
            </div>
            <button type="button" id="close-cgb-split-btn" class="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>

        <!-- Body inputs -->
        <div class="px-5 py-4 space-y-3 overflow-y-auto">
            <!-- CGB BC 1 (Parsu) -->
            <div class="flex flex-col">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <span class="material-symbols-outlined text-[15px] text-primary">account_balance</span> CGB BC (Parsu)
                    </label>
                    <div class="flex items-center gap-2">
                        <span id="diff-cgb_1" class="text-[10px] font-bold hidden"></span>
                        <span id="expected-cgb_1" class="text-[10px] font-bold text-slate-500">Expected: ₹ 0.00</span>
                    </div>
                </div>
                <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <input id="cgb_1" name="cgb_1" type="number" class="cgb-split-input w-full pl-7 pr-3 py-1.5 rounded-lg border border-primary/20 bg-background-light dark:bg-background-dark/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-semibold text-sm" placeholder="0.00">
                </div>
            </div>
            <!-- CGB BC 2 (Dalai) -->
            <div class="flex flex-col">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <span class="material-symbols-outlined text-[15px] text-primary">account_balance</span> CGB BC (Dalai)
                    </label>
                    <div class="flex items-center gap-2">
                        <span id="diff-cgb_2" class="text-[10px] font-bold hidden"></span>
                        <span id="expected-cgb_2" class="text-[10px] font-bold text-slate-500">Expected: ₹ 0.00</span>
                    </div>
                </div>
                <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <input id="cgb_2" name="cgb_2" type="number" class="cgb-split-input w-full pl-7 pr-3 py-1.5 rounded-lg border border-primary/20 bg-background-light dark:bg-background-dark/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-semibold text-sm" placeholder="0.00">
                </div>
            </div>
        </div>

        <!-- Total and Actions -->
        <div class="p-6 bg-primary/5 border-t border-primary/10 rounded-b-3xl space-y-4 flex-shrink-0">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Total</span>
                <span id="expected-cgb-split-total-display" class="text-sm font-bold text-slate-500 font-mono">₹ 0.00</span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Entered Total</span>
                <span id="cgb-split-total-display" class="text-2xl font-black text-primary font-mono select-all">₹ 0.00</span>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-primary/10">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Difference</span>
                <span id="cgb-split-diff-display" class="text-sm font-black text-slate-400 font-mono">₹ 0.00</span>
            </div>
            <button type="button" id="use-cgb-amount-btn" class="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <span class="material-symbols-outlined">check_circle</span> Use This Amount
            </button>
        </div>
    </div>
</div>
`;

const roinetModalEnd = `            <button type="button" id="use-roinet-amount-btn" class="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <span class="material-symbols-outlined">check_circle</span> Use This Amount
            </button>
        </div>
    </div>
</div>`;

if (!html.includes(roinetModalEnd)) {
    console.error('Could not find roinetModalEnd!');
    process.exit(1);
}
html = html.replace(roinetModalEnd, roinetModalEnd + '\n' + cgbModal);

// 3. Update validation script at bottom
const oldNameMap = `                            var nameMap = {
                                'online_p1': 'Online(Parsu)',
                                'online_p2': 'Online(Shop)',
                                'online_p3': 'Online(Dalai)',
                                'roinet_1': 'Roinet(Parsu)',
                                'roinet_2': 'Roinet(Dalai)',
                                'airtel_1': 'Airtel(Parsu)',
                                'airtel_2': 'Airtel(Dalai)',
                                'spicemoney': 'SpiceMoney'
                            };`;

const newNameMap = `                            var nameMap = {
                                'online_p1': 'Online(Parsu)',
                                'online_p2': 'Online(Shop)',
                                'online_p3': 'Online(Dalai)',
                                'roinet_1': 'Roinet(Parsu)',
                                'roinet_2': 'Roinet(Dalai)',
                                'airtel_1': 'Airtel(Parsu)',
                                'airtel_2': 'Airtel(Dalai)',
                                'spicemoney': 'SpiceMoney',
                                'cgb_1': 'CGB BC (Parsu)',
                                'cgb_2': 'CGB BC (Dalai)'
                            };`;

const oldChecks = `        checkDiffValidation('use-online-amount-btn', ['online_p1', 'online_p2', 'online_p3'], 'validate_online_diff');
        checkDiffValidation('use-roinet-amount-btn', ['roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney'], 'validate_csp_diff');`;

const newChecks = `        checkDiffValidation('use-online-amount-btn', ['online_p1', 'online_p2', 'online_p3'], 'validate_online_diff');
        checkDiffValidation('use-roinet-amount-btn', ['roinet_1', 'roinet_2', 'airtel_1', 'airtel_2', 'spicemoney'], 'validate_csp_diff');
        checkDiffValidation('use-cgb-amount-btn', ['cgb_1', 'cgb_2'], 'validate_csp_diff');`;

if (!html.includes(oldNameMap) || !html.includes(oldChecks)) {
    console.error('Could not find oldNameMap or oldChecks!');
    process.exit(1);
}
html = html.replace(oldNameMap, newNameMap).replace(oldChecks, newChecks);

if (isCrlf) {
    html = html.replace(/\n/g, '\r\n');
}

fs.writeFileSync('add-entry-code.html', html, 'utf8');
console.log('Successfully patched add-entry-code.html!');
