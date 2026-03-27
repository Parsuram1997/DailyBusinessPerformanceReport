const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('response', response => {
        if (!response.ok()) {
            console.log('PAGE RESPONSE ERROR:', response.status(), response.url());
        }
    });

    try {
        await page.goto('http://127.0.0.1:8080/bank-withdrawals-code.html', { waitUntil: 'networkidle2' });
        console.log("Navigated to page.");
        await page.waitForTimeout(2000);
    } catch (err) {
        console.log("Nav error:", err.message);
    }

    await browser.close();
})();
