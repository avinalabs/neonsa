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
const progress = [];
const rescueSpots = [];
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
               rescues: N.rescueCount(), nan: N.nanCount(),
               ballNum: N.info().ballNum, extras: N.extras(),
               rescueLog: N.rescueLog(), searches: N.searchInfo().n };
    },
    { seconds: SECONDS, box: BOX, holdFrames: HOLD_FRAMES },
  );
  stalls.push(...out.found);
  rescued += out.rescues;
  rescueSpots.push(...out.rescueLog.map((r) => `${r.kind}@${r.x},${r.y} (${r.level})`));
  nanned += out.nan;
  if (out.over) finished++;
  totalServes += out.serves;
  progress.push(out);
  console.log(
    `  run ${run + 1}/${RUNS}: ${out.found.length} stalls, ${out.serves} serves, ${out.searches} searches, score ${out.score.toLocaleString()}${out.over ? ", game finished" : ""}`,
  );
  check(results, `run ${run + 1}: no page errors`, errors.length === 0, errors[0] || "");
  await page.close();
}

await browser.close();

console.log(
  `\n${RUNS} x ${SECONDS}s simulated, ${totalServes} balls served, ${finished} games played to the end`,
);
/* "0 games played to the end" printed here for weeks and nobody read it,
   because nothing asserted on it: extra balls arrived faster than they were
   spent and the game could not be lost. Whether a game ends inside a soak run
   depends on how long the run is, so the end-of-game proof lives in
   test/endgame.mjs. What this suite can assert cheaply is that balls are
   actually being consumed, and that the extra-ball caps hold under an hour of
   flailing — the two things whose absence made the game unlosable. */
/* The tight bound: a game can serve BALLS_PER_GAME + the per-game extra cap
   balls, each of which can be saved twice. Anything past that means a source
   of free balls has escaped its cap again, which is exactly how the game
   became unlosable. */
check(
  results,
  "no run serves more balls than one game is allowed",
  progress.every((r) => r.over || r.serves <= (3 + r.extras.maxGame) * 3),
  progress.map((r) => `${r.serves}/${(3 + r.extras.maxGame) * 3}`).join(", "),
);
check(
  results,
  "balls are actually being lost, not just banked",
  progress.some((r) => r.over || r.ballNum > 1),
  progress.map((r) => (r.over ? "end" : "ball " + r.ballNum)).join(", "),
);
check(
  results,
  "extra balls stay inside their caps",
  progress.every((r) => r.extras.earned <= r.extras.maxGame &&
                        r.extras.held <= r.extras.maxHeld),
  progress.map((r) => `${r.extras.earned}/${r.extras.maxGame}`).join(", "),
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
  rescued <= budget,
  `${rescued} returns in ${RUNS * SECONDS}s (budget ${budget})` +
    (rescueSpots.length ? ` — ${[...new Set(rescueSpots)].slice(0, 8).join("  ")}` : ""));
/* Two spots agreeing is a pocket in the table; scattered ones are just slow
   balls in empty corners, which the net exists to catch. */
{
  const tally = {};
  for (const spot of rescueSpots) {
    const [kind, pos] = spot.split("@");
    const [x, y] = pos.split(" ")[0].split(",").map(Number);
    const key = `${kind}:${Math.round(x / 220)},${Math.round(y / 220)}`;
    tally[key] = (tally[key] || 0) + 1;
  }
  const repeat = Object.entries(tally).filter(([, n]) => n >= 3);
  check(results, "no single spot keeps needing the last resort",
    repeat.length === 0,
    repeat.map(([k, n]) => `${k} x${n}`).join("  "));
}
check(results, "no ball ever stops being a number", nanned === 0, `${nanned} recoveries`);
check(results, "balls actually drain", totalServes > RUNS, `${totalServes} serves`);
/* The ball search is for stalemates, not for play. Firing it often would mean
   24 seconds keep passing with nothing scored while a ball is live, which is
   not a game anyone is enjoying. */
check(results, "the ball search stays out of the way",
  progress.every((r) => r.searches <= Math.ceil(SECONDS / 90)),
  progress.map((r) => r.searches).join(", ") + ` (max ${Math.ceil(SECONDS / 90)} per run)`);
report(results, "soak");
