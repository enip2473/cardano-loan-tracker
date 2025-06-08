# Cardano Development Environment Setup with Demeter.run

This document outlines the steps to set up a Cardano development environment using Demeter.run. Demeter.run provides a web-based platform with pre-installed tools like Aiken, Cardano CLI, and access to testnets, simplifying the setup process.

## 1. Create a Demeter.run Account

1.  Navigate to [https://demeter.run](https://demeter.run) in your web browser.
2.  Sign up for a new account by following the on-screen instructions. This typically involves providing an email address and creating a password.
3.  Verify your email address if required.

## 2. Start a New Project with the Aiken Template

1.  Once logged into your Demeter.run account, locate the option to create a new project or workspace.
2.  When prompted to choose a template or project type, select the **Aiken template**. This template will pre-configure your development environment with the necessary tools and project structure for Aiken development.
3.  Give your project a suitable name (e.g., `my-aiken-project`).

## 3. Familiarize Yourself with the Demeter.run Interface

After your project is created, take some time to explore the Demeter.run interface:

*   **Web-based IDE:** Demeter.run provides a code editor (often based on VS Code or a similar editor) directly in your browser. You can use this to write and edit your Aiken smart contracts and other project files.
*   **Aiken Compiler:** The Aiken compiler will be pre-installed. You can typically access it via a terminal or command palette within the IDE. To compile your Aiken project, you would usually run a command like `aiken build`.
*   **Cardano CLI:** Cardano CLI should also be available in the environment. You can access it through the terminal to interact with the Cardano blockchain (e.g., build transactions, query addresses). Verify its availability by running `cardano-cli --version`.
*   **Testnet Access:** Demeter.run provides access to Cardano testnets (e.g., Preprod, Preview). This might be configured through environment variables or project settings. You will need this to deploy and test your smart contracts.
    *   You may need to obtain testnet ADA from a faucet to fund your testnet addresses. Demeter.run might provide direct links or instructions for this.
*   **Project Files:** Familiarize yourself with the project structure created by the Aiken template. This typically includes directories for Aiken source files (`lib`, `validators`), test files (`tests`), and a project configuration file (`aiken.toml`).

## 4. Building and Deploying Aiken Contracts

1.  **Write your Aiken contract:** Create or modify Aiken files (e.g., `validators/my_validator.ak`) in the IDE.
2.  **Build the contract:** Use the Aiken CLI to build your project. Open a terminal in Demeter.run and run `aiken build`. This will generate the Plutus UPLC script for your contract.
3.  **Deploy and Test:**
    *   Use the `cardano-cli` to construct and submit transactions that include your compiled Aiken script.
    *   Interact with your deployed contract on the chosen testnet.

## Specific Configurations or Project Settings

*   **API Keys:** If you intend to use services like Blockfrost for blockchain interaction directly (though Demeter.run might abstract this), you might need to configure API keys as environment variables in your Demeter.run project settings.
*   **Environment Variables:** Check the project settings for any environment variables related to Cardano network choice (e.g., `CARDANO_NODE_SOCKET_PATH`, `CARDANO_TESTNET_MAGIC`) or Blockfrost API keys.
*   **Resource Allocation:** Be aware of any resource limits (CPU, memory, storage) associated with your Demeter.run plan, as these might affect build times or the ability to run a local testnet node (if offered).

This document provides a general guide. Refer to the official Demeter.run documentation for the most up-to-date and detailed instructions.
