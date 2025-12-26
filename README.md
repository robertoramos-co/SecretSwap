# SecretSwap

SecretSwap is a privacy-preserving ETH to USDT swap demo built on Zama FHEVM. It lets users swap ETH at a fixed
rate (1 ETH = 2300 USDT) while keeping their USDT balances encrypted on-chain. The app shows the encrypted balance
by default and can reveal the plaintext balance only when the user requests decryption through the relayer.

## Project Goals

- Demonstrate a simple swap flow where the output balance stays encrypted on-chain.
- Prove that a frontend can display encrypted balances and optionally decrypt them without exposing plaintext
  to the smart contract or the public chain.
- Provide a clean reference stack for FHEVM contracts and a React + Vite client.

## Problem Solved

Typical on-chain balances are fully public, which is a problem for applications that want basic privacy or
confidential accounting. SecretSwap shows how to keep balances encrypted at the contract level while still
allowing a user to view their own balance off-chain via a relayer. The swap itself is deterministic and
transparent, but the resulting balance stays private.

## Key Advantages

- On-chain privacy for balances using FHE primitives, without off-chain custody.
- Simple, deterministic swap logic that is easy to test and reason about.
- Clear separation between encrypted state (on-chain) and decrypted view (off-chain, user-authorized).
- Frontend reads use viem while write operations use ethers, matching best tooling for each path.
- Fixed-rate swap avoids price oracle complexity for this demo.

## How It Works

1. A user sends ETH to the contract using `swapExactETHForUSDT`.
2. The contract calculates the USDT output using a fixed rate and converts it to an encrypted `euint64`.
3. The encrypted amount is added to the user's encrypted balance in storage.
4. The frontend fetches the encrypted balance via `encryptedBalanceOf(address)` and shows it in encrypted form.
5. When the user clicks decrypt, the frontend requests a decryption through the Zama relayer and displays the
   plaintext balance to the user.

## Smart Contract Details

- Contract: `SecretSwap`
- Fixed rate: 1 ETH = 2300 USDT
- USDT decimals: 6
- Encrypted balance type: `euint64`
- Storage: `mapping(address => euint64)`
- Events: `Swapped(address user, uint256 ethInWei, uint256 usdtOut)`
- View method pattern: `encryptedBalanceOf(address account)` accepts the target address explicitly and does not
  depend on `msg.sender`.

Notes and limitations:

- USDT here is not an ERC20 token. It is an encrypted accounting balance stored by the contract.
- There is no price oracle and no slippage logic. This is a fixed-rate demo.
- The contract does not include a withdraw or reverse swap. ETH sent is retained by the contract.
- `quoteUsdt` is pure and uses only the fixed rate.

## Frontend Behavior

- Connects wallets using RainbowKit and wagmi.
- Reads encrypted balances with viem.
- Sends swap transactions with ethers.
- Integrates the Zama relayer SDK to request decryption.
- Targets Sepolia for the live demo; no localhost network is used in the frontend.

## Tech Stack

- Smart contracts: Solidity, Hardhat, Zama FHEVM
- Frontend: React, Vite, viem, ethers, RainbowKit, wagmi
- Relayer: @zama-fhe/relayer-sdk
- Package manager: npm

## Repository Layout

- `contracts/` Solidity contracts
- `deploy/` Hardhat deployment scripts
- `tasks/` Hardhat tasks
- `test/` Hardhat tests
- `deployments/` Deployed artifacts and ABIs (Sepolia ABI is the source of truth for the frontend)
- `frontend/` React + Vite client
- `docs/` Zama FHEVM and relayer documentation references

## Setup and Usage

### Prerequisites

- Node.js 20+
- npm

### Install Dependencies

```bash
npm install
```

```bash
cd frontend
npm install
```

### Environment Variables (Deploy Only)

Create or update `.env` with the following values for deployments:

- `PRIVATE_KEY` (no 0x prefix)
- `INFURA_API_KEY`
- `ETHERSCAN_API_KEY` (optional, for verification)

The deployment scripts rely on `process.env.PRIVATE_KEY` and `process.env.INFURA_API_KEY`.

### Compile and Test Contracts

```bash
npm run compile
npm run test
```

### Deploy Locally (for contract-only testing)

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

After deployment, the ABI in `deployments/sepolia` is the one the frontend must use.

### Run the Frontend

```bash
cd frontend
npm run dev
```

The frontend does not rely on environment variables. Contract address and ABI are pulled from the codebase,
with ABI sourced from `deployments/sepolia`.

## Testing Strategy

- Unit tests validate swap rate math and encrypted balance handling.
- Tasks and scripts focus on repeatable local testing before Sepolia deployment.
- Manual frontend testing validates encryption display and decryption flow.

## Future Roadmap

- Add reverse swap or withdrawal flows with encrypted accounting safeguards.
- Add UI for multiple encrypted assets and historical swap activity.
- Expand to dynamic pricing with a privacy-aware oracle pattern.
- Improve UX around decryption requests, including caching and error recovery.
- Add comprehensive end-to-end tests covering the relayer and frontend flow.
- Document gas cost behavior and performance benchmarks under FHEVM.

## License

See `LICENSE`.
