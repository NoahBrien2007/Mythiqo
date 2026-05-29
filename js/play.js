(function() {
    // ─── DOM refs ────────────────────────────────────────────────────────────
    const screens = {
        lobby: document.getElementById('play-lobby'),
        host: document.getElementById('play-host'),
        join: document.getElementById('play-join'),
        waiting: document.getElementById('play-waiting'),
        password: document.getElementById('play-password-prompt'),
        match: document.getElementById('play-match'),
    };

    const boardEl = document.getElementById('play-board');
    const handArea = document.getElementById('play-hand-area');
    const handCards = document.getElementById('play-hand-cards');
    const handHeader = document.getElementById('play-hand-header');
    const chatMessages = document.getElementById('play-chat-messages');
    const actionList = document.getElementById('play-action-list');
    const actionSearch = document.getElementById('action-search');
    const zoneOverlay = document.getElementById('zone-detail-overlay');
    const zoneTitle = document.getElementById('zone-detail-title');
    const zoneList = document.getElementById('zone-detail-list');
    const tokenOverlay = document.getElementById('play-token-overlay');
    const tokenList = document.getElementById('token-list');
    const tokenSearch = document.getElementById('token-search');
    const tokenCount = document.getElementById('token-count');
    const tokenTarget = document.getElementById('token-target');
    const endBtn = document.getElementById('play-end-btn');

    // ─── State ──────────────────────────────────────────────────────────────
    let currentMatchId = null;
    let myMatch = null;
    let gameState = null;
    let currentTurn = 0;
    let myIdx = -1;
    let pollTimer = null;
    let cardMenuEl = null;
    let lifePopupEl = null;
    let dragData = null;
    let selectedToken = null;
    let primaryIdx = -1;
    let manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

    const CARD_BACK = 'https://gamepedia.cursecdn.com/mtgsalvation_gamepedia/f/f8/Magic_card_back.jpg';
    const EMPTY_DRAG_IMG = (() => { const i = new Image(); i.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; return i; })();

    // ─── Helpers ────────────────────────────────────────────────────────────
    function getDecks() {
        try { return JSON.parse(localStorage.getItem('mythiqo_decks') || '[]'); } catch { return []; }
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function showScreen(name) {
        Object.keys(screens).forEach(k => screens[k].classList.toggle('hidden', k !== name));
    }

    function getUsername() {
        return (window.Auth && window.Auth.getUsername ? window.Auth.getUsername() : '') || localStorage.getItem('mythiqo_username') || '';
    }

    function isLoggedIn() {
        return window.Auth && window.Auth.isLoggedIn ? window.Auth.isLoggedIn() : !!localStorage.getItem('mythiqo_auth_token');
    }

    async function api(path, method, body) {
        const url = window.location.origin + path;
        const headers = { 'Content-Type': 'application/json' };
        const token = window.Auth && window.Auth.getToken ? window.Auth.getToken() : localStorage.getItem('mythiqo_auth_token');
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

    function logEvent(msg, important) {
        const el = document.createElement('div');
        el.className = 'chat-msg' + (important ? ' chat-msg-important' : '');
        el.textContent = msg;
        chatMessages.appendChild(el);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ─── Custom Select Init ─────────────────────────────────────────────────
    function initCustomSelects() {
        document.querySelectorAll('.custom-select').forEach(container => {
            const btn = container.querySelector('.select-btn');
            const menu = container.querySelector('.select-menu');
            const options = container.querySelectorAll('.select-option');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.select-menu').forEach(m => { if (m !== menu) m.classList.remove('active'); });
                document.querySelectorAll('.select-btn').forEach(b => { if (b !== btn) b.classList.remove('active'); });
                menu.classList.toggle('active');
                btn.classList.toggle('active');
            });
            options.forEach(opt => {
                opt.addEventListener('click', () => {
                    btn.firstChild.textContent = opt.textContent;
                    menu.classList.remove('active');
                    btn.classList.remove('active');
                    container.dispatchEvent(new CustomEvent('selectchange', { detail: opt.textContent }));
                });
            });
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('.select-menu').forEach(m => m.classList.remove('active'));
            document.querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
        });
    }

    function getSelectValue(id) {
        const container = document.getElementById(id);
        if (!container) return '';
        const btn = container.querySelector('.select-btn');
        return btn ? btn.firstChild.textContent.trim() : '';
    }

    function populateDeckSelect(containerId, selectText) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const menu = container.querySelector('.select-menu');
        const btn = container.querySelector('.select-btn');
        if (!menu) return;
        const decks = getDecks();
        menu.innerHTML = '';
        if (!decks.length) {
            const opt = document.createElement('div');
            opt.className = 'select-option';
            opt.textContent = 'No decks found';
            menu.appendChild(opt);
            return;
        }
        decks.forEach(d => {
            const opt = document.createElement('div');
            opt.className = 'select-option';
            opt.textContent = d.name + (d.commander ? ' (' + d.commander.name + ')' : '');
            opt.dataset.deckId = d.id;
            menu.appendChild(opt);
        });
        menu.querySelectorAll('.select-option').forEach(opt => {
            opt.addEventListener('click', () => {
                btn.firstChild.textContent = opt.textContent;
                menu.classList.remove('active');
                btn.classList.remove('active');
                container.dispatchEvent(new CustomEvent('selectchange', { detail: opt.textContent }));
            });
        });
        btn.firstChild.textContent = selectText || '-- Select a deck --';
    }

    // ─── Lobby ──────────────────────────────────────────────────────────────
    document.getElementById('lobby-host-btn').addEventListener('click', () => showScreen('host'));
    document.getElementById('lobby-join-btn').addEventListener('click', () => {
        refreshJoinList();
        showScreen('join');
    });
    document.getElementById('host-back-btn').addEventListener('click', () => showScreen('lobby'));

    // ─── Host ───────────────────────────────────────────────────────────────
    const hostOppBots = document.getElementById('host-opp-bots');
    const hostOppPlayers = document.getElementById('host-opp-players');
    const hostBotSection = document.getElementById('host-bot-section');
    const hostPlayerSection = document.getElementById('host-player-section');

    hostOppBots.addEventListener('click', () => {
        hostOppBots.classList.add('active');
        hostOppPlayers.classList.remove('active');
        hostBotSection.classList.remove('hidden');
        hostPlayerSection.classList.add('hidden');
    });
    hostOppPlayers.addEventListener('click', () => {
        hostOppPlayers.classList.add('active');
        hostOppBots.classList.remove('active');
        hostBotSection.classList.add('hidden');
        hostPlayerSection.classList.remove('hidden');
    });

    document.getElementById('select-host-players').addEventListener('selectchange', (e) => {
        const val = e.detail;
        const count = parseInt(val, 10) || 2;
        const botCount = count - 1;
        ['host-bot1', 'host-bot2', 'host-bot3'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.style.display = i < botCount ? '' : 'none';
        });
    });

    document.getElementById('host-create-btn').addEventListener('click', async () => {
        if (!isLoggedIn()) { alert('You must be logged in to host.'); return; }
        const format = getSelectValue('select-host-format').toLowerCase();
        if (!format) { alert('Select a format.'); return; }
        const withBots = hostOppBots.classList.contains('active');
        let data = { format, withBots };
        if (withBots) {
            const playersVal = getSelectValue('select-host-players');
            const totalPlayers = parseInt(playersVal, 10) || 4;
            data.maxPlayers = totalPlayers;
            data.botNames = [];
            for (let i = 1; i < totalPlayers; i++) {
                const el = document.getElementById('host-bot' + i);
                data.botNames.push(el ? el.value.trim() || ('Bot ' + i) : 'Bot ' + i);
            }
        } else {
            data.maxPlayers = parseInt(getSelectValue('select-host-max'), 10) || 4;
            const name = document.getElementById('host-match-name').value.trim();
            if (!name) { alert('Enter a match name.'); return; }
            data.name = name;
            data.password = document.getElementById('host-password').value.trim();
        }
        try {
            const result = await api('/api/matches/create', 'POST', data);
            currentMatchId = result.matchId;
            myMatch = result.match;
            console.log('[PLAY] createMatch: withBots=' + withBots + ' matchId=' + result.matchId);
            if (withBots) {
                enterWaitingRoom();
            } else {
                enterMatchLobby();
            }
        } catch (e) {
            alert('Failed to create: ' + e.message);
        }
    });

    // ─── Join ───────────────────────────────────────────────────────────────
    document.getElementById('join-back-btn').addEventListener('click', () => showScreen('lobby'));
    document.getElementById('join-refresh-btn').addEventListener('click', refreshJoinList);

    async function refreshJoinList() {
        const listEl = document.getElementById('join-match-list');
        const emptyEl = document.getElementById('join-empty');
        try {
            const data = await api('/api/matches', 'GET');
            const matches = data.matches || [];
            if (!matches.length) { listEl.innerHTML = ''; emptyEl.style.display = 'block'; return; }
            emptyEl.style.display = 'none';
            listEl.innerHTML = matches.map(m => {
                const pwIcon = m.hasPassword ? ' <span style="color:var(--green4);font-size:10px;">[LOCKED]</span>' : '';
                return '<div class="join-match-card">' +
                    '<div class="join-match-name">' + m.name + pwIcon + '</div>' +
                    '<div class="join-match-info">' + m.format + ' &middot; Host: ' + m.host + ' &middot; ' + m.players.length + '/' + m.maxPlayers + ' players</div>' +
                    '<button class="btn join-match-join-btn" data-match-id="' + m.id + '" data-has-pw="' + m.hasPassword + '">JOIN</button></div>';
            }).join('');
            listEl.querySelectorAll('.join-match-join-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const mid = btn.dataset.matchId;
                    const hasPw = btn.dataset.hasPw === 'true';
                    if (hasPw) {
                        document.getElementById('pw-match-name').textContent = btn.closest('.join-match-card').querySelector('.join-match-name').textContent.trim();
                        document.getElementById('pw-input').value = '';
                        document.getElementById('pw-join-btn').dataset.matchId = mid;
                        showScreen('password');
                    } else {
                        await joinMatch(mid, '');
                    }
                });
            });
        } catch (e) {
            listEl.innerHTML = '<div class="play-empty">Error: ' + e.message + '</div>';
            emptyEl.style.display = 'none';
        }
    }

    document.getElementById('pw-cancel-btn').addEventListener('click', () => showScreen('join'));
    document.getElementById('pw-join-btn').addEventListener('click', async () => {
        const mid = document.getElementById('pw-join-btn').dataset.matchId;
        const pw = document.getElementById('pw-input').value.trim();
        await joinMatch(mid, pw);
    });
    document.getElementById('pw-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('pw-join-btn').click();
    });

    async function joinMatch(mid, password) {
        if (!isLoggedIn()) { alert('You must be logged in.'); return; }
        try {
            const result = await api('/api/matches/join', 'POST', { matchId: mid, password });
            currentMatchId = mid;
            localStorage.removeItem('match_initted_' + currentMatchId);
            myMatch = result.match;
            console.log('[PLAY] joinMatch: hasGameState=' + !!(result.match && result.match.gameState));
            // If the match auto-started (full capacity), go straight to deck select
            if (result.match && result.match.gameState) {
                showScreen('match');
                document.getElementById('play-match').classList.add('active');
                showDeckSelect();
                return;
            }
            enterMatchLobby();
        } catch (e) {
            alert('Failed to join: ' + e.message);
        }
    }

    // ─── Waiting Room (bot matches only) ────────────────────────────────────
    function enterWaitingRoom() {
        if (currentMatchId) localStorage.removeItem('match_initted_' + currentMatchId);
        showScreen('waiting');
        updateWaitingUI();
        startPolling();
    }

    // ─── Match Lobby (player matches — auto-starts on join) ────────────────
    function enterMatchLobby() {
        console.log('[PLAY] enterMatchLobby: matchId=' + currentMatchId);
        if (currentMatchId) localStorage.removeItem('match_initted_' + currentMatchId);
        showScreen('match');
        document.getElementById('play-match').classList.add('active');
        document.getElementById('play-token-overlay').classList.add('hidden');
        showMatchWaiting('Waiting for opponent to join...');
        startPolling();
    }

    function showMatchWaiting(msg) {
        console.log('[PLAY] showMatchWaiting: msg=' + msg);
        let overlay = document.getElementById('match-waiting-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'match-waiting-overlay';
            overlay.className = 'play-deck-overlay visible';
            overlay.innerHTML =
                '<div class="play-overlay-panel">' +
                '<div class="play-overlay-header" id="match-waiting-header">' + msg + '</div>' +
                '<div class="play-waiting-msg" id="match-waiting-msg">' + msg + '</div>' +
                '<button class="play-btn-end" id="match-waiting-cancel-btn" style="margin-top:15px;">CANCEL</button>' +
                '</div>';
            document.getElementById('play-match').appendChild(overlay);
            document.getElementById('match-waiting-cancel-btn').addEventListener('click', async () => {
                if (!currentMatchId) return;
                try { await api('/api/matches/leave', 'POST', { matchId: currentMatchId }); } catch { }
                stopPolling();
                currentMatchId = null;
                myMatch = null;
                gameState = null;
                showScreen('lobby');
            });
        }
        const hdr = document.getElementById('match-waiting-header');
        const msgEl = document.getElementById('match-waiting-msg');
        if (hdr) hdr.textContent = 'Waiting for Player';
        if (msgEl) msgEl.textContent = msg;
    }

    function hideMatchWaiting() {
        console.log('[PLAY] hideMatchWaiting');
        const el = document.getElementById('match-waiting-overlay');
        if (el) { el.remove(); console.log('[PLAY] hideMatchWaiting: removed'); }
        else { console.log('[PLAY] hideMatchWaiting: not found'); }
    }

    function updateMatchWaiting() {
        if (!myMatch) return;
        const count = myMatch.players ? myMatch.players.length : 0;
        const max = myMatch.maxPlayers || '?';
        const msg = count + '/' + max + ' players joined. Waiting for opponent' + (count < max ? ' (' + (max - count) + ' more needed)' : '') + '...';
        showMatchWaiting(msg);
    }

    function updateWaitingUI() {
        if (!myMatch) return;
        const titleEl = document.getElementById('waiting-title');
        const infoEl = document.getElementById('waiting-match-info');
        const playersEl = document.getElementById('waiting-players');
        const startBtn = document.getElementById('waiting-start-btn');
        const leaveBtn = document.getElementById('waiting-leave-btn');
        const username = getUsername();
        const isHost = myMatch.host === username;
        titleEl.textContent = myMatch.name || 'Waiting Room';
        infoEl.innerHTML = '<div style="color:var(--green4);font-size:12px;text-transform:uppercase;letter-spacing:1px;">' + (myMatch.format || 'Format') + '</div>' +
            '<div style="margin-top:4px;font-size:13px;color:var(--green3);">Host: ' + myMatch.host + ' &middot; ' + (myMatch.players ? myMatch.players.length : 0) + '/' + (myMatch.maxPlayers || '?') + ' players</div>';
        if (myMatch.withBots) {
            infoEl.innerHTML += '<div style="margin-top:4px;font-size:12px;color:var(--green4);">Bot match &middot; Starting soon...</div>';
        }
        if (myMatch.players) {
            playersEl.innerHTML = myMatch.players.map(p =>
                '<div class="waiting-player' + (p === myMatch.host ? ' waiting-player-host' : '') + '">' +
                '<span>' + p + '</span>' +
                (p === myMatch.host ? '<span style="font-size:10px;color:var(--green4);">HOST</span>' : '') +
                (p === username ? '<span style="font-size:10px;color:var(--green2);">YOU</span>' : '') +
                '</div>'
            ).join('');
        }
        if (isHost) {
            startBtn.classList.remove('hidden');
            startBtn.textContent = myMatch.withBots ? 'START MATCH' : 'START MATCH (' + (myMatch.maxPlayers - myMatch.players.length) + ' more needed)';
            startBtn.disabled = myMatch.players.length < myMatch.maxPlayers && !myMatch.withBots;
        } else {
            startBtn.classList.add('hidden');
        }
        leaveBtn.textContent = isHost ? 'CANCEL MATCH' : 'LEAVE MATCH';
    }

    document.getElementById('waiting-start-btn').addEventListener('click', async () => {
        if (!currentMatchId) return;
        try {
            const result = await api('/api/matches/start', 'POST', { matchId: currentMatchId });
            myMatch = result.match;
            stopPolling();
            showDeckSelect();
        } catch (e) {
            alert('Failed to start: ' + e.message);
        }
    });

    document.getElementById('waiting-leave-btn').addEventListener('click', async () => {
        if (!currentMatchId) return;
        try { await api('/api/matches/leave', 'POST', { matchId: currentMatchId }); } catch {}
        stopPolling();
        currentMatchId = null;
        myMatch = null;
        showScreen('lobby');
    });

    function startPolling() {
        stopPolling();
        let pollBusy = false;

        async function pollOnce() {
            if (!currentMatchId || pollBusy) { schedule(); return; }
            pollBusy = true;
            try {
                const data = await api('/api/matches/' + currentMatchId, 'GET');
                const m = data.match;
                console.log('[PLAY] poll: match=' + !!m + ' gs=' + !!(m && m.gameState) + ' players=' + (m && m.gameState && m.gameState.players ? m.gameState.players.length : 0));
                if (!m) { console.log('[PLAY] poll: no match'); if (myMatch && myMatch.withBots) { updateWaitingUI(); } else { updateMatchWaiting(); } return; }
                myMatch = m;

                if (m.gameState && m.gameState.players) {
                    console.log('[PLAY] poll: GS! allInit=' + m.gameState.allInit + ' initted=' + localStorage.getItem('match_initted_' + currentMatchId) + ' deckSelectVisible=' + document.getElementById('play-match').classList.contains('deck-select-mode'));
                    stopPolling();
                    if (!localStorage.getItem('match_initted_' + currentMatchId)) {
                        console.log('[PLAY] poll: -> showDeckSelect');
                        showDeckSelect();
                        return;
                    }
                    if (m.gameState.allInit) {
                        gameState = m.gameState;
                        startMatch();
                        startStatePolling();
                        return;
                    }
                    if (!document.getElementById('deck-waiting-overlay')) {
                        showDeckWaiting();
                        startDeckWaitingPolling();
                    }
                    return;
                }

                console.log('[PLAY] poll: no GS yet, withBots=' + (myMatch && myMatch.withBots));
                if (myMatch && myMatch.withBots) {
                    updateWaitingUI();
                } else {
                    updateMatchWaiting();
                }
            } catch (e) {
                console.log('[PLAY] poll ERROR: ' + e.message);
                if (e.message && (e.message.includes('404') || e.message.includes('Not found'))) {
                    stopPolling();
                    currentMatchId = null;
                    myMatch = null;
                    showScreen('lobby');
                }
            } finally {
                pollBusy = false;
                if (pollTimer !== null) schedule();
            }
        }

        function schedule() { pollTimer = setTimeout(pollOnce, 500); }
        pollTimer = setTimeout(pollOnce, 0);
    }

    function stopPolling() {
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    }

    // ─── Deck Select Overlay ───────────────────────────────────────────────
    function showDeckSelect() {
        console.log('[PLAY] showDeckSelect ENTER');
        hideMatchWaiting();
        showScreen('match');
        document.getElementById('play-match').classList.add('active');
        document.getElementById('play-token-overlay').classList.add('hidden');
        document.getElementById('play-match').classList.add('deck-select-mode');
        populateDeckSelect('select-game-deck', '-- Select your deck --');
    }

    function showDeckWaiting() {
        document.getElementById('play-match').classList.remove('deck-select-mode');
        const existing = document.getElementById('deck-waiting-overlay');
        if (existing) return;
        const overlay = document.createElement('div');
        overlay.id = 'deck-waiting-overlay';
        overlay.className = 'play-deck-overlay visible';
        overlay.innerHTML = '<div class="play-overlay-panel"><div class="play-overlay-header">Waiting for Opponents</div><div class="play-waiting-msg">Waiting for other players to select their decks...</div></div>';
        document.getElementById('play-match').appendChild(overlay);
    }

    function hideDeckWaiting() {
        const el = document.getElementById('deck-waiting-overlay');
        if (el) el.remove();
    }

    document.getElementById('deck-confirm-btn').addEventListener('click', async () => {
        const deckText = document.querySelector('#select-game-deck .select-btn').firstChild.textContent.trim();
        if (!deckText || deckText === '-- Select your deck --' || deckText === 'No decks found') {
            alert('Select a deck first.');
            return;
        }
        const decks = getDecks();
        const deck = decks.find(d => {
            const label = d.name + (d.commander ? ' (' + d.commander.name + ')' : '');
            return label === deckText;
        });
        if (!deck) { alert('Deck not found.'); return; }
        try {
            const result = await api('/api/matches/deck', 'POST', { matchId: currentMatchId, deck });
            localStorage.setItem('match_initted_' + currentMatchId, '1');
            gameState = result.state;
            if (result.state && result.state.allInit) {
                document.getElementById('play-match').classList.remove('deck-select-mode');
                startMatch();
                startStatePolling();
            } else {
                showDeckWaiting();
                startDeckWaitingPolling();
            }
        } catch (e) {
            alert('Failed to init: ' + e.message);
        }
    });

    function startDeckWaitingPolling() {
        stopPolling();
        let busy = false;

        async function pollOnce() {
            if (!currentMatchId || busy) { schedule(); return; }
            busy = true;
            try {
                const data = await api('/api/matches/' + currentMatchId, 'GET');
                if (data.match && data.match.gameState) {
                    const newState = data.match.gameState;
                    if (newState.allInit) {
                        stopPolling();
                        hideDeckWaiting();
                        gameState = newState;
                        startMatch();
                        startStatePolling();
                        return;
                    }
                    if (newState.log && gameState && newState.log.length > (gameState.log ? gameState.log.length : 0)) {
                        const newMsgs = newState.log.slice(gameState.log ? gameState.log.length : 0);
                        newMsgs.forEach(msg => logEvent(msg));
                        gameState = newState;
                    }
                }
            } catch (e) {
                if (e.message && (e.message.includes('404') || e.message.includes('Not found'))) {
                    stopPolling();
                    hideDeckWaiting();
                    currentMatchId = null;
                    myMatch = null;
                    showScreen('lobby');
                    return;
                }
            }
            busy = false;
            if (pollTimer !== null) schedule();
        }

        function schedule() { pollTimer = setTimeout(pollOnce, 1000); }
        pollTimer = setTimeout(pollOnce, 0);
    }

    // ─── Game State Polling ─────────────────────────────────────────────────
    let statePollTimer = null;

    function startStatePolling() {
        stopStatePolling();
        let busy = false;

        async function pollOnce() {
            if (!currentMatchId || busy) { schedule(); return; }
            busy = true;
            try {
                const data = await api('/api/matches/' + currentMatchId, 'GET');
                if (data.match && data.match.gameState) {
                    const newState = data.match.gameState;
                    if (gameState && newState.log && newState.log.length > (gameState.log ? gameState.log.length : 0)) {
                        const newMsgs = newState.log.slice(gameState.log ? gameState.log.length : 0);
                        newMsgs.forEach(msg => logEvent(msg));
                    }
                    gameState = newState;
                    renderEverything();
                }
            } catch (e) {
                if (e.message && (e.message.includes('404') || e.message.includes('Not found'))) {
                    stopStatePolling();
                    endBtn.click();
                    return;
                }
            } finally {
                busy = false;
                if (statePollTimer !== null) schedule();
            }
        }

        function schedule() { statePollTimer = setTimeout(pollOnce, 1500); }
        statePollTimer = setTimeout(pollOnce, 0);
    }

    function stopStatePolling() {
        if (statePollTimer) { clearTimeout(statePollTimer); statePollTimer = null; }
    }

    // ─── Start Match ────────────────────────────────────────────────────────
    function startMatch() {
        if (!gameState || !gameState.players) return;
        myIdx = gameState.players.findIndex(p => p.name === getUsername());
        primaryIdx = myIdx;
        currentTurn = gameState.turn || 0;
        document.getElementById('play-chat').classList.add('visible');
        document.getElementById('play-end-btn').classList.add('visible');
        chatMessages.innerHTML = '';
        if (gameState.log) {
            gameState.log.forEach(msg => logEvent(msg, msg.includes('===')));
        }
        renderEverything();
        // Card hover preview via delegation
        setupCardPreview();
    }

    function setupCardPreview() {
        if (document.getElementById('play-match')._previewInited) return;
        document.getElementById('play-match')._previewInited = true;
        document.getElementById('play-match').addEventListener('mouseover', function(e) {
            const pa = document.getElementById('play-preview-area');
            if (!pa) return;
            const cardEl = e.target.closest('.bf-card, .hand-card, .zone-cell');
            if (cardEl === pa._lastCard) return;
            pa._lastCard = cardEl;
            if (!cardEl) { pa.innerHTML = '<div class="preview-placeholder">Hover a card to preview</div>'; return; }
            const img = cardEl.querySelector('img');
            if (!img) { pa.innerHTML = '<div class="preview-placeholder">Hover a card to preview</div>'; return; }
            let src = img.getAttribute('src') || img.src;
            if (src.startsWith('data:') || src === CARD_BACK) { pa.innerHTML = '<div class="preview-placeholder">Hover a card to preview</div>'; return; }
            const normal = src.replace(/\/small\//, '/normal/').replace(/\/png\//, '/normal/');
            pa.innerHTML = '<div class="preview-card-wrap"><img class="preview-card-img" src="' + normal + '" alt="preview"><div class="preview-card-name">' + (cardEl.closest('.bf-card, .zone-cell')?.querySelector('.bf-card-name')?.textContent || cardEl.querySelector('span')?.textContent || '') + '</div></div>';
        });
        const zo = document.getElementById('zone-detail-overlay');
        if (zo) zo.addEventListener('mouseover', function(e) {
            const pa = document.getElementById('play-preview-area');
            if (!pa) return;
            const cardEl = e.target.closest('.zone-detail-item');
            if (cardEl === pa._lastCard) return;
            pa._lastCard = cardEl;
            if (!cardEl) { pa.innerHTML = '<div class="preview-placeholder">Hover a card to preview</div>'; return; }
            const img = cardEl.querySelector('img');
            if (!img) { pa.innerHTML = '<div class="preview-placeholder">Hover a card to preview</div>'; return; }
            let src = img.getAttribute('src') || img.src;
            if (src.startsWith('data:') || src === CARD_BACK) { pa.innerHTML = '<div class="preview-placeholder">Hover a card to preview</div>'; return; }
            const normal = src.replace(/\/small\//, '/normal/').replace(/\/png\//, '/normal/');
            pa.innerHTML = '<div class="preview-card-wrap"><img class="preview-card-img" src="' + normal + '" alt="preview"><div class="preview-card-name">' + (cardEl.querySelector('span')?.textContent || '') + '</div></div>';
        });
    }

    // ─── Rendering ──────────────────────────────────────────────────────────
    function renderEverything() {
        renderBoard();
        renderHand();
        renderActions();
    }

    function renderBoard() {
        if (!gameState || !gameState.players) return;
        if (primaryIdx < 0 || !gameState.players[primaryIdx]) primaryIdx = myIdx;
        if (primaryIdx < 0) primaryIdx = gameState.activePlayer || 0;
        boardEl.innerHTML = '';
        const rightCol = document.getElementById('play-right-col');
        rightCol.innerHTML = '';

        // ── Primary player: battlefield (absolute positioning) ──
        const primary = gameState.players[primaryIdx];
        const bfCards = primary.battlefield || [];

        bfCards.forEach((card, ci) => {
            const el = document.createElement('div');
            let cls = 'bf-card';
            if (card.isToken) cls += ' token';
            if (card.tapped) cls += ' tapped';
            el.className = cls;
            el.draggable = true;
            let img;
            if (card.flipped && card.card_faces && card.card_faces[1] && card.card_faces[1].image_uris) {
                img = card.card_faces[1].image_uris.small || card.card_faces[1].image_uris.normal;
            } else {
                img = card.image_uris && card.image_uris.small ? card.image_uris.small
                    : (card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.small ? card.card_faces[0].image_uris.small : CARD_BACK);
            }
            el.innerHTML = '<img src="' + img + '" alt="' + (card.name || 'Token') + '"><div class="bf-card-name">' + (card.name || 'Token') + '</div>';

            const hasPos = card.posX !== undefined && card.posY !== undefined;
            if (hasPos) {
                el.style.left = card.posX + 'px';
                el.style.top = card.posY + 'px';
            } else {
                const cols = Math.max(1, Math.floor(boardEl.clientWidth / 90));
                el.style.left = (ci % cols) * 90 + 'px';
                el.style.top = Math.floor(ci / cols) * 125 + 'px';
            }

            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0);
                e.dataTransfer.effectAllowed = 'move';
                dragData = {
                    fromPlayer: primaryIdx, fromZone: 'battlefield', cardIdx: ci, card: card
                };
            });
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showCardActions(e, card, primaryIdx, 'battlefield', ci);
            });
            boardEl.appendChild(el);
        });

        // Board-level dragover/drop for battlefield (one-time listener setup)
        if (!boardEl._dragInited) {
            boardEl._dragInited = true;
            boardEl.addEventListener('dragend', () => {
                const g = document.querySelector('#play-board > .bf-card-ghost');
                if (g) g.remove();
            });
            boardEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!dragData) return;
                const b = document.getElementById('play-board');
                if (!b) return;
                let g = b.querySelector(':scope > .bf-card-ghost');
                if (!g) {
                    g = document.createElement('div');
                    g.className = 'bf-card-ghost';
                    const card = dragData.card;
                    const url = card.image_uris && card.image_uris.small ? card.image_uris.small
                        : (card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.small ? card.card_faces[0].image_uris.small : CARD_BACK);
                    g.innerHTML = '<img src="' + url + '" alt="">';
                    b.appendChild(g);
                }
                const r = b.getBoundingClientRect();
                g.style.left = (e.clientX - r.left - 41) + 'px';
                g.style.top = (e.clientY - r.top - 57) + 'px';
                g.style.display = 'block';
            });
            boardEl.addEventListener('dragleave', (e) => {
                const g = document.querySelector('#play-board > .bf-card-ghost');
                if (g && !boardEl.contains(e.relatedTarget)) {
                    g.style.display = 'none';
                }
            });
            boardEl.addEventListener('drop', (e) => {
                e.preventDefault();
                const g = document.querySelector('#play-board > .bf-card-ghost');
                if (g) g.remove();
                if (!dragData) return;
                const b = document.getElementById('play-board');
                if (!b) return;
                const r = b.getBoundingClientRect();
                const posX = Math.max(0, Math.min(e.clientX - r.left - 41, r.width - 82));
                const posY = Math.max(0, Math.min(e.clientY - r.top - 57, r.height - 115));
                const { fromPlayer, fromZone, cardIdx, card } = dragData;
                dragData = null;

                if (fromPlayer !== myIdx && (fromZone === 'hand' || fromZone === 'library')) return;

                doAction({ type: 'moveCard', card, from: fromZone, fromIdx: cardIdx, fromPlayer, to: 'battlefield', toPlayer: primaryIdx, posX, posY });
            });
        }

        // Empty battlefield placeholder
        if (!bfCards.length) {
            const empty = document.createElement('div');
            empty.className = 'bf-card-empty';
            boardEl.appendChild(empty);
        }

        // ── Right Column: other-players → preview-area → life+mana → zones ──
        // Other-players section (50% bigger)
        const otherSection = document.createElement('div');
        otherSection.className = 'play-other-section';
        gameState.players.forEach((p, idx) => {
            if (idx === primaryIdx) return;
            const other = document.createElement('div');
            other.className = 'play-other-player';
            other.dataset.player = idx;
            const isActive = idx === gameState.activePlayer;
            other.innerHTML = (isActive ? '<span class="active-turn-other"></span>' : '') +
                '<span class="other-name">' + p.name + '</span>' +
                '<span class="other-life">' + p.life + '</span>' +
                '<span class="other-count">H:' + (p.hand || []).length + ' B:' + (p.battlefield || []).length + '</span>';
            other.addEventListener('click', () => {
                const pIdx = parseInt(other.dataset.player, 10);
                if (pIdx === primaryIdx) return;
                primaryIdx = pIdx;
                renderEverything();
            });
            otherSection.appendChild(other);
        });
        rightCol.appendChild(otherSection);

        // Preview area for card hover
        const previewArea = document.createElement('div');
        previewArea.className = 'play-preview-area';
        previewArea.id = 'play-preview-area';
        previewArea.innerHTML = '<div class="preview-placeholder">Hover a card to preview</div>';
        rightCol.appendChild(previewArea);

        // Life + Mana row
        const lifeManaRow = document.createElement('div');
        lifeManaRow.className = 'play-life-mana-row';
        const manaSymbols = ['W', 'U', 'B', 'R', 'G', 'C'];
        const manaRow = document.createElement('div');
        manaRow.className = 'play-mana-row';
        manaSymbols.forEach(sym => {
            const el = document.createElement('div');
            el.className = 'play-mana-icon';
            el.dataset.sym = sym;
            el.innerHTML = '<i class="ms ms-' + sym.toLowerCase() + '"></i><span class="mana-count" id="mana-count-' + sym + '">' + (manaPool[sym] || 0) + '</span>';
            el.addEventListener('click', () => { manaPool[sym] = (manaPool[sym] || 0) + 1; updateManaUI(); });
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (manaPool[sym] > 0) { manaPool[sym]--; updateManaUI(); }
            });
            manaRow.appendChild(el);
        });
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn mana-reset-btn';
        resetBtn.textContent = 'RESET';
        resetBtn.addEventListener('click', () => { Object.keys(manaPool).forEach(k => manaPool[k] = 0); updateManaUI(); });
        manaRow.appendChild(resetBtn);
        lifeManaRow.appendChild(manaRow);

        // Life display
        const lifeDisplay = document.createElement('div');
        lifeDisplay.className = 'play-life-display';
        lifeDisplay.id = 'play-life-display';
        const primaryPlayer = gameState.players[primaryIdx];
        lifeDisplay.textContent = primaryPlayer.life;
        lifeDisplay.addEventListener('click', (e) => { showLifePopup(e, primaryIdx); });
        lifeManaRow.appendChild(lifeDisplay);
        rightCol.appendChild(lifeManaRow);

        // ── Zone grid ──
        const zoneGrid = document.createElement('div');
        zoneGrid.className = 'play-zone-grid';

        // CMD zone
        const cmdCell = document.createElement('div');
        cmdCell.className = 'zone-cell zone-cmd';
        const cmdCards = primary.commandZone || [];
        if (cmdCards.length && cmdCards[0].image_uris) {
            const cmdImg = cmdCards[0].image_uris && cmdCards[0].image_uris.normal ? cmdCards[0].image_uris.normal
                : (cmdCards[0].card_faces && cmdCards[0].card_faces[0].image_uris && cmdCards[0].card_faces[0].image_uris.normal ? cmdCards[0].card_faces[0].image_uris.normal : '');
            if (cmdImg) cmdCell.innerHTML = '<img src="' + cmdImg + '" alt="Commander">';
        }
        if (!cmdCell.innerHTML) cmdCell.textContent = 'CMD';
        cmdCell.innerHTML += '<div class="zone-count">' + cmdCards.length + '</div>';
        cmdCell.addEventListener('click', () => showZoneDetail(primaryIdx, 'commandZone', 'Command Zone'));
        cmdCell.addEventListener('dragover', (e) => e.preventDefault());
        cmdCell.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(e, primaryIdx, 'commandZone'); });
        zoneGrid.appendChild(cmdCell);

        // Library zone (card back only, no life overlay)
        const libCell = document.createElement('div');
        libCell.className = 'zone-cell zone-library';
        const libCards = primary.library || [];
        libCell.innerHTML = '<img src="' + CARD_BACK + '" alt="Library"><div class="zone-count">' + libCards.length + '</div>';
        libCell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showLibraryMenu(e, primaryIdx);
        });
        libCell.addEventListener('dragover', (e) => e.preventDefault());
        libCell.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(e, primaryIdx, 'library'); });
        zoneGrid.appendChild(libCell);

        // GY zone
        const gyCell = document.createElement('div');
        gyCell.className = 'zone-cell zone-gy';
        const gyCards = primary.graveyard || [];
        gyCell.innerHTML = '<div class="zone-diag-text">GRAVEYARD<span class="diag-count"> (' + gyCards.length + ')</span></div>';
        gyCell.addEventListener('click', () => showZoneDetail(primaryIdx, 'graveyard', 'Graveyard'));
        gyCell.addEventListener('dragover', (e) => e.preventDefault());
        gyCell.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(e, primaryIdx, 'graveyard'); });
        zoneGrid.appendChild(gyCell);

        // Exile zone
        const exCell = document.createElement('div');
        exCell.className = 'zone-cell zone-ex';
        const exCards = primary.exile || [];
        exCell.innerHTML = '<div class="zone-diag-text">EXILE<span class="diag-count"> (' + exCards.length + ')</span></div>';
        exCell.addEventListener('click', () => showZoneDetail(primaryIdx, 'exile', 'Exile'));
        exCell.addEventListener('dragover', (e) => e.preventDefault());
        exCell.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(e, primaryIdx, 'exile'); });
        zoneGrid.appendChild(exCell);

        rightCol.appendChild(zoneGrid);
    }

    function updateManaUI() {
        ['W','U','B','R','G','C'].forEach(sym => {
            const el = document.getElementById('mana-count-' + sym);
            if (el) el.textContent = manaPool[sym] || 0;
        });
    }

    // ─── Library Right-Click Menu ──────────────────────────────────────────
    function showLibraryMenu(e, playerIdx) {
        if (cardMenuEl) cardMenuEl.remove();
        cardMenuEl = document.createElement('div');
        cardMenuEl.className = 'card-context-menu';
        cardMenuEl.style.left = (e.clientX + 10) + 'px';
        cardMenuEl.style.top = e.clientY + 'px';

        const actions = [
            { label: 'Draw 1', action: { type: 'draw', count: 1 } },
            { label: 'Draw 7', action: { type: 'draw', count: 7 } },
            { label: 'Mill 1', action: { type: 'mill', count: 1 } },
            { label: 'Mill 5', action: { type: 'mill', count: 5 } },
            { label: 'Mill 10', action: { type: 'mill', count: 10 } },
            { label: 'Scry 1', action: { type: 'scry', count: 1 } },
            { label: 'Scry 3', action: { type: 'scry', count: 3 } },
            { label: 'Scry 5', action: { type: 'scry', count: 5 } },
            { label: 'Search Library', action: { type: 'search' } },
            { label: 'Shuffle Library', action: { type: 'shuffle' } },
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'card-context-option';
            btn.textContent = a.label;
            btn.addEventListener('click', async (e2) => {
                e2.stopPropagation();
                cardMenuEl.remove();
                cardMenuEl = null;
                await doAction(a.action);
            });
            cardMenuEl.appendChild(btn);
        });

        document.body.appendChild(cardMenuEl);
        setTimeout(() => {
            const closeMenu = (ev) => {
                if (cardMenuEl && !cardMenuEl.contains(ev.target)) {
                    cardMenuEl.remove();
                    cardMenuEl = null;
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    // ─── Drop with Position ────────────────────────────────────────────────
    function handleDropPosition(e, toPlayer, toZone, toIdx) {
        if (!dragData) return;
        const { fromPlayer, fromZone, cardIdx, card } = dragData;
        dragData = null;

        if (fromPlayer !== myIdx && (fromZone === 'hand' || fromZone === 'library')) return;
        if (toZone === 'hand' && toPlayer !== myIdx) return;

        doAction({ type: 'moveCard', card, from: fromZone, fromIdx: cardIdx, fromPlayer, to: toZone, toPlayer, toIdx });
    }

    // ─── Hand Rendering ────────────────────────────────────────────────────
    function renderHand() {
        if (myIdx < 0 || !gameState || !gameState.players[myIdx]) {
            handArea.classList.remove('visible');
            return;
        }
        handArea.classList.add('visible');
        const me = gameState.players[myIdx];
        const hand = me.hand || [];
        handHeader.textContent = 'Hand (' + hand.length + ')';
        handCards.innerHTML = '';

        hand.forEach((card, ci) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'hand-card';
            cardEl.draggable = true;
            const isHidden = typeof card === 'number' || card === 1 || card._hidden;
            if (isHidden) {
                cardEl.classList.add('hand-card-hidden');
                cardEl.innerHTML = '<img class="hand-card-img" src="' + CARD_BACK + '" alt="Card">';
            } else {
                const img = card.image_uris && card.image_uris.small ? card.image_uris.small
                    : (card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.small ? card.card_faces[0].image_uris.small : CARD_BACK);
                cardEl.innerHTML = '<img class="hand-card-img" src="' + img + '" alt="' + (card.name || 'Card') + '">';
            }
            cardEl.addEventListener('dragstart', (e) => {
                if (isHidden) { e.preventDefault(); return; }
                e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0);
                dragData = { fromPlayer: myIdx, fromZone: 'hand', cardIdx: ci, card: card };
                e.dataTransfer.effectAllowed = 'move';
            });
            if (!isHidden) {
                cardEl.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showCardActions(e, card, myIdx, 'hand', ci);
                });
            }
            handCards.appendChild(cardEl);
        });
    }

    // ─── Action Sidebar ────────────────────────────────────────────────────
    const ACTION_DEFS = [
        { id: 'draw', label: 'Draw', needs: 'library' },
        { id: 'mill1', label: 'Mill 1', needs: 'library', action: 'mill', count: 1 },
        { id: 'mill5', label: 'Mill 5', needs: 'library', action: 'mill', count: 5 },
        { id: 'mill10', label: 'Mill 10', needs: 'library', action: 'mill', count: 10 },
        { id: 'scry', label: 'Scry', needs: 'library' },
        { id: 'search', label: 'Search', needs: 'library' },
        { id: 'nextTurn', label: 'Next Turn' },
    ];

    function renderActions() {
        const q = (actionSearch.value || '').toLowerCase();
        actionList.innerHTML = '';
        if (!gameState || myIdx < 0) return;
        const me = gameState.players[myIdx];
        ACTION_DEFS.forEach(def => {
            if (q && !def.label.toLowerCase().includes(q)) return;
            const item = document.createElement('div');
            item.className = 'play-action-item';
            const disabled = def.needs === 'library' && (!me.library || me.library.length === 0);
            if (disabled) item.style.opacity = '0.35';
            item.innerHTML = '<span>' + def.label + '</span>';
            item.addEventListener('click', async () => {
                if (disabled) return;
                const action = { type: def.action || def.id };
                if (def.count) action.count = def.count;
                await doAction(action);
            });
            actionList.appendChild(item);
        });
    }

    actionSearch.addEventListener('input', renderActions);

    // ─── Perform Action ────────────────────────────────────────────────────
    async function doAction(action) {
        if (!currentMatchId) return;
        try {
            const result = await api('/api/matches/action', 'POST', { matchId: currentMatchId, action });
            if (result.state) {
                const newLog = result.state.log;
                if (gameState && gameState.log && newLog) {
                    const added = newLog.slice(gameState.log.length);
                    added.forEach(msg => logEvent(msg));
                }
                gameState = result.state;
                renderEverything();
            }
        } catch (e) {
            alert('Action failed: ' + e.message);
        }
    }

    document.getElementById('play-next-turn-btn').addEventListener('click', () => doAction({ type: 'nextTurn' }));
    document.getElementById('play-token-btn').addEventListener('click', showTokenPopup);

    // ─── Token Popup (Scryfall search) ─────────────────────────────────────
    let tokenSearchResults = [];
    let tokenLoading = false;

    function showTokenPopup() {
        selectedToken = null;
        document.getElementById('token-create-btn').disabled = true;
        tokenSearch.value = '';
        tokenList.innerHTML = '<div class="token-search-hint">Type a token name and press Enter to search Scryfall</div>';
        tokenSearchResults = [];
        tokenTarget.innerHTML = '';
        if (gameState && gameState.players) {
            gameState.players.forEach((p, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = p.name;
                tokenTarget.appendChild(opt);
            });
        }
        tokenOverlay.classList.remove('hidden');
        setTimeout(() => tokenSearch.focus(), 100);
    }

    tokenSearch.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const q = tokenSearch.value.trim();
            if (!q || tokenLoading) return;
            tokenLoading = true;
            tokenList.innerHTML = '<div class="token-search-hint">Searching...</div>';
            try {
                const url = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('t:' + q + ' (game:paper)');
                const resp = await fetch(url);
                const data = await resp.json();
                tokenSearchResults = data.data || [];
                renderTokenSearchResults();
            } catch {
                tokenList.innerHTML = '<div class="token-search-hint">Search failed. Try again.</div>';
            }
            tokenLoading = false;
        }
    });

    function renderTokenSearchResults() {
        tokenList.innerHTML = '';
        if (!tokenSearchResults.length) {
            tokenList.innerHTML = '<div class="token-search-hint">No results found.</div>';
            return;
        }
        tokenSearchResults.slice(0, 50).forEach(card => {
            const name = card.name || 'Unknown';
            const img = card.image_uris && card.image_uris.small ? card.image_uris.small
                : (card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.small ? card.card_faces[0].image_uris.small : '');
            const el = document.createElement('div');
            el.className = 'token-option' + (selectedToken && selectedToken.name === name ? ' selected' : '');
            if (img) el.innerHTML = '<img src="' + img + '" class="token-result-img">';
            el.innerHTML += '<span>' + name + '</span>';
            el.addEventListener('click', () => {
                document.querySelectorAll('.token-option').forEach(o => o.classList.remove('selected'));
                el.classList.add('selected');
                selectedToken = card;
                document.getElementById('token-create-btn').disabled = false;
            });
            tokenList.appendChild(el);
        });
    }

    document.getElementById('token-create-btn').addEventListener('click', async () => {
        if (!selectedToken) return;
        const count = parseInt(tokenCount.value, 10) || 1;
        const target = parseInt(tokenTarget.value, 10);
        const tokenData = {
            name: selectedToken.name || 'Token',
            image_uris: selectedToken.image_uris,
            card_faces: selectedToken.card_faces,
            oracle_text: selectedToken.oracle_text || '',
            power: selectedToken.power,
            toughness: selectedToken.toughness,
            type_line: selectedToken.type_line || 'Token',
            colors: selectedToken.colors || [],
            isToken: true,
        };
        await doAction({ type: 'createToken', token: tokenData, count, target });
        tokenOverlay.classList.add('hidden');
    });

    document.getElementById('token-cancel-btn').addEventListener('click', () => {
        tokenOverlay.classList.add('hidden');
    });

    // ─── Life Popup ─────────────────────────────────────────────────────────
    function showLifePopup(e, playerIdx) {
        if (lifePopupEl) lifePopupEl.remove();
        const rect = e.target.getBoundingClientRect();
        lifePopupEl = document.createElement('div');
        lifePopupEl.className = 'life-popup';
        lifePopupEl.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';
        lifePopupEl.style.top = (rect.bottom + 4) + 'px';
        lifePopupEl.innerHTML = '<input type="number" id="life-amount" value="0" step="1">' +
            '<div class="life-popup-actions"><button class="btn" data-amt="-1">-1</button><button class="btn" data-amt="1">+1</button><button class="btn" data-amt="-5">-5</button><button class="btn" data-amt="5">+5</button></div>' +
            '<div class="life-popup-actions"><button class="btn" id="life-apply">Apply to ' + (gameState.players[playerIdx].name) + '</button><button class="btn" id="life-cancel">Cancel</button></div>';
        document.body.appendChild(lifePopupEl);

        const input = lifePopupEl.querySelector('#life-amount');
        lifePopupEl.querySelectorAll('[data-amt]').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = parseInt(btn.dataset.amt, 10);
                input.value = parseInt(input.value, 10) + amt;
            });
        });
        lifePopupEl.querySelector('#life-apply').addEventListener('click', async () => {
            const amt = parseInt(input.value, 10) || 0;
            if (amt !== 0) {
                await doAction({ type: 'lifeChange', amount: amt, target: playerIdx });
            }
            lifePopupEl.remove();
            lifePopupEl = null;
        });
        lifePopupEl.querySelector('#life-cancel').addEventListener('click', () => {
            lifePopupEl.remove();
            lifePopupEl = null;
        });
    }

    document.addEventListener('click', (e) => {
        if (lifePopupEl && !lifePopupEl.contains(e.target) && !e.target.closest('.play-life-display') && !e.target.closest('.zone-life-overlay')) {
            lifePopupEl.remove();
            lifePopupEl = null;
        }
    });

    // ─── Zone Detail ────────────────────────────────────────────────────────
    function showZoneDetail(playerIdx, zoneKey, label) {
        if (!gameState || !gameState.players[playerIdx]) return;
        const items = gameState.players[playerIdx][zoneKey] || [];
        zoneTitle.textContent = gameState.players[playerIdx].name + '\'s ' + label + ' (' + items.length + ')';
        zoneList.innerHTML = '';

        items.forEach((card, ci) => {
            const item = document.createElement('div');
            item.className = 'zone-detail-item';
            item.draggable = true;
            const img = card.image_uris && card.image_uris.small ? card.image_uris.small
                : (card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.small ? card.card_faces[0].image_uris.small : '');
            if (img) item.innerHTML = '<img src="' + img + '" alt="">';
            item.innerHTML += '<span>' + (card.name || 'Unknown') + '</span>';

            item.addEventListener('dragstart', (e) => {
                dragData = { fromPlayer: playerIdx, fromZone: zoneKey, cardIdx: ci, card: card };
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showCardActions(e, card, playerIdx, zoneKey, ci);
            });
            zoneList.appendChild(item);
        });

        zoneOverlay.classList.remove('hidden');
    }

    document.getElementById('zone-detail-close').addEventListener('click', () => zoneOverlay.classList.add('hidden'));
    zoneOverlay.addEventListener('click', (e) => { if (e.target === zoneOverlay) zoneOverlay.classList.add('hidden'); });

    // ─── Drag and Drop ──────────────────────────────────────────────────────
    function handleDrop(e, toPlayer, toZone) {
        if (!dragData) return;
        const { fromPlayer, fromZone, cardIdx, card } = dragData;
        dragData = null;

        // Can't drag opponent's hand/library
        if (fromPlayer !== myIdx && (fromZone === 'hand' || fromZone === 'library')) return;
        // Can't put in opponent's hand
        if (toZone === 'hand' && toPlayer !== fromPlayer && toPlayer !== myIdx) return;
        // If dragging to opponent's hand and moving from your zone - only you can move to your hand
        if (toZone === 'hand' && toPlayer !== myIdx) return;

        doAction({ type: 'moveCard', card, from: fromZone, fromIdx: cardIdx, fromPlayer, to: toZone, toPlayer });
    }

    // ─── Card Actions Menu ─────────────────────────────────────────────────
    function showCardActions(e, card, playerIdx, zone, cardIdx) {
        if (cardMenuEl) cardMenuEl.remove();
        cardMenuEl = document.createElement('div');
        cardMenuEl.className = 'card-context-menu';
        cardMenuEl.style.left = (e.clientX + 8) + 'px';
        cardMenuEl.style.top = e.clientY + 'px';

        const actions = [];
        const isMyZone = playerIdx === myIdx;

        if (zone === 'hand' && isMyZone) {
            actions.push({ label: 'Play', action: { type: 'play', handIdx: cardIdx } });
            actions.push({ label: 'Discard', action: { type: 'discard', handIdx: cardIdx } });
            actions.push({ label: 'Exile', action: { type: 'exile', from: 'hand', idx: cardIdx } });
        }
        if (zone === 'graveyard') {
            if (isMyZone) {
                actions.push({ label: 'Exile from GY', action: { type: 'exile', from: 'graveyard', idx: cardIdx } });
                if (gameState.players[playerIdx].commander && card.name === gameState.players[playerIdx].commander) {
                    actions.push({ label: 'Return Cmd to CZ', action: { type: 'returnCmd' } });
                }
            }
            actions.push({ label: 'Move to Hand', action: { type: 'moveCard', card, from: 'graveyard', fromIdx: cardIdx, fromPlayer: playerIdx, to: 'hand', toPlayer: playerIdx } });
        }
        if (zone === 'exile' && isMyZone) {
            actions.push({ label: 'Move to Hand', action: { type: 'moveCard', card, from: 'exile', fromIdx: cardIdx, fromPlayer: playerIdx, to: 'hand', toPlayer: playerIdx } });
        }
        if (zone === 'commandZone' && isMyZone) {
            actions.push({ label: 'Cast Commander', action: { type: 'castCmd' } });
        }
        if (zone === 'battlefield') {
            actions.push({ label: 'Tap', action: { type: 'tap', targetPlayer: playerIdx, cardIdx } });
            actions.push({ label: 'Flip', action: { type: 'flip', targetPlayer: playerIdx, cardIdx } });
            if (isMyZone) {
                actions.push({ label: 'Return to Hand', action: { type: 'moveCard', card, from: 'battlefield', fromIdx: cardIdx, fromPlayer: playerIdx, to: 'hand', toPlayer: playerIdx } });
            }
            actions.push({ label: 'Exile', action: { type: 'moveCard', card, from: 'battlefield', fromIdx: cardIdx, fromPlayer: playerIdx, to: 'exile', toPlayer: playerIdx } });
            actions.push({ label: 'Destroy', action: { type: 'moveCard', card, from: 'battlefield', fromIdx: cardIdx, fromPlayer: playerIdx, to: 'graveyard', toPlayer: playerIdx } });
        }

        if (!actions.length) { cardMenuEl = null; return; }

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'card-context-option';
            btn.textContent = a.label;
            btn.addEventListener('click', async (e2) => {
                e2.stopPropagation();
                cardMenuEl.remove();
                cardMenuEl = null;
                await doAction(a.action);
            });
            cardMenuEl.appendChild(btn);
        });

        document.body.appendChild(cardMenuEl);
        setTimeout(() => {
            const closeMenu = (ev) => {
                if (cardMenuEl && !cardMenuEl.contains(ev.target)) {
                    cardMenuEl.remove();
                    cardMenuEl = null;
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    document.addEventListener('dragend', () => { dragData = null; });

    // ─── End Match ──────────────────────────────────────────────────────────
    endBtn.addEventListener('click', async () => {
        if (lifePopupEl) { lifePopupEl.remove(); lifePopupEl = null; }
        if (cardMenuEl) { cardMenuEl.remove(); cardMenuEl = null; }
        zoneOverlay.classList.add('hidden');
        tokenOverlay.classList.add('hidden');
        stopPolling();
        stopStatePolling();
        if (currentMatchId) {
            try { await api('/api/matches/leave', 'POST', { matchId: currentMatchId }); } catch {}
            localStorage.removeItem('match_initted_' + currentMatchId);
        }
        currentMatchId = null;
        myMatch = null;
        gameState = null;
        primaryIdx = -1;
        chatMessages.innerHTML = '';
        document.getElementById('play-chat').classList.remove('visible');
        document.getElementById('play-end-btn').classList.remove('visible');
        document.getElementById('play-match').classList.remove('active');
        document.getElementById('play-match').classList.remove('deck-select-mode');
        showScreen('lobby');
    });

    // ─── Topbar Search ──────────────────────────────────────────────────────
    const searchInput = document.getElementById('topbar-search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = searchInput.value.trim();
                if (val) window.location.href = '/pages/search.html?q=' + encodeURIComponent(val);
            }
        });
        const trigger = document.getElementById('topbar-search-trigger');
        if (trigger) trigger.addEventListener('click', () => {
            const val = searchInput.value.trim();
            if (val) window.location.href = '/pages/search.html?q=' + encodeURIComponent(val);
        });
    }

    // ─── Init ───────────────────────────────────────────────────────────────
    initCustomSelects();
    showScreen('lobby');
})();
