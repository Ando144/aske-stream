import os as _os
HERE=_os.path.dirname(_os.path.abspath(__file__))
CHROME=_os.environ.get("CHROME_PATH") or None
import time
from playwright.sync_api import sync_playwright
BASE=_os.environ.get("BASE","http://127.0.0.1:8787"); OUT=_os.path.join(HERE,"shots","shots6"); _os.makedirs(OUT, exist_ok=True); KEY="local-dev-access-key-change-me-0123456789"
errors=[]
def shot(p,n): p.screenshot(path=f"{OUT}/{n}.png")
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=CHROME,headless=True)
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,locale="es-ES")
    p=ctx.new_page(); p.on("pageerror",lambda e: errors.append(str(e)))
    p.goto(BASE+"/"); p.wait_for_selector(".welcome-card"); shot(p,"01-welcome1")
    for i in range(3):
        p.get_by_role("button", name="Siguiente").click(); time.sleep(0.15)
    shot(p,"02-welcome4")
    p.get_by_role("button", name="Empezar").click(); p.wait_for_selector(".setup-option")
    p.get_by_role("button", name="¿No sabes cuál elegir?").click(); p.wait_for_selector(".help-sheet"); time.sleep(0.4)
    shot(p,"03-help-sheet")
    p.locator(".help-sheet .help-link", has_text="qué es Cloudflare").click(); time.sleep(0.2)
    print("sheet nav:", p.locator(".help-sheet h2").inner_text())
    p.locator(".help-sheet button[aria-label='Atrás']").click(); time.sleep(0.2)
    print("sheet back:", p.locator(".help-sheet h2").inner_text())
    p.locator(".help-sheet button[aria-label='Cerrar']").click()
    # pair screen helps
    p.locator(".setup-option").nth(2).locator("button.btn").click(); p.locator(".pair-other summary").click(); p.wait_for_selector("#key")
    p.get_by_role("button", name="¿Dónde encuentro la dirección y la clave?").click(); p.wait_for_selector(".help-sheet"); time.sleep(0.4)
    shot(p,"04-pair-help"); p.locator(".help-sheet button[aria-label='Cerrar']").click()
    shot(p,"05-pair")
    p.get_by_role("button", name="Elegir otra opción").click(); p.wait_for_selector(".setup-option")
    p.locator(".setup-option").nth(0).locator("button.btn").click(); p.wait_for_selector(".first-steps")
    shot(p,"06-library-first")
    print("tip:", p.locator(".screen-tip").count(), "steps:", p.locator(".first-steps").inner_text().replace("\n"," | "))
    p.locator(".screen-tip .btn", has_text="Entendido").click(); print("tip after dismiss:", p.locator(".screen-tip").count())
    # help centre
    p.goto(BASE+"/settings"); p.wait_for_selector(".setting-link")
    p.get_by_text("Centro de ayuda").click(); p.wait_for_selector(".help-list"); shot(p,"07-help-home")
    p.fill(".help-page input","radio"); time.sleep(0.2); print("search radio:", p.locator(".help-item").all_inner_texts()[:4])
    p.locator(".help-item").first.click(); p.wait_for_selector(".help-article"); time.sleep(0.2); shot(p,"08-article")
    links=p.locator(".help-article .help-link")
    if links.count(): links.first.click(); time.sleep(0.2); print("internal link ->", p.url)
    p.goto(BASE+"/"); p.wait_for_selector(".first-steps"); print("steps after help:", p.locator(".first-steps li.done").count())
    # replay intro
    p.goto(BASE+"/settings"); p.get_by_text("Ver la introducción otra vez").click(); p.wait_for_selector(".welcome-card")
    p.get_by_role("button", name="Saltar").click(); time.sleep(0.3); print("after replay:", p.url)
    # reset tips
    p.goto(BASE+"/settings"); p.get_by_text("Volver a mostrar los consejos").click(); time.sleep(0.3)
    p.goto(BASE+"/radio"); p.wait_for_selector(".screen-tip"); print("radio tip ok"); shot(p,"09-radio-tip")
    # english + basque welcome
    ctx2=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,locale="eu-ES"); q=ctx2.new_page()
    q.goto(BASE+"/"); q.wait_for_selector(".welcome-card"); print("eu:", q.locator(".welcome-card h1").inner_text()); shot(q,"10-welcome-eu")
    # existing user (setup saved before tips existed) skips welcome
    ctx3=b.new_context(viewport={"width":390,"height":844},locale="es-ES"); r=ctx3.new_page()
    r.goto(BASE+"/"); r.evaluate("() => localStorage.setItem('aske:setup', JSON.stringify({home:'device'}))"); r.reload()
    r.wait_for_selector(".page-header"); print("existing user welcome:", r.locator(".welcome-card").count())
    # desktop sidebar help
    ctx4=b.new_context(viewport={"width":1280,"height":800},locale="es-ES"); d=ctx4.new_page()
    d.goto(BASE+"/"); d.evaluate("() => localStorage.setItem('aske:setup', JSON.stringify({home:'device'}))"); d.reload(); d.wait_for_selector(".sidebar")
    d.locator(".sidebar .side-link", has_text="Ayuda").click(); d.wait_for_selector(".help-list"); d.screenshot(path=f"{OUT}/11-desktop-help.png")
    b.close()
print("errors:", errors)
