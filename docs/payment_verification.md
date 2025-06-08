# Payment Verification and Contract State

This document explains how loan repayments are verified and how the smart contract's state reflects this, particularly focusing on the lender's perspective and the role of different contract redeemers.

## 1. Core Payment Verification via `RepayLoan` Validator

The primary mechanism for verifying that a loan has been repaid correctly is enforced by the Aiken smart contract, specifically within the `RepayLoan` validator logic.

-   **Validator Logic**: As reviewed in `smart_contract/aiken/loan.ak`, the `spend` validator, when handling the `RepayLoan` redeemer, includes a crucial check:
    ```aiken
    let expected_payment = datum.loan_amount + datum.interest_amount
    let payment_to_lender =
      context.transaction.outputs
        |> list.any(fn(output) {
          output.address.payment_credential == PubKeyCredential(datum.lender_pubkeyhash) &&
          output.value.lovelace == expected_payment
        })
    // ... other checks like signer and status ...
    // Validator returns true if all checks pass, including payment_to_lender
    ```
-   **Enforcement**: This means a transaction attempting to use the `RepayLoan` redeemer will only be validated by the Cardano network if it includes an output that sends the exact sum of `loan_amount` and `interest_amount` (as defined in the loan's datum) to the lender's address (also defined in the datum).
-   **Implication**: If a borrower successfully submits a transaction using the `RepayLoan` redeemer, and the on-chain datum status transitions to `Paid`, it inherently means the contract has verified that the correct payment was made to the lender as part of that same transaction.

## 2. Lender's View of a Paid Loan

-   **Dashboard Reflection**: When the borrower's `RepayLoan` transaction is successfully processed on-chain:
    -   The `handleMarkAsPaidOnChain` function in `src/app/dashboard/page.tsx` updates the loan's `contract_datum` in Supabase to reflect the new on-chain status (e.g., `{"Paid": []}`).
    -   It also updates the off-chain `status` field in Supabase to `paid`.
-   **Verification for Lender**: The lender, upon viewing their dashboard, will see the loan marked as "Paid". The "On-Chain Status" field, derived directly from `loan.contract_datum.status`, will also show `Paid`. This on-chain status is the lender's confirmation that the contract's conditions for repayment (including payment to them) were met.

## 3. Role of `ClaimPayment` Redeemer

-   **Initial Design**: The `ClaimPayment` redeemer in the Aiken contract was designed for a scenario where the loan funds might still reside at the script address even after the loan is marked `Paid` in the datum. This would require the lender to make a separate transaction to withdraw these funds.
-   **Current `RepayLoan` Implementation**: The current `RepayLoan` logic in the frontend (`handleMarkAsPaidOnChain`) and the corresponding Aiken validator ensure that the payment is made directly to the lender's address as part of the borrower's repayment transaction. The transaction also updates the on-chain datum to `Paid` (by creating a new UTXO at the script address with the `Paid` datum, holding minimal ADA).
-   **Redundancy/Repurposing**:
    -   Given this direct payment approach in `RepayLoan`, a separate `ClaimPayment` action by the lender to retrieve the principal + interest is **not strictly necessary**. The lender has already received the funds when the on-chain status transitions to `Paid` via the borrower's `RepayLoan` action.
    -   The UTXO that remains at the script address with the `Paid` datum contains only minimal ADA (e.g., 2 ADA) used to hold this final state. The `ClaimPayment` redeemer *could* be used by the lender to retrieve this minimal ADA, effectively "closing out" or cleaning up the script address for that specific loan instance. However, this is more of a cleanup step than claiming the actual loan repayment.
    -   Alternatively, if the `RepayLoan` transaction was designed so the script *didn't* create a new UTXO for itself (i.e., the script UTXO is fully consumed and funds disbursed), then `ClaimPayment` would be entirely unused for this flow. Our current frontend implementation *does* create a new UTXO with `Paid` status.

## 4. Advanced Transaction Monitoring (Future Consideration)

While the smart contract's state change to `Paid` (contingent on the `RepayLoan` validator's checks) is the primary method of payment verification in this project, more advanced systems could implement backend services for enhanced robustness or different user experiences:

-   **Backend Listeners/Indexers**: Tools like [Kupo](https://github.com/CardanoSolutions/kupo) or [Carp](https://github.com/input-output-hk/carp) (or other Cardano blockchain indexers) could be used to monitor the lender's Cardano address directly for incoming payments that match expected loan repayment amounts and timings.
-   **Notifications**: Such backend systems could trigger notifications to the lender immediately upon detecting the payment on-chain, potentially even before the borrower's transaction to update the script datum to `Paid` is fully confirmed (though this depends on transaction atomicity and desired UX).
-   **Decoupling**: This could decouple the off-chain "paid" status update from the borrower's specific action of updating the script datum, relying instead on direct payment detection. However, this adds complexity and infrastructure requirements.

For the scope of this project, relying on the on-chain datum state change (which itself is conditional on the payment being correctly made as per validator logic) is a valid and simpler approach. The lender trusts the smart contract to enforce the payment conditions.
