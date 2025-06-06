// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

// Define a type for our loan data for type safety
type Loan = {
  id: string;
  created_at: string;
  lender_id: string;
  borrower_id: string;
  amount: number;
  status: 'pending_borrower_acceptance' | 'active' | 'paid' | 'defaulted' | 'rejected';
  description: string | null;
};

// Basic styling (can be moved to a CSS file)
const styles = {
  container: { maxWidth: '800px', margin: '50px auto', padding: '20px' },
  header: { fontSize: '2rem', marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px' },
  sectionHeader: { fontSize: '1.5rem', marginTop: '30px', marginBottom: '15px' },
  loanCard: { border: '1px solid #ddd', borderRadius: '8px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  loanDetails: { marginBottom: '10px' },
  loanAmount: { fontSize: '1.2rem', fontWeight: 'bold' },
  loanStatus: { display: 'inline-block', padding: '4px 8px', borderRadius: '12px', color: 'white', textTransform: 'capitalize' },
  actions: { marginTop: '10px', display: 'flex', gap: '10px' },
  button: { padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  acceptButton: { backgroundColor: '#28a745' /* green */, color: 'white' },
  rejectButton: { backgroundColor: '#dc3545' /* red */, color: 'white' },
  error: { color: 'red' },
  noLoans: { color: '#666', marginTop: '20px' },
  payButton: { backgroundColor: '#007bff', color: 'white' }, // <-- NEW STYLE
} as const;

// Helper to get status color
const getStatusColor = (status: Loan['status']) => {
  switch (status) {
    case 'pending_borrower_acceptance': return '#ffc107'; // yellow
    case 'active': return '#007bff'; // blue
    case 'paid': return '#28a745'; // green
    case 'rejected':
    case 'defaulted': return '#dc3545'; // red
    default: return '#6c757d'; // gray
  }
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not logged in
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      const fetchLoans = async () => {
        try {
          setLoading(true);
          const { data, error: fetchError } = await supabase
            .from('loans')
            .select('*')
            .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`); // Fetch if user is lender OR borrower

          if (fetchError) throw fetchError;

          setLoans(data || []);
        } catch (err: any) {
          setError(err.message || "Failed to fetch loans.");
        } finally {
          setLoading(false);
        }
      };
      fetchLoans();
    }
  }, [user, authLoading, router]);

// Inside your DashboardPage component in app/dashboard/page.tsx

  const handleUpdateLoanStatus = async (loanId: string, newStatus: Loan['status']) => {
    // Optimistically update the UI first for a snappy user experience
    const originalLoans = [...loans];
    const updatedLoans = loans.map(l => 
      l.id === loanId ? { ...l, status: newStatus } : l
    );
    setLoans(updatedLoans);

    try {
      const { error: updateError } = await supabase
        .from('loans')
        .update({ status: newStatus })
        .eq('id', loanId);

      if (updateError) {
        // If the update fails, revert the UI change and show an error
        setLoans(originalLoans);
        throw updateError;
      }
    } catch (err: any) {
      setError(err.message || "Failed to update loan status.");
      // Revert UI on error
      setLoans(originalLoans);
    }
  };

  if (authLoading || loading) {
    return <p>Loading dashboard...</p>;
  }

  if (error) {
    return <p style={styles.error}>{error}</p>;
  }

  const loansLent = loans.filter(loan => loan.lender_id === user?.id);
  const loansBorrowed = loans.filter(loan => loan.borrower_id === user?.id);

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Dashboard</h1>

      <section>
        <h2 style={styles.sectionHeader}>Loans You've Lent</h2>
        {loansLent.length > 0 ? (
          loansLent.map(loan => (
            <div key={loan.id} style={styles.loanCard}>
              <div style={styles.loanDetails}>
                <div>Lent to: {loan.borrower_id}</div>
                {/* Note: To show an email here instead of an ID, we'd need the `profiles` table setup we skipped earlier. */}
                <div style={styles.loanAmount}>${loan.amount}</div>
                <p>{loan.description}</p>
              </div>
              <div>
                Status: 
                <span style={{ ...styles.loanStatus, backgroundColor: getStatusColor(loan.status) }}>
                  {loan.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p style={styles.noLoans}>You haven't lent out any money yet.</p>
        )}
      </section>

      <section>
        <h2 style={styles.sectionHeader}>Loans You've Borrowed</h2>
        {loansBorrowed.length > 0 ? (
          loansBorrowed.map(loan => (
            <div key={loan.id} style={styles.loanCard}>
              <div style={styles.loanDetails}>
                <div>Borrowed from: {loan.lender_id}</div>
                <div style={styles.loanAmount}>${loan.amount}</div>
                <p>{loan.description}</p>
              </div>
              <div>
                Status: <span style={{ ...styles.loanStatus, backgroundColor: getStatusColor(loan.status) }}>
                  {loan.status.replace(/_/g, ' ')}
                </span>
              </div>
              {loan.status === 'pending_borrower_acceptance' && (
                <div style={styles.actions}>
                  <button
                    onClick={() => handleUpdateLoanStatus(loan.id, 'active')}
                    style={{...styles.button, ...styles.acceptButton}}
                  >
                    Accept Loan
                  </button>
                  <button
                    onClick={() => handleUpdateLoanStatus(loan.id, 'rejected')}
                    style={{...styles.button, ...styles.rejectButton}}
                  >
                    Reject Loan
                  </button>
                </div>
              )}
              {loan.status === 'active' && (
                <div style={styles.actions}>
                  <button
                    onClick={() => handleUpdateLoanStatus(loan.id, 'paid')}
                    style={{...styles.button, ...styles.payButton}}
                  >
                    Mark as Paid
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p style={styles.noLoans}>You haven't borrowed any money.</p>
        )}
      </section>
    </div>
  );
}