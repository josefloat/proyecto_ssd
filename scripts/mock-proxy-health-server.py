import http.server
import sys
import time

port = int(sys.argv[1])
mode = sys.argv[2]
# recover:N -> responde 504 en las primeras N solicitudes, luego 200 db:ok
recover_after = int(mode.split(":")[1]) if mode.startswith("recover:") else None
# hang:N -> tarda N segundos en responder (504) a cada solicitud, para
# probar que el llamador acota su propio timeout al tiempo restante en vez
# de confiar en que el upstream responda a tiempo.
hang_seconds = float(mode.split(":")[1]) if mode.startswith("hang:") else None

request_count = {"n": 0}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/api/health":
            self.send_response(404)
            self.end_headers()
            return

        request_count["n"] += 1

        if hang_seconds is not None:
            time.sleep(hang_seconds)
            status = 504
        elif recover_after is not None:
            status = 200 if request_count["n"] > recover_after else 504
        elif mode == "always200":
            status = 200
        elif mode == "always503":
            status = 503
        elif mode == "always504":
            status = 504
        else:
            status = 500

        if status == 200:
            body = b'{"status":"ok","db":"ok"}'
        elif status == 503:
            body = b'{"status":"error","db":"unreachable"}'
        elif status == 504:
            body = b'{"error":"upstream timeout"}'
        else:
            body = b"{}"

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


http.server.HTTPServer(("127.0.0.1", port), Handler).serve_forever()
