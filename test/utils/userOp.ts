import { ethers } from "hardhat";
import { IEntryPoint } from "../../typechain-types";
import { ModularSmartWallet } from "../../typechain-types";

type UserOp = {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  accountGasLimits: string;
  preVerificationGas: bigint;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
};

export async function createUserOp(
  smartWallet: ModularSmartWallet,
  callData: string
): Promise<UserOp> {
  const nonce = await smartWallet.getNonce();

  const verificationGasLimit = 500000n;
  const callGasLimit = 200000n;
  const accountGasLimits = ethers.solidityPacked(
    ["uint128", "uint128"],
    [verificationGasLimit, callGasLimit]
  );

  const maxFeePerGas = 100000000000n; // 100 gwei
  const maxPriorityFeePerGas = 5000000000n; // 5 gwei
  const gasFees = ethers.solidityPacked(
    ["uint128", "uint128"],
    [maxPriorityFeePerGas, maxFeePerGas]
  );

  return {
    sender: smartWallet.target.toString(),
    nonce: nonce,
    initCode: "0x",
    callData: callData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: 50000n,
    gasFees: gasFees,
    paymasterAndData: "0x",
    signature: "0x",
  };
}

export async function getUserOpHash(
  entryPoint: IEntryPoint,
  userOp: UserOp
): Promise<string> {
  return await entryPoint.getUserOpHash(userOp);
}
