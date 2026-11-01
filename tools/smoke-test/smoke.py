"""Smoke test: build with fake Firebase, load the app headlessly, exercise the key screens.
Usage (from repo root):
  npx vite build --config tools/smoke-test/vite.config.smoke.js
  python3 tools/smoke-test/smoke.py        # serves dist-smoke itself
Screenshots land in tools/smoke-test/out/.
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
PORT = 8799
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=os.path.join(ROOT, 'dist-smoke'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors, results = [], []
def check(name, ok): results.append((name, ok)); print(('PASS ' if ok else 'FAIL ') + name)
def shot(page, name): page.screenshot(path=os.path.join(OUT, name))

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://localhost:{PORT}/index.html', wait_until='load'); time.sleep(0.6)
        page.evaluate("""() => {
          const T = (code, block, room, cat, desc, status, rep, res, extra={}) => ({ code, block, room, category: cat, description: desc, reportedBy: 'Test', contact: '', urgent: false, photo: null, status, reportedAt: rep, resolvedAt: res, reportedByUid: 'u', notes: [], ...extra });
          window.__mockSeed('users', 'admin', { email: 'a@x', name: 'Admin Test', role: 'admin' });
          window.__mockSeed('users', 'ra1', { email: 'r@x', name: 'Test RA', role: 'reporter', assignedBlocks: ['A'] });
          window.__mockSeed('tickets', 't1', T('A-1', 'Sekgoma 1', '14', 'plumbing', 'Leaking tap', 'done', '2026-09-10T08:00:00Z', '2026-09-10T13:00:00Z'));
          window.__mockSeed('tickets', 't2', T('A-2', 'BPC', '49', 'electricity', 'Socket dead', 'done', '2026-09-12T08:00:00Z', '2026-09-15T08:00:00Z'));
          window.__mockSeed('tickets', 't3', T('A-3', 'A', '20', 'electricity', 'Light flickering (still open)', 'pending', '2026-09-05T08:00:00Z', null));
          window.__mockSeed('tickets', 't4', T('A-4', 'Admin', '', 'access', 'Office door will not lock', 'pending', new Date(Date.now() - 86400000).toISOString(), null, { urgent: true }));
          window.__mockAuth.setUser({ uid: 'admin', email: 'a@x', displayName: 'Admin Test' });
        }"""); time.sleep(0.8)
        body = page.inner_text('body')
        check('board loads for admin', 'Admin Test' in body)
        check('semester selector present', page.locator('select[aria-label="Semester"]').count() == 1)

        # ---- dashboard: two tiles, collapsed by default, drop-downs ----
        check('Residences and Campus facilities tiles present', 'Residences' in body and 'Campus facilities' in body)
        check('collapsed by default (no tickets shown yet)', 'Light flickering' not in body and 'Block A' not in body)
        shot(page, '01-dashboard-collapsed.png')
        page.locator('.section-tile', has_text='Residences').click(); time.sleep(0.3)
        body = page.inner_text('body')
        check('Residences opens a list of places with counts', 'Block A' in body and 'BPC' in body and 'No reports:' in body)
        check('reports still hidden until a place is opened', 'Light flickering' not in body)
        page.locator('.block-group-header', has_text='Block A').click(); time.sleep(0.3)
        body = page.inner_text('body')
        check('opening a place shows its reports', 'Light flickering' in body)
        check('open tickets show an age badge', 'open ' in body and '⏱' in body)
        check('numbered/lettered blocks read "Block A", rooms read "Rm 20"', 'Block A' in body and 'Rm 20' in body)
        shot(page, '02-dashboard-expanded.png')
        page.locator('.section-tile', has_text='Campus facilities').click(); time.sleep(0.3)
        body = page.inner_text('body')
        check('Campus facilities lists Admin, flagged urgent', 'Admin' in body and '1 urgent' in body)
        page.locator('.block-group-header', has_text='Admin').click(); time.sleep(0.3)
        check('blank room shows as "Common area"', 'Common area' in page.inner_text('body'))

        # ---- tappable status tiles ----
        tile = page.locator('button.stat-card-btn').first
        tile.click(); time.sleep(0.2)
        check('status tile filters (aria-pressed)', tile.get_attribute('aria-pressed') == 'true')
        tile.click(); time.sleep(0.2)
        check('tapping again clears the filter', tile.get_attribute('aria-pressed') == 'false')

        # ---- search auto-opens matches ----
        page.locator('.section-tile', has_text='Residences').click()          # close Residences
        page.locator('.section-tile', has_text='Campus facilities').click()   # close Facilities
        time.sleep(0.2)
        page.fill('input[placeholder^="Search"]', 'flicker'); time.sleep(0.4)
        check('searching auto-opens the matching place', 'Light flickering' in page.inner_text('body'))
        page.fill('input[placeholder^="Search"]', ''); time.sleep(0.2)

        # ---- report with no room number (common area) + quick picks ----
        page.locator('.fab').click(); time.sleep(0.4)
        form = page.inner_text('.modal-card')
        check('form offers common-area chips and common-issue chips', 'Not in a room?' in form and 'Kitchen' in form and 'Sockets' in form or 'socket' in form.lower())
        page.locator('.modal-card .combo input').click(); time.sleep(0.2)
        groups = page.locator('.modal-card .combo-group').all_inner_texts()
        opts0 = page.locator('.modal-card [role=option]').all_inner_texts()
        check('room box opens with Common areas first, then Rooms', [g.strip().lower() for g in groups][:2] == ['common areas', 'rooms'] and 'Ablution' in opts0 and 'Common room' in opts0 and 'Kitchenette' in opts0)
        page.fill('.modal-card .combo input', 'kitch'); time.sleep(0.2)
        check('typing finds a common area', 'Kitchenette' in page.locator('.modal-card [role=option]').all_inner_texts())
        page.fill('.modal-card .combo input', '')
        page.locator('.modal-card select').first.select_option('Refectory'); time.sleep(0.2)
        page.locator('.modal-card .combo input').click(); time.sleep(0.2)
        check('campus facilities get their own areas (Refectory: Dining hall)', 'Dining hall' in page.locator('.modal-card [role=option]').all_inner_texts())
        page.locator('.modal-card select').first.select_option('BPC'); page.fill('.modal-card .combo input', ''); time.sleep(0.2)
        page.fill('.modal-card .combo input', '2'); time.sleep(0.2)
        opts = page.locator('.modal-card [role=option]').all_inner_texts()
        check('room autocomplete suggests rooms with no duplicates', len(opts) > 0 and len(opts) == len(set(opts)))
        page.fill('.modal-card .combo input', ''); page.keyboard.press('Escape')
        page.locator('.modal-card button', has_text='Kitchen').first.click()
        page.fill('.modal-card textarea', 'tap leaking in kitchen')
        page.locator('.modal-card .submit-btn').click(); time.sleep(0.8)
        check('ticket saved without a room number', 'Ticket submitted' in page.inner_text('body'))
        page.fill('input[placeholder^="Search"]', 'kitchen'); time.sleep(0.5)
        check('common-area ticket shows "Kitchen", not "Rm Kitchen"', 'Kitchen' in page.inner_text('body') and 'Rm Kitchen' not in page.inner_text('body'))
        page.fill('input[placeholder^="Search"]', ''); time.sleep(0.2)

        # ---- Summary: KPIs, bands, trends, location drill-down with RA ----
        page.evaluate("() => { for (const b of document.querySelectorAll('.badge-btn')) if (b.textContent === 'Summary') b.click(); }"); time.sleep(0.5)
        body = page.inner_text('body')
        check('summary KPI row (Total/Open/Closed/Avg fix)', all(k in body for k in ['Total', 'Open', 'Closed', 'Avg fix']))
        check('summary shows resolution stats', 'Resolution times' in body and 'Average' in body and 'Median' in body)
        check('average = 1d 14h (5h and 72h -> 38h 30m)', '1d 14h' in body)
        check('speed bands shown', 'How fast problems get fixed' in body and 'Fast' in body and 'Critical' in body)
        check('monthly trend charts shown', 'Reports per month' in body and 'Average time to fix' in body)
        shot(page, '03-summary-analytics.png')
        page.locator('.modal-card select').first.select_option('A'); time.sleep(0.4)
        body = page.inner_text('.modal-card')
        check('location drill-down shows that block\'s RA', 'RA: Test RA' in body)
        shot(page, '04-summary-block-drilldown.png')
        page.evaluate("() => document.querySelector('.modal-card .icon-btn').click()"); time.sleep(0.3)

        # ---- semesters ----
        page.select_option('select[aria-label="Semester"]', '2026-27-S2'); time.sleep(0.4)
        page.fill('input[placeholder^="Search"]', 'flicker'); time.sleep(0.5)
        body = page.inner_text('body')
        check('S2 view carries over the open ticket (tagged)', 'Light flickering' in body and 'from S1 26/27' in body)
        page.fill('input[placeholder^="Search"]', 'leaking'); time.sleep(0.4)
        check('S2 view excludes resolved S1 tickets', 'Leaking tap' not in page.inner_text('body'))
        shot(page, '05-board-s2-carryover.png')

        # ---------------- WhatsApp export import ----------------
        page.on('dialog', lambda dlg: dlg.accept())
        chat = """12/09/2026, 08:14 - Reba (Old Boys RA): OLD MAIN BOYS ISSUES
ELECTRICITY
F27 lights not working 71441150
S18 socket not working
G27 fan not working
G25 main light not working 76114281
PLUMBING
S3 tap leaking 77562054
13/09/2026, 10:02 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
13/09/2026, 10:05 - Tebo Maintenance: F27 done
and G27 fixed too
13/09/2026, 10:06 - Reba (Old Boys RA): <Media omitted>
14/09/2026, 09:30 - Reba (Old Boys RA): Block 4 room 20 toilet blocked
S23 fan hae bereke""".encode()
        page.locator('.badge-btn', has_text='Inbox').click(); time.sleep(0.5)
        page.locator('.modal-card .badge-btn', has_text='Import from WhatsApp').click(); time.sleep(0.4)
        wm = page.locator('.modal-card').last
        check('import explains how to export from WhatsApp', 'Export chat' in wm.inner_text() and 'Without media' in wm.inner_text())
        wm.locator('select').first.select_option('Old Main Boys')
        wm.locator('input[type=file]').set_input_files({'name': 'WhatsApp Chat - Old Boys.txt', 'mimeType': 'text/plain', 'buffer': chat}); time.sleep(0.9)
        wt = page.locator('.modal-card').last.inner_text()
        check('chat is read into possible reports, noticing the ones already fixed', '7 possible reports' in wt and '2 look already fixed' in wt)
        shot(page, '08-whatsapp-review.png')
        check('only outstanding reports are listed by default', page.locator('.modal-card').last.locator('textarea').count() == 5)
        page.locator('.modal-card').last.locator('.submit-btn', has_text='Send 5 reports').click(); time.sleep(1.2)
        wsubs = [x for x in page.evaluate("() => window.__mockAll('submissions')") if x.get('source') == 'whatsapp']
        check('5 reports saved with their original WhatsApp dates and senders', len(wsubs) == 5 and all(x['originalReportedAt'].startswith('2026-09-1') and x['reportedBy'].startswith('Reba') for x in wsubs))
        check('bare codes became rooms under the right location and category', any(x['block'] == 'Old Main Boys' and x['room'] == 'G25' and x['category'] == 'electricity' and x['contact'] == '76114281' for x in wsubs) and any(x['block'] == '4' and x['room'] == '20' for x in wsubs))
        page.locator('.modal-card').last.locator('.submit-btn', has_text='Done').click(); time.sleep(0.4)
        check('admin sees Accept all in the Inbox', page.locator('.modal-card .badge-btn', has_text='Accept all (5)').count() == 1)
        page.locator('.modal-card .badge-btn', has_text='Accept all').click(); time.sleep(2.0)
        wtix = [x for x in page.evaluate("() => window.__mockAll('tickets')") if x.get('source') == 'whatsapp']
        check('accepted tickets keep the original dates, semester and source note', len(wtix) == 5 and all(x['reportedAt'].startswith('2026-09-1') and x['semester'] == '2026-27-S1' and 'WhatsApp' in x['notes'][0]['text'] for x in wtix))
        page.locator('.modal-card .badge-btn', has_text='Import from WhatsApp').click(); time.sleep(0.4)
        page.locator('.modal-card').last.locator('input[type=file]').set_input_files({'name': 'WhatsApp Chat - Old Boys.txt', 'mimeType': 'text/plain', 'buffer': chat}); time.sleep(0.9)
        again = page.locator('.modal-card').last.inner_text()
        check('importing the same chat again does not duplicate anything', 'already imported' in again and 'Send 0 reports' in again)
        page.evaluate("() => document.querySelectorAll('.modal-card .icon-btn').forEach((b) => b.click())"); time.sleep(0.3)

        # ---------------- desktop layout: top bar ----------------
        d = b.new_page(viewport={'width': 1180, 'height': 860}, device_scale_factor=1)
        d.on('pageerror', lambda e: errors.append(str(e)))
        d.goto(f'http://localhost:{PORT}/index.html', wait_until='load'); time.sleep(0.6)
        d.evaluate("""() => {
          const T = (code, block, room, cat, desc, status, rep, res, extra={}) => ({ code, block, room, category: cat, description: desc, reportedBy: 'Test', contact: '', urgent: false, photo: null, status, reportedAt: rep, resolvedAt: res, reportedByUid: 'u', notes: [], ...extra });
          window.__mockSeed('users', 'admin', { email: 'a@x', name: 'Thabiso Kolojane', role: 'admin' });
          window.__mockSeed('tickets', 't3', T('A-3', 'A', '20', 'electricity', 'Light flickering (still open)', 'pending', '2026-09-05T08:00:00Z', null));
          window.__mockSeed('tickets', 't4', T('A-4', 'Admin', '', 'access', 'Office door will not lock', 'pending', new Date(Date.now() - 86400000).toISOString(), null, { urgent: true }));
          window.__mockSeed('submissions', 's1', { block: 'A', room: '3', description: 'x', status: 'pending', submittedAt: new Date().toISOString() });
          window.__mockAuth.setUser({ uid: 'admin', email: 'a@x', displayName: 'Thabiso Kolojane' });
        }"""); time.sleep(0.9)
        check('desktop: top bar replaces the identity card', d.locator('header.topbar').count() == 1 and d.locator('.identity-card').count() == 0)
        tb = d.inner_text('header.topbar')
        check('desktop: nav tabs for admin', all(k in tb for k in ['Dashboard', 'Manage', 'Summary', 'Export']))
        check('desktop: name, role pill and log out', 'Thabiso Kolojane' in tb and 'ADMIN' in tb.upper() and 'Log out' in tb)
        check('desktop: inbox shows the pending count badge', d.locator('.inbox-pill .count-badge').inner_text().strip() == '1')
        check('desktop: big page title and semester', 'Report and track campus maintenance issues' in d.inner_text('.page-header') and 'Semester 1' in d.inner_text('.page-header'))
        d.locator('.theme-seg button[aria-label="Dark mode"]').click(); time.sleep(0.2)
        t1 = d.evaluate("() => document.documentElement.dataset.theme")
        d.locator('.theme-seg button[aria-label="Light mode"]').click(); time.sleep(0.2)
        check('desktop: theme switch works', t1 == 'dark' and d.evaluate("() => document.documentElement.dataset.theme") == 'light')
        d.locator('.theme-seg button[aria-label="Dark mode"]').click(); time.sleep(0.2)
        d.locator('.section-tile', has_text='Campus facilities').click(); time.sleep(0.3)
        check('desktop: footer total shown', 'total issue' in d.inner_text('body'))
        d.screenshot(path=os.path.join(OUT, '06-desktop-dashboard.png'))
        d.locator('.nav-tab', has_text='Summary').click(); time.sleep(0.5)
        check('desktop: Summary tab opens the summary', 'Resolution times' in d.inner_text('body'))

        # ---------------- accounts: student vs staff, invites, forced password change, deactivation ----------------
        import re
        a = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        a.on('pageerror', lambda e: errors.append(str(e)))
        a.on('dialog', lambda dlg: dlg.accept())
        a.goto(f'http://localhost:{PORT}/index.html', wait_until='load'); time.sleep(0.6)
        a.evaluate("""() => {
          window.__mockAuth.register('admin@x.com', 'Adm1n-Pass1', 'admin');
          window.__mockSeed('users', 'admin', { email: 'admin@x.com', name: 'Admin Test', role: 'admin' });
        }""")
        def body(): return a.inner_text('body')
        def login(audience, email, pw):
            a.locator('[role=tab]', has_text=audience).click(); time.sleep(0.15)
            a.fill('input[placeholder="Email"]', email); a.fill('input[placeholder="Password"]', pw)
            a.locator('.auth-card .submit-btn').click(); time.sleep(0.9)
        def logout():
            a.locator('.badge-btn', has_text='Log out').click(); time.sleep(0.5)
        def doc_of(col, id): return a.evaluate("([c, i]) => window.__mockGet(c, i)", [col, id])
        def open_manage():
            a.locator('.badge-btn', has_text='Manage').click(); time.sleep(0.5)

        time.sleep(0.4)
        check('sign-in has separate Student and Staff tabs', a.locator('[role=tab]').count() == 2 and 'Student' in body() and 'Staff' in body())
        a.locator('[role=tab]', has_text='Staff').click(); time.sleep(0.2)
        check('staff tab offers no self sign-up', 'Create a student account' not in body() and 'created by an administrator' in body())
        a.locator('[role=tab]', has_text='Student').click(); time.sleep(0.2)
        a.locator('.auth-card .link-btn', has_text='Create a student account').click(); time.sleep(0.2)
        a.fill('input[placeholder="Full name"]', 'Sam Student'); a.fill('input[placeholder="Email"]', 's@x.com')
        a.fill('input[placeholder="Password"]', 'abc'); a.fill('input[placeholder="Confirm password"]', 'abc')
        a.locator('.auth-card .submit-btn').click(); time.sleep(0.3)
        check('weak password rejected at sign-up', 'at least 8' in body())
        a.fill('input[placeholder="Password"]', 'Sturdy-Pass9'); a.fill('input[placeholder="Confirm password"]', 'Sturdy-Pass8')
        a.locator('.auth-card .submit-btn').click(); time.sleep(0.3)
        check('mismatched confirmation rejected', "match" in body())
        a.fill('input[placeholder="Confirm password"]', 'Sturdy-Pass9')
        a.locator('.auth-card .submit-btn').click(); time.sleep(1.0)
        check('student sign-up lands on My reports with a verify-email prompt', 'My reports' in body() and 'Verify your email' in body())
        sd = doc_of('users', 'u:s@x.com')
        check('student record is role=student, active, no privileges', sd and sd['role'] == 'student' and sd['active'] is True and 'assignedBlocks' not in sd and 'specialty' not in sd)
        check('verification email was requested', 's@x.com' in a.evaluate("() => window.__mockAuth.log.verifications"))
        check('student sees no Manage / Summary / Export', not any(k in body() for k in ['Manage', 'Summary', 'Export']))
        a.locator('.submit-btn', has_text='Report an issue').click(); time.sleep(0.4)
        a.fill('.modal-card textarea', 'Socket is dead'); a.locator('.modal-card .submit-btn').click(); time.sleep(0.8)
        subs = a.evaluate("() => window.__mockAll('submissions')")
        check('after sending, the form confirms and closes with Done', 'Thanks' in a.inner_text('.modal-card'))
        a.locator('.modal-card .submit-btn', has_text='Done').click(); time.sleep(0.5)
        check('student report is saved under their own account', len(subs) == 1 and subs[0]['submittedByUid'] == 'u:s@x.com' and subs[0]['submittedByEmail'] == 's@x.com')
        check('student sees their report as waiting for review', 'waiting for review' in body().lower() and 'Socket is dead' in body())
        shot(a, '07-student-home.png')
        logout()
        login('Staff', 's@x.com', 'Sturdy-Pass9')
        check('a student cannot sign in on the Staff tab', 'student account' in body() and 'My reports' not in body())
        login('Student', 'admin@x.com', 'Adm1n-Pass1')
        check('staff cannot sign in on the Student tab', 'staff account' in body())
        login('Staff', 'admin@x.com', 'Adm1n-Pass1')
        check('admin signs in on the Staff tab', 'Admin Test' in body() and 'Manage' in body())

        open_manage()
        check('admin can create any role (5 role choices incl. Student and Admin)', all(a.locator('.modal-card .cat-btn-label', has_text=re.compile(f'^{r}$')).count() >= 1 for r in ['Student', 'RA', 'Maintainer', 'Supervisor', 'Admin']))
        a.fill('.modal-card input[placeholder="Full name"]', 'Rita RA'); a.fill('.modal-card input[placeholder="Email"]', 'rita@x.com')
        a.locator('.modal-card .cat-btn-label', has_text=re.compile('^RA$')).click()
        a.locator('.modal-card .submit-btn', has_text='Create account').click(); time.sleep(1.0)
        rd = doc_of('users', 'u:rita@x.com')
        check('RA created by invite: correct role, active, no forced change', rd and rd['role'] == 'reporter' and rd['active'] is True and rd['mustChangePassword'] is False and rd['assignedBlocks'] == [])
        check('invite email was sent (no password shared)', 'rita@x.com' in a.evaluate("() => window.__mockAuth.log.resets") and 'Invite email sent' in a.inner_text('.modal-card') and 'Temporary password:' not in a.inner_text('.modal-card'))
        a.fill('.modal-card input[placeholder="Full name"]', 'Mo Maint'); a.fill('.modal-card input[placeholder="Email"]', 'mo@x.com')
        a.locator('.modal-card .cat-btn-label', has_text=re.compile('^Maintainer$')).click()
        a.locator('.modal-card .cat-btn-label', has_text=re.compile('^Temporary password$')).click()
        a.locator('.modal-card .submit-btn', has_text='Create account').click(); time.sleep(1.0)
        md = doc_of('users', 'u:mo@x.com')
        temp_pw = re.search(r'Temporary password: (\S+)', a.locator('.modal-card textarea').input_value()).group(1)
        check('maintainer created with a generated temporary password, forced change flagged', md and md['role'] == 'maintainer' and md['mustChangePassword'] is True and len(temp_pw) >= 12)
        a.locator('.modal-card .user-row', has_text='Rita RA').click(); time.sleep(0.3)
        n_before = len(a.evaluate("() => window.__mockAuth.log.resets"))
        a.locator('.modal-card .badge-btn', has_text='Send password reset email').click(); time.sleep(0.5)
        check('admin can trigger a password-reset email for someone else', len(a.evaluate("() => window.__mockAuth.log.resets")) == n_before + 1)
        a.locator('.modal-card details summary', has_text='Activity log').click(); time.sleep(0.5)
        check('admin actions are written to the activity log', 'account.create' in a.inner_text('.modal-card') and 'account.reset-password' in a.inner_text('.modal-card'))
        a.evaluate("() => document.querySelector('.modal-card .icon-btn').click()"); time.sleep(0.3)
        logout()
        login('Staff', 'mo@x.com', temp_pw)
        check('temporary-password account is forced to choose a new password', 'Set a new password' in body())
        a.fill('input[placeholder="New password"]', 'short1'); a.fill('input[placeholder="Confirm new password"]', 'short1')
        a.locator('.submit-btn', has_text='Save and continue').click(); time.sleep(0.3)
        check('forced change enforces the password policy', 'at least 8' in body())
        a.fill('input[placeholder="New password"]', 'Fresh-Pass7'); a.fill('input[placeholder="Confirm new password"]', 'Fresh-Pass7')
        a.locator('.submit-btn', has_text='Save and continue').click(); time.sleep(1.0)
        check('after choosing a password the maintainer gets in and the flag clears', 'Mo Maint' in body() and doc_of('users', 'u:mo@x.com')['mustChangePassword'] is False)
        a.locator('.badge-btn', has_text='Account').click(); time.sleep(0.4)
        check('Account panel offers password change and email verification', 'Change password' in a.inner_text('.modal-card') and 'Not verified' in a.inner_text('.modal-card'))
        a.evaluate("() => document.querySelector('.modal-card .icon-btn').click()"); time.sleep(0.3)
        logout()
        login('Staff', 'admin@x.com', 'Adm1n-Pass1'); open_manage()
        a.locator('.modal-card .user-row', has_text='Mo Maint').click(); time.sleep(0.3)
        a.locator('.modal-card .badge-btn', has_text='Deactivate account').click(); time.sleep(0.6)
        check('admin can deactivate an account', doc_of('users', 'u:mo@x.com')['active'] is False)
        check('admin cannot deactivate or demote themselves', a.locator('.modal-card .user-row', has_text='Admin Test').count() == 1 and (a.locator('.modal-card .user-row', has_text='Admin Test').click() or True) and a.locator('.modal-card .badge-btn', has_text='Deactivate account').count() == 0)
        a.evaluate("() => document.querySelector('.modal-card .icon-btn').click()"); time.sleep(0.3)
        logout()
        login('Staff', 'mo@x.com', 'Fresh-Pass7')
        check('a deactivated account cannot sign in', 'deactivated' in body())
        b.close()
finally:
    server.terminate()

check('no uncaught page errors', not errors)
for e in errors: print('  error:', e)
sys.exit(0 if all(ok for _, ok in results) else 1)
