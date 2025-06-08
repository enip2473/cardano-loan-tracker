// app/create-loan/page.tsx
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjust path as needed
import { supabase } from '../../lib/supabaseClient'; // Adjust path as needed
import { useRouter } from 'next/navigation';
import { useWallet } from '@meshsdk/react'; // Using direct import
import { AppWallet, Asset, Transaction, Address } from '@meshsdk/core';
import type { UTxO } from '@meshsdk/core'; // Import UTxO type

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
  const { wallet, connected, connect: connectWallet, name: walletName } = useWallet(); // Mesh SDK wallet hook
  const router = useRouter();

  // Simplified Form state
  const [borrowerId, setBorrowerId] = useState('');
  const [borrowerCardanoAddress, setBorrowerCardanoAddress] = useState(''); // New state for borrower's Cardano address
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

    if (!connected) {
      setFormError("Please connect your Cardano wallet first.");
      // Optionally, trigger wallet connection programmatically if desired
      // For now, we assume user connects via WalletConnect component in Navbar
      // try {
      //   await connectWallet(walletName); // Example, might need specific wallet name
      // } catch (error) {
      //   setFormError("Failed to connect wallet. Please try again.");
      //   setIsSubmitting(false);
      //   return;
      // }
      setIsSubmitting(false);
      return;
    }

    if (!borrowerId || !principalAmount || !borrowerCardanoAddress) {
      setFormError("Please fill in all required fields: Borrower's User ID, Borrower's Cardano Address, and loan amount.");
      setIsSubmitting(false);
      return;
    }

    if (borrowerId === user.id) {
      setFormError("You cannot create a loan with yourself as the borrower.");
      setIsSubmitting(false);
      return;
    }

    try {
      const appWallet = new AppWallet({
        networkId: 0, // 0 for Testnet, 1 for Mainnet
        fetcher: wallet, // Mesh SDK wallet object
        submitter: wallet,
        key: wallet,
      });

      // 1. Get Lender's PubKeyHash
      const lenderAddresses = await wallet.getUsedAddresses();
      if (!lenderAddresses || lenderAddresses.length === 0) {
        throw new Error("Could not get your wallet address. Ensure your wallet is set up correctly.");
      }
      const lenderAddrObj = Address.from_bech32(lenderAddresses[0]);
      const lenderPubKeyHash = lenderAddrObj.to_pub_key_hash()?.to_hex(); // Or .to_bytes() if Aiken expects bytes directly
      if (!lenderPubKeyHash) {
        throw new Error("Could not derive Public Key Hash from your wallet address.");
      }

      // 2. Get Borrower's PubKeyHash from input address
      let borrowerPubKeyHashHex;
      try {
        const borrowerAddrObj = Address.from_bech32(borrowerCardanoAddress);
        borrowerPubKeyHashHex = borrowerAddrObj.to_pub_key_hash()?.to_hex();
        if (!borrowerPubKeyHashHex) {
          throw new Error(); // Caught by the same catch block
        }
      } catch (error) {
        throw new Error("Invalid Borrower's Cardano Address provided.");
      }

      // 3. Construct Datum
      const loanAmountLovelace = parseFloat(principalAmount) * 1_000_000; // Convert ADA to Lovelace
      const interestAmountLovelace = 0; // For now, 0 interest
      const deadline = new Date().getTime() + 30 * 24 * 60 * 60 * 1000; // 30 days from now (POSIX time in ms)
                                                                        // Aiken might expect seconds, adjust if needed

      const loanDatum = {
        lender_pubkeyhash: lenderPubKeyHash, // This needs to be hex string of PKH
        borrower_pubkeyhash: borrowerPubKeyHashHex, // This needs to be hex string of PKH
        loan_amount: loanAmountLovelace,
        interest_amount: interestAmountLovelace,
        deadline: Math.floor(deadline / 1000), // POSIX time in seconds for Aiken
        status: { "PendingAcceptance": [] }, // Aiken's enum representation (adjust if different)
      };

      // 4. Load Aiken Contract Blueprint
      // This needs to happen server-side or at build time if using Next.js app router.
      // For client-side, we'd fetch it. Assume it's in public folder for now for demo.
      const blueprintResponse = await fetch('/plutus.json'); // Assumes plutus.json is in public/
      if (!blueprintResponse.ok) {
        throw new Error("Failed to load smart contract blueprint. Make sure plutus.json is in the public folder.");
      }
      const contractBlueprint = await blueprintResponse.json();
      const validator = contractBlueprint.validators.find((v: any) => v.title === "loan.spend");
      if (!validator) {
        throw new Error("Could not find the 'loan.spend' validator in plutus.json");
      }
      const scriptCborHex = validator.compiledCode;

      // 5. Build Deployment Transaction
      const tx = new Transaction({ initiator: appWallet });
      tx.sendLovelace(
        {
          address: Address.from_bech32(appWallet.getPaymentAddress(scriptCborHex)), // Get script address
          datum: {
            value: loanDatum, // Datum object
            inline: true,    // Inline datum
          },
        },
        loanAmountLovelace.toString() // Amount to lock at the script
      );
      // Note: Mesh SDK might automatically add collateral if needed for Plutus V2 scripts.
      // Or you might need to add it explicitly:
      // const utxos = await appWallet.getUtxos();
      // if (!utxos || utxos.length === 0) throw new Error("No UTXOs found for collateral.");
      // tx.setCollateral(utxos as UTxO[]);


      const unsignedTx = await tx.build();

      // 6. Sign and Submit Transaction
      const signedTx = await appWallet.signTx(unsignedTx, false); // false for partial sign if needed, true for full
      const txHash = await appWallet.submitTx(signedTx);

      // 7. Get Contract Address (already derived for tx.sendLovelace)
      const contractAddress = appWallet.getPaymentAddress(scriptCborHex);

      // 8. Update Supabase `loans` Table
      const loanDataToSave = {
        lender_id: user.id,
        borrower_id: borrowerId, // Supabase User ID
        amount: parseFloat(principalAmount), // Original amount in ADA/USD for display
        description: description || null,
        status: 'pending_borrower_acceptance', // Off-chain status
        collateral_amount: 0, // Assuming no collateral for now
        // Cardano specific fields
        contract_address: contractAddress,
        contract_datum: loanDatum, // Save the full datum
        contract_tx_hash: txHash,
      };

      const { error: insertError } = await supabase.from('loans').insert([loanDataToSave]);
      if (insertError) {
        // Attempt to roll back or notify about failed Supabase update if contract deployed
        console.error("Contract deployed but Supabase update failed:", insertError, "TX HASH:", txHash);
        throw new Error(`Contract deployed (TX: ${txHash}) but failed to save loan details to database: ${insertError.message}. Please record the transaction hash.`);
      }

      router.push('/dashboard'); // Success
    } catch (error: any) {
      console.error("Error creating loan and deploying contract:", error);
      let errorMessage = "Failed to create loan and deploy contract.";
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      // More specific error parsing from Mesh/Cardano can be added here
      if (error.info) { // MeshSDK often includes an 'info' field
        errorMessage += ` Details: ${error.info}`;
      }
      setFormError(errorMessage);
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
          <label htmlFor="borrowerCardanoAddress" style={styles.label}>Borrower's Cardano Address</label>
          <input
            type="text"
            id="borrowerCardanoAddress"
            placeholder="Enter the borrower's Cardano wallet address (e.g., addr_test...)"
            value={borrowerCardanoAddress}
            onChange={(e) => setBorrowerCardanoAddress(e.target.value)}
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