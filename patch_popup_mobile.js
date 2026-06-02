const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

// 1. Transaction Amount row padding & whitespace
appJs = appJs.replace(
    /<div class="flex justify-between items-center bg-gradient-to-r from-primary\/5 to-primary\/10 p-3 rounded-xl border border-primary\/20 shadow-sm mt-1">/g,
    '<div class="flex justify-between items-center bg-gradient-to-r from-primary/5 to-primary/10 py-2 px-3 rounded-xl border border-primary/20 shadow-sm mt-1">'
);

appJs = appJs.replace(
    /<span class="text-xl font-black text-primary drop-shadow-sm">\$\{formattedAmount\}<\/span>/g,
    '<span class="text-lg sm:text-xl font-black text-primary drop-shadow-sm whitespace-nowrap">${formattedAmount}</span>'
);

appJs = appJs.replace(
    /<span class="text-sm font-bold text-slate-700">Transaction Amount<\/span>/g,
    '<span class="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap mr-2">Transaction Amount</span>'
);

// 2. SweetAlert2 Buttons compact style
const OLD_STYLE = `<style>
                            div.swal2-actions {
                                flex-direction: row !important;
                                flex-wrap: nowrap !important;
                                width: 100% !important;
                                padding: 0 1rem !important;
                                box-sizing: border-box !important;
                            }
                            div.swal2-actions button {
                                flex: 1 1 0% !important;
                                margin: 0 0.25rem !important;
                                width: 100% !important;
                            }
                        </style>`;

const NEW_STYLE = `<style>
                            div.swal2-actions {
                                flex-direction: row !important;
                                flex-wrap: nowrap !important;
                                width: 100% !important;
                                padding: 0 0.5rem !important;
                                box-sizing: border-box !important;
                                gap: 0.5rem !important;
                            }
                            div.swal2-actions button {
                                flex: 1 1 0% !important;
                                margin: 0 !important;
                                width: 100% !important;
                                white-space: nowrap !important;
                                padding: 0.5rem 0.2rem !important;
                                font-size: 0.85rem !important;
                                line-height: 1 !important;
                                min-height: 38px !important;
                                height: auto !important;
                            }
                            div.swal2-actions button span.material-symbols-outlined {
                                font-size: 16px !important;
                            }
                        </style>`;

appJs = appJs.replace(OLD_STYLE, NEW_STYLE);

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('Fixed mobile UI issues in Confirm popup');
