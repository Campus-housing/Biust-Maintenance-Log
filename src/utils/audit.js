import { addDoc } from 'firebase/firestore';
import { auditCol } from '../firebase';

// Append-only record of admin actions (who did what to whom, and when). Only admins can write or read it.
export async function logAudit(actor, actorName, action, detail = {}) {
  try {
    await addDoc(auditCol, { at: new Date().toISOString(), byUid: actor.uid, byName: actorName || actor.email || '', action, ...detail });
  } catch (e) {
    console.error('audit log failed', e);
  }
}
