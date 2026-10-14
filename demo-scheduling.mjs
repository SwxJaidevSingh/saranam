/**
 * Automated Demo Recording — Saranam Scheduling Flow (Video #2)
 *
 * Focused flow (~2.5 minutes):
 *   0. Login
 *   1. Schedule Calendar → click "+ New Schedule"
 *   2. Fill "Week Start Date" = 13/04/2026 (Monday) → click Create
 *   3. Lands on the Weekly Planning Board (fresh draft)
 *   4. Open "Add Patient to Day" modal repeatedly and add 4 patients to Monday
 *   5. Assign team members to Monday (tolerant — skips if the panel isn't reachable)
 *   6. Show the populated Monday column
 *
 * Caption bar at the bottom replaces voiceover.
 *
 * Run: node demo-scheduling.mjs
 * Output: ./demo-video/*.webm
 *
 * Prerequisites:
 *   - Frontend on :5173, backend on :5002
 *   - Admin user admin@cvraman.health / Admin@123
 *   - At least 5 patients in the pool (Bangalore residents with zones)
 *   - At least 1 vehicle in Schedule Settings
 */

import { chromium } from 'playwright';
import path from 'path';
import { promises as fs } from 'fs';

const BASE = 'http://localhost:5173';
const CREDS = { email: 'admin@cvraman.health', password: 'Admin@123' };
const OUTPUT_DIR = path.resolve('./demo-video');

// Monday 13 April 2026 (matches the user's screenshot)
const WEEK_START = '2026-04-13';

const SLOW = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Caption overlay ─────────────────────────────────────────────────────

const CAPTION_INIT_SCRIPT = `
  (() => {
    const css = \`
      #demo-caption {
        position: fixed; bottom: 0; left: 0; right: 0;
        background: rgba(15, 23, 42, 0.94);
        color: white;
        padding: 18px 32px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 20px; font-weight: 500;
        text-align: center;
        z-index: 2147483647;
        letter-spacing: 0.3px;
        border-top: 4px solid #3b82f6;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.35);
        min-height: 24px;
        pointer-events: none;
      }
    \`;
    const ensureCaption = () => {
      if (!document.getElementById('demo-caption-style')) {
        const style = document.createElement('style');
        style.id = 'demo-caption-style';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      }
      if (!document.getElementById('demo-caption')) {
        const el = document.createElement('div');
        el.id = 'demo-caption';
        el.textContent = window.__demoCaption || '';
        (document.body || document.documentElement).appendChild(el);
      }
    };
    window.__setDemoCaption = (text) => {
      window.__demoCaption = text;
      ensureCaption();
      const el = document.getElementById('demo-caption');
      if (el) el.textContent = text;
    };
    const observer = new MutationObserver(() => ensureCaption());
    const start = () => {
      ensureCaption();
      if (document.body) observer.observe(document.body, { childList: true });
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
  })();
`;

async function caption(page, text, pauseMs = 600) {
  console.log(`   📢 ${text}`);
  try {
    await page.evaluate((t) => {
      if (window.__setDemoCaption) window.__setDemoCaption(t);
    }, text);
  } catch { /* navigated mid-call */ }
  if (pauseMs) await SLOW(pauseMs);
}

async function safeClick(page, selector, { timeout = 5000, note } = {}) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout })) {
      await el.click({ timeout });
      return true;
    }
  } catch (err) {
    if (note) console.log(`   ⚠️  safeClick failed: ${note} (${err.message.split('\n')[0]})`);
  }
  return false;
}

// ─── Main flow ───────────────────────────────────────────────────────────

async function run() {
  console.log('🎬 Starting scheduling demo recording...\n');
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, slowMo: 140 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUTPUT_DIR, size: { width: 1440, height: 900 } },
    acceptDownloads: true,
  });
  await context.addInitScript(CAPTION_INIT_SCRIPT);

  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  try {
    // ═══════════════════════════════════════════════════════════════
    // SCENE 0 — LOGIN
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 0: Login');
    await page.goto(`${BASE}/login`);
    await SLOW(1200);
    await caption(page, 'Saranam Scheduling — Video 2 of the Demo Series', 1800);

    await page.fill('input[type="email"]', CREDS.email);
    await page.fill('input[type="password"]', CREDS.password);
    await SLOW(500);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|patients|saranam|analytics)/, { timeout: 15000 }).catch(() => {});
    await SLOW(1500);

    // ═══════════════════════════════════════════════════════════════
    // SCENE 1 — SCHEDULE CALENDAR → CREATE NEW SCHEDULE
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 1: Schedule Calendar → New Schedule');
    await page.goto(`${BASE}/saranam/scheduling`);
    await SLOW(2500);

    await caption(page, 'Step 1 — Create a new weekly schedule', 1500);
    await caption(page, 'Click the blue "+ New Schedule" button (top-right)', 800);

    // Click the + New Schedule button. There are 3 buttons in the header
    // (Refresh, Quick Create, + New Schedule). The New Schedule one is the
    // contained (blue) variant and has text "New Schedule".
    const clicked = await safeClick(page, '.MuiButton-containedPrimary:has-text("New Schedule")', {
      note: 'New Schedule button',
    });
    if (!clicked) {
      await safeClick(page, 'button:has-text("New Schedule"):not(:has-text("Quick"))', {
        note: 'New Schedule button fallback',
      });
    }
    await SLOW(1500);

    // ── Fill the Create New Schedule dialog ──
    await caption(page, 'Week Start Date: 13 April 2026 (Monday)', 1200);
    try {
      const dateInput = page.locator('.MuiDialog-paper input[type="date"]').first();
      await dateInput.waitFor({ state: 'visible', timeout: 5000 });
      // Native date inputs expect ISO format regardless of browser locale
      await dateInput.fill(WEEK_START);
      await SLOW(800);
    } catch (e) {
      console.log('   ⚠️  Date fill failed:', e.message.split('\n')[0]);
    }

    await caption(page, 'Click Create to spin up the empty weekly plan', 1000);
    await safeClick(page, '.MuiDialogActions-root button:has-text("Create")', {
      note: 'Create button',
    });

    // Wait for navigation to the board
    await page.waitForURL(/\/saranam\/scheduling\/board\//, { timeout: 15000 }).catch(() => {});
    await SLOW(2500);

    // ═══════════════════════════════════════════════════════════════
    // SCENE 2 — WEEKLY PLANNING BOARD (FRESH DRAFT)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 2: Weekly Planning Board');
    await caption(page, 'Fresh draft schedule — Monday through Sunday', 2000);

    // Wait for the board to fully render by waiting for the patient pool
    try {
      await page.getByText(/in pool/i).first().waitFor({ timeout: 15000 });
    } catch {
      console.log('   ⚠️  Patient pool text never appeared');
    }
    await SLOW(1500);

    await caption(page, 'Patient pool is on the left · day columns on the right', 2500);

    // ═══════════════════════════════════════════════════════════════
    // SCENE 3 — ADD 4 PATIENTS TO MONDAY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 3: Add patients to Monday');
    await caption(page, 'Step 2 — Add patients to Monday', 1000);

    // Patient indices inside the modal's Select. Index 0 = "Select patient..."
    // placeholder (skipped). Indices 1..N = real patients.
    const PATIENT_PICK_INDICES = [1, 2, 3, 4];

    for (let i = 0; i < PATIENT_PICK_INDICES.length; i++) {
      const patientIdx = PATIENT_PICK_INDICES[i];
      const label = i === 0
        ? 'Click "Add Patient to Day"'
        : `Adding patient ${i + 1} of ${PATIENT_PICK_INDICES.length}`;
      await caption(page, label, 600);

      // Open the modal
      const opened = await safeClick(page, 'button:has-text("Add Patient to Day")', {
        note: 'Add Patient to Day button',
      });
      if (!opened) {
        console.log(`   ⚠️  Could not open Add Patient to Day modal (iteration ${i + 1})`);
        break;
      }
      await SLOW(1000);

      // Wait for the modal to be fully visible
      try {
        await page.locator('.MuiDialog-paper:has-text("Add Patient to Day")').waitFor({ timeout: 5000 });
      } catch {
        console.log(`   ⚠️  Modal didn't appear (iteration ${i + 1})`);
        break;
      }

      // ── Select patient (first MUI Select in the dialog) ──
      try {
        const patientSelect = page.locator('.MuiDialog-paper .MuiSelect-select').first();
        await patientSelect.click({ timeout: 5000 });
        await SLOW(600);

        // Options are rendered in a portal (not inside the dialog). Pick the
        // Nth real option (skip the "Select patient..." placeholder at idx 0).
        const options = page.locator('[role="option"]');
        const count = await options.count();
        if (count > patientIdx) {
          await options.nth(patientIdx).click({ timeout: 5000 });
          await SLOW(800);
        } else if (count > 1) {
          // Fewer patients than expected — pick the last real option
          await options.nth(count - 1).click({ timeout: 5000 });
          await SLOW(800);
        } else {
          console.log('   ⚠️  No patient options available');
          await page.keyboard.press('Escape');
          break;
        }
      } catch (e) {
        console.log(`   ⚠️  Patient select failed (iter ${i + 1}):`, e.message.split('\n')[0]);
        await page.keyboard.press('Escape').catch(() => {});
        continue;
      }

      // ── Select day (Monday = first real option) ──
      // The Day Select is the second MuiSelect-select in the dialog.
      try {
        const daySelect = page.locator('.MuiDialog-paper .MuiSelect-select').nth(1);
        await daySelect.click({ timeout: 5000 });
        await SLOW(500);
        // First option (index 0) is "Select day..." placeholder; real days
        // start at index 1. Monday is the first day of the week.
        const dayOptions = page.locator('[role="option"]');
        const dayCount = await dayOptions.count();
        if (dayCount >= 2) {
          await dayOptions.nth(1).click({ timeout: 5000 });
          await SLOW(600);
        }
      } catch (e) {
        console.log(`   ⚠️  Day select failed (iter ${i + 1}):`, e.message.split('\n')[0]);
      }

      // Caption shifts slightly for the first iteration so viewer understands
      if (i === 0) {
        await caption(page, 'Pick patient + pick Monday + click "Add to Schedule"', 800);
      }

      // ── Click "Add to Schedule" ──
      const added = await safeClick(page, '.MuiDialog-paper button:has-text("Add to Schedule")', {
        note: 'Add to Schedule button',
      });
      if (!added) {
        console.log(`   ⚠️  Could not click Add to Schedule (iter ${i + 1})`);
        await page.keyboard.press('Escape').catch(() => {});
        break;
      }

      // Wait for the modal to close
      try {
        await page.locator('.MuiDialog-paper:has-text("Add Patient to Day")').waitFor({
          state: 'hidden',
          timeout: 5000,
        });
      } catch {
        // Modal may not close cleanly; Escape to be safe
        await page.keyboard.press('Escape').catch(() => {});
      }
      await SLOW(1500);
    }

    await caption(page, 'Monday now has multiple patients scheduled', 2500);

    // Scroll the days container to ensure Monday (first column) is visible
    try {
      await page.evaluate(() => window.scrollTo(0, 0));
      await SLOW(500);
    } catch { /* skip */ }

    // ═══════════════════════════════════════════════════════════════
    // SCENE 4 — ASSIGN TEAM MEMBERS TO MONDAY (tolerant)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 4: Assign team members to Monday');
    await caption(page, 'Step 3 — Assign team members to Monday', 1200);

    // Team assignments are inside a collapsible "Team Assignments" panel in
    // each day column. Expand it if needed, then click "Add Team Member"
    // inside Monday's panel. All wrapped in try/catch so a failure here
    // doesn't kill the video.
    let teamAttempted = false;
    try {
      // Try to find a Team Assignments expand button (or panel header) and
      // click it to expand the Monday column's team panel.
      await safeClick(page, 'button:has-text("Team Assignments"), .MuiCollapse-root button:has-text("Team")', {
        note: 'Team panel toggle',
        timeout: 3000,
      });
      await SLOW(800);

      // Click the first "Add Team Member" button on the page (Monday's)
      const addTeamClicked = await safeClick(page, 'button:has-text("Add Team Member")', {
        note: 'Add Team Member button',
        timeout: 4000,
      });
      if (addTeamClicked) {
        teamAttempted = true;
        await SLOW(1000);
        await caption(page, 'Pick specialization · then pick a provider', 800);

        // Pick the first specialization — the inline FormControl is inside
        // the blue dashed box right above where the button was
        try {
          const specSelect = page.locator('.MuiBox-root:has-text("Select specialization") .MuiSelect-select, [class*="bg-blue-50"] .MuiSelect-select').first();
          await specSelect.click({ timeout: 4000 });
          await SLOW(500);
          const specOptions = page.locator('[role="option"]:not([aria-disabled="true"])');
          if (await specOptions.count() > 0) {
            await specOptions.first().click({ timeout: 4000 });
            await SLOW(800);
          }
        } catch (e) {
          console.log('   ⚠️  Specialization pick failed:', e.message.split('\n')[0]);
        }

        // Pick the first provider — the second FormControl appears after spec
        try {
          const provSelect = page.locator('[class*="bg-blue-50"] .MuiSelect-select').nth(1);
          await provSelect.click({ timeout: 4000 });
          await SLOW(500);
          const provOptions = page.locator('[role="option"]:not([aria-disabled="true"])');
          if (await provOptions.count() > 0) {
            await provOptions.first().click({ timeout: 4000 });
            await SLOW(1000);
          }
        } catch (e) {
          console.log('   ⚠️  Provider pick failed:', e.message.split('\n')[0]);
        }
      }
    } catch (e) {
      console.log('   ⚠️  Team assignment scene failed:', e.message.split('\n')[0]);
    }

    if (teamAttempted) {
      await caption(page, 'Team member assigned to Monday', 2000);
    } else {
      await caption(page, 'Team assignment panel is available per day + vehicle', 2000);
    }

    // ═══════════════════════════════════════════════════════════════
    // WRAP — Final shot of populated Monday
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Wrap');
    await caption(page, 'Monday\'s weekly schedule — patients + team ready', 3000);
    await SLOW(1500);
    await caption(page, 'Scheduling demo complete — planning → driver in one flow', 3500);

    console.log('\n🎬 Recording complete!');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    console.log(`\n📁 Video saved to: ${OUTPUT_DIR}/`);
  }
}

run();
