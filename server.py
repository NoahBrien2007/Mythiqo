import http.server
import json
import os
import hashlib
import secrets
import urllib.parse
from pathlib import Path

PORT = 3000
ROOT = Path(__file__).parent
USERS_FILE = ROOT / 'data' / 'users.json'

tokens = {}  # session_token -> username

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
        if target in sender.get('friends', []):
            return send_error(self, 'Already friends.')
        if target in sender.get('friendRequestsSent', []):
            return send_error(self, 'Friend request already sent.')
        if username in receiver.get('friendRequestsReceived', []):
            return send_error(self, 'Friend request already sent.')
        sender.setdefault('friendRequestsSent', []).append(target)
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
        received = accepter.get('friendRequestsReceived', [])
        if target not in received:
            return send_error(self, 'No pending request from that user.')
        received.remove(target)
        accepter.setdefault('friends', []).append(target)
        requester.setdefault('friends', []).append(username)
        requester.setdefault('friendRequestsSent', []).remove(username)
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
        received = decliner.get('friendRequestsReceived', [])
        if target not in received:
            return send_error(self, 'No pending request from that user.')
        received.remove(target)
        requester.setdefault('friendRequestsSent', []).remove(username)
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

if __name__ == '__main__':
    os.chdir(str(ROOT))
    server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Mythiqo server running at http://localhost:{PORT}')
    server.serve_forever()
