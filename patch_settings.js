const fs = require('fs');
let html = fs.readFileSync('d:/BusinessPerformance/settings-code.html', 'utf8');

const HTML_BLOCK = `        <!-- Validation Controls -->
        <div class="pt-4 border-t border-primary/5">
            <p class="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Validation Controls</p>
            <div class="flex items-center justify-end gap-3 mt-3 mb-2 pr-1">
                <span class="text-[10px] font-black uppercase tracking-widest text-purple-600 w-10 text-center">Admin</span>
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 w-10 text-center">User</span>
            </div>
        </div>

        <!-- Validate Cash Diff Limit -->
        <div class="flex items-center justify-between p-4 rounded-xl border border-rose-100 bg-rose-50 dark:bg-rose-500/5 dark:border-rose-500/20">
            <div class="flex items-center gap-3 flex-1 min-w-0 mr-4">
                <span class="material-symbols-outlined text-rose-600 shrink-0">rule</span>
                <div>
                    <p class="font-bold text-sm">Validate Cash Diff Limit</p>
                    <p class="text-xs text-slate-500">Prevent saving if Cash difference is > 5000.</p>
                </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="toggle-validate-cash-diff" class="sr-only peer">
                    <div class="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="user-toggle-validate-cash-diff" class="sr-only peer">
                    <div class="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
            </div>
        </div>

        <!-- Validate Online Diff Limit -->
        <div class="flex items-center justify-between p-4 rounded-xl border border-rose-100 bg-rose-50 dark:bg-rose-500/5 dark:border-rose-500/20">
            <div class="flex items-center gap-3 flex-1 min-w-0 mr-4">
                <span class="material-symbols-outlined text-rose-600 shrink-0">rule</span>
                <div>
                    <p class="font-bold text-sm">Validate Online Diff Limit</p>
                    <p class="text-xs text-slate-500">Prevent saving if Online difference is > 5000.</p>
                </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="toggle-validate-online-diff" class="sr-only peer">
                    <div class="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="user-toggle-validate-online-diff" class="sr-only peer">
                    <div class="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
            </div>
        </div>

        <!-- Validate CSP Diff Limit -->
        <div class="flex items-center justify-between p-4 rounded-xl border border-rose-100 bg-rose-50 dark:bg-rose-500/5 dark:border-rose-500/20">
            <div class="flex items-center gap-3 flex-1 min-w-0 mr-4">
                <span class="material-symbols-outlined text-rose-600 shrink-0">rule</span>
                <div>
                    <p class="font-bold text-sm">Validate CSP Diff Limit</p>
                    <p class="text-xs text-slate-500">Prevent saving if CSP Wallet difference is > 5000.</p>
                </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="toggle-validate-csp-diff" class="sr-only peer">
                    <div class="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="user-toggle-validate-csp-diff" class="sr-only peer">
                    <div class="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
            </div>
        </div>`;

html = html.replace('<!-- Danger Zone -->', HTML_BLOCK + '\n\n        <!-- Danger Zone -->');

const DOM_VARS = `const toggleValidateCashDiff = document.getElementById('toggle-validate-cash-diff');
const toggleValidateOnlineDiff = document.getElementById('toggle-validate-online-diff');
const toggleValidateCspDiff = document.getElementById('toggle-validate-csp-diff');
`;
html = html.replace('const unlockBtn = document.getElementById(\'btn-unlock-dtxn\');', DOM_VARS + '\nconst unlockBtn = document.getElementById(\'btn-unlock-dtxn\');');

const APPLY_SETTINGS = `    if (toggleValidateCashDiff) toggleValidateCashDiff.checked = localStorage.getItem('validate_cash_diff') !== 'false';
    if (toggleValidateOnlineDiff) toggleValidateOnlineDiff.checked = localStorage.getItem('validate_online_diff') !== 'false';
    if (toggleValidateCspDiff) toggleValidateCspDiff.checked = localStorage.getItem('validate_csp_diff') !== 'false';
`;
html = html.replace('pinAddEntryToggle.checked = localStorage.getItem(\'security_pin_enabled_add_entry\') !== \'false\';', APPLY_SETTINGS + '    pinAddEntryToggle.checked = localStorage.getItem(\'security_pin_enabled_add_entry\') !== \'false\';');

const SAVE_GLOBAL_JSON = `        validate_cash_diff: toggleValidateCashDiff ? toggleValidateCashDiff.checked : true,
        validate_online_diff: toggleValidateOnlineDiff ? toggleValidateOnlineDiff.checked : true,
        validate_csp_diff: toggleValidateCspDiff ? toggleValidateCspDiff.checked : true,
`;
html = html.replace('security_pin_enabled_add_entry: pinAddEntryToggle.checked,', SAVE_GLOBAL_JSON + '        security_pin_enabled_add_entry: pinAddEntryToggle.checked,');

const SAVE_GLOBAL_LS = `        if (toggleValidateCashDiff) localStorage.setItem('validate_cash_diff', settings.validate_cash_diff);
        if (toggleValidateOnlineDiff) localStorage.setItem('validate_online_diff', settings.validate_online_diff);
        if (toggleValidateCspDiff) localStorage.setItem('validate_csp_diff', settings.validate_csp_diff);
`;
html = html.replace('localStorage.setItem(\'security_pin_enabled_add_entry\', settings.security_pin_enabled_add_entry);', SAVE_GLOBAL_LS + '        localStorage.setItem(\'security_pin_enabled_add_entry\', settings.security_pin_enabled_add_entry);');

const ADD_LISTENERS = `if (toggleValidateCashDiff) toggleValidateCashDiff.addEventListener('change', saveGlobalSettings);
if (toggleValidateOnlineDiff) toggleValidateOnlineDiff.addEventListener('change', saveGlobalSettings);
if (toggleValidateCspDiff) toggleValidateCspDiff.addEventListener('change', saveGlobalSettings);
`;
html = html.replace('pinAddEntryToggle.addEventListener(\'change\', saveGlobalSettings);', ADD_LISTENERS + 'pinAddEntryToggle.addEventListener(\'change\', saveGlobalSettings);');

const USER_MAP = `    { id: 'user-toggle-validate-cash-diff',   key: 'user_validate_cash_diff' },
    { id: 'user-toggle-validate-online-diff', key: 'user_validate_online_diff' },
    { id: 'user-toggle-validate-csp-diff',    key: 'user_validate_csp_diff' },
`;
html = html.replace('{ id: \'user-toggle-pin-add-entry\',   key: \'user_pin_add_entry\' },', USER_MAP + '    { id: \'user-toggle-pin-add-entry\',   key: \'user_pin_add_entry\' },');

fs.writeFileSync('d:/BusinessPerformance/settings-code.html', html);
console.log('Patch complete!');
