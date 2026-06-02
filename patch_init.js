const fs = require('fs');
let appJs = fs.readFileSync('d:/BusinessPerformance/app.js', 'utf8');

const NEW_CHECKS = `            checkAndSet('HIDE_PUBLIC_DAILY_TXN', data.HIDE_PUBLIC_DAILY_TXN);
            checkAndSet('validate_cash_diff', data.validate_cash_diff);
            checkAndSet('validate_online_diff', data.validate_online_diff);
            checkAndSet('validate_csp_diff', data.validate_csp_diff);
`;
appJs = appJs.replace(/checkAndSet\('HIDE_PUBLIC_DAILY_TXN', data\.HIDE_PUBLIC_DAILY_TXN\);/, NEW_CHECKS);

const NEW_USER_CHECKS = `            checkAndSet('user_dtxn_showSummary', data.user_dtxn_showSummary);
            checkAndSet('user_validate_cash_diff', data.user_validate_cash_diff);
            checkAndSet('user_validate_online_diff', data.user_validate_online_diff);
            checkAndSet('user_validate_csp_diff', data.user_validate_csp_diff);
`;
appJs = appJs.replace(/checkAndSet\('user_dtxn_showSummary', data\.user_dtxn_showSummary\);/, NEW_USER_CHECKS);

fs.writeFileSync('d:/BusinessPerformance/app.js', appJs);
console.log('initGlobalSettings patched successfully!');
