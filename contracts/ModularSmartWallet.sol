// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {IModularSmartWallet} from "./interfaces/IModularSmartWallet.sol";
import {ICommon} from "./interfaces/ICommon.sol";
import {IModule} from "./interfaces/IModule.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {Common} from "./Common.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {BaseAccount} from "@account-abstraction/contracts/core/BaseAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "@account-abstraction/contracts/core/Helpers.sol";
import {WebAuthn} from "./third-party/WebAuthn.sol";

contract ModularSmartWallet is IModularSmartWallet, BaseAccount, Common, ERC165 {
    constructor(address entryPoint_, PublicKey memory publicKey_) {
        MainStorage storage s = _getMainStorage();
        s.entryPoint = entryPoint_;
        s.publicKey = publicKey_;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC721Receiver).interfaceId || interfaceId == type(IERC1155Receiver).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function entryPoint() public view override(BaseAccount, Common) returns (IEntryPoint) {
        return Common.entryPoint();
    }

    function publicKey() public view returns (PublicKey memory) {
        return _getMainStorage().publicKey;
    }

    function isInstalled(address module) public view returns (bool) {
        return _getMainStorage().installed[module];
    }

    function addModule(address module, bytes calldata initData) external onlyEntryPoint {
        MainStorage storage s = _getMainStorage();

        require(!s.installed[module], ModuleAlreadyInstalled());

        // Check module implements IModule interface using ERC-165
        require(IERC165(module).supportsInterface(type(IModule).interfaceId), InvalidModule());

        // Triggers state change and get selectors of module's methods
        (bool success, bytes memory data) =
            module.delegatecall(abi.encodeWithSelector(IModule.installModule.selector, initData));
        require(success, InstallFailed(data));

        // Add method's selectors to methods
        bytes4[] memory selectors = abi.decode(data, (bytes4[]));
        for (uint256 i = 0; i < selectors.length; i++) {
            bytes4 selector = selectors[i];
            require(s.methods[selector] == address(0), SelectorCollision(selector));
            s.methods[selector] = module;
        }

        s.installed[module] = true;

        emit ModuleInstalled(module);
    }

    function removeModule(address module) external onlyEntryPoint {
        MainStorage storage s = _getMainStorage();

        require(s.installed[module], ModuleNotInstalled());

        // Triggers state cleanup and get selectors of module's methods
        (bool success, bytes memory data) =
            module.delegatecall(abi.encodeWithSelector(IModule.uninstallModule.selector));
        require(success, UninstallFailed(data));

        // Remove method's selectors from methods
        bytes4[] memory selectors = abi.decode(data, (bytes4[]));
        for (uint256 i = 0; i < selectors.length; i++) {
            s.methods[selectors[i]] = address(0);
        }

        s.installed[module] = false;

        emit ModuleUninstalled(module);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    fallback() external payable {
        address module = _getMainStorage().methods[msg.sig];
        // Revert if no method found
        // Doesn't return error to emulate normal behavior
        require(module != address(0));
        _delegate(module);
    }

    // Allow the wallet to receive ETH
    receive() external payable {}

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 /*userOpHash is included in the challenge*/
    ) internal view override onlyEntryPoint returns (uint256 validationData) {
        PasskeySig memory passkeySig = abi.decode(userOp.signature, (PasskeySig));

        uint8 version = uint8(passkeySig.challenge[0]);
        if (version != 1) return SIG_VALIDATION_FAILED;
        // Extract validUntil (next 6 bytes)
        // bytes7(passkeySig.challenge) is the first 8 bytes of the challenge
        // << 8 shifts it left by 1 byte to remove the version
        // bytes6() extracts the first 6 bytes
        uint48 validUntil = uint48(bytes6(bytes7(passkeySig.challenge) << 8));
        if (validUntil != 0 && validUntil <= block.timestamp) return SIG_VALIDATION_FAILED;

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

    function _delegate(address module) private {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), module, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
