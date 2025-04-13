// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface ICommon {
    struct PublicKey {
        uint256 x;
        uint256 y;
    }

    /// @custom:storage-location erc7201:modular-smart-wallet.main
    struct MainStorage {
        address entryPoint;
        PublicKey publicKey;
        mapping(address module => bool installed) installed;
        mapping(bytes4 selector => address module) methods;
    }

    error OnlyEntryPoint();
}
