// Fake Firebase Auth: one signed-in user per auth instance (primary vs the admin's "Secondary"), an account
// registry with passwords, and logs of the emails the app asked Firebase to send.
const states = {}; const listeners = {}; const accounts = {};
const log = { resets: [], verifications: [] };
const appOf = (a) => (a && a.app && a.app.name) || '[DEFAULT]';
const notify = (n) => (listeners[n] || []).forEach((cb) => cb(states[n] || null));
const mkUser = (email, uid) => ({ uid, email, displayName: null, emailVerified: false, reload: async () => {} });
const err = (code) => Object.assign(new Error(code), { code });

export const getAuth = (app) => ({ app, get currentUser() { return states[appOf({ app })] || null; } });
export function onAuthStateChanged(a, cb) {
  const n = appOf(a); (listeners[n] ||= []).push(cb);
  setTimeout(() => cb(states[n] || null), 0);
  return () => { listeners[n] = listeners[n].filter((f) => f !== cb); };
}
export async function signInWithEmailAndPassword(a, email, pw) {
  const acct = accounts[email];
  if (!acct || acct.pw !== pw) throw err('auth/invalid-credential');
  const n = appOf(a); states[n] = mkUser(email, acct.uid); notify(n); return { user: states[n] };
}
export async function createUserWithEmailAndPassword(a, email, pw) {
  if (accounts[email]) throw err('auth/email-already-in-use');
  const uid = 'u:' + email; accounts[email] = { uid, pw };
  const n = appOf(a); states[n] = mkUser(email, uid); notify(n); return { user: states[n] };
}
export async function signOut(a) { const n = appOf(a); states[n] = null; notify(n); }
export async function sendPasswordResetEmail(a, email) { log.resets.push(email); }
export async function sendEmailVerification(u) { log.verifications.push(u.email); }
export async function updateProfile(u, p) { if (p && 'displayName' in p) u.displayName = p.displayName; }
export async function updatePassword(u, pw) { accounts[u.email].pw = pw; }
export const EmailAuthProvider = { credential: (email, pw) => ({ email, pw }) };
export async function reauthenticateWithCredential(u, cred) {
  if (!accounts[u.email] || accounts[u.email].pw !== cred.pw) throw err('auth/invalid-credential');
}
window.__mockAuth = {
  setUser(u) { states['[DEFAULT]'] = u ? { emailVerified: false, reload: async () => {}, ...u } : null; notify('[DEFAULT]'); },
  register(email, pw, uid) { accounts[email] = { uid: uid || 'u:' + email, pw }; },
  log,
};
