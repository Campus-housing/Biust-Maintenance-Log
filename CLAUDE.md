# CLAUDE.md — BIUST Maintenance & Facilities Log

React + Vite + Firebase (Auth + Firestore) app that replaced a WhatsApp group for reporting and tracking campus maintenance at BIUST (Botswana). Deployed to GitHub Pages by GitHub Actions. **Read `HANDOVER.md` first** — it has the full state, decisions, risks and backlog.

## Hard rules from the owner
1. **Never remove features or UI elements. Only add or improve.** If something must change shape, keep the capability.
2. Security lives in `firestore.rules` (and the same text in `DOCUMENTATION.md`). The UI hides things for convenience; the rules are the authority. Any change to what a role can read/write must update **both** `firestore.rules` and the rules section of `DOCUMENTATION.md`, add/adjust a case in `tools/rules-test/` (and run it — `npm install && npm test` there; needs Java + firebase-tools), and the owner must be told to republish the rules in the Firebase console (Firestore → Rules → Publish). NEVER loosen the `users` rules: a user may only change their own `name`, `lastLoginAt` and clear `mustChangePassword`; `role`, `specialty`, `assignedBlocks` and `active` are admin-only (a past version let users edit their own blocks — a privilege-escalation hole).
3. Keep internal ids stable even when labels change: role `reporter` is displayed "RA"; category `furniture` is displayed "Carpentry". Renaming an id would orphan existing data and break rules/specialties.
4. Don't commit real secrets or personal data. `src/firebaseConfig.js` in this repo is a **placeholder** — the live site's real values are set in the GitHub repo; never overwrite them with the placeholder. Student/RA contact data in any legacy spreadsheet must stay out of git.

## Commands
```
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm run lint       # oxlint (currently 0 errors; 18 warnings repo-wide, 9 in `src/`)
# smoke test against fake Firebase (no real project needed):
npx vite build --config tools/smoke-test/vite.config.smoke.js
python3 tools/smoke-test/smoke.py       # needs playwright + chromium; 73 checks
```
Run build + lint + smoke test before declaring work done. State plainly what was and wasn't verified.

## Layout
- `src/App.jsx` top-level layout/state (semester scoping lives here). `src/contexts/AuthContext.jsx` auth + role/specialty/RA blocks. `src/hooks/useTickets.js` role-aware Firestore subscription.
- `src/utils/constants.js` blocks, categories, statuses, roles, **SEMESTERS**. `src/utils/helpers.js` formatting, search, semester scoping, resolution-time maths.
- `src/components/` one file per screen/panel. `public/` PWA assets. `.github/workflows/deploy.yml` build+deploy on push to `main`.
- `vite.config.js` `base` must equal `/Biust-Maintenance-Log/` (repo name) or the deployed site is blank.

## Conventions
- Plain React function components + hooks; no state library; styling is one `src/index.css` using CSS variables (`--bg`, `--card`, `--text`, …) so light/dark both work — use the variables, not hard-coded colours (status/category accent colours are the exception).
- No charting library: `PieChart.jsx` / `BarChart.jsx` are hand-rolled SVG/div. Adding a library is allowed if it earns its weight.
- Data fields are ISO-string dates, not Firestore Timestamps (known tradeoff; see HANDOVER).
- Photos are base64 JPEG strings inside the ticket document (≤ ~1 MB doc limit).
- The owner deploys by pushing to GitHub (historically via the web UI, not git). Keep README setup steps accurate and non-technical.

## Owner's working style
Wants complete, working deliverables and honest verification notes; clear step-by-step instructions for anything done in the Firebase console or GitHub UI; judgment calls stated explicitly so they can be overridden.
