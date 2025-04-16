import { expect } from "chai";
import { ethers } from "hardhat";
import { createPasskey } from "./utils/signing";
import { entryPointAddress } from "./utils/constants";
import { Signer } from "ethers";
import { ModularSmartWallet } from "../typechain-types";

describe("Reception", function () {
  let smartWallet: ModularSmartWallet;
  let account1: Signer;
  let keyPair: { p256: any; key: CryptoKeyPair; x: string; y: string };

  beforeEach(async function () {
    [account1] = await ethers.getSigners();
    keyPair = await createPasskey();

    const ModularSmartWallet = await ethers.getContractFactory(
      "ModularSmartWallet"
    );
    smartWallet = (await ModularSmartWallet.deploy(entryPointAddress, {
      x: keyPair.x,
      y: keyPair.y,
    })) as ModularSmartWallet;
  });

  describe("ERC165", () => {
    it("should support ERC165 interface", async () => {
      expect(await smartWallet.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("should support ERC721 token receiver interface", async () => {
      expect(await smartWallet.supportsInterface("0x150b7a02")).to.be.true;
    });

    it("should support ERC1155 token receiver interface", async () => {
      expect(await smartWallet.supportsInterface("0x4e2312e0")).to.be.true;
    });

    it("should not support random interface", async () => {
      expect(await smartWallet.supportsInterface("0xb1a332e0")).to.be.false;
    });
  });

  describe("Token Reception", () => {
    it("should correctly implement onERC721Received", async () => {
      const result = await smartWallet.onERC721Received(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0,
        "0x"
      );

      expect(result).to.equal("0x150b7a02");
    });

    it("should correctly implement onERC1155Received", async () => {
      const result = await smartWallet.onERC1155Received(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0,
        0,
        "0x"
      );

      expect(result).to.equal("0xf23a6e61");
    });

    it("should correctly implement onERC1155BatchReceived", async () => {
      const result = await smartWallet.onERC1155BatchReceived(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        [],
        [],
        "0x"
      );

      expect(result).to.equal("0xbc197c81");
    });
  });
});
