
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: "0.8.20", // Upgraded for OpenZeppelin 5.x
    networks: {
        hardhat: {
            chainId: 1337
        },
        cronos_testnet: {
            url: "https://evm-t3.cronos.org",
            chainId: 338,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
        },
        cronos_mainnet: {
            url: "https://evm.cronos.org",
            chainId: 25,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
        }
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};

export default config;
