"""Screenshots, banner and videos for docs/media. Started by run.mjs (see README.md).

Environment: BASE, ACCESS_KEY, MODE (web | native), OUT (docs/media), ASSETS
(generated pictures and data), VIDEOS (temporary folder), optional CHROME_PATH.
Nothing leaves the machine: every request that is not for BASE is answered here
with generated data, or aborted.
"""

import json
import os
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

BASE = os.environ["BASE"]
KEY = os.environ["ACCESS_KEY"]
MODE = os.environ["MODE"]
OUT = Path(os.environ["OUT"])
ASSETS = Path(os.environ["ASSETS"])
VIDEOS = Path(os.environ["VIDEOS"])
CHROME = os.environ.get("CHROME_PATH") or None
HERE = Path(__file__).resolve().parent
DATA = json.loads((ASSETS / "data.json").read_text(encoding="utf-8"))
PHONE = {"width": 390, "height": 844}
DESKTOP = {"width": 1440, "height": 900}
# Everything a first-time user would be told, already seen.
SEEN = {
    "aske:tips-v1": {
        "welcomeSeen": True,
        "dismissed": [
            "library",
            "playlists",
            "playlists-friends",
            "radio",
            "offline",
            "podcasts",
            "groups",
            "study-pin",
            "dl-send-2",
        ],
        "firstStepsHidden": True,
        "helpVisited": True,
        "firstStepsDone": True,
    },
    "aske:dl-intro-seen": True,
}
PROBLEMS = ".toast.error, .error-text, .connection-banner, .server-banner, .drive-reconnect"
IMAGES_READY = """() => [...document.images].every((img) => {
  const box = img.getBoundingClientRect();
  const visible = box.width > 0 && box.bottom > 0 && box.top < innerHeight;
  return !visible || (img.complete && img.naturalWidth > 0);
})"""


class Network:
    """Answers everything the app asks for outside the local Worker."""

    def handle(self, route):
        url = urlsplit(route.request.url)
        if url.path.startswith("/api/radio/"):
            self.radio(route, url.path.removeprefix("/api/radio/"))
        elif url.path.startswith("/test-media/"):
            self.test_media(route, url.path.removeprefix("/test-media/"))
        elif url.netloc == urlsplit(BASE).netloc:
            route.continue_()
        elif url.path.endswith("/hub/v1/health"):
            route.fulfill(json={"ok": True}, headers={"access-control-allow-origin": "*"})
        elif url.hostname == "radio.invalid" and url.path.endswith(".jpg"):
            self.picture(route, url.path.lstrip("/"))
        else:
            route.abort()

    def radio(self, route, path):
        if path == "stations":
            route.fulfill(json=DATA["stations"])
        elif path in ("tags", "countries"):
            route.fulfill(json=DATA[path])
        else:
            route.fulfill(status=204)

    def test_media(self, route, name):
        """The fake Android downloader points at these; they never reach the Worker."""
        if name.endswith(".jpg"):
            self.picture(route, name if name.startswith("thumb-") else "thumb-0.jpg")
        else:
            route.abort()

    def picture(self, route, name):
        route.fulfill(path=str(ASSETS / Path(name).name), content_type="image/jpeg")


class Finger:
    """Real touch events (the gestures ignore the mouse) through the DevTools protocol."""

    def __init__(self, page):
        self.page = page
        self.session = page.context.new_cdp_session(page)

    def send(self, kind, points):
        self.session.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": points})
        self.page.wait_for_timeout(30)

    def swipe(self, start, end, y, steps=14):
        self.send("touchStart", [{"x": start, "y": y}])
        for step in range(1, steps + 1):
            x = start + (end - start) * step / steps
            self.send("touchMove", [{"x": x, "y": y}])
        self.page.wait_for_timeout(150)
        self.send("touchEnd", [])


@contextmanager
def app(browser, size=PHONE, scale=2, paired=True, video=None):
    """A fresh browser with the app's world faked; fails on any script error."""
    phone = size == PHONE
    options = {
        "viewport": size,
        "device_scale_factor": scale,
        "has_touch": phone,
        "is_mobile": phone,
        "locale": "en-US",
        "color_scheme": "dark",
        "service_workers": "block",
    }
    if video:
        options.update(record_video_dir=str(VIDEOS), record_video_size=size)
    context = browser.new_context(**options)
    context.route("**/*", Network().handle)
    if paired:
        reply = context.request.post(f"{BASE}/api/auth/pair", data={"key": KEY})
        assert reply.ok, f"pairing failed: {reply.status}"
        context.add_init_script(
            f"for (const [k, v] of Object.entries({json.dumps(SEEN)}))"
            " localStorage.setItem(k, JSON.stringify(v));"
        )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    recording = page.video if video else None
    try:
        yield page
        assert not errors, errors
    finally:
        context.close()
        if recording:
            recording.save_as(str(VIDEOS / f"{video}.webm"))
            recording.delete()


def assert_clean(page):
    problems = page.locator(PROBLEMS)
    assert problems.count() == 0, f"error on screen: {problems.all_inner_texts()}"


def shot(page, name):
    page.evaluate("() => document.fonts.ready.then(() => true)")
    expect(page.locator(".toast")).to_have_count(0, timeout=10000)
    page.wait_for_function(IMAGES_READY)
    page.wait_for_timeout(600)
    assert_clean(page)
    page.screenshot(path=str(OUT / "screenshots" / f"{name}.png"))
    print(f"   {name}.png")


def open_path(page, path, ready):
    page.goto(BASE + path)
    page.wait_for_selector(ready)


def play_song(page, title):
    page.locator(".track", has_text=title).locator(".track-main").click()
    page.wait_for_timeout(3500)


def library_and_player(page):
    open_path(page, "/", ".track")
    play_song(page, "Golden Hour Machines")
    page.wait_for_selector(".mini-player")
    shot(page, "mobile-library")
    page.locator(".mini-player .open-area").click()
    page.wait_for_selector(".now-playing .np-swipe")
    page.wait_for_timeout(4000)
    shot(page, "mobile-now-playing")


def playlist(page):
    open_path(page, "/playlists", ".card-row")
    page.locator(".card-row", has_text="Late Night Drive").first.click()
    page.wait_for_selector(".track")
    shot(page, "mobile-playlist")


def offline(page):
    open_path(page, "/offline", ".panel")
    rows = page.locator(".track")
    expect(rows.first).to_be_visible(timeout=60000)
    expect(page.locator(".page-header button.btn[disabled]")).to_have_count(0, timeout=60000)
    expect(page.get_by_text("Last update: never")).to_have_count(0)
    shot(page, "mobile-offline")


def radio(page):
    open_path(page, "/radio", ".card-row")
    expect(page.locator(".card-row", has_text="Pocket Sunrise")).to_have_count(1)
    shot(page, "mobile-radio")


def help_centre(page):
    open_path(page, "/help", ".help-list")
    shot(page, "mobile-help")


def storage_choice(browser):
    with app(browser, paired=False) as page:
        open_path(page, "/", ".welcome-card")
        page.get_by_role("button", name="Skip").click()
        page.wait_for_selector(".setup-option")
        shot(page, "mobile-storage-choice")


def desktop(browser):
    with app(browser, size=DESKTOP, scale=1) as page:
        open_path(page, "/", ".track")
        play_song(page, "Golden Hour Machines")
        page.wait_for_selector(".player-bar")
        page.mouse.move(0, 0)
        shot(page, "desktop")


def hold_scripts(page):
    """Holds the app scripts back; returns the function that lets them through."""
    held = []
    holding = [True]

    def gate(route):
        if holding[0]:
            held.append(route)
        else:
            route.fallback()

    page.route("**/assets/*.js", gate)

    def release():
        holding[0] = False
        for route in held:
            route.fallback()

    return release


def save_cut(name, start, end):
    """Tells run.mjs which part of the video becomes the GIF."""
    cut = {"start": round(start, 2), "duration": round(end - start, 2)}
    (VIDEOS / f"{name}.json").write_text(json.dumps(cut), encoding="utf-8")


def start_video(browser):
    with app(browser, scale=1, video="start") as page:
        began = time.monotonic()
        release = hold_scripts(page)
        page.goto(BASE + "/", wait_until="commit")
        page.wait_for_selector(".boot-splash svg")
        start = time.monotonic() - began
        # Slow enough for the equalizer to appear under the logo.
        page.wait_for_timeout(2400)
        release()
        page.wait_for_selector(".track")
        page.wait_for_timeout(2000)
        assert_clean(page)
        save_cut("start", start, time.monotonic() - began)


def player_video(browser):
    with app(browser, scale=1, video="player") as page:
        began = time.monotonic()
        finger = Finger(page)
        open_path(page, "/", ".track")
        play_song(page, "Golden Hour Machines")
        start = time.monotonic() - began
        page.wait_for_timeout(700)
        page.locator(".mini-player .open-area").click()
        area = page.locator(".np-swipe")
        expect(area).to_be_visible()
        page.wait_for_timeout(1500)
        title = area.locator(".np-title").first.inner_text()
        box = area.bounding_box()
        finger.swipe(320, 40, box["y"] + box["height"] / 2)
        expect(area.locator(".np-title").first).not_to_have_text(title)
        page.wait_for_timeout(1800)
        assert_clean(page)
        save_cut("player", start, time.monotonic() - began)


def banners(browser):
    html = (HERE / "banner.html").read_text(encoding="utf-8")
    for name, height in (("banner", 400), ("social-preview", 640)):
        page = browser.new_page(viewport={"width": 1280, "height": height})
        page.set_content(html)
        page.screenshot(path=str(OUT / f"{name}.png"))
        page.close()
        print(f"   {name}.png")


def capture_web(browser):
    banners(browser)
    storage_choice(browser)
    for scene in (library_and_player, playlist, offline, radio, help_centre):
        with app(browser) as page:
            scene(page)
    desktop(browser)
    start_video(browser)
    player_video(browser)


def dress_results(page):
    """The fake downloader has placeholder names: show the invented catalog instead."""
    page.evaluate(
        """(videos) => document.querySelectorAll('.dl-result').forEach((row, i) => {
          const video = videos[i % videos.length];
          row.querySelector('.card-title').textContent = video.title;
          const meta = row.querySelector('.card-title + div');
          meta.textContent = meta.textContent.replace(/^[^·]+/, video.author + ' ');
          row.querySelector('img').src = `/test-media/thumb-${i % videos.length}.jpg`;
        })""",
        DATA["videos"],
    )


def android_download(page):
    open_path(page, "/download", ".dl-search input")
    page.fill(".dl-search input", "velmora drift")
    page.press(".dl-search input", "Enter")
    results = page.locator(".dl-result")
    expect(results).to_have_count(3)
    page.locator(".dl-more").click()
    expect(results).to_have_count(4)
    expect(results.locator("img")).to_have_count(4)
    page.locator(".dl-search input").blur()
    dress_results(page)
    shot(page, "android-download")


def android_study(page):
    open_path(page, "/study", ".study-setup")
    page.locator(".study-playlist", has_text="Study Focus").click()
    page.locator(".study-big").click()
    page.wait_for_selector(".study-focus .study-clock")
    page.wait_for_timeout(2000)
    shot(page, "android-study")


def capture_native(browser):
    for scene in (android_download, android_study):
        with app(browser) as page:
            scene(page)


def main():
    (OUT / "screenshots").mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=CHROME,
            headless=True,
            args=["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
        )
        try:
            capture_web(browser) if MODE == "web" else capture_native(browser)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
