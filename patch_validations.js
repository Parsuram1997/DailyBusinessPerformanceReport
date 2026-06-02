const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

const ONLINE_BTN_REPLACE = `            useOnlineBtn.addEventListener('click', () => {
                const total = updateOnlineSplitTotal();
                
                // Add Validation
                const expectedDisp = document.getElementById('expected-online-split-total-display');
                const isValidate = localStorage.getItem('validate_online_diff') !== 'false';
                if (isValidate && expectedDisp && expectedDisp.dataset.val) {
                    const expected = parseFloat(expectedDisp.dataset.val) || 0;
                    if (Math.abs(total - expected) > 5000) {
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                title: 'Validation Error',
                                text: 'The difference between Expected Online amount and your manual total exceeds ₹5,000. Please verify and correct your transactions on the Daily Txn page.',
                                icon: 'error',
                                confirmButtonColor: '#e11d48'
                            });
                        } else {
                            alert('The difference between Expected Online amount and your manual total exceeds ₹5,000. Please verify and correct your transactions on the Daily Txn page.');
                        }
                        return;
                    }
                }

                if (onlineInput) {
                    onlineInput.value = total || '';
                    onlineInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                closeOnlineModal();
            });`;

appJs = appJs.replace(/useOnlineBtn\.addEventListener\('click', \(\) => {[\s\S]*?closeOnlineModal\(\);\s*}\);/, ONLINE_BTN_REPLACE);

const ROINET_BTN_REPLACE = `            useRoinetBtn.addEventListener('click', () => {
                const total = updateRoinetSplitTotal();
                
                // Add Validation
                const expectedDisp = document.getElementById('expected-split-total-display');
                const isValidate = localStorage.getItem('validate_csp_diff') !== 'false';
                if (isValidate && expectedDisp && expectedDisp.dataset.val) {
                    const expected = parseFloat(expectedDisp.dataset.val) || 0;
                    if (Math.abs(total - expected) > 5000) {
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                title: 'Validation Error',
                                text: 'The difference between Expected CSP Wallet amount and your manual total exceeds ₹5,000. Please verify and correct your transactions on the Daily Txn page.',
                                icon: 'error',
                                confirmButtonColor: '#e11d48'
                            });
                        } else {
                            alert('The difference between Expected CSP Wallet amount and your manual total exceeds ₹5,000. Please verify and correct your transactions on the Daily Txn page.');
                        }
                        return;
                    }
                }

                if (roinetInput) {
                    roinetInput.value = total || '';
                    roinetInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                closeRoinetModal();
            });`;

appJs = appJs.replace(/useRoinetBtn\.addEventListener\('click', \(\) => {[\s\S]*?closeRoinetModal\(\);\s*}\);/, ROINET_BTN_REPLACE);

const CASH_BTN_REPLACE = `        btnUseCash.onclick = () => {
            const totalText = totalValDisplay.innerText.replace(/[₹,]/g, '');
            const finalAmount = parseFloat(totalText);
            if (finalAmount > 0) {
                // Add Validation
                const isValidate = localStorage.getItem('validate_cash_diff') !== 'false';
                if (isValidate && typeof currentSystemCash !== 'undefined') {
                    if (Math.abs(finalAmount - currentSystemCash) > 5000) {
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                title: 'Validation Error',
                                text: 'The difference between Expected Cash and your manual physical total exceeds ₹5,000. Please verify and correct your transactions on the Daily Txn page.',
                                icon: 'error',
                                confirmButtonColor: '#e11d48'
                            });
                        } else {
                            alert('The difference between Expected Cash and your manual physical total exceeds ₹5,000. Please verify and correct your transactions on the Daily Txn page.');
                        }
                        return;
                    }
                }

                localStorage.setItem('temp_calculator_cash', finalAmount);
                window.location.href = 'add-entry-code.html';
            } else {
                alert('Please calculate an amount greater than 0.');
            }
        };`;

appJs = appJs.replace(/btnUseCash\.onclick = \(\) => {[\s\S]*?alert\('Please calculate an amount greater than 0\.'\);\s*}\s*};/, CASH_BTN_REPLACE);

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('App patched successfully!');
