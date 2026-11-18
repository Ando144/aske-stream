import os as _os
HERE=_os.path.dirname(_os.path.abspath(__file__))
CHROME=_os.environ.get("CHROME_PATH") or None
import time, json
from playwright.sync_api import sync_playwright
BASE=_os.environ.get("BASE","http://127.0.0.1:8787"); OUT=_os.path.join(HERE,"shots","shots5"); _os.makedirs(OUT, exist_ok=True); KEY="local-dev-access-key-change-me-0123456789"
errors=[]
def shot(p,n): p.screenshot(path=f"{OUT}/{n}.png")
def wait_jobs_idle(p, timeout=20):
    time.sleep(0.7)
    t0=time.time()
    while time.time()-t0<timeout:
        st=p.evaluate("() => (JSON.parse(localStorage.getItem('aske:downloads-v1')||'[]')).map(j=>j.status)")
        if st and not any(s in ('queued','downloading','saving') for s in st):
            time.sleep(0.6); return p.evaluate("() => (JSON.parse(localStorage.getItem('aske:downloads-v1')||'[]')).map(j=>j.status)")
        time.sleep(0.3)
    raise Exception("jobs not idle: "+str(st))
def jobs(p): return p.evaluate("() => JSON.parse(localStorage.getItem('aske:downloads-v1')||'[]')")

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CHROME,headless=True,args=["--autoplay-policy=no-user-gesture-required"])
    # ---------------- A: library on the phone ----------------
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,locale="es-ES")
    p=ctx.new_page(); p.on("pageerror",lambda e: errors.append("A "+str(e)))
    p.goto(BASE+"/"); p.wait_for_selector(".welcome-card"); p.get_by_role("button", name="Saltar").click(); p.wait_for_selector(".setup-option")
    p.locator(".setup-option").nth(0).locator("button.btn").click(); p.wait_for_selector(".tabbar")
    tabs=p.locator(".tabbar .tab").all_inner_texts(); print("tabs:", tabs); assert "Descargar" in " ".join(tabs) and "Sin conexión" not in " ".join(tabs)
    p.locator(".tabbar .tab", has_text="Descargar").click(); p.wait_for_selector(".dl-search")
    shot(p,"01-intro")
    p.locator(".dl-intro .icon-btn").click()
    p.fill(".dl-search input","itoiz"); p.press(".dl-search input","Enter")
    p.wait_for_selector(".dl-result"); print("results:", p.locator(".dl-result").count())
    shot(p,"02-results")
    p.locator(".dl-result").nth(0).locator("button").click()
    time.sleep(0.15); shot(p,"03-downloading")
    order=p.evaluate("() => { const r=document.querySelector('.dl-result'), q=document.querySelector('.dl-job'); return r && q ? !!(r.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING) : null }")
    print("results before queue:", order)
    print("notif during:", p.evaluate("() => window.__fakeNative.notification"))
    st=wait_jobs_idle(p); print("after 1:", st)
    j=jobs(p)[0]; assert j["status"]=="done", j
    lib=p.evaluate("""async () => { const r = indexedDB.open('aske-offline'); return null }""")
    # library check through UI
    p.locator(".dl-result").nth(2).locator("button").click(); st=wait_jobs_idle(p)
    print("fail job:", [ (x["status"], x.get("error")) for x in jobs(p) if x["videoId"].startswith("fail")])
    time.sleep(0.3); shot(p,"04-error")
    # already in library -> pill
    pill=p.locator(".dl-result").nth(0).locator(".pill").inner_text(); print("pill:", pill)
    # playlist
    p.locator(".dl-kinds button", has_text="Playlists").click(); p.wait_for_selector(".dl-result")
    p.locator(".dl-result").nth(0).locator("button").click(); p.wait_for_selector(".dl-entries")
    time.sleep(0.6); shot(p,"05-playlist-sheet")
    p.locator(".dl-sheet .btn.primary").click()
    for k in range(4):
        time.sleep(0.5); print("  t", k, [(x['videoId'][-1],x['status']) for x in jobs(p)], p.evaluate("() => window.__fakeNative.calls.slice(-3)"))
    st=wait_jobs_idle(p); print("playlist jobs:", st, [(x['videoId'],x['status']) for x in jobs(p)])
    # link
    p.fill(".dl-search input","https://music.youtube.com/watch?v=song0000009&list=PLzzz000000"); p.wait_for_selector(".dl-link")
    shot(p,"06-link"); p.locator(".dl-link .btn.primary").click(); wait_jobs_idle(p)
    # resume after the app is closed mid-download
    p.fill(".dl-search input","https://www.youtube.com/playlist?list=PLRESUME0001"); p.wait_for_selector(".dl-link")
    p.locator(".dl-link .btn.primary").click(); time.sleep(0.9)
    print("before reload:", [(x['videoId'][-1],x['status']) for x in jobs(p) if x['videoId'].startswith('resume')])
    p.reload(); p.wait_for_selector(".dl-search"); st=wait_jobs_idle(p, 20)
    print("after reload:", [(x['videoId'][-1],x['status']) for x in jobs(p) if x['videoId'].startswith('resume')])
    shot(p,"06b-queue-top")
    # engine update
    p.locator(".dl-engine .btn").click(); time.sleep(0.5); print("engine:", p.locator(".dl-engine").inner_text().split("\n")[0])
    p.locator("text=Terminadas").first.click(); time.sleep(0.2); shot(p,"07-queue")
    print("notification:", p.evaluate("() => window.__fakeNative.notification"))
    # library
    p.locator(".tabbar .tab", has_text="Biblioteca").click(); p.wait_for_selector(".track")
    titles=p.locator(".track .track-title, .track .ellipsis").all_inner_texts()[:12]; print("library:", titles)
    shot(p,"08-library")
    p.locator(".track-main").first.click(); time.sleep(1.5)
    print("playing:", p.evaluate("() => { const a=[...document.querySelectorAll('audio')]; return JSON.parse(localStorage.getItem('aske:player-v2')).currentId }"))
    p.locator(".tabbar .tab", has_text="Playlists").click(); time.sleep(0.4)
    print("playlists:", p.locator(".card-row").all_inner_texts())
    p.goto(BASE+"/settings"); p.wait_for_selector(".storage-panel"); time.sleep(0.5)
    print("storage A:", p.locator(".storage-panel").inner_text().replace("\n"," | ")); shot(p,"13-storage-device"); p.locator(".setting-link", has_text="Música sin conexión").click(); p.wait_for_selector(".meter")
    print("offline page ok:", p.url)
    ctx.close()

    # ---------------- B: Cloudflare library + send inbox ----------------
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,locale="es-ES")
    p=ctx.new_page(); p.on("pageerror",lambda e: errors.append("B "+str(e)))
    p.on("response", lambda r: print("   RESP", r.status, r.url[:80]) if "/api/ingest" in r.url else None)
    p.on("console", lambda m: print("   CONSOLE", m.text[:200]) if m.type in ("error","warning") else None)
    p.goto(BASE+"/"); p.wait_for_selector(".welcome-card"); p.get_by_role("button", name="Saltar").click(); p.wait_for_selector(".setup-option")
    p.locator(".setup-option").nth(2).locator("button.btn").click(); p.wait_for_selector("#key")
    p.fill("#key",KEY); p.locator("button[type=submit]").click(); p.wait_for_selector(".tabbar")
    p.evaluate("""async () => { const lib = await (await fetch('/api/library')).json();
      for (const t of lib.tracks.filter(t=>t.source==='youtube')) await fetch('/api/tracks/'+t.id,{method:'DELETE'});
      for (const pl of lib.playlists) await fetch('/api/playlists/'+pl.id,{method:'DELETE'});
      for (const i of await (await fetch('/api/send')).json()) await fetch('/api/send/'+i.id,{method:'DELETE'}); }""")
    p.reload(); p.wait_for_selector(".tabbar")
    p.goto(BASE+"/download"); p.wait_for_selector(".dl-where"); print("where:", p.locator(".dl-where").inner_text())
    p.fill(".dl-search input","x"); p.press(".dl-search input","Enter"); p.wait_for_selector(".dl-result")
    p.locator(".dl-result").nth(1).locator("button").click(); st=wait_jobs_idle(p); print("cloud job:", st)
    lib=p.evaluate("async () => (await (await fetch('/api/library')).json()).tracks.filter(t=>t.source==='youtube').map(t=>[t.title,t.artist,t.hasCover,t.sourceRef])")
    print("server tracks:", lib)
    print("offline pinned:", p.evaluate("async () => (await caches.open('aske-audio-v1')).keys().then(k=>k.length)"))
    # send from "computer" (API) then inbox
    r=p.evaluate("""async () => { const a = await fetch('/api/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://youtu.be/sendvid0001',title:'Sent song',author:'Someone'})}); 
      const b = await fetch('/api/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://www.youtube.com/playlist?list=PLsend000001'})}); return [a.status,b.status] }""")
    print("sent:", r)
    p.reload(); p.wait_for_selector(".tabbar"); time.sleep(1.5)
    st=wait_jobs_idle(p, 30); print("inbox jobs:", [(x['videoId'],x['status'],x.get('error')) for x in jobs(p)])
    time.sleep(0.8)
    items=p.evaluate("async () => (await (await fetch('/api/send')).json()).map(i=>[i.kind,i.status,i.detail,i.title])"); print("send items:", items)
    pls=p.evaluate("async () => (await (await fetch('/api/library')).json()).playlists.map(p=>[p.name,p.trackIds.length])"); print("server playlists:", pls)
    shot(p,"09-cloud")
    p.goto(BASE+"/settings"); p.wait_for_selector(".storage-panel"); time.sleep(0.8)
    print("storage B:", p.locator(".storage-panel").inner_text().replace("\n"," | ")); p.locator(".storage-panel").scroll_into_view_if_needed(); shot(p,"14-storage-cloud")
    ctx.close()
    b.close()
print("errors:", errors)
