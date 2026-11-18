"""A tiny in-memory Google Drive v3, served through Playwright request interception."""
import json, re, itertools, urllib.parse

class FakeDrive:
    def __init__(self, token="fake-token", limit=15 * 10**9):
        self.files = {}   # id -> dict(name, mimeType, parents, data(bytes), version, trashed)
        self.sessions = {}
        self.ids = itertools.count(1)
        self.token = token
        self.limit = limit
        self.log = []
        self.fail_next = None  # e.g. 401 to test token refresh

    def new_id(self): return f"f{next(self.ids):04d}"

    def by_name(self, name):
        return [f for f in self.files.values() if f["name"] == name and not f["trashed"]]

    def meta(self, f):
        return {"id": f["id"], "name": f["name"], "size": str(len(f["data"])), "version": str(f["version"]),
                "mimeType": f["mimeType"], "modifiedTime": "2026-11-16T10:00:00Z"}

    def usage(self): return sum(len(f["data"]) for f in self.files.values()) + 2 * 10**9

    def tree(self):
        def path(f):
            parts = [f["name"]]
            p = f["parents"][0] if f["parents"] else None
            while p and p in self.files:
                parts.insert(0, self.files[p]["name"]); p = self.files[p]["parents"][0] if self.files[p]["parents"] else None
            return "/".join(parts)
        return sorted(path(f) for f in self.files.values() if not f["trashed"])

    def library(self):
        f = self.by_name("library.json")
        return json.loads(f[0]["data"]) if f else None

    # --- routing ---
    def handle(self, route):
        try:
            return self._handle(route)
        except Exception as e:
            self.log.append(f"CRASH {e!r}")
            return route.fulfill(status=500, body="crash")

    def _handle(self, route):
        req = route.request
        cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Location",
                "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"}
        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        url = urllib.parse.urlparse(req.url)
        qs = dict(urllib.parse.parse_qsl(url.query))
        self.log.append(f"{req.method} {url.path}")
        def reply(status, body=None, headers=None, raw=None, ctype="application/json"):
            h = dict(cors); h.update(headers or {})
            if raw is not None: return route.fulfill(status=status, headers=h, body=raw, content_type=ctype)
            return route.fulfill(status=status, headers=h, body=json.dumps(body if body is not None else {}), content_type="application/json")
        def err(status, reason, msg):
            return reply(status, {"error": {"code": status, "message": msg, "errors": [{"reason": reason}]}})
        if not url.path.startswith("/upload-session/"):
            if req.headers.get("authorization") != f"Bearer {self.token}":
                return err(401, "authError", "Invalid Credentials")
            if self.fail_next:
                st = self.fail_next; self.fail_next = None
                return err(st, "authError" if st == 401 else "backendError", "forced")
        path = url.path
        body = req.post_data_buffer or b""
        if path == "/drive/v3/about":
            return reply(200, {"storageQuota": {"limit": str(self.limit), "usage": str(self.usage())},
                               "user": {"emailAddress": "friend@example.com"}})
        if path == "/drive/v3/files" and req.method == "GET":
            q = qs.get("q", "")
            res = [f for f in self.files.values() if not f["trashed"]]
            m = re.search(r"name='((?:[^'\\]|\\.)*)'", q)
            if m: res = [f for f in res if f["name"] == m.group(1).replace("\\'", "'")]
            m = re.search(r"mimeType='([^']*)'", q)
            if m: res = [f for f in res if f["mimeType"] == m.group(1)]
            m = re.search(r"'([^']*)' in parents", q)
            if m: res = [f for f in res if m.group(1) in f["parents"]]
            return reply(200, {"files": [self.meta(f) for f in res]})
        if path == "/drive/v3/files" and req.method == "POST":
            d = json.loads(body or b"{}")
            fid = self.new_id()
            self.files[fid] = {"id": fid, "name": d["name"], "mimeType": d.get("mimeType", ""), "parents": d.get("parents") or [],
                               "data": b"", "version": 1, "trashed": False}
            return reply(200, {"id": fid})
        m = re.fullmatch(r"/drive/v3/files/([^/]+)", path)
        if m:
            f = self.files.get(m.group(1))
            if not f or f["trashed"]: return err(404, "notFound", "File not found")
            if req.method == "DELETE":
                f["trashed"] = True; return route.fulfill(status=204, headers=cors)
            if qs.get("alt") == "media":
                return reply(200, raw=f["data"], ctype=f["mimeType"] or "application/octet-stream")
            return reply(200, self.meta(f))
        if path == "/upload/drive/v3/files" and qs.get("uploadType") == "resumable":
            d = json.loads(body or b"{}")
            size = int(req.headers.get("x-upload-content-length", "0"))
            if self.usage() + size > self.limit:
                return err(403, "storageQuotaExceeded", "The user's Drive storage quota has been exceeded.")
            sid = f"s{next(self.ids)}"
            self.sessions[sid] = d
            return reply(200, {}, headers={"Location": f"https://www.googleapis.com/upload-session/{sid}"})
        m = re.fullmatch(r"/upload-session/([^/]+)", path)
        if m and req.method == "PUT":
            d = self.sessions.pop(m.group(1))
            fid = self.new_id()
            self.files[fid] = {"id": fid, "name": d["name"], "mimeType": d.get("mimeType", ""), "parents": d.get("parents") or [],
                               "data": body, "version": 1, "trashed": False}
            return reply(200, self.meta(self.files[fid]))
        m = re.fullmatch(r"/upload/drive/v3/files/([^/]+)", path)
        if m and req.method == "PATCH":
            f = self.files.get(m.group(1))
            if not f or f["trashed"]: return err(404, "notFound", "File not found")
            f["data"] = body; f["version"] += 1
            return reply(200, self.meta(f))
        return err(400, "badRequest", f"unhandled {req.method} {path}")
