// Security-rules tests. Run from this folder:  npm install && npm test
// (needs Java and the Firebase CLI: npm i -g firebase-tools). These were written alongside the rules but, at the
// time of writing, had NOT been run — run them before trusting the rules in production.
import fs from 'node:fs';
import test, { before, after, beforeEach } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

let env;
const now = '2026-10-20T08:00:00Z';
const USERS = {
  admin: { email: 'admin@x.com', name: 'Admin', role: 'admin' },
  sup: { email: 'sup@x.com', name: 'Sup', role: 'supervisor' },
  elec: { email: 'elec@x.com', name: 'Elec', role: 'maintainer', specialty: 'electricity' },
  ra: { email: 'ra@x.com', name: 'RA', role: 'reporter', assignedBlocks: ['BPC'] },
  stu: { email: 'stu@x.com', name: 'Stu', role: 'student', active: true, mustChangePassword: false, createdAt: now },
  stu2: { email: 'stu2@x.com', name: 'Stu2', role: 'student', active: true, mustChangePassword: false, createdAt: now },
  gone: { email: 'gone@x.com', name: 'Gone', role: 'admin', active: false },
  temp: { email: 'temp@x.com', name: 'Temp', role: 'maintainer', mustChangePassword: true, active: true },
};
const db = (uid) => env.authenticatedContext(uid, { email: USERS[uid] ? USERS[uid].email : uid + '@x.com' }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ticket = (over = {}) => ({ code: 'T-1', block: 'BPC', room: '1A', category: 'electricity', description: 'x', status: 'pending', reportedAt: now, reportedByUid: 'ra', notes: [], ...over });
const submission = (over = {}) => ({ block: 'BPC', room: '1A', description: 'x', status: 'pending', submittedAt: now, ...over });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-biust', firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    for (const [uid, d] of Object.entries(USERS)) await setDoc(doc(f, 'users', uid), d);
    await setDoc(doc(f, 'tickets', 'elecBPC'), ticket({ reportedByUid: 'ra' }));
    await setDoc(doc(f, 'tickets', 'plumbBPC'), ticket({ category: 'plumbing', reportedByUid: 'ra' }));
    await setDoc(doc(f, 'submissions', 'subStu'), submission({ submittedByUid: 'stu', submittedByEmail: 'stu@x.com' }));
    await setDoc(doc(f, 'submissions', 'subAnon'), submission());
    await setDoc(doc(f, 'submissions', 'subOtherBlock'), submission({ block: 'A' }));
  });
});

// ---------- accounts: no self-promotion ----------
test('a new user can create only a plain student record for themselves', async () => {
  const f = db('new1');
  const base = { email: 'new1@x.com', name: 'N', role: 'student', active: true, mustChangePassword: false, createdAt: now };
  await assertSucceeds(setDoc(doc(f, 'users', 'new1'), base));
  await assertFails(setDoc(doc(f, 'users', 'new1'), { ...base, role: 'reporter' }));
  await assertFails(setDoc(doc(f, 'users', 'new1'), { ...base, role: 'admin' }));
  await assertFails(setDoc(doc(f, 'users', 'new1'), { ...base, assignedBlocks: ['BPC'] }));
  await assertFails(setDoc(doc(f, 'users', 'new1'), { ...base, specialty: 'all' }));
  await assertFails(setDoc(doc(f, 'users', 'new1'), { ...base, email: 'someone-else@x.com' }));
  await assertFails(setDoc(doc(f, 'users', 'new1'), { ...base, active: false }));
  await assertFails(setDoc(doc(f, 'users', 'new1'), { ...base, mustChangePassword: true }));
});
test("nobody can create a record under someone else's uid", async () => {
  await assertFails(setDoc(doc(db('new2'), 'users', 'victim'), { email: 'new2@x.com', name: 'N', role: 'student', active: true, mustChangePassword: false, createdAt: now }));
});
test('a user cannot raise their own privileges', async () => {
  for (const uid of ['stu', 'ra', 'elec']) {
    const ref = (f) => doc(f, 'users', uid);
    await assertFails(updateDoc(ref(db(uid)), { role: 'admin' }));
    await assertFails(updateDoc(ref(db(uid)), { assignedBlocks: ['A', 'B', 'BPC'] }));
    await assertFails(updateDoc(ref(db(uid)), { specialty: 'all' }));
    await assertFails(updateDoc(ref(db(uid)), { active: true }));
  }
});
test('a user may update only name, lastLoginAt, and clear mustChangePassword', async () => {
  await assertSucceeds(updateDoc(doc(db('stu'), 'users', 'stu'), { name: 'New Name', lastLoginAt: now }));
  await assertSucceeds(updateDoc(doc(db('temp'), 'users', 'temp'), { mustChangePassword: false }));
  await assertFails(updateDoc(doc(db('stu'), 'users', 'stu'), { mustChangePassword: true }));
  await assertSucceeds(updateDoc(doc(db('temp'), 'users', 'temp'), { lastLoginAt: now })); // flag untouched
});
test('only an admin manages other accounts', async () => {
  await assertSucceeds(setDoc(doc(db('admin'), 'users', 'newRA'), { email: 'newra@x.com', name: 'R', role: 'reporter', assignedBlocks: [], active: true }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'stu'), { role: 'reporter', active: false }));
  await assertFails(updateDoc(doc(db('sup'), 'users', 'stu'), { role: 'reporter' }));
  await assertFails(updateDoc(doc(db('ra'), 'users', 'stu'), { name: 'hacked' }));
  await assertFails(deleteDoc(doc(db('ra'), 'users', 'stu')));
});
test('who can read accounts', async () => {
  await assertSucceeds(getDoc(doc(db('stu'), 'users', 'stu')));
  await assertFails(getDoc(doc(db('stu'), 'users', 'stu2')));
  await assertFails(getDocs(collection(db('elec'), 'users')));
  await assertFails(getDocs(collection(db('ra'), 'users')));
  await assertSucceeds(getDocs(collection(db('sup'), 'users')));
  await assertSucceeds(getDocs(collection(db('admin'), 'users')));
});
test('a deactivated admin has no powers', async () => {
  await assertFails(setDoc(doc(db('gone'), 'users', 'x'), { email: 'x@x.com', name: 'X', role: 'admin' }));
  await assertFails(getDocs(collection(db('gone'), 'users')));
});

// ---------- tickets ----------
test('students cannot create or read tickets', async () => {
  await assertFails(setDoc(doc(db('stu'), 'tickets', 't9'), ticket({ reportedByUid: 'stu', block: 'Admin' })));
  await assertFails(getDoc(doc(db('stu'), 'tickets', 'elecBPC')));
  await assertFails(getDocs(collection(db('stu'), 'tickets')));
});
test('an RA creates tickets only for their own block (or a campus facility)', async () => {
  const f = db('ra');
  await assertSucceeds(setDoc(doc(f, 'tickets', 't1'), ticket({ block: 'BPC' })));
  await assertFails(setDoc(doc(f, 'tickets', 't2'), ticket({ block: 'A' })));
  await assertSucceeds(setDoc(doc(f, 'tickets', 't3'), ticket({ block: 'Refectory' })));
  await assertFails(setDoc(doc(f, 'tickets', 't4'), ticket({ block: 'BPC', status: 'done' })));
  await assertFails(setDoc(doc(f, 'tickets', 't5'), ticket({ block: 'BPC', reportedByUid: 'someoneElse' })));
});
test('maintainers only see and change their own specialty', async () => {
  const f = db('elec');
  await assertSucceeds(getDoc(doc(f, 'tickets', 'elecBPC')));
  await assertFails(getDoc(doc(f, 'tickets', 'plumbBPC')));
  await assertSucceeds(updateDoc(doc(f, 'tickets', 'elecBPC'), { status: 'in_progress' }));
  await assertFails(updateDoc(doc(f, 'tickets', 'plumbBPC'), { status: 'in_progress' }));
});
test('supervisors can read everything and add notes, but never change status', async () => {
  const f = db('sup');
  await assertSucceeds(getDoc(doc(f, 'tickets', 'plumbBPC')));
  await assertSucceeds(updateDoc(doc(f, 'tickets', 'plumbBPC'), { notes: [{ text: 'please hurry', isSystem: false }] }));
  await assertFails(updateDoc(doc(f, 'tickets', 'plumbBPC'), { status: 'done' }));
});
test('a ticket owner can add notes and nothing else', async () => {
  const f = db('ra');
  await assertSucceeds(updateDoc(doc(f, 'tickets', 'elecBPC'), { notes: [{ text: 'hi' }] }));
  await assertFails(updateDoc(doc(f, 'tickets', 'elecBPC'), { status: 'done' }));
});

// ---------- public board ----------
test('the public board is world-readable but only the team can write it', async () => {
  await assertSucceeds(getDocs(collection(anon(), 'publicBoard')));
  await assertFails(setDoc(doc(db('stu'), 'publicBoard', 'p1'), { code: 'x' }));
  await assertFails(setDoc(doc(anon(), 'publicBoard', 'p1'), { code: 'x' }));
  await assertSucceeds(setDoc(doc(db('ra'), 'publicBoard', 'p1'), { code: 'x' }));
});

// ---------- submissions ----------
test('anyone can submit; a signed-in student must submit as themselves', async () => {
  await assertSucceeds(addDoc(collection(anon(), 'submissions'), submission()));
  await assertFails(addDoc(collection(anon(), 'submissions'), submission({ submittedByUid: 'stu' })));
  await assertSucceeds(addDoc(collection(db('stu'), 'submissions'), submission({ submittedByUid: 'stu', submittedByEmail: 'stu@x.com' })));
  await assertFails(addDoc(collection(db('stu'), 'submissions'), submission({ submittedByUid: 'stu2' })));
  await assertFails(addDoc(collection(db('stu'), 'submissions'), submission({ submittedByUid: 'stu', submittedByEmail: 'forged@x.com' })));
  await assertFails(addDoc(collection(anon(), 'submissions'), submission({ status: 'accepted' })));
  await assertFails(addDoc(collection(anon(), 'submissions'), submission({ description: 'x'.repeat(2001) })));
});
test('only the team may backdate a report (originalReportedAt)', async () => {
  const old = '2026-01-05T08:00:00Z';
  await assertSucceeds(addDoc(collection(db('ra'), 'submissions'), submission({ originalReportedAt: old, source: 'whatsapp' })));
  await assertSucceeds(addDoc(collection(db('admin'), 'submissions'), submission({ originalReportedAt: old })));
  await assertFails(addDoc(collection(anon(), 'submissions'), submission({ originalReportedAt: old })));
  await assertFails(addDoc(collection(db('stu'), 'submissions'), submission({ originalReportedAt: old, submittedByUid: 'stu' })));
});
test('a student reads only their own submissions', async () => {
  await assertSucceeds(getDoc(doc(db('stu'), 'submissions', 'subStu')));
  await assertFails(getDoc(doc(db('stu2'), 'submissions', 'subStu')));
  await assertFails(getDoc(doc(db('stu'), 'submissions', 'subAnon')));
  await assertSucceeds(getDocs(query(collection(db('stu'), 'submissions'), where('submittedByUid', '==', 'stu'))));
  await assertFails(getDocs(collection(db('stu'), 'submissions')));
});
test('an RA reviews only their own block; students cannot review', async () => {
  await assertSucceeds(getDoc(doc(db('ra'), 'submissions', 'subAnon')));
  await assertFails(getDoc(doc(db('ra'), 'submissions', 'subOtherBlock')));
  await assertSucceeds(updateDoc(doc(db('ra'), 'submissions', 'subAnon'), { status: 'accepted', reviewedBy: 'ra' }));
  await assertFails(updateDoc(doc(db('ra'), 'submissions', 'subAnon'), { description: 'rewritten' }));
  await assertFails(updateDoc(doc(db('stu'), 'submissions', 'subStu'), { status: 'accepted' }));
  await assertSucceeds(getDoc(doc(db('admin'), 'submissions', 'subOtherBlock')));
});

// ---------- audit log + mail queue ----------
test('the audit log is admin-only and append-only', async () => {
  const entry = { at: now, byUid: 'admin', byName: 'Admin', action: 'account.create' };
  const ref = await assertSucceeds(addDoc(collection(db('admin'), 'auditLog'), entry));
  await assertFails(addDoc(collection(db('admin'), 'auditLog'), { ...entry, byUid: 'someoneElse' }));
  await assertFails(addDoc(collection(db('ra'), 'auditLog'), { ...entry, byUid: 'ra' }));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(db('ra'), 'auditLog', ref.id)));
  await assertFails(updateDoc(doc(db('admin'), 'auditLog', ref.id), { action: 'tampered' }));
  await assertFails(deleteDoc(doc(db('admin'), 'auditLog', ref.id)));
});
test('only the team can queue email, and nobody can read it back', async () => {
  const mail = { to: 'a@b.com', message: { subject: 's', text: 't' } };
  await assertSucceeds(addDoc(collection(db('ra'), 'mail'), mail));
  await assertFails(addDoc(collection(db('stu'), 'mail'), mail));
  await assertFails(addDoc(collection(anon(), 'mail'), mail));
  await assertFails(addDoc(collection(db('ra'), 'mail'), { ...mail, extra: 1 }));
  await assertFails(getDocs(collection(db('admin'), 'mail')));
});
