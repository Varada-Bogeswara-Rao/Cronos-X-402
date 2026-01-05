import { ethers } from "ethers";
import { WalletWatcher } from "./WalletWatcher";
import { ProfitEngine } from "./ProfitEngine";
import YieldPosition from "../models/YieldPosition";
import YieldDecisionModel, { YieldDecision } from "../models/YieldDecision";
import { YieldDecisionManager } from "./YieldDecisionManager";

export class FacilitatorLoop {
    private profitEngine: ProfitEngine;
    private walletWatcher: WalletWatcher;
    private facilitatorSigner: ethers.Wallet;
    // private yieldAgent: YieldAgent; // The "Receiver" or "Client" to the agent
    private yieldAgentAddress: string;

    // In a real microservice, this might be an RPC client. 
    // Here we have direct access to the Agent instance for simplicity.

    constructor(
        watcher: WalletWatcher,
        signerKey: string,
        agentAddress: string, // Needed for verifying decision target
        engine?: ProfitEngine
    ) {
        this.walletWatcher = watcher;
        this.profitEngine = engine || new ProfitEngine();
        this.facilitatorSigner = new ethers.Wallet(signerKey);
        this.yieldAgentAddress = agentAddress;

        // Instantiate Agent (acting as both Facilitator dispatch and Agent receiver in this monolithic server)
        // In production, Agent might be separate process.
        // this.yieldAgent = new YieldAgent(this.facilitatorSigner.address, DEFAULT_RISK_CONFIG);
    }

    /**
     * Main Cycle. Called by Scheduler.
     */
    async runCycle(merchantId: string, agentAddress: string, dryRun = true) {
        if (!process.env.ENABLE_AUTONOMY && !dryRun) {
            console.log("⏸️ [Facilitator] Autonomy DISABLED. Skipping.");
            return;
        }

        try {
            // 1. Evaluate (Brain)
            const metric = await this.profitEngine.analyze(merchantId);
            if (!metric) {
                console.warn("⚠️ [Facilitator] No Metrics. Skipping.");
                return;
            }

            console.log(`🧠 [Recommend] ${metric.recommendation} | Profit: $${metric.netProfit.toFixed(2)} | Amt: ${metric.amount}`);

            if (metric.recommendation === "HOLD") {
                console.log("⏸️ [Facilitator] Holding.");
                return;
            }

            // 2. Build Decision (Manager)
            const decisionManager = new YieldDecisionManager(this.facilitatorSigner.privateKey);
            const decisionUnsigned = decisionManager.buildDecision(metric, agentAddress);

            // 3. Idempotency Check (Manager)
            const decisionHash = decisionManager.hashDecision(decisionUnsigned);

            let position = await YieldPosition.findOne({ merchantId, protocol: metric.protocol });
            if (position && position.lastDecisionHash === decisionHash) {
                console.log("🔁 [Facilitator] SKIPPED_DUPLICATE:", decisionHash);
                return;
            }

            // 4. Sign (Manager - EIP-712)
            const signedDecision = await decisionManager.signDecision(decisionUnsigned);

            // 5. Persist (Activity Log)
            await YieldDecisionModel.create({
                ...signedDecision,
                status: "DISPATCHED" // Optimistic for now (monolith)
            });

            // 6. Execute
            if (dryRun) {
                console.log("🧪 [DRY_RUN_ONLY] Signed Payload:", JSON.stringify(signedDecision, null, 2));
            } else {
                console.log("🚀 [DISPATCHED] Sending to Agent...");

                // --- AUTONOMOUS EXECUTION (GOD MODE) ---
                // In a real system, this would be a separate microservice listening to the queue.
                // Here, we execute it directly on the Local Fork to complete the simulation loop.
                if (process.env.CRONOS_RPC_URL && (process.env.CRONOS_RPC_URL.includes("localhost") || process.env.CRONOS_RPC_URL.includes("127.0.0.1"))) {
                    await this.executeDecisionOnFork(signedDecision);
                    // Force refresh snapshot so DB reflects new tUSDC balance immediately
                    console.log("📸 [Facilitator] Refreshing Wallet Snapshot to sync balances...");
                    await this.walletWatcher.snapshotAll();
                } else {
                    console.log("⚠️ [Facilitator] Skipped execution (Not on Localhost).");
                }
            }

            // 7. Update State (Idempotency & Accounting)
            if (!dryRun && position) {
                position.lastDecisionHash = decisionHash;
                position.lastActionAt = new Date();

                console.log(`DEBUG: Step 7 Update. Pos: ${!!position}, Dec: ${signedDecision.decision}, Amt: ${signedDecision.amount}`);

                // Accounting: Track Principal
                if (!dryRun) {
                    const amountBN = BigInt(signedDecision.amount || "0"); // Raw units (6 dec)

                    if (signedDecision.decision === "APPROVE") {
                        // Treat APPROVE as SUPPLY for this simple bot
                        if (!position) {
                            // Create new position
                            position = new YieldPosition({
                                merchantId,
                                protocol: "TECTONIC_USDC",
                                status: "ACTIVE",
                                principalAmount: amountBN.toString(),
                                lastActionAt: new Date(),
                                lastDecisionHash: decisionHash
                            });
                            await position.save();
                            console.log(`💾 [Facilitator] New Position Created (Principal: ${amountBN})`);
                        } else {
                            // Update existing
                            const currentPrincipal = BigInt(position.principalAmount || "0");
                            position.principalAmount = (currentPrincipal + amountBN).toString();
                            position.lastActionAt = new Date();
                            position.lastDecisionHash = decisionHash;
                            // Ensure status is active
                            if (position.status !== "ACTIVE") position.status = "ACTIVE";

                            await position.save();
                            console.log(`💾 [Facilitator] Principal Updated (Inc: ${amountBN} -> New: ${position.principalAmount})`);
                        }

                    } else if (signedDecision.decision === "PARTIAL_WITHDRAW") {
                        const currentPrincipal = BigInt(position.principalAmount || "0");
                        let newPrincipal = currentPrincipal - amountBN;
                        if (newPrincipal < 0n) newPrincipal = 0n;
                        position.principalAmount = newPrincipal.toString();
                        await position.save(); // Save for withdraw if not using findOneAndUpdate
                    } else {
                        // For other decisions, just update the position object and save
                        await position.save();
                    }
                } else if (!dryRun && !position && signedDecision.decision === "APPROVE") {
                    // Handle case where position didn't exist but we are approving/supplying
                    const amountBN = BigInt(signedDecision.amount || "0");

                    // Manual Create (No $inc on string)
                    const newPos = new YieldPosition({
                        merchantId,
                        protocol: "TECTONIC_USDC",
                        status: "ACTIVE",
                        principalAmount: amountBN.toString(),
                        lastActionAt: new Date(),
                        lastDecisionHash: decisionHash
                    });
                    await newPos.save();
                    console.log(`💾 [Facilitator] New Position Created (Principal: ${amountBN})`);
                }

            }
        } catch (error: any) {
            console.error("❌ [Facilitator] Cycle Error:", error.message);
        }
    }

    /**
     * GOD MODE: Impersonates the user's wallet to execute the decision on the local fork.
     */
    private async executeDecisionOnFork(decision: YieldDecision) {
        try {
            console.log("⚡ [Executor] Initiating Autonomous Transaction on Local Fork...");

            const rpcUrl = process.env.CRONOS_RPC_URL || "http://127.0.0.1:8545";
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            const userAddress = decision.agentAddress;
            console.log(`DEBUG: Executor acting for: '${userAddress}'`);

            const tUsdcAddress = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e";
            const usdcAddress = "0xc21223249ca28397b4b6541dffaecc539bff0c59";

            // 1. Impersonate User (RPC Method)
            await provider.send("hardhat_impersonateAccount", [userAddress]);

            // 2. Execute Decision (Using RAW Transaction to bypass Ethers 'invalid account' check)
            const amountBN = BigInt(decision.amount || "0");

            if (decision.decision === "APPROVE") {
                console.log(`⚡ [Executor] Approving Tectonic Vault...`);

                // Encode Data for Approve
                // function approve(address spender, uint256 amount)
                const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
                const data = iface.encodeFunctionData("approve", [tUsdcAddress, ethers.MaxUint256]);

                const txHash = await provider.send("eth_sendTransaction", [{
                    from: userAddress,
                    to: usdcAddress,
                    data: data
                }]);
                await provider.waitForTransaction(txHash);
                console.log(`✅ [Executor] Approved USDC for Tectonic.`);

                // Auto-Mint (Supply)
                console.log(`⚡ [Executor] Minting tUSDC (Supplying)...`);

                // Encode Data for Mint
                const tIface = new ethers.Interface(["function mint(uint mintAmount)"]);
                const mintData = tIface.encodeFunctionData("mint", [amountBN]);

                // Note: Tectonic mint returns a code (uint), but we just send the tx
                const mintTxHash = await provider.send("eth_sendTransaction", [{
                    from: userAddress,
                    to: tUsdcAddress,
                    data: mintData
                }]);

                await provider.waitForTransaction(mintTxHash);
                console.log(`✅ [Executor] Successfully Supplied ${Number(amountBN) / 1e6} USDC to Tectonic!`);
            }
            else if (decision.decision === "PARTIAL_WITHDRAW") {
                console.log(`⚡ [Executor] Withdrawing...`);
                // Implement withdraw logic if needed
            }

            // Stop Impersonating
            await provider.send("hardhat_stopImpersonatingAccount", [userAddress]);

        } catch (error: any) {
            console.error("❌ [Executor] Failed to execute on fork:", error);
        }
    }
}
