/**
 * Plays the table unattended and looks for balls that get stuck.
 *
 * The harness drives update() directly rather than waiting on real frames, so
 * a few hundred seconds of play run in a few seconds of wall clock. A stall is
 * defined by MOTION, not by score: a ball that stays inside a 60px box for 7
 * seconds is wedged in the geometry. (Scoreless is not the same as stuck — a
 * cradled ball scores nothing and is perfectly fine.) Balls held in a scoop
 * are excluded, since sitting still is what a scoop is for.
 *
 *   node test/soak.mjs [runs] [seconds-per-run]
 */
import { launchBrowser, openGame, check, report } from "./helpers.mjs";

const RUNS = Number(process.argv[2] || 6);
const SECONDS = Number(process.argv[3] || 300);
const BOX = 60;
const HOLD_FRAMES = 60 * 7;

const results = [];
const browser = await launchBrowser();
const stalls = [];
let finished = 0;
let totalServes = 0;
let rescued = 0;
let nanned = 0;

for (let run = 0; run < RUNS; run++) {
  const { page, errors } = await openGame(browser, { width: 1280, height: 800 });
  const out = await page.evaluate(
    ({ seconds, box, holdFrames }) => {
      const N = window.__NSA__;
      N.start();
      const found = [];
      let flip = 0,
        bx = 0,
        by = 0,
        hold = 0,
        over = false;
      for (let i = 0; i < 60 * seconds; i++) {
        const info = N.info();
        if (info.inLane && i % 35 === 0) N.launch(Math.random());
        if (i % 12 === 0) {
          flip ^= 1;
          N.flip(0, !!flip);
          N.flip(1, !flip);
        }
        N.step(1);
        const s = N.info();
        const b = s.b[0];
        /* Balls in a scoop used to be excluded outright, which hid the worst
           kind of trap there is: a ball that is captured, released without
           being kicked out, falls a few pixels, and is captured again forever.
           From the player's side that is a dead game, and the detector reset
           its own timer on every capture. A scoop hold is under a second, so
           the ball is tracked through it — only the cannon, which holds
           indefinitely by design, is exempt. */
        const parked = b && b.scoop === "CANNON";
        if (b && !b.inLane && !parked) {
          if (Math.abs(b.x - bx) < box && Math.abs(b.y - by) < box) hold++;
          else {
            hold = 0;
            bx = b.x;
            by = b.y;
          }
          if (hold > holdFrames) {
            found.push(`${Math.round(b.x)},${Math.round(b.y)}${b.scoop ? " cycling " + b.scoop : ""}`);
            hold = 0;
          }
        } else hold = 0;
        if (s.state === "OVER") {
          over = true;
          break;
        }
      }
      return { found, over, serves: N.drains(), score: N.info().score,
               rescues: N.rescueCount(), nan: N.nanCount() };
    },
    { seconds: SECONDS, box: BOX, holdFrames: HOLD_FRAMES },
  );
  stalls.push(...out.found);
  rescued += out.rescues;
  nanned += out.nan;
  if (out.over) finished++;
  totalServes += out.serves;
  console.log(
    `  run ${run + 1}/${RUNS}: ${out.found.length} stalls, ${out.serves} serves, score ${out.score.toLocaleString()}${out.over ? ", game finished" : ""}`,
  );
  check(results, `run ${run + 1}: no page errors`, errors.length === 0, errors[0] || "");
  await page.close();
}

await browser.close();

console.log(
  `\n${RUNS} x ${SECONDS}s simulated, ${totalServes} balls served, ${finished} games played to the end`,
);
check(
  results,
  "no balls wedged in the geometry",
  stalls.length === 0,
  stalls.length ? `at ${[...new Set(stalls)].slice(0, 6).join("  ")}` : "",
);
/* The last-resort return exists because no amount of geometry testing proves a
   table has no bad corners left. It is allowed to fire — that is the whole
   point of it — but it should be a rarity, not a mechanic. Roughly once per
   thousand simulated seconds is the line: below that it is catching genuine
   oddities, above it something reachable is holding the ball and wants
   finding. */
const budget = Math.max(1, Math.round((RUNS * SECONDS) / 1000));
check(results, "the last-resort ball return stays rare",
  rescued <= budget, `${rescued} returns in ${RUNS * SECONDS}s (budget ${budget})`);
check(results, "no ball ever stops being a number", nanned === 0, `${nanned} recoveries`);
check(results, "balls actually drain", totalServes > RUNS, `${totalServes} serves`);
report(results, "soak");
