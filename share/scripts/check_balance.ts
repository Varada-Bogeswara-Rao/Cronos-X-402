import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const target = "0xe3E0ef77E5Fdd925103250d52cF6cfc25e816624";
    const usdcAddr = "0xc21223249ca28397b4b6541dffaecc539bff0c59";

    const abi = ["function balanceOf(address) view returns (uint256)"];
    const usdc = new ethers.Contract(usdcAddr, abi, provider);

    const balance = await usdc.balanceOf(target);
    console.log(`User: ${target}`);
    console.log(`USDC Balance: ${ethers.formatUnits(balance, 6)}`);

    const cro = await provider.getBalance(target);
    console.log(`CRO Balance: ${ethers.formatEther(cro)}`);
}

main().catch(console.error);
