const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

const REPLACE_HTML = `                    html: \`
                        <style>
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
                        </style>
                        <div class="flex flex-col gap-3 text-left mt-2">`;

appJs = appJs.replace(/html: \`\s*<div class="flex flex-col gap-3 text-left mt-2">/, REPLACE_HTML);

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('Fixed SweetAlert2 buttons mobile view');
