import { expect } from "chai";
import { ethers } from "hardhat";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { createPasskey, signUserOp } from "./utils/signing";
import { createUserOp, getUserOpHash } from "./utils/userOp";
import { entryPointAddress } from "./utils/constants";
import { Signer } from "ethers";
import {
  ModularSmartWallet,
  IEntryPoint,
  MockModule,
  InvalidModule,
  NoERC165Module,
} from "../typechain-types";

describe("Modules", function () {
  let smartWallet: ModularSmartWallet;
  let mockModule: MockModule;
  let noErc165Module: NoERC165Module;
  let invalidModule: InvalidModule;
  let account1: Signer;
  let entryPoint: IEntryPoint;
  let keyPair: {
    p256: { name: string; namedCurve: string; hash: string };
    key: CryptoKeyPair;
    x: string;
    y: string;
  };

  before(async function () {
    [account1] = await ethers.getSigners();
    entryPoint = await ethers.getContractAt("IEntryPoint", entryPointAddress);
  });

  beforeEach(async function () {
    keyPair = await createPasskey();

    const ModularSmartWallet = await ethers.getContractFactory(
      "ModularSmartWallet"
    );
    const MockModule = await ethers.getContractFactory("MockModule");
    const InvalidModule = await ethers.getContractFactory("InvalidModule");
    const NoErc165Module = await ethers.getContractFactory("NoERC165Module");

    smartWallet = await ModularSmartWallet.deploy(entryPointAddress, {
      x: keyPair.x,
      y: keyPair.y,
    });
    mockModule = await MockModule.deploy();
    invalidModule = await InvalidModule.deploy();
    noErc165Module = await NoErc165Module.deploy();

    await setBalance(await smartWallet.getAddress(), ethers.parseEther("100"));
  });

  describe("Module Management", function () {
    describe("addModule", function () {
      it("should install module", async function () {
        const callData = smartWallet.interface.encodeFunctionData("addModule", [
          await mockModule.getAddress(),
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

        expect(await smartWallet.isInstalled(await mockModule.getAddress())).to
          .be.true;
      });

      it("should emit ModuleInstalled event", async function () {
        const callData = smartWallet.interface.encodeFunctionData("addModule", [
          await mockModule.getAddress(),
          "0x",
        ]);

        const userOp = await createUserOp(smartWallet, callData);
        const userOpHash = await getUserOpHash(entryPoint, userOp);
        const { signatureEncoded } = await signUserOp(userOpHash, keyPair.key);
        userOp.signature = signatureEncoded;

        await expect(
          await entryPoint.handleOps([userOp], await account1.getAddress())
        )
          .to.emit(smartWallet, "ModuleInstalled")
          .withArgs(await mockModule.getAddress());
      });

      it("should not add a module twice", async function () {
        const callData = smartWallet.interface.encodeFunctionData("addModule", [
          await mockModule.getAddress(),
          "0x",
        ]);

        const userOp1 = await createUserOp(smartWallet, callData);
        const userOpHash1 = await getUserOpHash(entryPoint, userOp1);
        const { signatureEncoded: signatureEncoded1 } = await signUserOp(
          userOpHash1,
          keyPair.key
        );
        userOp1.signature = signatureEncoded1;

        let tx = await entryPoint.handleOps(
          [userOp1],
          await account1.getAddress()
        );
        await tx.wait();

        const userOp2 = await createUserOp(smartWallet, callData);
        const userOpHash2 = await getUserOpHash(entryPoint, userOp2);
        const { signatureEncoded: signatureEncoded2 } = await signUserOp(
          userOpHash2,
          keyPair.key
        );
        userOp2.signature = signatureEncoded2;

        tx = await entryPoint.handleOps([userOp2], await account1.getAddress());
        const receipt = await tx.wait();

        const errorEvents = receipt?.logs
          .filter((log) => {
            try {
              const parsedLog = entryPoint.interface.parseLog(log);
              return parsedLog?.name === "UserOperationRevertReason";
            } catch (e) {
              return false;
            }
          })
          .map((log) => entryPoint.interface.parseLog(log));

        expect(errorEvents?.length).to.be.greaterThan(0);
      });

      it("should revert if no ERC165 support", async function () {
        const callData = smartWallet.interface.encodeFunctionData("addModule", [
          await noErc165Module.getAddress(),
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

        expect(await smartWallet.isInstalled(await invalidModule.getAddress()))
          .to.be.false;
      });

      it("should revert if no IModule support", async function () {
        const callData = smartWallet.interface.encodeFunctionData("addModule", [
          await invalidModule.getAddress(),
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

        expect(await smartWallet.isInstalled(await invalidModule.getAddress()))
          .to.be.false;
      });

      it("should revert if not from entry point", async function () {
        await expect(
          smartWallet.addModule(mockModule.target, "0x")
        ).to.be.revertedWithCustomError(smartWallet, "OnlyEntryPoint");
      });

      it("should revert if a selector is already registered", async function () {
        const MockModule = await ethers.getContractFactory("MockModule");
        const mockModule2 = await MockModule.deploy();

        // install the first mock module
        const callData = smartWallet.interface.encodeFunctionData("addModule", [
          await mockModule.getAddress(),
          "0x",
        ]);

        const userOp = await createUserOp(smartWallet, callData);
        const userOpHash = await getUserOpHash(entryPoint, userOp);
        const { signatureEncoded } = await signUserOp(userOpHash, keyPair.key);
        userOp.signature = signatureEncoded;

        let tx = await entryPoint.handleOps(
          [userOp],
          await account1.getAddress()
        );
        await tx.wait();

        // install the second mock module with the same selectors
        const callData2 = smartWallet.interface.encodeFunctionData(
          "addModule",
          [await mockModule2.getAddress(), "0x"]
        );

        const userOp2 = await createUserOp(smartWallet, callData2);
        const userOpHash2 = await getUserOpHash(entryPoint, userOp2);
        const { signatureEncoded: signatureEncoded2 } = await signUserOp(
          userOpHash2,
          keyPair.key
        );
        userOp2.signature = signatureEncoded2;

        // Execute the transaction and check for error events
        tx = await entryPoint.handleOps([userOp2], await account1.getAddress());
        const receipt = await tx.wait();

        const errorEvents = receipt?.logs
          .filter((log) => {
            try {
              const parsedLog = entryPoint.interface.parseLog(log);
              return parsedLog?.name === "UserOperationRevertReason";
            } catch (e) {
              return false;
            }
          })
          .map((log) => entryPoint.interface.parseLog(log));

        expect(errorEvents?.length).to.be.greaterThan(0);
      });
    });

    describe("Removing a module", function () {
      beforeEach(async function () {
        const callData = smartWallet.interface.encodeFunctionData("addModule", [
          await mockModule.getAddress(),
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
      });

      it("should uninstall a module", async function () {
        const callData = smartWallet.interface.encodeFunctionData(
          "removeModule",
          [await mockModule.getAddress()]
        );

        const userOp = await createUserOp(smartWallet, callData);
        const userOpHash = await getUserOpHash(entryPoint, userOp);
        const { signatureEncoded: removeSignatureEncoded } = await signUserOp(
          userOpHash,
          keyPair.key
        );
        userOp.signature = removeSignatureEncoded;

        const tx = await entryPoint.handleOps(
          [userOp],
          await account1.getAddress()
        );
        await tx.wait();

        expect(await smartWallet.isInstalled(await mockModule.getAddress())).to
          .be.false;
      });

      it("should emit ModuleUninstalled event", async function () {
        const callData = smartWallet.interface.encodeFunctionData(
          "removeModule",
          [await mockModule.getAddress()]
        );

        const userOp = await createUserOp(smartWallet, callData);
        const userOpHash = await getUserOpHash(entryPoint, userOp);
        const { signatureEncoded: removeSignatureEncoded } = await signUserOp(
          userOpHash,
          keyPair.key
        );
        userOp.signature = removeSignatureEncoded;

        await expect(
          await entryPoint.handleOps([userOp], await account1.getAddress())
        )
          .to.emit(smartWallet, "ModuleUninstalled")
          .withArgs(await mockModule.getAddress());
      });

      it("should revert if module not installed", async function () {
        const callData = smartWallet.interface.encodeFunctionData(
          "removeModule",
          [await mockModule.getAddress()]
        );

        const userOp1 = await createUserOp(smartWallet, callData);
        const userOpHash1 = await getUserOpHash(entryPoint, userOp1);
        const { signatureEncoded: signatureEncoded1 } = await signUserOp(
          userOpHash1,
          keyPair.key
        );
        userOp1.signature = signatureEncoded1;

        let tx = await entryPoint.handleOps(
          [userOp1],
          await account1.getAddress()
        );
        await tx.wait();

        const userOp2 = await createUserOp(smartWallet, callData);
        const userOpHash2 = await getUserOpHash(entryPoint, userOp2);
        const { signatureEncoded: signatureEncoded2 } = await signUserOp(
          userOpHash2,
          keyPair.key
        );
        userOp2.signature = signatureEncoded2;

        tx = await entryPoint.handleOps([userOp2], await account1.getAddress());
        const receipt = await tx.wait();

        const errorEvents = receipt?.logs
          .filter((log) => {
            try {
              const parsedLog = entryPoint.interface.parseLog(log);
              return parsedLog?.name === "UserOperationRevertReason";
            } catch (e) {
              return false;
            }
          })
          .map((log) => entryPoint.interface.parseLog(log));

        expect(errorEvents?.length).to.be.greaterThan(0);
      });

      it("should revert if not from entry point", async function () {
        await expect(
          smartWallet.removeModule(mockModule.target)
        ).to.be.revertedWithCustomError(smartWallet, "OnlyEntryPoint");
      });
    });
  });

  describe("Module Delegation", function () {
    beforeEach(async function () {
      const callData = smartWallet.interface.encodeFunctionData("addModule", [
        await mockModule.getAddress(),
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
    });

    it("should delegate calls to the module", async function () {
      const value = 42;

      const callData = mockModule.interface.encodeFunctionData("setValue", [
        value,
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

      const moduleCaller = new ethers.Contract(
        await smartWallet.getAddress(),
        mockModule.interface,
        ethers.provider
      );

      expect(await moduleCaller.getValue()).to.equal(value);
    });

    it("should properly unregister module methods after removal", async function () {
      const callData = smartWallet.interface.encodeFunctionData(
        "removeModule",
        [await mockModule.getAddress()]
      );

      const userOp = await createUserOp(smartWallet, callData);
      const userOpHash = await getUserOpHash(entryPoint, userOp);
      const { signatureEncoded } = await signUserOp(userOpHash, keyPair.key);
      userOp.signature = signatureEncoded;

      await entryPoint.handleOps([userOp], await account1.getAddress());

      const moduleCaller = new ethers.Contract(
        await smartWallet.getAddress(),
        mockModule.interface,
        ethers.provider
      );

      await expect(moduleCaller.getValue()).to.be.reverted;
    });
  });
});
