---
name: VPS Migration Phase 17 — Training & Skill Matrix
description: Skills catalog, employee skill matrix with proficiency 1-5, training programs with enrollments and completion tracking
type: feature
---

Phase 17 adds Training & Skill Matrix to HRM.

Tables (migration 043_training_skills.ts):
- skills: dealer-scoped catalog (code, name, category, description, is_active)
- employee_skills: unique (employee_id, skill_id), proficiency 1..5, last_assessed, assessed_by
- training_programs: title, trainer, mode (in_person/online/hybrid), duration_hours, cost, dates, status
- training_enrollments: unique (program_id, employee_id), status (enrolled/in_progress/completed/dropped), score, completed_date, certificate_url

Backend (/api/training):
- Skills CRUD
- Employee skills: list, upsert (auto by employee+skill), delete, /matrix (pivot with avg/gaps stats)
- Programs CRUD (list includes enrolled_count via subquery)
- Enrollments: bulk enroll, update, delete

Frontend (src/pages/hrm/TrainingPage.tsx):
- Tabs: Skills Catalog, Skill Matrix (color-coded proficiency 1-5 cells, click cell to rate, sticky employee column), Training Programs
- Program detail dialog: enroll checkbox list (already-enrolled disabled), inline status/score/completed_date edits
- proficiencyLabel + color tiers (slate→orange→amber→green→emerald)

Navigation: route /hrm/training, sidebar link "Training & Skills" with GraduationCap icon, dealerAdminOnly.
