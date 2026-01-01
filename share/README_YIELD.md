
# 🌾 Cronos Yield Agent (Autonomous Treasury)

The **Yield Agent** is an autonomous module that safely invests idle merchant funds into the **Tectonic Protocol** (USDC Supply) on Cronos Mainnet. It utilizes a **Facilitator-Agent** architecture where a trusted off-chain "Brain" (Facilitator) signs decisions, and the on-chain "Muscle" (Agent) executes them only if they pass strict safety checks.

## 🛡️ Safety & Risk Architecture

1.  **EIP-712 Signatures**: Every action requires a cryptographic signature (`YieldDecision`) from the Facilitator. The Agent rejects any command not signed by the authorized brain.
2.  **Risk Manager (Agent-Side Check)**: Even with a valid signature, the Agent enforces hard-coded guardrails:
    *   **Max Allocation**: Up to 50% of the wallet balance.
    *   **Min Idle Balance**: Always keeps $10 USDC liquid.
    *   **Daily Limits**: Max 5 adjustment transactions per day.
3.  **Scope Enforcement**: The Agent verifies the decision scope is strictly `"YIELD_ONLY"`.

## 📂 Project Structure

*   `internal/yield/YieldAgent.ts`: The core orchestrator. Verifies signatures and calls Risk Assessor.
*   `internal/yield/RiskManager.ts`: The mathematical safety module.
*   `checks/verifyDecision.ts`: Validates EIP-712 signatures.
*   `scripts/simulate_yield_mock.ts`: **The Matrix**. A full local simulation deploying Mock USDC and Mock Vaults to prove the logic works without spending gas.
*   `scripts/test_live_tectonic.ts`: A Read-Only utility to check real-time Tectonic APY and wallet readiness.

## 🚀 How to Run

### 1. The "Matrix" Simulation (Recommended)
Runs a full cycle (Mint -> Sign -> Verify -> Supply) on a local Hardhat network.
```bash
npx hardhat run scripts/simulate_yield_mock.ts
```
**Expected Output:** `✅ Execution Success! tTokens Held: ...`

### 2. Live Mainnet Verification ($1 Test)
*Requires a funded wallet in `.env` (`AGENT_PRIVATE_KEY`)*
```bash
npx ts-node scripts/test_live_tectonic.ts
```
Set `ENABLE_LIVE_TX=true` in `.env` to actually execute the supply transaction.

## 🔧 Configuration (.env)

*   `FACILITATOR_PRIVATE_KEY`: Key used to sign decisions (Server/Brain).
*   `AGENT_PRIVATE_KEY`: Key of the autonomous wallet (Muscle).
*   `TECTONIC_USDC_ADDRESS`: `0xB3bbf1bE947b245Aef...` (Mainnet).

## 📊 Current Status
*   **Logic Verified**: ✅ (via Mocks)
*   **Network Verified**: ✅ (Read-Only connection to Cronos)
*   **Ready for Deploy**: Yes (Just need to fund the wallet).
