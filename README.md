# LoanTracker

LoanTracker is a decentralized application (dApp) for creating and managing loan agreements on the blockchain. It allows users to connect their crypto wallets, create new loan proposals, and view their existing loans on a dashboard.

## Features

*   **Wallet Integration:** Connects to Ethereum-based wallets (e.g., MetaMask) using Wagmi and Ethers.js.
*   **Create Loans:** Users can define loan terms (amount, interest, deadline) and deploy a smart contract representing the loan agreement.
*   **Loan Dashboard:** View the status and details of active and past loans.
*   **Smart Contract Powered:** Loan agreements are managed by a Solidity smart contract (`LoanAgreement.json`) ensuring transparency and security.

## Technologies Used

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS
*   **Blockchain:** Solidity, Ethers.js, Wagmi
*   **Backend (for user data/off-chain storage, if applicable):** Supabase
*   **Linting/Formatting:** ESLint, Prettier (implied by `eslint.config.mjs`)

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   Yarn (or npm)
*   A crypto wallet browser extension (e.g., MetaMask)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    yarn install
    # OR
    # npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project. You might need to add variables for:
    *   Supabase URL and anon key (if Supabase is used for more than just auth).
    *   RPC endpoint for your chosen Ethereum network (e.g., from Infura or Alchemy).
    *   Private key for deploying/testing smart contracts locally (DO NOT commit this to Git).
    *   Example:
        ```
        NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
        NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
        NEXT_PUBLIC_RPC_URL=your_rpc_url
        ```

4.  **Run the development server:**
    ```bash
    yarn dev
    # OR
    # npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Smart Contract

The core logic for loan agreements resides in the `LoanAgreement.sol` smart contract (the ABI and bytecode are provided in `src/lib/contracts/LoanAgreement.json`). This contract handles:
*   Loan creation (deployment of a new agreement).
*   Acceptance of the loan by the borrower.
*   Repayment by the borrower.
*   Cancellation of the loan offer by the lender.
*   Tracking loan status (Pending, Active, Repaid, Cancelled, Defaulted).

## Testing

## Running Tests

This project uses Jest for unit and integration testing.

To run all tests:

```bash
yarn test
# OR
# npm run test
```

This command will execute all `*.test.tsx` files found in `__tests__` directories throughout the project.
