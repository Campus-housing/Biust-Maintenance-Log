import { useEffect, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { ticketsCol, publicBoardCol } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export function useTickets() {
  const { currentUser, role, specialty, publicMode, canSeeOversight, isMaintainer } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!publicMode && !currentUser) {
      setTickets([]);
      return;
    }
    if (!publicMode && role === 'student') {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q;
    if (publicMode) {
      q = publicBoardCol;
    } else if (canSeeOversight) {
      q = ticketsCol;
    } else if (isMaintainer) {
      q = specialty && specialty !== 'all' ? query(ticketsCol, where('category', '==', specialty)) : ticketsCol;
    } else {
      q = query(ticketsCol, where('reportedByUid', '==', currentUser.uid));
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(err);
        setError('Could not load the log. Check your connection.');
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicMode, currentUser, role, specialty, canSeeOversight, isMaintainer]);

  return { tickets, loading, error };
}
