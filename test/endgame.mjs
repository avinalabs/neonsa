/**
 * A game has to be losable.
 *
 * This suite exists because it wasn't. Extra balls came from three
 * uncapped sources at once (score thresholds, the mystery award, the storm
 * meter) and a warp visit handed back a fresh ball on the way out, so a
 * competent player's ball count climbed instead of falling and the game
 * never ended. The soak had been quietly reporting "0 games played to the
 * end" for weeks — nothing asserted on it, so nobody read it.
 *
 * Every check here is about the end of a game, not the middle of one.
 */
import { launchBrowser, openGame, check, report } from "./helpers.mjs";

const results = [];
const browser = await launchBrowser();
const { page, errors } = await openGame(browser, { width: 900, height: 1500 });

/* Plays a whole game at 60x and reports how it ended. `style` picks the
   input: "idle" never touches a flipper, "flail" alternates them, "hold"
   cradles both — three very different ways to keep a ball alive. */
async function playOut(style, maxSeconds) {
  return page.evaluate(
    ({ style, maxSeconds }) => {
      const N = window.__NSA__;
      /* start() from inside a warp room used to build a fresh game on the
         room's one-deck world and crash on the first launch. */
      if (N.warping() || N.levelInfo()) N.warpBack(true);
      N.start();
      let flip = 0;
      const frames = maxSeconds * 60;
      let i = 0;
      for (; i < frames; i++) {
        const s = N.info();
        if (s.state === "OVER") break;
        if (s.inLane && i % 40 === 0) N.launch(0.35 + Math.random() * 0.6);
        if (style === "flail" && i % 11 === 0) {
          flip ^= 1;
          N.flip(0, !!flip);
          N.flip(1, !flip);
        }
        if (style === "hold" && i === 0) {
          N.flip(0, true);
          N.flip(1, true);
        }
        N.step(1);
      }
      N.flip(0, false);
      N.flip(1, false);
      const s = N.info();
      return {
        over: s.state === "OVER",
        seconds: Math.round(i / 60),
        ballNum: s.ballNum,
        ballsPlayed: s.ballsPlayed,
        score: s.score,
        extras: N.extras(),
      };
    },
    { style, maxSeconds },
  );
}

console.log("\nendgame — can the game be lost?\n");

const CAP = 1200; // twenty minutes of game clock per run
for (const style of ["idle", "flail", "hold"]) {
  const r = await playOut(style, CAP);
  check(
    results,
    `${style}: game reaches GAME OVER`,
    r.over,
    r.over
      ? `after ${r.seconds}s, ${r.ballsPlayed} balls, ${r.score.toLocaleString()} pts`
      : `still playing after ${r.seconds}s on ball ${r.ballNum} with ${r.extras.held} banked`,
  );
  check(
    results,
    `${style}: extras stay inside the per-game cap`,
    r.extras.earned <= r.extras.maxGame,
    `earned ${r.extras.earned} / ${r.extras.maxGame}`,
  );
  check(
    results,
    `${style}: never holds more extras than the bank allows`,
    r.extras.held <= r.extras.maxHeld,
    `held ${r.extras.held} / ${r.extras.maxHeld}`,
  );
  /* BALLS_PER_GAME + the per-game extra cap, plus a little slack for ball
     saves, is the hard ceiling on how many balls one game can serve. */
  check(
    results,
    `${style}: total balls served is bounded`,
    r.ballsPlayed <= 3 + r.extras.maxGame + 24,
    `${r.ballsPlayed} served`,
  );
}

/* A tilt has to end with the ball that earned it. It used to clear only in
   endOfBallFinish, which a ball save skips, so tilt + save was a loop of
   dead flippers and instant drains that looked permanent to the player. */
const tilt = await page.evaluate(() => {
  const N = window.__NSA__;
  if (N.warping() || N.levelInfo()) N.warpBack(true);
  N.start();
  N.launch(0.8);
  for (let i = 0; i < 240; i++) N.step(1);
  for (let i = 0; i < 8; i++) {
    N.nudge(1, 0);
    N.step(1);
  }
  const tiltedNow = N.info().tilted;
  const startBall = N.info().ballsPlayed;
  /* let it drain and be re-served, however that happens */
  let served = startBall;
  for (let i = 0; i < 60 * 120 && served === startBall; i++) {
    N.step(1);
    served = N.info().ballsPlayed;
  }
  return { tiltedNow, tiltedAfter: N.info().tilted, served: served > startBall };
});
check(results, "nudging hard enough tilts the table", tilt.tiltedNow);
check(results, "a new ball is served after a tilt", tilt.served);
check(
  results,
  "tilt clears with the ball that earned it",
  tilt.served && !tilt.tiltedAfter,
);

/* NEW GAME is reachable from inside a warp room. */
const fromRoom = await page.evaluate(() => {
  const N = window.__NSA__;
  N.start();
  N.launch(0.8);
  N.warp("spiral");
  for (let i = 0; i < 200; i++) N.step(1);
  const inRoom = !!N.levelInfo();
  N.start(); // the crash case: DECKS is one entry long in here
  for (let i = 0; i < 200; i++) N.step(1);
  const s = N.info();
  return { inRoom, level: !!N.levelInfo(), state: s.state, ballNum: s.ballNum };
});
check(results, "warped into a room for the restart test", fromRoom.inRoom);
check(
  results,
  "NEW GAME from inside a warp room returns to the tower",
  !fromRoom.level && fromRoom.state === "PLAY" && fromRoom.ballNum === 1,
  JSON.stringify(fromRoom),
);

check(results, "no page or console errors", errors.length === 0, errors.join(" | "));

await browser.close();
report(results, "endgame");
