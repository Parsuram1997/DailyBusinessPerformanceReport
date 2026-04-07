// auth.js
(function() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const isIndexPage = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html');

    if (!isLoggedIn && !isIndexPage) {
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
    sessionStorage.removeItem('isLoggedIn');
    window.location.replace('index.html');
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
