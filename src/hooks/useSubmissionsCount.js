import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { submissionsCol } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export function useSubmissionsCount() {
  const { currentUser, isAdmin, isReporter, assignedBlocks } = useAuth();
  const [count, setCount] = useState(0);
  const canReview = !!currentUser && (isAdmin || (isReporter && assignedBlocks.length > 0));

  useEffect(() => {
    if (!canReview) { setCount(0); return; }
    const q = isAdmin
      ? query(submissionsCol, where('status', '==', 'pending'))
      : query(submissionsCol, where('status', '==', 'pending'), where('block', 'in', assignedBlocks.slice(0, 10)));
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(0));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReview, isAdmin, currentUser, assignedBlocks]);

  return { count, canReview };
}
