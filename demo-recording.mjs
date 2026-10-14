/**
 * Automated Demo Recording — Saranam Home Care Requirements
 * Records browser video walking through implemented features.
 * Run: node demo-recording.mjs
 * Output: ./demo-video/ folder with .webm recording
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const CREDS = { email: 'admin@cvraman.health', password: 'Admin@123' };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeClick(page, selector, timeout = 5000) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout })) {
      await el.click({ timeout });
      return true;
    }
  } catch { }
  return false;
}

async function run() {
  console.log('🎬 Starting demo recording...\n');

  const browser = await chromium.launch({ headless: true, slowMo: 150 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: './demo-video/', size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  try {
    // ═══════ LOGIN ═══════
    console.log('1. Login...');
    await page.goto(`${BASE}/login`);
    await sleep(1000);
    await page.fill('input[type="email"]', CREDS.email);
    await page.fill('input[type="password"]', CREDS.password);
    await sleep(400);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await sleep(2000);
    console.log('   ✓ Logged in\n');

    // ═══════ PATIENTS LIST ═══════
    console.log('2. Patients list...');
    await page.goto(`${BASE}/patients`);
    await sleep(2000);

    // Show registration dialog briefly
    if (await safeClick(page, 'button:has-text("Register"), button:has-text("Add")')) {
      await sleep(2000);
      // Scroll the dialog to show all fields
      await page.evaluate(() => {
        const dialog = document.querySelector('.MuiDialog-paper');
        if (dialog) dialog.scrollTop += 300;
      });
      await sleep(1500);
      await safeClick(page, 'button:has-text("Cancel")');
      await sleep(500);
    }
    console.log('   ✓ Registration form shown (1.1-1.4)\n');

    // ═══════ ZAIB FATIMA DETAIL ═══════
    console.log('3. Zaib Fatima — Overview...');
    // Search
    const search = page.locator('input[placeholder*="earch"]').first();
    if (await search.isVisible({ timeout: 3000 })) {
      await search.fill('Zaib');
      await sleep(1500);
    }
    await safeClick(page, 'text=Zaib Fatima');
    await sleep(2500);

    // Scroll overview
    await page.evaluate(() => window.scrollBy(0, 400));
    await sleep(1500);
    await page.evaluate(() => window.scrollBy(0, 400));
    await sleep(1500);
    console.log('   ✓ Demographics, Clinical Status, Body Map\n');

    // ═══════ VISITS TAB ═══════
    console.log('4. Visits tab — Initial + 5 Follow-ups...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await safeClick(page, 'button:has-text("Visits"), [role="tab"]:has-text("Visits")');
    await sleep(2000);

    // Click first visit (initial)
    const visitRow = page.locator('text=Initial').first();
    if (await visitRow.isVisible({ timeout: 3000 })) {
      await visitRow.click();
      await sleep(2000);
      // Scroll through assessments
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await sleep(1200);
      }
      await safeClick(page, 'button:has-text("Back")');
      await sleep(1000);
    }
    console.log('   ✓ Visit detail with 8 assessments\n');

    // ═══════ TRENDS TAB — VITALS ═══════
    console.log('5. Trends tab — Vitals from all sources (8.1)...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await safeClick(page, 'button:has-text("Trends"), [role="tab"]:has-text("Trends")');
    await sleep(2500);

    // Cycle through vital tabs
    for (const tab of ['Pulse Rate', 'SpO2', 'Temperature', 'GRBS', 'Blood Pressure']) {
      await safeClick(page, `button:has-text("${tab}")`);
      await sleep(1000);
    }

    // Scroll to ESAS + PPS
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(1500);
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(1500);
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(1500);
    console.log('   ✓ Vitals + ESAS + PPS trends\n');

    // ═══════ SCHEDULING ═══════
    console.log('6. Scheduling — Vehicles, Time Slots (3.1-3.5)...');
    await page.goto(`${BASE}/saranam/scheduling`);
    await sleep(2500);
    await page.evaluate(() => window.scrollBy(0, 300));
    await sleep(1500);
    console.log('   ✓ Schedule calendar\n');

    // ═══════ ANALYTICS — VITALS ═══════
    console.log('7. Analytics Dashboard — Vitals Analytics (8.2)...');
    await page.goto(`${BASE}/analytics`);
    await sleep(2500);

    await safeClick(page, 'button:has-text("Vitals")');
    await sleep(2500);
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(1500);
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(1500);
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(1500);
    console.log('   ✓ Vitals improvement, distribution, correlation, top movers\n');

    // ═══════ OTHER ANALYTICS TABS ═══════
    console.log('8. Other Analytics tabs...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    for (const tab of ['Patient', 'Symptoms', 'Outcomes']) {
      await safeClick(page, `button:has-text("${tab}")`);
      await sleep(2000);
    }
    console.log('   ✓ Patient, Symptoms, Outcomes\n');

    // ═══════ NOTIFICATION BELL ═══════
    console.log('9. Notification Bell (9.2)...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    const bell = page.locator('button:has(svg)').filter({ has: page.locator('.lucide-bell') }).first();
    if (await bell.isVisible({ timeout: 3000 })) {
      await bell.click();
      await sleep(2000);
      await bell.click();
      await sleep(500);
    }
    console.log('   ✓ Notification bell with dropdown\n');

    // ═══════ OPD ═══════
    console.log('10. OPD Dashboard (5.1-5.6)...');
    await page.goto(`${BASE}/opd`);
    await sleep(2500);
    console.log('   ✓ OPD shown\n');

    // ═══════ INVENTORY ═══════
    console.log('11. Inventory...');
    await page.goto(`${BASE}/inventory`);
    await sleep(2000);
    console.log('   ✓ Inventory shown\n');

    // Final pause
    await sleep(2000);
    console.log('🎬 Recording complete!');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    console.log('📁 Video saved to: ./demo-video/\n');
  }
}

run();
