# Legacy tracker vs. this app — feature by feature

Source: *BIUST Campus Housing Maintenance Tracker.xlsx* (sheets: MASTER DASHBOARD, BLOCK DASHBOARD, MaintenanceCalls, DashboardData, Lists). Read in full, including formulas, dropdown validations and the six charts.

**Verdict: everything the tracker does, the app does — most of it better. Nothing in the tracker is left without an equivalent.**

| Tracker feature | In the app | Better how |
|---|---|---|
| One log of calls: Call ID, date reported, block, room, category, description, status, date closed, closing notes | Tickets with the same fields (imported calls keep their `C-###` ids as the ticket code) | Real-time for everyone, photos, urgent flag, access contact, a notes thread per ticket, automatic status history, no overwritten cells |
| Block dropdown | Location picker, grouped; blocks display as "Block 4" | Residences and campus facilities in separate groups on the board |
| **Room dropdown that depends on the block** (lists per block) | Room field autocompletes from the *same* per-block lists (`src/utils/rooms.js`, generated from the tracker's Lists sheet) | Still accepts anything typed; can be left blank for general areas; "Kitchen / Laundry / Ablution / Passage / Outside" one-tap chips. (15 of 328 tracker calls had no room.) |
| Category dropdown + per-category lists of common issues | 7 categories (Electricity, Plumbing, Carpentry, Access/Other, Transport, WiFi, Inventory) with one-tap common-issue wording per category | The tracker's own issue lists are built in, plus wording for the new categories |
| Status OPEN / CLOSED | Pending / In progress / No access / Done, changed through a confirm step | "No access" and "In progress" are real states; every change is logged with who and when |
| Days Open (formula) | "⏱ open 24d" on every open ticket, coloured by age; Days Open column in the Excel export | Always live, no recalculation, visible on the board itself |
| Resolution Time (hours) (formula) | Computed from the dates | Consistent — the tracker's column mixes units (call C-001 holds 22, i.e. days, where every other row is hours) |
| Reported day / month / year helper columns | Monthly charts, semester views | No pivoting needed |
| MASTER DASHBOARD KPIs (total, open, closed, average resolution) | Summary → KPI row | Scoped to a semester and to any single location |
| Chart: calls by block | Summary → busiest locations + full per-location table | Per-location counts of each status |
| Chart: calls by category (pie) | Summary → category pie | — |
| Chart: monthly trend of call volume | Summary → "Reports per month" | — |
| Chart: monthly trend of resolution time | Summary → "Average time to fix, by month reported" | — |
| Chart: calls by resolution-time band | Summary → "How fast problems get fixed" (same bands: Fast ≤2d, Normal 3–5d, Slow 6–10d, Critical 11d+) | Shows counts and percentages |
| BLOCK DASHBOARD: pick a block → its RA, KPIs, category chart, open calls with Days Open colouring | Summary → **View** selector: KPIs, category pie, speed bands, trends and up to 15 longest-waiting open tickets for one location, plus that location's RA(s) | RA names come from real accounts; shows "No RA assigned yet" in red |
| RA per block (BlockSummary table) | RA assignments on real accounts (Manage), **RA coverage** panel showing which of the 25 residences have no RA | The tracker itself has no RA for Block E — the panel flags that. See `block-ra-assignments.md` |
| Conditional formatting by days open | Age colours on cards and in lists | — |
| Excel as the working tool | Excel export per location/role | Adds Resolution (hours), Days Open, Semester columns |

## Things the tracker cannot do at all
Multi-user real-time editing without conflicts · roles and permissions (maintainer by specialty, supervisor read-only, RAs by block) · students reporting without an account · an RA review inbox · bulk paste/CSV import · photos · notes thread and automatic history · semesters with automatic carry-over · public status board · phone-friendly installable app · dark/light mode · search that understands "room 20" · protection against typos and overwritten formulas.

## Data-quality issues found in the tracker (the importer handles all of these)
- Resolution Time unit inconsistency (above) — the importer ignores the column and recomputes from dates.
- One row (C-502) has no status and no category — imported as open, flagged.
- 176 empty pre-formatted rows — skipped.
- Category value `'Electrical '` with a trailing space — normalised.
- Locations named "Block 4", "Old Sekgoma 3" — mapped to "4", "Sekgoma 3" (confirm "Old Sekgoma" = our Sekgoma blocks).
- Rooms like `F27`, `S23`, `G25` are floor codes inside Old Main Boys (zero-padded `F03` in the tracker's list) — kept as rooms, never treated as locations.

## Numbers the importer reports for the real file (dry run)
328 calls · 86 closed / 242 open · 22 Aug–14 Oct 2026, all Semester 1 · average 19.9 days to fix, median 11 days · 67% electrical · busiest: New Main Girls 65, BPC 57, Old Main Boys 48 · oldest open: 74 days (sockets, New Main Girls).
