
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.20",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.5.16",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            }
        ]
    },
    networks: {
        hardhat: {
            chainId: 31337,
            hardfork: "shanghai",
            forking: {
                url: "https://evm.cronos.org"
            }
        },
        localhost: {
            url: "http://127.0.0.1:8545"
        }
    },
};

export default config;
