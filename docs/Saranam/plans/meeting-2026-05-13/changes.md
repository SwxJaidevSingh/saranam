# Meeting Notes & Change Requests — 2026-05-13

**Attendees:** Farzan, Aneesh (Speaker 2 — dev/PM), Farzad (Speaker 3 — engineer), Dr. Ashwini (Speaker 4 — clinical)
**Transcript source:** `~/Downloads/transcript-2026-05-13.txt`

This doc consolidates everything discussed in the call into an actionable list of
changes / new features. Organised by module so each team can pick up the parts
relevant to them.

---

## 1. Telecommunications Module

### 1.1 Inbound calls (master number → routing)

Existing behaviour shown:
- Single master number that routes incoming calls to nurses.
- If nurse 1 doesn't pick up, the call is routed to nurse 2, then nurse 3 (round-robin / fallback).
- All calls are recorded for quality / compliance.
- Centralised analytics from the master number are surfaced on the **Health Intelligence Dashboard** — number of calls, answered/missed, average duration, recording playback, and AI-driven call analysis.

**To confirm / implement:**
- [ ] Verify whether the **number-of-rings** before fallback is configurable (Farzad to check provider settings). If not configurable, document the fixed value.
- [ ] Surface call recordings + per-call metrics in the dashboard (already planned, to be shown next demo).

### 1.2 Outbound voice calls (click-to-call)

Existing flow shown:
- Provider clicks "Call" on a patient record → the system simultaneously rings the provider's phone and the patient's phone.
- When both answer, a bridge connects them. Conversation happens over phone (not laptop mic).
- Same Zomato-style flow.

**Change requests:**
- [ ] **Select call target before dialling** — Provider must choose between **Patient** vs **Caregiver** (caregiver number is already captured along with relationship). Right now the call defaults to the patient. The provider on the call decides who is well enough to receive it.
- [ ] Confirm whether the existing "alternative mobile number" field is being used as caregiver number or a separate field — and wire the picker correctly.

### 1.3 Video calls

Three options to be supported (provider chooses per call):

| Option | Account needed | Party limit | Duration | Recording |
|---|---|---|---|---|
| **EnableX link** | None (just browser + mic/cam) | Max 3 parties (doctor + caregiver + 1) | 1 hour | ✅ Yes |
| **Google Meet link** | Google account required to join | Unlimited | 1 hour | ❌ Not via our tool |
| **Manual WhatsApp consultation** | None — uses regular WhatsApp video call | N/A | N/A | ❌ |

Link delivery: when video call is initiated, the link is sent to patient + provider via **WhatsApp, SMS, and email** simultaneously. EnableX requires no name entry — patient clicks link → browser → "Join" button.

**Change requests:**
- [ ] **Add "Manual WhatsApp consultation" mode** (Dr. Ashwini's ask): when patient can't join EnableX / Meet link, provider does a normal WhatsApp video call and logs details via a **manual entry form** in the tool. Form must capture the same fields a system-initiated call would (date/time, participants, duration, notes, outcome).
- [ ] Keep all three modes configurable per call — provider picks what works for that patient.
- [ ] Default reasoning: EnableX is preferred (worked well at Manipal Udupi + KIMS, low-bandwidth friendly, no account, recordable). Meet only when caregiver clearly has a Google account.

### 1.4 WhatsApp-event flow for scheduled video calls (deferred, future)

Farzad's proposal:
- Provider schedules a teleconsultation (e.g. 5 May 6 PM with patient).
- System sends a **WhatsApp event/message** to the provider's WhatsApp containing the patient's phone number.
- Provider taps the number directly in WhatsApp → triggers a WhatsApp video call to the patient. No need to save the contact.
- WhatsApp's native event reminders (15/20 min before) work automatically.

**Decision:** Useful at scale (high volume of scheduled calls), **not a priority now**. Current practice = team sits together on Wed/Sat, reviews patients not contacted in 3–4 days, dials manually. Revisit when scheduling becomes a bottleneck.

---

## 2. AI Summary & Body Map

### 2.1 What exists today

- **Per-form AI summaries** for 4 forms: Nursing Assessment, Doctor Assessment, Physiotherapy Assessment, Psychological Assessment. Button on each form generates the summary.
- **Patient AI Summary** — aggregates across all forms + PPS score, patient category, estimated survival days. Shown on patient detail page. Downloadable as **PDF**.
- **Body map auto-generation** — when Patient AI Summary is generated, the body map is also populated automatically.
  - **Blue highlights** = AI-generated.
  - **Red highlights** = manually added / edited by clinician.
  - Each AI point can be individually edited, deleted, or all cleared at once ("Clear AI").
  - Doctor can also add new points manually.

### 2.2 Change requests

- [ ] **Per-visit follow-up summary** — generate a fresh summary on every follow-up visit. Maintain a **cumulative, date-wise log** of summaries (visit 1 → visit 2 → visit 3 …) so any clinician picking up a patient mid-journey can see progression at a glance. Store under a new section **"Past Records"** on the patient page.
- [ ] **"Latest Patient Health" card** — quick-glance card on the patient page showing the most recent follow-up summary. Updates every follow-up. Sits alongside the Patient AI Summary (not merged into it, to avoid overlap).
- [ ] **Separate follow-up body map per visit** — Dr. Ashwini wants a **new body map generated on each follow-up summary**, reflecting current state (e.g. back pain resolved → remove; headache worse → upgrade severity). Each follow-up body map is stored against that visit so symptoms can be tracked date-wise.
- [ ] **Configurable summary format** — Dr. Ashwini to share a **template** with required fields (e.g. main causes, estimated survival, key complaints). AI will then generate the summary in that structured format every time, not a free-flowing paragraph. **Action: Dr. Ashwini to share format.** (See section 5 below — the "Patient Summary Format" template the client shared.)
- [ ] Ensure all generated content (AI summary, body map points) remains **editable + deletable** by the clinician — important because the doctor often refines the AI output based on examination.

---

## 3. Form / Naming Changes

- [x] **"HPE" renamed to "Diagnosis"** in the Doctor Assessment form. (Already done — confirmed in call.)

---

## 4. Analytics Dashboard

### 4.1 Terminology fix (urgent)

- [ ] **Clarify "Patients Seen" widget** — currently ambiguous. Farzad to confirm whether it counts OPD consultations, home visits, or unique patients. **Rename to be explicit** (e.g. "Unique Patients Seen — last 30 days").

### 4.2 Required metrics (must-have)

The analytics dashboard must surface these for any selected period:

**Visits**
- [ ] **Total home care visits**
  - Broken down into **unique (first-visit) patients** vs **follow-up visits** (unique + follow-up = total).
- [ ] **Average visits / period** (already shown).

**Consultations** — every discipline interaction on a visit is logged as a separate consultation. A single home visit by 3 team members = 3 consultations.
- [ ] **Total consultations**, broken down by:
  - **Modality**: in-person (physical), incoming call, outgoing call.
  - **Discipline (multidisciplinary breakdown)**: Doctor / Nurse / Physiotherapist / Counsellor / Social Worker.
- [ ] Inbound calls from patient/caregiver and outbound calls from office must also be counted as consultations (tied into Telecom module — see §1).

**Mortality**
- [ ] **Deaths** broken down by location: **at home / at hospital / in-transit (other)**. Already segmented by zone (Central/East/North/South/West) — keep that.

**Clinical metrics**
- [ ] **Patients on opioids** (count).
- [ ] **Loss to follow-up** (count + list).
- [ ] **Registration → first-visit time**.
  - Target: **≤ 8 home care days** (= 2 calendar weeks, since 4 home-care days per week).
  - Show: # within target, # outside target, **reasons for delay** for the outside-target cohort.

**Volume / operations**
- [ ] **Patient registrations** per period (Dr. Ashwini's explicit ask — how many new patients registered in the month).
- [ ] **Kilometres covered** per week / total + average (already shown).
- [ ] **Vehicle utilisation** (total slots used) — already shown.
- [ ] **Enrolment → death duration** — already shown, keep.

### 4.3 Future / phase-2 analytics (separate discussion)

- [ ] **Impact metrics** — track **ESAS** and **PPS** score trends over time per patient and in aggregate, to evaluate clinical impact. Needs a dedicated conversation with the clinical team to define what "improvement" looks like and which sub-scores matter most.

---

## 5. Patient Summary Document — Required Format

This is the format the client has shared. The Patient AI Summary + downloadable PDF
should be templated to output this structure (replaces the current free-paragraph
summary).

> **Basic Patient Details**
> - Patient Name
> - UHID
> - Homecare ID
> - Age / Sex
> - Address
> - Phone Number
> - Primary Caregiver details
> - Date of Registration
>
> **Clinical Details**
> - Diagnosis
>
> **Present Complaints**
>
> **Functional Assessment**
> - ESAS and Performance Status
>
> **Nursing Assessment**
>
> **Psychosocial Assessment**
> - Psychological Distress
>
> **Physiotherapy Assessment**
>
> **Homecare Visit Details** (table)
> - Date · Team Members · Findings · Interventions Done · Plan of Care
>
> **Follow-up visit summary** (shared by client — populated per visit)

**Implementation notes:**
- Map each section to the existing form data + AI summary outputs.
- "Diagnosis" pulls from the renamed Doctor Assessment field (§3).
- "ESAS and Performance Status" pulls from the functional assessment / PPS data already collected.
- "Homecare Visit Details" is a chronological table — same data the "Past Records" section will hold (§2.2).
- "Follow-up visit summary" maps to the per-visit follow-up AI summary (§2.2). Cumulative log appears under this section.
- PDF download should render this exact layout.

---

## 6. Next Steps & Action Items

### Dev team (Farzad / Aneesh) — for next demo
- [ ] Functioning **inbound + outbound** voice call flow (live demo).
- [ ] WhatsApp / SMS / email message delivery status (delivered / not delivered) surfaced in the tool.
- [ ] **Database cleanup** completed before users start entering live data.
- [ ] Update the team WhatsApp group when cleanup is done.
- [ ] Apply all analytics widget renames + add missing metrics from §4.2.
- [ ] Per-visit follow-up summary + separate follow-up body map (§2.2).

### Clinical (Dr. Ashwini)
- [ ] Share **summary format template** for Patient AI Summary (the template in §5 is the starting point — confirm / refine).
- [ ] Send latest patient data after Satish finishes entering it.

### Scheduling
- [ ] **Next meeting: early next week (Mon/Tue)** — after Anvita returns Sunday.
- [ ] **Hold off on live patient data entry** until next week, per Farzan, to ensure everything is ready post-cleanup.

---

## 7. Open Questions

1. Is the **per-fallback ring count** configurable on the inbound master-number routing? (§1.1)
2. Confirm whether "alternative mobile number" already maps to caregiver, or if a new picker field is needed. (§1.2)
3. Final structure for the Patient AI Summary — paragraph vs structured (§5 template). Awaiting Dr. Ashwini's confirmation.
4. Definition of "Patients Seen" — needs Farzad's check (§4.1).
