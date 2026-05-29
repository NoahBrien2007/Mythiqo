import http.server
import json
import os
import hashlib
import secrets
import urllib.parse
import threading
import sys
from pathlib import Path

DEBUG = True
def dlog(*args, **kwargs):
    if DEBUG:
        print('[SERVER]', *args, **kwargs, file=sys.stderr, flush=True)

PORT = 3000
ROOT = Path(__file__).parent
USERS_FILE = ROOT / 'data' / 'users.json'

tokens = {}  # session_token -> username
matches = {}  # match_id -> match_data
match_lock = threading.Lock()
_match_id_counter = 0

def read_users():
    try:
        return json.loads(USERS_FILE.read_text('utf-8'))
    except:
        return {'users': []}

def write_users(data):
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USERS_FILE.write_text(json.dumps(data, indent=2), 'utf-8')

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def make_token():
    return secrets.token_hex(24)

def send_json(resp, data, status=200):
    body = json.dumps(data).encode()
    resp.send_response(status)
    resp.send_header('Content-Type', 'application/json')
    resp.send_header('Content-Length', str(len(body)))
    resp.end_headers()
    resp.wfile.write(body)

def send_error(resp, msg, status=400):
    send_json(resp, {'error': msg}, status)

MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        print(f'[{self.log_date_time_string()}] {self.command} {self.path} - {format % args}' if args else f'[{self.log_date_time_string()}] {self.command} {self.path}')

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8') if length else '{}'
        try:
            data = json.loads(body)
        except:
            data = {}

        if self.path == '/api/register':
            return self.handle_register(data)
        elif self.path == '/api/login':
            return self.handle_login(data)
        elif self.path == '/api/logout':
            return self.handle_logout(data)
        elif self.path == '/api/decks':
            if self.headers.get('Authorization') in tokens:
                return self.handle_decks(data)
            return send_error(self, 'Unauthorized.', 401)
        elif self.path == '/api/friends/request':
            return self.handle_friend_request(data)
        elif self.path == '/api/friends/accept':
            return self.handle_friend_accept(data)
        elif self.path == '/api/friends/decline':
            return self.handle_friend_decline(data)
        elif self.path == '/api/matches/create':
            return self.handle_match_create(data)
        elif self.path == '/api/matches/join':
            return self.handle_match_join(data)
        elif self.path == '/api/matches/leave':
            return self.handle_match_leave(data)
        elif self.path == '/api/matches/start':
            return self.handle_match_start(data)
        elif self.path == '/api/matches/deck':
            return self.handle_match_submit_deck(data)
        elif self.path == '/api/matches/action':
            return self.handle_match_action(data)
        else:
            send_error(self, 'Not found', 404)

    def do_GET(self):
        token = self.headers.get('Authorization', '')
        authed = token in tokens

        if self.path == '/api/decks':
            if authed:
                return self.handle_get_decks()
            return send_error(self, 'Unauthorized.', 401)
        elif self.path == '/api/friends':
            if authed:
                return self.handle_get_friends()
            return send_error(self, 'Unauthorized.', 401)
        elif self.path == '/api/friends/requests':
            if authed:
                return self.handle_get_friend_requests()
            return send_error(self, 'Unauthorized.', 401)
        elif self.path == '/api/friends/sent':
            if authed:
                return self.handle_get_friend_requests_sent()
            return send_error(self, 'Unauthorized.', 401)
        elif self.path == '/api/matches' or self.path.startswith('/api/matches/'):
            if authed:
                return self.handle_match_get(self.path)
            return send_error(self, 'Unauthorized.', 401)

        # Serve static files, avoid listing directories
        parsed = urllib.parse.urlparse(self.path)
        clean_path = parsed.path
        if clean_path == '/' or clean_path == '':
            clean_path = '/pages/index.html'

        fs_path = ROOT / clean_path.lstrip('/')
        if fs_path.is_dir():
            clean_path = str(Path(clean_path) / 'index.html')
            fs_path = ROOT / clean_path.lstrip('/')

        if fs_path.exists() and fs_path.is_file():
            ext = fs_path.suffix.lower()
            ctype = MIME_TYPES.get(ext, 'application/octet-stream')
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Content-Length', str(fs_path.stat().st_size))
            self.end_headers()
            with open(fs_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404)

    def handle_register(self, data):
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''
        if len(username) < 2 or len(password) < 3:
            return send_error(self, 'Username must be 2+ characters, password 3+.')
        u = read_users()
        if any(usr['username'].lower() == username.lower() for usr in u['users']):
            return send_error(self, 'Username already exists.', 409)
        token = make_token()
        u['users'].append({
            'username': username,
            'passwordHash': hash_password(password),
            'decks': [],
            'friends': [],
            'friendRequestsSent': [],
            'friendRequestsReceived': []
        })
        write_users(u)
        tokens[token] = username
        send_json(self, {'token': token, 'username': username})

    def handle_login(self, data):
        username = (data.get('username') or '').strip()
        password = data.get('password') or ''
        if not username or not password:
            return send_error(self, 'Username and password required.')
        u = read_users()
        for usr in u['users']:
            if usr['username'].lower() == username.lower() and usr['passwordHash'] == hash_password(password):
                token = make_token()
                tokens[token] = usr['username']
                return send_json(self, {'token': token, 'username': usr['username']})
        send_error(self, 'Invalid username or password.', 401)

    def handle_logout(self, data):
        token = self.headers.get('Authorization', '')
        if token in tokens:
            del tokens[token]
        send_json(self, {'success': True})

    def handle_decks(self, data):
        username = tokens[self.headers['Authorization']]
        u = read_users()
        decks = data.get('decks')
        if not isinstance(decks, list):
            return send_error(self, 'Invalid decks data.')
        for usr in u['users']:
            if usr['username'] == username:
                usr['decks'] = decks
                write_users(u)
                return send_json(self, {'success': True})
        send_error(self, 'User not found.', 404)

    def handle_get_decks(self):
        username = tokens[self.headers['Authorization']]
        u = read_users()
        for usr in u['users']:
            if usr['username'] == username:
                return send_json(self, {'decks': usr['decks']})
        send_json(self, {'decks': []})

    def _get_authed_user(self):
        return tokens.get(self.headers.get('Authorization', ''))

    def handle_friend_request(self, data):
        username = self._get_authed_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        target = (data.get('username') or '').strip()
        if not target:
            return send_error(self, 'Username required.')
        if target.lower() == username.lower():
            return send_error(self, 'Cannot add yourself.')
        u = read_users()
        sender = None
        receiver = None
        for usr in u['users']:
            if usr['username'] == username:
                sender = usr
            if usr['username'].lower() == target.lower():
                receiver = usr
        if not receiver:
            return send_error(self, 'User not found.', 404)
        actual_target = receiver['username']
        if actual_target in sender.get('friends', []):
            return send_error(self, 'Already friends.')
        if actual_target in sender.get('friendRequestsSent', []):
            return send_error(self, 'Friend request already sent.')
        if username in receiver.get('friendRequestsReceived', []):
            return send_error(self, 'Friend request already sent.')
        sender.setdefault('friendRequestsSent', []).append(actual_target)
        receiver.setdefault('friendRequestsReceived', []).append(username)
        write_users(u)
        send_json(self, {'success': True})

    def handle_friend_accept(self, data):
        username = self._get_authed_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        target = (data.get('username') or '').strip()
        if not target:
            return send_error(self, 'Username required.')
        u = read_users()
        accepter = None
        requester = None
        for usr in u['users']:
            if usr['username'] == username:
                accepter = usr
            if usr['username'] == target:
                requester = usr
        if not accepter or not requester:
            return send_error(self, 'User not found.', 404)
        requester_name = requester['username']
        received = accepter.get('friendRequestsReceived', [])
        if requester_name not in received:
            return send_error(self, 'No pending request from that user.')
        received.remove(requester_name)
        accepter.setdefault('friends', []).append(requester_name)
        requester.setdefault('friends', []).append(username)
        try:
            requester.setdefault('friendRequestsSent', []).remove(username)
        except ValueError:
            pass
        write_users(u)
        send_json(self, {'success': True})

    def handle_friend_decline(self, data):
        username = self._get_authed_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        target = (data.get('username') or '').strip()
        if not target:
            return send_error(self, 'Username required.')
        u = read_users()
        decliner = None
        requester = None
        for usr in u['users']:
            if usr['username'] == username:
                decliner = usr
            if usr['username'] == target:
                requester = usr
        if not decliner or not requester:
            return send_error(self, 'User not found.', 404)
        requester_name = requester['username']
        received = decliner.get('friendRequestsReceived', [])
        if requester_name not in received:
            return send_error(self, 'No pending request from that user.')
        received.remove(requester_name)
        try:
            requester.setdefault('friendRequestsSent', []).remove(username)
        except ValueError:
            pass
        write_users(u)
        send_json(self, {'success': True})

    def handle_get_friends(self):
        username = self._get_authed_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        u = read_users()
        for usr in u['users']:
            if usr['username'] == username:
                return send_json(self, {'friends': usr.get('friends', [])})
        send_json(self, {'friends': []})

    def handle_get_friend_requests(self):
        username = self._get_authed_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        u = read_users()
        for usr in u['users']:
            if usr['username'] == username:
                return send_json(self, {'requests': usr.get('friendRequestsReceived', [])})
        send_json(self, {'requests': []})

    def handle_get_friend_requests_sent(self):
        username = self._get_authed_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        u = read_users()
        for usr in u['users']:
            if usr['username'] == username:
                return send_json(self, {'sent': usr.get('friendRequestsSent', [])})
        send_json(self, {'sent': []})

    # ─── Matchmaking ────────────────────────────────────────────────────

    def _next_match_id(self):
        global _match_id_counter
        with match_lock:
            _match_id_counter += 1
            return 'match_' + str(_match_id_counter)

    def _auth_user(self):
        return tokens.get(self.headers.get('Authorization', ''))

    def handle_match_create(self, data):
        username = self._auth_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        fmt = data.get('format', 'commander')
        with_bots = data.get('withBots', False)
        bot_names = data.get('botNames', [])
        max_players = data.get('maxPlayers', 2)
        match_name = data.get('name', '')
        password = data.get('password', '')

        if not fmt:
            return send_error(self, 'Format required.')
        if not with_bots and not match_name:
            return send_error(self, 'Match name required when hosting for players.')
        if max_players < 2 or max_players > 4:
            return send_error(self, 'Players must be 2-4.')

        mid = self._next_match_id()
        with match_lock:
            matches[mid] = {
                'id': mid,
                'name': match_name or fmt.title() + ' Game',
                'format': fmt,
                'host': username,
                'password': password,
                'maxPlayers': max_players,
                'withBots': with_bots,
                'botNames': bot_names,
                'players': [username],
                'started': False,
                'state': 'waiting',
                'startLife': 40 if fmt == 'commander' else 20,
            }
            dlog(f'MATCH CREATED: {mid} host={username} withBots={with_bots} max={max_players}')
        send_json(self, {'matchId': mid, 'match': matches[mid]})

    def handle_match_join(self, data):
        username = self._auth_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        mid = data.get('matchId', '')
        pw = data.get('password', '')

        with match_lock:
            m = matches.get(mid)
            if not m:
                return send_error(self, 'Match not found.', 404)
            if username in m['players']:
                return send_json(self, {'success': True, 'match': m})
            if m['started']:
                return send_error(self, 'Match already started.')
            if m['withBots']:
                return send_error(self, 'Match is bot-only.')
            if len(m['players']) >= m['maxPlayers']:
                return send_error(self, 'Match is full.')
            if m['password'] and m['password'] != pw:
                return send_error(self, 'Incorrect password.')

            m['players'].append(username)
            dlog(f'MATCH JOIN: {mid} joiner={username} count={len(m["players"])}/{m["maxPlayers"]}')

            # Auto-start when player match reaches full capacity
            if not m['withBots'] and len(m['players']) >= m['maxPlayers']:
                m['started'] = True
                m['state'] = 'playing'
                sl = m['startLife']
                m['gameState'] = {
                    'turn': 0, 'activePlayer': 0,
                    'players': [{'name': p, 'life': sl, 'library': [], 'hand': [], 'graveyard': [], 'exile': [], 'commandZone': [], 'battlefield': [], 'init': False, 'commander': None} for p in m['players']],
                    'log': ['=== Game Started ==='],
                    'allInit': False,
                }
                dlog(f'MATCH AUTO-START: {mid} players={m["players"]} gameState={m["gameState"] is not None}')
        send_json(self, {'success': True, 'match': m})

    def handle_match_leave(self, data):
        username = self._auth_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        mid = data.get('matchId', '')
        with match_lock:
            m = matches.get(mid)
            if not m:
                return send_error(self, 'Match not found.', 404)
            if username not in m['players']:
                return send_error(self, 'Not in this match.')
            m['players'].remove(username)
            if not m['players'] or username == m['host']:
                del matches[mid]
                return send_json(self, {'success': True, 'deleted': True})
        send_json(self, {'success': True})

    def handle_match_start(self, data):
        username = self._auth_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        mid = data.get('matchId', '')
        with match_lock:
            m = matches.get(mid)
            if not m:
                return send_error(self, 'Match not found.', 404)
            if m['host'] != username:
                return send_error(self, 'Only the host can start.')
            if m['started']:
                return send_error(self, 'Already started.')
            # Bot matches auto-fill players
            if m['withBots']:
                bot_count = m['maxPlayers'] - len(m['players'])
                for i in range(bot_count):
                    bname = m['botNames'][i] if i < len(m['botNames']) else f'Bot {i+1}'
                    m['players'].append(bname)
            m['started'] = True
            m['state'] = 'playing'
            sl = m['startLife']
            m['gameState'] = {
                'turn': 0, 'activePlayer': 0,
                'players': [{'name': p, 'life': sl, 'library': [], 'hand': [], 'graveyard': [], 'exile': [], 'commandZone': [], 'battlefield': [], 'init': False, 'commander': None} for p in m['players']],
                'log': ['=== Game Started ==='],
                'allInit': False,
            }
            # Auto-init bot players with a basic deck
            if m['withBots']:
                import random
                for pi, p in enumerate(m['gameState']['players']):
                    if p['name'] != username:
                        basic_land = {'name': 'Basic Land', 'id': 'basic_land'}
                        p['library'] = [dict(basic_land) for _ in range(40)]
                        random.shuffle(p['library'])
                        for _ in range(7):
                            if p['library']:
                                p['hand'].append(p['library'].pop())
                        p['init'] = True
                m['gameState']['allInit'] = all(p['init'] for p in m['gameState']['players'])
                if m['gameState']['allInit']:
                    m['gameState']['log'].append('Bot players initialized.')
        send_json(self, {'success': True, 'match': m})

    def _filter_state(self, state, username):
        if not state:
            return None
        fs = {'turn': state['turn'], 'activePlayer': state['activePlayer'], 'log': state['log'], 'allInit': state['allInit'], 'players': []}
        for p in state['players']:
            if p['name'] == username:
                fs['players'].append(dict(p))
            else:
                fp = dict(p)
                fp['hand'] = [1] * len(p['hand'])
                fp['library'] = [1] * len(p['library'])
                fs['players'].append(fp)
        return fs

    def _get_match_and_filter(self, mid, username):
        with match_lock:
            m = matches.get(mid)
            if not m:
                dlog(f'GET_FILTER: {mid} NOT FOUND')
                return None
            result = dict(m)
            has_gs = 'gameState' in result
            dlog(f'GET_FILTER: {mid} user={username} started={result.get("started")} hasGameState={has_gs} state={result.get("state")}')
            if has_gs:
                result['gameState'] = self._filter_state(result['gameState'], username)
                dlog(f'GET_FILTER: {mid} filtered GS keys={list(result["gameState"].keys())} players={len(result["gameState"]["players"])}')
            return result

    def handle_match_submit_deck(self, data):
        username = self._auth_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        mid = data.get('matchId', '')
        deck = data.get('deck')
        if not deck or not isinstance(deck, dict):
            return send_error(self, 'Deck data required.')
        with match_lock:
            m = matches.get(mid)
            if not m:
                return send_error(self, 'Not found.', 404)
            if not m.get('started'):
                return send_error(self, 'Match not started.')
            gs = m.get('gameState')
            if not gs:
                return send_error(self, 'No game state.')
            pi = next((i for i, p in enumerate(gs['players']) if p['name'] == username), None)
            if pi is None:
                return send_error(self, 'Not in match.')
            if gs['players'][pi]['init']:
                return send_error(self, 'Already initialized.')

            pl = gs['players'][pi]
            cards = deck.get('cards', [])
            library = []
            for card in cards:
                cnt = card.get('count', 1) if isinstance(card, dict) else 1
                for _ in range(cnt):
                    library.append(card)
            import random
            random.shuffle(library)
            pl['library'] = library
            if m['format'] == 'commander':
                cmd = deck.get('commander')
                if cmd:
                    pl['commandZone'] = [cmd]
                    pl['commander'] = cmd.get('name')
            for _ in range(7):
                if pl['library']:
                    pl['hand'].append(pl['library'].pop())
            pl['init'] = True
            gs['allInit'] = all(p['init'] for p in gs['players'])
            if gs['allInit']:
                gs['log'].append(f'{username} set up their deck. Game ready!')
            dlog(f'DECK SUBMIT: {mid} user={username} allInit={gs["allInit"]} initStates={[p["init"] for p in gs["players"]]}')
        filtered = self._get_match_and_filter(mid, username)
        dlog(f'DECK SUBMIT: {mid} returning state allInit={filtered.get("gameState",{}).get("allInit")}')
        send_json(self, {'success': True, 'state': (filtered or {}).get('gameState')})

    def handle_match_action(self, data):
        username = self._auth_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)
        mid = data.get('matchId', '')
        action = data.get('action')
        if not action:
            return send_error(self, 'Action required.')
        dlog(f'ACTION: {mid} type={action.get("type","?")} by {username}')
        with match_lock:
            m = matches.get(mid)
            if not m:
                dlog(f'ACTION: {mid} NOT FOUND')
                return send_error(self, 'Not found.', 404)
            gs = m.get('gameState')
            if not gs or not gs['allInit']:
                dlog(f'ACTION: {mid} gs={gs is not None} allInit={gs["allInit"] if gs else "N/A"}')
                return send_error(self, 'Game not ready.')
            pi = next((i for i, p in enumerate(gs['players']) if p['name'] == username), None)
            if pi is None:
                dlog(f'ACTION: {mid} user={username} NOT IN MATCH')
                return send_error(self, 'Not in match.')

            pl = gs['players'][pi]
            atype = action.get('type')
            result = None
            import random

            if atype == 'draw':
                if not pl['library']:
                    return send_error(self, 'Library empty.')
                card = pl['library'].pop()
                pl['hand'].append(card)
                gs['log'].append(f'{username} draws a card.')
                result = {'card': card}

            elif atype == 'mill':
                cnt = action.get('count', 1)
                milled = []
                for _ in range(cnt):
                    if not pl['library']:
                        break
                    milled.append(pl['library'].pop())
                pl['graveyard'].extend(milled)
                gs['log'].append(f'{username} mills {len(milled)} card(s).')
                result = {'cards': milled}

            elif atype == 'scry':
                if not pl['library']:
                    return send_error(self, 'Library empty.')
                top = pl['library'].pop()
                put_bottom = action.get('bottom', False)
                if put_bottom:
                    pl['library'].insert(0, top)
                else:
                    pl['library'].append(top)
                gs['log'].append(f'{username} scries 1.')
                result = {'card': top}

            elif atype == 'search':
                if not pl['library']:
                    return send_error(self, 'Library empty.')
                idx = random.randint(0, len(pl['library']) - 1)
                card = pl['library'].pop(idx)
                pl['hand'].append(card)
                gs['log'].append(f'{username} searches their library.')
                result = {'card': card}

            elif atype == 'play':
                hand_idx = action.get('handIdx', -1)
                if hand_idx < 0 or hand_idx >= len(pl['hand']):
                    return send_error(self, 'Invalid hand index.')
                card = pl['hand'].pop(hand_idx)
                pl['battlefield'].append(card)
                gs['log'].append(f'{username} plays {card.get("name", "a card")}.')
                result = {}

            elif atype == 'discard':
                hand_idx = action.get('handIdx', -1)
                if hand_idx < 0 or hand_idx >= len(pl['hand']):
                    return send_error(self, 'Invalid hand index.')
                card = pl['hand'].pop(hand_idx)
                pl['graveyard'].append(card)
                gs['log'].append(f'{username} discards {card.get("name", "a card")}.')
                result = {}

            elif atype == 'exile':
                from_zone = action.get('from', 'hand')
                from_idx = action.get('idx', -1)
                card = None
                if from_zone == 'hand':
                    if from_idx < 0 or from_idx >= len(pl['hand']):
                        return send_error(self, 'Invalid index.')
                    card = pl['hand'].pop(from_idx)
                elif from_zone == 'graveyard':
                    if from_idx < 0 or from_idx >= len(pl['graveyard']):
                        return send_error(self, 'Invalid index.')
                    card = pl['graveyard'].pop(from_idx)
                if card:
                    pl['exile'].append(card)
                    gs['log'].append(f'{username} exiles {card.get("name", "a card")}.')
                result = {}

            elif atype == 'castCmd':
                if not pl['commandZone']:
                    return send_error(self, 'No commander.')
                cmd = pl['commandZone'].pop()
                pl['battlefield'].append(cmd)
                gs['log'].append(f'{username} casts {cmd.get("name", "commander")} from command zone.')
                result = {}

            elif atype == 'returnCmd':
                cmd_name = pl.get('commander')
                if not cmd_name:
                    return send_error(self, 'No commander.')
                idx = next((i for i, c in enumerate(pl['graveyard']) if c.get('name') == cmd_name), None)
                if idx is None:
                    return send_error(self, 'Commander not in graveyard.')
                cmd = pl['graveyard'].pop(idx)
                pl['commandZone'].append(cmd)
                gs['log'].append(f'{username} returns commander to command zone.')
                result = {}

            elif atype == 'lifeChange':
                amt = action.get('amount', 0)
                target = action.get('target', pi)
                if target < 0 or target >= len(gs['players']):
                    return send_error(self, 'Invalid target.')
                gs['players'][target]['life'] = max(0, gs['players'][target]['life'] + amt)
                tn = gs['players'][target]['name']
                gs['log'].append(f'{username} changes {tn}\'s life by {amt}.')
                result = {}

            elif atype == 'createToken':
                token_data = action.get('token', {})
                target = action.get('target', pi)
                count = action.get('count', 1)
                if target < 0 or target >= len(gs['players']):
                    return send_error(self, 'Invalid target.')
                tp = gs['players'][target]
                for _ in range(count):
                    tok = dict(token_data)
                    tok['isToken'] = True
                    tp['battlefield'].append(tok)
                gs['log'].append(f'{username} creates {count} token(s) on {tp["name"]}\'s battlefield.')
                result = {}

            elif atype == 'moveCard':
                card = action.get('card')
                target_zone = action.get('to')
                target_player = action.get('toPlayer', pi)
                target_idx = action.get('toIdx', -1)
                if not card:
                    return send_error(self, 'Card required.')
                from_player = action.get('fromPlayer', pi)
                from_zone = action.get('from')
                from_idx = action.get('fromIdx', 0)

                if target_player < 0 or target_player >= len(gs['players']):
                    return send_error(self, 'Invalid target player.')
                if from_player != pi and from_zone in ('hand', 'library'):
                    return send_error(self, 'Cannot see opponent\'s hand/library.')
                if target_zone == 'hand' and target_player != from_player:
                    return send_error(self, 'Cannot put opponent cards in your hand.')

                sp = gs['players'][from_player]
                src_zone_map = {
                    'library': sp['library'], 'hand': sp['hand'],
                    'graveyard': sp['graveyard'], 'exile': sp['exile'],
                    'commandZone': sp['commandZone'], 'battlefield': sp['battlefield'],
                }
                src = src_zone_map.get(from_zone)
                if src is None:
                    return send_error(self, 'Invalid source zone.')

                if from_idx >= 0 and from_idx < len(src):
                    card_obj = src.pop(from_idx)
                else:
                    card_obj = None
                if not card_obj:
                    return send_error(self, 'Card not found in source zone.')

                dp = gs['players'][target_player]
                dst_zone_map = {
                    'library': dp['library'], 'hand': dp['hand'],
                    'graveyard': dp['graveyard'], 'exile': dp['exile'],
                    'commandZone': dp['commandZone'], 'battlefield': dp['battlefield'],
                }
                dst = dst_zone_map.get(target_zone)
                if dst is None:
                    return send_error(self, 'Invalid target zone.')

                if target_idx >= 0 and target_idx <= len(dst):
                    dst.insert(target_idx, card_obj)
                else:
                    dst.append(card_obj)

                if target_zone == 'battlefield':
                    posX = action.get('posX')
                    posY = action.get('posY')
                    if posX is not None and posY is not None:
                        card_obj['posX'] = posX
                        card_obj['posY'] = posY

                gs['log'].append(f'{username} moves a card from {from_zone} to {target_zone}.')
                result = {}

            elif atype == 'tap':
                target_player = action.get('targetPlayer', pi)
                card_idx = action.get('cardIdx', 0)
                tp = gs['players'][target_player]
                bf = tp.get('battlefield', [])
                if 0 <= card_idx < len(bf):
                    bf[card_idx]['tapped'] = not bf[card_idx].get('tapped', False)
                    state = 'tapped' if bf[card_idx]['tapped'] else 'untapped'
                    gs['log'].append(f'{username} taps {bf[card_idx].get("name", "card")}.')
                result = {}

            elif atype == 'flip':
                target_player = action.get('targetPlayer', pi)
                card_idx = action.get('cardIdx', 0)
                tp = gs['players'][target_player]
                bf = tp.get('battlefield', [])
                if 0 <= card_idx < len(bf):
                    bf[card_idx]['flipped'] = not bf[card_idx].get('flipped', False)
                    gs['log'].append(f'{username} flips {bf[card_idx].get("name", "card")}.')
                result = {}

            elif atype == 'nextTurn':
                if pi != gs['activePlayer']:
                    return send_error(self, 'Not your turn.')
                gs['turn'] += 1
                gs['activePlayer'] = (gs['activePlayer'] + 1) % len(gs['players'])
                ap = gs['players'][gs['activePlayer']]['name']
                gs['log'].append(f'--- Turn {gs["turn"] + 1}: {ap}\'s turn ---')
                result = {}

            else:
                return send_error(self, f'Unknown action: {atype}')

            if result is None:
                return send_error(self, 'Action failed.')

            if len(gs['log']) > 200:
                gs['log'] = gs['log'][-200:]

        filtered = self._get_match_and_filter(mid, username)
        send_json(self, {'success': True, 'state': filtered.get('gameState') if filtered else None})

    def handle_match_get(self, path):
        username = self._auth_user()
        if not username:
            return send_error(self, 'Unauthorized.', 401)

        # /api/matches -> list all joinable
        if path == '/api/matches':
            with match_lock:
                available = []
                for m in matches.values():
                    if not m['started'] and not m['withBots'] and len(m['players']) < m['maxPlayers'] and username not in m['players']:
                        available.append({
                            'id': m['id'],
                            'name': m['name'],
                            'format': m['format'],
                            'host': m['host'],
                            'players': m['players'],
                            'maxPlayers': m['maxPlayers'],
                            'hasPassword': bool(m['password']),
                        })
                return send_json(self, {'matches': available})

        # /api/matches/{id} -> get specific match
        parts = path.strip('/').split('/')
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'matches':
            mid = parts[2]
            dlog(f'POLL: {mid} by {username}')
            result = self._get_match_and_filter(mid, username)
            if not result:
                dlog(f'POLL: {mid} NOT FOUND')
                return send_error(self, 'Match not found.', 404)
            dlog(f'POLL: {mid} returning started={result.get("started")} hasGS={result.get("gameState") is not None}')
            return send_json(self, {'match': result})

        # /api/matches/{id}/wait -> long-poll: blocks until match starts or 30s timeout
        if len(parts) == 4 and parts[0] == 'api' and parts[1] == 'matches' and parts[3] == 'wait':
            mid = parts[2]
            import time
            deadline = time.time() + 30
            while time.time() < deadline:
                with match_lock:
                    m = matches.get(mid)
                if m and m.get('started') and m.get('state') == 'playing' and m.get('gameState'):
                    result = self._get_match_and_filter(mid, username)
                    return send_json(self, {'match': result, 'started': True})
                time.sleep(0.5)
            # Timeout — return current state
            result = self._get_match_and_filter(mid, username)
            if not result:
                return send_error(self, 'Not found.', 404)
            return send_json(self, {'match': result, 'started': False, 'timeout': True})

        send_error(self, 'Not found', 404)

if __name__ == '__main__':
    os.chdir(str(ROOT))
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Mythiqo server running at http://localhost:{PORT}')
    server.serve_forever()
