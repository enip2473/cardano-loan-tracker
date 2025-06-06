// app/create-loan/page.tsx
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjust path as needed
import { supabase } from '../../lib/supabaseClient'; // Adjust path as needed
import { useRouter } from 'next/navigation';

// Basic styling (can be moved to CSS)
const styles = {
  container: { maxWidth: '600px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  formGroup: { marginBottom: '15px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
  input: { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' as 'border-box' },
  textarea: { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', boxSizing: 'border-box' as 'border-box' },
  button: { width: '100%', padding: '10px 15px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' },
  error: { color: 'red', marginBottom: '10px' },
};

export default function CreateLoanPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Simplified Form state
  const [borrowerId, setBorrowerId] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [description, setDescription] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (!user) {
      setFormError("You must be logged in to create a loan.");
      setIsSubmitting(false);
      return;
    }

    if (!borrowerId || !principalAmount) {
      setFormError("Please fill in the Borrower's User ID and the loan amount.");
      setIsSubmitting(false);
      return;
    }

    if (borrowerId === user.id) {
        setFormError("You cannot create a loan with yourself as the borrower.");
        setIsSubmitting(false);
        return;
    }

    // Construct the simplified loan data, with defaults for required fields
    const loanData = {
      lender_id: user.id,
      borrower_id: borrowerId,
      amount: parseFloat(principalAmount),
      description: description || null,
      status: 'pending_borrower_acceptance',
    };

    try {
      const { error: insertError } = await supabase.from('loans').insert([loanData]);
      if (insertError) {
        // Provide more helpful error for foreign key violation
        if (insertError.code === '23503') { // Foreign key violation
            throw new Error("Could not create loan. The Borrower User ID may not exist.");
        }
        throw insertError;
      }
      // Success! Redirect to the dashboard.
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Error creating loan:", error);
      setFormError(error.message || "Failed to create loan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <p>Loading...</p>;
  }

  return (
    <div style={styles.container}>
      <h2>Create New Loan</h2>
      <p>Propose a new loan to another user.</p>
      <br/>
      <form onSubmit={handleSubmit}>
        {formError && <p style={styles.error}>{formError}</p>}

        <div style={styles.formGroup}>
          <label htmlFor="borrowerId" style={styles.label}>Borrower's User ID</label>
          <input
            type="text" // Inputting the UUID directly
            id="borrowerId"
            placeholder="Paste the borrower's Supabase User ID here"
            value={borrowerId}
            onChange={(e) => setBorrowerId(e.target.value)}
            style={styles.input}
            required
            disabled={isSubmitting}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="principalAmount" style={styles.label}>Amount (in USD)</label>
          <input
            type="number"
            id="principalAmount"
            placeholder="e.g., 500.00"
            value={principalAmount}
            onChange={(e) => setPrincipalAmount(e.target.value)}
            style={styles.input}
            min="0.01"
            step="0.01"
            required
            disabled={isSubmitting}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="description" style={styles.label}>Description</label>
          <textarea
            id="description"
            placeholder="e.g., Lunch money, project supplies"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            required
            disabled={isSubmitting}
          />
        </div>

        <button type="submit" style={styles.button} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Loan...' : 'Create Loan'}
        </button>
      </form>
    </div>
  );
}