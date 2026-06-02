const fs = require('fs');
let content = fs.readFileSync('d:/BusinessPerformance/bank-withdrawals-code.html', 'utf8');

const OLD_HEADER = `<th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center w-14">S.No</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Account Holder</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center">Bank</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center">A/c Number</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center">Type</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Total Withdrawn</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center">Status</th>`;

const NEW_HEADER = `<th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center w-14">S.No</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Account Holder</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center hidden md:table-cell">Bank</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center hidden lg:table-cell">A/c Number</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center hidden md:table-cell">Type</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Total Withdrawn</th>
                                <th class="px-5 py-3.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center">Status</th>`;

if (content.includes('S.No</th>')) {
    content = content.replace(OLD_HEADER, NEW_HEADER);
    fs.writeFileSync('d:/BusinessPerformance/bank-withdrawals-code.html', content);
    console.log('Fixed header alignment');
} else {
    console.log('Header not found');
}
