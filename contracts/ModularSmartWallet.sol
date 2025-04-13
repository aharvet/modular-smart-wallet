// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {BaseAccount} from "@account-abstraction/contracts/core/BaseAccount.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "@account-abstraction/contracts/core/Helpers.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {WebAuthn} from "./third-party/WebAuthn.sol";
import "hardhat/console.sol";

struct PublicKey {
    uint256 x;
    uint256 y;
}

struct PasskeySig {
    bytes challenge; // abi.encodePacked(version, validUntil, userOpHash)
    bytes authenticatorData;
    bool requireUserVerification;
    string clientDataJSON;
    uint256 challengeLocation;
    uint256 responseTypeLocation;
    uint256 r;
    uint256 s;
}

contract ModularSmartWallet is BaseAccount {
    /// @custom:storage-location erc7201:modular-smart-wallet.main
    struct ModularSmartWalletStorage {
        address entryPoint;
        PublicKey publicKey;
    }

    error OnlyEntryPoint();
    error InvalidNonce();

    bytes32 private constant MAIN_STORAGE_LOCATION =
        bytes32(uint256(keccak256("modular-smart-wallet.main")) - 1) & ~bytes32(uint256(0xff));

    function _getMainStorage() private pure returns (ModularSmartWalletStorage storage s) {
        bytes32 position = MAIN_STORAGE_LOCATION;
        assembly {
            s.slot := position
        }
    }

    modifier onlyEntryPoint() {
        require(msg.sender == _getMainStorage().entryPoint, OnlyEntryPoint());
        _;
    }

    constructor(address entryPoint_, PublicKey memory publicKey_) {
        ModularSmartWalletStorage storage s = _getMainStorage();
        s.entryPoint = entryPoint_;
        s.publicKey = publicKey_;
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_getMainStorage().entryPoint);
    }

    function publicKey() public view returns (PublicKey memory) {
        return _getMainStorage().publicKey;
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 /*userOpHash is included in the challenge*/
    ) internal view override onlyEntryPoint returns (uint256 validationData) {
        PasskeySig memory passkeySig = abi.decode(userOp.signature, (PasskeySig));
        PublicKey memory pk = _getMainStorage().publicKey;

        bool success = WebAuthn.verifySignature(
            passkeySig.challenge,
            passkeySig.authenticatorData,
            passkeySig.requireUserVerification,
            passkeySig.clientDataJSON,
            passkeySig.challengeLocation,
            passkeySig.responseTypeLocation,
            passkeySig.r,
            passkeySig.s,
            pk.x,
            pk.y
        );

        validationData = success ? SIG_VALIDATION_SUCCESS : SIG_VALIDATION_FAILED;
    }

    function _validateNonce(uint256 nonce) internal view virtual override {
        require(nonce == getNonce(), InvalidNonce());
    }
}
