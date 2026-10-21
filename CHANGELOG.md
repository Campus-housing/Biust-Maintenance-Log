# Changelog

The full story of how this app came to be, in order, plus where it can go from here. See [README.md](./README.md) for the overview and [DOCUMENTATION.md](./DOCUMENTATION.md) for the technical reference.

## Where it started

The maintenance team was running everything through a WhatsApp group called "MAINTENANCE&FACILITIES" — reports, room numbers, contact numbers, and "done" replies all mixed into one long thread. Nothing was searchable, nothing was structured, and there was no record of what had actually been fixed. The starting question was simple: *is there a way to report maintenance issues in a more structured way?*

## v1 — A ticket tracker, inside Claude

The first version was a React artifact: a "work-order tag" styled ticket board with a Block/Room/Category/Description form, a live status board grouped loosely by status, and shared storage so a small group could use the same link. It covered BPC, Fengyue 3/4, and a placeholder set of blocks, based on the WhatsApp screenshots that kicked things off.

**Refined further:** the block list grew to match BIUST's actual accommodation (1–6, A–F, Sekgoma 1–4, Fengyue 1–4, Old/New Main Boys/Girls), tickets auto-archived a week after being marked Done, photos and an urgent flag became optional fields, and a submit bug was traced to the browser's native form validation silently failing inside a scrolling panel — fixed with proper inline error messages instead.

## v2 — Standalone, off Claude entirely

Once it was clear this needed to work for people who weren't in a Claude conversation, the whole thing was rebuilt as a single static HTML file with vanilla JavaScript — no framework, no build step — backed by Firebase (chosen over Google Sheets or a local-only version, for free real-time sync). The Firebase config was deliberately split into its own tiny `firebase-config.js` file so setup meant pasting keys into an 8-line file, not hunting through 500 lines of app code. A full step-by-step Firebase setup walkthrough was written to go with it.

Once live on GitHub Pages, three more things landed: tickets grouped into collapsible sections by block instead of one long feed, status changes became a deliberate two-step confirm instead of a single risky tap-to-cycle, and BPC was added to the block list.

## v3 — Real accounts and real permissions

This was the biggest architectural jump: full Firebase Authentication, three roles (reporter, maintainer, admin), and Firestore security rules that actually enforce those roles server-side — not just hide buttons in the UI. Reporters see only their own tickets; maintainers see and update everything; admin does both plus manages accounts through an in-app **Manage** panel (using a second, isolated Firebase app instance so creating someone else's login doesn't sign the admin out of their own session). The very first admin account still needs one manual, one-time step — signing up, then hand-editing that one Firestore document to set `role: "admin"` — because there's no admin yet to grant that role through the app.

## v4 — Feedback loop and cleanup

Reporters gained the ability to delete their own ticket while it's still Pending (locked once a maintainer picks it up), and a lightweight notes thread was added so a maintainer could leave feedback ("bulbs out of stock, ordered more") that the reporter can actually see — enforced so a reporter's own edits can *only* ever touch the notes field, never sneak in a status change. The photo-upload "low memory" issue was traced to the app reading an entire original high-resolution photo into memory as base64 text before shrinking it; switched to `createObjectURL`, which avoids that step entirely. Admin also gained a CSV export.

## v5 — Documentation and real screenshots

A README and a full DOCUMENTATION.md were written, along with five actual screenshots of the running app — not mockups. They were produced by serving the real, unmodified app file through a headless browser with a small set of hand-written fake Firebase modules standing in for the real SDK, so every pixel shown is the genuine app, just fed sample data instead of live traffic.

## v6 — Growing beyond dorms

The app was renamed to **BIUST Maintenance & Facilities Log**, campus facilities (Student Center, Admin, Engineering Block, Science Block, Primary, Refectory) joined the residential block list, it became installable as a PWA (manifest, service worker, app icons — add it to a home screen like a native app), and a public, no-login-required read-only status board was added for accountability — deliberately backed by a separate, stripped-down `publicBoard` collection containing no reporter names, contact numbers, photos, or notes, because Firestore rules can't hide individual fields within a single document, only grant or deny the whole thing. A "Continue with Microsoft" option was also added at this stage.

## v7 — Specialization, oversight, and gatekeeping (current)

The most recent round tightened who can do what, in three ways:

- **Maintainers now have a specialty.** An electrician assigned to "Electricity" genuinely cannot read or act on a plumbing ticket — enforced in the security rules, not just filtered in the UI.
- **A new supervisor role** was introduced for oversight: full visibility across every category, plus a **Summary** panel (a per-location breakdown table covering every block and facility, even ones with nothing reported) and CSV export — but no ability to change any ticket's status.
- **Residential reporting became RA-gated.** For a residential block, only the reporter(s) assigned as that block's RA can submit a ticket for it (a block can have more than one RA); campus facilities remain open to any reporter. This mirrors how the original WhatsApp workflow actually worked — RAs relaying issues on behalf of their block.

The Microsoft sign-in button and code were removed again at this stage, to be reintroduced later once it's worth the Azure AD setup involved.

## v8 — React rewrite

The whole app moved from one hand-written HTML/JS file to a proper React + Vite project — same Firebase project, same three Firestore collections, same security rules, but real components (`src/components/`, one file per screen), a shared auth context instead of scattered global variables, and a `useTickets` hook for the role-aware live subscription.

Deployment changed with it: instead of manually uploading a built file to GitHub, a GitHub Actions workflow (`.github/workflows/deploy.yml`) now builds and deploys automatically on every push to `main`. The one manual step was switching GitHub Pages' source from "Deploy from a branch" to "GitHub Actions" — after that, it's just edit-commit-push.

Before handing it over, the rewrite was verified two ways: a real production build (`npm run build`, 53 modules, zero errors) confirmed it compiles cleanly, and a second test build with fake Firebase data swapped in was screenshotted clicking through login, the RA view, the admin board, ticket detail, and the Manage panel — every screen came back pixel-identical to the version it replaced.

## v9 — More categories, search that actually works

Categories grew from four to seven: Electricity, Plumbing, Carpentry (renamed from Furniture — same internal id, so nothing existing broke), Access/Other, Transport, WiFi, and Inventory.

Search got a real fix, not a tweak: searching "room 20" previously found nothing, even when Block F Room 20 and Block D Room 20 both existed — because the stored data was always just "F" and "20" separately, never the literal word "room," so the old exact-phrase match could never succeed. Search now strips filler words ("room," "block," etc.) and matches each remaining word on its own, so "room 20" correctly finds both, and "block f room 20" correctly narrows to just the one.

## v10 — Themes, an audit trail, and a whole new intake pipeline

The biggest functional round since the role system itself:

- **Dark/light mode**, remembered across visits, defaulting to the device's own preference the first time.
- **Confirmation toasts** after actions — submit a ticket, post a note, change a status — instead of the app just silently returning to a list.
- **Automatic status-change history.** Every status change now logs itself into the same notes thread ("🔄 Status changed to In Progress"), shown in italics to separate it from what people actually typed — a real audit trail without anyone needing to remember to write one.
- **Students can report without an account.** A new `submissions` collection accepts reports with no login at all — deliberately kept separate from `tickets` so a stream of one-time student reporters never bloats the `users` collection with throwaway accounts.
- **RAs review before anything's official.** Whoever's the RA for that block (or admin, for any block) gets an **Inbox** of pending submissions, can edit any field, then accept (which creates a real ticket under their name) or decline. Maintainers and supervisors were deliberately left out of this — neither had been given ticket-creation authority before, and extending it here wasn't asked for directly.
- **Bulk import**, for the "100 issues at once" problem the original WhatsApp group actually had. Paste free text, one issue per line, and it's parsed into draft entries (best-guess category, room, phone number); or upload a CSV/Excel file for a more reliable structured version. Either way, every row is reviewed and confirmed before anything is actually submitted, and it all lands in the same Inbox as a single no-login report.

This round shipped without a live build check — the npm registry was blocked in the sandbox environment the entire session. In its place: careful manual review of every changed file, and an explicit heads-up that it needed real testing after deploying. A lockfile mismatch was also caught and fixed before it could break future deploys: earlier troubleshooting had removed `package-lock.json`, which would have silently broken the GitHub Actions build the next time it ran, since it was using `npm ci` (which requires that file to exist). Switched to `npm install`, which doesn't.

## v11 — Semesters, resolution analytics, and the first real build check in a while

- **Semesters.** Tickets are stamped with a semester; the board and Summary are scoped to a selectable semester (defaulting to the current one). Open tickets from earlier semesters carry over automatically and are tagged, so when Semester 2 starts nothing needs migrating. Semester 2's start date is a placeholder to be confirmed.
- **Resolution-time analytics.** Average, median, % fixed within 48h, averages by category and location, and the longest-waiting open tickets. Excel export gained `Resolution (hours)` and `Semester` columns.
- **Accurate dates for accepted submissions.** A ticket created by accepting a student submission now keeps the original submission time as `reportedAt` (the accept time is kept separately as `acceptedAt`), so resolution times reflect the student's real wait.
- **Contact details in bulk import.** A parsed phone number was saved but never shown; the review step now has an editable "Access contact" field, and the RA's Inbox shows the contact on the collapsed card.
- **Supervisor notes** fixed in the rules (they were being rejected for supervisors on tickets they don't own).
- **Docs fix.** An earlier docs edit had accidentally deleted the "Microsoft sign-in — removed for now" heading in DOCUMENTATION.md; restored.
- **Verification.** npm was reachable again, so this round was actually built (64 modules, no errors), linted (0 errors; 13 warnings repo-wide, 7 in `src/`), and exercised by a new headless smoke test with fake Firebase (9/9 checks: semester selector, analytics maths, carry-over into Semester 2, no page errors). This also retroactively confirms that the earlier unverified rounds (themes, toasts, submissions, bulk import, charts) compile. The handover zip itself was then re-verified from a clean extraction (`npm ci`, build, lint, smoke). `npm audit` reports 5 high-severity advisories (chiefly `xlsx`), recorded in HANDOVER.md.

## v12 — Built to replace the SharePoint tracker

The owner shared the real tracker; it was read in full (formulas, dropdown validations, all six charts) and compared against the app feature by feature (`docs/TRACKER-PARITY.md`). Result: every function has an equivalent, and the gaps that existed were closed.

- **New dashboard.** The board opens as two tiles, *Residences* and *Campus facilities*; each opens a menu of its places with counts, and each place opens its reports. Searching auto-opens matches. The status tiles are now tappable filters. Locations read "Block 4"; blank rooms read "Common area".
- **Closed the tracker gaps.** Room is optional with one-tap common-area chips; room autocomplete per location (from the tracker's own lists); one-tap common-issue wording per category; live "⏱ open 24d" ageing on open tickets; Days Open in the export.
- **Analytics parity and beyond.** Summary gained a KPI row, speed bands (Fast/Normal/Slow/Critical), monthly volume and resolution trends, and a per-location view with that location's RA(s). Admins get an RA-coverage panel (the tracker itself has no RA for Block E).
- **Legacy importer** (`tools/import-legacy/`): inspect + dry-run-first import preserving original dates, statuses and `C-###` ids. Dry run on the real file: 328 calls, 86 closed / 242 open, average 19.9 days to fix, all Semester 1. The `--commit` path is untested against real Firebase.
- **Two bugs in my own earlier work, found and fixed.** (1) Bulk import silently dropped any row missing a location or room and then showed a "Thanks!" screen — those reports were lost; now it refuses to submit until every row has a location, and keeps unsent rows after a partial failure so retries never duplicate. (2) The text parser turned a code like `F27` into the location "F", which is a real block (Block F) — but in the tracker `F27` is a floor code inside Old Main Boys, so reports would have been misfiled. A bare code is now a room and the location is left for the reviewer.
- **Verification:** build 69 modules, 0 errors; lint 0 errors (16 warnings repo-wide, 7 in `src/`); smoke test extended to 26 checks (dashboard drop-downs, search auto-open, status tiles, blank-room ticket, KPIs, bands, trends, drill-down with RA, semesters), all passing.

## How the app has improved

| | v1 (Claude artifact) | Now |
|---|---|---|
| Where it lives | Inside a Claude chat | Standalone, hosted, installable |
| Codebase | N/A | React components, auto-built and deployed by GitHub Actions |
| Who can use it | Whoever has the Claude link | Real accounts, real roles, public read-only option, no-login reporting |
| Who can report what | Anyone, anywhere | RA-gated for residential blocks; open for facilities; anyone via the no-login intake queue |
| Who sees what | Everyone sees everything | Scoped by role and, for maintainers, by specialty |
| Status changes | Tap to cycle (easy to fumble) | Explicit select + confirm, auto-logged to a history thread |
| Feedback to reporter | None | Notes thread + automatic status history |
| Oversight | None | Supervisor role + per-location summary sheets |
| Intake | One long WhatsApp thread | Structured form, or bulk paste/CSV import reviewed before anything's official |
| Record-keeping | None | Excel export, 7-day auto-archive, full audit trail in Firestore |
| Look and feel | Fixed dark theme | Dark/light toggle, confirmation toasts |
| Reporting on performance | None | Resolution-time analytics, semester views with automatic carry-over |
| Replacing the SharePoint tracker | — | Every tracker function covered (docs/TRACKER-PARITY.md) + importer for its history |
| Setup | N/A | One README + one DOCUMENTATION.md, step by step |

## Where to take it next

Roughly in order of what's likely to matter first — the full detail on each is in [DOCUMENTATION.md's Roadmap](./DOCUMENTATION.md#roadmap):

1. **Reintroduce Microsoft sign-in**, gated to `@biust.ac.bw` — needs BIUST ICT to register an app in Azure AD.
2. **Move hosting to Firebase Hosting** instead of GitHub Pages — same free tier, one less service, a proper domain.
3. **Real Firebase Storage for photos** instead of base64-in-Firestore, removing the ~1MB per-ticket ceiling as photo use grows.
4. **Automated notifications** — a maintainer pinged the moment a matching ticket lands, a reporter notified the moment a note appears — needs Cloud Functions and the Blaze plan (a card on file, very unlikely to actually cost anything at this scale). Email via Firebase's "Trigger Email" extension is the lowest-effort first step; push notifications or SMS/WhatsApp are bigger lifts again.
5. **Refine the RA model** if it turns out a block needs a "primary" RA versus backups, or if RA assignment ever needs its own audit trail.
6. **Use the React migration to add real polish** — smoother transitions, drag-and-drop, whatever comes to mind — now that the codebase is structured for it instead of one long file of manual DOM updates.
7. **Regenerate the README screenshots** — they still show the pre-v9 app (old categories, no theme toggle, no Inbox). The smoke-test harness in `tools/smoke-test/` can produce fresh ones.
8. **Run the legacy import for real** (`--commit`, with a service account) and retire the SharePoint tracker.
9. **Deeper analytics** — who resolved what, time to first response, trends over time.

Nothing here is required to keep using the app as it stands today — this is a list of what would make it better, not what's broken.
