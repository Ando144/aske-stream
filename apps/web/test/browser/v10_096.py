"""v0.9.6 on a phone-sized screen with the fake native plugins (see README.md).

The library title fits in the three languages, the study mode playlists work with
the arrow keys and sharing a video shows one notice only. Reuses the helpers of
v9_095.py, so nothing leaves the machine.
"""

import os

from playwright.sync_api import expect, sync_playwright

from v9_095 import BASE, CHROME, HERE, PHONE, Network
from v9_095 import open_tab, set_up_phone_library, share, wait_downloads

OUT = os.path.join(HERE, "shots", "shots96")
SHARED_ID = "abc123def45"
PLAYLISTS = ["Uno", "Dos", "Tres"]
TITLES = {"es": "Tu biblioteca", "en": "Your library", "eu": "Zure liburutegia"}
ADDED = "Añadida a las descargas. La verás en Descargar."
RECORD_TOASTS = """() => {
  window.__toasts = [];
  const seen = new WeakSet();
  new MutationObserver(() => {
    for (const node of document.querySelectorAll('.toast')) {
      if (seen.has(node)) continue;
      seen.add(node);
      window.__toasts.push(node.textContent);
    }
  }).observe(document.body, { childList: true, subtree: true });
}"""


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"))


def check_share_one_notice(page):
    page.evaluate(RECORD_TOASTS)
    share(page, f"https://youtu.be/{SHARED_ID}")
    sheet = page.locator(".share-in")
    expect(sheet).to_contain_text(f"Shared song {SHARED_ID}")
    sheet.get_by_role("button", name="Descargar").click()
    expect(sheet).to_have_count(0)
    expect(page.locator(".toast", has_text=ADDED)).to_be_visible()
    shot(page, "01-share-one-notice")
    wait_downloads(page, [SHARED_ID])
    notices = page.evaluate("() => window.__toasts")
    assert notices.count(ADDED) == 1, notices
    assert not [n for n in notices if "cola de descargas" in n], notices
    print("ok share: a single notice")


def create_playlists(page):
    open_tab(page, "Playlists")
    for name in PLAYLISTS:
        page.get_by_role("button", name="Nueva playlist").click()
        field = page.get_by_placeholder("Nombre de la playlist")
        field.fill(name)
        field.press("Enter")
        expect(field).to_have_count(0)
        expect(page.locator(".main a[href^='/playlist/']", has_text=name)).to_be_visible()


def assert_selected(radios, index):
    for position in range(radios.count()):
        radio = radios.nth(position)
        chosen = position == index
        expect(radio).to_have_attribute("aria-checked", "true" if chosen else "false")
        expect(radio).to_have_attribute("tabindex", "0" if chosen else "-1")
    expect(radios.nth(index)).to_be_focused()


def check_study_arrows(page):
    page.goto(BASE + "/study")
    radios = page.locator(".study-playlists [role=radio]")
    expect(radios).to_have_count(len(PLAYLISTS))
    expect(radios.first).to_have_attribute("tabindex", "0")
    expect(page.locator(".study-playlists [tabindex='-1']")).to_have_count(len(PLAYLISTS) - 1)
    page.get_by_role("button", name="Tranquila, sin letra").focus()
    page.keyboard.press("Tab")
    expect(radios.first).to_be_focused()
    last = len(PLAYLISTS) - 1
    steps = [("ArrowDown", 1), ("ArrowRight", 2), ("ArrowDown", 0), ("ArrowUp", last)]
    for key, index in steps + [("ArrowLeft", last - 1), ("Home", 0), ("End", last)]:
        page.keyboard.press(key)
        assert_selected(radios, index)
    shot(page, "02-study-arrows")
    page.keyboard.press("Tab")
    expect(page.locator(".study-playlists :focus")).to_have_count(0)
    page.keyboard.press("Shift+Tab")
    expect(radios.nth(last)).to_be_focused()
    print("ok study: one tab stop, the arrows choose the playlist")


def assert_title_fits(page, language):
    page.evaluate(f"() => localStorage.setItem('aske:language', '\"{language}\"')")
    page.goto(BASE + "/")
    title = page.locator(".page-header h1")
    expect(title).to_have_text(TITLES[language])
    expect(page.locator(".boot-splash")).to_have_count(0)
    page.evaluate("() => document.fonts.ready")
    sizes = title.evaluate("e => [e.scrollWidth, e.clientWidth]")
    shot(page, f"03-library-{language}")
    assert sizes[0] <= sizes[1], f"{language}: title cut {sizes}"
    buttons = page.locator(".page-header .btn")
    expect(buttons).to_have_count(2)
    for index in range(buttons.count()):
        assert buttons.nth(index).get_attribute("aria-label"), "icon button without a name"
        expect(buttons.nth(index).locator("span.hide-narrow")).to_be_hidden()


def check_library_title(page):
    for language in TITLES:
        assert_title_fits(page, language)
    page.set_viewport_size({"width": 800, "height": PHONE["height"]})
    expect(page.locator(".page-header .btn span.hide-narrow").first).to_be_visible()
    print("ok library: the whole title at 390 px in es, en and eu")


def run(browser):
    context = browser.new_context(
        viewport=PHONE,
        device_scale_factor=2,
        has_touch=True,
        is_mobile=True,
        locale="es-ES",
        service_workers="block",
    )
    context.route("**/*", Network().handle)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/")
    page.wait_for_selector(".welcome-card")
    set_up_phone_library(page)

    check_share_one_notice(page)
    create_playlists(page)
    check_study_arrows(page)
    check_library_title(page)

    context.close()
    assert not errors, errors


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
        try:
            run(browser)
        finally:
            browser.close()
    print("ALL OK")


if __name__ == "__main__":
    main()
