/**
 * Touch everything, everywhere, and check two different things.
 *
 * RESPONDS — fire the ball at each interactive element and confirm it actually
 * does something. Every "I touched it and nothing happened" report in this
 * project has been a real bug: a hole whose capture radius was half the hole,
 * a ramp that refused in silence, a drop-target bank built with the wrong
 * shape and therefore inert. A test that only checks the ball keeps moving
 * would have passed on every one of them.
 *
 * TRAPS — put the ball at each element, and then on a grid over the entire
 * playfield, fire it in every direction at several speeds, and see whether it
 * is still sitting in the same place seconds later. The grid matters: the
 * worst trap found so far was a stretch of bare wall with nothing interactive
 * near it, which no amount of poking at features would have found.
 *
 * Both run on the tower and inside all three warp rooms.
 *
 *   node test/interactions.mjs [--quick]
 */
import { launchBrowser, openGame, check, report } from "./helpers.mjs";

const QUICK = process.argv.includes("--quick");
const DIRS = QUICK ? 6 : 12;
const SPEEDS = QUICK ? [900, 2200] : [500, 1400, 2600];
const GRID = QUICK ? 260 : 150;
const SECONDS = 8;
const TRAP_BOX = 70;

const results = [];
const browser = await launchBrowser();

/* ---------- does each element respond at all? ---------- */
const RESPONDS = async (page) =>
  page.evaluate(() => {
    const N = window.__NSA__;
    const out = {};
    const note = (kind, ok) => {
      out[kind] = out[kind] || { hit: 0, of: 0 };
      out[kind].of++;
      if (ok) out[kind].hit++;
    };
    for (const h of N.hotspots()) {
      if (h.kind === "flipper" || h.kind === "kickback" || h.kind === "magnet") continue;
      let ok = false;
      /* aim along the ramp for rails, otherwise straight at the thing */
      const d = (h.kind === "rail" && N.railDir(h.name)) || { x: 0, y: 1 };
      const spd = h.kind === "rail" ? 1400 : 900;
      for (const sign of [1, -1]) {
        if (ok) break;
        if (!N.teleportBall(h.x - d.x * sign * 70, h.y - d.y * sign * 70,
                            d.x * sign * spd, d.y * sign * spd)) break;
        const s0 = N.info().score;
        for (let i = 0; i < 40; i++) {
          N.step(1);
          const b = N.info().b[0];
          if (!b) break;
          if (N.info().score !== s0) { ok = true; break; }
          if (b.scoop || b.rail) { ok = true; break; }
        }
      }
      note(h.kind, ok);
      if (N.info().state !== "PLAY" && !N.revive()) { out.lost = true; return out; }
    }
    return out;
  });

/* ---------- does anything hold the ball? ---------- */
const TRAPS = async (page, mode) =>
  page.evaluate(
    async ({ dirs, speeds, seconds, trapBox, grid, mode }) => {
      const N = window.__NSA__;
      let points;
      if (mode === "spots") points = N.hotspots();
      else {
        points = [];
        const L = N.levelInfo();
        const w = L ? L.pw : 1760, h = L ? L.ph : 2900;
        for (let x = grid; x < w; x += grid)
          for (let y = grid; y < h; y += grid) points.push({ kind: "grid", name: `${x},${y}`, x, y });
      }
      const traps = [];
      let probes = 0;
      for (const h of points) {
        for (let d = 0; d < dirs; d++) {
          const a = (d / dirs) * Math.PI * 2;
          for (const sp of speeds) {
            if (!N.teleportBall(h.x, h.y, Math.cos(a) * sp, Math.sin(a) * sp)) continue;
            probes++;
            let gone = false;
            for (let i = 0; i < 60 * seconds; i++) {
              N.step(1);
              const s = N.info();
              /* A probe dropped near the drain gets served back into the
                 shooter lane, and a ball waiting for the plunger sits
                 perfectly still — which is not a trap, it is a player who
                 has not shot yet. Shoot it. */
              if (s.inLane) { N.launch(0.7); continue; }
              const b = s.b[0];
              if (!b) { gone = true; break; }
              if (Math.abs(b.x - h.x) > trapBox * 3 || Math.abs(b.y - h.y) > trapBox * 3) { gone = true; break; }
            }
            if (gone) continue;
            let b = N.info().b[0];
            if (!b || Math.abs(b.x - h.x) >= trapBox || Math.abs(b.y - h.y) >= trapBox) continue;
            /* Confirm before accusing. A ball caught mid-capture looks pinned
               for a moment and then leaves; a real trap is still there six
               sixteen seconds later — long enough that the game's own
               last-resort return has had its chance too. Unconfirmed reports
               make the suite untrustworthy, which is worse than missing a
               marginal one. */
            let stillStuck = true;
            for (let i = 0; i < 60 * 16; i++) {
              N.step(1);
              if (N.info().inLane) { N.launch(0.7); stillStuck = false; break; }
              b = N.info().b[0];
              if (!b || Math.abs(b.x - h.x) > trapBox * 3 || Math.abs(b.y - h.y) > trapBox * 3) {
                stillStuck = false; break;
              }
            }
            if (stillStuck && b)
              traps.push(`${h.kind}:${h.name} dir${d} ${sp}px/s -> rests ${Math.round(b.x)},${Math.round(b.y)}${b.scoop ? " in " + b.scoop : ""}`);
          }
        }
        if (N.info().state !== "PLAY" && !N.revive())
          return { points: points.length, probes, traps, lost: true };
      }
      return { points: points.length, probes, traps };
    },
    { dirs: DIRS, speeds: SPEEDS, seconds: SECONDS, trapBox: TRAP_BOX, grid: GRID, mode },
  );

async function table(name, setup) {
  console.log(`\n${name}`);
  const { page, errors } = await openGame(browser, { width: 1280, height: 800 });
  const ready = await setup(page);
  check(results, `${name}: table is ready to test`, ready !== false);
  if (ready === false) { await page.close(); return; }

  /* a mislabelled sweep is worse than no sweep: prove we are on the table the
     heading claims before believing a word of the results */
  const where = await page.evaluate(() => {
    const L = window.__NSA__.levelInfo();
    return L ? L.id : "tower";
  });
  check(results, `${name}: the sweep is actually running on ${name}`, where === name, where);

  const resp = await RESPONDS(page);
  const kinds = Object.keys(resp).sort();
  console.log("  responds: " + kinds.map((k) => `${k} ${resp[k].hit}/${resp[k].of}`).join("  "));
  for (const k of kinds)
    check(results, `${name}: every ${k} responds when the ball reaches it`,
      resp[k].hit === resp[k].of, `${resp[k].hit} of ${resp[k].of}`);

  for (const mode of ["spots", "grid"]) {
    const out = await TRAPS(page, mode);
    console.log(`  ${mode}: ${out.points} points, ${out.probes} probes`);
    check(results, `${name}: the sweep stayed on this table (${mode})`, !out.lost);
    check(results, `${name}: nothing traps the ball (${mode})`, out.traps.length === 0,
      out.traps.slice(0, 6).join("\n      "));
  }
  check(results, `${name}: the ball never stops being a number`,
    (await page.evaluate(() => window.__NSA__.nanCount())) === 0);
  /* the last-resort return is allowed to exist — it is the safety net — but it
     should be firing for probes dropped into sealed geometry, not during play */
  console.log(`  last-resort returns: ${await page.evaluate(() => window.__NSA__.rescueCount())}`);
  check(results, `${name}: no page errors`, errors.length === 0, errors[0] || "");
  await page.close();
}

await table("tower", async (page) => {
  await page.evaluate(() => { window.__NSA__.start(); window.__NSA__.warpsOff(); });
  return true;
});

for (const id of ["spiral", "forge", "deep"]) {
  await table(id, (page) =>
    page.evaluate((i) => {
      const N = window.__NSA__;
      N.start();
      /* Shut the gates before playing a ball, or the ball finds one on its
         own during the settle and the sweep runs on whichever room it fell
         into — which is what "the sweep is actually running on X" caught. */
      N.warpsOff();
      N.launch(0.6);
      for (let k = 0; k < 120; k++) N.step(1);
      if (N.warping()) return false;
      N.warp(i);
      for (let k = 0; k < 90; k++) N.step(1);
      if (!N.levelInfo() || N.levelInfo().id !== i) return false;
      N.holdLevel(true);
      return true;
    }, id),
  );
}

await browser.close();
report(results, "interactions");
