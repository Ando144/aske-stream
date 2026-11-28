"""v0.9.7 opening animation on a phone-sized screen (see README.md; fake native build).

Normal load and slow JavaScript, with a video and screenshots of each. A probe
inside the page records every frame, so the checks do not depend on how long a
screenshot takes. Reuses the helpers of v9_095.py: nothing leaves the machine.
"""

import os

from playwright.sync_api import expect, sync_playwright

from v9_095 import BASE, CHROME, HERE, PHONE, Network

OUT = os.path.join(HERE, "shots", "shots97")
NORMAL_SHOTS_MS = [100, 450, 800, 1100, 1350, 1600]
SLOW_SHOTS_MS = [1800, 2600]
SCRIPT_DELAY_MS = 3000
INTRO_MS = 1400
# The logo grows during the first 1200 ms: its box is only comparable after that.
LOGO_STILL_MS = 1250
TOLERANCE = 0.01
PROBE = """(() => {
  window.__frames = [];
  window.__phases = [];
  const elapsed = () => performance.now() - window.__t0;
  const read = (splash) => {
    const logo = splash.querySelector('svg');
    const box = logo.getBoundingClientRect();
    return {
      t: elapsed(),
      phase: splash.dataset.phase,
      scales: [...splash.querySelectorAll('.eq')].map((bar) =>
        Number(getComputedStyle(bar).getPropertyValue('--s'))),
      box: [box.x, box.y, box.width, box.height],
      text: splash.textContent.trim(),
      script: window.__askeScriptRan === true,
    };
  };
  const sample = () => {
    const splash = document.getElementById('boot-splash');
    const logo = splash && splash.querySelector('svg');
    if (logo) {
      const intro = logo.getAnimations()[0];
      if (window.__t0 === undefined && intro && intro.startTime !== null) {
        window.__t0 = intro.startTime;
      }
      if (window.__t0 !== undefined) window.__frames.push(read(splash));
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target.id === 'boot-splash') {
        window.__askeScriptRan = true;
        window.__phases.push(read(record.target));
      }
      for (const node of record.removedNodes) {
        if (node.id === 'boot-splash') window.__removedAt = elapsed();
      }
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-phase', 'aria-label'],
  });
})()"""


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"))


def wait_until(page, ms):
    page.wait_for_function(
        "(ms) => window.__t0 !== undefined && performance.now() - window.__t0 >= ms", arg=ms
    )


def capture(page, prefix, ms):
    wait_until(page, ms)
    taken_at = page.evaluate("() => performance.now() - window.__t0")
    shot(page, f"{prefix}-{ms:04d}ms")
    print(f"   capture {ms} ms (taken at {taken_at:.0f} ms)")


def results(page):
    expect(page.locator(".boot-splash")).to_have_count(0)
    return page.evaluate(
        "() => ({ frames: window.__frames, phases: window.__phases, gone: window.__removedAt })"
    )


def phase_names(seen):
    return [entry["phase"] for entry in seen["phases"]]


def at_rest(entry):
    return len(entry["scales"]) == 4 and all(abs(s - 1) <= TOLERANCE for s in entry["scales"])


def assert_common(seen):
    """(d) The screen stays for the whole intro and never shows any text."""
    assert seen["gone"] >= INTRO_MS, f"splash gone after only {seen['gone']:.0f} ms"
    everything = seen["frames"] + seen["phases"]
    assert not [e for e in everything if e["text"]], "the splash shows text"
    # "gone" is reported once the node is detached, when there is no style left to read.
    leaving = [e for e in everything if e["phase"] == "leaving"]
    assert leaving, "the fade was never seen"
    moved = [e for e in leaving if not at_rest(e)]
    assert not moved, f"bars not at rest during the fade: {moved[:3]}"


def check_normal(page):
    page.goto(BASE + "/", wait_until="commit")
    for ms in NORMAL_SHOTS_MS:
        capture(page, "a-normal", ms)
    page.wait_for_selector(".welcome-card")
    seen = results(page)
    names = phase_names(seen)
    assert "eq" not in names and "settling" not in names, names
    assert "leaving" in names, names
    moved = [f for f in seen["frames"] if not at_rest(f)]
    assert not moved, f"bars moved in a quick load: {moved[:3]}"
    assert_common(seen)
    print(f"ok normal load: no equalizer, {len(seen['frames'])} frames at rest, "
          f"gone at {seen['gone']:.0f} ms")


def check_same_box(seen, before):
    """(c) The logo does not jump when the JavaScript takes over."""
    still = [
        f for f in seen["frames"]
        if f["t"] >= LOGO_STILL_MS and f["phase"] in ("intro", "eq", "settling")
    ]
    assert any(f["script"] for f in still), "no frame seen after the script loaded"
    for frame in still:
        offsets = [abs(a - b) for a, b in zip(frame["box"], before)]
        assert max(offsets) <= 0.5, f"the logo jumped: {before} -> {frame}"


def check_settling(seen):
    settling = [f for f in seen["frames"] if f["phase"] == "settling"]
    steps = {tuple(round(s, 2) for s in f["scales"]) for f in settling}
    assert len(steps) >= 5, f"the bars did not ease back: {sorted(steps)}"


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

    return held, release


def check_slow_script(page):
    held, release = hold_scripts(page)
    page.goto(BASE + "/", wait_until="commit")
    for ms in SLOW_SHOTS_MS:
        capture(page, "b-slow", ms)
        scales = page.evaluate("() => window.__frames.at(-1).scales")
        assert any(abs(s - 1) > TOLERANCE for s in scales), f"equalizer still at {ms} ms: {scales}"
    assert held, "the app script was not held back"
    assert not page.evaluate("() => window.__askeScriptRan === true")
    before = page.evaluate("() => window.__frames.at(-1).box")
    wait_until(page, SCRIPT_DELAY_MS)
    release()
    page.wait_for_selector(".welcome-card")
    seen = results(page)
    names = phase_names(seen)
    assert "settling" in names and "leaving" in names, names
    assert names.index("settling") < names.index("leaving"), names
    check_same_box(seen, before)
    check_settling(seen)
    assert_common(seen)
    print(f"ok slow script: equalizer, smooth return, same logo box, gone at {seen['gone']:.0f} ms")


def record(browser, name, check):
    context = browser.new_context(
        viewport=PHONE,
        device_scale_factor=2,
        has_touch=True,
        is_mobile=True,
        locale="es-ES",
        service_workers="block",
        record_video_dir=OUT,
        record_video_size=PHONE,
    )
    context.route("**/*", Network().handle)
    context.add_init_script(PROBE)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    video = page.video
    try:
        check(page)
    finally:
        context.close()
        video.save_as(os.path.join(OUT, f"{name}.webm"))
        video.delete()
    assert not errors, errors


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
        try:
            record(browser, "a-normal", check_normal)
            record(browser, "b-slow", check_slow_script)
        finally:
            browser.close()
    print("ALL OK")


if __name__ == "__main__":
    main()
