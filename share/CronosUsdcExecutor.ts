import "dotenv/config";
import { ethers } from "ethers";
import { PaymentExecutor } from "./executors";
import { PaymentRequest } from "./types";

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)"
];

export class CronosUsdcExecutor implements PaymentExecutor {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private usdc: ethers.Contract;

    constructor(
        rpcUrl: string,
        privateKey: string,
        usdcAddress: string
    ) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        // ✅ Correct way in ethers v6
        const signingKey = new ethers.SigningKey(privateKey);
        this.wallet = new ethers.Wallet(signingKey, this.provider);

        this.usdc = new ethers.Contract(
            usdcAddress,
            ERC20_ABI,
            this.wallet
        );
    }

    async execute(request: PaymentRequest): Promise<string> {
        const amount = ethers.parseUnits(
            request.amount.toString(),
            6 // USDC decimals
        );

        console.log(
            `[CRONOS] Sending ${request.amount} USDC to ${request.payTo}`
        );

        const tx = await this.usdc.transfer(request.payTo, amount);
        const receipt = await tx.wait();

        return receipt!.hash;
    }
}
