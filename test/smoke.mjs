/**
 * Loads the game at six screen shapes and checks that it starts cleanly and
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

await browser.close();
report(results, "smoke");
