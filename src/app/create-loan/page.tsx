// app/create-loan/page.tsx
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

// Import wagmi hooks for wallet state and ethers for contract interaction
import { useAccount } from 'wagmi';
import { useEthersSigner } from '../../hooks/useEthersSigner'; // Make sure this hook is created as per previous instructions
import { ethers } from 'ethers';
import LoanAgreementArtifact from '../../lib/contracts/LoanAgreement.json';

// Basic styling
const styles = {
    container: { maxWidth: '600px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' as 'border-box' },
    textarea: { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', boxSizing: 'border-box' as 'border-box' },
    button: { width: '100%', padding: '10px 15px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' },
    disabledButton: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    error: { color: 'red', marginBottom: '10px' },
};


export default function CreateLoanPage() {
    const router = useRouter();

    // Get wallet state directly from wagmi
    const { address: lenderAddress, isConnected } = useAccount();
    const signer = useEthersSigner();

    // Form state no longer needs Supabase user IDs
    const [borrowerAddress, setBorrowerAddress] = useState('');
    const [principalAmount, setPrincipalAmount] = useState('');
    const [interestAmount, setInterestAmount] = useState('0');
    const [acceptancePeriod, setAcceptancePeriod] = useState('604800');
    const [description, setDescription] = useState('');

    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError(null);

        // Pre-flight checks are now simpler
        if (!isConnected || !signer || !lenderAddress) {
            setFormError("Please connect your wallet to create a loan.");
            return;
        }
        if (!borrowerAddress || !principalAmount) {
            setFormError("Please provide the borrower's ETH address and a loan amount.");
            return;
        }
        if (borrowerAddress.toLowerCase() === lenderAddress.toLowerCase()) {
            setFormError("Borrower address cannot be the same as your own.");
            return;
        }
        if (!ethers.isAddress(borrowerAddress)) {
            setFormError("The borrower address is not a valid Ethereum address.");
            return;
        }

        setIsSubmitting(true);

        try {
            // Contract deployment logic remains the same
            const LoanFactory = new ethers.ContractFactory(LoanAgreementArtifact.abi, LoanAgreementArtifact.bytecode, signer);
            const principalInWei = ethers.parseEther(principalAmount);
            const interestInWei = ethers.parseEther(interestAmount);

            const loanContract = await LoanFactory.deploy(
                borrowerAddress,
                interestInWei,
                parseInt(acceptancePeriod),
                { value: principalInWei }
            );
            await loanContract.waitForDeployment();
            const deployedContractAddress = await loanContract.getAddress();
            const deploymentTxHash = loanContract.deploymentTransaction()?.hash;

            // The data object for Supabase is now simpler and more direct
            const loanData = {
                lender_address: lenderAddress, // From wagmi's useAccount hook
                borrower_address: borrowerAddress, // From form input
                amount: parseFloat(principalAmount),
                interest: parseFloat(interestAmount),
                status: 'pending_borrower_acceptance',
                description: description || null,
                contract_address: deployedContractAddress,
                contract_tx_hash: deploymentTxHash,
                network: 'sepolia',
            };

            const { error: insertError } = await supabase.from('loans').insert([loanData]);
            if (insertError) throw insertError;

            alert("Loan contract deployed successfully!");
            router.push('/dashboard');

        } catch (error: any) {
            console.error("Deployment failed:", error);
            const userFriendlyError = error.reason || error.message || "An unknown error occurred.";
            setFormError(`Failed to deploy contract: ${userFriendlyError}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={styles.container}>
            <h2>Create New Loan on Sepolia</h2>
            <p>Propose a new loan by deploying a unique smart contract.</p>
            <br/>
            <form onSubmit={handleSubmit}>
                {formError && <p style={styles.error}>{formError}</p>}

                <div style={styles.formGroup}>
                    <label htmlFor="borrowerAddress" style={styles.label}>Borrower's Ethereum Address</label>
                    <input
                        type="text"
                        id="borrowerAddress"
                        placeholder="0x..."
                        value={borrowerAddress}
                        onChange={(e) => setBorrowerAddress(e.target.value)}
                        style={styles.input}
                        required
                        disabled={isSubmitting}
                    />
                </div>

                <div style={styles.formGroup}>
                    <label htmlFor="principalAmount" style={styles.label}>Principal Amount (in ETH)</label>
                    <input
                        type="number"
                        id="principalAmount"
                        placeholder="e.g., 0.5"
                        value={principalAmount}
                        onChange={(e) => setPrincipalAmount(e.target.value)}
                        style={styles.input}
                        min="0.00001"
                        step="0.00001"
                        required
                        disabled={isSubmitting}
                    />
                </div>

                <div style={styles.formGroup}>
                    <label htmlFor="interestAmount" style={styles.label}>Interest Amount (in ETH)</label>
                    <input
                        type="number"
                        id="interestAmount"
                        value={interestAmount}
                        onChange={(e) => setInterestAmount(e.target.value)}
                        style={styles.input}
                        min="0"
                        step="0.00001"
                        required
                        disabled={isSubmitting}
                    />
                </div>

                <div style={styles.formGroup}>
                    <label htmlFor="description" style={styles.label}>Description (Optional)</label>
                    <textarea
                        id="description"
                        placeholder="e.g., Project funding"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={styles.textarea}
                        disabled={isSubmitting}
                    />
                </div>

                <button
                    type="submit"
                    style={{...styles.button, ...(isSubmitting || !isConnected ? styles.disabledButton : {})}}
                    disabled={isSubmitting || !isConnected}
                >
                    {isSubmitting ? 'Deploying to Sepolia...' : (isConnected ? 'Create Loan Contract' : 'Connect Wallet to Continue')}
                </button>
            </form>
        </div>
    );
}
