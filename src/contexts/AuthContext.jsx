import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, updateProfile, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { STAFF_ROLES } from '../utils/constants';

const AuthContext = createContext(null);
const appError = (code, message) => Object.assign(new Error(message), { code });

export function AuthProvider({ children }) {
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [assignedBlocks, setAssignedBlocks] = useState([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [publicMode, setPublicMode] = useState(false);
  const [authError, setAuthError] = useState('');

  // signIn() records which tab the person used (student/staff) and waits for the profile check below.
  const loginIntentRef = useRef(null);
  const loginWaitRef = useRef(null);
  const pendingSignupRef = useRef(false);

  const applyProfile = useCallback((user, data) => {
    setCurrentUser(user);
    setPublicMode(false);
    setRole(data.role || 'student');
    setName(data.name || '');
    setSpecialty(data.specialty || 'all');
    setAssignedBlocks(Array.isArray(data.assignedBlocks) ? data.assignedBlocks : []);
    setMustChangePassword(data.mustChangePassword === true);
    setEmailVerified(!!user.emailVerified);
  }, []);

  // Reads the account record. An Auth user with no record (e.g. sign-up was interrupted) gets a plain student
  // record — least privilege; staff records only ever come from an admin.
  const loadProfile = useCallback(async (user) => {
    const userRef = doc(db, 'users', user.uid);
    let snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Student'),
        role: 'student', active: true, mustChangePassword: false,
        createdAt: new Date().toISOString(),
      });
      snap = await getDoc(userRef);
    }
    return snap.data();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null); setRole(null); setMustChangePassword(false); setEmailVerified(false);
        setInitializing(false);
        return;
      }
      if (pendingSignupRef.current) return; // signUp() finishes the profile itself
      const intent = loginIntentRef.current; loginIntentRef.current = null;
      const waiter = loginWaitRef.current; loginWaitRef.current = null;
      try {
        const data = await loadProfile(user);
        const isTeam = STAFF_ROLES.includes(data.role);
        let problem = null;
        if (data.active === false) problem = appError('app/account-disabled', 'This account has been deactivated.');
        else if (intent === 'staff' && !isTeam) problem = appError('app/not-staff', 'That is a student account.');
        else if (intent === 'student' && isTeam) problem = appError('app/not-student', 'That is a staff account.');
        if (problem) {
          await signOut(auth);
          if (waiter) waiter.reject(problem); else setAuthError(problem.message);
          return;
        }
        applyProfile(user, data);
        setInitializing(false);
        if (waiter) {
          waiter.resolve();
          updateDoc(doc(db, 'users', user.uid), { lastLoginAt: new Date().toISOString() }).catch(() => {});
        }
      } catch (e) {
        console.error(e);
        setInitializing(false);
        if (waiter) waiter.reject(e); else setAuthError('Could not load your account. Try reloading the page.');
      }
    });
    return unsub;
  }, [applyProfile, loadProfile]);

  // audience: 'student' | 'staff' — the tab the person signed in from. Signing in on the wrong tab is refused.
  const signIn = useCallback(async (email, password, audience) => {
    setAuthError('');
    const waiter = new Promise((resolve, reject) => { loginWaitRef.current = { resolve, reject }; });
    waiter.catch(() => {}); // rejection is surfaced by the await below
    loginIntentRef.current = audience || null;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      loginIntentRef.current = null; loginWaitRef.current = null;
      throw e;
    }
    await waiter;
  }, []);

  // Self sign-up creates STUDENT accounts only.
  const signUp = useCallback(async (email, password, displayName) => {
    setAuthError('');
    pendingSignupRef.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await updateProfile(cred.user, { displayName });
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email, name: displayName, role: 'student', active: true, mustChangePassword: false,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        await signOut(auth).catch(() => {});
        throw e;
      }
      sendEmailVerification(cred.user).catch((e) => console.error('verification email failed', e));
      const data = (await getDoc(doc(db, 'users', cred.user.uid))).data();
      applyProfile(cred.user, data);
      setInitializing(false);
    } finally {
      pendingSignupRef.current = false;
    }
  }, [applyProfile]);

  const logout = useCallback(() => signOut(auth), []);
  const forgotPassword = useCallback((email) => sendPasswordResetEmail(auth, email), []);
  const enterPublicMode = useCallback(() => setPublicMode(true), []);
  const exitPublicMode = useCallback(() => setPublicMode(false), []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  }, []);
  const refreshVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    setEmailVerified(!!auth.currentUser.emailVerified);
    return !!auth.currentUser.emailVerified;
  }, []);

  // currentPassword is needed when changing voluntarily (re-authentication); the forced change right after a
  // temporary-password login passes '' because the person has just signed in.
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    if (!user) throw appError('app/no-user', 'You are not signed in.');
    if (currentPassword) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await updatePassword(user, newPassword);
    await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false });
    setMustChangePassword(false);
  }, []);

  const isAdmin = role === 'admin';
  const isMaintainer = role === 'maintainer';
  const isSupervisor = role === 'supervisor';
  const isReporter = role === 'reporter';
  const isStudent = role === 'student';
  const canManageTickets = isAdmin || isMaintainer;
  const canSeeOversight = isAdmin || isSupervisor;
  const isBoardView = isAdmin || isMaintainer || isSupervisor || publicMode;

  const value = {
    initializing, currentUser, role, name, specialty, assignedBlocks, mustChangePassword, emailVerified,
    publicMode, authError, setAuthError,
    signIn, signUp, logout, forgotPassword, enterPublicMode, exitPublicMode,
    resendVerification, refreshVerification, changePassword,
    isAdmin, isMaintainer, isSupervisor, isReporter, isStudent, canManageTickets, canSeeOversight, isBoardView,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
