# HANDOVER — BIUST Maintenance & Facilities Log

Everything needed to pick this project up. Written at the end of a long chat-based build; the previous assistant worked in a sandbox with no access to the owner's Firebase project or GitHub repo, so **nothing here has been exercised against the real backend** (details in §4).

---

## 1. What this is

A shared, real-time maintenance-ticket system for BIUST campus housing and facilities. It replaces a WhatsApp group (and an Excel tracker on SharePoint) where reports, room numbers and "done" replies piled up unstructured.

- **Owner / admin:** Thabiso Kolojane (a BIUST Resident Assistant). Two supervisors and several RAs/maintainers are or will be users.
- **Live site:** https://yunghit.github.io/Biust-Maintenance-Log/ — repo `yunghit/Biust-Maintenance-Log`, GitHub Pages **source = GitHub Actions**.
- **Stack:** React 19 + Vite 8, Firebase JS SDK 12 (Auth email/password, Firestore), SheetJS `xlsx@0.18.5`, plain CSS. PWA (manifest + service worker). Free (Spark) Firebase plan. No backend of our own; no Cloud Functions.
- **Mobile-first**, dark/light theme, used mainly on phones.

## 2. Ground rules from the owner
- **"Do not remove any features or elements — we only keep adding or improving existing features."** (verbatim intent, most recent message). This is binding.
- The real goal of the current phase: **retire the SharePoint tracker** by importing its data and making this app the single system (see §9).
- State judgment calls explicitly; don't silently change policy (who can see/do what).

## 3. Roles and what each can do (enforced by `firestore.rules`)

| Role (id → label) | Can do |
|---|---|
| Public (no login) | Read the **public board** (`publicBoard`, a sanitised mirror: no reporter name, contact, photo or notes). Create **submissions** (raw reports) — single or bulk paste/CSV/Excel. |
| `student` (new) | **Self-signs up** on the Student tab (the only role that can). Reports are tied to their account; sees only their own reports on *My reports* (progress via the public board). Cannot read tickets or write anything else. |
| `reporter` → **RA** | Created by an admin (self sign-up now makes students). Sees only tickets they filed. Creates tickets for any campus facility, and for a residential block only if it's in their `assignedBlocks`. Adds notes to own tickets; deletes own while `pending`. If RA for ≥1 block: **Inbox** of pending submissions for those blocks — edit, accept (creates a real ticket owned by them) or decline. |
| `maintainer` | Admin-created, with a `specialty` (`all` or one category). Sees/updates only tickets in that category; status changes need an explicit select + confirm. Can create tickets anywhere. |
| `supervisor` | Admin-created. Reads every ticket; **cannot change status**; may add **notes** (notes-only update rule). Gets the Summary panel + Excel export. No Inbox. |
| `admin` | Everything: creates maintainer/supervisor accounts (via a secondary Firebase app so the admin isn't signed out), edits roles/specialties/RA blocks, accepts submissions for any block, deletes tickets, Summary + export. The very first admin is bootstrapped by hand-editing one `users` doc in the console (`role: "admin"`). |

Residential blocks = BPC, 1–6, A–F, Sekgoma 1–4, Fengyue 1–4, Old/New Main Boys/Girls. Campus facilities = Student Center, Admin, Engineering Block, Science Block, Primary, Refectory (open to any signed-in RA).

## 4. Current status and verification — read this

**State of the code (this zip):** feature-complete for everything listed in §5, including the latest round — the SharePoint-tracker parity work (new two-tile dashboard, room/common-area handling, quick picks, ageing, speed bands, trends, per-location view, RA coverage, legacy importer). The owner's live site already runs the semester round (seen in a screenshot); the tracker round has not been deployed.

**Verified (in the sandbox, latest round):**
- `npm run build` ✔ (82 modules, no errors).
- `npm run lint` ✔ 0 errors; 18 warnings repo-wide (9 of them in `src/`), none triaged.
- **Smoke test** (`tools/smoke-test/`) ✔ 73/73 against *fake* Firebase: the dashboard, desktop top bar, search, status tiles, room autocomplete (no duplicates), blank-room tickets, Summary KPIs/bands/trends/drill-down, semesters, **and the account journey**: Student/Staff tabs, weak/mismatched password rejection, student sign-up (record is role=student with no privileges, verification email requested), student report saved under their uid, wrong-tab sign-in refused both ways, admin creating an RA by invite (no password shared, reset email sent) and a maintainer by temporary password (forced change, policy enforced), admin-triggered reset email, activity log, deactivation (admin can't deactivate self; a deactivated account can't sign in), **common-area suggestions per location, and the WhatsApp import end to end** (parse an Android-format export, review, send with original dates, Accept all, re-import = no duplicates).
- **Rules tests** (`tools/rules-test/`, 19 tests: no self-promotion, student isolation, RA/maintainer/supervisor scoping, audit log, mail queue) are written and their dependencies load, but **have never been run** — the emulator can't be downloaded in the sandbox. **The rewritten `firestore.rules` is therefore unverified**; run them first.
- **Importer dry run** on the owner's real tracker: 328 tickets built, 86 closed / 242 open, all Semester 1, 176 empty rows skipped, no unmapped locations, one row flagged (C-502, blank status). **The `--commit` path has never run against Firebase.**
- **Clean-room check of this exact zip:** fresh extraction → `npm ci` ✔ (the committed lockfile is valid) → build ✔ → lint ✔ → smoke test ✔ 9/9.
- Earlier rounds (submissions/Inbox, bulk import, charts, theme, toasts) were only hand-reviewed when written, but they are inside the same successful build and the smoke test loads the app that contains them.

**NOT verified:**
- Anything against the **real Firebase project**: real auth, real Firestore queries, **security rules have never been run** (not even in the emulator). The `in`-query + rule combinations for RAs/maintainers are reasoned, not tested.
- Whether the latest rules are actually published on the live project. Two rule changes were issued late in the chat and the owner must have republished: (a) the `submissions` collection, (b) supervisor notes (`(isSupervisor() || isOwner()) && …hasOnly(['notes'])`). A supervisor was seen getting "Could not post that note" before (b).
- Whether this zip has been pushed/deployed. Unknown. The owner also edits `src/firebaseConfig.js` directly on GitHub — **pushing this tree's placeholder over it will blank the site ("Almost there" screen)**. Work from a clone of the real repo.

**First thing to do:** run the live checklist in §10 with real accounts.

## 5. Feature inventory (all must be preserved)

**Intake & tickets** — ticket form (location grouped dropdown, room, 7 categories, description, optional photo [client-side compressed to ≤700px JPEG], urgent flag, optional access contact); ticket codes like `BPC-49-K3P9`; notes thread; **automatic status-history notes** (italic, `isSystem`); delete-while-pending; status change via select + confirm bar; urgent tickets float to top with a flag.
**No-login intake** — "Report an issue without logging in": single issue (with photo) or **bulk**: paste lines (heuristic parser: leading code like `F27`, trailing phone number, keyword-guessed category, "urgent/asap") or upload CSV/XLSX (headers: Location/Block, Room, Category, Description/Issue, Contact/Phone, Urgent). Every parsed row is an editable draft (location dropdown, room, description, **access contact**, category, urgent, remove) before sending to `submissions`. Parsed location codes are *hints*, never auto-mapped to real blocks.
**Review** — RA/admin Inbox with live count badge; edit-then-accept or decline; accept creates the ticket (`reportedByUid` = accepter, first note "Accepted from a student submission", `reportedAt` = original submission time, `acceptedAt` = now) and links back (`linkedTicketId`).
**Board** — grouped by location in fixed order, collapsible, status/category/urgent chips, stats tiles, **natural-language search** (strips "room/block/…", matches each word: "room 20" finds Block F Rm 20 and Block D Rm 20), 7-day auto-archive of Done tickets (Archived chip), 💬 note counts, carried-over tag.
**Dashboard (tracker round)** — the board opens as two tiles, *Residences* and *Campus facilities*; each opens a menu of its places (urgent/busiest first, empty ones in one muted line) and each place opens its reports; search auto-opens matches; status tiles are tappable filters; locations read "Block 4", rooms "Rm 17", blank room "Common area". **Entry** — room optional, per-location room autocomplete (from the tracker's lists, `src/utils/rooms.js`), Kitchen/Laundry/Ablution/Passage/Outside chips, one-tap common-issue wording per category. **Tracker parity** — live "⏱ open Nd" ageing, Days Open in export, Summary KPI row, speed bands, monthly volume/resolution trends, per-location Summary view with RA names, RA-coverage panel in Manage. See `docs/TRACKER-PARITY.md`.
**Semesters** — selector (current / previous / "All semesters"); computed carry-over of open tickets (see §6).
**Oversight (admin + supervisor)** — Summary panel: pie by category, bars by busiest location, **resolution analytics** (avg, median, % fixed ≤48 h, avg by category and by location, 5 longest-waiting open tickets), full per-location table, Excel export by location. Quick **Export** button for every logged-in role exports exactly what that role has loaded (role scoping preserved).
**Admin** — Manage panel: create maintainer/supervisor (role + specialty), copyable "send this to them" message (no email is sent), account list with role/specialty/RA-block editor.
**Platform** — email/password auth with friendly errors + forgot password; identity card (name, role pill, specialty or RA blocks); dark/light toggle (persisted, follows system by default); toasts; installable PWA; public status board; Excel export via SheetJS.
**Accounts (accounts round)** — Student and Staff tabs on one login screen (wrong tab refused); students self-sign-up, verify email, and get *My reports*; admins create accounts of every role by email invite or temporary password (forced change), send password-reset emails for anyone, deactivate/reactivate, and read an activity log; Account panel (verify email, change password); password policy (8+, letter + number). **Look (visual refresh)** — desktop top bar, page header, colour-coded chips with line icons, card rows; custom room autocomplete (replaced the native datalist after a duplicate-data glitch).
**WhatsApp import** — Inbox → *Import from WhatsApp* (admin/RA): reads an exported chat (`src/utils/whatsapp.js`, `WhatsAppImport.jsx`) on-device; header-aware, keeps original dates/senders, marks probably-fixed rows, de-duplicates by `sourceKey`, sends to the Inbox; admin *Accept all*. No live WhatsApp link by design. **Common areas** — grouped first in the room box (`areasFor` in `rooms.js`; edit the arrays to taste).

## 6. Data model (Firestore)

- `tickets/{auto}`: `code, block, room, category (electricity|plumbing|furniture|access|transport|wifi|inventory), description, reportedBy (free text), contact, urgent, photo (base64|null), status (pending|in_progress|no_access|done), reportedAt, resolvedAt|null, reportedByUid, notes[{text,byName,byRole,at,isSystem?}], semester, acceptedAt?` — dates are **ISO strings**.
- `users/{uid}`: `email, name, role, specialty? (maintainer), assignedBlocks[] (RA), createdAt, createdBy?`.
- `publicBoard/{ticketId}`: `code, block, room, category, description, status, urgent, reportedAt, resolvedAt` — written by the client alongside every ticket create/status change/delete.
- `submissions/{auto}`: ticket-like fields + `rawText?, submittedAt, status (pending|accepted|declined), reviewedBy, reviewedByName, reviewedAt, linkedTicketId`.

**Semesters** are *computed*, not stored as documents: `SEMESTERS` in `src/utils/constants.js` (id, label, short, start date). Current = latest start ≤ now. `scopeToSemester()` (`helpers.js`) returns tickets created in the semester plus those created earlier that were unresolved when it began (tagged `_carriedFrom`). No migration is ever needed; legacy tickets without `semester` are placed by `reportedAt`; everything before the first start belongs to S1. **Semester 2's start (`2027-02-01`) is a placeholder — confirm with the owner and edit.** Per the owner, all current records are Semester 1, 2026/27.

**Resolution time** = `resolvedAt − reportedAt` for `status === 'done'`. Reopening sets `resolvedAt` to null (history lost; see backlog).

## 7. Key decisions and why (judgment calls — revisit only with the owner)

1. Role id `reporter` shown as "RA"; category id `furniture` shown as "Carpentry" — ids unchanged to avoid data migration / rule churn.
2. Residential reporting is **RA-gated** (mirrors how the WhatsApp group worked); students instead use the no-login queue.
3. Students need **no account** to avoid cluttering `users`; accepted via an RA who becomes the accountable owner.
4. Supervisors/maintainers are **not** in the Inbox; supervisors are strictly read-only on status (they got notes-only write later).
5. `publicBoard` is a separate sanitised collection because Firestore rules can't hide fields inside one document.
6. Maintainer specialty is enforced **in the rules**, not just the UI.
7. Staff accounts are created with a second Firebase app instance (`secondaryAuth`) so the admin stays signed in; passwords are shared manually (no email infrastructure).
8. Semesters computed, not stored → rollover is automatic and non-destructive.
9. Accepted submissions keep the *original* submission time as `reportedAt` so analytics reflect the student's real wait.
10. Hand-rolled SVG charts (the npm registry was unreachable when they were written; a library is now fine).
11. CI uses `npm install` (originally because no lockfile existed; a `package-lock.json` now exists, so `npm ci` is viable).
12. Config is a plain committed file (Firebase web config isn't secret; the rules are the security boundary).

## 8. Known issues and risks (honest list)

- **Rules untested** (emulator tests would be the best single investment).
- **Anonymous `submissions` create is open** (shape-validated, 2000-char cap, but no rate limit/App Check) → spam/abuse possible. `publicBoard` writes are allowed to any signed-in user (low sensitivity but tamperable).
- `npm audit` reports **5 high-severity advisories** (not triaged): `xlsx@0.18.5` — prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9), no fix published on npm, and parsing runs client-side on user-supplied files, so prefer SheetJS' own 0.20.x tarball or `exceljs`; plus a transitive chain firebase → @firebase/firestore → @grpc/grpc-js (a Node-side dependency, probably unreachable from the browser bundle — not verified).
- RAs' Inbox/count queries use `where('block','in', assignedBlocks.slice(0,10))` — Firestore `in` limits apply; a rule/query mismatch would surface as an empty inbox.
- Ticket `code` suffix is time-based, **not guaranteed unique** (it is not a key).
- Tickets accepted *before* the last round have `reportedAt` = accept time (analytics skew slightly). Backfill is possible from `submissions.submittedAt` via `linkedTicketId`.
- Service worker is cache-first-with-update: after a deploy users may see the old version until a second load. Consider a versioned cache / update prompt.
- Bundle ≈1.25 MB; code-split (`xlsx` is the big one, lazy-load on export/import).
- Dates as ISO strings (not Firestore Timestamps); no server-side timestamps → client clock skew can distort resolution times.
- No automated tests beyond the smoke test; no rules tests; 13 lint warnings.
- README screenshots predate categories/theme/Inbox (regenerate with the smoke harness).
- Photos are base64 in documents (1 MB ceiling).
- **Importer `--commit` is untested** against real Firebase (only the dry run is). Try an emulator/throwaway project first.
- The tracker calls the blocks "Old Sekgoma 1–4"; the app has "Sekgoma 1–4". They are aliased together — **confirm with the owner** there is no separate "New Sekgoma".
- The tracker itself lists **no RA for Block E**; the RA-coverage panel will show it too. RA names per block are in `docs/block-ra-assignments.md` (RAs must still sign up and be assigned in Manage).
- **New security rules are untested** (see §4). Roll-out order: publish the rules first/together with the app.
- Existing accounts that self-signed-up before the student role exist as "RA" (`reporter`); the owner should set the real students to *Student* in Manage.
- Sign-up is open to anyone with an email (no BIUST-domain restriction), verification is requested but not enforced, no inactivity logout, no MFA, no App Check — see DOCUMENTATION.md → Security model for the console checklist.
- Admins can *trigger* password resets but cannot *set* another person's password or revoke their sessions (needs Cloud Functions + Blaze). "New sign-in" alert emails are not built for the same reason; the optional Trigger Email path is wired but `MAIL_ENABLED` is `false`.
- The invite/login link in `AdminPanel.jsx` (`LOGIN_URL`) is hard-coded to the GitHub Pages address.
- The two-tile dashboard renders tickets only when a place is opened; if users ask for "everything at once" an expand-all control would be the natural addition.

## 9. The unfinished item the owner cares about most: retire the SharePoint tracker

**Update:** the workbook was received and read in full (formulas, validations, six charts). Everything it does has an app equivalent — see `docs/TRACKER-PARITY.md`. The importer exists and works in dry-run on the real file (numbers in §4); what remains is the real run, below.

The current system is an Excel workbook on SharePoint, "BIUST Campus Housing Maintenance Tracker.xlsx" (link was shared but is **behind BIUST sign-in and blocks automated access — the previous assistant could not read it**). Goal: import its history, then eliminate it.

Remaining blockers: a Firebase **service-account key** and the admin's uid from the owner, and agreement that the numbers in the dry run look right.

Remaining plan:
1. Owner confirms "Old Sekgoma" = Sekgoma, and decides whether to import all 328 (the dry run reports them) — including the one blank-status row.
2. Test `--commit` against the Firestore emulator or a throwaway project (see `tools/import-legacy/README.md`).
3. Run for real; spot-check counts per block/status against the sheet; check the board, Summary and public board.
4. Cut over: parallel-run briefly, make the SharePoint file read-only, brief the RAs, assign RAs per `docs/block-ra-assignments.md`.
5. If anyone relies on the tracker's report tabs, add matching Excel exports (the Summary already covers the six charts).

## 10. Live verification checklist (do first, with real accounts)
1. Republish `firestore.rules`; confirm no console rule errors.
2. Log in as admin; open Manage; confirm account list loads; create a test maintainer (specialty Electricity) and supervisor.
3. As an RA with assigned block: create a ticket for own block ✔; try another residential block ✘ (should fail with the helpful message); facility ✔.
4. Logged out: submit a single report and a bulk paste (3 lines incl. a phone number) → RA Inbox badge increments; contact visible on the card; accept → ticket appears with original date; decline another.
5. Maintainer(Electricity): sees only electrical tickets; status change creates an italic history note.
6. Supervisor: sees everything, can add a note (previously failed), cannot see status buttons.
7. Summary: charts + resolution stats render with real data; semester selector toggles; carry-over tag appears when viewing S2.
8. Export as each role; check Semester and Resolution (hours) columns.
9. Install as PWA on a phone; toggle dark/light.
10. Public board shows no names/contacts.
11. **Accounts:** publish the new rules; run `tools/rules-test`; sign up a student (check the verification email arrives), report an issue as them, confirm the RA's Inbox shows it and the student sees progress; create an RA by invite and a maintainer by temporary password (forced change works); try a student on the Staff tab and a staff member on the Student tab; deactivate an account and confirm it is locked out immediately; confirm a student cannot see any ticket; check the activity log.
12. In the Firebase console: email templates, enumeration protection, password policy, authorized domains, App Check (DOCUMENTATION.md → Security model).

## 11. Prioritised backlog
- **P0** Live verification (§10); confirm Semester 2 start date.
- **P1** Run `tools/rules-test` and fix anything it finds; publish the rules. Run the legacy import for real (§9). App Check + a BIUST-email restriction if desired. Rules unit tests (`@firebase/rules-unit-testing` + emulator). Abuse protection for anonymous submissions (Firebase App Check + reCAPTCHA, or a Cloud Function). Replace/upgrade `xlsx`.
- **P2** "New sign-in" and status-change emails (Blaze + Trigger Email / Functions), admin-set passwords and session revocation via Cloud Functions, inactivity logout, MFA for admin accounts. Analytics depth (owner asked for more): record `resolvedBy`/`resolvedByName` and `firstResponseAt` on tickets → per-maintainer performance, time-to-first-response, reopen rate, weekly trend lines, per-category SLA targets. Notifications (Cloud Functions/"Trigger Email" extension; needs Blaze plan). Firebase Storage for photos. Firebase Hosting/custom domain. Microsoft/Azure AD sign-in gated to `@biust.ac.bw` (needs BIUST ICT; a previous implementation was removed at the owner's request).
- **P3** Code-splitting, lint cleanup, SW update strategy, Firestore Timestamps, fresh screenshots, explicit "start new semester" admin tooling if automatic rollover ever proves insufficient.

## 11b. Queued by the owner (requested, NOT started)
1. **Full backup to Excel** that matches or beats the tracker (Dashboard with charts, block/category/month/speed-band tables, Calls sheet with the tracker's columns + ours, Notes, Submissions, Accounts, Audit, Lists). Plan: ExcelJS for styling + formulas, JSZip post-processing to inject native charts (copy chart XML structure from an XlsxWriter sample so Excel accepts it), lazy-loaded; admin button in Manage.
2. **Assigned-to and resolved-by** on tickets (self-assign for maintainers, admin picks a maintainer; stamp `resolvedBy` on Done; workload/performance analytics; Excel columns).
3. **Duplicate-report warning** when reporting a room that already has an open report of that category (use `publicBoard` so students/anonymous can be warned too).
4. **Attention list and SLAs** (per-category targets in constants; overdue/urgent/unassigned list on the dashboard; SLA compliance in Summary).
5. **Hotspots** (rooms/blocks with repeated faults; same room + same category repeats).
6. **Move photos** out of ticket documents — free path: separate `photos` collection loaded on demand + an admin 'move existing photos' action; Cloud Storage path behind a flag (note: new Firebase projects may need the Blaze plan for Storage).
7. **Stale app after a deploy**: build-stamped service worker, network-first for the page, an 'update available — refresh' banner.

## 12. Environment and process notes
- The previous assistant's sandbox **reset its working directory several times** and the **npm registry was blocked for most of the project** (so most rounds were unbuilt); it recovered by re-extracting the delivered zip. Don't assume anything outside this repo persists.
- The owner historically deployed by uploading files through the GitHub web UI and had trouble drag-dropping folders (hidden `.github` folder). Working from a real git clone eliminates that class of problem — but keep the web-UI instructions in the README accurate.
- Deploy: push to `main` → `.github/workflows/deploy.yml` (Node 20, `npm install`, `npm run build`, upload `dist/`, deploy-pages). `vite.config.js` `base: '/Biust-Maintenance-Log/'`.

## 13. Repository map
```
HANDOVER.md  CLAUDE.md  README.md  DOCUMENTATION.md  CHANGELOG.md  firestore.rules
package.json  package-lock.json  vite.config.js  index.html  .github/workflows/deploy.yml
public/            manifest.json, sw.js, icon-192.png, icon-512.png
src/
  main.jsx  App.jsx  index.css  firebase.js  firebaseConfig.js (placeholder)
  contexts/        AuthContext.jsx, ToastContext.jsx
  hooks/           useTickets.js, useTheme.js, useSubmissionsCount.js, useMediaQuery.js
  utils/           constants.js (blocks, categories, statuses, roles, SEMESTERS), helpers.js (incl. password policy), export.js, parseIssues.js, rooms.js (per-location room lists), audit.js (admin activity log), mail.js (optional email queue, off)
  components/      AccountPanel, AdminPanel, AreaChips, AuthScreen, BarChart, BoardList, ChangePasswordScreen,
                   Filters, IdentityCard, IssueChips, MyReportsList, PageHeader, PhotoOverlay, PieChart,
                   ResolutionStats, RoomField, SemesterSelect, StatsGrid, StudentHome, SubmissionForm,
                   SubmissionsPanel, SummaryPanel, ThemeToggle, TicketCard, TicketDetailModal,
                   TicketFormModal, TopBar, TrendChart, icons
tools/smoke-test/  vite.config.smoke.js, mocks/ (fake firebase), smoke.py (73 checks), out/ (screenshots)
tools/rules-test/  rules.test.mjs (19 security-rule tests — written, NOT yet run), package.json, firebase.json
tools/import-legacy/ lib.mjs, inspect.mjs, import.mjs (dry-run first), aliases.tracker.json, package.json
docs/              TRACKER-PARITY.md, block-ra-assignments.md
screenshots/       README screenshots (01–05 *-dashboard/summary* are current; the older 01–05 login/reporter/staff/detail/manage are from an earlier build)
legacy/            superseded implementations (single-file HTML version, original Claude artifact) — reference only
```

## 14. Documents in this package
- `README.md` — overview for users/GitHub; `DOCUMENTATION.md` — full technical reference (setup, data model, rules + rationale, roles, features, troubleshooting, roadmap); `CHANGELOG.md` — v1→v11 history and how the app improved.
- `firestore.rules` — the full current rules (identical to DOCUMENTATION.md's block). No rules changed in the tracker round.
- `docs/TRACKER-PARITY.md` — feature-by-feature comparison with the SharePoint tracker, its data-quality problems, and the dry-run numbers; `docs/block-ra-assignments.md` — block → RA table taken from the tracker.
