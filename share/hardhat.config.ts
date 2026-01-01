
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
    solidity: "0.8.20",
    networks: {
        hardhat: {
            forking: {
                url: "https://evm.cronos.org",
                blockNumber: 46000000
            },
            chainId: 25,
        },
    },
};

export default config;
