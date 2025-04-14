// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IModularSmartWallet {
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

    event ModuleInstalled(address indexed module);
    event ModuleUninstalled(address indexed module);

    error InvalidNonce();
    error InvalidModule();
    error ModuleAlreadyInstalled();
    error ModuleNotInstalled();
    error SelectorCollision(bytes4 selector);
    error InstallFailed(bytes errorData);
    error UninstallFailed(bytes errorData);

    function isInstalled(address module) external view returns (bool);
    function addModule(address module, bytes calldata initData) external;
    function removeModule(address module) external;
}
