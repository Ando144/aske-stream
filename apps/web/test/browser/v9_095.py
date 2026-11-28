"""v0.9.5 on a phone-sized screen with the fake native plugins (see README.md).

Opening screen without text, a picture on every song row, swipe gestures (rows,
mini player, full screen player), "load more" and "Share -> Aske Stream".
Needs ffmpeg unless media/song.webm exists. Nothing leaves the machine: the Hub
and the YouTube thumbnails are answered by the test itself.
"""

import os
import subprocess
import tempfile
from urllib.parse import quote, urlsplit

from playwright.sync_api import expect, sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = os.environ.get("CHROME_PATH") or None
BASE = os.environ.get("BASE", "http://127.0.0.1:8787")
OUT = os.path.join(HERE, "shots", "shots95")
MEDIA = os.path.join(HERE, "media")
PHONE = {"width": 390, "height": 844}
SONG_SECONDS = 60
SHARED_ID = "abc123def45"


def read(path):
    with open(path, "rb") as f:
        return f.read()


def song_bytes():
    """A song long enough not to end (and change by itself) during the test."""
    committed = os.path.join(MEDIA, "song.webm")
    if os.path.exists(committed):
        return read(committed)
    with tempfile.TemporaryDirectory() as folder:
        path = os.path.join(folder, "song.webm")
        source = f"sine=frequency=330:duration={SONG_SECONDS}"
        command = ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", source]
        subprocess.run(command + ["-c:a", "libopus", "-b:a", "32k", path], check=True)
        return read(path)


class Network:
    """Answers everything the app asks for outside the app files."""

    def __init__(self):
        self.song = song_bytes()
        self.picture = read(os.path.join(MEDIA, "thumb.jpg"))
        self.pictures_work = True
        self.hold_health = False
        self.held = []

    def handle(self, route):
        url = urlsplit(route.request.url)
        if url.path.endswith("/hub/v1/health"):
            if self.hold_health:
                self.held.append(route)
            else:
                self.answer_health(route)
        elif url.path == "/test-media/song.webm":
            route.fulfill(body=self.song, content_type="audio/webm")
        elif url.path == "/test-media/thumb.jpg" or url.hostname == "i.ytimg.com":
            if self.pictures_work:
                route.fulfill(body=self.picture, content_type="image/jpeg")
            else:
                route.abort()
        elif url.netloc == urlsplit(BASE).netloc:
            route.continue_()
        else:
            route.abort()

    def answer_health(self, route):
        headers = {"access-control-allow-origin": "*"}
        route.fulfill(json={"ok": True}, headers=headers)

    def release_health(self):
        self.hold_health = False
        while self.held:
            self.answer_health(self.held.pop())


class Finger:
    """Real touch events (the gestures ignore the mouse) through the DevTools protocol."""

    def __init__(self, page):
        self.page = page
        self.session = page.context.new_cdp_session(page)
        self.x = self.y = 0

    def send(self, kind, points):
        self.session.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": points})
        self.page.wait_for_timeout(30)

    def down(self, x, y):
        self.x, self.y = x, y
        self.send("touchStart", [{"x": x, "y": y}])

    def move_to(self, x, steps=8):
        start = self.x
        for step in range(1, steps + 1):
            self.x = start + (x - start) * step / steps
            self.send("touchMove", [{"x": self.x, "y": self.y}])
        self.page.wait_for_timeout(80)

    def up(self):
        self.send("touchEnd", [])


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"))


def stored(page, key):
    return page.evaluate(f"() => JSON.parse(localStorage.getItem('{key}') || 'null')")


def jobs(page):
    return stored(page, "aske:downloads-v1") or []


def player(page):
    return stored(page, "aske:player-v2") or {}


def wait_for(page, condition, what, timeout_ms=15000):
    for _ in range(timeout_ms // 200):
        if condition():
            return
        page.wait_for_timeout(200)
    raise AssertionError(f"timed out waiting for {what}")


def wait_downloads(page, video_ids):
    def done():
        finished = {j["videoId"] for j in jobs(page) if j["status"] == "done"}
        return set(video_ids) <= finished

    wait_for(page, done, f"downloads {video_ids}")


def middle(locator):
    box = locator.bounding_box()
    return box["y"] + box["height"] / 2


def assert_no_text(page):
    splash = page.locator(".boot-splash")
    expect(splash).to_have_count(1)
    assert splash.inner_text().strip() == "", splash.inner_text()
    assert page.locator("body").inner_text().strip() == ""
    expect(page.locator("button")).to_have_count(0)
    expect(splash.locator("svg")).to_be_visible()


def check_boot(page, net):
    held_scripts = []
    holding = [True]

    def gate(route):
        if holding[0]:
            held_scripts.append(route)
        else:
            route.fallback()

    page.route("**/assets/*.js", gate)
    net.hold_health = True
    page.goto(BASE + "/", wait_until="commit")
    page.wait_for_selector(".boot-splash svg")
    page.wait_for_timeout(300)
    assert_no_text(page)
    shot(page, "01-boot-before-javascript")
    assert held_scripts, "the app script was not held back"
    holding[0] = False
    for route in held_scripts:
        route.fallback()
    page.wait_for_selector(".boot-splash[role=status]")
    assert_no_text(page)
    page.wait_for_selector('.boot-splash[data-phase="eq"]', timeout=3000)
    page.wait_for_timeout(900)
    assert_no_text(page)
    shot(page, "02-boot-equalizer")
    net.release_health()
    page.wait_for_selector(".welcome-card")
    expect(page.locator(".boot-splash")).to_have_count(0)
    print("ok boot: only the logo, equalizer when slow")


def set_up_phone_library(page):
    page.get_by_role("button", name="Saltar").click()
    page.locator(".setup-option").nth(0).locator("button.btn").click()
    page.wait_for_selector(".tabbar")
    open_tab(page, "Descargar")
    page.locator(".dl-intro .icon-btn").click()


def open_tab(page, name):
    page.locator(".tabbar .tab", has_text=name).click()


def search(page, text):
    page.fill(".dl-search input", text)
    page.press(".dl-search input", "Enter")
    page.wait_for_selector(".dl-result")


def load_more(page, before, added):
    results = page.locator(".dl-result")
    expect(results).to_have_count(before)
    more = page.locator(".dl-more")
    expect(more).to_have_text("Cargar más")
    expect(page.get_by_text("No hay más resultados.")).to_have_count(0)
    more.click()
    # The second page repeats the last result: only one new row may appear.
    expect(results).to_have_count(before + 1)
    expect(results.last).to_contain_text(added)
    expect(more).to_have_count(0)
    expect(page.get_by_text("No hay más resultados.")).to_be_visible()


def check_load_more(page):
    search(page, "itoiz")
    shot(page, "03-results")
    load_more(page, 3, "Result 4")
    page.get_by_text("No hay más resultados.").scroll_into_view_if_needed()
    shot(page, "04-no-more-results")
    for index in (0, 1, 3):
        page.locator(".dl-result").nth(index).locator("button").click()
    wait_downloads(page, ["song0000001", "song0000002", "song0000004"])
    page.locator(".dl-kinds button", has_text="Playlists").click()
    expect(page.locator(".dl-result", has_text="Big playlist")).to_be_visible()
    load_more(page, 2, "More playlist")
    print("ok load more: songs and playlists, then 'no more results'")


def check_fallback_art(page, net):
    net.pictures_work = False
    # A new page load, so that no picture comes from the browser's memory.
    page.reload()
    page.wait_for_selector(".dl-search")
    search(page, "offline pictures")
    expect(page.locator(".dl-result .gen-art")).to_have_count(3)
    expect(page.locator(".dl-result img")).to_have_count(0)
    shot(page, "05-results-without-pictures")
    net.pictures_work = True
    print("ok pictures: amber drawing when the thumbnail fails")


def check_library_pictures(page):
    open_tab(page, "Biblioteca")
    rows = page.locator(".track")
    expect(rows).to_have_count(3)
    for index in range(rows.count()):
        picture = rows.nth(index).locator(".track-main img, .track-main .gen-art")
        expect(picture).to_have_count(1)
    expect(page.locator(".track-main img").first).to_be_visible()
    shot(page, "06-library")
    print("ok library: every row has a picture")


def row_title(row):
    return row.locator(".track-title").inner_text()


def queue_ids(page):
    return player(page).get("queue") or []


def check_row_swipe(page, finger):
    rows = page.locator(".track")
    rows.nth(0).locator(".track-main").click()
    wait_for(page, lambda: player(page).get("currentId"), "playback")
    assert queue_ids(page) == []
    row = rows.nth(2)
    title = row_title(row)
    # Away from the tab bar and the mini player, which would catch the finger.
    row.evaluate("e => e.scrollIntoView({ block: 'center' })")
    page.wait_for_timeout(300)
    finger.down(80, middle(row))
    finger.move_to(125)
    ring = row.locator(".swipe-ring")
    expect(ring).to_be_visible()
    expect(row.locator(".swipe-ring.full")).to_have_count(0)
    shot(page, "07-row-swipe-growing")
    finger.move_to(230)
    expect(row.locator(".swipe-ring.full")).to_be_visible()
    shot(page, "08-row-swipe-full")
    finger.up()
    expect(ring).to_have_count(0)
    wait_for(page, lambda: len(queue_ids(page)) == 1, "the song in the queue")
    print("ok row swipe: ring grows, fills and queues the song")
    return title, queue_ids(page)[0]


def assert_no_swipe_words(locator):
    text = locator.inner_text()
    assert "Siguiente" not in text and "Anterior" not in text, text


def check_mini_swipe(page, finger, queued_title, queued_id):
    mini = page.locator(".mini-player")
    current = mini.locator(".swipe-current .track-title")
    before = current.inner_text()
    finger.down(250, middle(mini))
    finger.move_to(170)
    expect(mini.locator(".swipe-neighbour .track-title")).to_have_text(queued_title)
    assert_no_swipe_words(mini)
    shot(page, "09-mini-swipe")
    finger.move_to(60)
    finger.up()
    expect(current).to_have_text(queued_title)
    assert queued_title != before and player(page)["currentId"] == queued_id
    expect(mini.locator(".swipe-neighbour")).to_have_count(0)
    assert_no_swipe_words(mini)
    expect(page.locator(".now-playing")).to_have_count(0)
    shot(page, "10-mini-after-swipe")
    print("ok mini player: swipe left brings the next song, without words")


def check_big_player_swipe(page, finger):
    page.locator(".mini-player .open-area").click()
    area = page.locator(".np-swipe")
    expect(area).to_be_visible()
    page.wait_for_timeout(600)
    shot(page, "11-now-playing")
    before = player(page)["currentId"]
    finger.down(300, middle(area))
    finger.move_to(170)
    expect(area.locator(".swipe-neighbour .np-title")).to_be_visible()
    assert_no_swipe_words(area)
    shot(page, "12-now-playing-swipe")
    finger.move_to(40)
    finger.up()
    wait_for(page, lambda: player(page)["currentId"] != before, "the next song")
    page.get_by_role("button", name="Minimizar").click()
    expect(page.locator(".now-playing")).to_have_count(0)
    print("ok full screen player: swipe changes song")


def share(page, text):
    # The fake only delivers to a subscriber: the app must already be on screen.
    page.evaluate("(text) => window.__askeFakeShare(text)", text)


def check_share_video(page):
    url = f"https://youtu.be/{SHARED_ID}?si=x"
    share(page, f"Mira esto {url}")
    sheet = page.locator(".share-in")
    expect(sheet).to_contain_text(f"Shared song {SHARED_ID}")
    expect(sheet.locator("img.share-in-thumb")).to_be_visible()
    page.wait_for_timeout(500)
    shot(page, "13-share-video")
    sheet.get_by_role("button", name="Descargar").click()
    expect(sheet).to_have_count(0)
    queued = lambda: any(j["videoId"] == SHARED_ID for j in jobs(page))
    wait_for(page, queued, "the shared video in the queue")
    wait_downloads(page, [SHARED_ID])
    open_tab(page, "Descargar")
    page.locator("button", has_text="Terminadas").click()
    job = page.locator(".dl-job", has_text=SHARED_ID)
    expect(job).to_have_count(1)
    job.scroll_into_view_if_needed()
    shot(page, "14-share-in-queue")
    print("ok share: video sheet, download in the queue")


def check_share_invalid(page):
    count = len(jobs(page))
    share(page, "hola, esto no es un enlace")
    sheet = page.locator(".share-in")
    expect(sheet).to_contain_text("Esto no es un enlace de YouTube ni de YouTube Music.")
    expect(sheet.get_by_role("button", name="Descargar")).to_have_count(0)
    page.wait_for_timeout(500)
    shot(page, "15-share-invalid")
    sheet.get_by_role("button", name="Entendido").click()
    expect(sheet).to_have_count(0)
    assert len(jobs(page)) == count
    print("ok share: clear notice for other texts")


def check_share_cold_start(page, net):
    net.pictures_work = False
    link = quote("https://music.youtube.com/watch?v=cold0000001", safe="")
    page.goto(f"{BASE}/?share={link}")
    sheet = page.locator(".share-in")
    expect(sheet).to_contain_text("Shared song cold0000001")
    expect(sheet.locator(".gen-art")).to_be_visible()
    page.wait_for_timeout(500)
    shot(page, "16-share-cold-start-no-picture")
    sheet.get_by_role("button", name="Cancelar").click()
    expect(sheet).to_have_count(0)
    net.pictures_work = True
    print("ok share: link received while the app was closed")


def check_playlist_pictures(page):
    open_tab(page, "Descargar")
    page.locator(".dl-kinds button", has_text="Playlists").click()
    search(page, "playlists")
    page.locator(".dl-result", has_text="Test playlist").locator("button").click()
    page.wait_for_selector(".dl-entries")
    expect(page.locator(".dl-entries img, .dl-entries .gen-art")).to_have_count(3)
    page.wait_for_timeout(500)
    shot(page, "17-playlist-picker")
    page.locator(".dl-sheet .btn.primary").click()
    wait_downloads(page, [f"plvid{n:08d}" for n in (1, 2, 3)])
    open_tab(page, "Playlists")
    expect(page.locator(".card-row").first).to_be_visible()
    page.wait_for_timeout(600)
    shot(page, "18-playlists")
    print("ok playlists: pictures in the picker")


def run(browser):
    net = Network()
    context = browser.new_context(
        viewport=PHONE,
        device_scale_factor=2,
        has_touch=True,
        is_mobile=True,
        locale="es-ES",
        service_workers="block",
    )
    context.route("**/*", net.handle)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    finger = Finger(page)

    check_boot(page, net)
    set_up_phone_library(page)
    check_load_more(page)
    check_fallback_art(page, net)
    check_library_pictures(page)
    queued_title, queued_id = check_row_swipe(page, finger)
    check_mini_swipe(page, finger, queued_title, queued_id)
    check_big_player_swipe(page, finger)
    check_share_video(page)
    check_share_invalid(page)
    check_playlist_pictures(page)
    check_share_cold_start(page, net)

    context.close()
    assert not errors, errors


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=CHROME,
            headless=True,
            args=["--autoplay-policy=no-user-gesture-required"],
        )
        try:
            run(browser)
        finally:
            browser.close()
    print("ALL OK")


if __name__ == "__main__":
    main()
