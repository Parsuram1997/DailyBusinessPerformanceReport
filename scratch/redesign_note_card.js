const fs = require('fs');

let content = fs.readFileSync('quick-note-code.html', 'utf8');

// 1. Update grids to use items-start and responsive columns
content = content.replace(
    'id="pinnedNotesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"',
    'id="pinnedNotesGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 items-start"'
);

content = content.replace(
    'id="allNotesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"',
    'id="allNotesGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 items-start"'
);

// 2. Replace COLOR_MAP
const oldColorMap = `        // Color Styles Map
        const COLOR_MAP = {
            violet: {
                border: 'border-violet-500/30 hover:border-violet-500/70',
                topBar: 'bg-violet-500',
                bg: 'bg-violet-500/5 dark:bg-violet-500/10',
                badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
                tag: 'text-violet-600 dark:text-violet-400'
            },
            blue: {
                border: 'border-blue-500/30 hover:border-blue-500/70',
                topBar: 'bg-blue-500',
                bg: 'bg-blue-500/5 dark:bg-blue-500/10',
                badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
                tag: 'text-blue-600 dark:text-blue-400'
            },
            emerald: {
                border: 'border-emerald-500/30 hover:border-emerald-500/70',
                topBar: 'bg-emerald-500',
                bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
                badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
                tag: 'text-emerald-600 dark:text-emerald-400'
            },
            amber: {
                border: 'border-amber-500/30 hover:border-amber-500/70',
                topBar: 'bg-amber-500',
                bg: 'bg-amber-500/5 dark:bg-amber-500/10',
                badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
                tag: 'text-amber-600 dark:text-amber-400'
            },
            rose: {
                border: 'border-rose-500/30 hover:border-rose-500/70',
                topBar: 'bg-rose-500',
                bg: 'bg-rose-500/5 dark:bg-rose-500/10',
                badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
                tag: 'text-rose-600 dark:text-rose-400'
            },
            slate: {
                border: 'border-slate-300 dark:border-slate-700 hover:border-slate-400',
                topBar: 'bg-slate-500',
                bg: 'bg-slate-50 dark:bg-slate-800/40',
                badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                tag: 'text-slate-600 dark:text-slate-400'
            }
        };`;

const newColorMap = `        // Color Styles Map
        const COLOR_MAP = {
            violet: {
                border: 'border-violet-200 dark:border-violet-500/25 hover:border-violet-400 dark:hover:border-violet-500/50',
                bar: 'bg-violet-500',
                badge: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/20'
            },
            blue: {
                border: 'border-blue-200 dark:border-blue-500/25 hover:border-blue-400 dark:hover:border-blue-500/50',
                bar: 'bg-blue-500',
                badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/20'
            },
            emerald: {
                border: 'border-emerald-200 dark:border-emerald-500/25 hover:border-emerald-400 dark:hover:border-emerald-500/50',
                bar: 'bg-emerald-500',
                badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/20'
            },
            amber: {
                border: 'border-amber-200 dark:border-amber-500/25 hover:border-amber-400 dark:hover:border-amber-500/50',
                bar: 'bg-amber-500',
                badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/20'
            },
            rose: {
                border: 'border-rose-200 dark:border-rose-500/25 hover:border-rose-400 dark:hover:border-rose-500/50',
                bar: 'bg-rose-500',
                badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/20'
            },
            slate: {
                border: 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                bar: 'bg-slate-400 dark:bg-slate-600',
                badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }
        };`;

if (!content.includes(oldColorMap)) {
    console.error('Could not find oldColorMap!');
    process.exit(1);
}
content = content.replace(oldColorMap, newColorMap);

// 3. Replace renderNoteCardHTML with sleek, compact, prominent text version
const oldRenderFn = `        function renderNoteCardHTML(n) {
            const c = COLOR_MAP[n.color] || COLOR_MAP.violet;
            const completedClass = n.isCompleted ? 'completed-note ring-1 ring-emerald-500/30' : '';
            const pinIcon = n.isPinned ? 'fill-1 text-amber-500' : 'text-slate-400 hover:text-amber-500';
            const checkIcon = n.isCompleted ? 'check_circle fill-1 text-emerald-500' : 'radio_button_unchecked text-slate-400 hover:text-emerald-500';
            const timeStr = formatNoteTime(n.created_at || n.updated_at);
            
            // Auto title if title is empty
            const displayTitle = n.title ? escapeHtml(n.title) : escapeHtml((n.content || '').split('\\n')[0].substring(0, 40));
            // Escape and format content with breaks
            const formattedContent = escapeHtml(n.content || '').replace(/\\n/g, '<br>');

            return \`
                <div class="note-card relative flex flex-col justify-between rounded-2xl p-4 bg-white dark:bg-slate-900 border \${c.border} shadow-sm \${completedClass} group">
                    <div class="absolute left-0 top-0 right-0 h-1 rounded-t-2xl \${c.topBar}"></div>
                    
                    <div>
                        <!-- Header with Category & Pin -->
                        <div class="flex items-center justify-between mb-2">
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold \${c.badge}">
                                \${escapeHtml(n.category || 'General')}
                            </span>
                            <div class="flex items-center gap-1">
                                <button type="button" onclick="window.toggleNotePin('\${n.id}', \${!n.isPinned})" class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="\${n.isPinned ? 'Unpin note' : 'Pin note to top'}">
                                    <span class="material-symbols-outlined text-[17px] \${pinIcon}">push_pin</span>
                                </button>
                                <button type="button" onclick="window.toggleNoteComplete('\${n.id}', \${!n.isCompleted})" class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="\${n.isCompleted ? 'Mark as active' : 'Mark as completed'}">
                                    <span class="material-symbols-outlined text-[17px] \${checkIcon}">check_circle</span>
                                </button>
                            </div>
                        </div>

                        <!-- Title -->
                        <h5 class="text-sm font-bold text-slate-900 dark:text-white font-heading mb-1.5 leading-snug select-text">
                            \${displayTitle}
                        </h5>

                        <!-- Note Body -->
                        <div class="note-content text-xs font-normal text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap select-text mb-3 max-h-48 overflow-y-auto no-scrollbar">
                            \${formattedContent}
                        </div>
                    </div>

                    <!-- Footer Bar: Timestamp & Actions -->
                    <div class="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span class="font-mono text-[10px] flex items-center gap-1">
                            <span class="material-symbols-outlined text-[13px]">schedule</span>
                            \${timeStr}
                        </span>

                        <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button type="button" onclick="window.copyNoteText('\${n.id}')" class="p-1 text-slate-400 hover:text-primary rounded-md hover:bg-primary/5 transition-colors" title="Copy to clipboard">
                                <span class="material-symbols-outlined text-[16px]">content_copy</span>
                            </button>
                            <button type="button" onclick="window.openEditModal('\${n.id}')" class="p-1 text-slate-400 hover:text-blue-500 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Edit note">
                                <span class="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            <button type="button" onclick="window.deleteQuickNote('\${n.id}')" class="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors" title="Delete note">
                                <span class="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            \`;
        }`;

const newRenderFn = `        function renderNoteCardHTML(n) {
            const c = COLOR_MAP[n.color] || COLOR_MAP.violet;
            const completedClass = n.isCompleted ? 'completed-note ring-1 ring-emerald-500/40 bg-slate-50/50 dark:bg-slate-900/40' : '';
            const pinIcon = n.isPinned ? 'fill-1 text-amber-500' : 'text-slate-400 hover:text-amber-500';
            const checkIcon = n.isCompleted ? 'check_circle fill-1 text-emerald-500' : 'radio_button_unchecked text-slate-400 hover:text-emerald-500';
            const timeStr = formatNoteTime(n.created_at || n.updated_at);
            
            const hasTitle = n.title && n.title.trim().length > 0;
            const displayTitle = hasTitle ? escapeHtml(n.title.trim()) : '';
            const formattedContent = escapeHtml(n.content || '').replace(/\\n/g, '<br>');

            return \`
                <div class="note-card relative overflow-hidden flex flex-col rounded-2xl p-3 sm:p-3.5 bg-white dark:bg-slate-900/90 border \${c.border} shadow-sm hover:shadow-md \${completedClass} group transition-all duration-200">
                    <div class="absolute left-0 top-0 bottom-0 w-1 \${c.bar}"></div>
                    
                    <!-- Header: Category + Action Icons (Pin & Done) -->
                    <div class="flex items-center justify-between gap-2 mb-1.5 pl-1.5">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider \${c.badge}">
                            \${escapeHtml(n.category || 'General')}
                        </span>
                        
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="window.toggleNotePin('\${n.id}', \${!n.isPinned})" class="size-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="\${n.isPinned ? 'Unpin' : 'Pin to top'}">
                                <span class="material-symbols-outlined text-[16px] \${pinIcon}">push_pin</span>
                            </button>
                            <button type="button" onclick="window.toggleNoteComplete('\${n.id}', \${!n.isCompleted})" class="size-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="\${n.isCompleted ? 'Mark active' : 'Mark completed'}">
                                <span class="material-symbols-outlined text-[16px] \${checkIcon}">check_circle</span>
                            </button>
                        </div>
                    </div>

                    <!-- Title (if present) -->
                    \${hasTitle ? \`
                    <h5 class="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 pl-1.5 mb-1 leading-snug select-text">
                        \${displayTitle}
                    </h5>
                    \` : ''}

                    <!-- Note Body (Much bigger, bold, readable font!) -->
                    <div class="note-content text-sm sm:text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-snug tracking-tight break-words select-text pl-1.5 mb-2.5">
                        \${formattedContent}
                    </div>

                    <!-- Footer: Timestamp & Actions -->
                    <div class="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/70 flex items-center justify-between text-[10px] text-slate-400 font-medium pl-1.5">
                        <span class="font-mono flex items-center gap-1 text-[9.5px]">
                            <span class="material-symbols-outlined text-[12px] opacity-70">schedule</span>
                            \${timeStr}
                        </span>

                        <div class="flex items-center gap-0.5">
                            <button type="button" onclick="window.copyNoteText('\${n.id}')" class="size-6 flex items-center justify-center text-slate-400 hover:text-primary rounded-md hover:bg-primary/10 transition-colors" title="Copy text">
                                <span class="material-symbols-outlined text-[14px]">content_copy</span>
                            </button>
                            <button type="button" onclick="window.openEditModal('\${n.id}')" class="size-6 flex items-center justify-center text-slate-400 hover:text-blue-500 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Edit">
                                <span class="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                            <button type="button" onclick="window.deleteQuickNote('\${n.id}')" class="size-6 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors" title="Delete">
                                <span class="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            \`;
        }`;

if (!content.includes(oldRenderFn)) {
    console.error('Could not find oldRenderFn!');
    process.exit(1);
}
content = content.replace(oldRenderFn, newRenderFn);

fs.writeFileSync('quick-note-code.html', content, 'utf8');
fs.writeFileSync('quick-note.html', content, 'utf8');
console.log('Successfully updated quick-note-code.html and quick-note.html!');

