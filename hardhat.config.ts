import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const MAINNET_RPC_URL = vars.get("MAINNET_RPC_URL", "");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.29",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: MAINNET_RPC_URL,
        blockNumber: 22259580,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
    },
  },
  gasReporter: {
    enabled: true,
  },
};

export default config;
