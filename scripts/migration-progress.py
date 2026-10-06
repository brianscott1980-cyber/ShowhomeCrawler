#!/usr/bin/env python3
"""Read-only local report for the verified NAS migration."""
import json
import os
import shutil
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'docs/storage/migration-progress.html'


def snapshot():
    path = ROOT / '.showhome/migration-progress.json'
    try:
        progress = json.loads(path.read_text())
        progress['checkpointAt'] = path.stat().st_mtime
    except (OSError, ValueError):
        progress = {'status': 'not_started'}
    alive = False
    if progress.get('pid'):
        try:
            os.kill(progress['pid'], 0)
            alive = True
        except (ProcessLookupError, PermissionError):
            pass
    if progress.get('status') == 'running' and not alive:
        progress['status'] = 'stopped'
    progress.update(workerAlive=alive, localFreeBytes=shutil.disk_usage(ROOT).free, updatedAt=time.time())
    return progress


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/progress':
            payload = json.dumps(snapshot()).encode()
            kind = 'application/json'
        elif path in ('/', '/migration-progress.html'):
            payload = HTML.read_bytes()
            kind = 'text/html; charset=utf-8'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    port = int(os.environ.get('MIGRATION_PROGRESS_PORT', '8770'))
    print(f'NAS migration progress: http://localhost:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
