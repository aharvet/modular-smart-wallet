import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "hardhat";
import { createPasskey, signUserOp } from "./utils/signing";

describe("ModularSmartWallet", function () {
  let smartWallet: any;
  // Mainnet EntryPoint address
  let account1: any;
  let account2: any;
  let keyPair: { p256: any; key: CryptoKeyPair; x: string; y: string };

  let entryPointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  before(async function () {
    [account1, account2] = await ethers.getSigners();
  });

  beforeEach(async function () {
    keyPair = await createPasskey();

    const ModularSmartWallet = await ethers.getContractFactory(
      "ModularSmartWallet"
    );
    smartWallet = await ModularSmartWallet.deploy(entryPointAddress, {
      x: keyPair.x,
      y: keyPair.y,
    });

    await network.provider.send("hardhat_setBalance", [
      smartWallet.target,
      "0x56BC75E2D63100000", // 100 ETH in hex (100 * 10^18)
    ]);
  });

  it("should deploy the wallet with the correct public key", async function () {
    const walletPublicKey = await smartWallet.publicKey();

    expect(walletPublicKey.x).to.equal(keyPair.x);
    expect(walletPublicKey.y).to.equal(keyPair.y);

    const entryPoint = await smartWallet.entryPoint();
    expect(entryPoint).to.equal(entryPointAddress);
  });

  it("should send 1 ETH to account2", async function () {
    const initialBalance = await ethers.provider.getBalance(account2.address);

    const transferAmount = ethers.parseEther("1.0");
    const callData = smartWallet.interface.encodeFunctionData("execute", [
      account2.address,
      transferAmount,
      "0x",
    ]);

    const nonce = await smartWallet.getNonce();

    const maxFeePerGas = 100000000000n; // 100 gwei
    const maxPriorityFeePerGas = 5000000000n; // 5 gwei

    const gasFees = ethers.solidityPacked(
      ["uint128", "uint128"],
      [maxPriorityFeePerGas, maxFeePerGas]
    );

    const verificationGasLimit = 500000n;
    const callGasLimit = 200000n;
    const accountGasLimits = ethers.solidityPacked(
      ["uint128", "uint128"],
      [verificationGasLimit, callGasLimit]
    );

    const userOp = {
      sender: smartWallet.target,
      nonce: nonce,
      initCode: "0x",
      callData: callData,
      accountGasLimits: accountGasLimits,
      preVerificationGas: 50000n,
      gasFees: gasFees,
      paymasterAndData: "0x",
      signature: "0x",
    };

    const entryPoint = await ethers.getContractAt(
      "IEntryPoint",
      entryPointAddress
    );

    const userOpHash = await entryPoint.getUserOpHash(userOp);

    const { signatureEncoded, passkeySig } = await signUserOp(
      userOpHash,
      keyPair.key
    );

    const MockWebAuthn = await ethers.getContractFactory("MockWebAuthn");
    const mockWebAuthn = await MockWebAuthn.deploy();
    const result = await mockWebAuthn.verifySignature(
      passkeySig.challenge,
      passkeySig.authenticatorData,
      passkeySig.requireUserVerification,
      passkeySig.clientDataJSON,
      passkeySig.challengeLocation,
      passkeySig.responseTypeLocation,
      passkeySig.r,
      passkeySig.s,
      keyPair.x,
      keyPair.y
    );

    expect(result).to.equal(true, "webauthn level");

    userOp.signature = signatureEncoded;

    const smartWalletContract = await ethers.getContractAt(
      "ModularSmartWallet",
      smartWallet.target
    );

    await network.provider.send("hardhat_setBalance", [
      entryPointAddress,
      "0x56BC75E2D63100000", // 100 ETH in hex (100 * 10^18)
    ]);

    await network.provider.send("hardhat_impersonateAccount", [
      entryPointAddress,
    ]);
    const entryPointSigner = await ethers.getSigner(entryPointAddress);
    const validationData = await smartWalletContract
      .connect(entryPointSigner)
      .validateUserOp.staticCall(userOp, userOpHash, 0);
    expect(validationData).to.equal(0, "validationData should be 0");

    const tx = await smartWalletContract
      .connect(entryPointSigner)
      .validateUserOp(userOp, userOpHash, 0);
    await tx.wait();

    await entryPoint.handleOps([userOp], account1.address);

    const finalBalance = await ethers.provider.getBalance(account2.address);
    expect(finalBalance - initialBalance).to.equal(transferAmount);
  });
});
