/**
 * Loads the game at seven screen shapes and checks that it starts cleanly and
 * keeps the ball inside the play window — the band between the top instrument
 * HUD and the bottom control HUD. A ball drawn outside it is a ball the player
 * cannot see, which is the bug class this test exists to catch.
 *
 *   node test/smoke.mjs
 */
import {
  launchBrowser,
  openGame,
  check,
  report,
  inPlayWindow,
} from "./helpers.mjs";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1920, height: 1080 },
  { name: "narrow", width: 478, height: 909 },
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "phone-landscape", width: 844, height: 390, touch: true },
  /* iPhone 16 Pro Max in Safari landscape: the browser's own bars take about a
     quarter of the 440pt height, which is the shape that exposed the camera
     framing the table as a thin ribbon in the middle of the screen. */
  { name: "phone-landscape-safari", width: 956, height: 342, touch: true },
  { name: "phone-small", width: 360, height: 640, touch: true },
];

const results = [];
const browser = await launchBrowser();

for (const vp of VIEWPORTS) {
  console.log(`\n${vp.name} (${vp.width}x${vp.height})`);
  const { page, errors } = await openGame(browser, vp);

  await page.evaluate(() => {
    document.getElementById("startScreen").classList.add("hidden");
    window.__NSA__.start();
  });
  await page.waitForTimeout(1200);
  const serve = await page.evaluate(() => window.__NSA__.info());
  check(
    results,
    `${vp.name}: ball visible while plunging`,
    inPlayWindow(serve),
    JSON.stringify(serve.ballScreen),
  );

  await page.evaluate(() => window.__NSA__.launch(0.5));
  await page.waitForTimeout(3000);
  const play = await page.evaluate(() => window.__NSA__.info());
  check(
    results,
    `${vp.name}: ball visible in play`,
    inPlayWindow(play),
    JSON.stringify(play.ballScreen),
  );
  check(
    results,
    `${vp.name}: play window has usable height`,
    play.layout.h > 150,
    `h=${play.layout.h}`,
  );
  if (vp.touch) {
    /* The table is drawn further down the screen than the camera will ever
       frame the ball, so the machine extends under the floating pads while the
       shot you are taking stays above them. */
    check(
      results,
      `${vp.name}: table drawn at least as low as it is framed`,
      play.layout.clipH >= play.layout.h,
      `clip=${play.layout.clipH} frame=${play.layout.h}`,
    );
    /* An extreme aspect ratio must not leave the machine floating in the middle
       of the screen with black either side — that reads as "I can't see the
       game" long before anything is technically wrong. */
    const fill = Math.min(1, 1760 / play.layout.seenW);
    check(
      results,
      `${vp.name}: the table fills the screen rather than a slot in it`,
      fill >= 0.72,
      `${Math.round(fill * 100)}% of the width, ball ${play.layout.ballPx}px`,
    );
    /* The pads overlap the table on purpose — what must never happen is a pad
       overlapping the BALL. Play for a while and watch every frame for it. */
    const worst = await page.evaluate(async () => {
      const cv = document.getElementById("game").getBoundingClientRect();
      const pads = ["tLeft", "tRight", "tLaunch", "tNudgeL", "tNudgeR"].map(
        (id) => {
          const r = document.getElementById(id).getBoundingClientRect();
          return { id, l: r.left - cv.left, r: r.right - cv.left,
                   t: r.top - cv.top, b: r.bottom - cv.top };
        },
      );
      let hits = 0, frames = 0, sample = "";
      /* 60 simulated seconds of real play, stepped rather than waited so the
         whole sweep costs a fraction of a second */
      for (let i = 0; i < 3600; i++) {
        window.__NSA__.step(1);
        const info = window.__NSA__.info();
        if (info.state !== "PLAY" && info.state !== "BONUS") {
          if (info.state === "OVER") break;
          continue;
        }
        const p = info.ballScreen;
        if (!p) continue;
        frames++;
        const rad = info.layout.ballPx / 2 + 2;
        for (const q of pads) {
          if (p.x + rad > q.l && p.x - rad < q.r &&
              p.y + rad > q.t && p.y - rad < q.b) {
            hits++;
            if (!sample) sample = `${q.id} ball@${p.x},${p.y}`;
          }
        }
      }
      return { hits, frames, sample };
    });
    check(
      results,
      `${vp.name}: the ball never goes behind a touch pad`,
      worst.hits === 0,
      worst.sample || `${worst.frames} frames clear`,
    );
  }
  check(results, `${vp.name}: no errors`, errors.length === 0, errors[0] || "");
  await page.close();
}

// the game-over flow: initials, leaderboard, score card
console.log("\ngame-over flow");
{
  const { page, errors } = await openGame(browser, { width: 1280, height: 800 });
  await page.evaluate(() => {
    const N = window.__NSA__;
    N.start();
    N.launch(0.9);
    for (let i = 0; i < 400; i++) N.step(1);
    for (let k = 0; k < 12; k++) {
      N.drain();
      for (let i = 0; i < 400; i++) N.step(1);
      if (N.info().state === "OVER") break;
    }
  });
  await page.waitForTimeout(600);
  const reachedOver = await page.evaluate(() => window.__NSA__.state === "OVER");
  check(results, "game reaches game over", reachedOver);

  if (await page.isVisible("#initInput")) {
    await page.fill("#initInput", "ABC");
    await page.click("#initOk");
    await page.waitForTimeout(700);
  }
  const after = await page.evaluate(() => ({
    over: !document.getElementById("overScreen").classList.contains("hidden"),
    board: document.getElementById("lb").textContent.includes("ABC"),
    card: document.getElementById("shareImg").src.startsWith("data:image/png"),
  }));
  check(results, "game-over screen shows", after.over);
  check(results, "initials saved to the leaderboard", after.board);
  check(results, "score card rendered", after.card);
  check(results, "game-over flow: no errors", errors.length === 0, errors[0] || "");
  await page.close();
}

// two thumbs at once must work, and lifting one must not drop the other
console.log("\ntouch controls");
{
  const { page, errors } = await openGame(browser, {
    width: 390,
    height: 844,
    touch: true,
  });
  await page.evaluate(() => {
    document.getElementById("startScreen").classList.add("hidden");
    window.__NSA__.start();
    window.__NSA__.launch(0.4);
  });
  await page.waitForTimeout(1400);
  const t = await page.evaluate(() => {
    const cv = document.getElementById("game");
    const send = (type, id, x, y) =>
      cv.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          clientX: x,
          clientY: y,
          bubbles: true,
          pointerType: "touch",
        }),
      );
    const S = () => window.__NSA__.flipState();
    const o = {};
    send("pointerdown", 1, 60, 500);
    o.left = S();
    send("pointerdown", 2, 330, 500);
    o.both = S();
    send("pointerup", 1, 60, 500);
    o.rightStillHeld = S();
    send("pointerup", 2, 330, 500);
    o.released = S();
    send("pointerdown", 3, 60, 500);
    send("pointerdown", 4, 120, 600);
    send("pointerup", 3, 60, 500);
    o.secondFingerSameSide = S();
    send("pointerup", 4, 120, 600);
    o.done = S();
    return o;
  });
  check(results, "left thumb flips the left side", t.left.L > 0 && t.left.R === 0);
  check(results, "both thumbs flip both sides", t.both.L > 0 && t.both.R > 0);
  check(
    results,
    "lifting one thumb keeps the other flipper up",
    t.rightStillHeld.L === 0 && t.rightStillHeld.R > 0,
  );
  check(results, "lifting both releases both", t.released.L === 0 && t.released.R === 0);
  check(
    results,
    "a second finger on the same side holds the flipper",
    t.secondFingerSameSide.L > 0,
  );
  check(results, "all fingers up releases", t.done.L === 0 && t.done.R === 0);
  check(results, "touch: no errors", errors.length === 0, errors[0] || "");
  await page.close();
}

// a hole should take the ball when the ball is over the hole
console.log("\nholes and nudges");
{
  const { page, errors } = await openGame(browser, { width: 1280, height: 800 });
  const holes = await page.evaluate(() => {
    const N = window.__NSA__;
    N.start();
    for (let i = 0; i < 60; i++) N.step(1);
    const sc = N.scoopList().find((s) => s.name === "MYSTERY");
    const settle = () => { for (let i = 0; i < 130; i++) N.step(1); };
    /* sat well inside the drawn mouth, but nowhere near dead centre — this is
       the case that used to do nothing at all while looking like a clean shot */
    N.teleportBall(sc.x + sc.r * 0.85, sc.y, 0, 0);
    N.step(1);
    const offCentre = !!(N.info().b[0] && N.info().b[0].scoop);
    settle();
    /* and crossing the mouth fast enough to cover it inside one frame */
    const swept = {};
    for (const v of [1200, 2600, 4200]) {
      N.teleportBall(sc.x - v / 50, sc.y, v, 0);
      let got = false;
      for (let i = 0; i < 6; i++) { N.step(1); if (N.info().b[0] && N.info().b[0].scoop) { got = true; break; } }
      swept[v] = got;
      settle();
    }
    return { r: sc.r, offCentre, swept };
  });
  check(results, "a ball inside the mouth of a hole drops in", holes.offCentre,
    `${Math.round(holes.r * 0.85)}px off centre on a ${holes.r}px hole`);
  check(results, "a fast ball cannot skip across the mouth",
    [1200, 2600, 4200].every((v) => holes.swept[v]),
    JSON.stringify(holes.swept));

  /* a nudge has to be worth the tilt risk: the drain gap is 150px, so shifting
     the ball less than a ball-width is not a save, it is a decoration */
  const nudge = await page.evaluate(() => {
    const N = window.__NSA__;
    N.teleportBall(830, 2500, 60, 300);
    for (let i = 0; i < 6; i++) N.step(1);
    const a = N.info().b[0];
    const x0 = a.x, vx0 = a.vx;
    N.nudge(1);
    for (let i = 0; i < 18; i++) N.step(1);
    const b = N.info().b[0];
    return { dx: Math.round(b.x - x0 - vx0 * 0.3), tilted: N.info().state !== "PLAY" };
  });
  check(results, "one nudge moves the ball further than the drain is wide",
    nudge.dx > 150, `${nudge.dx}px sideways in 0.3s`);
  check(results, "one nudge does not tilt the table", !nudge.tilted);
  check(results, "holes and nudges: no errors", errors.length === 0, errors[0] || "");
  await page.close();
}

// the page getting pinch-zoomed out from under the game, and getting back
console.log("\nzoom recovery");
{
  const { page, errors } = await openGame(browser, {
    width: 390,
    height: 844,
    touch: true,
  });
  await page.evaluate(() => {
    document.getElementById("startScreen").classList.add("hidden");
    window.__NSA__.start();
    window.__NSA__.launch(0.5);
  });
  await page.waitForTimeout(900);
  check(
    results,
    "no zoom banner at scale 1",
    await page.evaluate(() =>
      document.getElementById("zoomFix").classList.contains("hidden"),
    ),
  );
  /* stand in for a pinch: visualViewport is the only thing that reports it */
  const zoomed = await page.evaluate(async () => {
    const vv = window.visualViewport;
    const fake = { scale: 1.62, offsetLeft: 120, offsetTop: 210, width: 241, height: 521 };
    for (const k of Object.keys(fake))
      Object.defineProperty(vv, k, { get: () => fake[k], configurable: true });
    vv.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 150));
    const el = document.getElementById("zoomFix");
    return {
      shown: !el.classList.contains("hidden"),
      box: [el.style.left, el.style.top, el.style.width, el.style.height].join(),
      score: window.__NSA__.info().score,
    };
  });
  check(results, "a zoomed page raises the banner", zoomed.shown);
  check(
    results,
    "the banner lands on the part of the page you can still see",
    zoomed.box === "120px,210px,241px,521px",
    zoomed.box,
  );
  await page.evaluate(() => window.__NSA__.step(200));
  await page.waitForTimeout(400);
  const frozen = await page.evaluate(() => window.__NSA__.info().score);
  check(
    results,
    "the ball does not drain while you cannot see it",
    frozen === zoomed.score,
    `${zoomed.score} -> ${frozen}`,
  );
  const back = await page.evaluate(async () => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, "scale", { get: () => 1, configurable: true });
    vv.dispatchEvent(new Event("resize"));
    await new Promise((r) => setTimeout(r, 150));
    return document.getElementById("zoomFix").classList.contains("hidden");
  });
  check(results, "banner clears when the zoom does", back);
  await page.evaluate(() => window.__NSA__.step(200));
  await page.waitForTimeout(400);
  check(
    results,
    "play resumes by itself",
    (await page.evaluate(() => window.__NSA__.info().score)) !== frozen,
  );
  check(results, "zoom recovery: no errors", errors.length === 0, errors[0] || "");
  await page.close();
}

await browser.close();
report(results, "smoke");
