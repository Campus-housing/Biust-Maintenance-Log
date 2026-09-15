import { initializeApp } from 'firebase/app';
import { getFirestore, collection } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig';

export const configMissing = !firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// A second, isolated Firebase app instance — used ONLY so an admin can create
// a maintainer/supervisor login without being signed out of their own session.
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
export const secondaryAuth = getAuth(secondaryApp);

export const ticketsCol = collection(db, 'tickets');
export const usersCol = collection(db, 'users');
export const publicBoardCol = collection(db, 'publicBoard');
export const submissionsCol = collection(db, 'submissions');
