import base64url from "base64url";
import { ethers } from "hardhat";

export async function createPasskey() {
  const p256 = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const key = await crypto.subtle.generateKey(p256, true, ["sign", "verify"]);
  const pubKeyDer = await crypto.subtle.exportKey("spki", key.publicKey);
  const pubKeyHex = Buffer.from(pubKeyDer).toString("hex");
  const pubKey = Buffer.from(pubKeyHex.substring(54), "hex");

  const x = `0x${pubKey.subarray(0, 32).toString("hex")}`;
  const y = `0x${pubKey.subarray(32).toString("hex")}`;

  return { p256, key, x, y };
}

export function fixMalleability(s: string) {
  const s_bigint = BigInt(s);
  const P256_N =
    115792089210356248762697446949407573529996955224135760342422259061068512044369n;
  const P256_N_DIV_2 =
    57896044605178124381348723474703786764998477612067880171211129530534256022184n;

  if (s_bigint > P256_N_DIV_2) {
    // Convert to low-s form to prevent malleability
    return `0x${(P256_N - s_bigint).toString(16)}`;
  }

  return s;
}

export async function signWithPasskey(
  challenge: Buffer,
  p256: {
    name: string;
    namedCurve: string;
    hash: string;
  },
  key: CryptoKeyPair
) {
  const sigRaw = await crypto.subtle.sign(p256, key.privateKey, challenge);

  const r = `0x${Buffer.from(sigRaw).subarray(0, 32).toString("hex")}`;
  let s = `0x${Buffer.from(sigRaw).subarray(32, 64).toString("hex")}`;
  s = fixMalleability(s);

  return { r, s };
}

export function getClientDataJSON(challenge: Buffer) {
  const challengeb64url = base64url.encode(challenge);

  return JSON.stringify({
    type: "webauthn.get",
    challenge: challengeb64url,
    origin: "http://localhost:3000",
    crossOrigin: false,
  });
}

export async function signUserOp(
  userOpHash: string,
  keyPair: CryptoKeyPair,
  version: number = 1,
  validUntil: number = 0 // No expiration
) {
  // Mock value from simpleWebAuthn library
  const authenticatorData = Buffer.from(
    "49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000",
    "hex"
  );
  const requireUserVerification = false;
  const challengeLocation = 23;
  const responseTypeLocation = 1;

  const validUntilBuf = Buffer.alloc(6); // 6 bytes for uint48
  validUntilBuf.writeUIntBE(validUntil, 0, 6);
  const userOpHashBuf = Buffer.from(userOpHash.slice(2), "hex");

  const challengeBuf = Buffer.concat([
    Buffer.from([version]), // uint8 as single byte
    validUntilBuf,
    userOpHashBuf,
  ]);

  // Create client data JSON and hash it
  const clientDataJSON = getClientDataJSON(challengeBuf);
  const clientDataHash = Buffer.from(
    await crypto.subtle.digest("SHA-256", Buffer.from(clientDataJSON))
  );

  const msgBuf = Buffer.concat([authenticatorData, clientDataHash]);
  const msgHash = Buffer.from(await crypto.subtle.digest("SHA-256", msgBuf));
  const p256 = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const { r, s } = await signWithPasskey(msgBuf, p256, keyPair);

  // Create the PasskeySig struct as expected by the contract
  const passkeySig = {
    challenge: challengeBuf,
    authenticatorData: authenticatorData,
    requireUserVerification: requireUserVerification,
    clientDataJSON: clientDataJSON,
    challengeLocation: challengeLocation,
    responseTypeLocation: responseTypeLocation,
    r: r,
    s: s,
  };

  const signatureEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "tuple(bytes challenge, bytes authenticatorData, bool requireUserVerification, string clientDataJSON, uint256 challengeLocation, uint256 responseTypeLocation, uint256 r, uint256 s)",
    ],
    [passkeySig]
  );

  return {
    passkeySig,
    signatureEncoded,
    msgHash: `0x${msgHash.toString("hex")}`,
  };
}

export async function getBlockTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block!.timestamp;
}
