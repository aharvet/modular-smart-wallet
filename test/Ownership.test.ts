import { expect } from "chai";
import { ethers } from "hardhat";
import { createPasskey } from "./utils/signing";
import { Signer } from "ethers";
import { ModularSmartWallet, Ownership } from "../typechain-types";

describe("Ownership", function () {
  let smartWallet: ModularSmartWallet;
  let ownershipModule: Ownership;
  let smartWalletOwnership: Ownership;
  let account1: Signer;
  let entryPoint: Signer;
  let keyPair: {
    p256: { name: string; namedCurve: string; hash: string };
    key: CryptoKeyPair;
    x: string;
    y: string;
  };

  before(async function () {
    [account1, entryPoint] = await ethers.getSigners();
  });

  beforeEach(async function () {
    keyPair = await createPasskey();

    const ModularSmartWallet = await ethers.getContractFactory(
      "ModularSmartWallet"
    );
    const OwnershipModule = await ethers.getContractFactory("Ownership");
    ownershipModule = await OwnershipModule.deploy();

    smartWallet = await ModularSmartWallet.connect(entryPoint).deploy(
      await entryPoint.getAddress(),
      {
        x: keyPair.x,
        y: keyPair.y,
      }
    );

    const tx = await smartWallet.addModule(ownershipModule.target, "0x");
    await tx.wait();

    smartWalletOwnership = new ethers.Contract(
      smartWallet.target,
      ownershipModule.interface,
      entryPoint
    ) as unknown as Ownership;
  });

  it("should change public key", async function () {
    const newKeyPair = await createPasskey();
    const tx = await smartWalletOwnership.transferOwnership({
      x: newKeyPair.x,
      y: newKeyPair.y,
    });
    await tx.wait();

    const publicKey = await smartWallet.publicKey();
    expect(publicKey.x).to.equal(newKeyPair.x);
    expect(publicKey.y).to.equal(newKeyPair.y);
  });

  it("should revert if not entry point address", async function () {
    const newKeyPair = await createPasskey();
    await expect(
      smartWalletOwnership.connect(account1).transferOwnership({
        x: newKeyPair.x,
        y: newKeyPair.y,
      })
    ).to.be.reverted;
  });
});
