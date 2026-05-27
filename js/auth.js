(function() {
    const AUTH_KEY = 'mythiqo_auth_token';
    const USER_KEY = 'mythiqo_username';

    function getToken() { return localStorage.getItem(AUTH_KEY); }
    function getUsername() { return localStorage.getItem(USER_KEY); }
    function isLoggedIn() { return !!getToken(); }

    function storeAuth(token, username) {
        localStorage.setItem(AUTH_KEY, token);
        localStorage.setItem(USER_KEY, username);
    }

    function clearAuth() {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem('mythiqo_decks');
    }

    async function api(path, method, body) {
        const url = window.location.origin + path;
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = token;
        const opts = { method, headers };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            const text = await res.text();
            throw new Error('Server returned ' + res.status + ' (' + text.slice(0, 80) + '...)');
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    async function login(username, password) {
        await api('/api/login', 'POST', { username, password });
        // storeAuth + reload is handled by the click handler
        return true;
    }

    async function register(username, password) {
        await api('/api/register', 'POST', { username, password });
        return true;
    }

    async function logout() {
        try { await api('/api/logout', 'POST'); } catch {}
        clearAuth();
        location.reload();
    }

    async function syncDecksFromServer() {
        if (!isLoggedIn()) return null;
        try {
            const data = await api('/api/decks', 'GET');
            if (data.decks && data.decks.length) {
                localStorage.setItem('mythiqo_decks', JSON.stringify(data.decks));
            }
            return data.decks || [];
        } catch { return null; }
    }

    async function syncDecksToServer(decks) {
        if (!isLoggedIn()) return false;
        try {
            await api('/api/decks', 'POST', { decks });
            return true;
        } catch { return false; }
    }

    async function sendFriendRequest(target) {
        return api('/api/friends/request', 'POST', { username: target });
    }

    async function acceptFriendRequest(target) {
        return api('/api/friends/accept', 'POST', { username: target });
    }

    async function declineFriendRequest(target) {
        return api('/api/friends/decline', 'POST', { username: target });
    }

    async function getFriends() {
        return api('/api/friends', 'GET');
    }

    async function getFriendRequests() {
        return api('/api/friends/requests', 'GET');
    }

    async function getFriendRequestsSent() {
        return api('/api/friends/sent', 'GET');
    }

    let loginBackdropEl = null;
    let accountBackdropEl = null;
    let iconEl = null;

    // ─── Login/Register Modal ───────────────────────────────────────────────

    function buildLoginModal() {
        if (loginBackdropEl) return;
        loginBackdropEl = document.createElement('div');
        loginBackdropEl.className = 'auth-backdrop';
        loginBackdropEl.id = 'auth-backdrop';
        loginBackdropEl.innerHTML = `
            <div class="auth-modal">
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Login</button>
                    <button class="auth-tab" data-tab="register">Register</button>
                </div>
                <div class="auth-form" id="auth-form-login">
                    <label>Username</label>
                    <input type="text" class="auth-input" id="auth-login-user" autocomplete="username">
                    <label>Password</label>
                    <input type="password" class="auth-input" id="auth-login-pass" autocomplete="current-password">
                    <div class="auth-error" id="auth-login-error"></div>
                    <button class="auth-btn" id="auth-login-btn">Login</button>
                </div>
                <div class="auth-form hidden" id="auth-form-register">
                    <label>Username</label>
                    <input type="text" class="auth-input" id="auth-reg-user" autocomplete="off">
                    <label>Password</label>
                    <input type="password" class="auth-input" id="auth-reg-pass" autocomplete="new-password">
                    <label>Confirm Password</label>
                    <input type="password" class="auth-input" id="auth-reg-confirm" autocomplete="new-password">
                    <div class="auth-error" id="auth-reg-error"></div>
                    <button class="auth-btn" id="auth-reg-btn">Create Account</button>
                </div>
            </div>
        `;
        document.body.appendChild(loginBackdropEl);

        loginBackdropEl.addEventListener('click', (e) => {
            if (e.target === loginBackdropEl) closeLoginModal();
        });

        loginBackdropEl.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                loginBackdropEl.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const isLogin = tab.dataset.tab === 'login';
                document.getElementById('auth-form-login').classList.toggle('hidden', !isLogin);
                document.getElementById('auth-form-register').classList.toggle('hidden', isLogin);
                document.getElementById('auth-login-error').classList.remove('visible');
                document.getElementById('auth-reg-error').classList.remove('visible');
            });
        });

        document.getElementById('auth-login-btn').addEventListener('click', async () => {
            const user = document.getElementById('auth-login-user').value.trim();
            const pass = document.getElementById('auth-login-pass').value;
            const errEl = document.getElementById('auth-login-error');
            const btn = document.getElementById('auth-login-btn');
            if (!user || !pass) { errEl.textContent = 'Fill in all fields.'; errEl.classList.add('visible'); return; }
            btn.disabled = true; btn.textContent = '...';
            try {
                const data = await api('/api/login', 'POST', { username: user, password: pass });
                storeAuth(data.token, data.username);
                location.reload();
            } catch (e) {
                errEl.textContent = e.message; errEl.classList.add('visible');
                btn.disabled = false; btn.textContent = 'Login';
            }
        });

        document.getElementById('auth-reg-btn').addEventListener('click', async () => {
            const user = document.getElementById('auth-reg-user').value.trim();
            const pass = document.getElementById('auth-reg-pass').value;
            const confirm = document.getElementById('auth-reg-confirm').value;
            const errEl = document.getElementById('auth-reg-error');
            const btn = document.getElementById('auth-reg-btn');
            if (!user || !pass || !confirm) { errEl.textContent = 'Fill in all fields.'; errEl.classList.add('visible'); return; }
            if (pass !== confirm) { errEl.textContent = 'Passwords do not match.'; errEl.classList.add('visible'); return; }
            btn.disabled = true; btn.textContent = '...';
            try {
                const data = await api('/api/register', 'POST', { username: user, password: pass });
                storeAuth(data.token, data.username);
                location.reload();
            } catch (e) {
                errEl.textContent = e.message; errEl.classList.add('visible');
                btn.disabled = false; btn.textContent = 'Create Account';
            }
        });

        document.getElementById('auth-login-pass').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('auth-login-btn').click();
        });
        document.getElementById('auth-reg-confirm').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('auth-reg-btn').click();
        });
    }

    function openLoginModal() { buildLoginModal(); loginBackdropEl.classList.add('active'); }
    function closeLoginModal() { if (loginBackdropEl) loginBackdropEl.classList.remove('active'); }

    // ─── Account Popup (Profile + Friends) ───────────────────────────────────

    function buildAccountPopup() {
        if (accountBackdropEl) return;
        accountBackdropEl = document.createElement('div');
        accountBackdropEl.className = 'auth-backdrop';
        accountBackdropEl.id = 'account-backdrop';
        accountBackdropEl.innerHTML = `
            <div class="auth-modal" style="width:380px;text-align:center;">
                <div class="auth-tabs">
                    <button class="auth-tab active" data-actab="profile">Profile</button>
                    <button class="auth-tab" data-actab="friends">Friends</button>
                </div>

                <!-- Profile Tab -->
                <div class="auth-form" id="actab-profile">
                    <div style="font-size:32px;margin-bottom:4px;color:var(--green2);">
                        <svg viewBox="0 0 24 24" style="width:48px;height:48px;"><path fill="currentColor" d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>
                    </div>
                    <label style="text-align:center;font-size:18px;color:var(--green1);font-weight:bold;" id="account-username"></label>
                    <div style="color:var(--green4);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:4px 0 8px;">Connected</div>
                    <div style="border-top:1px solid var(--green4);padding-top:12px;margin-top:4px;">
                        <div style="color:var(--green4);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Decks</div>
                        <div style="font-size:24px;font-weight:bold;color:var(--green2);" id="account-deck-count">0</div>
                    </div>
                    <button class="auth-btn" id="account-logout-btn" style="margin-top:16px;">LOGOUT</button>
                </div>

                <!-- Friends Tab -->
                <div class="auth-form hidden" id="actab-friends" style="text-align:left;">
                    <div style="border-bottom:1px solid var(--green4);padding-bottom:10px;margin-bottom:10px;">
                        <label style="color:var(--green3);font-size:11px;text-transform:uppercase;font-weight:bold;">Send Friend Request</label>
                        <div style="display:flex;gap:6px;margin-top:4px;">
                            <input type="text" class="auth-input" id="friend-request-input" placeholder="Username..." style="flex:1;">
                            <button class="auth-btn" id="friend-request-send" style="width:auto;padding:8px 14px;margin-top:0;white-space:nowrap;">Send</button>
                        </div>
                        <div class="auth-error" id="friend-request-error" style="margin-top:6px;"></div>
                        <div class="auth-success" id="friend-request-success" style="margin-top:6px;"></div>
                    </div>

                    <div id="friend-pending-section" style="margin-bottom:10px;display:none;">
                        <label style="color:var(--green3);font-size:11px;text-transform:uppercase;font-weight:bold;">Pending Requests</label>
                        <div id="friend-pending-list" style="margin-top:6px;display:flex;flex-direction:column;gap:6px;"></div>
                    </div>

                    <div id="friend-sent-section" style="margin-bottom:10px;display:none;">
                        <label style="color:var(--green4);font-size:11px;text-transform:uppercase;font-weight:bold;">Sent Requests</label>
                        <div id="friend-sent-list" style="margin-top:6px;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#888;"></div>
                    </div>

                    <div id="friend-list-section">
                        <label style="color:var(--green3);font-size:11px;text-transform:uppercase;font-weight:bold;">Friends</label>
                        <div id="friend-list" style="margin-top:6px;display:flex;flex-direction:column;gap:6px;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(accountBackdropEl);

        accountBackdropEl.addEventListener('click', (e) => {
            if (e.target === accountBackdropEl) closeAccountPopup();
        });

        // Tab switching
        accountBackdropEl.querySelectorAll('.auth-tab[data-actab]').forEach(tab => {
            tab.addEventListener('click', () => {
                accountBackdropEl.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const which = tab.dataset.actab;
                document.getElementById('actab-profile').classList.toggle('hidden', which !== 'profile');
                document.getElementById('actab-friends').classList.toggle('hidden', which !== 'friends');
                if (which === 'friends') refreshFriendsUI();
            });
        });

        document.getElementById('account-username').textContent = getUsername() || 'User';
        document.getElementById('account-logout-btn').addEventListener('click', logout);

        // Friend request send
        document.getElementById('friend-request-send').addEventListener('click', async () => {
            const input = document.getElementById('friend-request-input');
            const errEl = document.getElementById('friend-request-error');
            const successEl = document.getElementById('friend-request-success');
            const target = input.value.trim();
            if (!target) { errEl.textContent = 'Enter a username.'; errEl.classList.add('visible'); return; }
            errEl.classList.remove('visible');
            successEl.classList.remove('visible');
            try {
                await sendFriendRequest(target);
                input.value = '';
                successEl.textContent = 'Request sent!'; successEl.classList.add('visible');
                refreshFriendsUI();
            } catch (e) {
                errEl.textContent = e.message; errEl.classList.add('visible');
            }
        });
        document.getElementById('friend-request-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('friend-request-send').click();
        });
    }

    async function refreshFriendsUI() {
        try {
            const [friendsData, requestsData, sentData] = await Promise.all([
                getFriends(), getFriendRequests(), getFriendRequestsSent()
            ]);

            // Friends list
            const list = document.getElementById('friend-list');
            if (list) {
                const f = friendsData.friends || [];
                list.innerHTML = f.length ? f.map(name =>
                    `<div style="padding:6px 8px;border:1px solid var(--green4);color:var(--green2);font-size:13px;">${name}</div>`
                ).join('') : '<div style="color:var(--green4);font-size:12px;">No friends yet.</div>';
            }

            // Pending received
            const reqs = requestsData.requests || [];
            const pendingSection = document.getElementById('friend-pending-section');
            const pendingList = document.getElementById('friend-pending-list');
            if (pendingSection && pendingList) {
                if (reqs.length) {
                    pendingSection.style.display = 'block';
                    pendingList.innerHTML = reqs.map(name => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border:1px solid var(--green4);font-size:13px;color:var(--green2);">
                            <span>${name}</span>
                            <div style="display:flex;gap:4px;">
                                <button class="auth-btn friend-accept-btn" data-username="${name}" style="width:auto;padding:4px 10px;margin-top:0;font-size:11px;min-width:0;">Accept</button>
                                <button class="auth-btn friend-decline-btn" data-username="${name}" style="width:auto;padding:4px 10px;margin-top:0;font-size:11px;min-width:0;color:#ff6b6b;border-color:#ff6b6b;">Decline</button>
                            </div>
                        </div>
                    `).join('');
                    pendingList.querySelectorAll('.friend-accept-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            try {
                                await acceptFriendRequest(btn.dataset.username);
                                refreshFriendsUI();
                            } catch (e) { alert(e.message); }
                        });
                    });
                    pendingList.querySelectorAll('.friend-decline-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            try {
                                await declineFriendRequest(btn.dataset.username);
                                refreshFriendsUI();
                            } catch (e) { alert(e.message); }
                        });
                    });
                } else {
                    pendingSection.style.display = 'none';
                }
            }

            // Sent requests
            const sent = sentData.sent || [];
            const sentSection = document.getElementById('friend-sent-section');
            const sentList = document.getElementById('friend-sent-list');
            if (sentSection && sentList) {
                if (sent.length) {
                    sentSection.style.display = 'block';
                    sentList.innerHTML = sent.map(name =>
                        `<div>→ ${name}</div>`
                    ).join('');
                } else {
                    sentSection.style.display = 'none';
                }
            }
        } catch {}
    }

    function openAccountPopup() {
        buildAccountPopup();
        const el = document.getElementById('account-deck-count');
        if (el) {
            try {
                const decks = JSON.parse(localStorage.getItem('mythiqo_decks') || '[]');
                el.textContent = decks.length;
            } catch { el.textContent = '0'; }
        }
        // Show profile tab by default, reset tabs
        accountBackdropEl.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        const profileTab = accountBackdropEl.querySelector('[data-actab="profile"]');
        if (profileTab) profileTab.classList.add('active');
        document.getElementById('actab-profile').classList.remove('hidden');
        document.getElementById('actab-friends').classList.add('hidden');
        accountBackdropEl.classList.add('active');
    }

    function closeAccountPopup() {
        if (accountBackdropEl) accountBackdropEl.classList.remove('active');
    }

    // ─── Profile Icon ───────────────────────────────────────────────────────

    function buildIcon() {
        if (iconEl) return;
        const topbars = document.querySelectorAll('.topbar');
        if (!topbars.length) return;
        const topbar = topbars[0];

        iconEl = document.createElement('button');
        iconEl.className = 'auth-icon';
        iconEl.id = 'auth-icon';
        iconEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>`;
        iconEl.title = 'Account';
        iconEl.addEventListener('click', () => {
            if (isLoggedIn()) {
                openAccountPopup();
            } else {
                openLoginModal();
            }
        });

        topbar.insertBefore(iconEl, topbar.firstChild);
        updateIconUI();
    }

    function updateIconUI() {
        if (iconEl) {
            iconEl.classList.toggle('logged-in', isLoggedIn());
            iconEl.title = isLoggedIn() ? `Logged in as ${getUsername()}` : 'Login / Register';
        }
    }

    // ─── Deck Persistence Patching ──────────────────────────────────────────

    function patchDeckPersistence() {
        if (!window.CardDetailsShared) {
            setTimeout(patchDeckPersistence, 100);
            return;
        }
        const origSave = window.CardDetailsShared.saveDecks;
        if (origSave.__patched) return;
        window.CardDetailsShared.saveDecks = function(decks) {
            localStorage.setItem('mythiqo_decks', JSON.stringify(decks));
            if (isLoggedIn()) syncDecksToServer(decks);
        };
        window.CardDetailsShared.saveDecks.__patched = true;

        const origLoad = window.CardDetailsShared.loadDecks;
        if (origLoad.__patched) return;
        window.CardDetailsShared.loadDecks = function() {
            const stored = localStorage.getItem('mythiqo_decks');
            return stored ? JSON.parse(stored) : [];
        };
        window.CardDetailsShared.loadDecks.__patched = true;
    }

    function init() {
        patchDeckPersistence();
        if (isLoggedIn()) {
            syncDecksFromServer().catch(() => {});
        }
        buildIcon();
    }

    function initHomepage() {
        const container = document.querySelector('.container');
        if (!container) return;
        const btnRow = container.querySelector('.button-row');
        if (!btnRow) return;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px;';

        const icon = document.createElement('button');
        icon.className = 'auth-icon';
        icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>`;
        icon.title = 'Account';
        icon.style.width = '40px'; icon.style.height = '40px';
        icon.addEventListener('click', () => {
            if (isLoggedIn()) {
                openAccountPopup();
            } else {
                openLoginModal();
            }
        });

        row.appendChild(icon);
        btnRow.parentNode.insertBefore(row, btnRow.nextSibling);

        if (isLoggedIn()) {
            icon.classList.add('logged-in');
            icon.title = `Logged in as ${getUsername()}`;
            syncDecksFromServer().catch(() => {});
        }

        iconEl = icon;
    }

    if (document.querySelector('.topbar')) {
        document.addEventListener('DOMContentLoaded', init);
        if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    } else if (document.querySelector('.mana-bg')) {
        document.addEventListener('DOMContentLoaded', initHomepage);
        if (document.readyState === 'complete' || document.readyState === 'interactive') initHomepage();
    }

    window.Auth = {
        isLoggedIn, getUsername, getToken,
        login, register, logout,
        syncDecksFromServer, syncDecksToServer
    };
})();
