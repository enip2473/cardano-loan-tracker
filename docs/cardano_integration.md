# Cardano Smart Contract Integration (Frontend)

This document details the frontend integration for deploying the Aiken loan smart contract from the application. The primary focus is on the `CreateLoanPage` component.

## 1. Overview of Contract Deployment Flow

When a lender creates a new loan and submits the form:

1.  **Wallet Connection Check**: The system verifies if the user's (lender's) Cardano wallet is connected.
2.  **Input Validation**: Ensures all required fields, including the new "Borrower's Cardano Address", are filled.
3.  **Public Key Hash Derivation**:
    *   **Lender's PubKeyHash**: Derived from the connected lender's wallet address using Mesh SDK utilities.
    *   **Borrower's PubKeyHash**: Derived from the "Borrower's Cardano Address" input field using Mesh SDK utilities.
4.  **Datum Construction**: The initial `LoanDatum` for the Aiken smart contract is constructed using:
    *   Lender's and Borrower's PubKeyHashes.
    *   Loan amount (converted to Lovelace).
    *   Interest amount (currently set to 0).
    *   Deadline (calculated as 30 days from the current time, converted to POSIX seconds).
    *   Initial status: `PendingAcceptance`.
5.  **Load Contract Blueprint**: The compiled Aiken contract blueprint (`plutus.json`) is fetched from the `public` directory. This file contains the `cborHex` of the validator script.
6.  **Transaction Building (Mesh SDK)**:
    *   An `AppWallet` instance is initialized with the connected wallet.
    *   A new transaction is created using `Transaction({ initiator: appWallet })`.
    *   The transaction sends the loan amount (in Lovelace) to the script address.
    *   The script address is derived using `appWallet.getPaymentAddress(scriptCborHex)`.
    *   The constructed `LoanDatum` is included inline in the transaction output sent to the script address.
    *   Collateral is implicitly handled by Mesh SDK for Plutus V2 scripts if needed or can be set explicitly.
7.  **Sign and Submit**:
    *   The user is prompted to sign the transaction via their connected wallet.
    *   The signed transaction is submitted to the Cardano network (Testnet by default).
8.  **Store Contract Details**:
    *   Upon successful transaction submission, the derived contract address and the transaction hash are retrieved.
    *   The loan details, along with `contract_address`, the full `contract_datum` (as JSON), and `contract_tx_hash`, are saved to the `loans` table in Supabase.
9.  **User Feedback**: The user is redirected to their dashboard on success, or an error message is displayed if any step fails.

## 2. Key Components and Logic in `src/app/create-loan/page.tsx`

### a. State Management

-   New state variable `borrowerCardanoAddress` to store the input for the borrower's address.
-   Existing states for `borrowerId` (Supabase User ID), `principalAmount`, `description`, `formError`, and `isSubmitting`.

### b. Wallet and Transaction Hooks/Classes

-   `useWallet()` from `@meshsdk/react`: To access connected wallet information (`wallet`, `connected`), and connection functions.
-   `AppWallet` from `@meshsdk/core`: Used to instantiate a wallet object for building and submitting transactions.
-   `Transaction` from `@meshsdk/core`: Used for constructing the deployment transaction.
-   `Address` from `@meshsdk/core`: Used for address manipulation and PubKeyHash derivation.

### c. `handleSubmit` Function Modifications

-   **Wallet Connection**: Checks `connected` state from `useWallet()`.
-   **PubKeyHash Derivation**:
    ```typescript
    const lenderAddresses = await wallet.getUsedAddresses();
    const lenderAddrObj = Address.from_bech32(lenderAddresses[0]);
    const lenderPubKeyHash = lenderAddrObj.to_pub_key_hash()?.to_hex();

    const borrowerAddrObj = Address.from_bech32(borrowerCardanoAddress);
    const borrowerPubKeyHashHex = borrowerAddrObj.to_pub_key_hash()?.to_hex();
    ```
-   **Datum Construction**:
    ```typescript
    const loanDatum = {
      lender_pubkeyhash: lenderPubKeyHash,
      borrower_pubkeyhash: borrowerPubKeyHashHex,
      loan_amount: loanAmountLovelace, // in Lovelace
      interest_amount: interestAmountLovelace, // in Lovelace
      deadline: Math.floor(new Date().getTime() / 1000) + 30 * 24 * 60 * 60, // POSIX seconds
      status: { "PendingAcceptance": [] }, // Matches Aiken enum structure
    };
    ```
-   **Loading Blueprint**:
    ```typescript
    const blueprintResponse = await fetch('/plutus.json'); // plutus.json must be in /public
    const contractBlueprint = await blueprintResponse.json();
    const validator = contractBlueprint.validators.find((v: any) => v.title === "loan.spend");
    const scriptCborHex = validator.compiledCode;
    ```
-   **Transaction Building**:
    ```typescript
    const appWallet = new AppWallet({ networkId: 0, fetcher: wallet, submitter: wallet, key: wallet });
    const tx = new Transaction({ initiator: appWallet });
    const contractAddress = appWallet.getPaymentAddress(scriptCborHex); // Script address
    tx.sendLovelace(
      {
        address: Address.from_bech32(contractAddress),
        datum: { value: loanDatum, inline: true },
      },
      loanAmountLovelace.toString()
    );
    const unsignedTx = await tx.build();
    const signedTx = await appWallet.signTx(unsignedTx, false);
    const txHash = await appWallet.submitTx(signedTx);
    ```
-   **Saving to Supabase**: Includes `contract_address`, `contract_datum`, and `contract_tx_hash`.

### d. Serving `plutus.json`

-   The compiled Aiken contract blueprint (`plutus.json`), originally located in `smart_contract/aiken/plutus.json`, is copied to the `public/` directory of the Next.js application. This makes it accessible via a `fetch('/plutus.json')` call from the client-side.

## 3. Error Handling

-   The form includes general error handling for wallet connection issues, transaction failures, and Supabase update failures.
-   Specific error messages from Mesh SDK (often in `error.info`) are included in the displayed error if available.
-   If Supabase update fails after successful contract deployment, an error message prompts the user to record the transaction hash.

## 4. Assumptions and Current Limitations

-   **Borrower's PubKeyHash**: Currently, the lender is expected to input the borrower's Cardano *address*. The application then derives the PubKeyHash. A more robust system might involve users storing their Cardano address/PubKeyHash in their Supabase profiles.
-   **Interest Calculation**: Interest is currently hardcoded to 0. This can be expanded later.
-   **Collateral**: Collateral is not implemented in this phase; `collateral_amount` in Supabase is defaulted to 0.
-   **Network**: Hardcoded to Testnet (`networkId: 0`). This should be configurable for mainnet deployment.
-   **Datum Structure**: The JavaScript `loanDatum` object structure must exactly match the expected structure in the Aiken contract, especially for enums like `status`.
-   **Error Specificity**: Cardano transaction errors can be complex. The current error handling is basic and can be improved to provide more user-friendly messages for common on-chain errors.
-   **Fetching Blueprint**: Directly fetching `plutus.json` client-side is suitable for some scenarios but might be better handled via Next.js API routes or `getStaticProps`/`getServerSideProps` for larger applications or if the blueprint needs preprocessing.

This setup enables the creation of loan proposals that are simultaneously recorded off-chain in Supabase and deployed as on-chain smart contracts on Cardano.

## 5. Dashboard On-Chain Interactions (`src/app/dashboard/page.tsx`)

The dashboard is enhanced to display on-chain contract information and allow borrowers to interact with the loan contract.

### a. Displaying Contract Information

-   **Loan Type Update**: The `Loan` type in `dashboard/page.tsx` is updated to include:
    -   `contract_address: string | null`
    -   `contract_datum: LoanDatum | null` (where `LoanDatum` matches the Aiken structure, including a nested `status` object like `{"Active": []}` or `{"PendingAcceptance": []}`)
    -   `contract_tx_hash: string | null`
    -   `collateral_amount: number | null`
-   **UI Updates**: For each loan card (both lent and borrowed):
    -   If `contract_address` exists, it's displayed.
    -   Links to a Cardano testnet explorer (e.g., Preprod Cardanoscan) are provided for `contract_address` and `contract_tx_hash`.
    -   The current on-chain status from `loan.contract_datum.status` is displayed (e.g., "PendingAcceptance", "Active").

### b. Borrower: Accepting a Loan On-Chain (`handleAcceptLoanOnChain`)

-   **Trigger**: The "Accept Loan" button for a borrowed loan, if `contract_address` is present and the Supabase status is `pending_borrower_acceptance`.
-   **Prerequisites**:
    -   User's (borrower's) wallet must be connected.
    -   Loan must have `contract_address` and initial `contract_datum`.
-   **Process**:
    1.  **Initialize `AppWallet`**: Using the connected borrower's wallet.
    2.  **Load Blueprint**: Fetches `/plutus.json`.
    3.  **Construct Redeemer**: For `AcceptLoan`, this is typically `{"constructor": 0, "fields": []}`.
    4.  **Find Script UTXO**: Locates the UTXO at the `loan.contract_address` that holds the loan funds (e.g., by matching the loan amount in the datum, though more robust methods might be needed if multiple UTXOs exist).
    5.  **Construct New Datum**: Copies the existing `contract_datum` and updates its `status` to `{"Active": []}`.
    6.  **Build Transaction**:
        -   Redeems the script UTXO using the `AcceptLoan` redeemer and the current datum.
        -   Sends the value of the script UTXO (the loan funds) back to the same `contract_address` but with the new `Active` datum.
    7.  **Sign and Submit**: Borrower signs and submits the transaction.
    8.  **Update Supabase**: On successful on-chain transaction:
        -   Updates the loan's `status` to `active`.
        -   Updates `contract_datum` to the new `Active` datum.
        -   Updates `contract_tx_hash` to the hash of this acceptance transaction.
-   **UI Feedback**: Loading states and error/success messages are displayed.

### c. Borrower: Repaying a Loan On-Chain (`handleMarkAsPaidOnChain`)

-   **Trigger**: "Mark as Paid (On-Chain)" button for an active borrowed loan with a `contract_address`.
-   **Prerequisites**:
    -   User's (borrower's) wallet must be connected.
    -   Loan status is `active`, and contract details are present.
-   **Process**:
    1.  **Initialize `AppWallet`**.
    2.  **Load Blueprint**.
    3.  **Construct Redeemer**: For `RepayLoan`, this is typically `{"constructor": 1, "fields": []}`.
    4.  **Find Script UTXO**: Locates the active loan UTXO at the `contract_address`.
    5.  **Determine Lender's Address**: Reconstructs the lender's Cardano address from `loan.contract_datum.lender_pubkeyhash`.
    6.  **Calculate Repayment**: `loan_amount + interest_amount` from the `contract_datum`.
    7.  **Construct New Datum**: Copies the existing `contract_datum` and updates its `status` to `{"Paid": []}`.
    8.  **Build Transaction**:
        -   Redeems the script UTXO using the `RepayLoan` redeemer.
        -   Sends the calculated total repayment amount to the lender's address.
        -   Sends a new UTXO back to the same `contract_address` with the new `Paid` datum and a minimum ADA amount (e.g., 2 ADA) to hold this state. (This step depends on the Aiken script's design; the script might terminate instead of creating a new UTXO for itself).
    9.  **Sign and Submit**: Borrower signs and submits.
    10. **Update Supabase**: On success:
        -   Updates loan `status` to `paid`.
        -   Updates `contract_datum` to the new `Paid` datum.
        -   Updates `contract_tx_hash`.
-   **UI Feedback**: Loading states and error/success messages.

### d. Lender Actions (Future Implementation)

-   **Claim Payment**: Logic for the lender to claim funds when a loan is in `Paid` status on-chain. This would involve a redeemer and a transaction to move funds from the script address to the lender's wallet.
-   **Claim Default**: Logic for the lender to claim collateral or locked funds if the loan deadline passes and the loan is not repaid. This also involves a specific redeemer and transaction.

These functionalities are placeholders for future development.

### e. UI/UX Notes

-   Buttons for on-chain actions are disabled if the wallet is not connected or if necessary contract details are missing.
-   Loading spinners or text indicate when transactions are being processed.
-   `actionError` state variable in the dashboard component is used to display errors related to these on-chain actions.
