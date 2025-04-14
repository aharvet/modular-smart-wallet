import { ethers } from "hardhat";
import { setStorageAt } from "@nomicfoundation/hardhat-network-helpers";
import { usdcAddress, wethAddress, uniswapV2RouterAddress } from "./constants";

interface DcaParams {
  router?: string;
  tokenIn?: string;
  tokenOut?: string;
  dayFrequency?: number;
  amountIn?: bigint;
  start?: number;
  end?: number;
}

export function getTestDcaInitData({
  router = uniswapV2RouterAddress,
  tokenIn = usdcAddress,
  tokenOut = wethAddress,
  dayFrequency = 30,
  amountIn = ethers.parseUnits("100", 6),
  start = getTimestampSeconds(),
  end = start + 6 * getSecondsForDays(30),
}: DcaParams = {}) {
  const initData = new ethers.AbiCoder().encode(
    [
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
    ],
    [router, tokenIn, tokenOut, dayFrequency, amountIn, start, end]
  );

  return {
    router,
    tokenIn,
    tokenOut,
    dayFrequency,
    amountIn,
    start,
    end,
    initData,
  };
}

export function getSecondsForDays(days: number) {
  return days * 24 * 60 * 60;
}

export async function mintUsdc(address: string) {
  const usdcBalanceSlot = 9; // Slot number for balances mapping in USDC mainnet
  // Calculate storage balance slot for address
  const index = ethers.solidityPackedKeccak256(
    ["uint256", "uint256"],
    [address, usdcBalanceSlot]
  );

  // Set the balance directly in storage
  const amount = ethers.parseUnits("100000", 6);
  await setStorageAt(usdcAddress, index, ethers.toBeHex(amount, 32));
}

function getTimestampSeconds() {
  return Math.floor(Date.now() / 1000);
}
