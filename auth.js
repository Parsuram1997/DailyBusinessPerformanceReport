// auth.js

// ─── Users & Roles ───────────────────────────────────────────
const USERS = [
    { username: 'DNONLINECENTER', password: 'Tongpal@123', role: 'user' },
    { username: 'Mybusiness',     password: 'Mamta@123',   role: 'admin' }
];

(function() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const role       = sessionStorage.getItem('userRole') || 'user';
    const isIndexPage   = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html');
    const isPublicTool  = window.location.pathname.endsWith('img-to-pdf.html') ||
                          window.location.pathname.endsWith('passport-tool.html') ||
                          window.location.pathname.endsWith('image-compressor.html') ||
                          window.location.pathname.endsWith('daily-txn.html');
    const isSettingsPage = window.location.pathname.endsWith('settings-code.html');

    // Not logged in → redirect to login (except public tools)
    if (!isLoggedIn && !isIndexPage && !isPublicTool) {
        window.location.replace('index.html');
        return;
    }

    // Already logged in → skip login page
    if (isLoggedIn && isIndexPage) {
        window.location.replace('dashboard-code.html');
        return;
    }

    // Settings page → only admin allowed
    if (isLoggedIn && isSettingsPage && role !== 'admin') {
        window.location.replace('dashboard-code.html');
        return;
    }

    // Hide settings nav links for non-admin users after DOM loads
    if (isLoggedIn && role !== 'admin') {
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('a[href="settings-code.html"]').forEach(el => {
                el.style.display = 'none';
            });
        });
    }
})();

function handleLogin(event) {
    if (event) event.preventDefault();
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;

    // Clear previous error
    const err = document.getElementById('login-error');
    if (err) err.classList.add('hidden');

    const matched = USERS.find(user => user.username === u && user.password === p);

    if (matched) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userRole', matched.role);
        sessionStorage.setItem('username', matched.username);
        window.location.href = 'dashboard-code.html';
    } else {
        if (err) {
            err.classList.remove('hidden');
        } else {
            alert('Invalid credentials. Please try again.');
        }
    }
}

function handleLogout(event) {
    if (event) event.preventDefault();
    
    if (document.getElementById('logout-confirm-modal')) return;

    const modalHTML = `
    <div id="logout-confirm-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:999999;backdrop-filter:blur(4px);">
        <div style="background:white;padding:24px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.2);text-align:center;width:90%;max-width:320px;" class="dark:bg-slate-800">
            <div style="width:48px;height:48px;border-radius:50%;background:#ffe4e6;color:#e11d48;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;" class="dark:bg-rose-500/20 dark:text-rose-400">
                <span class="material-symbols-outlined" style="font-size:24px;">logout</span>
            </div>
            <h3 style="margin-top:0;font-weight:bold;color:#1e293b;font-size:18px;margin-bottom:8px;" class="dark:text-white">Sign Out</h3>
            <p style="color:#64748b;font-size:13px;margin-bottom:24px;" class="dark:text-slate-400">Are you sure you want to log out of your account?</p>
            
            <div style="display:flex;gap:12px;">
                <button id="logout-cancel" style="flex:1;padding:10px;border:none;background:#f1f5f9;color:#475569;border-radius:8px;font-weight:bold;cursor:pointer;" class="dark:bg-slate-700 dark:text-white">Cancel</button>
                <button id="logout-confirm" style="flex:1;padding:10px;border:none;background:#e11d48;color:white;border-radius:8px;font-weight:bold;cursor:pointer;line-height:1.2;" class="hover:bg-rose-600 transition-colors">Logout</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeModal = () => {
        const m = document.getElementById('logout-confirm-modal');
        if (m) m.remove();
    };

    document.getElementById('logout-cancel').addEventListener('click', closeModal);
    document.getElementById('logout-confirm').addEventListener('click', () => {
        // Show smooth logout animation
        const modal = document.getElementById('logout-confirm-modal');
        if (modal) modal.remove();

        const overlay = document.createElement('div');
        overlay.id = 'logout-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999999;
            background: linear-gradient(135deg, #7f13ec, #4f0890);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            animation: fadeInOverlay 0.3s ease forwards;
        `;
        overlay.innerHTML = `
            <style>
                @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulseText { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
            </style>
            <div style="width:64px;height:64px;border:4px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:24px;"></div>
            <h2 style="color:#fff;font-size:20px;font-weight:800;letter-spacing:0.5px;margin:0 0 8px;font-family:Inter,sans-serif;">Signing Out...</h2>
            <p style="color:rgba(255,255,255,0.65);font-size:13px;font-family:Inter,sans-serif;animation:pulseText 1.5s ease infinite;margin:0;">Please wait a moment</p>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('userRole');
            sessionStorage.removeItem('username');
            window.location.replace('index.html');
        }, 1200);
    });
}

// Attach triggers if buttons exist
document.addEventListener('DOMContentLoaded', () => {
    const logoutTriggers = document.querySelectorAll('#logout-btn, .logout-trigger');
    logoutTriggers.forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });
    
    // Bind login form if it exists
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
});


