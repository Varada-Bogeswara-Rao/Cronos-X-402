import { ethers, Contract, Signer } from "ethers";

// Interface for muscle capable of swapping
export interface RefillExecutor {
    swapToGas(amountIn: bigint, minAmountOut: bigint): Promise<string>;
}

export class VVSExecutor implements RefillExecutor {
    private signer: Signer;
    private usdc: Contract;
    private router: Contract;
    private routerAddress: string;
    private wcroAddress: string;

    // VVS Router V2: 0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae
    // WCRO (Wrapper): 0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23
    constructor(
        signer: ethers.Signer,
        usdcAddress: string,
        routerAddress: string,
        wcroAddress: string
    ) {
        this.signer = signer;
        this.routerAddress = routerAddress;
        this.wcroAddress = wcroAddress;

        const ERC20_ABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function balanceOf(address account) external view returns (uint256)"
        ];

        // Uniswap V2 Router Interface
        const ROUTER_ABI = [
            "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
        ];

        this.usdc = new Contract(usdcAddress, ERC20_ABI, this.signer);
        this.router = new Contract(routerAddress, ROUTER_ABI, this.signer);
    }

    async swapToGas(amountIn: bigint, minAmountOut: bigint): Promise<string> {
        const owner = await this.signer.getAddress();

        // 1. Unlimited Approve Check (Gas Optimization)
        const allowance = await this.usdc.allowance(owner, this.routerAddress);
        if (allowance < amountIn) {
            console.log(`[VVSExecutor] Approving VVS Router...`);
            const tx = await this.usdc.approve(this.routerAddress, ethers.MaxUint256);
            await tx.wait();
        }

        // 2. Perform Swap
        // Path: USDC -> WCRO
        const path = [await this.usdc.getAddress(), this.wcroAddress];

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

        console.log(`[VVSExecutor] Swapping ${amountIn} USDC for CRO (MinOut: ${minAmountOut})...`);

        // VVS Router V2 uses swapExactTokensForETH for native output
        const tx = await this.router.swapExactTokensForETH(
            amountIn,
            minAmountOut,
            path,
            owner,
            deadline
        );

        const receipt = await tx.wait();
        return receipt.hash;
    }
}
