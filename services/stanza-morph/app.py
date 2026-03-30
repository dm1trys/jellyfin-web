import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import stanza


HOST = "0.0.0.0"
PORT = int(os.environ.get("STANZA_PORT", "5000"))
MODEL_DIR = os.environ.get("STANZA_MODEL_DIR", "/opt/stanza")
LANG = os.environ.get("STANZA_LANGUAGE", "de")


PIPELINE = stanza.Pipeline(
    lang=LANG,
    model_dir=MODEL_DIR,
    processors="tokenize,pos,lemma",
    tokenize_no_ssplit=True,
    use_gpu=False,
)


def parse_feats(value):
    if not value:
        return {}

    feats = {}
    for item in value.split("|"):
        if "=" not in item:
            continue
        key, feature_value = item.split("=", 1)
        feats[key] = feature_value
    return feats


def analyze_text(text, lang):
    if not isinstance(text, str) or not text.strip():
        return {"tokens": []}

    if lang and lang != LANG:
        return {"tokens": []}

    doc = PIPELINE(text)
    tokens = []

    for sentence in doc.sentences:
        for word in sentence.words:
            tokens.append(
                {
                    "text": word.text,
                    "lemma": word.lemma,
                    "upos": word.upos,
                    "xpos": word.xpos,
                    "feats": parse_feats(word.feats),
                    "head": word.head,
                    "deprel": word.deprel,
                }
            )

    return {"tokens": tokens}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.respond(200, {"status": "ok", "lang": LANG})
            return

        self.respond(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/analyze":
            self.respond(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length else b"{}"
            payload = json.loads(body.decode("utf-8"))
            result = analyze_text(payload.get("text", ""), payload.get("lang", LANG))
            self.respond(200, result)
        except Exception as error:
            self.respond(500, {"error": str(error)})

    def log_message(self, format, *args):
        return

    def respond(self, status, payload):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
