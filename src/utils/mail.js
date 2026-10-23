import { addDoc } from 'firebase/firestore';
import { mailCol } from '../firebase';

// Emails beyond Firebase's built-in ones (verification, password reset) need Firebase's "Trigger Email from
// Firestore" extension, which needs the Blaze plan. Until that is installed this does nothing.
// After installing it (collection name: "mail"), set MAIL_ENABLED to true — see DOCUMENTATION.md > Emails.
export const MAIL_ENABLED = false;

export async function queueEmail({ to, subject, text }) {
  if (!MAIL_ENABLED || !to) return false;
  try {
    await addDoc(mailCol, { to, message: { subject, text } });
    return true;
  } catch (e) {
    console.error('could not queue email', e);
    return false;
  }
}
