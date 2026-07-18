#!/usr/bin/env python3
"""Dev server: static files with Cache-Control: no-store so edits appear on plain
reload. Also accepts PUT uploads (local asset-generation workflow — e.g. rendering
og-image.png in the browser and saving it back to the project). Local dev only."""
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_PUT(self):
        target = (ROOT / self.path.lstrip('/')).resolve()
        if ROOT not in target.parents and target != ROOT:
            self.send_error(403, 'outside project root')
            return
        length = int(self.headers.get('Content-Length', 0))
        if length > 5_000_000:
            self.send_error(413, 'too large')
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(self.rfile.read(length))
        self.send_response(201)
        self.end_headers()
        self.wfile.write(b'saved')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    print(f'UEC dev server → http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
