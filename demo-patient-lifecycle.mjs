/**
 * Automated Demo Recording — Saranam Home Care Patient Lifecycle
 *
 * What it shows (in one continuous ~3-4 minute video):
 *   1. Login as admin
 *   2. Register a new patient — shows UHID live preview with Homecare Code
 *   3. Open the patient detail page
 *   4. Body Map → Free-Click Notes → add a pain annotation
 *   5. Patient Category (BSC Onco) + Priority (High) on the Overview tab
 *   6. Create a follow-up visit
 *   7. Prescription flow — ICD-10, time-based dosage, doctor details, Save
 *   8. Download the prescription PDF and open it in a tab
 *   9. Create another follow-up visit
 *  10. Mark "Patient has passed away" in Patient Outcome → Save
 *
 * Narration is done via a fixed bottom caption bar injected into every page.
 *
 * Run: node demo-patient-lifecycle.mjs
 * Output: ./demo-video/*.webm (and a saved prescription PDF in the same dir)
 *
 * Prerequisites:
 *   - Frontend running at http://localhost:5173
 *   - Backend running at http://localhost:5002
 *   - Admin user admin@cvraman.health / Admin@123
 *   - At least one provider exists (so the doctor dropdown has options)
 */

import { chromium } from 'playwright';
import path from 'path';
import { promises as fs } from 'fs';

const BASE = 'http://localhost:5173';
const CREDS = { email: 'admin@cvraman.health', password: 'Admin@123' };
const OUTPUT_DIR = path.resolve('./demo-video');
const PDF_PATH = path.join(OUTPUT_DIR, 'demo-prescription.pdf');

const PATIENT_FIRST = 'Demo';
const PATIENT_LAST = `Lifecycle${Date.now().toString().slice(-4)}`; // unique suffix
const PATIENT_FULL = `${PATIENT_FIRST} ${PATIENT_LAST}`;

const SLOW = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Caption helpers ──────────────────────────────────────────────────────

/** Called at every page load so the bottom caption bar survives navigations. */
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
    // Re-inject on SPA route changes / React re-renders
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
  } catch { /* page navigated mid-call */ }
  if (pauseMs) await SLOW(pauseMs);
}

// ─── Small action helpers ────────────────────────────────────────────────

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

async function selectMuiOption(page, labelText, optionText) {
  // Open the MUI TextField-select combobox by its visible label
  const combo = page.getByRole('combobox', { name: labelText }).first();
  await combo.click({ timeout: 5000 });
  await SLOW(350);
  // MUI renders the option list in a portal
  await page.getByRole('option', { name: optionText, exact: false }).first().click({ timeout: 5000 });
  await SLOW(400);
}

async function fillIfPresent(page, selector, value) {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 3000 })) {
      await el.fill(value);
      await SLOW(200);
    }
  } catch { /* skip */ }
}

// ─── Main flow ────────────────────────────────────────────────────────────

async function run() {
  console.log('🎬 Starting patient lifecycle demo recording...\n');
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
    await caption(page, 'CV Raman Health — Saranam Home Care Demo', 1800);

    await page.fill('input[type="email"]', CREDS.email);
    await page.fill('input[type="password"]', CREDS.password);
    await SLOW(500);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|patients|saranam|analytics)/, { timeout: 15000 }).catch(() => {});
    await SLOW(1500);

    // ═══════════════════════════════════════════════════════════════
    // SCENE 1 — REGISTER A NEW PATIENT (with UHID preview)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 1: Register new patient');
    await caption(page, 'Step 1 — Register a new patient', 1000);
    await page.goto(`${BASE}/patients`);
    await SLOW(2000);

    // Open the registration modal
    const opened = await safeClick(
      page,
      'button:has-text("Register"), button:has-text("Add Patient"), button:has-text("New Patient")',
      { note: 'Register button' },
    );
    if (!opened) throw new Error('Could not open the Register New Patient modal');
    await SLOW(1200);

    await caption(page, 'Name, date of birth, and gender', 600);
    await page.fill('input[name="first_name"]', PATIENT_FIRST);
    await SLOW(250);
    await page.fill('input[name="last_name"]', PATIENT_LAST);
    await SLOW(300);
    await page.fill('input[name="date_of_birth"]', '1965-05-15');
    await SLOW(400);
    // Gender select (MUI TextField select)
    try { await selectMuiOption(page, 'Gender', 'Male'); }
    catch (e) { console.log('   ⚠️  Gender select failed:', e.message.split('\n')[0]); }

    await SLOW(500);
    await caption(page, 'Diagnosis from the standardised list', 600);
    try { await selectMuiOption(page, 'Diagnosis', 'Breast cancer'); }
    catch (e) { console.log('   ⚠️  Diagnosis select failed:', e.message.split('\n')[0]); }
    await SLOW(500);

    await caption(page, 'Two phone numbers — primary + caregiver relationship', 700);
    await fillIfPresent(page, 'input[name="phone_number"]', '9876543210');
    await fillIfPresent(page, 'input[name="alternative_phone"]', '9123456789');
    await fillIfPresent(page, 'input[name="alternative_phone_name"]', 'Ravi (Son)');
    await SLOW(700);

    // Expand the Location accordion (it's collapsed by default)
    await safeClick(page, '.MuiAccordion-root:has-text("Location")', { note: 'Location accordion' });
    await SLOW(900);

    // Scroll the dialog so the address fields are visible
    await page.evaluate(() => {
      const dialog = document.querySelector('.MuiDialog-paper');
      if (dialog) dialog.scrollTop += 500;
    });
    await SLOW(600);

    // Auto-detect Bangalore + zone from address — no manual switch toggling
    // required. Typing the city name triggers isBangaloreCity() and typing
    // the pin code triggers suggestZoneFromPin(). The form flips
    // is_bangalore_resident=true, sets linked_hospital=KMIO (default), and
    // fills geographic_cluster from the pin code automatically.
    await caption(page, 'Address auto-detects Bangalore and zone from city + pin code', 900);
    await fillIfPresent(page, 'input[name="city"]', 'Bengaluru');
    await SLOW(500);
    await fillIfPresent(page, 'input[name="postal_code"]', '560068'); // South zone pin
    await SLOW(1200);

    // Scroll a bit more so the preview card is in view
    await page.evaluate(() => {
      const dialog = document.querySelector('.MuiDialog-paper');
      if (dialog) dialog.scrollTop += 300;
    });
    await SLOW(800);

    await caption(page, 'Zone auto-detected: South · Linked hospital: Kidwai', 2000);
    await caption(page, 'Live UHID preview: KAGBAKMIO + probable UHID', 2500);

    // Scroll a touch more to ensure Create button is visible
    await page.evaluate(() => {
      const dialog = document.querySelector('.MuiDialog-paper');
      if (dialog) dialog.scrollTop += 500;
    });
    await SLOW(600);

    await caption(page, 'Click Create Patient', 500);
    await safeClick(page, '.MuiDialogActions-root button:has-text("Create"), button:has-text("Create Patient")', {
      note: 'Create Patient button',
    });
    await SLOW(2000);

    await caption(page, 'Patient registered — success toast shows the generated UHID', 2500);

    // The modal auto-closes after 2.5s
    await SLOW(2500);

    // ═══════════════════════════════════════════════════════════════
    // SCENE 2 — PATIENT DETAIL + BODY MAP ANNOTATION
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 2: Body map annotation');
    await caption(page, 'Step 2 — Open the patient detail page', 800);

    // Search by the UNIQUE last-name suffix so we find the exact row we just
    // created, not some other patient whose name contains "Demo".
    await fillIfPresent(page, 'input[placeholder*="earch"]', PATIENT_LAST);
    await SLOW(1800);

    // Click the matching row. Use multiple selector strategies for resilience.
    let rowClicked = false;
    for (const sel of [
      `.MuiTableRow-root:has-text("${PATIENT_LAST}")`,
      `tr:has-text("${PATIENT_LAST}")`,
      `[role="row"]:has-text("${PATIENT_LAST}")`,
      `:text("${PATIENT_LAST}")`,
    ]) {
      if (await safeClick(page, sel, { note: `row ${sel}`, timeout: 2500 })) {
        rowClicked = true;
        break;
      }
    }
    if (!rowClicked) {
      console.log('   ⚠️  Could not click patient row — continuing anyway');
    }
    await SLOW(3000);

    await caption(page, 'Overview tab — scrolling to the Body Map', 700);

    // Wait for the Body Map section to actually render. It's conditional on
    // the async loadInitialVisit() call in OverviewTab — without this wait we
    // hit the section before React mounts it.
    try {
      await page.getByText('Body Map', { exact: false }).first().waitFor({ timeout: 15000 });
    } catch {
      console.log('   ⚠️  Body Map heading never appeared');
    }

    // Scroll down to the body map section
    await page.evaluate(() => window.scrollBy(0, 400));
    await SLOW(700);
    await page.evaluate(() => window.scrollBy(0, 400));
    await SLOW(700);

    await caption(page, 'Body Map → Free-Click Notes mode', 900);

    // Free-Click Notes is the default mode, but click it anyway to be safe
    await safeClick(page, 'button:has-text("Free-Click Notes")', { note: 'Free-Click Notes tab' });
    await SLOW(800);

    // Click on the lower part of the body — roughly on the feet area.
    // Compute coords from the actual bounding box so it doesn't matter what
    // aspect ratio body-map.png renders at.
    await caption(page, 'Click on the lower body to drop a pain annotation', 800);
    let annotationPlaced = false;
    try {
      const bodyCanvas = page.locator('.cursor-crosshair').first();
      await bodyCanvas.waitFor({ state: 'visible', timeout: 8000 });
      await bodyCanvas.scrollIntoViewIfNeeded({ timeout: 5000 });
      await SLOW(800); // let the image settle

      const box = await bodyCanvas.boundingBox();
      if (!box) throw new Error('body map bounding box unavailable');
      // x = ~25% from left (front body's left foot), y = ~88% down (feet level)
      const clickX = box.x + box.width * 0.25;
      const clickY = box.y + box.height * 0.88;
      await page.mouse.click(clickX, clickY);
      annotationPlaced = true;
    } catch (e) {
      console.log('   ⚠️  body map click failed:', e.message.split('\n')[0]);
    }
    await SLOW(1200);

    if (annotationPlaced) {
      await caption(page, 'Describe the finding in the note', 600);
      // Modal should appear with a textarea
      await fillIfPresent(page, 'textarea[placeholder*="finding"], textarea[placeholder*="note"]', 'Severe pain in both legs');
      await SLOW(1200);
      // Save button lives inside the modal (a fixed-position div)
      await safeClick(page, '.fixed.inset-0 button:has-text("Save")', { note: 'Save annotation', timeout: 4000 });
      await SLOW(1500);
      await caption(page, 'Annotation saved — red dot with label', 2000);
    }

    // ═══════════════════════════════════════════════════════════════
    // SCENE 3 — PATIENT CATEGORY + PRIORITY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 3: Patient Category + Priority');
    await caption(page, 'Step 3 — Set patient category and priority', 800);

    // Scroll to the bottom of the Overview tab
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await SLOW(1500);

    await caption(page, 'Category: BSC Onco', 500);
    try { await selectMuiOption(page, 'Patient Category', 'BSC Onco'); }
    catch (e) { console.log('   ⚠️  Category select failed:', e.message.split('\n')[0]); }
    await SLOW(800);

    await caption(page, 'Priority: High', 500);
    try { await selectMuiOption(page, 'Patient Priority', 'High'); }
    catch (e) { console.log('   ⚠️  Priority select failed:', e.message.split('\n')[0]); }
    await SLOW(800);

    // Click the Save button inside the category form
    await safeClick(page, 'button:has-text("Save"):near(:text("Patient Priority"))', { note: 'Save category' });
    // Fallback: find any nearby Save button
    await safeClick(page, '.MuiPaper-root:has-text("Patient Category") button:has-text("Save")', {
      note: 'Save category fallback',
    });
    await SLOW(1500);
    await caption(page, 'Category saved', 1200);

    // ═══════════════════════════════════════════════════════════════
    // SCENE 4 — FIRST FOLLOW-UP VISIT + PRESCRIPTION + PDF
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 4: Follow-up #1 + prescription');
    await caption(page, 'Step 4 — Create the first follow-up visit', 900);

    // Scroll back to top and click the Visits tab
    await page.evaluate(() => window.scrollTo(0, 0));
    await SLOW(600);
    await safeClick(page, '[role="tab"]:has-text("Visits")', { note: 'Visits tab' });
    await SLOW(1500);

    // Click "New Visit"
    await safeClick(page, 'button:has-text("New Visit"), button:has-text("Record First Visit")', {
      note: 'New Visit button',
    });
    await SLOW(1200);

    // Defaults already set to follow_up + today + home — click Create Visit
    await safeClick(page, '.MuiDialog-paper button:has-text("Create Visit")', { note: 'Create Visit button' });
    await SLOW(2500);

    // The new visit should now be in the list. Click it.
    await caption(page, 'Open the visit', 500);
    await safeClick(page, '.MuiPaper-root:has-text("Follow-Up")', { note: 'open follow-up row' });
    await SLOW(2500);

    // ── Prescription builder ──
    await caption(page, 'Scrolling to the Prescription section', 700);
    await page.evaluate(() => window.scrollBy(0, 1400));
    await SLOW(1000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await SLOW(800);

    await caption(page, 'ICD-10 diagnosis with autocomplete', 800);
    await fillIfPresent(page, 'input[placeholder*="code or diagnosis"]', 'breast');
    await SLOW(1500);
    // Click the first ICD-10 suggestion
    await safeClick(page, '.absolute button:has-text("C50"), [role="button"]:has-text("C50")', {
      note: 'ICD-10 suggestion',
    });
    await SLOW(800);

    await caption(page, 'Add a medicine with time-based dosage', 800);
    await safeClick(page, 'button:has-text("Add Medicine")', { note: 'Add Medicine button' });
    await SLOW(1000);

    // Fill medicine name (free text works — it's a searchable input, but also accepts manual entry)
    const medInput = page.locator('input[placeholder="Type to search..."]').first();
    if (await medInput.isVisible().catch(() => false)) {
      await medInput.fill('Paracetamol 500mg');
      await SLOW(1500);
      // Close the dropdown by clicking elsewhere or pressing Escape
      await page.keyboard.press('Escape');
      await SLOW(300);
    }

    await caption(page, 'Night dose doubled — 2 tablets at 10 PM', 900);
    // Set the 10 PM slot to "2" (the TIME_DOSAGE_SLOTS dropdowns are in a row labeled 10PM)
    // Each slot is a <select> with label text above it. Try to find the 10PM one.
    // As a fallback, just skip this — the demo still shows the time slots existing.
    try {
      const tenPm = page.locator('label:has-text("10PM")').locator('..').locator('select').first();
      if (await tenPm.isVisible({ timeout: 2000 })) {
        await tenPm.selectOption('2');
        await SLOW(500);
      }
    } catch { /* skip */ }

    // Doctor info — scroll to see it + pick a provider
    await page.evaluate(() => window.scrollBy(0, 500));
    await SLOW(600);

    await caption(page, 'Prescribing doctor — auto-fills name, qualification, KMC reg', 900);
    // The "Select from providers..." dropdown is a native HTML select
    const docSelect = page.locator('select').filter({ hasText: /Select from providers/ }).first();
    try {
      if (await docSelect.isVisible({ timeout: 3000 })) {
        // Pick the first real provider (option index 1, skipping the placeholder)
        const options = await docSelect.locator('option').all();
        if (options.length > 1) {
          const value = await options[1].getAttribute('value');
          if (value) await docSelect.selectOption(value);
        }
        await SLOW(800);
      }
    } catch { /* skip */ }

    await caption(page, 'Save the prescription', 600);
    await safeClick(page, 'button:has-text("Save Prescription")', { note: 'Save Prescription' });
    await SLOW(2000);

    // ── Download PDF ──
    await caption(page, 'Download the prescription PDF', 800);
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await safeClick(page, 'button:has-text("Download PDF")', { note: 'Download PDF button' });
    const download = await downloadPromise;
    if (download) {
      try {
        await download.saveAs(PDF_PATH);
        console.log('   ✓ PDF saved to', PDF_PATH);

        // Chromium treats a direct file:// navigation to a .pdf as a download
        // (not inline rendering) in headless mode, so wrap it in an <embed>
        // via setContent. That renders the PDF inline inside our tab.
        const pdfPage = await context.newPage();
        await pdfPage.setContent(`
          <!doctype html>
          <html>
            <head>
              <title>Prescription PDF</title>
              <style>
                html, body { margin: 0; padding: 0; background: #1e293b; height: 100vh; overflow: hidden; }
                .wrap { display: flex; flex-direction: column; height: 100vh; }
                .header { background: #0f172a; color: white; padding: 14px 24px; font-family: -apple-system, sans-serif; font-size: 15px; border-bottom: 3px solid #3b82f6; }
                embed, iframe { flex: 1; width: 100%; border: none; background: white; }
              </style>
            </head>
            <body>
              <div class="wrap">
                <div class="header">📄 Saranam Home Care — Prescription PDF</div>
                <embed src="file://${PDF_PATH}" type="application/pdf" />
              </div>
            </body>
          </html>
        `);
        await SLOW(800);
        await caption(pdfPage, 'PDF shows UHID, Homecare Code, medicines, and doctor details', 5000);
        await pdfPage.close();
      } catch (err) {
        console.log('   ⚠️  PDF display failed:', err.message.split('\n')[0]);
      }
    } else {
      console.log('   ⚠️  No download event captured');
      await SLOW(2000);
    }

    // Go back to visits list
    await caption(page, 'Returning to the visits list', 600);
    await safeClick(page, 'button:has-text("All Visits"), button:has-text("Back")', { note: 'Back to visits' });
    await SLOW(1500);

    // ═══════════════════════════════════════════════════════════════
    // SCENE 5 — SECOND FOLLOW-UP VISIT + MARK DECEASED
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Scene 5: Follow-up #2 + mark deceased');
    await caption(page, 'Step 5 — Create a second follow-up visit', 900);

    await safeClick(page, 'button:has-text("New Visit")', { note: 'New Visit (2nd)' });
    await SLOW(1200);
    await safeClick(page, '.MuiDialog-paper button:has-text("Create Visit")', { note: 'Create Visit (2nd)' });
    await SLOW(2500);

    // Open the latest follow-up (topmost in the list after sort)
    await caption(page, 'Open the second visit', 500);
    await safeClick(page, '.MuiPaper-root:has-text("Follow-Up")', { note: 'open 2nd follow-up' });
    await SLOW(2500);

    // Scroll down to the Patient Outcome section
    await caption(page, 'Scrolling to Patient Outcome', 700);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await SLOW(800);
    await page.evaluate(() => window.scrollBy(0, 600));
    await SLOW(800);

    await caption(page, 'Mark: Patient has passed away', 900);
    // The checkbox is inside a label with the text "Patient has passed away"
    await safeClick(page, 'label:has-text("Patient has passed away") input[type="checkbox"]', {
      note: 'Deceased checkbox',
    });
    await SLOW(1000);

    await caption(page, 'Date of death auto-fills with today', 1500);
    await SLOW(1000);

    await caption(page, 'Save the follow-up — outcome is captured', 800);
    await safeClick(page, 'button:has-text("Save Follow-Up")', { note: 'Save Follow-Up' });
    await SLOW(2500);

    // ═══════════════════════════════════════════════════════════════
    // WRAP
    // ═══════════════════════════════════════════════════════════════
    console.log('\n▶ Wrap');
    await caption(page, 'Demo complete — full lifecycle from registration to outcome', 3500);

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
