// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {IModule} from "../interfaces/IModule.sol";
import {IModularSmartWallet} from "../interfaces/IModularSmartWallet.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Common} from "../Common.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ICommon} from "../interfaces/ICommon.sol";

contract Ownership is IModule, ERC165, Common {
    bytes4[] private methods;

    constructor() {
        methods = new bytes4[](1);
        methods[0] = Ownership.transferOwnership.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IModule).interfaceId || super.supportsInterface(interfaceId);
    }

    function installModule() external view returns (bytes4[] memory) {
        return methods;
    }

    function uninstallModule() external view returns (bytes4[] memory) {
        return methods;
    }

    function transferOwnership(ICommon.PublicKey memory newPublicKey) external onlyEntryPoint {
        _getMainStorage().publicKey = newPublicKey;
    }
}
