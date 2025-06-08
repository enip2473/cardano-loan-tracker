# Manual Integration Test Cases

This document outlines step-by-step procedures for manually testing the core loan lifecycle and error scenarios on the Cardano testnet (e.g., Preprod or Preview) using the deployed application.

**Pre-requisites for Testers:**
- Two separate Cardano testnet wallets (e.g., Nami, Eternl) with some test ADA. These will represent User A (Lender) and User B (Borrower).
- Access to the deployed web application.
- Familiarity with using a Cardano testnet explorer (e.g., Cardanoscan for Preprod/Preview) to check transaction details and contract datums.

## Test Case 1: Full Loan Lifecycle

This test case covers the entire process from loan creation to repayment.

**User A: Lender**
1.  **Connect Wallet (Lender):**
    -   Open the application.
    -   Click on the wallet connection UI (e.g., "Connect Wallet" or the `CardanoWallet` component in the Navbar).
    -   Select User A's wallet and approve the connection.
    -   Verify that User A's wallet address and network are displayed correctly.
2.  **Create New Loan (Lender):**
    -   Navigate to the "Create Loan" page.
    -   Fill in the form:
        -   **Borrower's User ID:** Enter a valid Supabase User ID for User B (this requires User B to be registered in the application).
        -   **Borrower's Cardano Address:** Enter User B's Cardano testnet wallet address.
        -   **Amount (in USD/ADA):** Enter a loan amount (e.g., 10 ADA).
        -   **Description:** Add a brief description for the loan.
    -   Click "Create Loan".
    -   User A's wallet will prompt for a signature to deploy the smart contract and lock the funds. Approve the transaction.
    -   **Verification (Lender):**
        -   After submission, check for a success message or redirection to the dashboard.
        -   On the dashboard, find the newly created loan under "Loans You've Lent".
        -   Verify that `contract_address`, `contract_tx_hash`, and on-chain status (`PendingAcceptance` in datum) are displayed.
        -   Click the `contract_tx_hash` link to view the deployment transaction on Cardanoscan. Confirm the transaction details, including the locked amount and the initial datum at the script address.
        -   Check the Supabase `loans` table to confirm the new loan record with all Cardano-specific fields populated.

**User B: Borrower**
3.  **Connect Wallet (Borrower):**
    -   Log out User A from the application (if applicable, or use a different browser/incognito window).
    -   User B logs into the application.
    -   User B connects their Cardano wallet (User B's wallet).
    -   Verify User B's wallet address and network.
4.  **View Loan Offer (Borrower):**
    -   Navigate to the dashboard.
    -   User B should see the loan offer from User A under "Loans You've Borrowed" with the status `pending_borrower_acceptance`.
    -   Verify the displayed loan amount, lender, description, and on-chain contract details.
5.  **Accept Loan (Borrower):**
    -   Click the "Accept Loan (On-Chain)" button for the loan offer.
    -   User B's wallet will prompt for a signature to interact with the smart contract (spending the initial UTXO and creating a new one with updated datum). Approve the transaction.
    -   **Verification (Borrower & Lender):**
        -   After submission, check for a success message.
        -   The loan status on User B's dashboard should update to `Active` (both off-chain and on-chain via `contract_datum.status`).
        -   User A (checking their dashboard separately) should also see the loan status updated to `Active` with the new on-chain datum.
        -   Check Cardanoscan for the new transaction hash (should be updated in the loan details). Verify the transaction inputs/outputs and the updated datum at the script address (status should be `Active`).
        -   Verify Supabase `loans` table: `status` is `active`, `contract_datum` reflects the `Active` state, and `contract_tx_hash` is updated.

**User B: Borrower**
6.  **Repay Loan (Borrower):**
    -   On User B's dashboard, for the active loan, click the "Repay Loan (On-Chain)" button.
    -   User B's wallet will prompt for a signature. This transaction will pay the lender and update the contract datum to `Paid`. Approve the transaction.
    -   **Verification (Borrower & Lender):**
        -   After submission, check for a success message.
        -   The loan status on User B's dashboard should update to `Paid`.
        -   User A (checking their dashboard) should also see the loan status updated to `Paid`.
        -   Check User A's wallet on Cardanoscan to confirm receipt of the `loan_amount + interest_amount`.
        -   Check Cardanoscan for the repayment transaction. Verify inputs/outputs, payment to lender, and the updated datum at the script address (status should be `Paid`).
        -   Verify Supabase `loans` table: `status` is `paid`, `contract_datum` reflects `Paid` state, `contract_tx_hash` is updated.

**User A: Lender**
7.  **Confirm Loan Repayment (Lender):**
    -   User A views their dashboard. The loan should be clearly marked as `Paid`.
    -   The on-chain status should also reflect `Paid`.
    -   User A has already received the funds in their wallet as part of the borrower's `RepayLoan` transaction.

## Test Case 2: Error Scenarios

1.  **Attempting Actions Without Connected Wallet:**
    -   Log out of any connected wallet in the application.
    -   Try to "Create Loan". Expect an error message prompting to connect a wallet.
    -   As User B, find a loan offer. Try to "Accept Loan". Expect an error/button disabled state prompting for wallet connection.
    -   As User B, find an active loan. Try to "Repay Loan". Expect an error/button disabled state.

2.  **Attempting to Accept Loan with Wrong Wallet:**
    -   User A creates a loan for User B.
    -   A third user, User C, connects their wallet.
    -   User C (impersonating User B by logging into User B's app account, if auth is separate) attempts to accept the loan meant for User B.
    -   **Expected:** The on-chain transaction should fail because the smart contract's `AcceptLoan` validator requires the signature of the `borrower_pubkeyhash` specified in the datum. The application should display an error message from the wallet/Mesh SDK.

3.  **Attempting to Repay Loan with Insufficient Funds:**
    -   User B has an active loan but their connected wallet does not have enough ADA to cover the repayment amount + transaction fees.
    -   User B clicks "Repay Loan (On-Chain)".
    -   **Expected:** The transaction building phase by Mesh SDK or the wallet itself should fail before reaching the smart contract. The application should display an error message indicating insufficient funds or a transaction build failure.

4.  **Invalid Borrower Cardano Address during Loan Creation:**
    -   User A attempts to create a loan.
    -   Enters an invalid or malformed Cardano address for the borrower.
    -   **Expected:** The application should display an error message during the `handleSubmit` phase when trying to derive the PubKeyHash from the invalid address, before attempting any on-chain transaction.

---

These manual tests, combined with Aiken unit tests and frontend unit tests, provide a good level of confidence in the application's functionality. Remember to use distinct wallet accounts for Lender and Borrower roles to accurately simulate the interactions.
