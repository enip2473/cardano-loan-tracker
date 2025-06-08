// app/dashboard/page.tsx

// Basic styling (can be moved to a CSS file)


// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Import wagmi, ethers, and the contract artifact
import { useAccount } from 'wagmi';
import { useEthersSigner } from '../../hooks/useEthersSigner';
import { ethers } from 'ethers';
import { supabase } from '../../lib/supabaseClient';
import LoanAgreementArtifact from '../../lib/contracts/LoanAgreement.json';

// Updated type to match our new Supabase schema
type Loan = {
    id: string;
    created_at: string;
    lender_address: string;
    borrower_address: string;
    amount: number;
    interest: number;
    status: 'pending_borrower_acceptance' | 'active' | 'paid' | 'canceled' | 'rejected';
    description: string | null;
    contract_address: string;
};

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
    case 'rejected': return '#dc3545'; // red
    default: return '#6c757d'; // gray
  }
};

export default function DashboardPage() {
    // Replace AuthProvider with wagmi hooks
    const { address, isConnected } = useAccount();
    const signer = useEthersSigner();
    const router = useRouter();

    const [lentLoans, setLentLoans] = useState<Loan[]>([]);
    const [borrowedLoans, setBorrowedLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionError, setActionError] = useState<string | null>(null);
    const [submittingLoanId, setSubmittingLoanId] = useState<string | null>(null);

    // Refactored data fetching logic
    useEffect(() => {
        if (!isConnected || !address) {
            // If wallet disconnects, clear the loans
            setLentLoans([]);
            setBorrowedLoans([]);
            setLoading(false);
            return;
        }

        const fetchLoans = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('loans')
                .select('*')
                .or(`lender_address.ilike.${address},borrower_address.ilike.${address}`); // ilike for case-insensitive

            if (error) {
                setActionError(error.message);
            } else if (data) {
                // Filter locally to avoid complex queries
                const lent = data.filter(loan => loan.lender_address.toLowerCase() === address.toLowerCase());
                const borrowed = data.filter(loan => loan.borrower_address.toLowerCase() === address.toLowerCase());
                setLentLoans(lent);
                setBorrowedLoans(borrowed);
            }
            setLoading(false);
        };

        fetchLoans();
    }, [address, isConnected]);


    // --- On-Chain Interaction Functions ---

    const handleAcceptLoan = async (loan: Loan) => {
        if (!signer) {
            setActionError("Please connect your wallet.");
            return;
        }
        setActionError(null);
        setSubmittingLoanId(loan.id);

        try {
            const loanContract = new ethers.Contract(loan.contract_address, LoanAgreementArtifact.abi, signer);
            const tx = await loanContract.accept();
            await tx.wait(); // Wait for the transaction to be mined

            // If on-chain is successful, update our database
            const { error: updateError } = await supabase
                .from('loans')
                .update({ status: 'active' })
                .eq('id', loan.id);
            if (updateError) throw updateError;

            // Refresh local state
            setBorrowedLoans(loans => loans.map(l => l.id === loan.id ? { ...l, status: 'active' } : l));
            alert("Loan accepted successfully!");
        } catch (error: any) {
            console.error("Failed to accept loan:", error);
            setActionError(error.reason || "An error occurred while accepting the loan.");
        } finally {
            setSubmittingLoanId(null);
        }
    };

    const handleRepayLoan = async (loan: Loan) => {
        if (!signer) {
            setActionError("Please connect your wallet.");
            return;
        }
        setActionError(null);
        setSubmittingLoanId(loan.id);

        try {
            const loanContract = new ethers.Contract(loan.contract_address, LoanAgreementArtifact.abi, signer);
            const totalRepayment = ethers.parseEther((loan.amount + loan.interest).toString());

            const tx = await loanContract.repay({ value: totalRepayment });
            await tx.wait();

            // If on-chain is successful, update our database
            const { error: updateError } = await supabase
                .from('loans')
                .update({ status: 'paid' })
                .eq('id', loan.id);
            if (updateError) throw updateError;

            setBorrowedLoans(loans => loans.map(l => l.id === loan.id ? { ...l, status: 'paid' } : l));
            alert("Loan repaid successfully!");
        } catch (error: any) {
            console.error("Failed to repay loan:", error);
            setActionError(error.reason || "An error occurred during repayment.");
        } finally {
            setSubmittingLoanId(null);
        }
    };

    const handleCancelLoan = async (loan: Loan) => {
        if (!signer) {
            setActionError("Please connect your wallet.");
            return;
        }
        setActionError(null);
        setSubmittingLoanId(loan.id);

        try {
            const loanContract = new ethers.Contract(loan.contract_address, LoanAgreementArtifact.abi, signer);
            const tx = await loanContract.cancel();
            await tx.wait();

            const { error: updateError } = await supabase
                .from('loans')
                .update({ status: 'canceled' })
                .eq('id', loan.id);
            if (updateError) throw updateError;

            setLentLoans(loans => loans.map(l => l.id === loan.id ? { ...l, status: 'canceled' } : l));
            alert("Loan canceled successfully!");
        } catch (error: any) {
            console.error("Failed to cancel loan:", error);
            setActionError(error.reason || "An error occurred during cancellation.");
        } finally {
            setSubmittingLoanId(null);
        }
    };


    if (loading) return <p>Loading dashboard...</p>;

    return (
        <div style={styles.container}>
            <h1 style={styles.header}>Dashboard</h1>
            {actionError && <p style={styles.error}>{actionError}</p>}
            {!isConnected && <p>Please connect your wallet to view your loans.</p>}

            <section>
                <h2 style={styles.sectionHeader}>Loans You've Lent</h2>
                {isConnected && lentLoans.length > 0 ? (
                    lentLoans.map(loan => (
                        <div key={loan.id} style={styles.loanCard}>
                            <div style={styles.loanDetails}>
                                <div>Lent to: {`${loan.borrower_address.substring(0, 6)}...${loan.borrower_address.substring(loan.borrower_address.length - 4)}`}</div>
                                <div style={styles.loanAmount}>{loan.amount} ETH</div>
                                <p>{loan.description}</p>
                            </div>
                            <div>
                                Status: <span style={{ ...styles.loanStatus, backgroundColor: getStatusColor(loan.status) }}>{loan.status.replace(/_/g, ' ')}</span>
                            </div>
                            {loan.status === 'pending_borrower_acceptance' && (
                                <div style={styles.actions}>
                                    <button
                                        onClick={() => handleCancelLoan(loan)}
                                        disabled={submittingLoanId === loan.id}
                                        style={{...styles.button, ...styles.rejectButton}}
                                    >
                                        {submittingLoanId === loan.id ? 'Canceling...' : 'Cancel Loan'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <p style={styles.noLoans}>{isConnected ? "You haven't lent out any money yet." : ""}</p>
                )}
            </section>

            <section>
                <h2 style={styles.sectionHeader}>Loans You've Borrowed</h2>
                {isConnected && borrowedLoans.length > 0 ? (
                    borrowedLoans.map(loan => (
                        <div key={loan.id} style={styles.loanCard}>
                            <div style={styles.loanDetails}>
                                <div>Borrowed from: {`${loan.lender_address.substring(0, 6)}...${loan.lender_address.substring(loan.lender_address.length - 4)}`}</div>
                                <div style={styles.loanAmount}>{loan.amount} ETH</div>
                                <p>{loan.description}</p>
                            </div>
                            <div>
                                Status: <span style={{ ...styles.loanStatus, backgroundColor: getStatusColor(loan.status) }}>{loan.status.replace(/_/g, ' ')}</span>
                            </div>
                            {loan.status === 'pending_borrower_acceptance' && (
                                <div style={styles.actions}>
                                    <button
                                        onClick={() => handleAcceptLoan(loan)}
                                        disabled={submittingLoanId === loan.id}
                                        style={{...styles.button, ...styles.acceptButton}}
                                    >
                                        {submittingLoanId === loan.id ? 'Accepting...' : 'Accept Loan'}
                                    </button>
                                    {/* The old 'reject' button is removed as cancellation is handled by the lender */}
                                </div>
                            )}
                            {loan.status === 'active' && (
                                <div style={styles.actions}>
                                    <button
                                        onClick={() => handleRepayLoan(loan)}
                                        disabled={submittingLoanId === loan.id}
                                        style={{...styles.button, ...styles.payButton}}
                                    >
                                        {submittingLoanId === loan.id ? 'Repaying...' : 'Repay Loan'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <p style={styles.noLoans}>{isConnected ? "You don't have any borrowed loans." : ""}</p>
                )}
            </section>
        </div>
    );
}
