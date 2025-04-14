import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "hardhat";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { createPasskey, signUserOp } from "./utils/signing";
import { createUserOp, getUserOpHash } from "./utils/userOp";
import { entryPointAddress, usdcAddress } from "./utils/constants";
import { Contract, Signer } from "ethers";
import { ModularSmartWallet, IEntryPoint } from "../typechain-types";
import ERC20Abi from "../abi/ERC20Abi.json";

describe("Wallet", function () {
  let smartWallet: ModularSmartWallet;
  let entryPoint: IEntryPoint;
  let account1: Signer;
  let account2: Signer;
  let keyPair: {
    p256: { name: string; namedCurve: string; hash: string };
    key: CryptoKeyPair;
    x: string;
    y: string;
  };

  before(async function () {
    [account1, account2] = await ethers.getSigners();
  });

  beforeEach(async function () {
    keyPair = await createPasskey();

    entryPoint = await ethers.getContractAt("IEntryPoint", entryPointAddress);

    const ModularSmartWallet = await ethers.getContractFactory(
      "ModularSmartWallet"
    );
    smartWallet = await ModularSmartWallet.deploy(entryPointAddress, {
      x: keyPair.x,
      y: keyPair.y,
    });

    await setBalance(smartWallet.target.toString(), ethers.parseEther("100"));
  });

  it("should deploy the wallet with the correct public key", async function () {
    const walletPublicKey = await smartWallet.publicKey();
    const entryPoint = await smartWallet.entryPoint();

    expect(walletPublicKey.x).to.equal(keyPair.x);
    expect(walletPublicKey.y).to.equal(keyPair.y);
    expect(entryPoint).to.equal(entryPointAddress);
  });

  it("should get validation from wallet", async function () {
    const userOp = await createUserOp(smartWallet, "0x");
    const userOpHash = await getUserOpHash(entryPoint, userOp);
    const { signatureEncoded } = await signUserOp(userOpHash, keyPair.key);
    userOp.signature = signatureEncoded;

    await network.provider.send("hardhat_impersonateAccount", [
      entryPointAddress,
    ]);
    const entryPointSigner = await ethers.getSigner(entryPointAddress);
    const validationData = await smartWallet
      .connect(entryPointSigner)
      .validateUserOp.staticCall(userOp, userOpHash, 0);

    expect(validationData).to.equal(0, "validationData should be 0");
  });

  it("should make a tx without calldata", async function () {
    const initialBalance = await ethers.provider.getBalance(
      await account2.getAddress()
    );

    const transferAmount = ethers.parseEther("1.0");
    const callData = smartWallet.interface.encodeFunctionData("execute", [
      await account2.getAddress(),
      transferAmount,
      "0x",
    ]);

    const userOp = await createUserOp(smartWallet, callData);
    const userOpHash = await getUserOpHash(entryPoint, userOp);
    const { signatureEncoded } = await signUserOp(userOpHash, keyPair.key);
    userOp.signature = signatureEncoded;

    const tx = await entryPoint.handleOps(
      [userOp],
      await account1.getAddress()
    );
    await tx.wait();

    const finalBalance = await ethers.provider.getBalance(
      await account2.getAddress()
    );
    expect(finalBalance - initialBalance).to.equal(transferAmount);
  });

  it("should make a tx with calldata", async function () {
    const usdcContract = new Contract(usdcAddress, ERC20Abi, account1);
    const allowance = ethers.parseUnits("100", 6);
    const approveCallData = usdcContract.interface.encodeFunctionData(
      "approve",
      [await account2.getAddress(), allowance]
    );
    const callData = smartWallet.interface.encodeFunctionData("execute", [
      usdcAddress,
      0,
      approveCallData,
    ]);

    const userOp = await createUserOp(smartWallet, callData);
    const userOpHash = await getUserOpHash(entryPoint, userOp);
    const { signatureEncoded } = await signUserOp(userOpHash, keyPair.key);
    userOp.signature = signatureEncoded;

    const tx = await entryPoint.handleOps(
      [userOp],
      await account1.getAddress()
    );
    await tx.wait();

    const usdcAllowance = await usdcContract.allowance(
      smartWallet.target,
      await account2.getAddress()
    );
    expect(usdcAllowance).to.equal(allowance);
  });

  it("should revert if invalid nonce", async function () {
    const transferAmount = ethers.parseEther("1.0");
    const callData = smartWallet.interface.encodeFunctionData("execute", [
      await account2.getAddress(),
      transferAmount,
      "0x",
    ]);

    const userOp = await createUserOp(smartWallet, callData);
    userOp.nonce = 1n;
    const userOpHash = await getUserOpHash(entryPoint, userOp);
    const { signatureEncoded } = await signUserOp(userOpHash, keyPair.key);
    userOp.signature = signatureEncoded;

    await setBalance(entryPointAddress, ethers.parseEther("100"));

    await expect(entryPoint.handleOps([userOp], await account1.getAddress())).to
      .be.reverted;
  });
});
