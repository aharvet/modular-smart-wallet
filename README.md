# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

set MAINNET_RPC_URL vars
npx hardhat vars set MAINNET_RPC_URL url

must use erc 7201 namespaced storage + erc 165

Use common + Imodule as base

Relayer options: Gelato, Chainlink Automation

must return selector, even for getter
