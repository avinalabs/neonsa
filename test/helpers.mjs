import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

export const GAME_URL = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "index.html"),
).href;

/**
 * Opens the game and collects every page error and console error.
 * The page exposes window.__NSA__ as a test harness — see README.
 */
export async function openGame(browser, { width, height, touch = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: touch ? 2 : 1,
    isMobile: touch,
    hasTouch: touch,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => !!window.__NSA__, null, { timeout: 15000 });
  return { page, errors };
}

export async function launchBrowser() {
  return chromium.launch();
}

/**
 * True when the tracked ball is drawn inside the play window — the band
 * between the top instrument HUD and the bottom control HUD.
 */
export function inPlayWindow(info) {
  const b = info.ballScreen;
  if (!b) return false;
  const { top, h } = info.layout;
  return b.y > top && b.y < top + h && b.x > 0;
}

/** Prints a pass/fail line and records the failure. */
export function check(results, name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
}

export function report(results, title) {
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${title}: ${results.length - failed.length}/${results.length} passed`,
  );
  if (failed.length) {
    console.error("failures:");
    for (const f of failed) console.error(`  - ${f.name} ${f.detail}`);
    process.exitCode = 1;
  }
}
