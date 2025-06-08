// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useWallet } from '@meshsdk/react'; // For wallet interactions
import { Address, AppWallet, Transaction, UTxO } from '@meshsdk/core'; // For address utilities if needed, AppWallet, Transaction, UTxO

// Define a type for our loan data for type safety
type LoanStatusAiken = {
  PendingAcceptance?: [];
  Active?: [];
  Paid?: [];
  Defaulted?: [];
};

type LoanDatum = {
  lender_pubkeyhash: string;
  borrower_pubkeyhash: string;
  loan_amount: number;
  interest_amount: number;
  deadline: number; // POSIX time (seconds)
  status: LoanStatusAiken;
};

type Loan = {
  id: string;
  created_at: string;
  lender_id: string;
  borrower_id: string;
  amount: number;
  status: 'pending_borrower_acceptance' | 'active' | 'paid' | 'defaulted' | 'rejected';
  description: string | null;
  // New Cardano related fields
  contract_address: string | null;
  contract_datum: LoanDatum | null;
  contract_tx_hash: string | null;
  collateral_amount: number | null;
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
  const { wallet, connected, connect: connectWallet } = useWallet(); // Get wallet status & connect
  const router = useRouter();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // General fetch error
  const [actionError, setActionError] = useState<string | null>(null); // For errors specific to actions
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({}); // Track submitting state per loan

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
          setActionError(null); // Clear previous action errors on fetch
          const { data, error: fetchError } = await supabase
            .from('loans')
            .select('*')
            .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`);

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

  const handleAcceptLoanOnChain = async (loan: Loan) => {
    if (!connected || !wallet) {
      setActionError("Please connect your wallet to accept the loan.");
      // Optionally try to connect: await connectWallet(); // Mesh might pick installed wallet
      return;
    }
    if (!loan.contract_address || !loan.contract_datum) {
      setActionError("Contract details are missing. Cannot proceed with on-chain acceptance.");
      return;
    }

    setIsSubmitting(prev => ({ ...prev, [loan.id]: true }));
    setActionError(null);

    try {
      const appWallet = new AppWallet({ networkId: 0, fetcher: wallet, submitter: wallet, key: wallet });

      // Borrower's signature is implicitly required by AppWallet instance being the borrower's wallet.
      // No need to explicitly get PKH here for the transaction itself, but good for validation if needed.

      const blueprintResponse = await fetch('/plutus.json');
      if (!blueprintResponse.ok) throw new Error("Failed to load contract blueprint. Ensure plutus.json is in /public.");
      const contractBlueprint = await blueprintResponse.json();
      const validatorDetails = contractBlueprint.validators.find((v: any) => v.title === "loan.spend");
      if (!validatorDetails) throw new Error("Could not find 'loan.spend' validator in blueprint.");
      const scriptCborHex = validatorDetails.compiledCode;

      const redeemer = { constructor: 0, fields: [] }; // For AcceptLoan

      const scriptAddress = loan.contract_address;
      // Fetch UTxOs at the script address. We need the one that matches our loan amount.
      // This is a simplification; robust UTXO selection is complex.
      const utxos = await appWallet.getUtxos({ address: scriptAddress });
      const scriptUtxo = utxos?.find(utxo =>
        utxo.output.amount.some(asset => asset.unit === 'lovelace' && parseInt(asset.quantity) === loan.contract_datum!.loan_amount) &&
        // Further check if datum matches, if multiple UTXOs could exist (not strictly needed if address is unique per loan)
        true
      );

      if (!scriptUtxo) {
        throw new Error(`No suitable UTXO found at ${scriptAddress} for loan amount ${loan.contract_datum.loan_amount}. It might have been spent or contract not properly funded.`);
      }

      const newDatum: LoanDatum = {
        ...loan.contract_datum,
        status: { "Active": [] },
      };

      const tx = new Transaction({ initiator: appWallet })
        .redeemValue({
          value: scriptUtxo as UTxO, // Cast because Mesh type might be generic
          script: { code: scriptCborHex, version: 'V2' },
          datum: loan.contract_datum,
          redeemer: redeemer,
        })
        .sendValue(Address.from_bech32(scriptAddress), scriptUtxo.output, { datum: { value: newDatum, inline: true } });
        // MeshSDK automatically includes required signers based on inputs.
        // If explicit signer needed: .setRequiredSigners([await appWallet.getChangeAddress()])

      const unsignedTx = await tx.build();
      const signedTx = await appWallet.signTx(unsignedTx, false);
      const txHash = await appWallet.submitTx(signedTx);

      const { error: updateError } = await supabase
        .from('loans')
        .update({ status: 'active', contract_datum: newDatum, contract_tx_hash: txHash })
        .eq('id', loan.id);

      if (updateError) {
        setActionError(`On-chain success (TX: ${txHash}), but DB update failed: ${updateError.message}`);
        // Don't revert UI for on-chain status to avoid confusion, but log error
        console.error("DB update failed after on-chain success:", updateError);
         setLoans(prevLoans => prevLoans.map(l => l.id === loan.id ? { ...l, status: 'active', contract_datum: newDatum, contract_tx_hash: txHash } : l));
      } else {
        setLoans(prevLoans => prevLoans.map(l => l.id === loan.id ? { ...l, status: 'active', contract_datum: newDatum, contract_tx_hash: txHash } : l));
        alert(`Loan accepted on-chain! TX: ${txHash}`);
      }

    } catch (err: any) {
      console.error("Accept Loan On-Chain Error:", err);
      let errorMsg = err.message || "Failed to accept loan on-chain.";
      if (err.info) errorMsg += ` Details: ${err.info}`;
      setActionError(errorMsg);
    } finally {
      setIsSubmitting(prev => ({ ...prev, [loan.id]: false }));
    }
  };

  const handleMarkAsPaidOnChain = async (loan: Loan) => {
    if (!connected || !wallet) {
      setActionError("Please connect your wallet to repay the loan.");
      return;
    }
    if (!loan.contract_address || !loan.contract_datum || !loan.contract_datum.lender_pubkeyhash) {
      setActionError("Contract details are missing or invalid. Cannot proceed with on-chain repayment.");
      return;
    }

    setIsSubmitting(prev => ({ ...prev, [loan.id]: true }));
    setActionError(null);

    try {
      // Initialize AppWallet for building and submitting the transaction
      const appWallet = new AppWallet({ networkId: 0, fetcher: wallet, submitter: wallet, key: wallet });

      // Load the smart contract blueprint
      const blueprintResponse = await fetch('/plutus.json');
      if (!blueprintResponse.ok) throw new Error("Failed to load contract blueprint.");
      const contractBlueprint = await blueprintResponse.json();
      const validatorDetails = contractBlueprint.validators.find((v: any) => v.title === "loan.spend");
      if (!validatorDetails) throw new Error("Could not find 'loan.spend' validator in blueprint.");
      const scriptCborHex = validatorDetails.compiledCode;

      // Define the RepayLoan redeemer
      const redeemer = { constructor: 1, fields: [] };

      const scriptAddress = loan.contract_address;
      // Fetch UTXOs at the script address to find the one to spend
      const utxos = await appWallet.getUtxos({ address: scriptAddress });
      const scriptUtxo = utxos?.find(utxo => {
        // Attempt to find the specific UTXO for this loan.
        // This check assumes the loan_amount in the datum is part of the UTXO's value.
        // More robust UTXO selection might involve specific tokens or more detailed datum checks if multiple loans share an address.
        return utxo.output.amount.some(asset => asset.unit === 'lovelace' && parseInt(asset.quantity) >= loan.contract_datum!.loan_amount);
      });

      if (!scriptUtxo) {
        throw new Error(`No suitable UTXO found at ${scriptAddress} for the loan. It might have been spent, already repaid, or contract not properly funded.`);
      }

      // Reconstruct lender's address from the PubKeyHash stored in the loan's datum
      // The Aiken validator ensures the payment goes to this address.
      const lenderAddress = Address.from_payment_credential(loan.contract_datum.lender_pubkeyhash, undefined, 0); // Using 0 for testnet prefix

      // Calculate the total repayment amount (loan + interest)
      const totalRepaymentAmount = (loan.contract_datum.loan_amount + loan.contract_datum.interest_amount).toString();

      // Prepare the new datum with status 'Paid'
      const newDatum: LoanDatum = {
        ...loan.contract_datum,
        status: { "Paid": [] },
      };

      const tx = new Transaction({ initiator: appWallet })
        .redeemValue({
          value: scriptUtxo as UTxO,
          script: { code: scriptCborHex, version: 'V2' },
          datum: loan.contract_datum, // Current datum of the UTXO being spent
          redeemer: redeemer,
        })
        .sendLovelace(lenderAddress, totalRepaymentAmount) // Pay the lender
        // Send a new UTXO back to the script address with 'Paid' status and minimal ADA.
        // This is one way to handle state changes. Another is the script terminates.
        // This requires the script to be able to handle this.
        .sendValue(Address.from_bech32(scriptAddress), "2000000", { datum: { value: newDatum, inline: true } }); // Min ADA (e.g., 2 ADA) to hold the datum

      const unsignedTx = await tx.build();
      const signedTx = await appWallet.signTx(unsignedTx, false);
      const txHash = await appWallet.submitTx(signedTx);

      const { error: updateError } = await supabase
        .from('loans')
        .update({ status: 'paid', contract_datum: newDatum, contract_tx_hash: txHash })
        .eq('id', loan.id);

      if (updateError) {
         setActionError(`On-chain repayment success (TX: ${txHash}), but DB update failed: ${updateError.message}`);
        console.error("DB update failed after on-chain repayment success:", updateError);
        setLoans(prevLoans => prevLoans.map(l => l.id === loan.id ? { ...l, status: 'paid', contract_datum: newDatum, contract_tx_hash: txHash } : l));
      } else {
        setLoans(prevLoans => prevLoans.map(l => l.id === loan.id ? { ...l, status: 'paid', contract_datum: newDatum, contract_tx_hash: txHash } : l));
        alert(`Loan repaid on-chain! TX: ${txHash}`);
      }

    } catch (err: any) {
      console.error("Repay Loan On-Chain Error:", err);
      let errorMsg = err.message || "Failed to repay loan on-chain.";
      if (err.info) errorMsg += ` Details: ${err.info}`;
      setActionError(errorMsg);
    } finally {
      setIsSubmitting(prev => ({ ...prev, [loan.id]: false }));
    }
  };

  const handleUpdateLoanStatus = async (loanId: string, newStatus: Loan['status']) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan || !user) return;

    if (newStatus === 'active' && loan.contract_address && loan.borrower_id === user.id) {
      await handleAcceptLoanOnChain(loan);
      return;
    }

    // Handle off-chain status updates (e.g., rejection)
    setIsSubmitting(prev => ({ ...prev, [loanId]: true }));
    setActionError(null);
    const originalLoans = [...loans];
    setLoans(prevLoans => prevLoans.map(l => l.id === loanId ? { ...l, status: newStatus } : l));

    try {
      const { error: updateError } = await supabase
        .from('loans')
        .update({ status: newStatus })
        .eq('id', loanId);

      if (updateError) {
        setLoans(originalLoans);
        throw updateError;
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update loan status.");
      setLoans(originalLoans);
    } finally {
      setIsSubmitting(prev => ({ ...prev, [loanId]: false }));
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
              {/* Display Cardano Contract Info */}
              {loan.contract_address && (
                <div style={{ marginTop: '10px', fontSize: '0.9em', borderTop: '1px dashed #eee', paddingTop: '10px' }}>
                  <p><strong>On-Chain Details:</strong></p>
                  <p>Contract Address: <a
                      href={`https://preprod.cardanoscan.io/address/${loan.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{color: '#007bff'}}
                    >
                      {loan.contract_address.substring(0,15)}...
                    </a>
                  </p>
                  {loan.contract_tx_hash && (
                    <p>Deployment TX: <a
                        href={`https://preprod.cardanoscan.io/transaction/${loan.contract_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{color: '#007bff'}}
                      >
                        {loan.contract_tx_hash.substring(0,15)}...
                      </a>
                    </p>
                  )}
                  {loan.contract_datum?.status && (
                    <p>On-Chain Status: {Object.keys(loan.contract_datum.status)[0]}</p>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p style={styles.noLoans}>You haven't lent out any money yet.</p>
        )}
      </section>

      <section>
        <h2 style={styles.sectionHeader}>Loans You've Lent</h2>
        {loansLent.length > 0 ? (
          loansLent.map(loan => (
            // ... existing JSX for lent loans, with new contract info display ...
            <div key={loan.id} style={styles.loanCard}>
              <div style={styles.loanDetails}>
                <div>Lent to: {loan.borrower_id}</div>
                <div style={styles.loanAmount}>${loan.amount}</div>
                <p>{loan.description}</p>
              </div>
              <div>
                Status: <span style={{ ...styles.loanStatus, backgroundColor: getStatusColor(loan.status) }}>
                  {loan.status.replace(/_/g, ' ')}
                </span>
              </div>
              {/* Display Cardano Contract Info for Borrowed Loans */}
              {loan.contract_address && (
                <div style={{ marginTop: '10px', fontSize: '0.9em', borderTop: '1px dashed #eee', paddingTop: '10px' }}>
                  <p><strong>On-Chain Details:</strong></p>
                  <p>Contract Address: <a
                      href={`https://preprod.cardanoscan.io/address/${loan.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{color: '#007bff'}}
                    >
                      {loan.contract_address.substring(0,15)}...
                    </a>
                  </p>
                  {loan.contract_tx_hash && (
                    <p>Deployment TX: <a
                        href={`https://preprod.cardanoscan.io/transaction/${loan.contract_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{color: '#007bff'}}
                      >
                        {loan.contract_tx_hash.substring(0,15)}...
                      </a>
                    </p>
                  )}
                  {loan.contract_datum?.status && (
                    <p>On-Chain Status: {Object.keys(loan.contract_datum.status)[0]}</p>
                  )}
                </div>
              )}
              {loan.status === 'pending_borrower_acceptance' && loan.borrower_id === user?.id && (
                <div style={styles.actions}>
                  <button
                    onClick={() => handleUpdateLoanStatus(loan.id, 'active')} // This will now call handleAcceptLoanOnChain if conditions met
                    style={{...styles.button, ...styles.acceptButton}}
                    disabled={isSubmitting[loan.id] || !connected}
                  >
                    {isSubmitting[loan.id] ? 'Processing...' : (connected ? 'Accept Loan (On-Chain)' : 'Connect Wallet to Accept')}
                  </button>
                  <button
                    onClick={() => handleUpdateLoanStatus(loan.id, 'rejected')}
                    style={{...styles.button, ...styles.rejectButton}}
                    disabled={isSubmitting[loan.id]}
                  >
                    Reject Loan (Off-Chain)
                  </button>
                </div>
              )}
              {loan.status === 'active' && loan.borrower_id === user?.id && ( // Ensure it's the borrower seeing this
                <div style={styles.actions}>
                  <button
                    onClick={() => handleMarkAsPaidOnChain(loan)}
                    style={{...styles.button, ...styles.payButton}}
                    disabled={isSubmitting[loan.id] || !connected || !loan.contract_address }
                  >
                    {isSubmitting[loan.id] ? 'Processing...' :
                      (!loan.contract_address ? 'On-Chain N/A' :
                        (connected ? 'Repay Loan (On-Chain)' : 'Connect Wallet to Repay'))}
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