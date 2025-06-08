# Database Schema Updates for Cardano Integration

This document outlines the manual changes made to the Supabase database schema to support Cardano smart contract integration for the loan application.

## `loans` Table Updates

The following columns were added to the `loans` table via the Supabase Table Editor to store Cardano-specific information related to each loan.

1.  **Navigate to Supabase Table Editor:**
    *   Go to your Supabase project.
    *   In the sidebar, click on "Table Editor".
    *   Select the `loans` table from the list of tables.

2.  **Add New Columns:**
    Click the "+ Add column" button to add each of the following columns:

    *   **`contract_address`**:
        *   **Type**: `text`
        *   **Nullable**: `true` (Allows the value to be NULL)
        *   **Description**: Stores the Cardano smart contract address associated with the loan after deployment.

    *   **`contract_datum`**:
        *   **Type**: `jsonb`
        *   **Nullable**: `true`
        *   **Description**: Stores the initial datum (as a JSON object) used when deploying the Cardano smart contract. This includes details like lender and borrower public key hashes, loan amount, interest, deadline, and initial status.

    *   **`contract_tx_hash`**:
        *   **Type**: `text`
        *   **Nullable**: `true`
        *   **Description**: Stores the transaction hash of the Cardano transaction that deployed the smart contract.

    *   **`collateral_amount`**:
        *   **Type**: `numeric`
        *   **Nullable**: `true`
        *   **Default value**: `0`
        *   **Description**: Stores the amount of collateral (in Lovelace) associated with the loan, if applicable. This field is optional for the initial implementation.

3.  **Save Changes:**
    Ensure you save the changes after adding each column or all columns.

These fields are crucial for linking the off-chain loan records stored in Supabase with the on-chain smart contracts that govern them. The nullability allows for loans to be created in an initial state before the contract is deployed, or for flexibility if contract deployment is an optional step.
