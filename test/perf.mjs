/**
 * Frame-time regression guard.
 *
 * The table is large and heavily lit, so it is easy to reintroduce the problem
 * this test was written for: neon drawn with canvas shadowBlur instead of
 * layered strokes, which cost 120 blur passes a frame and roughly doubled the
 * frame time. CI runs software-rendered, so the budget is deliberately loose —
 * it is here to catch an order-of-magnitude regression, not to police a couple
 * of milliseconds.
 *
 *   node test/perf.mjs
 */
import { launchBrowser, openGame, check, report } from "./helpers.mjs";

const BUDGET_P50 = 30; // ms — ~33fps software-rendered
const BUDGET_P99 = 60;

const results = [];
const browser = await launchBrowser();
const { page, errors } = await openGame(browser, { width: 1280, height: 800 });

await page.evaluate(() => {
  document.getElementById("startScreen").classList.add("hidden");
  const N = window.__NSA__;
  N.start();
  N.launch(0.95);
});
await page.waitForTimeout(1500);

const timing = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const samples = [];
      let last = performance.now();
      const tick = () => {
        const now = performance.now();
        samples.push(now - last);
        last = now;
        if (samples.length < 300) requestAnimationFrame(tick);
        else {
          samples.sort((a, b) => a - b);
          const at = (q) => +samples[Math.floor(samples.length * q)].toFixed(1);
          resolve({ p50: at(0.5), p90: at(0.9), p99: at(0.99), max: +samples[samples.length - 1].toFixed(1) });
        }
      };
      requestAnimationFrame(tick);
    }),
);

const ops = await page.evaluate(() => {
  const g = document.getElementById("game").getContext("2d");
  let shadowSets = 0,
    cur = 0;
  Object.defineProperty(g, "shadowBlur", {
    set(v) {
      cur = v;
      if (v > 0) shadowSets++;
    },
    get() {
      return cur;
    },
  });
  return new Promise((r) => {
    let f = 0;
    const t = () => {
      f++;
      if (f < 11) requestAnimationFrame(t);
      else r({ shadowSetsPerFrame: Math.round(shadowSets / 10) });
    };
    requestAnimationFrame(t);
  });
});

console.log(
  `  frame time  p50 ${timing.p50}ms  p90 ${timing.p90}ms  p99 ${timing.p99}ms  max ${timing.max}ms`,
);
console.log(`  shadowBlur set ${ops.shadowSetsPerFrame}x per frame`);

check(results, `p50 frame under ${BUDGET_P50}ms`, timing.p50 < BUDGET_P50, `${timing.p50}ms`);
check(results, `p99 frame under ${BUDGET_P99}ms`, timing.p99 < BUDGET_P99, `${timing.p99}ms`);
check(
  results,
  "shadowBlur stays on its budget",
  ops.shadowSetsPerFrame <= 40,
  `${ops.shadowSetsPerFrame} per frame`,
);
check(results, "no errors", errors.length === 0, errors[0] || "");

await page.close();
await browser.close();
report(results, "perf");
