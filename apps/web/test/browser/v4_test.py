import os as _os
HERE=_os.path.dirname(_os.path.abspath(__file__))
CHROME=_os.environ.get("CHROME_PATH") or None
import time
from playwright.sync_api import sync_playwright
BASE=_os.environ.get("BASE","http://127.0.0.1:8787"); OUT=_os.path.join(HERE,"shots","shots4"); _os.makedirs(OUT, exist_ok=True); KEY="local-dev-access-key-change-me-0123456789"
errors=[]
def shot(p,n): p.screenshot(path=f"{OUT}/{n}.png")
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CHROME,headless=True)
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,locale="es-ES")
    p=ctx.new_page(); p.on("pageerror",lambda e: errors.append(str(e)))
    p.goto(BASE+"/"); p.wait_for_selector(".welcome-card"); p.get_by_role("button", name="Saltar").click(); p.wait_for_selector(".setup-option")
    # Cloudflare -> key
    p.locator(".setup-option").nth(2).locator("button.btn").click(); p.wait_for_selector("#key")
    p.fill("#key", KEY); p.locator("button[type=submit]").click(); p.wait_for_selector(".page-header")
    # gear on every main screen
    for path in ["/","/playlists","/podcasts","/radio","/offline"]:
        p.goto(BASE+path); p.wait_for_selector(".page-header")
        assert p.locator(".page-header a[href='/settings']").is_visible(), path
    shot(p,"01-offline-gear")
    p.locator(".page-header a[href='/settings']").click(); p.wait_for_selector(".segmented")
    assert p.locator(".swatch").count()==0
    shot(p,"02-settings")
    # change storage -> cancel
    p.get_by_role("button", name="Cambiar").click(); p.wait_for_selector(".setup-option.current")
    shot(p,"03-change")
    p.get_by_role("button", name="Volver sin cambiar nada").click(); p.wait_for_selector(".page-header")
    assert p.evaluate("() => JSON.parse(localStorage.getItem('aske:setup')).home")=="cloudflare"
    # switch to device, then back to cloudflare without key
    p.goto(BASE+"/settings"); p.get_by_role("button", name="Cambiar").click()
    p.locator(".setup-option").nth(0).locator("button.btn").click(); p.wait_for_selector(".page-header")
    assert p.evaluate("() => JSON.parse(localStorage.getItem('aske:setup')).home")=="device"
    p.goto(BASE+"/settings"); p.wait_for_selector(".segmented")
    assert p.get_by_role("button", name="Desconectar de Cloudflare").is_visible()
    p.get_by_role("button", name="Cambiar").click()
    p.locator(".setup-option").nth(2).locator("button.btn").click(); p.wait_for_selector(".page-header", timeout=8000)
    assert p.locator("#key").count()==0
    assert p.evaluate("() => JSON.parse(localStorage.getItem('aske:setup')).home")=="cloudflare"
    print("back to cloudflare without key: OK")
    # reload keeps it
    p.reload(); p.wait_for_selector(".page-header"); assert p.locator("#key").count()==0
    # key screen back button keeps current storage available
    shot(p,"04-library")
    # light theme check
    p.goto(BASE+"/settings"); p.get_by_role("radio", name="Claro").click(); time.sleep(0.3)
    print("accent light:", p.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--accent')"))
    shot(p,"05-light")
    p.get_by_role("radio", name="Oscuro").click()
    print("accent dark:", p.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--accent')"))
    # unpair
    p.get_by_role("button", name="Desconectar de Cloudflare").click()
    p.locator(".dialog .btn.danger, .dialog button.danger").last.click(); p.wait_for_selector(".setup-option")
    p.locator(".setup-option").nth(2).locator("button.btn").click(); p.wait_for_selector("#key")
    print("after unpair asks key: OK")
    b.close()
print("errors:",errors)
