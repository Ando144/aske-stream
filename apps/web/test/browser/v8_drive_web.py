import os as _os
HERE=_os.path.dirname(_os.path.abspath(__file__))
CHROME=_os.environ.get("CHROME_PATH") or None
import time, sys, os
sys.path.insert(0, HERE)
from fakedrive import FakeDrive
from playwright.sync_api import sync_playwright
BASE=_os.environ.get("BASE","http://127.0.0.1:8787"); OUT=_os.path.join(HERE,"shots","shots8"); os.makedirs(OUT, exist_ok=True)
errors=[]
FAKE_GIS = """
window.__gis = { requests: [], mode: 'ok' };
window.google = { accounts: { oauth2: {
  initTokenClient(cfg) { return { requestAccessToken(o) {
    window.__gis.requests.push({ client: cfg.client_id, scope: cfg.scope, prompt: o && o.prompt });
    setTimeout(() => {
      if (window.__gis.mode === 'closed') cfg.error_callback && cfg.error_callback({ type: 'popup_closed' });
      else cfg.callback({ access_token: 'fake-token', expires_in: 3599 });
    }, 50);
  } }; },
  revoke(token, done) { window.__gis.revoked = token; done && done(); },
} } };
"""
drive = FakeDrive()
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CHROME,headless=True)
    ctx=b.new_context(viewport={"width":1280,"height":800},locale="es-ES")
    ctx.route("https://www.googleapis.com/**", drive.handle)
    ctx.route("https://accounts.google.com/gsi/client", lambda r: r.fulfill(status=200, body=FAKE_GIS, content_type="text/javascript"))
    p=ctx.new_page(); p.on("pageerror",lambda e: errors.append(str(e)))
    p.on("console", lambda m: m.type=="error" and errors.append("console: "+m.text))
    p.goto(BASE+"/"); p.wait_for_selector(".welcome-card"); p.get_by_role("button", name="Saltar").click(); p.wait_for_selector(".setup-option")
    btn=p.locator(".setup-option").nth(1).locator("button.btn"); print("web drive button:", btn.inner_text(), "enabled:", btn.is_enabled())
    p.locator(".setup-option").nth(1).screenshot(path=f"{OUT}/01-option.png")
    btn.click(); p.wait_for_selector(".sidebar, .tabbar")
    print("gis requests:", p.evaluate("() => window.__gis.requests"))
    p.wait_for_timeout(1500)
    print("library.json created:", drive.library() is not None, "tree:", drive.tree())
    # import a file into Drive
    p.set_input_files("[data-testid=import-input]", HERE+"/media/song.webm")
    for _ in range(40):
        if p.locator(".track").count(): break
        p.wait_for_timeout(300)
    p.wait_for_timeout(3500)
    print("imported:", p.locator(".track").count(), "drive tracks:", len(drive.library()["tracks"]), [t for t in drive.tree() if 'audio/' in t])
    # token expired: reconnect bar
    p.evaluate("() => sessionStorage.removeItem('aske:drive-token')")
    p.reload(); p.wait_for_selector(".drive-reconnect", timeout=10000)
    print("reconnect bar:", p.locator(".drive-reconnect").inner_text().replace("\n"," | "))
    print("still shows library:", p.locator(".track").count())
    p.screenshot(path=f"{OUT}/02-reconnect.png")
    p.locator(".drive-reconnect button").click(); p.wait_for_timeout(800)
    print("bar after tap:", p.locator(".drive-reconnect").count(), "prompts:", [r["prompt"] for r in p.evaluate("() => window.__gis.requests")])
    # disconnect
    p.goto(BASE+"/settings"); p.wait_for_selector(".storage-panel"); p.wait_for_timeout(600)
    p.screenshot(path=f"{OUT}/03-settings.png", full_page=True)
    print("settings storage:", p.locator(".storage-panel").inner_text().replace("\n"," | ")[:200])
    ctx.close()
print("ERRORS:", errors[:6])
