// auth.js
(function() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const isIndexPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html');
    const isPublicTool = window.location.pathname.endsWith('img-to-pdf.html') || window.location.pathname.endsWith('passport-tool.html') || window.location.pathname.endsWith('image-compressor.html');

    if (!isLoggedIn && !isIndexPage && !isPublicTool) {
        window.location.replace('index.html');
    } else if (isLoggedIn && isIndexPage) {
        window.location.replace('dashboard-code.html');
    }
})();

function handleLogin(event) {
    if (event) event.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    // Clear previous error
    const err = document.getElementById('login-error');
    if (err) err.classList.add('hidden');

    if (u === 'DNONLINECENTER' && p === 'Tongpal@123') {
        sessionStorage.setItem('isLoggedIn', 'true');
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
        sessionStorage.removeItem('isLoggedIn');
        window.location.replace('index.html');
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
