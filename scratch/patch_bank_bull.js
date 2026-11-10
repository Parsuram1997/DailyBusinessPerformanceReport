const fs = require('fs');

// Patch app.js
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Fix singleLineDisplay and &bull;
appJs = appJs.replace(
  "const singleLineDisplay = `${holder.toUpperCase()} &bull; ${type.toUpperCase()}${last4 ? ` &bull; ${last4}` : ''}`;",
  "const singleLineDisplay = `${holder.toUpperCase()} • ${type.toUpperCase()}${last4 ? ` • ${last4}` : ''}`;"
);

appJs = appJs.replace(
  "<span>&bull;</span>\r\n                        <span class=\"text-slate-500 dark:text-slate-300 font-bold\">${item.type}</span>\r\n                        ${item.last4 ? `<span>&bull;</span>",
  "<span>•</span>\r\n                        <span class=\"text-slate-500 dark:text-slate-300 font-bold\">${item.type}</span>\r\n                        ${item.last4 ? `<span>•</span>"
);

if (appJs.includes("<span>&bull;</span>\n                        <span class=\"text-slate-500 dark:text-slate-300 font-bold\">${item.type}</span>\n                        ${item.last4 ? `<span>&bull;</span>")) {
  appJs = appJs.replace(
    "<span>&bull;</span>\n                        <span class=\"text-slate-500 dark:text-slate-300 font-bold\">${item.type}</span>\n                        ${item.last4 ? `<span>&bull;</span>",
    "<span>•</span>\n                        <span class=\"text-slate-500 dark:text-slate-300 font-bold\">${item.type}</span>\n                        ${item.last4 ? `<span>•</span>"
  );
}

// 2. Fix renderDropdownItems in app.js
const appJsSearchOld = `        const renderDropdownItems = (filterText = '') => {
            customDropdown.innerHTML = '';
            const filtered = allItemsData.filter(item => {
                const query = filterText.toLowerCase();
                return item.holder.toLowerCase().includes(query) ||
                       item.bank.toLowerCase().includes(query) ||
                       item.type.toLowerCase().includes(query) ||
                       item.number.toLowerCase().includes(query);
            });`;

const appJsSearchNew = `        const renderDropdownItems = (filterText = '') => {
            customDropdown.innerHTML = '';
            const trimmed = (filterText || '').trim();
            const isFullMatch = allItemsData.some(item => 
                item.singleLine.toLowerCase() === trimmed.toLowerCase() || 
                item.fullValue.toLowerCase() === trimmed.toLowerCase()
            );

            const keywords = (isFullMatch || !trimmed) 
                ? [] 
                : trimmed.toLowerCase().split(/\\s+/).filter(k => k.length > 0 && k !== '•' && k !== '&bull;' && k !== '-');

            const filtered = allItemsData.filter(item => {
                if (keywords.length === 0) return true;
                const fullText = \`\${item.holder} \${item.bank} \${item.type} \${item.number} \${item.last4}\`.toLowerCase();
                return keywords.every(kw => fullText.includes(kw));
            });`;

if (appJs.includes(appJsSearchOld.replace(/\r?\n/g, '\r\n'))) {
  appJs = appJs.replace(appJsSearchOld.replace(/\r?\n/g, '\r\n'), appJsSearchNew.replace(/\r?\n/g, '\r\n'));
} else if (appJs.includes(appJsSearchOld.replace(/\r?\n/g, '\n'))) {
  appJs = appJs.replace(appJsSearchOld.replace(/\r?\n/g, '\n'), appJsSearchNew.replace(/\r?\n/g, '\n'));
} else {
  console.warn('Could not match renderDropdownItems in app.js');
}

// 3. Fix div.onmousedown in app.js to trigger change event
appJs = appJs.replace(
  "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\r\n                };",
  "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\r\n                    selectEl.dispatchEvent(new Event('change'));\r\n                };"
);
if (appJs.includes("document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\n                };")) {
  appJs = appJs.replace(
    "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\n                };",
    "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\n                    selectEl.dispatchEvent(new Event('change'));\n                };"
  );
}

// 4. Fix other &bull; in app.js
appJs = appJs.replace("` &bull; ${latestW.method}`", "` • ${latestW.method}`");
appJs = appJs.replace("` &bull; A/c ${parts[2]}`", "` • A/c ${parts[2]}`");

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('Successfully updated app.js');

// Now Patch app-v2.js
let appV2Js = fs.readFileSync('app-v2.js', 'utf8');

const appV2SearchOld = `        const renderDropdownItems = (filterText = '') => {
            customDropdown.innerHTML = '';
            const filtered = allItemsData.filter(item => {
                const query = filterText.toLowerCase();
                return item.holder.toLowerCase().includes(query) ||
                       item.bank.toLowerCase().includes(query) ||
                       item.type.toLowerCase().includes(query) ||
                       item.number.toLowerCase().includes(query);
            });`;

if (appV2Js.includes(appV2SearchOld.replace(/\r?\n/g, '\r\n'))) {
  appV2Js = appV2Js.replace(appV2SearchOld.replace(/\r?\n/g, '\r\n'), appJsSearchNew.replace(/\r?\n/g, '\r\n'));
} else if (appV2Js.includes(appV2SearchOld.replace(/\r?\n/g, '\n'))) {
  appV2Js = appV2Js.replace(appV2SearchOld.replace(/\r?\n/g, '\n'), appJsSearchNew.replace(/\r?\n/g, '\n'));
} else {
  console.warn('Could not match renderDropdownItems in app-v2.js');
}

// Fix div.onmousedown in app-v2.js to trigger change event
appV2Js = appV2Js.replace(
  "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\r\n                };",
  "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\r\n                    selectEl.dispatchEvent(new Event('change'));\r\n                };"
);
if (appV2Js.includes("document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\n                };")) {
  appV2Js = appV2Js.replace(
    "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\n                };",
    "document.getElementById('custom-bank-arrow')?.classList.remove('rotate-180');\n                    selectEl.dispatchEvent(new Event('change'));\n                };"
  );
}

fs.writeFileSync('app-v2.js', appV2Js, 'utf8');
console.log('Successfully updated app-v2.js');

