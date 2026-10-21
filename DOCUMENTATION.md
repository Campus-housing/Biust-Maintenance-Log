# Documentation

Full technical reference for the BIUST Maintenance & Facilities Log. See [README.md](./README.md) for the quick overview and screenshots.

## Contents

- [Architecture](#architecture)
- [Full setup, step by step](#full-setup-step-by-step)
- [Deployment (GitHub Actions)](#deployment-github-actions)
- [Data model](#data-model)
- [Security rules](#security-rules)
- [Roles, in detail](#roles-in-detail)
- [Student submissions & review queue](#student-submissions--review-queue)
- [Bulk import](#bulk-import)
- [Dark/light mode](#darklight-mode)
- [Semesters](#semesters)
- [Resolution analytics](#resolution-analytics)
- [The board (dashboard)](#the-board-dashboard)
- [Rooms, common areas and quick picks](#rooms-common-areas-and-quick-picks)
- [Importing the legacy tracker](#importing-the-legacy-tracker)
- [Microsoft (Azure AD) sign-in — removed for now](#microsoft-azure-ad-sign-in--removed-for-now)
- [Installing as an app (PWA)](#installing-as-an-app-pwa)
- [Adding staff and setting up RAs](#adding-staff-and-setting-up-ras)
- [Summary sheets](#summary-sheets)
- [Exporting data](#exporting-data)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Architecture

The app is a React + Vite project, built and deployed automatically by GitHub Actions — you push source code, GitHub builds it, nobody needs Node.js installed locally. There is still no backend server of our own; everything talks directly to Firebase from the browser, same as the original single-file version:

- **Firebase Authentication** handles login (email/password).
- **Cloud Firestore** stores four collections: `tickets` (the real data), `users` (who has which role, plus a maintainer's specialty or a reporter's assigned RA blocks), `publicBoard` (a deliberately stripped-down public copy of tickets, for the no-login status view), and `submissions` (raw, no-login reports waiting for an RA or admin to review before they become real tickets).
- Firestore's real-time listeners (`onSnapshot`, wrapped in the `useTickets` hook) mean changes appear live for everyone looking at the same data — no refresh needed.
- Photos are compressed client-side (resized, JPEG-compressed) and stored as base64 text directly inside the ticket document, rather than a separate file-storage service. This keeps the architecture simple at the cost of a ~1MB ceiling per ticket (Firestore's document size limit) — comfortably enough for a single compressed phone photo.

The UI itself is a set of components under `src/components/` (one file per screen/piece — board, ticket detail, admin panel, etc.), with shared state for auth/role/specialty/RA-blocks in `src/contexts/AuthContext.jsx`.

Because there's no server *of ours*, anything that needs to happen automatically in the background (auto-notifications, scheduled digests) isn't possible yet without adding Cloud Functions — see [Roadmap](#roadmap).

## Full setup, step by step

### 1. Create the Firebase project
[console.firebase.google.com](https://console.firebase.google.com) → **Add project** → any name → Google Analytics can be skipped. Free (Spark) plan, no card required.

### 2. Turn on Firestore
Build → **Firestore Database** → Create database → pick the closest region → **Start in production mode** (rules are set manually below).

### 3. Turn on Email/Password sign-in
**Authentication** → Sign-in method → **Email/Password** → Enable → Save.

### 4. Register a web app
Project settings (gear icon) → Your apps → `</>` icon → any nickname → skip Firebase Hosting → Register. Copy the `firebaseConfig` object it shows you.

### 5. Fill in `src/firebaseConfig.js`
Open the file, paste your config between the `{ }`, replacing the placeholder values. Nothing else in the project needs to change, and no other file needs editing.

### 6. Publish the security rules
Firestore Database → **Rules** → replace everything with the rules in [Security rules](#security-rules) below → Publish.

### 7. Host it
Push the whole project to a GitHub repo, then Settings → Pages → **Source** → change from "Deploy from a branch" to **"GitHub Actions"**. Push to `main` and check the Actions tab — GitHub installs dependencies, builds, and deploys automatically, about a minute end to end. See [Deployment (GitHub Actions)](#deployment-github-actions) for how the pipeline itself works.

### 8. Bootstrap yourself as admin
This is the only manual, one-time step in the whole system — every account after this is created through the app itself.

1. Open the live link and **sign up** with your own email and a password, like anyone else would. This creates your account with the default `reporter` role.
2. Firestore Database → Data → `users` collection → find the document whose `email` field matches what you just signed up with.
3. Change its `role` field from `"reporter"` to `"admin"`. Save.
4. Reload the app — you'll now see a **Manage** button.

### 9. Add staff — maintainers and supervisors
From here on, no more console work: tap **Manage** → fill in a name, email, temporary password → pick **Maintainer** or **Supervisor** → for a maintainer, also pick their specialty → **Create account**. Share the login details with them directly (WhatsApp, in person). They can change their password after logging in.

### 10. Set up RAs
For residential blocks, only the assigned RA(s) can submit a report — this keeps reporting authority tied to someone accountable, mirroring how the old WhatsApp group actually worked. Once someone has signed up as a reporter (self-serve, like anyone else), open **Manage**, tap their row in the account list, tick the block(s) they're RA for (a block can have more than one RA), and **Save blocks**. They'll see those blocks as "Your Block(s)" the next time they open the report form.

---

## Deployment (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push to `main`: it checks out the code, installs dependencies (`npm install`), runs `npm run build` (Vite), and publishes the resulting `dist/` folder to GitHub Pages via `actions/deploy-pages`. Nobody needs Node.js installed locally — GitHub's own servers do the building.

*(It uses `npm install` rather than `npm ci` deliberately — `npm ci` requires a `package-lock.json` to already be committed, and this project doesn't currently ship one. `npm install` works either way, generating one on the fly if it's missing.)*

This only works once **Settings → Pages → Source** is set to **GitHub Actions** rather than "Deploy from a branch" — that's the one manual switch (see [setup step 7](#7-host-it)). Once it's set, every future change is just: edit source, commit, push — the live site updates itself a minute or so later.

`vite.config.js` sets `base: '/Biust-Maintenance-Log/'` — this has to match the repo name exactly, since GitHub Pages serves a project site from that subpath. If the repo is ever renamed, this line needs to change too, or the built site will load a blank page with 404s for its own JS/CSS (the browser looks for assets at the wrong path).

To preview changes locally before pushing (optional — not required):
```
npm install
npm run dev     # local dev server, hot reload
npm run build   # same build Actions runs, output in dist/
```

---

## Data model

### `tickets/{ticketId}`

| Field | Type | Notes |
|---|---|---|
| `code` | string | Short human-readable tag, e.g. `BPC-49-K3P9` — not the Firestore document ID |
| `block` | string | Location — one of the values in the app's location list |
| `room` | string | Free text |
| `category` | string | `electricity` \| `plumbing` \| `furniture` \| `access` \| `transport` \| `wifi` \| `inventory` (label shown as "Carpentry" for `furniture`, kept as the old id so nothing existing breaks) |
| `description` | string | What's wrong |
| `reportedBy` | string | Display name, editable at submission time |
| `contact` | string | Optional access/contact phone number |
| `urgent` | boolean | | 
| `photo` | string \| null | Compressed image as a base64 JPEG data URL |
| `status` | string | `pending` \| `in_progress` \| `no_access` \| `done` |
| `reportedAt` | ISO string | |
| `resolvedAt` | ISO string \| null | Set when status becomes `done`; drives the 7-day auto-archive |
| `reportedByUid` | string | The reporter's Firebase Auth UID — what makes "my reports" and delete permissions work |
| `notes` | array | `{ text, byName, byRole, at, isSystem? }` objects, appended via `arrayUnion`. Status changes append one of these automatically (`isSystem: true`), shown in italics, alongside anything a person types |
| `semester` | string | Id of the semester the ticket was created in (e.g. `2026-27-S1`), stamped at creation. Older tickets without it are placed by their `reportedAt` date |
| `acceptedAt` | ISO string | Only on tickets created by accepting a student submission — when the RA/admin accepted it. For those tickets `reportedAt` is the *original* submission time, so resolution times measure what the student actually experienced |
| `importedFrom` / `legacyRef` | string | Only on tickets imported from the old tracker: `legacy-tracker` and the sheet/row they came from (the original `C-###` id is the ticket `code`) |

### `users/{uid}`

| Field | Type | Notes |
|---|---|---|
| `email` | string | |
| `name` | string | |
| `role` | string | `reporter` \| `maintainer` \| `supervisor` \| `admin` |
| `specialty` | string | Maintainers only — `all` \| `electricity` \| `plumbing` \| `furniture` \| `access`. Controls which tickets they can see and act on |
| `assignedBlocks` | array of strings | Reporters only — which residential blocks they're the RA for. Empty for a reporter who isn't an RA; a block can appear in more than one reporter's list if it has multiple RAs |
| `createdAt` | ISO string | |
| `createdBy` | string | Present on maintainer/supervisor accounts — the admin's UID who created them |

### `publicBoard/{ticketId}`

A deliberately thin mirror of each ticket, keyed by the same document ID, kept in sync by the app whenever a ticket is created, its status changes, or it's deleted. Contains only: `code, block, room, category, description, status, urgent, reportedAt, resolvedAt`. No reporter name, contact number, photo, or notes — those stay behind login. This is what an unauthenticated visitor sees on the public status board.

*(This mirror exists because Firestore security rules can allow or deny a whole document, but can't hide individual fields within one — there was no way to let the public read "status" but not "phone number" off the same document.)*

### `submissions/{id}`

A raw, unreviewed report — created without any login, by a student reporting a single issue or by anyone bulk-importing a batch. Never shown on any board directly; only appears in the RA/admin Inbox until it's actioned.

| Field | Type | Notes |
|---|---|---|
| `block`, `room`, `category`, `description`, `contact`, `urgent`, `photo` | same shapes as on `tickets` | Whatever the submitter provided or the bulk parser guessed |
| `reportedBy` | string | Optional name the submitter typed |
| `rawText` | string | For bulk-imported rows only — the original pasted line or spreadsheet row, kept for reference during review |
| `submittedAt` | ISO string | |
| `status` | string | `pending` \| `accepted` \| `declined` |
| `reviewedBy` | string | UID of whoever accepted/declined it |
| `reviewedByName` | string | Their display name, for showing in the UI without a second lookup |
| `reviewedAt` | ISO string | |
| `linkedTicketId` | string | The resulting ticket's document ID, once accepted |

---

## Security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function myUser() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function myRole() { return myUser().role; }
    function isAdmin() { return isSignedIn() && myRole() == 'admin'; }
    function isMaintainer() { return isSignedIn() && myRole() == 'maintainer'; }
    function isSupervisor() { return isSignedIn() && myRole() == 'supervisor'; }
    function isReporter() { return isSignedIn() && myRole() == 'reporter'; }
    function isStaff() { return isAdmin() || isMaintainer() || isSupervisor(); }
    function mySpecialty() { return ('specialty' in myUser()) ? myUser().specialty : 'all'; }
    function myAssignedBlocks() { return ('assignedBlocks' in myUser()) ? myUser().assignedBlocks : []; }
    function isOwner() { return isSignedIn() && resource.data.reportedByUid == request.auth.uid; }
    function canSeeTicket(cat) {
      return isAdmin() || isSupervisor()
        || (isMaintainer() && (mySpecialty() == 'all' || mySpecialty() == cat));
    }
    function canManageTicket(cat) {
      return isAdmin() || (isMaintainer() && (mySpecialty() == 'all' || mySpecialty() == cat));
    }
    function isResidentialBlock(b) {
      return b in [
        'BPC','1','2','3','4','5','6','A','B','C','D','E','F',
        'Sekgoma 1','Sekgoma 2','Sekgoma 3','Sekgoma 4',
        'Fengyue 1','Fengyue 2','Fengyue 3','Fengyue 4',
        'Old Main Boys','Old Main Girls','New Main Boys','New Main Girls'
      ];
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isStaff());
      allow create: if isAdmin()
                    || (isSignedIn() && request.auth.uid == userId && request.resource.data.role == 'reporter');
      allow update: if isAdmin()
                    || (isSignedIn() && request.auth.uid == userId && request.resource.data.role == resource.data.role);
      allow delete: if isAdmin();
    }

    match /tickets/{ticketId} {
      allow create: if isSignedIn()
                    && request.resource.data.reportedByUid == request.auth.uid
                    && request.resource.data.status == 'pending'
                    && (
                         isAdmin() || isMaintainer() || isSupervisor()
                         || !isResidentialBlock(request.resource.data.block)
                         || (request.resource.data.block in myAssignedBlocks())
                       );
      allow read: if canSeeTicket(resource.data.category) || isOwner();
      allow update: if canManageTicket(resource.data.category)
                    || ((isSupervisor() || isOwner()) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['notes']));
      allow delete: if isAdmin()
                    || (isOwner() && resource.data.status == 'pending');
    }

    match /publicBoard/{ticketId} {
      allow read: if true;
      allow write: if isSignedIn();
    }

    match /submissions/{id} {
      allow create: if request.resource.data.keys().hasAll(['block','room','description','status','submittedAt'])
                    && request.resource.data.status == 'pending'
                    && request.resource.data.block is string
                    && request.resource.data.room is string
                    && request.resource.data.description is string
                    && request.resource.data.description.size() < 2000;
      allow read: if isAdmin()
                    || (isReporter() && resource.data.block in myAssignedBlocks());
      allow update: if (isAdmin() || (isReporter() && resource.data.block in myAssignedBlocks()))
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','reviewedBy','reviewedByName','reviewedAt','linkedTicketId']);
      allow delete: if isAdmin();
    }
  }
}
```

**What each rule is actually preventing:**

- A reporter can never read another reporter's ticket, even by calling Firestore directly from the browser console — `isOwner()` checks the document's own `reportedByUid`.
- A reporter can't fake a self-resolved ticket — `create` requires `status == 'pending'`.
- A reporter can only create a ticket for a residential block if that block is in their own `assignedBlocks` — i.e. they're the RA for it. Campus facilities (Student Center, Refectory, etc.) stay open to any signed-in reporter. Staff (maintainer/supervisor/admin) bypass this entirely.
- A maintainer with a specialty other than `all` can neither *read* nor *update* a ticket outside that category — `canSeeTicket`/`canManageTicket` both check it. A supervisor can read everything but `canManageTicket` deliberately excludes them, so they can never change a status even though they can see it.
- A reporter's *edit* of their own ticket can only ever touch the `notes` field — `diff(...).affectedKeys().hasOnly(['notes'])` — so there's no back door to sneak a status change through the notes box.
- Supervisors get the same notes-only allowance on *any* ticket (`isSupervisor()` in the update rule): they can leave a comment but can never change a status or any other field.
- Only an existing admin can create *another* user's account record (used by the Manage panel's staff-creation flow) or hand out any elevated role — self-signup is hard-locked to `role == 'reporter'`.
- `publicBoard` writes just require being signed in (any role) rather than ownership checks, since it only ever holds non-sensitive data — the real access control lives on the `tickets` collection.
- Anyone, logged in or not, can create a `submissions` document — but the shape is still checked (required fields present, description under 2000 characters), so it's not a completely unchecked write target even without an account attached.
- Only the RA for that specific block, or admin (for any block), can read or act on a submission — and even they can only ever touch the review-status fields (`status`, `reviewedBy`, `reviewedByName`, `reviewedAt`, `linkedTicketId`), never quietly rewrite what was actually reported.

## Roles, in detail

**Public (no login).** Tap "View status board without logging in" on the login screen. Read-only, no report button, no status changes. Reads from `publicBoard`.

**Reporter.** Default role for anyone who signs up. Sees only tickets where `reportedByUid` matches their own UID. Can submit tickets for any campus facility, but for a residential block only if admin has set them up as that block's RA (a block can have more than one). Can add notes to their own tickets, and delete them while still `pending` — once a maintainer has picked it up, deletion locks, enforced by the rule, not just the UI. If they're an RA for at least one block, they also get an **Inbox** showing pending student submissions for that block — see [Student submissions & review queue](#student-submissions--review-queue).

**Maintainer.** Created only through the admin's Manage panel. Assigned a specialty at creation (or "All categories") — an electrician set to `electricity` only ever sees electrical tickets, on the board and in search; everything else is invisible to them, not just hidden. Updates status through a two-step confirm (select the target status, then confirm) rather than a single tap.

**Supervisor.** Also admin-created. Sees the full board across every category, unfiltered — same visibility as admin — but cannot change any ticket's status or add it to their own action list; they're oversight, not hands-on. Gets the **Summary** panel: a per-location breakdown table plus CSV export.

**Admin.** Bootstrapped manually the first time (see [setup step 8](#8-bootstrap-yourself-as-admin)). Everything a maintainer and supervisor can do combined, plus the **Manage** panel: create maintainer/supervisor accounts, set a maintainer's specialty, set a reporter's RA blocks, and export CSV.

## Student submissions & review queue

Anyone can report an issue without an account, via "Report an issue without logging in" on the login screen. This writes to a separate `submissions` collection rather than `tickets` directly — it never appears on any board until someone reviews it.

The RA for that block (or admin, for any block) sees it in their **Inbox**, with a live count badge. Opening a submission shows an editable copy of every field — location, room, category, description, contact, urgent — pre-filled with whatever was submitted (or guessed, for bulk-imported rows). They can fix anything before deciding:

- **Accept** creates a real ticket, owned by whoever accepted it (their UID goes on it, same as if they'd reported it directly), and marks the submission `accepted` with a link to the new ticket. The ticket's first note is auto-logged: "Accepted from a student submission."
- **Decline** just marks it `declined` — no ticket gets created, nothing else happens.

Maintainers and supervisors don't see this Inbox at all — maintainers were never block-scoped, and supervisor is deliberately read-only everywhere else in the app, so neither was given a new create-a-ticket power here without that being asked for directly.

## Bulk import

Reached from the same no-login entry point, via "Multiple issues" instead of "One issue." Two ways in:

- **Paste text**, one issue per line — e.g. `F27 lights not working 071...` — and it's split line by line. Each line gets a best-guess: a leading code like "F27" (kept as a hint, *not* assumed to match a real location in this app — that '"F" and "S"' style shorthand is often a different scheme, like a floor or wing code, from whatever hall it's actually in), a trailing phone number, and a category guessed from keywords in the description (a rough dictionary — "tap"/"leak" → Plumbing, "chair"/"wardrobe" → Carpentry, and so on).
- **Upload a CSV or Excel file** instead, with columns named Location/Block, Room, Category, Description, Contact, Urgent (case-insensitive, any of those header names work). More reliable than free text since nothing needs guessing.

Either way, nothing is submitted yet — every parsed row shows up as an editable draft with a real location dropdown, so whoever's doing the import confirms or corrects each one (and can delete rows that aren't real issues) before sending the batch. All of it lands in the same `submissions` queue as a single no-login report, reviewed by the RA the same way.

## Dark/light mode

A toggle on the login screen and in the app header. Defaults to the device's own light/dark setting on first visit, then remembers whatever's picked (stored in `localStorage`) from then on.



## Semesters

Semesters are defined in `src/utils/constants.js` (`SEMESTERS`: id, label, short label, start date). A semester runs from its start date to the next one's start; the last is open-ended. The **current** semester is simply the latest one whose start date has passed — so the app rolls over by itself, no migration or admin action.

- Every new ticket is stamped with `semester`. Older tickets without the field are placed by their `reportedAt` date; anything before the first start date falls into the first semester.
- The board, stats, filters and Summary panel are scoped to the chosen semester (selector above the stats; "All semesters" is also available). Defaults to the current semester.
- **Carry-over:** a ticket created in an earlier semester that was still open when the chosen semester began appears in it too, tagged "↪ from S1 26/27". Resolved tickets stay in the semester they belong to. Nothing is copied or moved in the database — it is computed (`scopeToSemester` in `src/utils/helpers.js`).
- **Action needed:** Semester 2's start date (`2027-02-01`) is a placeholder. Edit it in `constants.js` once the real date is known; add new semesters by appending to the array.
- RAs' "my reports" list is not scoped (it always shows everything they filed). The Excel export includes a Semester column.

## Resolution analytics

In the Summary panel (admin + supervisor), scoped to the selected semester:

- **Average, median, and % fixed within 48 hours** — from `resolvedAt − reportedAt` on tickets marked Done.
- **Average resolution time by category and by location** (slowest first), with the number of tickets behind each bar.
- **Longest-waiting open tickets** — the five oldest unresolved tickets, in red once past a week.
- The Excel export has a `Resolution (hours)` column.

- **KPI row** (Total, Open, Closed, Avg fix) at the top of the Summary.
- **Speed bands** — how many fixes were Fast (≤2 days), Normal (3–5), Slow (6–10) or Critical (11+), with counts and percentages (the same bands the old tracker used).
- **Monthly trends** — reports per month, and average time to fix by the month reported.
- **View selector** — scope the whole Summary to one location: its KPIs, category pie, bands, trends, up to 15 longest-waiting open tickets, and that location's RA(s) (or "No RA assigned yet" in red).
- **RA coverage** (Manage panel) lists which of the 25 residences have an RA, and which have none.

Notes: a ticket that is reopened loses its `resolvedAt` and drops out of the averages until it is resolved again. The by-category pie and by-location bars count only *active* (non-archived) tickets, whereas resolution times include all resolved tickets, archived or not.

## The board (dashboard)

The board opens as two tiles — **Residences** and **Campus facilities** — each showing its report count, number of places with reports, and an urgent flag. Tapping a tile opens a menu of its places (reports-first, urgent and busiest first; places with nothing are listed in one muted line underneath). Tapping a place opens its reports. Nothing is rendered until opened, so it stays fast with hundreds of tickets.

- Searching opens every section and place that has a match, so results are never hidden behind a closed menu.
- The four status tiles above are filters: tap *Pending* to see only pending, tap again to clear (the status chips below stay in sync).
- Locations read "Block 4", "Block C", "BPC", "Fengyue 3" (internal ids stay `4`, `C`, …). Rooms read "Rm 17" / "Rm F27"; a blank room reads "Common area", and a named area ("Kitchen", "Ablution-R47") is shown as written.
- Every open ticket shows "⏱ open 24d", grey up to 2 days, amber to 5, red beyond.

## Rooms, common areas and quick picks

- **Room is optional.** Kitchens, laundries, ablutions, passages and outdoor areas have no room number. Leave it blank or tap a chip (Kitchen · Laundry · Ablution · Passage · Outside).
- **Room autocomplete** (`src/utils/rooms.js`) offers the valid rooms and named common areas for the chosen location, taken from the legacy tracker's validation lists (25 residences). It is a suggestion only — anything typed is accepted. Campus facilities have no list.
- **Common-issue chips** (`COMMON_ISSUES` in `constants.js`) fill the description with one tap per usual problem in the chosen category; electricity, plumbing, carpentry and inventory come from the tracker's own lists. Tapping several joins them with "; ".
- Bulk import: a bare code such as `F27` or `S3` becomes the **room** (`S3` → `S03` to match the lists) and the location is left for the reviewer. A location is only filled in when the text names one ("BPC", "Block 4", "Old Sekgoma 3", "Fengyue 2"). Rows still missing a location block the submit with a message instead of being dropped.

## Importing the legacy tracker

`tools/import-legacy/` imports a spreadsheet of past calls as tickets, keeping the original dates, statuses and ids. It was written against, and dry-run on, the real *BIUST Campus Housing Maintenance Tracker.xlsx* (328 calls, all Semester 1).

```
node tools/import-legacy/inspect.mjs <file.xlsx>          # shows sheets, columns and how each maps
node tools/import-legacy/import.mjs  <file.xlsx>          # DRY RUN: full report, writes nothing
node tools/import-legacy/import.mjs  <file.xlsx> --commit --service-account <key.json> --admin-uid <uid>
```

- The dry run reports tickets by status/category/semester/location, resolution times recomputed from the dates, longest-waiting open calls, skipped rows with reasons, unmapped locations, rows that need a look, and possible duplicates.
- Only sheets that have a header **and** a reported-date column are read, so dashboard sheets are never imported as data. Column names are matched flexibly (`FIELD_ALIASES` in `lib.mjs`); location aliases live in `aliases.tracker.json` ("Old Sekgoma 3" → "Sekgoma 3").
- `--commit` uses the Firebase **Admin SDK** with a service-account key (Firebase console → Project settings → Service accounts; never commit it; `npm install firebase-admin` inside the folder first). It bypasses the security rules — needed because the client rules only allow creating `pending` tickets. Documents have fixed ids (`legacy-c001`), so re-running overwrites rather than duplicates. It also writes the `publicBoard` mirror.
- Dates are read day-first (`--month-first` to change). The sheet's own "Resolution Time" column is ignored (it mixes units).
- **The commit path has not been run against a real Firebase project** — only the dry run is tested. Try it on a throwaway project or the emulator first.
- The spreadsheet contains personal data (contact numbers): keep it out of git (`legacy-data/` and `*.service-account.json` are git-ignored).

## Microsoft (Azure AD) sign-in — removed for now

An earlier version of this app included a "Continue with Microsoft" button. It's been removed at Thabiso's request while other pieces settle — the plan is to reintroduce it later, most likely gated to `@biust.ac.bw` accounts via Azure AD, which will need BIUST's ICT department to register an app in their Azure AD (Microsoft Entra ID) tenant. See the [Roadmap](#roadmap).

## Installing as an app (PWA)

`public/manifest.json` + `public/sw.js` + the two icon files make the app installable — Vite copies everything in `public/` into the build output as-is, so these don't go through the build process, just along for the ride. On Android/Chrome, visiting the site shows an install prompt (or it's available from the browser's menu). On iPhone, Safari → Share → Add to Home Screen. Installed, it opens full-screen with no browser bar and its own icon.

The service worker caches the app's own static files for faster repeat loads and basic offline resilience — it does **not** cache Firebase data, so viewing tickets still needs a connection.

The icons (`icon-192.png`, `icon-512.png`) are placeholders — a navy square with "M&F" in amber, matching the app's colors. Swap them for a real logo at any time by replacing the files in `public/` with the same filenames; nothing else needs to change.

## Adding staff and setting up RAs

See [setup step 9 and 10](#9-add-staff--maintainers-and-supervisors) — in short: admin → Manage → Create account (maintainer or supervisor, with specialty if maintainer); and for RAs, admin → Manage → tap a reporter's row → tick their block(s) → Save blocks. Account creation uses a second, isolated Firebase app instance internally so that creating someone else's login doesn't sign the admin out of their own session.

## Summary sheets

Admin and supervisor both get a **Summary** button (next to Manage, or on its own for supervisors). It shows a table with one row per location — every residential block and campus facility, even ones with nothing reported — and columns for Pending / In progress / No access / Done / Total, with a 🚩 marker on any row that has an active urgent ticket. The same panel has the CSV export.

## Exporting data

Summary panel → pick a location (or "All locations") → Download Excel. Also available as a quick "Export" button next to Log out for every role, exporting whatever's currently loaded for that person (an RA's own reports, a maintainer's specialty, or everything for supervisor/admin). Pulls from whatever's already in the browser, so it's instant and doesn't touch Firestore again. Uses [SheetJS](https://sheetjs.com) to produce a real `.xlsx` file — columns: Code, Location, Room, Category, Description, Status, Urgent, Reported By, Reported At, Resolved At, Notes.

## Troubleshooting

**`Firebase: Error (auth/configuration-not-found)`** — Authentication hasn't been fully turned on for the project. Double-check Authentication → Sign-in method → Email/Password is actually toggled on and saved, not just visited. The app now shows a plain-language version of this error instead of the raw Firebase message if it happens again.

**Photo upload says "low memory" or similar.** Very high-resolution phone camera photos can be heavy for a browser to decode, even though the final compressed size is small. The app uses `createObjectURL` rather than reading the whole original file into memory as text, which removes the biggest cause of this — but extremely large originals on very low-RAM phones may still be tight. If it keeps happening on a specific device, try a lower camera resolution/quality setting on that phone.

**A ticket doesn't show up on the public board.** Only tickets created *after* the `publicBoard` mirroring was added will have a matching public entry. Anything created earlier only exists in the main `tickets` collection (visible to maintainers/admin, not the public board).

**Rules changes don't seem to take effect.** Firestore rules can take a few seconds to propagate after clicking Publish — refresh and try again before assuming something's wrong.

**Site shows a blank white page after deploying.** Almost always a `base` mismatch in `vite.config.js` — it needs to be `/YourRepoName/` exactly, matching the GitHub repo name (case-sensitive). Check the browser console for 404s on `.js`/`.css` files, which confirms this.

**Pushed a change but the live site didn't update.** Check the **Actions** tab in the repo — either the workflow hasn't finished yet (give it a minute), or it failed (red X) and needs a look at the build log. Also confirm Settings → Pages → Source is actually set to "GitHub Actions" and not still "Deploy from a branch" — if it's on the old setting, pushes won't trigger a rebuild at all.

**A maintainer's specialty says "Furniture" somewhere or an old export shows it.** The category's *display label* was renamed to "Carpentry," but its internal id is still `furniture` on purpose — renaming the id too would have meant migrating every existing ticket and maintainer specialty. If you spot the old word anywhere it wasn't expected, it's a leftover label, not a data problem.

**A submission's location can't be found in the review dropdown.** Bulk-imported or freehand codes (like "F27") are a guess, not a real match — the reviewer always has to pick the actual location themselves. This is deliberate, not a bug: guessing wrong here would misfile a real ticket.

## Roadmap

Roughly in order of when they'd become worth doing:

1. **Reintroduce Microsoft sign-in**, gated to `@biust.ac.bw` via Azure AD — needs BIUST ICT to register the app; see the note in [Microsoft (Azure AD) sign-in](#microsoft-azure-ad-sign-in--removed-for-now).
2. **Move hosting from GitHub Pages to Firebase Hosting.** Same free tier, one less separate service, and a `*.web.app` domain (or a custom domain) with free SSL.
3. **Real Firebase Storage for photos**, instead of base64-in-Firestore — removes the ~1MB document ceiling as photo usage grows.
4. **Automated notifications** (maintainer pinged when a matching-category ticket appears; reporter notified when a note is added or status changes). Needs Cloud Functions, which needs the Blaze (pay-as-you-go) plan enabled — usage would very likely stay at $0 at this scale, but Google requires a card on file to turn Functions on at all. Firebase's "Trigger Email" extension is the lowest-effort path to real notifications (config over custom code); push notifications or SMS/WhatsApp are each a bigger lift again.
5. **Field-level tightening**, if this ever needs to handle more sensitive data — e.g. validating individual fields on ticket updates the way the `notes`-only rule already does for reporters.
6. **Multiple RAs per block, formalized further** — right now it's just "any reporter whose `assignedBlocks` includes this block"; if it's ever useful to distinguish a "primary" RA from a backup, that'd be a small schema addition.
7. **Import the legacy SharePoint tracker** ("BIUST Campus Housing Maintenance Tracker.xlsx") with original dates and statuses, then retire it. Needs the file exported and an Admin-SDK import script — see HANDOVER.md.
8. **Record who resolved a ticket** (`resolvedBy`) to enable per-maintainer performance analytics, and track time-to-first-response.

~~Move from a single HTML file to a proper component framework~~ — **done.** The app is now React + Vite, auto-built and deployed by GitHub Actions on every push. That migration is what unlocked the option to add real animations/transitions later, split code more cleanly as features keep growing, and made local development (`npm run dev`, hot reload) possible for the first time.
