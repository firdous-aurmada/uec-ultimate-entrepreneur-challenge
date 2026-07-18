#!/usr/bin/env python3
"""Dev server: static files with Cache-Control: no-store so edits appear on plain reload."""
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    print(f'UEC dev server → http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
