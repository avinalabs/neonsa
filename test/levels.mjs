/**
 * The three warp machines behind the three holes.
 *
 * Each one is a whole playfield with its own gravity, and each one was built
 * from scratch, so each one gets the same treatment the tower gets: play it
 * unattended for a long time, watch for balls wedged in the geometry, and
 * check that the warp in and the warp back both leave the game in a sane
 * state. A room you cannot get out of is worse than a room you never enter.
 *
 *   node test/levels.mjs [visits-per-level] [seconds-per-visit]
 */
import { launchBrowser, openGame, check, report } from "./helpers.mjs";

const VISITS = Number(process.argv[2] || 3);
const SECONDS = Number(process.argv[3] || 120);
const BOX = 60;
const HOLD_FRAMES = 60 * 7;
const LEVELS = ["spiral", "forge", "deep"];

const results = [];
const browser = await launchBrowser();

for (const id of LEVELS) {
  console.log(`\n${id}`);
  const { page, errors } = await openGame(browser, { width: 1280, height: 800 });
  const out = await page.evaluate(
    async ({ id, visits, seconds, box, holdFrames }) => {
      const N = window.__NSA__;
      N.start();
      N.launch(0.6);
      for (let i = 0; i < 120; i++) N.step(1);
      const stalls = [], escapes = [], lives = [];
      let built = null, scored = 0, everDone = false;
      for (let v = 0; v < visits; v++) {
        /* Let the previous ball finish resolving first. Warping out of an
           end-of-ball bonus put a tower plunger ball inside the room's
           world and every measurement after it was nonsense. */
        for (let i = 0; i < 60 * 20 && N.info().state !== "PLAY"; i++) N.step(1);
        if (N.info().state !== "PLAY" && !N.revive()) break;
        N.warp(id);
        for (let i = 0; i < 90; i++) N.step(1);      // through the transition
        const info = N.levelInfo();
        if (!info) return { fatal: "warp did not land in " + id };
        built = info;
        let flip = 0, bx = 0, by = 0, hold = 0, frames = 0;
        for (let i = 0; i < 60 * seconds; i++) {
          if (i % 11 === 0) { flip ^= 1; N.flip(0, !!flip); N.flip(1, !flip); }
          N.step(1);
          const li = N.levelInfo();
          if (!li) break;                            // spat back out
          frames++;
          scored = Math.max(scored, li.prog);
          if (li.done) everDone = true;
          const b = N.info().b[0];
          if (b && !b.scoop) {
            /* outside the room entirely is a hole in the walls, not a stall */
            if (b.x < -140 || b.x > li.pw + 140 || b.y < -220)
              escapes.push(`${Math.round(b.x)},${Math.round(b.y)}`);
            if (Math.abs(b.x - bx) < box && Math.abs(b.y - by) < box) hold++;
            else { hold = 0; bx = b.x; by = b.y; }
            if (hold > holdFrames) { stalls.push(`${Math.round(b.x)},${Math.round(b.y)}`); hold = 0; }
          } else hold = 0;
        }
        lives.push(Math.round(frames / 60));
        N.flip(0, false); N.flip(1, false);
        if (N.levelInfo()) N.warpBack();
        for (let i = 0; i < 90; i++) N.step(1);
        if (N.levelInfo()) return { fatal: "could not leave " + id };
      }
      return { built, stalls, escapes, lives, scored, everDone,
               state: N.info().state, balls: N.info().balls };
    },
    { id, visits: VISITS, seconds: SECONDS, box: BOX, holdFrames: HOLD_FRAMES },
  );

  if (out.fatal) {
    check(results, `${id}: ${out.fatal}`, false);
    await page.close();
    continue;
  }
  console.log(
    `  ${out.built.name}  ${out.built.pw}x${out.built.ph}  ` +
    `${out.built.walls} walls, ${out.built.bumpers} bumpers  ` +
    `| visits lasted ${out.lives.join("s, ")}s  | best ${out.scored}/${out.built.goal}`,
  );
  check(results, `${id}: the room actually builds`, out.built.walls > 8 && out.built.flippers === 2,
    `${out.built.walls} walls, ${out.built.flippers} flippers`);
  check(results, `${id}: no balls wedged in the geometry`, out.stalls.length === 0,
    out.stalls.slice(0, 3).join(" "));
  check(results, `${id}: no balls escape the room`, out.escapes.length === 0,
    out.escapes.slice(0, 3).join(" "));
  check(results, `${id}: the ball survives long enough to play`,
    out.lives.some((s) => s >= 4), `visits lasted ${out.lives.join(",")}s`);
  check(results, `${id}: you always get back out`, out.state === "PLAY" || out.state === "BONUS",
    out.state);
  check(results, `${id}: no page errors`, errors.length === 0, errors[0] || "");

  /* the animated backgrounds are the expensive part of these rooms; the tower
     runs about 17ms p50 on this software canvas, so 34 is the line */
  await page.evaluate((i) => { window.__NSA__.warp(i); window.__NSA__.step(70); }, id);
  await page.waitForTimeout(400);
  const ft = await page.evaluate(() => new Promise((res) => {
    const t = []; let last = performance.now(), n = 0;
    const f = () => {
      const now = performance.now(); t.push(now - last); last = now;
      if (++n < 140) requestAnimationFrame(f);
      else { t.sort((a, b) => a - b); res({ p50: +t[70].toFixed(1), p99: +t[138].toFixed(1) }); }
    };
    requestAnimationFrame(f);
  }));
  check(results, `${id}: the room renders inside the frame budget`, ft.p50 < 34,
    `p50 ${ft.p50}ms  p99 ${ft.p99}ms`);
  await page.close();
}

await browser.close();
report(results, "levels");
