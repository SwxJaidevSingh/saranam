# Saranam Scheduling System - Implementation Plan

## Version: 1.0 | Date: March 2026

---

## What Is This System?

The Saranam Scheduling System is a **weekly visit planning and execution engine** for the palliative home-care program. It enables:

1. **Team Composition** - Create care teams (doctor, nurse, counselor, physio, social worker) assigned to a vehicle/ambulance
2. **Weekly Schedule Planning** - PO-SW builds a weekly schedule by assigning patients to specific visit days
3. **Approval Workflow** - Lead reviews, modifies, approves or sends back the schedule
4. **Execution Tracking** - Clinical team executes daily visits, marks completion/missed status
5. **Ad-Hoc Modifications** - Lead can insert/cancel visits mid-week
6. **Weekly Review** - Auto-generated metrics and review dashboard after each week

---

## Core Design Principles

1. **Configurable, Not Hardcoded** - Visit days, planning day, max patients, clusters - all admin-configurable
2. **Warnings, Not Blocks** - Yellow alerts when rules are bent, never hard-block decisions
3. **Auditability** - Every schedule change is logged (who, what, when, why)
4. **Patient-Centric Priority** - BSC patients always surface first
5. **Progressive Complexity** - v1 is manual planning with smart suggestions, no auto-generation

---

## User Roles in Scheduling

| Role | View | Create/Edit | Approve | Special |
|------|------|-------------|---------|---------|
| **Admin** | Everything | Everything | No (unless also Lead) | Configure settings, manage vehicles, clusters |
| **Lead** | All schedules, patients, review dashboard | Edit any schedule (even post-submission) | Yes - final authority | Approve/reject, modify team, override priority, ad-hoc visits |
| **PO-SW** | All schedules, all patients, team roster | Create & edit preliminary schedule | No | Submit for approval, manage on-call, flag exceptions |
| **Clinical Team** | Own schedule only ("My Visits This Week") | No | No | Mark visit complete/missed, add notes, flag status changes |

---

## How It Integrates With Existing Saranam Module

The scheduling system **wraps around** the existing PatientVisit system:

```
Scheduling System                    Existing Saranam Module
-------------------                  -----------------------
weekly_schedules
  schedule_days
    schedule_slots ──── visit_id ──► PatientVisit
      (patient scheduled)              NursingAssessment
                                       DoctorAssessment
                                       PsychologicalAssessment
                                       PhysiotherapyAssessment
                                       EsasScore / PpsScore
                                       PlanOfCare
```

When a scheduled visit is completed, the `schedule_slot.visit_id` links to the actual `PatientVisit` record where assessments are stored.

---

## Document Index

| # | Document | Content |
|---|----------|---------|
| 01 | [State Machine](./01-STATE-MACHINE.md) | Schedule lifecycle, state transitions, rules |
| 02 | [Database Models](./02-DATABASE-MODELS.md) | All tables, columns, relationships, constraints |
| 03 | [API Endpoints](./03-API-ENDPOINTS.md) | Backend routes, request/response shapes |
| 04 | [Frontend Screens](./04-FRONTEND-SCREENS.md) | All screens, layouts, components, interactions |
| 05 | [Team Management](./05-TEAM-MANAGEMENT.md) | Team composition, vehicle assignment, roster |
| 06 | [Patient Pool & Priority](./06-PATIENT-POOL.md) | Priority scoring, clustering, pool management |
| 07 | [Smart Assists & Alerts](./07-SMART-ASSISTS.md) | Warnings, hints, conflict detection |
| 08 | [Integration Points](./08-INTEGRATIONS.md) | Kit readiness, proactive calls, notifications |
| 09 | [Build Phases](./09-BUILD-PHASES.md) | Phased implementation roadmap |
