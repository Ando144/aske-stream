import os as _os
HERE=_os.path.dirname(_os.path.abspath(__file__))
CHROME=_os.environ.get("CHROME_PATH") or None
import time, json, sys
sys.path.insert(0, HERE)
from fakedrive import FakeDrive
from playwright.sync_api import sync_playwright
BASE=_os.environ.get("BASE","http://127.0.0.1:8787"); OUT=_os.path.join(HERE,"shots","shots7")
os=_os; os.makedirs(OUT, exist_ok=True)
errors=[]
def shot(p,n): p.screenshot(path=f"{OUT}/{n}.png", full_page=False)
def jobs(p): return p.evaluate("() => JSON.parse(localStorage.getItem('aske:downloads-v1')||'[]')")
def wait_jobs_idle(p, timeout=25):
    pump(0.7); t0=time.time()
    while time.time()-t0<timeout:
        st=[j["status"] for j in jobs(p)]
        if st and not any(s in ('queued','downloading','saving') for s in st):
            pump(0.6); return [j["status"] for j in jobs(p)]
        pump(0.3)
    raise Exception("jobs not idle")
PUMP=[]
def pump(sec):
    # Playwright answers the fake Drive's requests only while we call into it.
    if PUMP: PUMP[-1].wait_for_timeout(int(sec*1000))
    else: time.sleep(sec)
def wait_for(fn, timeout=15, what=""):
    t0=time.time()
    while time.time()-t0<timeout:
        v=fn()
        if v: return v
        pump(0.3)
    raise Exception("timeout waiting for "+what)

drive = FakeDrive()
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CHROME,headless=True,args=["--autoplay-policy=no-user-gesture-required"])
    def new_device(name):
        ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,locale="es-ES")
        ctx.route("https://www.googleapis.com/**", drive.handle)
        p=ctx.new_page(); p.on("pageerror",lambda e: errors.append(name+" "+str(e)))
        p.on("console", lambda m: m.type in ("error","warning") and "TUNNEL" not in m.text and errors.append(name+" console: "+m.text))
        PUMP.append(p)
        return ctx, p

    # ---------- A: start on "This device", download 2 songs + a playlist ----------
    ctxA, A = new_device("A")
    A.goto(BASE+"/"); A.wait_for_selector(".welcome-card"); A.get_by_role("button", name="Saltar").click(); A.wait_for_selector(".setup-option")
    print("drive option button:", A.locator(".setup-option").nth(1).locator("button.btn").inner_text())
    shot(A,"01-setup")
    A.locator(".setup-option").nth(0).locator("button.btn").click(); A.wait_for_selector(".tabbar")
    A.locator(".tabbar .tab", has_text="Descargar").click(); A.wait_for_selector(".dl-search")
    A.fill(".dl-search input","itoiz"); A.press(".dl-search input","Enter"); A.wait_for_selector(".dl-result")
    A.locator(".dl-result").nth(0).locator("button").click(); wait_jobs_idle(A)
    A.locator(".dl-result").nth(1).locator("button").click(); wait_jobs_idle(A)
    A.locator(".dl-kinds button", has_text="Playlists").click(); A.wait_for_selector(".dl-result")
    A.locator(".dl-result").nth(0).locator("button").click(); A.wait_for_selector(".dl-entries"); pump(0.5)
    A.locator(".dl-sheet .btn.primary").click(); wait_jobs_idle(A)
    A.locator(".tabbar .tab", has_text="Biblioteca").click(); A.wait_for_selector(".track")
    device_count = A.locator(".track").count(); print("device library:", device_count)
    A.get_by_role("button", name="Añadir a Me gusta").first.click(); pump(0.3)

    # ---------- switch to Google Drive ----------
    A.goto(BASE+"/settings"); A.wait_for_selector(".storage-panel")
    A.locator(".setting button", has_text="Cambiar").click(); A.wait_for_selector(".setup-option")
    A.evaluate("() => { window.__fakeGoogle = { deny: 'canceled', calls: [] } }")
    A.locator(".setup-option").nth(1).locator("button.btn").click(); A.wait_for_selector(".setup-option .banner")
    print("cancel message:", A.locator(".setup-option .banner").inner_text()[:90]); shot(A,"02-canceled")
    A.evaluate("() => { window.__fakeGoogle.deny = undefined }")
    A.locator(".setup-option").nth(1).locator("button.btn").click(); A.wait_for_selector(".tabbar")
    print("drive tree after connect:", drive.tree())
    A.wait_for_selector(".copy-drive"); pump(0.5)
    print("copy offer:", A.locator(".copy-drive").inner_text().replace("\n"," | ")[:200]); shot(A,"03-copy-offer")
    A.locator(".copy-drive .btn.primary").click()
    wait_for(lambda: A.locator(".copy-drive").count()==0 or "Listo" in A.locator(".copy-drive").inner_text(), 40, "copy done")
    try: wait_for(lambda: drive.library() and drive.library()["playlists"], 20, "playlists in drive")
    except Exception as e:
        print("ERR:", "\n".join(errors[-30:])); print(drive.log[-10:])
        print("mem:", A.evaluate("async () => { const s = await window.__drive.getState(); return {dirty: s.dirty, pls: Object.keys(s.doc.playlists).length, v: s.remoteVersion} }"))
        print("pushing:", A.evaluate("async () => { try { return await window.__drive.sync() } catch (e) { return 'ERR ' + e } }"))
        print(drive.log[-6:], drive.library()["playlists"].keys())
        raise
    lib = drive.library()
    print("audio sizes:", [len(f["data"]) for f in drive.files.values() if f["mimeType"].startswith("audio")], "song.webm:", os.path.getsize(HERE+"/media/song.webm"))
    print("drive tree:", len(drive.tree()), "files;", [t for t in drive.tree() if "audio/" in t][:3])
    print("library.json tracks:", len(lib["tracks"]), "playlists:", [ (p["name"], len(p["trackIds"])) for p in lib["playlists"].values()])
    print("liked in drive:", sum(1 for t in lib["tracks"].values() if t["likedAt"]))
    assert len(lib["tracks"]) == device_count, (len(lib["tracks"]), device_count)
    print("ERR so far:", errors[:6]); print("log tail:", drive.log[-12:])
    print("drive-state:", A.evaluate("""async () => new Promise(r => { const q = indexedDB.open('aske'); q.onsuccess = () => { const g=q.result.transaction('kv').objectStore('kv').get('drive-state'); g.onsuccess=()=>{ const s=g.result; r({dirty:s.dirty, tracks:Object.keys(s.doc.tracks).length, pls:Object.values(s.doc.playlists).map(p=>p.name), liked:Object.values(s.doc.tracks).filter(t=>t.likedAt).length}) } } })"""))
    print("liked on device:", A.evaluate("""async () => new Promise(r => { const q = indexedDB.open('aske'); q.onsuccess = () => { const g=q.result.transaction('tracks').objectStore('tracks').getAll(); g.onsuccess=()=>r(g.result.filter(t=>t.likedAt).length) } })"""))
    print("pl in device:", A.evaluate("""async () => new Promise(r => { const q = indexedDB.open('aske'); q.onsuccess = () => { const db=q.result; const tx=db.transaction('playlists'); const g=tx.objectStore('playlists').getAll(); g.onsuccess=()=>r(g.result.map(p=>[p.name,p.trackIds.length])) } })"""))
    A.goto(BASE+"/"); pump(3); shot(A,"04a-after-reload"); print("body:", A.locator("main").inner_text()[:300])
    A.wait_for_selector(".track"); print("drive library in app:", A.locator(".track").count())
    shot(A,"04-drive-library")

    # play from Drive
    A.locator(".track-main").first.click(); pump(2)
    print("audio:", A.evaluate("() => [...document.querySelectorAll('audio')].map(a => [a.src.slice(0,30), a.currentTime, a.paused, a.error && a.error.code])"), A.evaluate("() => localStorage.getItem('aske:player-v2')")[:200])
    shot(A,"04b-play"); print("toasts:", A.locator(".toast").all_inner_texts(), "mini:", A.locator(".mini-player").all_inner_texts())
    wait_for(lambda: A.get_by_role("button", name="Pausar").count() > 0, 15, "playing from drive")
    print("drive downloads during play:", [l for l in drive.log if l.startswith("GET /drive/v3/files/f")][-3:])
    print("playing from drive: ok")
    print("cover from drive:", A.evaluate("() => [...document.querySelectorAll('.track img')].filter(i=>i.src.startsWith('blob:')).length"))

    # download straight into Drive
    A.locator(".tabbar .tab", has_text="Descargar").click(); A.wait_for_selector(".dl-search")
    print("where:", A.locator(".dl-where").inner_text().split("\n")[0])
    before = len(drive.library()["tracks"])
    A.fill(".dl-search input","https://www.youtube.com/watch?v=newsong0001"); A.wait_for_selector(".dl-link")
    A.locator(".dl-link .btn.primary").click(); st=wait_jobs_idle(A); print("download into drive:", st[-1] if st else st)
    pump(4); print("drive tracks:", before, "->", len(drive.library()["tracks"]))

    # storage panel
    A.goto(BASE+"/settings"); A.wait_for_selector(".storage-panel"); pump(0.8)
    print("storage:", A.locator(".storage-panel").inner_text().replace("\n"," | ")[:260]); shot(A,"05-storage")

    # ---------- B: a second device with the same Google account ----------
    ctxB, B = new_device("B")
    B.goto(BASE+"/"); B.wait_for_selector(".welcome-card"); B.get_by_role("button", name="Saltar").click(); B.wait_for_selector(".setup-option")
    B.locator(".setup-option").nth(1).locator("button.btn").click(); B.wait_for_selector(".tabbar")
    B.wait_for_selector(".track"); print("B sees:", B.locator(".track").count(), "songs")
    # B deletes one song, A likes another at the same time
    B.locator(".track").first.get_by_role("button", name="Más opciones").click(); pump(0.3)
    B.locator("button", has_text="Eliminar de la biblioteca").first.click(); pump(0.4)
    shot(B,"06-delete-confirm")
    B.locator(".btn.danger").last.click(); pump(0.4)
    A.goto(BASE+"/"); A.wait_for_selector(".track")
    A.get_by_role("button", name="Añadir a Me gusta").first.click()
    pump(5)
    lib = drive.library()
    print("after concurrent changes: tracks", len(lib["tracks"]), "liked", sum(1 for t in lib["tracks"].values() if t["likedAt"]), "deleted marks", len(lib["deleted"]))
    A.reload(); A.wait_for_selector(".track"); pump(1.5); A.reload(); A.wait_for_selector(".track")
    B.reload(); B.wait_for_selector(".track"); pump(1.5)
    print("A count", A.locator(".track").count(), "B count", B.locator(".track").count())

    # token expiry → refreshed silently on the phone
    drive.fail_next = 401
    A.reload(); A.wait_for_selector(".track"); pump(1)
    print("after 401:", A.locator(".drive-reconnect").count()==0 and "silent refresh ok")

    # help
    A.goto(BASE+"/help/drive-what"); A.wait_for_selector("h1"); shot(A,"07-help")
    print("help:", A.locator("h1").first.inner_text())
    # disconnect
    A.goto(BASE+"/settings"); A.wait_for_selector(".storage-panel")
    A.locator("button", has_text="Desconectar de Google Drive").click(); pump(0.3)
    shot(A,"06-disconnect-confirm")
    A.locator(".dialog .btn.danger, [role=dialog] .btn.danger").first.click(); A.wait_for_selector(".setup-option")
    print("after disconnect: choose screen;", A.evaluate("() => window.__fakeGoogle.calls.slice(-2)"))
    print("files still in drive:", len(drive.tree()), "in bin:", sum(1 for f in drive.files.values() if f["trashed"]))
    ctxA.close(); ctxB.close()

print("unhandled:", [l for l in drive.log if 'unhandled' in l])
print("ERRORS:", errors[:10])
