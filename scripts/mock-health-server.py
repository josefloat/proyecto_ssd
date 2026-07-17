import http.server
import sys
import time

port = int(sys.argv[1])
mode = sys.argv[2]
# hang:N -> tarda N segundos en responder 503 a /health, para probar que
# el llamador acota su propio timeout al tiempo restante en vez de confiar
# en que el upstream responda a tiempo.
hang_seconds = float(mode.split(":")[1]) if mode.startswith("hang:") else None


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_response(404)
            self.end_headers()
            return

        if hang_seconds is not None:
            time.sleep(hang_seconds)

        body = b'{"status":"error","db":"unreachable"}'
        self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


http.server.HTTPServer(("127.0.0.1", port), Handler).serve_forever()
