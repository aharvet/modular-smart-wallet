import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import entryPoint from "../../config/entry-point.json";
import publicKey from "../../config/public-key.json";
import { network } from "hardhat";

const ModularSmartWalletModule = buildModule(
  "ModularSmartWalletModule",
  (m) => {
    let entryPointAddress: string;

    if (network.name in entryPoint) {
      entryPointAddress = entryPoint[network.name as keyof typeof entryPoint];
    } else if (network.name === "localhost" || network.name === "hardhat") {
      entryPointAddress = "0x0000000000000000000000000000000000000000";
      console.log("Entry point not configured for local network.");
    } else {
      throw new Error(
        `No entry point address configured for network ${network.name}.`
      );
    }

    const smartWallet = m.contract("ModularSmartWallet", [
      entryPointAddress,
      publicKey,
    ]);
    const ownershipModule = m.contract("Ownership");
    const dcaModule = m.contract("DCA");

    return { smartWallet, ownershipModule, dcaModule };
  }
);

export default ModularSmartWalletModule;
