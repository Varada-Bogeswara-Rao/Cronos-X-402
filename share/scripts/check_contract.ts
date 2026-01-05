import { ethers } from "ethers";

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const address = "0xB3bbf1bE947b245Aef26e3B6a9D777d7703F4c8e"; // tUSDC

    console.log(`Checking code at ${address}...`);
    const code = await provider.getCode(address);
    console.log(`Code size: ${code.length}`);

    if (code === "0x") {
        console.error("❌ NO CODE FOUND! Fork is broken or address is wrong.");
    } else {
        console.log("✅ Code found! Contract exists.");
    }

    // Check USDC too
    const usdc = "0xc21223249ca28397b4b6541dffaecc539bff0c59";
    const usdcCode = await provider.getCode(usdc);
    console.log(`USDC size: ${usdcCode.length}`);
}

main();
