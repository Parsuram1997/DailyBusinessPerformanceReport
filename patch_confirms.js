const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

// 1. Mark All
const MARK_ALL_REPLACE = `            const result = await window.Swal.fire({
                title: 'Mark all visible rows?',
                text: 'All currently visible rows will be marked as checked.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, mark all'
            });
            if (!result.isConfirmed) return;`;
appJs = appJs.replace(/if \(!confirm\('Mark all visible rows as checked\?'\)\) return;/g, MARK_ALL_REPLACE);

// 2. Uncheck All
const UNCHECK_ALL_REPLACE = `            const result = await window.Swal.fire({
                title: 'Uncheck all visible rows?',
                text: 'All currently visible rows will be unmarked.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#f59e0b',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, uncheck all'
            });
            if (!result.isConfirmed) return;`;
appJs = appJs.replace(/if \(!confirm\('Uncheck all visible rows\?'\)\) return;/g, UNCHECK_ALL_REPLACE);

// 3. Damaged Calculator
const DAMAGED_REPLACE = `            window.Swal.fire({
                title: 'Transfer 0?',
                text: 'The total is ₹0. Transfer this as clear?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, transfer'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.useTotalDamages(0);
                }
            });`;
appJs = appJs.replace(/if \(confirm\('The total is ₹0\. Transfer this as clear\?'\)\) \{\s*window\.useTotalDamages\(0\);\s*\}/g, DAMAGED_REPLACE);

// 4. Date Switcher Unsaved Data
const DATE_SWITCH_REPLACE = `            if (!window._isConfirmedDateSwitch && window.hasUnsavedData && window.hasUnsavedData()) {
                const pendingTargetValue = e.target.value;
                e.target.value = previousViewDateVal; // rollback immediately
                window.Swal.fire({
                    title: 'Unsaved Data',
                    text: 'You have unsaved transaction data. Continue changing date?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#e11d48',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Yes, change date'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window._isConfirmedDateSwitch = true;
                        e.target.value = pendingTargetValue;
                        e.target.dispatchEvent(new Event('change'));
                    }
                });
                return;
            }`;
appJs = appJs.replace(/if \(!window\._isConfirmedDateSwitch && window\.hasUnsavedData && window\.hasUnsavedData\(\)\) \{\s*if \(!confirm\("You have unsaved transaction data\. Continue changing date\?"\)\) \{\s*e\.target\.value = previousViewDateVal;\s*return;\s*\}\s*\}/g, DATE_SWITCH_REPLACE);

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('Replaced all native confirms with SweetAlert');
