import { expect } from "chai";
import { ethers } from "hardhat";
import { createPasskey } from "./utils/signing";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ModularSmartWallet, DCA } from "../typechain-types";
import { getTestDcaInitData, getSecondsForDays, mintUsdc } from "./utils/dca";
import {
  wethAddress,
  usdcAddress,
  uniswapV2RouterAddress,
} from "./utils/constants";
import erc20Abi from "../abi/ERC20Abi.json";

describe("DCA", function () {
  let smartWallet: ModularSmartWallet;
  let dcaModule: DCA;
  let smartWalletDca: DCA;
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
    const DcaModule = await ethers.getContractFactory("DCA");
    dcaModule = await DcaModule.deploy();

    smartWallet = await ModularSmartWallet.connect(entryPoint).deploy(
      await entryPoint.getAddress(),
      {
        x: keyPair.x,
        y: keyPair.y,
      }
    );

    smartWalletDca = new ethers.Contract(
      smartWallet.target,
      dcaModule.interface,
      entryPoint
    ) as unknown as DCA;
  });

  describe("Installation", function () {
    it("should set the init data", async function () {
      const {
        initData,
        router,
        tokenIn,
        tokenOut,
        dayFrequency,
        amountIn,
        start,
        end,
      } = getTestDcaInitData();

      const tx = await smartWallet.addModule(dcaModule.target, initData);
      await tx.wait();

      const settings = await smartWalletDca.getSettings();

      expect(settings.router).to.equal(router);
      expect(settings.path[0]).to.equal(tokenIn);
      expect(settings.path[1]).to.equal(tokenOut);
      expect(settings.dayFrequency).to.equal(dayFrequency);
      expect(settings.amountIn).to.equal(amountIn);
      expect(settings.start).to.equal(start);
      expect(settings.end).to.equal(end);
      expect(settings.lastPeriodExecuted).to.equal(0);
    });

    it("should approve the router", async function () {
      const { initData } = getTestDcaInitData();

      const tx = await smartWallet.addModule(dcaModule.target, initData);
      await tx.wait();

      const usdc = new ethers.Contract(usdcAddress, erc20Abi, entryPoint);
      const allowance = await usdc.allowance(
        smartWallet.target,
        uniswapV2RouterAddress
      );

      expect(allowance).to.equal(ethers.MaxUint256);
    });

    it("should revert if invalid router", async function () {
      const { initData } = getTestDcaInitData({
        router: ethers.ZeroAddress,
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(dcaModule.interface.getError("InvalidRouter")!.selector);
    });

    it("should revert if invalid tokenIn", async function () {
      const { initData } = getTestDcaInitData({
        tokenIn: ethers.ZeroAddress,
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(dcaModule.interface.getError("InvalidToken")!.selector);
    });

    it("should revert if invalid tokenOut", async function () {
      const { initData } = getTestDcaInitData({
        tokenOut: ethers.ZeroAddress,
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(dcaModule.interface.getError("InvalidToken")!.selector);
    });

    it("should revert if same tokens", async function () {
      const { initData } = getTestDcaInitData({
        tokenIn: wethAddress,
        tokenOut: wethAddress,
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(dcaModule.interface.getError("InvalidToken")!.selector);
    });

    it("should revert if invalid day frequency", async function () {
      const { initData } = getTestDcaInitData({
        dayFrequency: 0,
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(
          dcaModule.interface.getError("InvalidDayFrequency")!.selector
        );
    });

    it("should revert if invalid amountIn", async function () {
      const { initData } = getTestDcaInitData({
        amountIn: ethers.parseUnits("0", 6),
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(dcaModule.interface.getError("InvalidAmountIn")!.selector);
    });

    it("should revert if start before now", async function () {
      const block = await ethers.provider.getBlock("latest");
      const { initData } = getTestDcaInitData({
        start: block!.timestamp - 1,
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(dcaModule.interface.getError("InvalidTimeframe")!.selector);
    });

    it("should revert if start before now", async function () {
      const block = await ethers.provider.getBlock("latest");
      const { initData } = getTestDcaInitData({
        start: block!.timestamp + 1,
        end: block!.timestamp - 1,
      });

      await expect(smartWallet.addModule(dcaModule.target, initData))
        .to.be.revertedWithCustomError(smartWallet, "InstallFailed")
        .withArgs(dcaModule.interface.getError("InvalidTimeframe")!.selector);
    });
  });

  describe("Uninstall", function () {
    beforeEach(async function () {
      const { initData } = getTestDcaInitData();

      const tx = await smartWallet.addModule(dcaModule.target, initData);
      await tx.wait();
    });

    it("should reset approval to router", async function () {
      const tx = await smartWallet.removeModule(dcaModule.target);
      await tx.wait();

      const usdc = new ethers.Contract(usdcAddress, erc20Abi, entryPoint);
      const allowance = await usdc.allowance(
        smartWallet.target,
        uniswapV2RouterAddress
      );

      expect(allowance).to.equal(0);
    });
  });

  describe("Buy", function () {
    const dayFrequency = 1;
    const amountIn = ethers.parseUnits("100", 6);
    let currentTime: number;

    beforeEach(async function () {
      currentTime = await ethers.provider
        .getBlock("latest")
        .then((block) => block!.timestamp);
      const { initData } = getTestDcaInitData({
        dayFrequency,
        amountIn,
        start: currentTime + 1,
        end: currentTime + getSecondsForDays(30),
      });

      const tx = await smartWallet.addModule(dcaModule.target, initData);
      await tx.wait();

      await mintUsdc(smartWallet.target.toString());
    });

    it("should successfully trigger buy", async function () {
      const weth = new ethers.Contract(wethAddress, erc20Abi, entryPoint);
      const beforeBalance = await weth.balanceOf(smartWallet.target.toString());

      await smartWalletDca.triggerBuy();

      const afterBalance = await weth.balanceOf(smartWallet.target.toString());
      expect(afterBalance).to.be.gt(beforeBalance);
    });

    it("should correctly set period", async function () {
      await smartWalletDca.triggerBuy();

      const settings = await smartWalletDca.getSettings();
      expect(settings.lastPeriodExecuted).to.equal(1);
    });

    it("should correctly buy along periods", async function () {
      await smartWalletDca.triggerBuy();

      await time.increase(getSecondsForDays(1));

      await smartWalletDca.triggerBuy();

      await time.increase(getSecondsForDays(1));

      await smartWalletDca.triggerBuy();

      const settings = await smartWalletDca.getSettings();
      expect(settings.lastPeriodExecuted).to.equal(3);
    });

    it("should allow buy once if period missed", async function () {
      const usdc = new ethers.Contract(usdcAddress, erc20Abi, entryPoint);
      const beforeBalance = await usdc.balanceOf(smartWallet.target.toString());

      await time.increase(getSecondsForDays(1));

      await smartWalletDca.triggerBuy();

      const afterBalance = await usdc.balanceOf(smartWallet.target.toString());
      const settings = await smartWalletDca.getSettings();

      expect(beforeBalance - afterBalance).to.equal(amountIn);
      expect(settings.lastPeriodExecuted).to.equal(2);
    });

    it("should allow any account to buy", async function () {
      const tx = await smartWalletDca.connect(account1).triggerBuy();
      await tx.wait();
    });

    it("should emit BuyTriggered event", async function () {
      await expect(smartWalletDca.triggerBuy()).to.emit(
        smartWalletDca,
        "BuyTriggered"
      );
    });

    it("should revert when buy before the start time", async function () {
      await smartWallet.removeModule(dcaModule.target);
      const { initData } = getTestDcaInitData({
        start: currentTime + 3600,
      });
      await smartWallet.addModule(dcaModule.target, initData);

      await expect(smartWalletDca.triggerBuy()).to.be.revertedWithCustomError(
        dcaModule,
        "BuyNotAllowed"
      );
    });

    it("should revert when buy after the end time", async function () {
      await time.increase(getSecondsForDays(90));

      await expect(smartWalletDca.triggerBuy()).to.be.revertedWithCustomError(
        dcaModule,
        "BuyNotAllowed"
      );
    });

    it("should revert when buy twice for same period", async function () {
      await smartWalletDca.triggerBuy();

      await expect(smartWalletDca.triggerBuy()).to.be.revertedWithCustomError(
        dcaModule,
        "BuyNotAllowed"
      );
    });
  });
});
