const fs = require('fs');

let content = fs.readFileSync('d:/BusinessPerformance/reports-code.html', 'utf8');

const replacements = [
    {
        id: 'summary-avg-income',
        bg: 'bg-gradient-to-br from-emerald-400 to-green-500',
        pClass: 'text-xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-avg-expense',
        bg: 'bg-gradient-to-br from-orange-400 to-red-500',
        pClass: 'text-xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-avg-profit',
        bg: 'bg-gradient-to-br from-cyan-500 to-blue-500',
        pClass: 'text-xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-roi',
        bg: 'bg-gradient-to-br from-purple-500 to-pink-500',
        pClass: 'text-xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-peak-day',
        bg: 'bg-gradient-to-br from-violet-500 to-fuchsia-500',
        pClass: 'text-lg font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-peak-month',
        bg: 'bg-gradient-to-br from-fuchsia-500 to-rose-500',
        pClass: 'text-lg font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-growth-rate',
        bg: 'bg-gradient-to-br from-teal-400 to-teal-600',
        pClass: 'text-xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-net-profit',
        bg: 'bg-gradient-to-br from-indigo-400 to-blue-600',
        pClass: 'text-xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-entries-count',
        bg: 'bg-gradient-to-br from-slate-500 to-slate-700',
        pClass: 'text-2xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-period-capital',
        bg: 'bg-gradient-to-br from-indigo-400 to-cyan-500',
        pClass: 'text-2xl font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-peak-year',
        bg: 'bg-gradient-to-br from-pink-500 to-orange-400',
        pClass: 'text-lg font-black italic tracking-tighter text-white'
    },
    {
        id: 'summary-total-withdrawal',
        bg: 'bg-gradient-to-br from-amber-500 to-orange-500',
        pClass: 'text-xl font-black italic tracking-tighter text-white'
    }
];

// Regex approach
replacements.forEach(rep => {
    // We look for the div containing this id
    const regex = new RegExp(`(<div class=")(bg-white.*?)(>\\s*<h4 class=")(text.*?)( uppercase.*?>.*?<p id="${rep.id}" class=")(.*?)(">.*?<div class="absolute )(.*?)(">\\s*<span class="material-symbols-outlined text-6xl)(.*?)(<\\/div>\\s*<\\/div>)`, 'g');
    
    content = content.replace(regex, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11) => {
        return p1 + rep.bg + ' p-5 rounded-2xl shadow-lg relative overflow-hidden group' + p3 + 'text-[10px] font-black text-white/80' + p5 + rep.pClass + p7 + '-right-2 -bottom-2 opacity-20 transition-transform group-hover:scale-110' + p9 + ' text-white">' + p10.replace('">',' text-white">') + p11;
    });
});

fs.writeFileSync('d:/BusinessPerformance/reports-code.html', content, 'utf8');
console.log('Update finished.');
